<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	type Row = { id: string; title: string; description: string; prompt: string; lang: string; createdAt: number; fiturCount: number; taskCount: number; todoCount: number };

	let rows = $state<Row[]>([]);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		try {
			const res = await fetch('/api/perencanaan');
			if (!res.ok) throw new Error(await res.text());
			rows = await res.json();
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head><title>Detail — DB Perencanaan & Tasks</title></svelte:head>

<div class="min-h-screen bg-[#0a0f1f] px-4 py-8 text-white">
	<div class="pointer-events-none fixed inset-0" style="background-image: radial-gradient(circle, rgba(255,255,255,0.14) 1px, transparent 1px); background-size:22px 22px; opacity:0.25"></div>
	<div class="relative mx-auto max-w-[900px]">
		<div class="flex items-center justify-between">
			<h1 class="text-xl font-bold">Detail DB — Perencanaan → Task</h1>
			<div class="flex gap-2"><button onclick={() => goto('/implementasi')} class="rounded-full border border-[#f97316]/50 bg-[#f97316]/10 px-4 py-1.5 text-xs font-semibold text-[#f97316]">⚡ Implementasi</button><button onclick={() => goto('/kanban')} class="rounded-full bg-[#c45a36] px-4 py-1.5 text-xs">Kanban</button></div>
		</div>
		<p class="mt-1 text-xs text-[#64748b]">Semua yang sudah di-generate LLM dan masuk ke SQLite (<code>local.db</code> per <code>src/lib/server/db/schema.ts:13</code>)</p>

		{#if loading}<p class="mt-8 text-sm text-[#94a3b8]">Loading DB...</p>{/if}
		{#if error}<div class="mt-6 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>{/if}

		{#if !loading && rows.length === 0}
			<div class="mt-8 rounded-2xl border border-dashed border-[#334155] bg-[#1a2235]/60 p-8 text-center text-sm text-[#64748b]">Belum ada perencanaan di DB. Buat baru di <button onclick={() => goto('/')} class="underline text-white">Mau bikin apa?</button></div>
		{/if}

		<div class="mt-6 space-y-3">
			{#each rows as r}
				<button onclick={() => goto(`/detail/${r.id}`)} class="w-full rounded-2xl border border-[#2a3958] bg-[#151c2f]/80 p-4 text-left hover:border-[#334155]">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-sm font-semibold">{r.title}</p>
							<p class="mt-1 line-clamp-2 text-xs text-[#94a3b8]">{r.description}</p>
							<p class="mt-2 line-clamp-1 text-[11px] text-[#475569]">prompt: "{r.prompt.slice(0, 90)}..."</p>
						</div>
						<span class="shrink-0 rounded-full bg-[#0f172a] px-2 py-1 text-[11px] text-[#64748b]">{new Date(r.createdAt * 1000).toLocaleString('id-ID')}</span>
					</div>
					<div class="mt-3 flex gap-2 text-[11px]">
						<span class="rounded-full bg-[#1e293b] px-2.5 py-1">{r.fiturCount} fitur</span>
						<span class="rounded-full bg-[#1e293b] px-2.5 py-1">{r.taskCount} tasks total</span>
						<span class="rounded-full bg-amber-950/40 px-2.5 py-1 text-amber-200">{r.todoCount} todo di Kanban</span>
						<span class="ml-auto text-[#c45a36]">Detail →</span>
					</div>
				</button>
			{/each}
		</div>

		<div class="mt-8 rounded-xl border border-[#1e293b] bg-[#0f172a] p-4 text-[11px] leading-relaxed text-[#64748b]">
			<p class="font-semibold text-[#94a3b8]">Schema DB (persist sampai task)</p>
			<pre class="mt-2 overflow-auto whitespace-pre">perencanaan(id, title, description, prompt, lang, techMode, techStackJson, createdAt)
fitur(id, perencanaanId FK → perencanaan.id, title, orderIdx)
sub_fitur(id, fiturId FK, perencanaanId, title, orderIdx)
kanban_task(id, subFiturId FK, fiturId, perencanaanId, title, description, priority, estimate, status=todo|doing|done)</pre>
			<p class="mt-2">Task generate via <code>POST /api/tasks</code> → <code>insert into kanban_task</code> dengan <code>status='todo'</code> langsung masuk Kanban board (<code>GET /api/kanban?perencanaanId</code>).</p>
		</div>
	</div>
</div>

<style>:global(body){background:#0a0f1f}</style>
