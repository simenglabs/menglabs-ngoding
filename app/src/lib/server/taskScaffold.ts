import { parseDetailedTask } from './taskDetails';

export type GeneratedTaskInput = {
	title: string;
	description: string;
	priority: 'high' | 'medium' | 'low';
	estimate: string;
};

export const SCAFFOLD_TASK_TITLE = 'WAJIB: Buat kerangka frontend dan backend';

export function scaffoldTask(techStack: unknown): GeneratedTaskInput {
	const stack =
		techStack && typeof techStack === 'object' ? (techStack as Record<string, unknown>) : {};
	const frontend =
		typeof stack.frontend === 'string' && stack.frontend.trim() ? stack.frontend : 'sesuai PRD';
	const backend =
		typeof stack.backend === 'string' && stack.backend.trim() ? stack.backend : 'sesuai PRD';
	return parseDetailedTask({
		title: SCAFFOLD_TASK_TITLE,
		priority: 'high',
		estimate: '1d',
		details: {
			goal: `Menyediakan fondasi aplikasi yang dapat dijalankan lokal: frontend (${frontend}) terhubung ke backend (${backend}), dengan konfigurasi yang terdokumentasi sebelum fitur bisnis dikerjakan.`,
			context:
				'Ini adalah tugas pertama proyek. Baca PRD dan rencana terlebih dahulu untuk menentukan struktur frontend, backend, penyimpanan, dan cara menjalankan sesuai teknologi yang dipilih. Jika repository sudah ada, gunakan struktur dan konvensinya.',
			scope: [
				'Siapkan struktur folder, entry point, dependensi minimum, konfigurasi development, dan koneksi frontend ke backend. Frontend dan backend boleh berada dalam satu framework jika stack yang dipilih mendukungnya.',
				'Batasi pekerjaan pada fondasi dan satu alur pemeriksaan koneksi. Jangan membuat login, dashboard bisnis, atau fitur tambahan kecuali diperlukan secara eksplisit untuk menjalankan fondasi.'
			],
			dependencies: [
				'Periksa README, manifest dependensi, konfigurasi, dan instruksi repository yang sudah tersedia. Tentukan package manager dan versi runtime berdasarkan repository atau dokumentasi stack.',
				'Jika pilihan teknologi masih kosong, pilih berdasarkan PRD, catat alasan dan asumsi di README sebelum membuat struktur. Jangan mengganti stack yang telah dipilih pengguna.'
			],
			implementation: [
				'Petakan tanggung jawab frontend, backend, dan penyimpanan. Buat atau lengkapi struktur yang sesuai framework; gunakan path sebagai hasil pemeriksaan repository, bukan asumsi bahwa folder tertentu sudah ada.',
				'Inisialisasi entry point frontend dengan satu halaman awal dan navigasi dasar yang dibutuhkan untuk pemeriksaan. Sediakan keadaan memuat, berhasil, serta pesan saat backend tidak dapat dihubungi.',
				'Siapkan entry point backend dan endpoint pemeriksaan sederhana, misalnya GET /api/health bila belum ada konvensi lain. Tetapkan response JSON, status HTTP sukses, dan respons error tanpa mengungkap nilai konfigurasi rahasia.',
				'Hubungkan halaman awal ke endpoint backend. Gunakan URL relatif jika satu origin; bila server terpisah, konfigurasikan base URL dan origin development secara eksplisit. Tampilkan hasil koneksi yang berasal dari response nyata.',
				'Tambahkan contoh environment tanpa rahasia, dokumentasikan setiap variabel yang wajib/opsional, pisahkan konfigurasi server dari yang boleh tersedia di browser, dan cegah file rahasia ikut masuk version control.',
				'Jika PRD membutuhkan database, siapkan konfigurasi koneksi dan titik masuk migrasi sesuai stack. Jelaskan cara menyiapkan database lokal; jangan membuat skema bisnis yang belum ditentukan oleh rencana.',
				'Sediakan script atau perintah untuk install, menjalankan frontend/backend, build, dan pemeriksaan yang tersedia. Catat port, urutan menjalankan, dan cara menghentikan proses di README.'
			],
			acceptanceCriteria: [
				'Dari checkout bersih, dependency dapat dipasang mengikuti README dan contoh environment cukup untuk menjalankan fondasi dengan konfigurasi lokal yang dijelaskan.',
				'Frontend dapat dibuka pada alamat yang didokumentasikan dan menampilkan keadaan berhasil setelah mendapatkan response valid dari backend.',
				'Ketika backend dihentikan atau response gagal, frontend menampilkan pesan yang dapat dipahami dan tidak terjebak dalam indikator loading tanpa akhir.',
				'Build dan pemeriksaan yang relevan pada stack selesai tanpa error. Nilai rahasia server tidak muncul pada bundle browser atau file contoh konfigurasi.'
			],
			verification: [
				'Jalankan langkah instalasi dan development dari README. Buka frontend dan periksa request jaringan ke endpoint backend; hasil yang diharapkan adalah response sukses dan indikator koneksi berhasil.',
				'Hentikan backend atau simulasikan respons gagal. Muat ulang frontend dan pastikan pesan kegagalan muncul; setelah backend aktif kembali, ulangi pemeriksaan hingga koneksi berhasil.',
				'Jalankan build serta lint, typecheck, atau tes yang memang tersedia pada stack. Catat command yang benar, exit code, dan hasil aktual, termasuk keterbatasan lingkungan jika ada.',
				'Periksa perubahan version control dan konfigurasi browser untuk memastikan tidak ada secret atau file environment lokal yang ikut disertakan.'
			],
			deliverables: [
				'Struktur frontend/backend dan kode koneksi awal yang dapat dijalankan, beserta manifest dependency dan lockfile sesuai package manager proyek.',
				'Contoh environment dan README berisi setup, perintah development/build/pemeriksaan, alamat lokal, serta asumsi teknologi yang digunakan.',
				'Bukti hasil pemeriksaan koneksi berhasil/gagal dan build, dengan daftar file yang diubah serta pekerjaan lanjutan yang masih diperlukan.'
			]
		}
	});
}

export function prependScaffold(
	tasks: GeneratedTaskInput[],
	techStack: unknown
): GeneratedTaskInput[] {
	return [
		scaffoldTask(techStack),
		...tasks.filter((task) => task.title !== SCAFFOLD_TASK_TITLE)
	].slice(0, 8);
}
