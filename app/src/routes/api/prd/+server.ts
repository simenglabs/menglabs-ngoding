import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const SYSTEM_PROMPT = `Kamu adalah PRD builder expert. Ubah ide user menjadi PRD terstruktur yang bisa dipahami AI tools (Cursor, Claude Code, Opencode) dan developer.

Output format markdown, bahasa sesuai permintaan user:
# PRD: [Judul]
## 1. Ringkasan & Tujuan
## 2. User & Use Cases
## 3. Fitur Utama (Prioritas MoSCoW)
## 4. User Flow / Journey
## 5. Data Model & Entities
## 6. Tech Stack Saran
## 7. Acceptance Criteria
## 8. Roadmap MVP (minggu 1-4)
## 9. Risiko & Mitigasi
Jaga ringkas, konkret, actionable. Tambah contoh API/table jika relevan.`;

export const POST: RequestHandler = async ({ request }) => {
	const { prompt, lang, referensi, techMode, techStack, questions, answers } = await request.json();

	if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
		return json({ message: 'prompt required' }, { status: 400 });
	}

	const baseUrl = env.LLM_BASE_URL ?? 'https://omni.menglabs.id/v1';
	const apiKey = env.LLM_API_KEY;
	const model = env.LLM_MODEL ?? 'antigravity/claude-opus-4-6-thinking';

	if (!apiKey) return json({ message: 'LLM_API_KEY not set' }, { status: 500 });

	const langInstruction = lang === 'English' ? 'Gunakan Bahasa Inggris.' : lang === '日本語' ? 'Gunakan Bahasa Jepang.' : 'Gunakan Bahasa Indonesia.';

	let techInstruction = '';
	if (techMode === 'manual' && techStack) {
		const parts = Object.entries(techStack as Record<string, string>)
			.filter(([, v]) => v)
			.map(([k, v]) => `${k}: ${v}`)
			.join(', ');
		techInstruction = parts
			? `User sudah pilih tech stack manual — WAJIB pakai ini, jangan rekomendasikan alternatif: ${parts}. Tulis di section Tech Stack sesuai pilihan ini.`
			: 'User pilih manual tapi belum tentukan detail — beri placeholder dan tanyakan konfirmasi.';
	} else if (techMode === 'ai') {
		techInstruction = 'User biarkan AI pilih — berikan rekomendasi stack paling cocok (jelaskan alasan pilih per layer: frontend, backend, DB, deploy).';
	}

	let qaInstruction = '';
	if (Array.isArray(questions) && answers && typeof answers === 'object') {
		const qMap = new Map((questions as { id: number; text: string }[]).map((q) => [q.id, q.text]));
		const lines = Object.entries(answers as Record<string, string | string[]>)
			.map(([id, ans]) => {
				const qText = qMap.get(Number(id)) ?? `Q${id}`;
				const aText = Array.isArray(ans) ? ans.join(', ') : String(ans);
				if (!aText.trim()) return null;
				return `Q: ${qText}\nA: ${aText}`;
			})
			.filter(Boolean)
			.join('\n\n');
		if (lines) qaInstruction = `Jawaban klarifikasi user (gunakan untuk mempertajam PRD):\n${lines}`;
	}

	const userContent = `${langInstruction} ${referensi ? 'Pertimbangkan referensi yang dilampirkan.' : ''} ${techInstruction} ${qaInstruction}\n\nIde user:\n"""${prompt.trim()}"""`;

	try {
		const resp = await fetch(`${baseUrl}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model,
				stream: false,
				max_tokens: 4000,
				temperature: 0.7,
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					{ role: 'user', content: userContent }
				]
			})
		});

		if (!resp.ok) {
			const err = await resp.text();
			console.error('LLM error', resp.status, err);
			return json({ message: `LLM error ${resp.status}`, detail: err.slice(0, 1000) }, { status: 502 });
		}

		const data = await resp.json();
		const content: string = data.choices?.[0]?.message?.content ?? '';

		const prd = {
			id: crypto.randomUUID(),
			prompt: prompt.trim(),
			lang: lang ?? 'Bahasa Indonesia',
			referensi: referensi ?? false,
			techMode: techMode ?? null,
			techStack: techStack ?? null,
			questions: questions ?? null,
			answers: answers ?? null,
			model,
			createdAt: new Date().toISOString(),
			content,
			summary: content.slice(0, 180) + '...',
			usage: data.usage
		};

		return json(prd, { status: 201 });
	} catch (e) {
		console.error(e);
		return json({ message: 'LLM request failed', detail: String(e) }, { status: 500 });
	}
};

export const GET: RequestHandler = async () => {
	return json([
		{ id: '1', title: 'Aplikasi tracking pengeluaran harian', date: '2026-09-06' },
		{ id: '2', title: 'Dashboard rental kendaraan', date: '2026-09-05' }
	]);
};
