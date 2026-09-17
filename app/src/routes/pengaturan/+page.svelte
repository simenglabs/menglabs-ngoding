<script lang="ts">
	import { onMount } from 'svelte';

	type SettingsResponse = {
		mode: 'server' | 'custom';
		custom: { baseUrl: string; model: string; timeoutMs: number; hasApiKey: boolean } | null;
		server: { baseUrl: string; model: string; timeoutMs: number };
	};

	let loading = $state(true);
	let saving = $state(false);
	let testing = $state(false);
	let mode = $state<'server' | 'custom'>('server');
	let baseUrl = $state('https://api.openai.com/v1');
	let model = $state('gpt-4.1-mini');
	let apiKey = $state('');
	let timeoutMs = $state(45000);
	let hasApiKey = $state(false);
	let clearApiKey = $state(false);
	let server = $state<SettingsResponse['server'] | null>(null);
	let message = $state('');
	let error = $state('');

	function apply(data: SettingsResponse) {
		mode = data.mode;
		server = data.server;
		if (data.custom) {
			baseUrl = data.custom.baseUrl;
			model = data.custom.model;
			timeoutMs = data.custom.timeoutMs;
			hasApiKey = data.custom.hasApiKey;
		}
		apiKey = '';
		clearApiKey = false;
	}

	onMount(async () => {
		try {
			const response = await fetch('/api/settings/llm');
			const data = await response.json();
			if (!response.ok) throw new Error(data.message ?? 'Pengaturan tidak dapat dimuat.');
			apply(data);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Pengaturan tidak dapat dimuat.';
		} finally {
			loading = false;
		}
	});

	async function save() {
		saving = true;
		message = '';
		error = '';
		try {
			const response = await fetch('/api/settings/llm', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(
					mode === 'server' ? { mode } : { mode, baseUrl, model, apiKey, timeoutMs, clearApiKey }
				)
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.message ?? 'Pengaturan belum tersimpan.');
			apply(data);
			message = 'Pengaturan LLM tersimpan.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Pengaturan belum tersimpan.';
		} finally {
			saving = false;
		}
	}

	async function testConnection() {
		testing = true;
		message = '';
		error = '';
		try {
			const response = await fetch('/api/settings/llm', { method: 'POST' });
			const data = await response.json();
			if (!response.ok) throw new Error(data.message ?? 'Koneksi gagal.');
			message = `Koneksi berhasil menggunakan ${data.model}.`;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Koneksi gagal.';
		} finally {
			testing = false;
		}
	}
</script>

<svelte:head><title>Pengaturan LLM — mager</title></svelte:head>

<div class="page-wrap max-w-3xl">
	<div class="page-heading">
		<div>
			<p class="eyebrow">Akun</p>
			<h1 class="page-title">Pengaturan LLM</h1>
			<p class="page-intro">Pilih mesin AI untuk pertanyaan, planning, PRD, dan pembuatan task.</p>
		</div>
	</div>

	{#if loading}
		<p role="status" class="mt-8 text-slate-300">Memuat pengaturan…</p>
	{:else}
		<form
			class="surface mt-8 space-y-6 p-6"
			onsubmit={(event) => {
				event.preventDefault();
				void save();
			}}
		>
			<fieldset>
				<legend class="field-label">Sumber LLM</legend>
				<div class="mt-3 grid gap-3 sm:grid-cols-2">
					<label class="cursor-pointer rounded-xl border border-[#334155] p-4">
						<input class="mr-2" type="radio" bind:group={mode} value="server" />
						<span class="font-semibold">Bawaan mager</span>
						<p class="help-text mt-2">Langsung pakai konfigurasi server tanpa API key pribadi.</p>
					</label>
					<label class="cursor-pointer rounded-xl border border-[#334155] p-4">
						<input class="mr-2" type="radio" bind:group={mode} value="custom" />
						<span class="font-semibold">Provider sendiri</span>
						<p class="help-text mt-2">Gunakan endpoint OpenAI-compatible dan model pilihanmu.</p>
					</label>
				</div>
			</fieldset>

			{#if mode === 'server' && server}
				<div class="notice">
					<p class="font-semibold">Konfigurasi server</p>
					<p class="help-text mt-1 break-all">{server.model} · {server.baseUrl}</p>
				</div>
			{:else if mode === 'custom'}
				<div>
					<label class="field-label" for="llm-base-url">Base URL</label>
					<input
						id="llm-base-url"
						class="field"
						bind:value={baseUrl}
						required
						placeholder="https://api.openai.com/v1"
					/>
					<p class="help-text mt-2">
						Masukkan URL sampai versi API. `/chat/completions` ditambahkan otomatis.
					</p>
				</div>
				<div>
					<label class="field-label" for="llm-model">Model</label>
					<input
						id="llm-model"
						class="field"
						bind:value={model}
						required
						placeholder="gpt-4.1-mini"
					/>
				</div>
				<div>
					<label class="field-label" for="llm-api-key">API key</label>
					<input
						id="llm-api-key"
						class="field"
						type="password"
						bind:value={apiKey}
						autocomplete="off"
						placeholder={hasApiKey
							? 'Tersimpan — kosongkan untuk mempertahankan'
							: 'Opsional jika provider tidak memerlukan key'}
					/>
					{#if hasApiKey}
						<label class="help-text mt-2 flex items-center gap-2">
							<input type="checkbox" bind:checked={clearApiKey} /> Hapus API key yang tersimpan
						</label>
					{/if}
				</div>
				<div>
					<label class="field-label" for="llm-timeout">Timeout per bagian</label>
					<select id="llm-timeout" class="field" bind:value={timeoutMs}>
						<option value={15000}>15 detik</option>
						<option value={30000}>30 detik</option>
						<option value={45000}>45 detik</option>
						<option value={50000}>50 detik</option>
					</select>
					<p class="help-text mt-2">Planning tetap mencoba ulang bagian yang timeout.</p>
				</div>
			{/if}

			{#if error}<p role="alert" class="text-sm text-red-300">{error}</p>{/if}
			{#if message}<p role="status" class="text-sm text-emerald-300">{message}</p>{/if}

			<div class="action-row">
				<button class="primary-button" type="submit" disabled={saving}
					>{saving ? 'Menyimpan…' : 'Simpan pengaturan'}</button
				>
				<button
					class="secondary-button"
					type="button"
					onclick={testConnection}
					disabled={testing || saving}>{testing ? 'Menguji…' : 'Uji koneksi tersimpan'}</button
				>
			</div>
		</form>
	{/if}
</div>
