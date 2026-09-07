import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { perencanaan, fitur, subFitur, kanbanTask } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const SYSTEM = `Kamu generate TASK breakdown untuk 1 Sub Fitur.
Output JSON valid saja: {"tasks":[{"id":"task-1","title":"string","description":"string 1 kalimat","priority":"high|medium|low","estimate":"4h|1d|2d"}]}
Buat 4-6 tasks yang actionable, berurutan, cover FE/BE/QA. Bahasa sesuai permintaan.`;

export const POST: RequestHandler = async ({ request }) => {
	const { subFiturTitle, subFiturDesc, fiturTitle, perencanaanTitle, lang, perencanaanId, fiturId, subFiturId } = await request.json();
	if (!subFiturTitle) return json({ message: 'subFiturTitle required' }, { status: 400 });

	const baseUrl = env.LLM_BASE_URL ?? 'https://omni.menglabs.id/v1';
	const apiKey = env.LLM_API_KEY;
	const model = env.LLM_MODEL ?? 'antigravity/claude-opus-4-6-thinking';
	if (!apiKey) return json({ message: 'LLM_API_KEY not set' }, { status: 500 });

	const langInstruct = lang === 'English' ? 'Bahasa Inggris.' : lang === '日本語' ? 'Bahasa Jepang.' : 'Bahasa Indonesia.';
	const userContent = `${langInstruct}\nPerencanaan: ${perencanaanTitle ?? ''}\nFitur: ${fiturTitle ?? ''}\nSub Fitur: ${subFiturTitle} - ${subFiturDesc ?? ''}\nBuat tasks.`;

	try {
		const resp = await fetch(`${baseUrl}/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
			body: JSON.stringify({
				model,
				stream: false,
				max_tokens: 1200,
				temperature: 0.6,
				messages: [
					{ role: 'system', content: SYSTEM },
					{ role: 'user', content: userContent }
				]
			})
		});
		if (!resp.ok) {
			const err = await resp.text();
			return json({ message: `LLM error ${resp.status}`, detail: err.slice(0, 800) }, { status: 502 });
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
			else throw new Error(content.slice(0, 500));
		}
		const tasks = (parsed as Record<string, unknown>).tasks as Array<{ title: string; description: string; priority: string; estimate: string }>;

		// === Persist langsung ke DB (kanban_task) jika ada id referensi ===
		let persisted: typeof tasks | null = null;
		// coba resolve ids via perencanaanId/fiturId/subFiturId atau fallback cari by title
		let perId = perencanaanId as string | undefined;
		let fId = fiturId as string | undefined;
		let sId = subFiturId as string | undefined;

		if (!perId && perencanaanTitle) {
			const r = await db.select().from(perencanaan).where(eq(perencanaan.title, perencanaanTitle)).limit(1);
			perId = r[0]?.id;
		}
		if (!fId && fiturTitle && perId) {
			const r = await db.select().from(fitur).where(and(eq(fitur.perencanaanId, perId), eq(fitur.title, fiturTitle))).limit(1);
			fId = r[0]?.id;
		}
		if (!sId && subFiturTitle && fId) {
			const r = await db.select().from(subFitur).where(and(eq(subFitur.fiturId, fId), eq(subFitur.title, subFiturTitle))).limit(1);
			sId = r[0]?.id;
		}
		// jika masih belum ketemu, fallback cari subFitur by title saja (terbaru)
		if (!sId) {
			const r = await db.select().from(subFitur).where(eq(subFitur.title, subFiturTitle)).limit(1);
			sId = r[0]?.id;
			if (sId) {
				const sr = await db.select().from(subFitur).where(eq(subFitur.id, sId)).limit(1);
				fId = sr[0]?.fiturId;
				perId = sr[0]?.perencanaanId;
			}
		}

		if (perId && fId && sId) {
			for (const t of tasks) {
				await db.insert(kanbanTask).values({
					subFiturId: sId,
					fiturId: fId,
					perencanaanId: perId,
					title: t.title,
					description: t.description,
					priority: t.priority ?? 'medium',
					estimate: t.estimate ?? '1d',
					status: 'todo'
				});
			}
			const rows = await db.select().from(kanbanTask).where(eq(kanbanTask.subFiturId, sId));
			persisted = rows.map((r) => ({ id: r.id, title: r.title, description: r.description, priority: r.priority, estimate: r.estimate, status: r.status }));
		}

		return json({ tasks: persisted ?? tasks, usage: data.usage, dbPersisted: !!persisted }, { status: 200 });
	} catch (e) {
		console.error(e);
		const fallback = [
			{ id: 'task-1', title: 'Desain UI sub fitur', description: 'Mockup dan komponen', priority: 'high', estimate: '1d' },
			{ id: 'task-2', title: 'Implement FE', description: 'Svelte + API', priority: 'high', estimate: '1d' },
			{ id: 'task-3', title: 'Implement BE', description: 'Endpoint + DB', priority: 'high', estimate: '1d' },
			{ id: 'task-4', title: 'Test & QA', description: 'Unit + manual', priority: 'medium', estimate: '4h' }
		];
		// fallback juga persist jika ada ids
		try {
			let perId2 = perencanaanId as string | undefined;
			let fId2 = fiturId as string | undefined;
			let sId2 = subFiturId as string | undefined;
			if (!sId2 && subFiturTitle) {
				const r = await db.select().from(subFitur).where(eq(subFitur.title, subFiturTitle)).limit(1);
				sId2 = r[0]?.id;
				if (sId2) {
					const sr = await db.select().from(subFitur).where(eq(subFitur.id, sId2)).limit(1);
					fId2 = sr[0]?.fiturId;
					perId2 = sr[0]?.perencanaanId;
				}
			}
			if (perId2 && fId2 && sId2) {
				for (const t of fallback) await db.insert(kanbanTask).values({ subFiturId: sId2, fiturId: fId2, perencanaanId: perId2, title: t.title, description: t.description, priority: t.priority, estimate: t.estimate, status: 'todo' });
			}
		} catch {}
		return json({ tasks: fallback, fallback: true }, { status: 200 });
	}
};
