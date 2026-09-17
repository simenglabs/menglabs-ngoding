<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let apiBase = $state('');
	let perencanaanId = $state('');
	let apiKey = $state('');
	let tokenError = $state('');
	let tokenId = $state('');
	let tokens = $state<
		Array<{
			id: string;
			perencanaanId: string;
			name: string;
			expiresAt: string;
			revokedAt: string | null;
		}>
	>([]);
	let copied = $state<string | null>(null);

	let projects = $state<Array<{ id: string; title: string }>>([]);
	let busy = $state(false);
	let loading = $state(true);
	onMount(() => {
		void initialize();
	});
	async function initialize() {
		loading = true;
		tokenError = '';
		apiBase = window.location.origin;
		perencanaanId = new URLSearchParams(window.location.search).get('perencanaanId') ?? '';
		try {
			const response = await fetch('/api/perencanaan');
			if (!response.ok)
				throw new Error('Daftar proyek belum bisa dimuat. Coba lagi atau masuk kembali.');
			projects = await response.json();
			await loadTokens();
		} catch (cause) {
			tokenError = cause instanceof Error ? cause.message : 'Periksa koneksi lalu coba lagi.';
		} finally {
			loading = false;
		}
	}
	async function loadTokens() {
		const response = await fetch('/api/agent/tokens');
		if (!response.ok) throw new Error('Daftar akses belum bisa dimuat. Coba lagi.');
		tokens = (await response.json()).filter(
			(token: { revokedAt: string | null }) => !token.revokedAt
		);
	}
	async function selectProject() {
		apiKey = '';
		tokenId = '';
		copied = null;
		tokenError = '';
		await goto(
			`/implementasi${perencanaanId ? `?perencanaanId=${encodeURIComponent(perencanaanId)}` : ''}`,
			{ replaceState: true, noScroll: true }
		);
	}
	async function createToken() {
		if (busy || !perencanaanId) return;
		busy = true;
		tokenError = '';
		try {
			const response = await fetch('/api/agent/tokens', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ perencanaanId, name: 'CLI local' })
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.message ?? 'Gagal membuat akses proyek.');
			apiKey = data.token;
			tokenId = data.id;
			await loadTokens();
		} catch (cause) {
			tokenError =
				cause instanceof Error
					? cause.message
					: 'Koneksi terputus. Periksa daftar akses sebelum mencoba lagi.';
		} finally {
			busy = false;
		}
	}
	async function revokeToken(id = tokenId) {
		if (!id || busy) return;
		busy = true;
		tokenError = '';
		try {
			const response = await fetch('/api/agent/tokens', {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (!response.ok) throw new Error('Gagal mencabut akses. Coba lagi.');
			if (id === tokenId) {
				apiKey = '';
				tokenId = '';
			}
			await loadTokens();
		} catch (cause) {
			tokenError = cause instanceof Error ? cause.message : 'Periksa koneksi lalu coba lagi.';
		} finally {
			busy = false;
		}
	}
	async function copy(text: string, key: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = key;
			setTimeout(() => {
				if (copied === key) copied = null;
			}, 2000);
		} catch {
			tokenError = 'Tidak bisa menyalin otomatis. Pilih teks perintah lalu salin secara manual.';
		}
	}

	function shellQuote(value: string) {
		return `'${value.replaceAll("'", `'"'"'`)}'`;
	}

	const cmdAutopilot = $derived(
		apiKey
			? `npx menglabs-ngoding@latest autopilot --url ${shellQuote(apiBase || 'https://mager.menglabs.id')} --key ${shellQuote(apiKey)} --perencanaan ${shellQuote(perencanaanId)}`
			: 'Buat token proyek untuk mendapatkan command autopilot'
	);

	const cmdInit = $derived(
		apiKey
			? `npx menglabs-ngoding@latest init --url ${apiBase || 'https://mager.menglabs.id'} --key ${apiKey} ${perencanaanId ? `--perencanaan ${perencanaanId}` : '--perencanaan <id>'} --global`
			: 'Buat token agent terlebih dahulu'
	);
	const cmdTasks = $derived(
		`npx menglabs-ngoding tasks --status todo ${perencanaanId ? `--perencanaan ${perencanaanId}` : ''}`
	);
	const cmdClaim = $derived(
		`npx menglabs-ngoding claim ${perencanaanId ? `--perencanaan ${perencanaanId}` : ''}`
	);
	const cmdClaude = $derived(
		`npx menglabs-ngoding run --agent claude ${perencanaanId ? `--perencanaan ${perencanaanId}` : ''}`
	);
	const cmdAnti = $derived(
		`npx menglabs-ngoding run --agent antigravity ${perencanaanId ? `--perencanaan ${perencanaanId}` : ''}`
	);
	const cmdCustom = `npx menglabs-ngoding run --exec 'cursor-agent "{{title}}: {{description}}"' --poll 4`;
</script>

<svelte:head><title>Jalankan di komputer — mager</title></svelte:head>
<div class="page-wrap narrow">
	<p class="eyebrow">Dari rencana ke kode</p>
	<h1 class="page-title">Kerjakan tugas dengan Claude</h1>
	<p class="page-intro">
		Buka folder proyek di komputermu, lalu jalankan perintah di bawah. Claude mengambil rencana dan
		mengerjakan tugas satu per satu.
	</p>
	<details class="surface mt-6">
		<summary>Persiapan pertama kali</summary>
		<ol class="list-decimal space-y-3 pl-5 text-sm text-slate-300">
			<li>
				Pastikan Node.js dan npm tersedia. Cek dengan <code>node --version</code> dan
				<code>npm --version</code> di terminal.
			</li>
			<li>
				Pastikan Claude Code sudah terpasang dan masuk ke akun. Jalankan <code>claude</code> untuk memeriksanya.
			</li>
			<li>
				Buka terminal di folder tempat kode aplikasi akan dibuat. Di VS Code, buka folder tersebut,
				lalu pilih menu Terminal → New Terminal.
			</li>
		</ol>
	</details>
	{#if tokenError}<div class="notice" role="alert">
			<p>{tokenError}</p>
			{#if !projects.length}<button class="secondary-button mt-3" onclick={initialize}
					>Coba muat lagi</button
				>{/if}
		</div>{/if}
	<section class="surface mt-6">
		<h2 class="text-lg font-semibold">1. Pilih proyek</h2>
		{#if loading}<p role="status" class="help-text">
				Memuat proyek…
			</p>{:else if !projects.length && !tokenError}<p class="help-text">
				Buat rencana proyek terlebih dahulu.
			</p>
			<a href="/create" class="primary-button mt-4">Buat proyek</a>{:else}
			<label for="run-project" class="field-label mt-4">Proyek yang akan dikerjakan</label>
			<select
				id="run-project"
				class="field"
				bind:value={perencanaanId}
				onchange={selectProject}
				disabled={busy}
				><option value="">Pilih proyek…</option>{#each projects as project}<option
						value={project.id}>{project.title}</option
					>{/each}</select
			>
		{/if}
	</section>
	<section class="surface mt-4">
		<h2 class="text-lg font-semibold">2. Buat dan salin perintah</h2>
		<p class="help-text">Perintah memberi agent akses ke proyek yang kamu pilih selama 30 hari.</p>
		{#if !apiKey}<button
				class="primary-button mt-4"
				disabled={!perencanaanId || busy || loading}
				onclick={createToken}
				>{busy ? 'Menyiapkan perintah…' : 'Buat perintah untuk proyek ini'}</button
			>{:else}
			<code class="command">{cmdAutopilot}</code>
			<div class="action-row">
				<button class="primary-button" onclick={() => copy(cmdAutopilot, 'autopilot')}
					>{copied === 'autopilot' ? 'Tersalin' : 'Salin perintah'}</button
				>
			</div>
			<p role="status" class="help-text">
				Salin sebelum meninggalkan halaman. Perintah ini berisi kunci akses proyek.
			</p>
		{/if}
	</section>
	<section class="surface mt-4">
		<h2 class="text-lg font-semibold">3. Tempel di terminal, lalu tekan Enter</h2>
		<p class="help-text">
			Jalankan dari folder proyek. Ikuti permintaan izin dari Claude. Status tugas akan diperbarui
			di papan tugas.
		</p>
		<p class="help-text">
			Jika tugas gagal, proses berhenti dan tugas kembali ke “Siap dikerjakan”. Periksa pesan di
			terminal sebelum menjalankan ulang.
		</p>
		{#if perencanaanId}<a
				href={`/kanban?perencanaanId=${perencanaanId}`}
				class="secondary-button mt-4">Pantau papan tugas →</a
			>{/if}
	</section>
	<details class="surface mt-6">
		<summary>Opsi lanjutan dan agent lain</summary>
		<p class="help-text">Untuk menjalankan perintah terpisah, hubungkan proyek terlebih dahulu.</p>
		{#each [{ title: 'Hubungkan proyek', text: cmdInit, key: 'init' }, { title: 'Lihat tugas siap dikerjakan', text: cmdTasks, key: 'tasks' }, { title: 'Ambil satu tugas', text: cmdClaim, key: 'claim' }, { title: 'Jalankan Claude Code', text: cmdClaude, key: 'claude' }, { title: 'Jalankan Antigravity', text: cmdAnti, key: 'anti' }, { title: 'Agent dengan perintah sendiri', text: cmdCustom, key: 'custom' }] as command}
			<div class="mt-5">
				<h3 class="text-sm font-semibold">{command.title}</h3>
				<code class="command">{command.text}</code><button
					class="secondary-button mt-2"
					disabled={!apiKey}
					onclick={() => copy(command.text, command.key)}
					>{copied === command.key ? 'Tersalin' : 'Salin'}</button
				>
			</div>
		{/each}
	</details>
	<details class="surface mt-4">
		<summary>Kelola akses agent</summary>
		<p class="help-text">
			Cabut akses untuk memutus koneksi agent. Buat akses baru jika ingin menghubungkan kembali.
		</p>
		{#each tokens.filter((token) => !perencanaanId || token.perencanaanId === perencanaanId) as token}<div
				class="action-row justify-between border-t border-slate-700 pt-4"
			>
				<div>
					<p class="text-sm">
						{projects.find((project) => project.id === token.perencanaanId)?.title ?? 'Proyek'} · {token.name}
					</p>
					<p class="help-text">
						Berlaku sampai {new Date(token.expiresAt).toLocaleDateString('id-ID')}
					</p>
				</div>
				<button class="secondary-button" disabled={busy} onclick={() => revokeToken(token.id)}
					>Cabut akses</button
				>
			</div>{:else}<p class="help-text">Belum ada akses aktif untuk proyek ini.</p>{/each}
	</details>
</div>
