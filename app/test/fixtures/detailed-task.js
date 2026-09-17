export function detailedTask() {
	return {
		title: 'Jalankan agent lokal dengan konteks tugas lengkap',
		priority: 'high',
		estimate: '1d',
		details: {
			goal: 'Agent lokal menerima seluruh instruksi proyek dan menyimpan hasil eksekusi yang dapat diperiksa oleh pengguna.',
			context:
				'Bagian CLI worker pada platform agent lokal, menggunakan frontend Svelte, backend Node, dan database SQLite sesuai pilihan pengguna.',
			scope: [
				'Hubungkan proses worker ke endpoint tugas dan pertahankan seluruh isi deskripsi pada konteks eksekusi tanpa memotong instruksi.',
				'Batasi perubahan pada worker serta pelaporan hasil. Pengelolaan akun dan tampilan daftar proyek tidak termasuk pekerjaan ini.'
			],
			dependencies: [
				'Kerangka frontend dan backend sudah dapat dijalankan, API claim tugas tersedia, dan token akses dibatasi ke proyek milik pengguna.'
			],
			implementation: [
				'Periksa modul konfigurasi dan worker yang tersedia untuk menemukan cara membaca URL platform serta kredensial proyek yang benar.',
				'Ambil satu tugas menggunakan kontrak claim yang tersedia, lalu pastikan ID tugas, deskripsi, dan konteks rencana dapat dibaca worker.',
				'Kirim deskripsi lengkap sebagai bagian konteks agent lokal, termasuk langkah implementasi, kriteria selesai, dan skenario pengujiannya.',
				'Tangani proses gagal atau terputus dengan hasil yang menjelaskan exit code; jangan melaporkan tugas selesai jika eksekusi tidak berhasil.',
				'Simpan hasil eksekusi dan verifikasi secara terpisah, lalu perbarui status tugas menggunakan claim token yang masih berlaku.'
			],
			acceptanceCriteria: [
				'Ketika tugas berhasil diambil, seluruh bagian deskripsi diterima oleh agent tanpa pemotongan teks atau perubahan urutan instruksi.',
				'Ketika proses agent berhasil dan verifikasi lulus, status tugas menjadi selesai dan hasil pemeriksaan dapat diambil kembali dari API.',
				'Ketika proses agent keluar dengan status gagal, worker berhenti dan tidak menyatakan hasil pekerjaan tersebut sudah terverifikasi.',
				'Ketika token claim sudah kedaluwarsa, pembaruan status ditolak dan worker menampilkan pesan kegagalan yang dapat ditindaklanjuti.'
			],
			verification: [
				'Gunakan agent lokal pengujian untuk menyimpan konteks ke file; cocokkan deskripsi hasil penyimpanan dengan deskripsi dari endpoint tugas.',
				'Jalankan agent yang sengaja gagal, lalu pastikan status tugas tidak berubah menjadi selesai dan exit code gagal tercatat pada hasil.',
				'Jalankan pemeriksaan dengan token claim yang sudah digantikan worker lain; pastikan server menolak perubahan tanpa menimpa hasil baru.'
			],
			deliverables: [
				'Perubahan worker dan kontrak pelaporan hasil yang mempertahankan deskripsi tugas secara utuh sampai diterima agent lokal.',
				'Tes alur berhasil, eksekusi gagal, dan claim kedaluwarsa beserta petunjuk command untuk menjalankan pengujian dari repository.'
			]
		}
	};
}
