# Backlog perbaikan NgodingPakeAI

Tanggal: 17 September 2026
Status: seluruh item telah diimplementasikan di workspace; rollout database hosted dan deployment production belum dijalankan.

Dokumen ini mengubah hasil audit menjadi pekerjaan dan mencatat penyelesaiannya. Implementasi diverifikasi melalui lint, pemeriksaan Svelte, build Node, audit dependency, migration database kosong, upgrade schema legacy pada database sementara, test CLI, serta integrasi API dua pengguna dengan provider LLM tiruan. Database hosted dan provider LLM asli tidak disentuh.

## 1. Kondisi awal dan target

| Pemeriksaan | Baseline audit |
|---|---|
| Svelte check | 0 error, 3 warning aksesibilitas |
| Build | Berhasil; adapter-auto belum mendeteksi target production |
| Prettier | 27 file bermasalah |
| ESLint terpisah | 103 error |
| CLI help | Berhasil |
| Interpolasi konten task ke shell | Terbukti dapat mengeksekusi substitusi shell |
| CLI `--dry --once` | Terbukti berulang dan melakukan perubahan status |
| Automated test dan CI | Tidak ditemukan dalam repository yang diaudit |

Target pertama adalah alur pengguna yang aman dan konsisten: pengguna membuat proyek sendiri, memperoleh hasil AI tervalidasi, menyimpan satu hierarki utuh, membagikan akses terbatas kepada agent, dan melihat status pekerjaan yang benar.

Definisi prioritas:

- **P0:** penghalang akses publik; risiko akses data, eksekusi lokal, atau penggunaan API tanpa batas.
- **P1:** penghalang penggunaan untuk pekerjaan nyata; salah proyek, duplikasi, kehilangan konsistensi, atau status yang menyesatkan.
- **P2:** kualitas produk, performa, dan kesiapan operasional.

Kompleksitas S/M/L adalah perkiraan relatif cakupan, bukan janji durasi. Seluruh checkbox masih terbuka.

## 2. Ringkasan backlog

| ID | Prioritas | Pekerjaan | Kompleksitas | Dependensi utama |
|---|---|---|---|---|
| FIX-01 | P0 | Autentikasi dan otorisasi seluruh data proyek | L | FIX-20 untuk perubahan schema bila diperlukan |
| FIX-02 | P0 | Hapus interpolasi data task ke shell | M | — |
| FIX-03 | P0 | Token agent dengan batas akses dan pencabutan | L | FIX-01, FIX-20 |
| FIX-04 | P0 | Batasi pemakaian AI dan percobaan autentikasi | M | FIX-01 |
| FIX-05 | P1 | Validasi input API dan respons LLM | M | — |
| FIX-06 | P1 | Transaksi penyimpanan dan ID database konsisten | L | FIX-05 |
| FIX-07 | P1 | Hilangkan pencarian relasi berdasarkan judul | M | FIX-01, FIX-06 |
| FIX-08 | P1 | Pertahankan konteks proyek saat navigasi | M | FIX-06, FIX-07 |
| FIX-09 | P1 | Claim task atomik dan pemulihan worker | L | FIX-03, FIX-20 |
| FIX-10 | P1 | Perbaiki dry-run, once, dan siklus runner | M | FIX-02, FIX-09 |
| FIX-11 | P1 | Konteks agent lengkap dan kriteria selesai | M | FIX-06, FIX-09 |
| FIX-12 | P1 | Generation task idempoten | M | FIX-06, FIX-07 |
| FIX-13 | P1 | Status Kanban sesuai respons server | M | FIX-08 |
| FIX-14 | P1 | Sinkronisasi perubahan status dari agent | S | FIX-13 |
| FIX-15 | P1 | Pisahkan kegagalan AI, fallback, dan error database | M | FIX-05, FIX-06 |
| FIX-16 | P2 | Persistensi PRD dan riwayat nyata | M | FIX-01, FIX-06, FIX-20 |
| FIX-17 | P2 | Perjelas fitur referensi yang belum tersedia | S | — |
| FIX-18 | P2 | Aksesibilitas dan posisi canvas | M | FIX-08 |
| FIX-19 | P2 | Kurangi query berulang dan tambah indeks | M | FIX-20 |
| FIX-20 | P1 | Migration dan instalasi yang dapat direproduksi | M | — |
| FIX-21 | P1 | Test regresi, CI, dan perbaikan lint | L | Bertahap mengikuti setiap fix |
| FIX-22 | P2 | Deployment, health check, dan observabilitas | M | FIX-20, FIX-21 |
| FIX-23 | P2 | Perkuat autentikasi dan pengelolaan session | M | FIX-01, FIX-04, FIX-05 |
| FIX-24 | P2 | Selaraskan dokumentasi dan contoh agent | S | FIX-03, FIX-10, FIX-11 |

