# Revamp UI dan UX

Tujuan: pengguna baru bisa membuat rencana, memahami tugas, dan menjalankan agent tanpa perlu mengenal struktur database atau API platform.

## Temuan dan perbaikan

| Halaman / area | Hambatan sebelumnya | Perubahan |
| --- | --- | --- |
| Navigasi | Menu berbeda antarhalaman dan tautan proyek kehilangan konteks | Header bersama, menu proyek mempertahankan ID, penanda halaman aktif, tautan lewati navigasi |
| Beranda | Jargon teknologi, banyak tujuan navigasi, alur sulit dipahami | Satu ajakan memulai, tiga langkah penggunaan, persiapan dalam bagian yang bisa dibuka |
| Proyek saya | Detail database, statistik kurang berguna, kegagalan API bisa terlihat seperti daftar kosong | Pencarian proyek, dua tindakan per kartu, kondisi memuat/kosong/gagal terpisah, tombol coba lagi |
| Buat proyek | Tombol lanjut hanya ikon, kontrol referensi belum tersedia, ide hilang saat kembali | Form berlabel, contoh ide, tombol dengan tujuan jelas, ide dipulihkan saat kembali, kontrol bahasa sekunder |
| Preferensi | Pengguna wajib memilih teknologi tanpa arahan | Pilihan AI menjadi default, pilihan manual dijelaskan, tombol kembali, label bidang teknologi dan status pilihan |
| Pertanyaan | Instruksi wajib menjawab bertentangan dengan tombol lewati | Jawaban boleh kosong, label aksesibel, status pilihan, teks custom yang belum ditambahkan disimpan saat lanjut |
| Rencana | Diagram lebar dan panel tetap menjadi tampilan awal | Daftar fitur sebagai default, instruksi tugas dapat diperluas, diagram tersedia sebagai opsi lanjutan |
| Papan tugas | Banyak tombol setara, istilah teknis, deskripsi terpotong, kolom kosong panjang di ponsel | Status bahasa Indonesia, toolbar ringkas, instruksi lengkap dalam kartu, tinggi kolom responsif, tugas siap dikerjakan ditampilkan dahulu |
| Jalankan di komputer | Tidak ada pemilih proyek, terlalu banyak perintah sekaligus, salin mengaku berhasil tanpa menunggu clipboard | Pilih proyek → buat/salin perintah → jalankan, persiapan terminal, akses lanjutan terpisah, penanganan gagal membuat/mencabut/menyalin |
| Daftar detail | Mengulang daftar proyek sambil menampilkan schema internal | Memakai kembali halaman Proyek saya |
| Detail proyek | Istilah database, judul tugas terpotong, pemuatan bisa macet | Bahasa pengguna, judul terbaca, status berlabel, penanganan gagal dan coba lagi |
| Dokumen kebutuhan | Judul masih “Generating” setelah selesai, metadata model memenuhi layar | Judul mengikuti hasil, metadata internal dihilangkan, status salin dan kegagalan koneksi ditangani |
| Masuk / daftar | Placeholder menggantikan label, minimum kata sandi salah, tujuan awal hilang saat daftar | Label tetap, autocomplete, minimum 8 karakter, tujuan setelah autentikasi dipertahankan |
| Visual umum | Teks 9–11 px, kontras rendah, pola latar mengganggu, fokus kurang terlihat | Ukuran teks minimum ditingkatkan, warna teks diperjelas, latar lebih tenang, fokus keyboard dan reduced-motion |

## Batas perubahan

- Fitur backend, kontrak API, dan data proyek dipertahankan.
- Istilah teknis tetap ditampilkan ketika pengguna memilih teknologi atau membuka opsi agent lanjutan.
- Bagian diagram tetap tersedia. Pengguna tidak perlu mengatur diagram untuk menjalankan tugas.
- Tidak ada klaim bahwa kode hasil agent selalu berhasil; halaman menjelaskan apa yang dilakukan saat tugas gagal.

## Pemeriksaan

- Svelte check: tanpa error atau warning.
- Prettier dan ESLint: lulus.
- Browser Chrome: alur daftar, kembali/lanjut wizard, pilihan AI, rencana daftar/diagram, ubah status tugas, pencarian, pulih dari polling gagal, pemilih proyek dan pembuatan perintah.
- Pemeriksaan 13 route pada lebar 390 dan 1440 piksel: satu judul utama, tanpa overflow horizontal halaman atau error JavaScript. Menu proyek dapat digeser pada ponsel.
- Pengujian browser menggunakan akun di database lokal terpisah dan fixture API untuk rencana/tugas/akses. Ini menguji perilaku UI, bukan kualitas hasil LLM atau koneksi agent produksi.
- E2E backend dan agent lokal: lulus dengan CLI dari commit `2acf0b7` dalam salinan sementara. Perubahan CLI lain di working tree tidak diubah atau disertakan dalam revamp ini.
- Pemeriksaan teks memakai aturan `no-ai-slop`: istilah internal dihapus dari alur utama, instruksi menyebut tindakan yang perlu dilakukan, tanpa janji hasil yang tidak dapat dibuktikan.

## Detail tugas yang dihasilkan

Generator rencana dan generator tugas per bagian fitur menggunakan kontrak brief yang sama. Setiap tugas berisi tujuan, konteks, ruang lingkup, prasyarat/asumsi, langkah implementasi, kriteria selesai, cara menguji, dan hasil yang diserahkan.

- Target prompt 350–650 kata per tugas, dengan detail yang sesuai proyek.
- Server mensyaratkan minimal 5 langkah implementasi, 4 kriteria selesai, 3 skenario pengujian, 2 hasil, serta konteks dan batas pekerjaan. Brief akhir harus berukuran 1.400–18.000 karakter. Ini memeriksa kelengkapan struktur, bukan menjamin kebenaran teknis hasil LLM.
- Batas output menjadi 12.000 token per permintaan. Pembuatan tugas dapat membutuhkan waktu dan penggunaan token lebih banyak.
- Tugas per fitur memakai ide asli, teknologi, pertanyaan/jawaban, PRD terbaru bila tersedia (maksimal 30.000 karakter), dan hingga 80 judul tugas yang sudah ada untuk konteks.
- Seluruh brief tetap disimpan pada `description`; tidak ada migrasi database atau perubahan kontrak CLI.
- Tugas lama tidak ditulis ulang dan status pekerjaan tidak direset. Aturan berlaku pada tugas baru yang dihasilkan.
- Tes membuktikan brief pendek ditolak sebelum proyek tersimpan, instruksi lebih dari 2.000 karakter tersimpan dan sampai ke agent, serta permintaan ulang pada fitur yang sama tidak menggandakan tugas.
