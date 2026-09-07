<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let user = $state<{ name: string; email: string } | null>(null);
	let rows = $state<{ id: string; title: string; description: string; prompt: string; taskCount: number; fiturCount: number; createdAt: number }[]>([]);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		try {
			const r = await fetch('/api/auth/me');
			const d = await r.json();
			user = d.user ?? null;
		} catch {}
		try {
			const r = await fetch('/api/perencanaan');
			const d = await r.json();
			if (Array.isArray(d)) rows = d;
		} catch (e) { error = String(e); } finally { loading = false; }
	});

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		goto('/login');
	}
</script>

<svelte:head><title>Dashboard — Recent Projects</title></svelte:head>

<div class="min-h-screen bg-[#0a0f1f] text-white">
	<div class="pointer-events-none fixed inset-0" style="background-image: radial-gradient(circle, rgba(255,255,255,0.14) 1px, transparent 1px); background-size:22px 22px; opacity:0.25"></div>
	<nav class="sticky top-0 z-20 border-b border-[#1e293b]/60 bg-[#0a0f1f]/80 backdrop-blur">
		<div class="mx-auto flex max-w-[1160px] items-center justify-between px-4 py-3">
			<a href="/" class="flex items-center gap-2"><span class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f97316] font-bold">M</span><span class="text-sm font-bold">Menglabs Ngoding</span></a>
			<div class="flex items-center gap-2 text-xs">
				<a href="/create" class="rounded-full bg-[#f97316] px-4 py-1.5 font-semibold text-white">+ Buat Project</a>
				<a href="/kanban" class="rounded-full border border-[#2a3958] px-3 py-1.5">Kanban</a>
				<a href="/implementasi" class="rounded-full border border-[#f97316]/30 px-3 py-1.5 text-[#f97316]">Implementasi</a>
				{#if user}
					<span class="hidden rounded-full bg-[#1e293b] px-3 py-1.5 sm:inline">{user.name}</span>
					<button onclick={logout} class="rounded-full px-3 py-1.5 text-[#94a3b8] hover:text-white">Logout</button>
				{:else}
					<a href="/login" class="rounded-full px-3 py-1.5 text-[#94a3b8]">Login</a>
					<a href="/register" class="rounded-full bg-white px-3 py-1.5 font-semibold text-[#0a0f1f]">Daftar</a>
				{/if}
			</div>
		</div>
	</nav>

	<div class="relative mx-auto max-w-[1160px] px-4 py-6">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h1 class="text-xl font-bold">Menu Utama</h1>
				<p class="text-xs text-[#94a3b8]">{user ? `Halo, ${user.name} · ` : ''}Recent projects dari Turso — semua perencanaan → task auto masuk Kanban</p>
			</div>
			<button onclick={() => goto('/create')} class="rounded-full bg-[#f97316] px-5 py-2 text-sm font-semibold hover:bg-[#ea6a0f]">Mau bikin apa? →</button>
		</div>

		<div class="mt-4 grid gap-3 sm:grid-cols-3">
			<div class="rounded-2xl border border-[#1e293b] bg-[#151c2f] p-4"><p class="text-xs text-[#64748b]">Total project</p><p class="text-xl font-bold">{rows.length}</p></div>
			<div class="rounded-2xl border border-[#1e293b] bg-[#151c2f] p-4"><p class="text-xs text-[#64748b]">Total tasks</p><p class="text-xl font-bold">{rows.reduce((a, r) => a + r.taskCount, 0)}</p></div>
			<div class="rounded-2xl border border-[#1e293b] bg-[#151c2f] p-4"><p class="text-xs text-[#64748b]">Turso</p><p class="text-xs font-mono text-[#94a3b8]">libsql://menglabs-ngoding</p></div>
		</div>

		{#if loading}<p class="mt-8 text-sm text-[#94a3b8]">Loading Turso...</p>{/if}
		{#if error}<div class="mt-6 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>{/if}

		{#if !loading && rows.length === 0}
			<div class="mt-8 rounded-2xl border border-dashed border-[#334155] bg-[#1a2235]/60 p-10 text-center">
				<p class="text-sm text-[#94a3b8]">Belum ada project. Mulai dari prompt pertama.</p>
				<button onclick={() => goto('/create')} class="mt-3 rounded-xl bg-[#f97316] px-5 py-2 text-sm font-semibold">Buat project pertama</button>
			</div>
		{/if}

		<div class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each rows as r}
				<div class="group rounded-2xl border border-[#1e293b] bg-[#151c2f] p-4 hover:border-[#2a3958]">
					<p class="line-clamp-1 text-sm font-bold">{r.title}</p>
					<p class="mt-1 line-clamp-2 text-xs text-[#94a3b8]">{r.description}</p>
					<p class="mt-2 line-clamp-1 text-[11px] text-[#475569]">"{r.prompt.slice(0, 70)}..."</p>
					<div class="mt-3 flex gap-1.5 text-[11px]">
						<span class="rounded-full bg-[#0f172a] px-2.5 py-1">{r.fiturCount} fitur</span>
						<span class="rounded-full bg-[#0f172a] px-2.5 py-1">{r.taskCount} tasks</span>
						<span class="rounded-full bg-[#0f172a] px-2 py-1 text-[#475569]">{new Date(r.createdAt * 1000).toLocaleDateString('id-ID')}</span>
					</div>
					<div class="mt-3 flex gap-1.5">
						<button onclick={() => goto(`/detail/${r.id}`)} class="flex-1 rounded-full border border-[#2a3958] py-1.5 text-xs hover:bg-[#1e293b]">Detail</button>
						<button onclick={() => goto(`/kanban?perencanaanId=${r.id}`)} class="flex-1 rounded-full bg-[#f97316] py-1.5 text-xs font-semibold text-white">Kanban</button>
					</div>
					<button onclick={() => goto(`/perencanaan`)} class="mt-1 w-full text-center text-[11px] text-[#64748b] hover:text-white">Buka workflow →</button>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>:global(body){background:#0a0f1f}</style>