## 3. Detail pekerjaan

### FIX-01 — Tutup akses data lintas pengguna

- [x] Diimplementasikan

**Masalah:** daftar proyek tanpa session mengembalikan proyek seluruh pengguna. Detail, Kanban, mutasi task, serta todo tidak memiliki pemeriksaan pemilik yang konsisten. Hook hanya mengisi `locals.user`.

**Lokasi:** `app/src/hooks.server.ts`, `app/src/routes/api/perencanaan/`, `app/src/routes/api/kanban/`, `app/src/routes/api/plan/+server.ts`, `app/src/routes/api/tasks/+server.ts`, `app/src/routes/api/todos/`.

**Langkah:**
1. Buat helper `requireUser` dan pemeriksaan kepemilikan proyek/task di server; gunakan `locals.user`.
2. Lindungi list, detail, create, update, delete, dan generation. Jangan hanya melindungi halaman.
3. Batasi query berdasarkan pemilik. Return 401 untuk tanpa autentikasi; gunakan kebijakan 404/403 konsisten untuk resource milik orang lain.
4. Hilangkan data proyek privat dari landing publik; tampilkan contoh statis yang diberi label bila perlu.
5. Audit proyek lama dengan `userId = null`; jangan otomatis memberikan semuanya kepada pengguna pertama. Karantina dari daftar biasa sampai pemilik ditentukan.
6. Tentukan apakah API todo masih dibutuhkan. Tutup rute yang tidak dipakai; jika dipakai, tambahkan ownership sebelum membukanya.

**Kriteria selesai:** pengguna A tidak dapat membaca, membuat task pada, mengubah, atau menghapus data B, termasuk jika mengetahui ID. Anonymous tidak memperoleh data privat. Session kedaluwarsa tidak berubah menjadi akses global.

**Verifikasi:** integration test dua akun dan anonymous untuk semua metode endpoint terkait, termasuk nested resource dengan ID induk/anak tidak cocok.

### FIX-02 — Amankan eksekusi command CLI

- [x] Diimplementasikan

**Masalah:** runner mengganti placeholder dengan data task lalu memanggil `spawn(..., { shell: true })`. Konten task dapat menjadi perintah shell.

**Lokasi:** `cli/bin/cli.js`, `cli/README.md`, `app/src/routes/implementasi/+page.svelte`.

**Langkah:**
1. Pisahkan executable dan array argumen, lalu gunakan `shell: false`.
2. Lakukan substitusi placeholder hanya pada nilai argumen, bukan teks command yang diparse shell.
3. Untuk command kompleks, dukung wrapper script milik pengguna dengan task dikirim lewat stdin/environment. Jangan evaluasi konten task sebagai shell.
4. Ubah contoh command dan dokumentasikan perubahan kompatibilitas `--exec`.

**Kriteria selesai:** karakter quote, newline, backtick, `$()`, dan pemisah command dalam title/description diterima sebagai data literal. Runner tetap bisa menjalankan executable yang dipilih pengguna.

**Verifikasi:** CLI test dengan API tiruan dan executable pencatat argumen; payload marker tidak dieksekusi, argumen tetap utuh, dan exit code tetap diteruskan dengan benar.

### FIX-03 — Token agent yang aman dan terbatas

- [x] Diimplementasikan

**Masalah:** key kosong mengizinkan request. Satu key global memberi akses seluruh proyek. UI menggunakan key contoh tetap.

**Lokasi:** `app/src/lib/server/agentAuth.ts`, `app/src/routes/api/agent/tasks/+server.ts`, `app/src/lib/server/db/schema.ts`, `app/src/routes/implementasi/+page.svelte`, `cli/lib/config.js`, `cli/lib/api.js`.

**Langkah:**
1. Segera ubah key kosong menjadi penolakan akses yang jelas.
2. Tambahkan token milik pengguna dengan scope proyek, masa berlaku, dan `revokedAt`; simpan hash token, bukan nilai token asli.
3. Batasi list, claim, dan update berdasarkan scope token. Filter `perencanaanId` dari request bukan bukti izin.
4. Tambahkan pembuatan/pencabutan token melalui session pengguna; tampilkan token asli hanya saat dibuat.
5. Hilangkan key contoh sebagai default operasional. Mask seluruh key pada output CLI dan simpan config dengan permission terbatas pada sistem yang mendukungnya.
6. Pastikan perintah CLI daftar proyek menggunakan endpoint yang memahami autentikasi agent dengan scope yang sama.

