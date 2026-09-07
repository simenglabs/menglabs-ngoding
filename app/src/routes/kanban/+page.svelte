<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { loadDraft, saveDraft, type Plan, type Task } from '$lib/stores/draft.svelte';

	let plan = $state<Plan | null>(null);
	let dbTasks = $state<Task[]>([]);
	let localTasks = $state<Task[]>([]);
	let tasks = $derived(dbTasks.length > 0 ? dbTasks : localTasks);
	let dragId = $state<string | null>(null);
	let search = $state('');
	let dbId = $state<string | null>(null);
	let isDbMode = $derived(!!dbId);

	const columns = [
		{ id: 'backlog', title: 'Backlog', icon: '◷' },
		{ id: 'todo', title: 'Todo', icon: '○' },
		{ id: 'doing', title: 'In Progress', icon: '◐' },
		{ id: 'done', title: 'Done', icon: '✓' }
	] as const;

	type ColId = (typeof columns)[number]['id'];

	onMount(async () => {
		const urlParams = $page.url.searchParams;
		const paramId = urlParams.get('perencanaanId');
		const d = loadDraft();
		dbId = paramId ?? d?.dbId ?? null;

		if (dbId) {
			// DB mode: fetch from SQLite
			try {
				const res = await fetch(`/api/kanban?perencanaanId=${dbId}`);
				if (res.ok) {
					const rows = await res.json();
					dbTasks = rows.map((r: Record<string, unknown>) => ({
						id: r.id as string,
						title: r.title as string,
						description: r.description as string,
						priority: r.priority as Task['priority'],
						estimate: r.estimate as string,
						status: r.status as Task['status'],
						subFiturId: r.subFiturId as string,
						fiturId: r.fiturId as string
					}));
				}
				// fetch title
				const pRes = await fetch(`/api/perencanaan/${dbId}`);
				if (pRes.ok) {
					const pdata = await pRes.json();
					plan = { perencanaan: { title: pdata.perencanaan.title, description: pdata.perencanaan.description }, fiturs: pdata.fiturs } as Plan;
				}
			} catch {}
			if (dbTasks.length > 0) return;
		}

		// fallback local draft mode
		const d2 = loadDraft();
		if (!d2 || !d2.plan) {
			goto('/perencanaan');
			return;
		}
		plan = d2.plan;
		localTasks = flatten(d2.plan);
	});

	function flatten(p: Plan): Task[] {
		const out: Task[] = [];
		for (const f of p.fiturs) for (const s of f.subFiturs) for (const t of s.tasks ?? []) out.push({ ...t, status: (t.status ?? 'todo') as Task['status'], fiturId: f.id, fiturTitle: f.title, subFiturId: s.id, subFiturTitle: s.title });
		return out;
	}

	async function onDrop(e: DragEvent, col: ColId) {
		e.preventDefault();
		const id = dragId ?? e.dataTransfer?.getData('text/plain');
		if (!id) return;
		if (isDbMode) {
			await fetch(`/api/kanban/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: col }) });
			dbTasks = dbTasks.map((t) => (t.id === id ? { ...t, status: col } : t));
		} else {
			localTasks = localTasks.map((t) => (t.id === id ? { ...t, status: col } : t));
			if (plan) {
				const m = new Map(localTasks.map((t) => [t.id, t]));
				for (const f of plan.fiturs) for (const s of f.subFiturs) if (s.tasks) s.tasks = s.tasks.map((t) => ({ ...t, status: m.get(t.id)?.status ?? t.status }));
				const d = loadDraft(); if (d) saveDraft({ ...d, plan });
			}
		}
		dragId = null;
	}

	function onDragStart(e: DragEvent, id: string) {
		dragId = id;
		e.dataTransfer?.setData('text/plain', id);
	}
	function allowDrop(e: DragEvent) { e.preventDefault(); }

	const filtered = $derived(search.trim() ? tasks.filter((t) => (t.title + t.description + (t.subFiturTitle ?? '')).toLowerCase().includes(search.toLowerCase())) : tasks);
	function colTasks(col: ColId) { return filtered.filter((t) => (t.status ?? 'todo') === col); }
	function priorityColor(p: string) { return p === 'high' ? 'bg-red-400' : p === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'; }

	async function generateAllMissing() {
		const d = loadDraft(); if (!d || !plan) return;
		for (const f of plan.fiturs) for (const s of f.subFiturs) if (!s.tasks || s.tasks.length === 0) {
			try {
				const res = await fetch('/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subFiturTitle: s.title, subFiturDesc: s.description, fiturTitle: f.title, perencanaanTitle: plan.perencanaan.title, lang: d.lang, perencanaanId: dbId }) });
				const data = await res.json(); if (data.tasks && isDbMode) dbTasks = [...dbTasks, ...data.tasks.map((t: Task) => ({ ...t, status: 'todo' as const }))];
				else if (data.tasks) { s.tasks = data.tasks.map((t: Task) => ({ ...t, status: 'todo' as const })); }
			} catch {}
		}
		if (!isDbMode) { localTasks = flatten(plan); const dd = loadDraft(); if (dd) saveDraft({ ...dd, plan }); }
		else if (dbId) { const r = await fetch(`/api/kanban?perencanaanId=${dbId}`); if (r.ok) dbTasks = await r.json(); }
	}
</script>

<svelte:head><title>Kanban — Tasks {isDbMode ? '(DB)' : ''}</title></svelte:head>

<div class="min-h-screen bg-[#0a0f1f] text-white">
	<div class="pointer-events-none fixed inset-0" style="background-image: radial-gradient(circle, rgba(255,255,255,0.16) 1px, transparent 1px); background-size: 22px 22px; opacity:0.28"></div>
	<div class="relative mx-auto max-w-[1400px] px-4 py-6">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h1 class="text-xl font-bold">Kanban Board {isDbMode ? '· DB persisted' : ''}</h1>
				<p class="text-xs text-[#64748b]">{plan?.perencanaan.title ?? ''} · {tasks.length} tasks {dbId ? `· ${dbId.slice(0, 8)}` : ''} · drag untuk pindah kolom → DB update via PATCH</p>
			</div>
			<div class="flex items-center gap-2">
				<button onclick={() => goto('/implementasi')} class="rounded-full border border-[#f97316]/50 bg-[#f97316]/10 px-3 py-1.5 text-xs font-semibold text-[#f97316] hover:bg-[#f97316]/20">⚡ Implementasi</button>
				<input bind:value={search} placeholder="Cari task..." class="rounded-full border border-[#2a3958] bg-[#0f172a] px-3 py-1.5 text-xs placeholder:text-[#475569] focus:border-[#334155] focus:outline-none" />
				<button onclick={generateAllMissing} class="rounded-full bg-[#1a2235] px-3 py-1.5 text-xs hover:bg-[#23324d]">Generate semua tasks</button>
				<button onclick={() => goto('/detail')} class="rounded-full border border-[#2a3958] bg-[#1a2235] px-3 py-1.5 text-xs">Detail DB →</button>
				<button onclick={() => goto('/perencanaan')} class="rounded-full border border-[#2a3958] px-3 py-1.5 text-xs">← Perencanaan</button>
			</div>
		</div>

		{#if tasks.length === 0}
			<div class="mt-12 rounded-2xl border border-dashed border-[#334155] bg-[#1a2235]/60 p-10 text-center">
				<p class="text-sm text-[#94a3b8]">Belum ada task di {isDbMode ? 'DB kanban_task' : 'draft'}. Balik ke Perencanaan → klik sub fitur untuk generate, task otomatis INSERT ke DB (status todo).</p>
				<button onclick={() => goto('/perencanaan')} class="mt-3 rounded-xl bg-[#c45a36] px-5 py-2 text-xs">Ke Perencanaan</button>
			</div>
		{:else}
			<div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				{#each columns as col}
					<div class="flex min-h-[420px] flex-col rounded-2xl border border-[#2a3958] bg-[#151c2f]/70" ondragover={allowDrop} ondrop={(e) => onDrop(e, col.id)} role="region" aria-label={col.title}>
						<div class="flex items-center justify-between border-b border-[#1e293b] px-3 py-2.5">
							<span class="text-xs font-semibold">{col.icon} {col.title}</span>
							<span class="rounded-full bg-[#0f172a] px-2 py-0.5 text-[11px] text-[#64748b]">{colTasks(col.id).length}</span>
						</div>
						<div class="flex-1 space-y-2 p-2">
							{#each colTasks(col.id) as t (t.id)}
								<div draggable="true" ondragstart={(e) => onDragStart(e, t.id)} class="cursor-grab rounded-xl border border-[#2a3958] bg-[#0f172a] p-3 active:cursor-grabbing" role="button" tabindex="0">
									<div class="flex items-start gap-2"><span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full {priorityColor(t.priority)}"></span><p class="flex-1 text-xs font-medium leading-tight">{t.title}</p></div>
									<p class="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#94a3b8]">{t.description}</p>
									<div class="mt-2 flex items-center gap-1"><span class="truncate max-w-[110px] rounded-full bg-[#1e293b] px-2 py-0.5 text-[10px] text-[#94a3b8]">{t.subFiturTitle}</span><span class="ml-auto text-[10px] text-[#475569]">{t.estimate}</span></div>
								</div>
							{:else}
								<p class="py-8 text-center text-xs text-[#475569]">Drop task di sini</p>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>:global(body){background:#0a0f1f}</style>
