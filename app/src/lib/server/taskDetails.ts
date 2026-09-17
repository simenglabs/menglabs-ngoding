import type { GeneratedTaskInput } from './taskScaffold';

export const TASK_DETAIL_CONTRACT = `Setiap task harus berupa brief implementasi yang bisa dikerjakan agent tanpa menebak kebutuhan. Target 350-650 kata per task; gunakan detail spesifik proyek, bukan pengulangan agar panjang.
Format task: {"title":"...","priority":"high|medium|low","estimate":"4h|1d|2d","details":{"goal":"...","context":"...","scope":["..."],"dependencies":["..."],"implementation":["..."],"acceptanceCriteria":["..."],"verification":["..."],"deliverables":["..."]}}.
Isi wajib:
- goal: hasil yang dapat diamati pengguna atau developer setelah task selesai.
- context: hubungan dengan ide, jawaban klarifikasi, fitur induk, dan teknologi yang dipilih.
- scope: minimal 2 batas pekerjaan; jelaskan yang termasuk dan yang tidak termasuk.
- dependencies: minimal 1 prasyarat, kontrak dari task lain, atau asumsi yang perlu dikonfirmasi. Jangan mengaku mengetahui isi repository yang belum diperiksa.
- implementation: minimal 5 langkah berurutan dan konkret. Sebut tanggung jawab modul/file (path berupa usulan jika repo belum diketahui), aliran data, validasi input, penanganan error, dan keadaan kosong/loading jika relevan. Task FE menjelaskan komponen/interaksi; task BE menjelaskan kontrak request/response, aturan akses, dan perubahan data jika relevan. Jangan memaksakan API/database pada task yang tidak memerlukannya.
- acceptanceCriteria: minimal 4 kondisi terukur dengan input/aksi dan hasil yang diharapkan; jangan sekadar 'berfungsi baik'.
- verification: minimal 3 skenario beserta hasil yang diharapkan, mencakup alur berhasil, input gagal/batas, dan regresi terkait. Perintah tes hanya jika diketahui dari stack; jika belum, periksa script repo dan tuliskan command yang benar saat implementasi.
- deliverables: minimal 2 hasil konkret: kode/modul, konfigurasi/migrasi bila diperlukan, tes, atau petunjuk menjalankan.
Bahasa isi mengikuti bahasa pengguna. Field JSON tetap sesuai format. Tidak boleh mengganti details dengan description satu kalimat. Jangan mengarang kredensial, endpoint eksternal, atau fitur di luar kebutuhan.`;

const sections = [
	['scope', 'Ruang lingkup', 2],
	['dependencies', 'Prasyarat dan asumsi', 1],
	['implementation', 'Langkah implementasi', 5],
	['acceptanceCriteria', 'Kriteria selesai', 4],
	['verification', 'Cara menguji', 3],
	['deliverables', 'Hasil yang diserahkan', 2]
] as const;

function text(value: unknown, field: string, min: number, max: number): string {
	if (typeof value !== 'string' || value.trim().length < min || value.length > max)
		throw new Error(`Detail tugas belum lengkap pada ${field}. Coba buat ulang.`);
	return value.trim();
}

/** Persist the full brief in the existing description field for API/CLI compatibility. */
export function parseDetailedTask(raw: unknown): GeneratedTaskInput {
	if (!raw || typeof raw !== 'object') throw new Error('Format tugas tidak valid.');
	const task = raw as Record<string, unknown>;
	if (!task.details || typeof task.details !== 'object' || Array.isArray(task.details))
		throw new Error('Tugas terlalu singkat. Brief implementasi belum tersedia. Coba buat ulang.');
	const details = task.details as Record<string, unknown>;
	const paragraphs = [
		`Tujuan\n${text(details.goal, 'tujuan', 40, 2000)}`,
		`Konteks\n${text(details.context, 'konteks', 40, 3000)}`
	];
	for (const [key, label, minimum] of sections) {
		const values = details[key];
		if (!Array.isArray(values) || values.length < minimum || values.length > 16)
			throw new Error(`Detail tugas membutuhkan minimal ${minimum} poin ${label.toLowerCase()}.`);
		const lines = values.map((value) => text(value, label, 20, 1600));
		if (new Set(lines).size !== lines.length)
			throw new Error(`Poin ${label} tidak boleh berulang.`);
		paragraphs.push(`${label}\n${lines.map((line, i) => `${i + 1}. ${line}`).join('\n')}`);
	}
	const description = paragraphs.join('\n\n');
	if (description.length < 1400 || description.length > 18000)
		throw new Error('Brief tugas harus berisi detail yang cukup (1.400–18.000 karakter).');
	return {
		title: text(task.title, 'judul', 4, 300),
		description,
		priority: task.priority === 'high' || task.priority === 'low' ? task.priority : 'medium',
		estimate: text(task.estimate ?? '1d', 'estimasi', 1, 20)
	};
}