**Kriteria selesai:** key kosong, salah, kedaluwarsa, atau dicabut ditolak. Token proyek A tidak dapat mengambil maupun mengubah task B. Log dan repository tidak memuat token asli.

**Verifikasi:** matriks valid/invalid/expired/revoked token dan akses lintas proyek untuk seluruh metode agent.

### FIX-04 — Pembatasan penggunaan API

- [x] Diimplementasikan

**Masalah:** endpoint AI terbuka dan tidak ditemukan quota/rate limit dalam aplikasi; percobaan login/register juga tidak dibatasi di kode.

**Lokasi:** `app/src/routes/api/{questions,plan,tasks,prd}/+server.ts`, `app/src/routes/api/auth/`.

**Langkah:** wajibkan identitas untuk generation; batasi panjang input dan ukuran payload; batasi concurrency dan jumlah permintaan per pengguna; pasang batas penggunaan AI terukur; tambahkan throttling autentikasi berdasarkan kombinasi identitas dan sumber request. Terapkan penyimpanan limiter bersama bila deployment memiliki banyak instance.

**Kriteria selesai:** request yang melewati batas ditolak sebelum memanggil provider; respons 429 dan petunjuk retry konsisten; pengguna lain tidak ikut terblokir secara keliru. Timeout upstream ditangani dan dapat dikenali UI.

**Verifikasi:** provider tiruan menghitung jumlah panggilan; request yang ditolak tidak menghasilkan panggilan provider. Uji batas payload, concurrency, dan pemulihan setelah interval limiter.

### FIX-05 — Validasi kontrak API dan output AI

- [x] Diimplementasikan

**Masalah:** type assertion dipakai seolah validasi runtime; JSON rusak, nilai null, bentuk array salah, dan enum tidak valid dapat masuk ke alur penyimpanan.

**Lokasi:** semua endpoint POST/PATCH, terutama `api/plan`, `api/tasks`, `api/questions`, dan `api/auth`.

**Langkah:** definisikan schema request dan respons provider; validasi tipe, batas ukuran/jumlah elemen, panjang teks, enum, ID, dan nilai limit; tangani malformed JSON dengan 400. Validasi seluruh hierarki sebelum insert pertama. Bedakan error input pengguna dan output provider tidak valid.

**Kriteria selesai:** input invalid tidak menghasilkan 500 atau insert parsial. Respons AI dengan nested shape rusak ditolak. ID pertanyaan tidak duplikat, options berupa string, dan jumlah elemen dibatasi.

**Verifikasi:** fixture JSON kosong/rusak/null, tipe salah, field hilang, enum asing, limit negatif/NaN, dan output LLM terpotong.

### FIX-06 — Transaksi generation dan ID konsisten

- [x] Diimplementasikan

**Masalah:** insert hierarki berurutan tanpa transaksi; fallback bisa membuat proyek kedua setelah kegagalan sebagian. ID respons berbeda dari UUID database. Fallback mengembalikan proyek terlama alih-alih proyek baru.

**Lokasi:** `app/src/routes/api/plan/+server.ts`, `app/src/routes/api/tasks/+server.ts`, `app/src/lib/server/db/schema.ts`.

**Langkah:** validasi output, tetapkan ID persisten untuk seluruh node, lalu simpan dalam transaksi yang didukung deployment libSQL. Jangan membuka transaksi selama menunggu LLM. Return DTO dari objek yang benar-benar disimpan. Gunakan `perRow.id` secara langsung pada jalur yang memerlukan ID. Jangan membuat fallback baru karena error database.

**Kriteria selesai:** satu request sukses menghasilkan tepat satu hierarki utuh; kegagalan insert meninggalkan nol perubahan dari transaksi tersebut. Semua ID respons bisa dibaca kembali dan digunakan untuk mutation.

**Verifikasi:** injeksi kegagalan pada insert tengah; bandingkan ID respons dan database; buat dua proyek lama lalu pastikan ID hasil baru tetap benar.

### FIX-07 — Relasi task harus berdasarkan ID

- [x] Diimplementasikan

**Masalah:** pencarian berdasarkan title dapat menautkan task ke subfitur/proyek lain; ID yang diberikan tidak divalidasi sebagai satu rantai relasi.

**Lokasi:** `app/src/routes/api/tasks/+server.ts`, pemanggilnya di perencanaan dan Kanban.

