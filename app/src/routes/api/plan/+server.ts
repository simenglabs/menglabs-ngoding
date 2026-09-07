import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { perencanaan, fitur, subFitur, kanbanTask } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const SYSTEM = `Kamu adalah planner untuk breakdown proyek. Dari ide user + jawaban klarifikasi + tech stack, buat hierarki terstruktur:

PERENCANAAN -> FITUR (3-4) -> SUB FITUR (2-4 per fitur) -> TASK (3-5 per sub fitur untuk pertama: hanya 1 contoh sub fitur, sisanya kosongkan tasks=[] agar user bisa expand nanti).

Output HARUS JSON valid saja tanpa markdown / fence.

Format:
{
  "perencanaan": {"title":"string","description":"string singkat 1 kalimat"},
  "fiturs": [
    {
      "id":"fitur-1",
      "title":"Fitur A",
      "description":"deskripsi 1 kalimat",
      "subFiturs":[
        {"id":"sub-1-1","title":"Sub A1","description":"...","tasks":[
          {"id":"task-1-1-1","title":"Task","description":"...","priority":"high|medium|low","estimate":"2h|1d"}
        ]}
      ]
    }
  ]
}

Bahasa sesuai permintaan (default Indonesia). Judul fitur/sub fitur konkret, tidak generik "Fitur 1".`;

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { prompt, lang, techMode, techStack, questions, answers } = await request.json();
	// ambil userId jika login (Turso)
	let userId: string | null = null;
	try {
		const { getUserBySession, COOKIE_NAME } = await import('$lib/server/auth');
		const sid = cookies.get(COOKIE_NAME);
		if (sid) {
			const u = await getUserBySession(sid);
			if (u) userId = u.id;
		}
	} catch {}
	if (!prompt || typeof prompt !== 'string' || !prompt.trim()) return json({ message: 'prompt required' }, { status: 400 });

	const baseUrl = env.LLM_BASE_URL ?? 'https://omni.menglabs.id/v1';
	const apiKey = env.LLM_API_KEY;
	const model = env.LLM_MODEL ?? 'antigravity/claude-opus-4-6-thinking';
	if (!apiKey) return json({ message: 'LLM_API_KEY not set' }, { status: 500 });

	const langInstruct = lang === 'English' ? 'Gunakan Bahasa Inggris.' : lang === '日本語' ? 'Gunakan Bahasa Jepang.' : 'Gunakan Bahasa Indonesia.';
	const techInfo =
		techMode === 'manual' && techStack
			? `Tech stack: ${Object.entries(techStack).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ')}`
			: techMode === 'ai'
				? 'Tech stack biarkan AI pilih.'
				: '';

	let qa = '';
	if (Array.isArray(questions) && answers) {
		const qMap = new Map((questions as { id: number; text: string }[]).map((q) => [q.id, q.text]));
		const lines = Object.entries(answers as Record<string, string | string[]>)
			.map(([id, ans]) => {
				const qText = qMap.get(Number(id)) ?? `Q${id}`;
				const aText = Array.isArray(ans) ? ans.join(', ') : String(ans);
				if (!aText.trim()) return null;
				return `Q: ${qText}\nA: ${aText}`;
			})
			.filter(Boolean)
			.join('\n');
		if (lines) qa = `Jawaban klarifikasi:\n${lines}`;
	}

	const userContent = `${langInstruct} ${techInfo} ${qa}\n\nIde: """${prompt.trim()}"""\nOutput JSON hierarki.`;

	try {
		const resp = await fetch(`${baseUrl}/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
			body: JSON.stringify({
				model,
				stream: false,
				max_tokens: 4000,
				temperature: 0.6,
				messages: [
					{ role: 'system', content: SYSTEM },
					{ role: 'user', content: userContent }
				]
			})
		});

		if (!resp.ok) {
			const err = await resp.text();
			console.error('plan LLM error', resp.status, err);
			return json({ message: `LLM error ${resp.status}`, detail: err.slice(0, 1000) }, { status: 502 });
		}

		const data = await resp.json();
		let content: string = data.choices?.[0]?.message?.content ?? '';
		content = content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

		let parsed: unknown;
		try {
			parsed = JSON.parse(content);
		} catch {
			const m = content.match(/\{[\s\S]*\}/);
			if (m) parsed = JSON.parse(m[0]);
			else throw new Error('JSON parse failed: ' + content.slice(0, 600));
		}

		const p = parsed as Record<string, unknown>;
		// light validation
		if (!p.perencanaan || !Array.isArray(p.fiturs)) throw new Error('invalid shape');

		// === Persist ke DB: perencanaan -> fitur -> subFitur -> kanban_task ===
		const per = p.perencanaan as { title: string; description: string };
		const fiturs = p.fiturs as Array<{
			id: string;
			title: string;
			description: string;
			subFiturs: Array<{ id: string; title: string; description: string; tasks?: Array<{ id: string; title: string; description: string; priority: string; estimate: string }> }>;
		}>;

		const [perRow] = await db
			.insert(perencanaan)
			.values({
				userId: userId ?? null,
				title: per.title,
				description: per.description,
				prompt: prompt.trim(),
				lang: lang ?? 'Bahasa Indonesia',
				techMode: techMode ?? null,
				techStackJson: techStack ? JSON.stringify(techStack) : null,
				questionsJson: questions ? JSON.stringify(questions) : null,
				answersJson: answers ? JSON.stringify(answers) : null
			})
			.returning();

		const insertedPlan: typeof parsed & { dbId: string } = { ...(parsed as object), dbId: perRow.id } as typeof parsed & { dbId: string };

		for (let i = 0; i < fiturs.length; i++) {
			const f = fiturs[i];
			const [fRow] = await db
				.insert(fitur)
				.values({
					id: crypto.randomUUID(),
					perencanaanId: perRow.id,
					title: f.title,
					description: f.description,
					orderIdx: i
				})
				.returning();
			// update id untuk referensi sub
			for (let j = 0; j < (f.subFiturs ?? []).length; j++) {
				const s = f.subFiturs[j];
				const [sRow] = await db
					.insert(subFitur)
					.values({
						id: crypto.randomUUID(),
						fiturId: fRow.id,
						perencanaanId: perRow.id,
						title: s.title,
						description: s.description,
						orderIdx: j
					})
					.returning();
				// tasks awal (jika ada contoh)
				for (const t of s.tasks ?? []) {
					await db.insert(kanbanTask).values({
						id: crypto.randomUUID(),
						subFiturId: sRow.id,
						fiturId: fRow.id,
						perencanaanId: perRow.id,
						title: t.title,
						description: t.description,
						priority: t.priority ?? 'medium',
						estimate: t.estimate ?? '1d',
						status: 'todo'
					});
				}
			}
		}

		return json({ plan: parsed, dbId: perRow.id, insertedPlan, usage: data.usage }, { status: 200 });
	} catch (e) {
		console.error(e);
		const fallback = {
			perencanaan: { title: 'Perencanaan MVP', description: prompt.slice(0, 60) },
			fiturs: [
				{ id: 'fitur-1', title: 'Autentikasi & Onboarding', description: 'Login dan setup awal', subFiturs: [{ id: 'sub-1-1', title: 'Login & Register', description: 'Form dan validasi', tasks: [{ id: 't1', title: 'Buat UI login', description: 'Form + error', priority: 'high', estimate: '1d' }] }, { id: 'sub-1-2', title: 'Onboarding flow', description: 'Tutorial awal', tasks: [] }] },
				{ id: 'fitur-2', title: 'Manajemen Data Utama', description: 'CRUD entitas inti', subFiturs: [{ id: 'sub-2-1', title: 'List & Filter', description: 'Tampilkan data', tasks: [] }, { id: 'sub-2-2', title: 'Form Create/Edit', description: 'Validasi', tasks: [] }] },
				{ id: 'fitur-3', title: 'Dashboard & Laporan', description: 'Visualisasi ringkasan', subFiturs: [{ id: 'sub-3-1', title: 'Dashboard ringkasan', description: 'Chart bulanan', tasks: [] }] }
			]
		};
		// simpan fallback juga ke DB biar flow tetap jalan
		try {
			const [perRow] = await db.insert(perencanaan).values({ userId: userId ?? null, title: fallback.perencanaan.title, description: fallback.perencanaan.description, prompt: prompt.trim(), lang: lang ?? 'Bahasa Indonesia', techMode: techMode ?? null }).returning();
			for (let i = 0; i < fallback.fiturs.length; i++) {
				const f = fallback.fiturs[i];
				const [fRow] = await db.insert(fitur).values({ perencanaanId: perRow.id, title: f.title, description: f.description, orderIdx: i }).returning();
				for (let j = 0; j < f.subFiturs.length; j++) {
					const s = f.subFiturs[j];
					const [sRow] = await db.insert(subFitur).values({ fiturId: fRow.id, perencanaanId: perRow.id, title: s.title, description: s.description, orderIdx: j }).returning();
					for (const t of s.tasks ?? []) await db.insert(kanbanTask).values({ subFiturId: sRow.id, fiturId: fRow.id, perencanaanId: perRow.id, title: t.title, description: t.description, priority: t.priority, estimate: t.estimate, status: 'todo' });
				}
			}
			return json({ plan: fallback, dbId: (await db.select().from(perencanaan).orderBy(perencanaan.createdAt).limit(1).then(r=>r[0]))?.id, fallback: true, error: String(e).slice(0, 300) }, { status: 200 });
		} catch {}
		return json({ plan: fallback, fallback: true, error: String(e).slice(0, 300) }, { status: 200 });
	}
};


