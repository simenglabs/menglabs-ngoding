<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { loadDraft, saveDraft, type TechStack } from '$lib/stores/draft.svelte';

	let techMode = $state<'ai' | 'manual' | null>(null);
	let stack = $state<TechStack>({ frontend: '', backend: '', database: '', deployment: '' });
	let draftLoaded = $state(false);
	let promptPreview = $state('');

	const frontendOpts = ['SvelteKit + Tailwind', 'Next.js + Tailwind', 'Nuxt 3', 'React SPA (Vite)'];
	const backendOpts = ['SvelteKit Server', 'Node.js + Hono/Express', 'Laravel (PHP)', 'Go + Gin', 'Python FastAPI'];
	const dbOpts = ['PostgreSQL', 'MySQL', 'SQLite + Drizzle', 'MongoDB', 'Supabase'];
	const deployOpts = ['Vercel', 'Cloudflare', 'VPS + Docker', 'Railway', 'Fly.io'];

	onMount(() => {
		const d = loadDraft();
		if (!d || !d.prompt) {
			goto('/');
			return;
		}
		promptPreview = d.prompt.slice(0, 80);
		techMode = d.techMode;
		stack = d.techStack ?? { frontend: '', backend: '', database: '', deployment: '' };
		draftLoaded = true;
	});

	function selectMode(m: 'ai' | 'manual') {
		techMode = m;
	}

	const canLanjut = $derived(techMode !== null);

	async function lanjut() {
		if (!canLanjut) return;
		const d = loadDraft();
		if (!d) return;
		// simpan pilihan tech, lanjut ke clarifying questions (LLM analisa prompt dulu)
		saveDraft({ ...d, techMode, techStack: { ...stack } });
		await goto('/pertanyaan');
	}
</script>

<svelte:head>
	<title>Preferensi teknologi — PRD Builder</title>
</svelte:head>