**Langkah:** wajibkan `subFiturId`; ambil fitur, proyek, dan metadata dari database. Jika request masih mengirim ID induk, validasi kecocokannya. Hapus seluruh fallback pencarian berdasarkan judul, termasuk dalam catch handler.

**Kriteria selesai:** dua proyek dengan judul/fitur/subfitur identik tetap terisolasi. ID anak dari proyek lain ditolak sebelum panggilan LLM atau penulisan data.

**Verifikasi:** fixture judul identik lintas akun dan proyek, ID induk palsu, serta subfitur yang sudah dihapus.

### FIX-08 — Satu konteks proyek aktif

- [x] Diimplementasikan

**Masalah:** URL dapat menunjuk proyek A sementara draft sessionStorage masih menunjuk B. Halaman implementasi dan beberapa tombol kehilangan konteks URL. Perubahan jawaban/preferensi juga belum menginvalidasi plan lama secara eksplisit.

**Lokasi:** `app/src/routes/{perencanaan,kanban,implementasi,preferensi,pertanyaan}/+page.svelte`, `app/src/lib/stores/draft.svelte.ts`.

**Langkah:** gunakan ID URL sebagai sumber konteks proyek tersimpan; teruskan ID saat navigasi; gunakan draft hanya untuk wizard yang belum tersimpan. Hilangkan fallback diam-diam ke proyek terbaru ketika ID URL invalid. Definisikan perilaku revisi input: tandai plan tidak mutakhir dan minta tindakan regenerate yang jelas sebelum menggantinya.

**Kriteria selesai:** membuka A ketika draft B masih ada tidak pernah menulis ke B. Deep link bekerja tanpa draft. Proyek tidak ditemukan menghasilkan state yang jelas, bukan proyek lain.

**Verifikasi:** E2E navigasi A/B, tab baru, reload, sessionStorage kosong, ID invalid, serta perubahan jawaban setelah plan terbentuk.

### FIX-09 — Claim atomik dan recovery worker

- [x] Diimplementasikan

**Masalah:** SELECT dan UPDATE terpisah memungkinkan claim ganda. Tidak ada pemilik claim maupun lease.

**Lokasi:** `app/src/routes/api/agent/tasks/+server.ts`, `app/src/lib/server/db/schema.ts`, runner CLI.

**Langkah:** gunakan atomic conditional update atau transaksi dengan semantik concurrency yang teruji di libSQL. Tambahkan claim token/worker, waktu mulai dan lease expiry. Update hasil wajib cocok dengan claim aktif. Sediakan heartbeat dan pemulihan lease kedaluwarsa; batasi retry dan bedakan kegagalan dari backlog biasa.

**Kriteria selesai:** banyak worker yang berebut satu task hanya menghasilkan satu claim sukses. Worker lama tidak dapat menyelesaikan task setelah lease diambil worker baru. Task dari worker mati dapat dipulihkan.

**Verifikasi:** concurrent claim test, lease expiry, heartbeat, completion memakai token claim lama, dan crash worker. Jangan mengklaim exactly-once execution untuk efek eksternal; desain ini mencegah claim aktif ganda dan memberi recovery terkontrol.

### FIX-10 — Perilaku runner sesuai flag

- [x] Diimplementasikan

**Masalah:** dry-run melakukan mutation dan `continue` melewati batas once; kegagalan claim juga dapat terus retry meski once dipilih.

**Lokasi:** `cli/bin/cli.js`, `cli/lib/api.js`.

**Langkah:** dry-run hanya membaca task tanpa claim; once menyelesaikan satu siklus termasuk kondisi error/kosong. Validasi poll interval; beri retry/backoff terbatas; tangani SIGINT/SIGTERM dan kegagalan update status tanpa langsung menjalankan ulang pekerjaan yang sudah sukses. Pasang timeout HTTP dan kebijakan timeout proses yang terdokumentasi.

**Kriteria selesai:** `--dry --once` keluar setelah satu pembacaan dan nol mutation. Kegagalan command tidak menyebabkan loop tanpa batas. Gagal mengirim hasil tidak otomatis mengeksekusi ulang command yang sama.

**Verifikasi:** subprocess test untuk dry/once, antrean kosong, server error, command error, shutdown, timeout, serta completion yang gagal tersimpan.

### FIX-11 — Konteks dan hasil agent dapat ditinjau

- [x] Diimplementasikan

**Masalah:** claim hanya mengembalikan task mentah; placeholder fitur/subfitur tidak memperoleh enrichment dari endpoint list. Exit code 0 langsung diperlakukan sebagai done.

**Lokasi:** `app/src/routes/api/agent/tasks/+server.ts`, `cli/bin/cli.js`, model task dan prompt generation.

