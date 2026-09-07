<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let user = $state<{ name: string; email: string } | null>(null);
	let recent = $state<{ id: string; title: string; taskCount: number; createdAt: number }[]>([]);

	onMount(async () => {
		try {
			const r = await fetch('/api/auth/me');
			const d = await r.json();
			user = d.user ?? null;
		} catch {}
		try {
			const r = await fetch('/api/perencanaan');
			const d = await r.json();
			if (Array.isArray(d)) recent = d.slice(0, 3);
		} catch {}
	});
</script>

<svelte:head><title>MengLabs Ngoding — Idea → PRD → Fitur → Task → Kanban Auto</title></svelte:head>

<div class="min-h-screen bg-[#0a0f1f] text-white selection:bg-[#f97316]/30">
	<!-- nav -->
	<nav class="sticky top-0 z-20 border-b border-[#1e293b]/60 bg-[#0a0f1f]/80 backdrop-blur">
		<div class="mx-auto flex max-w-[1160px] items-center justify-between px-4 py-3">
			<div class="flex items-center gap-2">
				<span class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f97316] text-sm font-bold">M</span>
				<span class="text-sm font-bold tracking-tight">Menglabs Ngoding</span>
				<span class="hidden rounded-full bg-[#1e293b] px-2 py-0.5 text-[10px] text-[#64748b] sm:inline">Svelte 5 + Turso</span>
			</div>
			<div class="hidden items-center gap-1 text-xs sm:flex">
				<a href="/create" class="rounded-full px-3 py-1.5 hover:bg-[#1e293b]">Create</a>
				<a href="/perencanaan" class="rounded-full px-3 py-1.5 hover:bg-[#1e293b]">Perencanaan</a>
				<a href="/kanban" class="rounded-full px-3 py-1.5 hover:bg-[#1e293b]">Kanban</a>
				<a href="/implementasi" class="rounded-full border border-[#f97316]/30 px-3 py-1.5 text-[#f97316] hover:bg-[#f97316]/10">Implementasi</a>
			</div>
			<div class="flex items-center gap-2">
				{#if user}
					<a href="/dashboard" class="rounded-full bg-[#1e293b] px-3 py-1.5 text-xs">{user.name}</a>
					<a href="/dashboard" class="hidden rounded-full bg-[#f97316] px-4 py-1.5 text-xs font-semibold text-white sm:inline-flex">Dashboard</a>
				{:else}
					<a href="/login" class="rounded-full px-3 py-1.5 text-xs text-[#94a3b8] hover:text-white">Login</a>
					<a href="/register" class="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-[#0a0f1f] hover:bg-[#f1f5f9]">Daftar</a>
				{/if}
			</div>
		</div>
	</nav>

	<!-- hero -->
	<div class="pointer-events-none absolute inset-x-0 top-[56px] h-[480px]" style="background: radial-gradient(600px 400px at 50% 0%, rgba(249,115,22,0.15), transparent 70%), radial-gradient(500px 300px at 80% 20%, rgba(59,130,246,0.12), transparent 70%)"></div>
	<section class="relative mx-auto max-w-[1160px] px-4 py-10 sm:py-16">
		<div class="mx-auto max-w-[720px] text-center">
			<p class="inline-flex items-center gap-2 rounded-full border border-[#1e293b] bg-[#151c2f] px-3 py-1 text-[11px] text-[#94a3b8]">
				<span class="h-2 w-2 rounded-full bg-emerald-400"></span> Turso libsql://menglabs-ngoding · Svelte 5 + Drizzle
			</p>
			<h1 class="mt-4 text-[30px] font-extrabold leading-[1.05] tracking-tight sm:text-[44px]">
				Ubah ide jadi
				<span class="bg-gradient-to-r from-[#f97316] to-[#f59e0b] bg-clip-text text-transparent">aplikasi siap build</span>
			</h1>
			<p class="mx-auto mt-3 max-w-[560px] text-sm leading-relaxed text-[#94a3b8]">Prompt → pertanyaan klarifikasi → tech stack → perencanaan workflow n8n → breakdown fitur → sub fitur → task otomatis masuk Kanban + DB Turso. Bebas pakai agent CLI kamu.</p>
			<div class="mt-6 flex flex-wrap justify-center gap-2">
				<button onclick={() => goto('/create')} class="rounded-full bg-[#f97316] px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#ea6a0f]">Mulai gratis — Mau bikin apa? →</button>
				<button onclick={() => goto('/dashboard')} class="rounded-full border border-[#2a3958] bg-[#151c2f] px-6 py-2.5 text-sm text-white hover:bg-[#1e293b]">Lihat recent project</button>
			</div>
			<p class="mt-3 text-[11px] text-[#475569]">LLM: antigravity/claude-opus-4-6-thinking via omni.menglabs.id · DB: Turso</p>
		</div>

		<!-- mock preview -->
		<div class="mx-auto mt-10 max-w-[980px] rounded-2xl border border-[#1e293b] bg-[#0f172a] p-3 shadow-2xl shadow-black/40">
			<div class="flex items-center gap-1.5 px-3 py-2">
				<span class="h-3 w-3 rounded-full bg-red-500/80"></span><span class="h-3 w-3 rounded-full bg-yellow-500/80"></span><span class="h-3 w-3 rounded-full bg-green-500/80"></span>
				<span class="ml-3 text-xs text-[#475569]">perencanaan → fitur → sub fitur → kanban</span>
				<span class="ml-auto hidden text-xs text-[#475569] sm:inline">drag nodes · task panel kanan</span>
			</div>
			<div class="grid gap-3 rounded-xl bg-[#0a0f1f] p-3 sm:grid-cols-3">
				<div class="rounded-xl border border-dashed border-[#2a3958] bg-[#151c2f] p-4"><p class="text-[11px] tracking-widest text-[#64748b]">PERENCANAAN</p><p class="mt-2 text-sm font-bold">Aplikasi Absensi Selfie & GPS</p><p class="mt-1 text-xs text-[#94a3b8]">Menggantikan Excel dengan selfie + GPS, notifikasi keterlambatan</p></div>
				<div class="rounded-xl border border-[#f97316] bg-[#1e293b] p-4"><p class="text-[11px] tracking-widest text-[#64748b]">FITUR 1</p><p class="mt-1 text-sm font-bold">Autentikasi & Manajemen Pengguna</p></div>
				<div class="rounded-xl border border-[#334155] bg-[#1e293b]/70 p-4"><p class="text-[11px] tracking-widest text-[#64748b]">SUB FITUR</p><div class="mt-2 space-y-1.5"><div class="rounded-full border bg-[#0f172a] px-3 py-1.5 text-xs">Login & Registrasi Akun →</div><div class="rounded-full bg-[#f97316]/20 px-3 py-1.5 text-xs">Dashboard Role 6 tasks</div></div></div>
			</div>
		</div>
	</section>

	<!-- features -->
	<section class="mx-auto max-w-[1160px] px-4 py-8">
		<div class="grid gap-4 sm:grid-cols-3">
			<div class="rounded-2xl border border-[#1e293b] bg-[#151c2f] p-5"><h3 class="text-sm font-bold">Prompt → Klarifikasi MCQ</h3><p class="mt-1 text-xs leading-relaxed text-[#94a3b8]">LLM analisa ide, generate 5 pertanyaan pilihan ganda biar PRD akurat.</p></div>
			<div class="rounded-2xl border border-[#1e293b] bg-[#151c2f] p-5"><h3 class="text-sm font-bold">Workflow n8n — Geser Card</h3><p class="mt-1 text-xs leading-relaxed text-[#94a3b8]">Perencanaan, fitur, sub fitur terhubung garis bezier. Drag node, garis follow.</p></div>
			<div class="rounded-2xl border border-[#1e293b] bg-[#151c2f] p-5"><h3 class="text-sm font-bold">Task → Kanban + Turso</h3><p class="mt-1 text-xs leading-relaxed text-[#94a3b8]">Klik sub fitur → tasks AI masuk DB `kanban_task` status todo. Agent auto todo→doing→done.</p></div>
		</div>
		<div class="mt-4 grid gap-4 sm:grid-cols-2">
			<div class="rounded-2xl border border-[#1e293b] bg-[#0f172a] p-5"><h3 class="text-sm font-bold">npx menglabs-ngoding — bebas agent</h3><p class="mt-1 font-mono text-xs text-[#94a3b8]">npx menglabs-ngoding run --exec 'claude -p "kerjakan TASK_TITLE"' — sync hosted ↔ local</p><a href="/implementasi" class="mt-2 inline-flex text-xs text-[#f97316] hover:underline">Cara pakai di local →</a></div>
			<div class="rounded-2xl border border-[#1e293b] bg-[#0f172a] p-5"><h3 class="text-sm font-bold">Auth + Recent Projects</h3><p class="mt-1 text-xs text-[#94a3b8]">Login, semua perencanaan user tersimpan di Turso, lihat di Dashboard & Detail DB.</p><div class="mt-2 flex gap-2"><a href="/login" class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#0a0f1f]">Login</a><a href="/register" class="rounded-full border border-[#2a3958] px-3 py-1 text-xs">Daftar</a></div></div>
		</div>
	</section>

	<!-- recent projects -->
	{#if recent.length > 0}
		<section class="mx-auto max-w-[1160px] px-4 py-6">
			<div class="flex items-center justify-between"><h2 class="text-sm font-bold">Recent projects</h2><a href="/dashboard" class="text-xs text-[#f97316] hover:underline">Lihat semua →</a></div>
			<div class="mt-3 grid gap-3 sm:grid-cols-3">
				{#each recent as r}
					<a href={`/detail/${r.id}`} class="rounded-2xl border border-[#1e293b] bg-[#151c2f] p-4 hover:border-[#2a3958]">
						<p class="text-sm font-semibold line-clamp-1">{r.title}</p>
						<p class="mt-1 text-xs text-[#64748b]">{r.taskCount} tasks · {new Date(r.createdAt * 1000).toLocaleDateString('id-ID')}</p>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<footer class="mx-auto max-w-[1160px] px-4 py-8 text-center text-xs text-[#475569]">© MengLabs Ngoding — Svelte 5 · Turso · Drizzle · Tailwind 4 · npx menglabs-ngoding</footer>
</div>

<style>:global(body){background:#0a0f1f}</style>