<div class="min-h-screen bg-[#121827] px-4 py-10 text-white">
	<div class="mx-auto max-w-[680px]">
		<!-- header -->
		<h1 class="text-[28px] font-extrabold tracking-tight">Preferensi teknologi</h1>
		<p class="mt-1 text-[14px] text-[#94a3b8]">Udah punya pilihan tech stack, atau mau AI yang tentuin?</p>
		{#if draftLoaded}
			<p class="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-[#1a2235] px-3 py-1 text-xs text-[#64748b]">
				<span class="h-2 w-2 rounded-full bg-emerald-500"></span>
				<span class="truncate">Ide: "{promptPreview}..."</span>
			</p>
		{/if}

		<!-- two cards -->
		<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
			<button
				onclick={() => selectMode('ai')}
				class="rounded-2xl border-2 bg-[#1e293b]/60 p-5 text-left transition
				{techMode === 'ai' ? 'border-[#c45a36] bg-[#242534]' : 'border-[#2a3958] hover:border-[#334155]'}"
			>
				<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1a2a2b] text-[#c45a36]">
					<!-- AI icon -->
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7" width="18" height="10" rx="3"/><path d="M8 11h.01"/><path d="M12 11h.01"/><path d="M16 11h.01"/><path d="M8 15h8"/></svg>
				</div>
				<p class="mt-3 text-sm font-semibold">Biarkan AI pilih</p>
				<p class="mt-1 text-xs leading-relaxed text-[#94a3b8]">AI rekomendasiin stack yang paling cocok buat project kamu</p>
			</button>

			<button
				onclick={() => selectMode('manual')}
				class="rounded-2xl border-2 bg-[#1e293b]/60 p-5 text-left transition
				{techMode === 'manual' ? 'border-[#c45a36] bg-[#242534]' : 'border-[#2a3958] hover:border-[#334155]'}"
			>
				<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1a2a2b] text-[#c45a36]">
					<!-- hexagon / settings -->
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 4v8l-7 4-7-4V7z"/><circle cx="12" cy="12" r="2.5"/></svg>
				</div>
				<p class="mt-3 text-sm font-semibold">Pilih sendiri</p>
				<p class="mt-1 text-xs leading-relaxed text-[#94a3b8]">Kamu tentuin teknologi yang mau dipakai</p>
			</button>
		</div>

		<!-- layer selects — hanya jika manual -->
		{#if techMode === 'manual'}
			<p class="mt-6 text-xs font-medium text-[#94a3b8]">Pilih teknologi untuk setiap layer</p>
			<div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
				<!-- Frontend -->
				<div class="rounded-2xl border border-[#2a3958] bg-[#1e293b]/50 p-4">
					<div class="flex items-center gap-3">
						<span class="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1e3a5f] text-blue-300">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/></svg>
						</span>
						<div>
							<p class="text-sm font-semibold">Frontend</p>
							<p class="text-xs text-[#94a3b8]">UI & tampilan user</p>
						</div>
					</div>
					<select bind:value={stack.frontend} class="mt-3 w-full rounded-xl border border-[#2a3958] bg-[#0f172a] px-3 py-2.5 text-sm text-white focus:border-[#c45a36] focus:outline-none">
						<option value="">Pilih framework...</option>
						{#each frontendOpts as o}<option value={o}>{o}</option>{/each}
					</select>
				</div>

				<!-- Backend -->
				<div class="rounded-2xl border border-[#2a3958] bg-[#1e293b]/50 p-4">
					<div class="flex items-center gap-3">
						<span class="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0f3a2e] text-emerald-300">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 22a7 7 0 0 0 7-7c0-3.5-3-6-7-11-4 5-7 7.5-7 11a7 7 0 0 0 7 7z"/><path d="M9 13a3 3 0 1 0 6 0 3 3 0 0 0-6 0z"/></svg>
						</span>
						<div>
							<p class="text-sm font-semibold">Backend</p>
							<p class="text-xs text-[#94a3b8]">Logic & API server</p>
						</div>
					</div>
					<select bind:value={stack.backend} class="mt-3 w-full rounded-xl border border-[#2a3958] bg-[#0f172a] px-3 py-2.5 text-sm text-white focus:border-[#c45a36] focus:outline-none">
						<option value="">Pilih backend...</option>
						{#each backendOpts as o}<option value={o}>{o}</option>{/each}
					</select>
				</div>

				<!-- Database -->
				<div class="rounded-2xl border border-[#2a3958] bg-[#1e293b]/50 p-4">
					<div class="flex items-center gap-3">
						<span class="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3a2f0f] text-amber-300">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>
						</span>
						<div>
							<p class="text-sm font-semibold">Database</p>
							<p class="text-xs text-[#94a3b8]">Penyimpanan data</p>
						</div>
					</div>
					<select bind:value={stack.database} class="mt-3 w-full rounded-xl border border-[#2a3958] bg-[#0f172a] px-3 py-2.5 text-sm text-white focus:border-[#c45a36] focus:outline-none">
						<option value="">Pilih database...</option>
						{#each dbOpts as o}<option value={o}>{o}</option>{/each}
					</select>
				</div>

				<!-- Deployment -->
				<div class="rounded-2xl border border-[#2a3958] bg-[#1e293b]/50 p-4">
					<div class="flex items-center gap-3">
						<span class="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2a1f4a] text-purple-300">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4.5 16.5c-1.5 1.3-1.5 3.5 0 5s3.7 1.5 5 0l5-5-5-5z"/><path d="M14 14l6-6a2 2 0 0 0 0-3l-1-1a2 2 0 0 0-3 0z"/><path d="M12 12l-2 2"/></svg>
						</span>
						<div>
							<p class="text-sm font-semibold">Deployment</p>
							<p class="text-xs text-[#94a3b8]">Hosting & infra</p>
						</div>
					</div>
					<select bind:value={stack.deployment} class="mt-3 w-full rounded-xl border border-[#2a3958] bg-[#0f172a] px-3 py-2.5 text-sm text-white focus:border-[#c45a36] focus:outline-none">
						<option value="">Pilih platform...</option>
						{#each deployOpts as o}<option value={o}>{o}</option>{/each}
					</select>
				</div>
			</div>
		{/if}

		<div class="mt-8 flex justify-end">
			<button
				onclick={lanjut}
				disabled={!canLanjut}
				class="rounded-xl bg-[#c45a36] px-7 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#d06a47] disabled:cursor-not-allowed disabled:opacity-40"
			>
				Lanjut
			</button>
		</div>
	</div>
</div>

<style>
	:global(body) { background: #121827; }
</style>
