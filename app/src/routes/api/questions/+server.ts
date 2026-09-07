import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const SYSTEM = `Kamu adalah PRD clarifier. Analisa ide aplikasi user dan hasilkan 5 pertanyaan untuk bikin PRD lebih akurat.

Aturan:
- Output HARUS JSON valid saja, tanpa markdown, tanpa penjelasan lain.
- Format: array 5 objek: {"id":number,"text":string,"type":"text"|"single"|"multi","options":string[],"placeholder":string}
- type "text" = jawaban bebas (textarea), tanpa options, placeholder "Ketik jawaban..."
- type "single" atau "multi" = pilihan ganda, beri 4-6 options pendek (2-4 kata), relevan dengan ide user. Tambahkan opsi custom via allowCustom true.
- Pertanyaan 1 selalu type "text": tentang konteks user sekarang (pain point).
- Pertanyaan 2-5 idealnya "single"/"multi" agar cepat klik.
- Bahasa sesuai permintaan user (default Bahasa Indonesia).
- Pertanyaan harus spesifik terhadap ide user, jangan generik template.

Contoh output:
[{"id":1,"text":"Ceritakan seseorang yang butuh aplikasi ini. Sekarang mereka ngapain buat ngatur kerjaan atau proyeknya?","type":"text","placeholder":"Ketik jawaban..."},{"id":2,"text":"Buat pengguna yang baru pertama kali buka aplikasi ini, kemenangan paling gampang yang harus mereka rasain itu apa?","type":"single","options":["Bikin daftar tugas pertama","Kelarin satu tugas kecil","Coba lihat contoh proyek","Bikin proyek baru","Daftar akun"]}]`;

export const POST: RequestHandler = async ({ request }) => {
	const { prompt, lang, techMode, techStack } = await request.json();
	if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
		return json({ message: 'prompt required' }, { status: 400 });
	}

	const baseUrl = env.LLM_BASE_URL ?? 'https://omni.menglabs.id/v1';
	const apiKey = env.LLM_API_KEY;
	const model = env.LLM_MODEL ?? 'antigravity/claude-opus-4-6-thinking';
	if (!apiKey) return json({ message: 'LLM_API_KEY not set' }, { status: 500 });

	const langInstruct = lang === 'English' ? 'Gunakan Bahasa Inggris.' : lang === '日本語' ? 'Gunakan Bahasa Jepang.' : 'Gunakan Bahasa Indonesia.';
	const techInfo =
		techMode === 'manual' && techStack
			? `Tech stack pilihan user: ${Object.entries(techStack).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ')}`
			: techMode === 'ai'
				? 'Tech stack biarkan AI pilih.'
				: '';

	const userContent = `${langInstruct} ${techInfo}\n\nIde user: """${prompt.trim()}"""\n\nBuat 5 pertanyaan klarifikasi sebagai JSON array sesuai format.`;

	try {
		const resp = await fetch(`${baseUrl}/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
			body: JSON.stringify({
				model,
				stream: false,
				max_tokens: 2000,
				temperature: 0.6,
				messages: [
					{ role: 'system', content: SYSTEM },
					{ role: 'user', content: userContent }
				]
			})
		});

		if (!resp.ok) {
			const err = await resp.text();
			console.error('LLM questions error', resp.status, err);
			return json({ message: `LLM error ${resp.status}`, detail: err.slice(0, 1000) }, { status: 502 });
		}

		const data = await resp.json();
		let content: string = data.choices?.[0]?.message?.content ?? '';

		// bersihkan markdown fence jika LLM bandel
		content = content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

		// coba parse
		let questions: unknown;
		try {
			questions = JSON.parse(content);
		} catch {
			// fallback: extract array via regex
			const m = content.match(/\[[\s\S]*\]/);
			if (m) questions = JSON.parse(m[0]);
			else throw new Error('JSON parse failed: ' + content.slice(0, 500));
		}

		// validasi + normalisasi ringan
		const arr = Array.isArray(questions) ? (questions as Record<string, unknown>[]).slice(0, 5) : [];
		const normalized = arr.map((q, i) => ({
			id: Number(q.id ?? i + 1),
			text: String(q.text ?? '').trim() || `Pertanyaan ${i + 1}`,
			type: (q.type === 'text' ? 'text' : q.type === 'multi' ? 'multi' : 'single') as 'text' | 'single' | 'multi',
			options: Array.isArray(q.options) ? (q.options as string[]).slice(0, 6) : undefined,
			placeholder: typeof q.placeholder === 'string' ? q.placeholder : 'Ketik jawaban...',
			allowCustom: true
		}));

		if (normalized.length === 0) throw new Error('empty questions');

		return json({ questions: normalized, usage: data.usage }, { status: 200 });
	} catch (e) {
		console.error(e);
		// fallback templated questions agar flow tidak blok
		const fallback = [
			{ id: 1, text: 'Ceritakan seseorang yang butuh aplikasi ini. Sekarang mereka ngapain buat ngatur kerjaan atau proyeknya?', type: 'text', placeholder: 'Ketik jawaban...' },
			{ id: 2, text: 'Buat pengguna yang baru pertama kali buka aplikasi ini, kemenangan paling gampang yang harus mereka rasain itu apa?', type: 'single', options: ['Bikin daftar tugas pertama', 'Kelarin satu tugas kecil', 'Coba lihat contoh proyek', 'Bikin proyek baru', 'Daftar akun'] },
			{ id: 3, text: 'Pilih 3 fitur yang paling wajib ada biar aplikasi ini berguna buat mereka.', type: 'multi', options: ['Catat tugas', 'Beri tenggat waktu', 'Bagi tugas ke teman', 'Lihat kemajuan proyek', 'Kirim pengingat'] },
			{ id: 4, text: 'Apa kelebihan utama aplikasi ini dibanding cara mereka ngatur proyek sekarang (misalnya pakai kertas atau catatan biasa)?', type: 'single', options: ['Lebih rapi', 'Lebih cepat', 'Lebih gampang dipakai', 'Bisa akses di mana aja', 'Tidak gampang hilang'] },
			{ id: 5, text: 'Hal apa yang bikin mereka betah balik lagi ke aplikasi ini, bukan cuma coba sekali doang?', type: 'multi', options: ['Lihat proyek selesai', 'Ada tugas baru tiap hari', 'Rasa puas nyelesain tugas', 'Catatan tersimpan rapi', 'Bisa pantau kerjaan tim'] }
		];
		return json({ questions: fallback, fallback: true, error: String(e).slice(0, 300) }, { status: 200 });
	}
};