**Langkah:** kembalikan konteks yang sama pada list dan claim: tujuan proyek, stack, fitur/subfitur, requirement relevan, dan acceptance criteria. Sertakan metadata hasil minimal: ringkasan perubahan, status command, dan hasil verifikasi bila tersedia. Nyatakan kebijakan done: hasil command saja atau hasil yang telah ditinjau; jangan mengesankan pengujian telah dilakukan jika tidak ada bukti.

**Kriteria selesai:** runner memperoleh konteks tanpa menebak dari judul. UI bisa membedakan pekerjaan selesai dieksekusi dengan pekerjaan yang telah diverifikasi sesuai kebijakan produk.

**Verifikasi:** contract test payload list/claim; task dengan stack manual; hasil command sukses tetapi laporan verifikasi gagal/tidak tersedia.

### FIX-12 — Generation tidak menduplikasi task

- [x] Diimplementasikan

**Masalah:** setiap pemanggilan dapat menambah task lagi. UI generate-all tidak menandai subfitur sebagai sudah terisi dalam state DB sehingga klik berikutnya berisiko mengulang.

**Lokasi:** `app/src/routes/api/tasks/+server.ts`, `app/src/routes/kanban/+page.svelte`, `app/src/routes/perencanaan/+page.svelte`.

**Langkah:** bedakan generate-missing dan regenerate; gunakan idempotency key dengan identitas pengguna, resource, serta versi input. Cegah generation paralel pada subfitur sama di server. Disable tombol saat proses dan refresh state plan setelah sukses. Regenerate tidak boleh diam-diam menggandakan atau menghapus task yang sudah dikerjakan.

**Kriteria selesai:** retry request atau klik ganda menghasilkan satu set task. Task doing/done tetap terpelihara pada operasi generate-missing.

**Verifikasi:** request serentak, retry setelah respons hilang, klik generate-all dua kali, dan proyek dengan task campuran todo/doing/done.

### FIX-13 — Kanban menggunakan status server

- [x] Diimplementasikan

**Masalah:** UI mengubah status walau PATCH gagal. Daftar DB kosong diperlakukan sebagai alasan mengambil draft lain, sambil mempertahankan mode DB.

**Lokasi:** `app/src/routes/kanban/+page.svelte`, `app/src/routes/detail/[id]/+page.svelte`.

**Langkah:** bedakan loading, empty, error, dan data-ready. Pada proyek tersimpan jangan fallback ke task lokal. Periksa respons mutation; gunakan hasil server atau rollback optimistic update. Tampilkan error yang bisa ditindaklanjuti dan cegah mutation ganda yang masih pending.

**Kriteria selesai:** empty project tetap kosong; server 401/403/404/500 tidak menghasilkan status sukses palsu. Reload menghasilkan status yang sama dengan tampilan setelah mutation sukses.

**Verifikasi:** API tiruan untuk semua status gagal, network disconnect, empty board dengan draft proyek lain, dan drag berulang cepat.

### FIX-14 — Tampilkan perubahan agent pada Kanban

- [x] Diimplementasikan

**Masalah:** board mengambil data saat mount; perubahan agent tidak terlihat sampai reload.

**Lokasi:** `app/src/routes/kanban/+page.svelte`.

**Langkah:** mulai dengan polling ringan saat halaman terlihat, refresh saat tab kembali aktif, dan tombol refresh manual. Hentikan polling saat unmount/hidden serta gunakan backoff setelah error. Pastikan response lama tidak menimpa mutation yang lebih baru.

**Kriteria selesai:** perubahan agent terlihat dalam interval yang ditetapkan tanpa reload penuh. Tidak ada request yang terus berjalan setelah meninggalkan board.

**Verifikasi:** simulasi perubahan server, tab hidden/visible, unmount, dan respons polling yang datang terlambat.

### FIX-15 — Error dan fallback transparan

- [x] Diimplementasikan

**Masalah:** error parse/provider/database tercampur; fallback generik dapat terlihat seperti hasil AI sukses. Error mentah upstream ikut dikirim ke client.

**Lokasi:** `app/src/routes/api/{questions,plan,tasks,prd}/+server.ts`, UI pemanggilnya.

**Langkah:** pisahkan tipe error input, provider, validation, dan persistence. Gunakan timeout eksplisit dan retry terbatas hanya untuk kegagalan yang aman diulang. Jika template fallback dipertahankan, beri label jelas dan status persistensi yang benar. Jangan menyimpan template otomatis sebagai respons terhadap kegagalan database. Kirim kode error stabil dan request ID; simpan detail diagnostik yang telah disanitasi di server.

