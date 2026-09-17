<svelte:head
	><title>mager — Rencanakan aplikasi, kerjakan bersama AI</title><meta
		name="description"
		content="Ceritakan ide aplikasi, susun rencana dan tugas, lalu jalankan dengan agent AI di komputer kamu."
	/></svelte:head
>
<div class="page-wrap">
	<section class="max-w-[780px] py-8 sm:py-14">
		<p class="eyebrow">Dari ide ke daftar tugas</p>
		<h1 class="page-title !text-[38px] sm:!text-[58px]">
			Mulai bikin aplikasi.<br />Satu langkah setiap kali.
		</h1>
		<p class="page-intro mt-6">
			Ceritakan idemu. mager menyusun rencana dan membaginya menjadi tugas. Lalu, jalankan agent AI
			di komputermu untuk mengerjakannya.
		</p>
		<div class="action-row">
			<a href="/create" class="primary-button">Mulai dari ide →</a><a
				href="/dashboard"
				class="secondary-button">Buka proyek saya</a
			>
		</div>
		<p class="help-text mt-4">Belum tahu teknologi yang cocok? Kamu bisa minta AI memilihkannya.</p>
	</section>
	<section aria-label="Cara menggunakan mager" class="guide-grid">
		<article class="surface">
			<span class="step-number">1</span>
			<h2>Ceritakan kebutuhan</h2>
			<p>Tulis ide dan jawab beberapa pertanyaan tentang aplikasi yang ingin dibuat.</p>
		</article>
		<article class="surface">
			<span class="step-number">2</span>
			<h2>Periksa rencananya</h2>
			<p>
				Lihat fitur dan tugas yang disusun. Pekerjaan dimulai dengan kerangka frontend dan backend.
			</p>
		</article>
		<article class="surface">
			<span class="step-number">3</span>
			<h2>Jalankan di komputer</h2>
			<p>
				Salin perintah ke terminal di folder proyek. Agent mengerjakan tugas dan memperbarui papan
				tugas.
			</p>
		</article>
	</section>
	<details class="surface mt-8">
		<summary>Apa yang perlu disiapkan?</summary>
		<p class="page-intro">
			Untuk menyimpan proyek, buat akun atau masuk. Untuk menjalankan tugas di komputer, siapkan
			Node.js serta Claude Code yang sudah terpasang dan masuk ke akun. Petunjuknya tersedia setelah
			rencana dibuat.
		</p>
	</details>
</div>
