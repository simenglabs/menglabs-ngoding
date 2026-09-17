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

	onMount(async () => {
		apiBase = window.location.origin;
		perencanaanId = new URLSearchParams(window.location.search).get('perencanaanId') ?? '';
		await loadTokens();
	});

	async function loadTokens() {
		const response = await fetch('/api/agent/tokens');
		if (!response.ok) {
			tokenError = 'Gagal memuat daftar token.';
			return;
		}
		tokens = (await response.json()).filter(
			(token: { revokedAt: string | null }) => !token.revokedAt
		);
	}

	async function createToken() {
		tokenError = '';
		if (!perencanaanId) {
			tokenError = 'Pilih proyek terlebih dahulu.';
			return;
		}
		const response = await fetch('/api/agent/tokens', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ perencanaanId, name: 'CLI local' })
		});
		const data = await response.json();
		if (!response.ok) {
			tokenError = data.message ?? 'Gagal membuat token';
			return;
		}
		apiKey = data.token;
		tokenId = data.id;
		await loadTokens();
	}

	async function revokeToken(id = tokenId) {
		if (!id) return;
		const response = await fetch('/api/agent/tokens', {
			method: 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id })
		});
		if (response.ok) {
			if (id === tokenId) {
				apiKey = '';
				tokenId = '';
			}
			await loadTokens();
		} else tokenError = (await response.json()).message ?? 'Gagal mencabut token';
	}

	function copy(t: string, key: string) {
		navigator.clipboard.writeText(t);
		copied = key;
		setTimeout(() => (copied = null), 1500);
	}

	function shellQuote(value: string) {
		return `'${value.replaceAll("'", `'"'"'`)}'`;
	}

	const cmdAutopilot = $derived(
		apiKey
			? `npx menglabs-ngoding@latest autopilot --url ${shellQuote(apiBase || 'https://ngoding.menglabs.id')} --key ${shellQuote(apiKey)} --perencanaan ${shellQuote(perencanaanId)}`
			: 'Buat token proyek untuk mendapatkan command autopilot'
	);

	const cmdInit = $derived(
		apiKey
			? `npx menglabs-ngoding@latest init --url ${apiBase || 'https://ngoding.menglabs.id'} --key ${apiKey} ${perencanaanId ? `--perencanaan ${perencanaanId}` : '--perencanaan <id>'} --global`
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

<svelte:head><title>Implementasi — pakai di local</title></svelte:head>

<div class="min-h-screen bg-[#0a0f1f] px-4 py-6 text-white">
	<div
		class="pointer-events-none fixed inset-0"
		style="background-image: radial-gradient(circle, rgba(255,255,255,0.14) 1px, transparent 1px); background-size:22px 22px; opacity:0.25"
	></div>
	<div class="relative mx-auto max-w-[860px]">
		<button onclick={() => history.back()} class="text-xs text-[#64748b] hover:text-white"
			>← Kembali</button
		>
		<h1 class="mt-3 text-2xl font-bold">Implementasi di Local</h1>
		<p class="mt-1 text-sm text-[#94a3b8]">
			Platform hosted → sync otomatis ke local. Bebas pakai agent CLI kamu: <code
				class="rounded bg-[#1e293b] px-1.5 py-0.5 text-xs">claude</code
			> <code class="rounded bg-[#1e293b] px-1.5 py-0.5 text-xs">antigravity</code>
			<code class="rounded bg-[#1e293b] px-1.5 py-0.5 text-xs">cursor</code>
			<code class="rounded bg-[#1e293b] px-1.5 py-0.5 text-xs">opencode</code>
		</p>

		<div class="mt-6 rounded-2xl border border-[#f97316]/60 bg-[#2a1b16] p-5">
			<div class="flex items-center justify-between gap-3">
				<div>
					<h2 class="text-sm font-bold text-[#fb923c]">Satu command: Claude kerjakan semuanya</h2>
					<p class="mt-1 text-xs text-[#cbd5e1]">
						Jalankan dari folder repository. CLI mengambil PRD dan task, lalu berhenti saat antrean
						selesai.
					</p>
				</div>
				<button
					onclick={() => copy(cmdAutopilot, 'autopilot')}
					disabled={!apiKey}
					class="rounded-xl bg-[#f97316] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
					>{copied === 'autopilot' ? 'Copied ✓' : 'Copy'}</button
				>
			</div>
			<div class="mt-3 overflow-auto rounded-xl bg-[#0a0f1f] p-3 font-mono text-xs leading-relaxed">
				{cmdAutopilot}
			</div>
			<p class="mt-2 text-xs text-[#94a3b8]">
				Syarat: <code>claude</code> sudah terpasang dan login. Jika satu task gagal, proses berhenti dan
				task dikembalikan ke todo.
			</p>
		</div>

		<div class="mt-6 rounded-2xl border border-[#1e293b] bg-[#151c2f]/80 p-5">
			<h2 class="text-sm font-bold">1. Install (sekali)</h2>
			<div class="mt-2 rounded-xl bg-[#0a0f1f] p-3 font-mono text-xs">
				<span class="text-[#64748b]">$</span> npx menglabs-ngoding@latest --help
			</div>
			<p class="mt-2 text-xs text-[#64748b]">
				Tidak perlu install global — pakai npx tiap kali juga bisa. Atau <code
					>npm i -g menglabs-ngoding</code
				>
			</p>
		</div>

		<div class="mt-4 rounded-2xl border border-[#1e293b] bg-[#151c2f]/80 p-5">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-bold">2. Connect ke platform hosted</h2>
				<button
					onclick={() => copy(cmdInit, 'init')}
					class="rounded-full bg-[#1e293b] px-3 py-1 text-xs"
					>{copied === 'init' ? 'Copied ✓' : 'Copy'}</button
				>
			</div>
			<button
				onclick={createToken}
				class="mt-3 rounded-xl bg-[#c45a36] px-4 py-2 text-xs font-semibold"
				>Buat token proyek (berlaku 30 hari)</button
			>
			{#if tokenError}<p class="mt-2 text-xs text-red-300">{tokenError}</p>{/if}
			{#if apiKey}<p class="mt-2 text-xs text-amber-200">
					Salin sekarang. Token hanya ditampilkan pada sesi halaman ini dan dapat dibatasi ke proyek {perencanaanId.slice(
						0,
						8
					)}.
				</p>{/if}
			{#if tokenId}<button
					onclick={() => revokeToken()}
					class="mt-2 rounded-lg border border-red-900 px-3 py-1 text-xs text-red-300"
					>Cabut token ini</button
				>{/if}
			<div class="mt-2 overflow-auto rounded-xl bg-[#0a0f1f] p-3 font-mono text-xs leading-relaxed">
				{cmdInit}
			</div>
			{#if tokens.length}
				<div class="mt-3 space-y-2">
					<p class="text-xs font-semibold text-[#94a3b8]">Token aktif</p>
					{#each tokens as token (token.id)}
						<div
							class="flex items-center gap-2 rounded-lg border border-[#2a3958] bg-[#0f172a] px-3 py-2 text-xs"
						>
							<div class="min-w-0 flex-1">
								<p class="truncate font-medium">{token.name}</p>
								<p class="text-[10px] text-[#64748b]">
									proyek {token.perencanaanId.slice(0, 8)} · kedaluwarsa
									{new Date(token.expiresAt).toLocaleDateString('id-ID')}
								</p>
							</div>
							<button
								onclick={() => revokeToken(token.id)}
								class="rounded-lg border border-red-900 px-2 py-1 text-[11px] text-red-300"
								>Cabut</button
							>
						</div>
					{/each}
				</div>
			{/if}
			<details class="mt-2 text-xs text-[#64748b]">
				<summary class="cursor-pointer">Alternatif pakai env (tanpa file)</summary>
				<pre class="mt-2 rounded bg-[#0a0f1f] p-3">export MENGLABS_API={apiBase ||
						'https://ngoding.menglabs.id'}
export MENGLABS_KEY={apiKey}
export MENGLABS_PERENCANAAN={perencanaanId || '<id>'}</pre>
			</details>
			<button
				onclick={() => copy(cmdInit, 'init2')}
				class="mt-2 text-xs text-[#f97316] hover:underline"
				>Verifikasi: npx menglabs-ngoding config → npx menglabs-ngoding sync</button
			>
		</div>

		<div class="mt-4 rounded-2xl border border-[#1e293b] bg-[#151c2f]/80 p-5">
			<h2 class="text-sm font-bold">3. Lihat tasks (kanban sync)</h2>
			<div class="mt-2 flex gap-2">
				<div class="flex-1 overflow-auto rounded-xl bg-[#0a0f1f] p-3 font-mono text-xs">
					{cmdTasks}
				</div>
				<button onclick={() => copy(cmdTasks, 'tasks')} class="rounded-xl bg-[#1e293b] px-3 text-xs"
					>{copied === 'tasks' ? '✓' : 'Copy'}</button
				>
			</div>
			<div class="mt-2 flex gap-2">
				<div class="flex-1 overflow-auto rounded-xl bg-[#0a0f1f] p-3 font-mono text-xs">
					{cmdClaim} <span class="text-[#64748b]"># claim 1 todo → doing</span>
				</div>
				<button onclick={() => copy(cmdClaim, 'claim')} class="rounded-xl bg-[#1e293b] px-3 text-xs"
					>{copied === 'claim' ? '✓' : 'Copy'}</button
				>
			</div>
			<p class="mt-2 text-xs text-[#64748b]">
				Tasks auto masuk DB via <code>POST /api/plan</code> & <code>POST /api/tasks</code> dengan
				<code>status=todo</code>. Claim atomik <code>POST /api/agent/tasks</code> ubah jadi
				<code>doing</code>.
			</p>
		</div>

		<div class="mt-4 rounded-2xl border border-[#c45a36]/40 bg-[#1e293b]/80 p-5">
			<h2 class="text-sm font-bold">4. Auto kerja — bebas pakai agent CLI kamu</h2>
			<p class="mt-1 text-xs text-[#94a3b8]">
				Poll todo → claim (todo→doing) → jalankan command kamu per task → sukses set done, gagal
				balik todo. Template vars: <code class="rounded bg-[#0a0f1f] px-1">{'{{title}}'}</code>
				<code class="rounded bg-[#0a0f1f] px-1">{'{{description}}'}</code>
				<code class="rounded bg-[#0a0f1f] px-1">{'{{id}}'}</code>
				— env <code>TASK_TITLE/TASK_DESC/TASK_JSON</code> juga diset.
			</p>

			<div class="mt-3 space-y-3">
				<div>
					<p class="text-xs font-semibold text-[#f97316]">Claude Code</p>
					<div class="mt-1 flex gap-2">
						<div class="flex-1 overflow-auto rounded-xl bg-[#0a0f1f] p-3 font-mono text-xs">
							{cmdClaude}
						</div>
						<button
							onclick={() => copy(cmdClaude, 'claude')}
							class="rounded-xl bg-[#1e293b] px-3 text-xs"
							>{copied === 'claude' ? '✓' : 'Copy'}</button
						>
					</div>
				</div>
				<div>
					<p class="text-xs font-semibold text-[#22c55e]">Antigravity</p>
					<div class="mt-1 flex gap-2">
						<div class="flex-1 overflow-auto rounded-xl bg-[#0a0f1f] p-3 font-mono text-xs">
							{cmdAnti}
						</div>
						<button
							onclick={() => copy(cmdAnti, 'anti')}
							class="rounded-xl bg-[#1e293b] px-3 text-xs"
							>{copied === 'anti' ? '✓' : 'Copy'}</button
						>
					</div>
				</div>
				<div>
					<p class="text-xs font-semibold text-[#94a3b8]">Custom / Cursor / Opencode</p>
					<div class="mt-1 flex gap-2">
						<div class="flex-1 overflow-auto rounded-xl bg-[#0a0f1f] p-3 font-mono text-xs">
							{cmdCustom}
						</div>
						<button
							onclick={() => copy(cmdCustom, 'custom')}
							class="rounded-xl bg-[#1e293b] px-3 text-xs"
							>{copied === 'custom' ? '✓' : 'Copy'}</button
						>
					</div>
				</div>
			</div>
			<details class="mt-3 rounded-xl bg-[#0a0f1f] p-3 text-xs">
				<summary class="cursor-pointer font-semibold">Opsi run lengkap</summary>
				<pre class="mt-2 overflow-auto text-[#94a3b8]">npx menglabs-ngoding run --help
  --perencanaan &lt;id&gt;   filter 1 perencanaan (default all)
  --exec "&lt;cmd&gt;"       command template
	  --agent claude|antigravity|cursor|opencode
	  --verify "&lt;cmd&gt;"     command verifikasi opsional
  --poll 4               interval detik
  --once                 hanya 1 task lalu exit
  --dry                  tidak ubah status, hanya print</pre>
			</details>
		</div>

		<div
			class="mt-4 rounded-2xl border border-[#1e293b] bg-[#0f172a] p-4 text-xs leading-relaxed text-[#64748b]"
		>
			<p class="font-semibold text-[#94a3b8]">API langsung (tanpa CLI)</p>
			<pre
				class="mt-2 overflow-auto rounded bg-[#0a0f1f] p-3 font-mono text-[11px]">curl -H "Authorization: Bearer &lt;project-token&gt;" {apiBase}/api/agent/tasks?status=todo | jq
curl -X POST -H "Authorization: Bearer &lt;project-token&gt;" -d '&#123;"perencanaanId":"&lt;id&gt;","claim":true&#125;' {apiBase}/api/agent/tasks
curl -X PATCH -H "Authorization: Bearer &lt;project-token&gt;" -d '&#123;"id":"&lt;taskId&gt;","status":"done","claimToken":"&lt;claim-token&gt;"&#125;' {apiBase}/api/agent/tasks</pre>
		</div>

		<div class="mt-6 flex gap-2">
			<button
				onclick={() => goto(`/kanban${perencanaanId ? `?perencanaanId=${perencanaanId}` : ''}`)}
				class="flex-1 rounded-xl bg-[#c45a36] py-2.5 text-sm font-semibold hover:bg-[#d06a47]"
				>Buka Kanban</button
			>
			<button
				onclick={() => goto('/detail')}
				class="flex-1 rounded-xl border border-[#2a3958] bg-[#1e293b] py-2.5 text-sm"
				>Detail DB</button
			>
		</div>
	</div>
</div>

<style>
	:global(body) {
		background: #0a0f1f;
	}
</style>