**Kriteria selesai:** pengguna mengetahui hasil AI asli, template, atau kegagalan penyimpanan. Tidak ada klaim saved jika transaksi gagal. Token dan detail sensitif provider tidak muncul pada respons error.

**Verifikasi:** provider timeout, 429/500, JSON invalid, database unavailable, dan pemeriksaan redaksi log/response.

### FIX-16 — PRD dan riwayat nyata

- [x] Diimplementasikan

**Masalah:** GET PRD mengembalikan contoh statis. Hasil Markdown belum disimpan dan halaman hasil melakukan generation kembali saat dibuka.

**Lokasi:** `app/src/routes/api/prd/+server.ts`, `app/src/routes/hasil/+page.svelte`, `app/src/routes/create/+page.svelte`, schema.

**Langkah:** simpan dokumen PRD dengan pemilik/proyek, versi, konten, dan metadata generation yang diperlukan; tampilkan riwayat berdasarkan pemilik; buka hasil berdasarkan ID; pisahkan aksi view dan regenerate. Sediakan copy/download dari konten yang tersimpan.

**Kriteria selesai:** reload hasil tidak memanggil LLM lagi; riwayat sesuai data pengguna dan tidak menampilkan contoh sebagai dokumen asli.

**Verifikasi:** generate-save-reload, akses lintas pengguna, riwayat kosong, dan regenerate menghasilkan versi yang jelas.

### FIX-17 — Referensi tidak menyesatkan

- [x] Diimplementasikan

**Masalah:** referensi hanya boolean; tidak ada konten referensi yang benar-benar diterima/dibaca dalam alur generation utama.

**Lokasi:** `app/src/routes/create/+page.svelte`, draft, endpoint generation, README.

**Langkah minimum:** hapus/nonaktifkan kontrol referensi aktif dan jelaskan bahwa fitur belum tersedia. Implementasi upload/URL dijadikan pekerjaan produk terpisah setelah kontrak, batas ukuran/jenis, penyimpanan, serta keamanan pengambilan URL ditentukan.

**Kriteria selesai:** UI tidak mengklaim AI membaca referensi yang tidak pernah dikirim. Tidak ada boolean tanpa efek yang terlihat sebagai fitur aktif.

**Verifikasi:** inspeksi alur create hingga generation dan kecocokan teks bantuan dengan request sebenarnya.

### FIX-18 — Canvas dan Kanban dapat diakses

- [x] Diimplementasikan

**Masalah:** interaksi canvas menggunakan mouse, tiga warning a11y muncul; posisi node tidak disimpan. Kartu Kanban berfokus keyboard tetapi tidak menyediakan aksi perpindahan status yang setara.

**Lokasi:** `app/src/routes/perencanaan/+page.svelte`, `app/src/routes/kanban/+page.svelte`.

**Langkah:** sediakan aksi keyboard/menu status, gunakan pointer events untuk drag, hindari drag parent menelan interaksi tombol anak, dan tambahkan label fokus yang jelas. Simpan posisi canvas per proyek jika fitur layout ingin dipertahankan, atau jelaskan sifat sementara dan sediakan reset.

**Kriteria selesai:** aksi inti bisa dilakukan tanpa mouse; touch berfungsi; tidak ada warning a11y terkait; perilaku posisi setelah reload konsisten dengan produk.

**Verifikasi:** manual keyboard/touch dan viewport kecil, perpindahan status, klik subfitur, resize, reload, serta svelte-check.

### FIX-19 — Query dan indeks

- [x] Diimplementasikan

**Masalah:** daftar proyek dapat menjalankan 41 query untuk 20 proyek; list agent hingga 151 query untuk 50 task. Foreign key/filter yang sering dipakai belum memiliki indeks eksplisit dalam schema.

**Lokasi:** `app/src/routes/api/perencanaan/`, `app/src/routes/api/agent/tasks/+server.ts`, `app/src/lib/server/db/schema.ts`.

**Langkah:** gunakan aggregate count dan join/batch fetch; tambahkan indeks berdasarkan pola query aktual, misalnya pemilik+tanggal proyek, proyek+status+tanggal task, fitur pada subfitur, dan subfitur pada task. Tambahkan pagination dengan urutan stabil. Hindari memuat seluruh task hanya untuk menghitung.

**Kriteria selesai:** jumlah query list tidak bertambah per item; target maksimal lima query untuk satu halaman list setelah auth, atau dokumentasikan alasan bila perlu lebih. Hasil, urutan, dan batas ownership tetap sama.

**Verifikasi:** ukur jumlah query dan latency sebelum/sesudah dengan fixture kecil/besar; inspect query plan untuk filter utama.

### FIX-20 — Migration dan dependency reproducible

- [x] Diimplementasikan

**Masalah:** migration dan lockfile diabaikan Git. `db:push --force` muncul dalam dokumentasi; belum ada riwayat perubahan schema yang ditinjau.

**Lokasi:** `.gitignore`, `app/.gitignore`, `app/drizzle.config.ts`, package/lockfile app dan CLI, README.

**Langkah:** track lockfile untuk masing-masing package; track migration SQL dan metadata yang diperlukan; tetap abaikan database lokal dan secrets. Bandingkan schema existing sebelum membuat baseline migration. Tambahkan prosedur backup, migrasi staging, validasi jumlah/relasi data, serta rollback atau forward-fix. Jangan menjalankan baseline atau migration destruktif langsung pada hosted DB saat membuat rencana ini.

**Kriteria selesai:** fresh clone bisa menggunakan `npm ci`; database kosong bisa dimigrasikan; database existing dapat naik versi tanpa kehilangan ownership/task; rencana recovery telah diuji.

**Verifikasi:** clean install, migrate DB kosong, upgrade salinan fixture schema lama, dan cek data sebelum/sesudah.

### FIX-21 — Test, lint, dan CI sebagai gate

- [x] Diimplementasikan

**Masalah:** belum ada automated regression suite/CI; format dan lint gagal meskipun typecheck/build lolos.

**Lokasi:** `app/package.json`, `cli/package.json`, konfigurasi lint, test baru, konfigurasi CI baru.

**Langkah:** pisahkan perubahan formatting dari logic agar review jelas. Selesaikan lint berdasarkan jenis error tanpa menonaktifkan aturan secara massal. Tambahkan test pada perilaku berisiko: otorisasi, transaksi, concurrency claim, idempotency, runner, dan satu alur E2E inti. Gunakan DB sementara dan provider tiruan. CI menjalankan clean install, check, lint, test, build.

**Kriteria selesai:** pipeline bersih dan otomatis memblokir regresi kritis. Tidak ada penggunaan database production atau token provider berbayar untuk test biasa.

**Verifikasi:** jalankan pipeline dari checkout bersih dan pastikan test keamanan gagal jika guard sengaja dilepas pada perubahan lokal yang kemudian dibatalkan.

### FIX-22 — Deployment dan observabilitas

- [x] Diimplementasikan

**Masalah:** build sukses belum menghasilkan bukti deployment target; health endpoint hanya mengembalikan status statis; logging belum cukup untuk melacak kegagalan lintas generation dan agent.

**Lokasi:** `app/vite.config.ts`, `app/src/routes/api/health/+server.ts`, `app/src/hooks.server.ts`, `.env.example`, dokumentasi deployment.

**Langkah:** tentukan target runtime lalu konfigurasi adapter yang sesuai; validasi env wajib saat startup. Bedakan liveness dan readiness tanpa memanggil provider AI pada setiap health check. Tambahkan request ID, latency, kategori error, penggunaan token bila tersedia, dan metrik antrean. Redaksi secrets serta hindari menyimpan prompt lengkap secara default.

**Kriteria selesai:** artefak dapat dijalankan di target staging, readiness mendeteksi ketidaktersediaan DB, cookie production bekerja melalui HTTPS, dan satu request gagal dapat ditelusuri tanpa membocorkan data sensitif.

**Verifikasi:** deploy staging, login/logout, request generation tiruan, DB disconnect, dan inspeksi log.

### FIX-23 — Perkuat session dan input autentikasi

- [x] Diimplementasikan

**Masalah:** validasi email/password/name masih sederhana, race registrasi dapat menghasilkan error mentah, beberapa endpoint membaca session kembali meski hook sudah memuatnya.

**Lokasi:** `app/src/lib/server/auth.ts`, `app/src/hooks.server.ts`, `app/src/routes/api/auth/`, endpoint yang mengulang lookup session.

**Langkah:** normalisasi email dan validasi tipe/panjang field; tangani unique conflict registrasi; gunakan `locals.user` untuk menghindari lookup berulang. Pertahankan scrypt dan cookie flags. Uji expiry/logout dan tetapkan cleanup session kedaluwarsa. Tentukan kebijakan error login yang konsisten.

**Kriteria selesai:** input bertipe salah menghasilkan 400; registrasi bersamaan tidak menghasilkan error mentah; session expired/logout tidak dapat mengakses resource; cookie production tetap Secure/HttpOnly/SameSite.

**Verifikasi:** login valid/invalid, malformed input, registrasi paralel, expiry, logout, dan cookie assertion.

### FIX-24 — Dokumentasi dan agent contoh jujur

- [x] Diimplementasikan

**Masalah:** README menyebut claim atomik padahal belum; contoh agent menandai done setelah simulasi; istilah workflow n8n dapat disalahartikan sebagai integrasi; instruksi key dan CLI perlu mengikuti kontrak baru.

**Lokasi:** `README.md`, `cli/README.md`, `app/agent/local-agent.js`, `app/agent/local-agent.py`, `app/src/routes/implementasi/+page.svelte`.

**Langkah:** beri label simulasi pada contoh agent dan jangan mutasi task nyata secara default. Sinkronkan contoh argumen, cara token, dry-run, scope proyek, dan model status. Sebut canvas sebagai visualisasi perencanaan kecuali integrasi n8n memang dibuat. Hapus klaim perilaku yang belum diverifikasi.

**Kriteria selesai:** command yang disalin dari UI/dokumentasi sesuai parser CLI dan kontrak auth; menjalankan contoh default tidak menyelesaikan task nyata tanpa pekerjaan.

**Verifikasi:** smoke test command dengan API tiruan dan walkthrough dokumentasi dari konfigurasi kosong.

## 4. Urutan pelaksanaan

### Tahap A — Tutup risiko publik

Kerjakan FIX-01, FIX-02, FIX-03, dan FIX-04; mulai FIX-20 serta test regresi FIX-21 yang dibutuhkan. Key kosong harus segera ditolak, tanpa menunggu seluruh fitur token selesai.

**Gate:** tidak ada akses lintas pengguna, konten task tidak dievaluasi shell, token memiliki scope, dan request AI dibatasi sebelum mencapai provider.

### Tahap B — Benarkan data dan konteks proyek

Kerjakan FIX-05, FIX-06, FIX-07, FIX-08, FIX-12, dan FIX-15.

**Gate:** generation menyimpan satu hierarki valid atau tidak menyimpan apa pun; semua ID persisten; request ulang tidak menggandakan task; deep link A tidak pernah mengubah B.

### Tahap C — Buat eksekusi agent dapat diandalkan

Kerjakan FIX-09, FIX-10, FIX-11, FIX-13, FIX-14, dan FIX-24.

**Gate:** claim aktif tunggal, worker crash dapat dipulihkan, dry-run tidak menulis data, hasil dapat ditinjau, dan board mengikuti status server.

### Tahap D — Lengkapi mutu produk dan operasi

Kerjakan FIX-16, FIX-17, FIX-18, FIX-19, FIX-22, dan FIX-23; tuntaskan FIX-20/FIX-21.

**Gate:** PRD tersimpan, UI tidak menjanjikan fitur semu, alur inti dapat diakses dengan keyboard, query list terukur, pipeline bersih, dan staging dapat dioperasikan.

## 5. Checklist penerimaan akhir

- [x] Anonymous tidak bisa membaca atau mengubah data privat.
- [x] Pengguna A dan B terisolasi di semua endpoint, termasuk generation.
- [x] Token agent hanya berlaku untuk cakupan yang diberikan dan dapat dicabut.
- [x] Konten task tidak pernah diparse sebagai shell.
- [x] Respons provider invalid tidak menghasilkan data parsial.
- [x] Semua ID frontend untuk proyek tersimpan berasal dari database.
- [x] Klik ganda/retry generation tidak menggandakan task.
- [x] Hanya satu worker memiliki claim aktif pada satu task.
- [x] Worker mati dan lease lama ditangani tanpa completion ilegal.
- [x] `--dry --once` melakukan nol mutation dan keluar setelah satu siklus.
- [x] Perubahan status gagal tidak ditampilkan sebagai sukses.
- [x] Proyek kosong tidak menampilkan task dari draft proyek lain.
- [x] PRD dapat dibuka kembali tanpa generation ulang.
- [x] Check, lint, test, dan build lolos dari checkout bersih.
- [ ] Migration staging serta prosedur pemulihan sudah diuji.
- [ ] Alur browser desktop/mobile dan keyboard sudah diverifikasi.

## 6. Batas lingkup

Backlog ini tidak mencakup billing, marketplace agent, kolaborasi realtime, integrasi n8n sungguhan, atau rewrite framework. Fitur tersebut tidak dibutuhkan untuk menutup masalah audit. Estimasi waktu baru layak dibuat setelah target deployment, kebijakan guest access, dan aturan verifikasi hasil agent ditetapkan; selama itu implementasi keamanan dapat memakai baseline private-by-default.
