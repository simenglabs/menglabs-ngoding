<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
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
	let error = $state('');
	let polling: ReturnType<typeof setTimeout> | null = null;
	let pollDelay = 5000;
	let refreshVersion = 0;
	let destroyed = false;
	const pendingIds = new SvelteSet<string>();
	let generating = $state(false);
	let loading = $state(true);

	const columns = [
		{ id: 'todo', title: 'Siap dikerjakan', icon: '○' },
		{ id: 'doing', title: 'Dikerjakan', icon: '◐' },
		{ id: 'done', title: 'Selesai', icon: '✓' },
		{ id: 'backlog', title: 'Nanti', icon: '◷' }
	] as const;

	type ColId = (typeof columns)[number]['id'];

	onMount(async () => {
		const urlParams = $page.url.searchParams;
		const paramId = urlParams.get('perencanaanId');
		dbId = paramId;

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
				} else error = (await res.json()).message ?? 'Gagal memuat Kanban';
				// fetch title
				const pRes = await fetch(`/api/perencanaan/${dbId}`);
				if (pRes.ok) {
					const pdata = await pRes.json();
					plan = {
						perencanaan: {
							title: pdata.perencanaan.title,
							description: pdata.perencanaan.description
						},
						fiturs: pdata.fiturs
					} as Plan;
				}
			} catch (cause) {
				error = String(cause);
			}
			loading = false;
			schedulePoll();
			document.addEventListener('visibilitychange', onVisibilityChange);
			return;
		}

		// fallback local draft mode
		const d2 = loadDraft();
		if (!d2?.plan || d2.dbId) {
			goto('/dashboard');
			return;
		}
		plan = d2.plan;
		localTasks = flatten(d2.plan);
		loading = false;
	});
	onDestroy(() => {
		destroyed = true;
		if (polling) clearTimeout(polling);
		if (typeof document !== 'undefined')
			document.removeEventListener('visibilitychange', onVisibilityChange);
	});

	function schedulePoll() {
		if (destroyed || !dbId || document.hidden) return;
		if (polling) clearTimeout(polling);
		polling = setTimeout(() => refreshTasks(), pollDelay);
	}

	function onVisibilityChange() {
		if (document.hidden) {
			if (polling) clearTimeout(polling);
			polling = null;
		} else void refreshTasks();
	}

	async function refreshTasks() {
		if (!dbId || document.hidden || destroyed) return;
		const version = ++refreshVersion;
		try {
			const response = await fetch(`/api/kanban?perencanaanId=${dbId}`);
			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message ?? `Gagal refresh Kanban (${response.status})`);
			}
			const rows = await response.json();
			if (version === refreshVersion) {
				dbTasks = rows;
				error = '';
			}
			pollDelay = 5000;
		} catch (cause) {
			if (version === refreshVersion)
				error = cause instanceof Error ? cause.message : String(cause);
			pollDelay = Math.min(pollDelay * 2, 60_000);
		} finally {
			schedulePoll();
		}
	}

	function flatten(p: Plan): Task[] {
		const out: Task[] = [];
		for (const f of p.fiturs)
			for (const s of f.subFiturs)
				for (const t of s.tasks ?? [])
					out.push({
						...t,
						status: (t.status ?? 'todo') as Task['status'],
						fiturId: f.id,
						fiturTitle: f.title,
						subFiturId: s.id,
						subFiturTitle: s.title
					});
		return out;
	}

	async function onDrop(e: DragEvent, col: ColId) {
		e.preventDefault();
		const id = dragId ?? e.dataTransfer?.getData('text/plain');
		if (!id) return;
		await moveTask(id, col);
	}

	async function moveTask(id: string, col: ColId) {
		if (pendingIds.has(id)) return;
		pendingIds.add(id);
		if (isDbMode) {
			try {
				const response = await fetch(`/api/kanban/${id}`, {
					method: 'PATCH',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ status: col })
				});
				if (!response.ok) {
					const data = await response.json().catch(() => ({}));
					throw new Error(data.message ?? 'Gagal memindahkan task');
				}
				const updated = await response.json();
				refreshVersion += 1;
				dbTasks = dbTasks.map((t) => (t.id === id ? { ...t, ...updated } : t));
				error = '';
			} catch (cause) {
				error = cause instanceof Error ? cause.message : String(cause);
			}
		} else {
			localTasks = localTasks.map((t) => (t.id === id ? { ...t, status: col } : t));
			if (plan) {
				const m = new Map(localTasks.map((t) => [t.id, t]));
				for (const f of plan.fiturs)
					for (const s of f.subFiturs)
						if (s.tasks)
							s.tasks = s.tasks.map((t) => ({ ...t, status: m.get(t.id)?.status ?? t.status }));
				const d = loadDraft();
				if (d) saveDraft({ ...d, plan });
			}
		}
		pendingIds.delete(id);
		dragId = null;
	}

	function onDragStart(e: DragEvent, id: string) {
		dragId = id;
		e.dataTransfer?.setData('text/plain', id);
	}
	function allowDrop(e: DragEvent) {
		e.preventDefault();
	}

	const filtered = $derived(
		search.trim()
			? tasks.filter((t) =>
					(t.title + t.description + (t.subFiturTitle ?? ''))
						.toLowerCase()
						.includes(search.toLowerCase())
				)
			: tasks
	);
	function colTasks(col: ColId) {
		return filtered.filter((t) => (t.status ?? 'todo') === col);
	}
	function priorityColor(p: string) {
		return p === 'high' ? 'bg-red-400' : p === 'medium' ? 'bg-amber-400' : 'bg-emerald-400';
	}
	function resultLabel(task: Task) {
		if (task.status !== 'done' || !task.resultJson) return '';
		try {
			const result = JSON.parse(task.resultJson);
			return result.verification?.status === 'passed' ? 'verified' : 'executed · unverified';
		} catch {
			return 'executed';
		}
	}

	async function generateAllMissing() {
		if (!plan || generating) return;
		generating = true;
		error = '';
		try {
			for (const f of plan.fiturs)
				for (const s of f.subFiturs)
					if (!s.tasks || s.tasks.length === 0) {
						const res = await fetch('/api/tasks', {
							method: 'POST',
							headers: { 'content-type': 'application/json' },
							body: JSON.stringify({ subFiturId: s.id })
						});
						const data = await res.json();
						if (!res.ok) throw new Error(data.message ?? 'Gagal generate task');
						if (data.tasks && !isDbMode)
							s.tasks = data.tasks.map((t: Task) => ({ ...t, status: 'todo' as const }));
					}
			if (!isDbMode) {
				localTasks = flatten(plan);
				const draft = loadDraft();
				if (draft) saveDraft({ ...draft, plan });
			} else await refreshTasks();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		} finally {
			generating = false;
		}
	}
</script>

<svelte:head><title>Papan tugas — mager</title></svelte:head>

<div class="min-h-screen bg-[#0a0f1f] text-white">
	<div
		class="pointer-events-none fixed inset-0"
		style="background-image: radial-gradient(circle, rgba(255,255,255,0.16) 1px, transparent 1px); background-size: 22px 22px; opacity:0.28"
	></div>
	<div class="relative mx-auto max-w-[1400px] px-4 py-6">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h1 class="text-xl font-bold">Papan tugas</h1>
				<p class="text-xs text-[#64748b]">
					{plan?.perencanaan.title ?? 'Memuat proyek…'} · {tasks.length} tugas. Status diperbarui otomatis.
					Ubah status lewat pilihan di setiap kartu.
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<button
					onclick={() => goto(`/implementasi${dbId ? `?perencanaanId=${dbId}` : ''}`)}
					class="rounded-full border border-[#f97316]/50 bg-[#f97316]/10 px-3 py-1.5 text-xs font-semibold text-[#f97316] hover:bg-[#f97316]/20"
					>Jalankan di komputer</button
				>
				<input
					bind:value={search}
					aria-label="Cari tugas"
					placeholder="Cari tugas…"
					class="rounded-full border border-[#2a3958] bg-[#0f172a] px-3 py-1.5 text-xs placeholder:text-[#475569] focus:border-[#334155] focus:outline-none"
				/>
				{#if isDbMode}<button
						onclick={() => refreshTasks()}
						class="rounded-full border border-[#2a3958] px-3 py-1.5 text-xs">Muat ulang</button
					>{/if}
			</div>
		</div>
		<details class="mt-4 text-sm">
			<summary>Lengkapi daftar tugas</summary>
			<p class="help-text">Jika ada bagian fitur yang belum punya tugas, buat tugasnya di sini.</p>
			<button
				onclick={generateAllMissing}
				disabled={generating || loading || !plan}
				class="rounded-full bg-[#1a2235] px-3 py-1.5 text-xs hover:bg-[#23324d]"
				>{generating ? 'Menyiapkan tugas…' : 'Lengkapi tugas yang belum dibuat'}</button
			>
		</details>
		{#if error}<p
				role="alert"
				class="mt-3 rounded-xl border border-red-900 bg-red-950/50 p-3 text-xs text-red-200"
			>
				{error}
			</p>{/if}

		{#if loading}<p role="status" class="mt-10 text-slate-300">Memuat papan tugas…</p>
		{:else if tasks.length === 0 && !error}
			<div
				class="mt-12 rounded-2xl border border-dashed border-[#334155] bg-[#1a2235]/60 p-10 text-center"
			>
				<p class="text-sm text-[#94a3b8]">
					Belum ada tugas. Buka rencana lalu buat tugas dari fitur yang ingin dikerjakan.
				</p>
				<button
					onclick={() => goto(`/perencanaan${dbId ? `?id=${dbId}` : ''}`)}
					class="mt-3 rounded-xl bg-[#c45a36] px-5 py-2 text-xs">Ke Perencanaan</button
				>
			</div>
		{:else}
			<div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				{#each columns as col}
					<div
						class="flex min-h-[120px] flex-col rounded-2xl border border-[#2a3958] bg-[#151c2f]/70 md:min-h-[320px]"
						ondragover={allowDrop}
						ondrop={(e) => onDrop(e, col.id)}
						role="region"
						aria-label={col.title}
					>
						<div class="flex items-center justify-between border-b border-[#1e293b] px-3 py-2.5">
							<span class="text-xs font-semibold">{col.icon} {col.title}</span>
							<span class="rounded-full bg-[#0f172a] px-2 py-0.5 text-[11px] text-[#64748b]"
								>{colTasks(col.id).length}</span
							>
						</div>
						<div class="flex-1 space-y-2 p-2">
							{#each colTasks(col.id) as t (t.id)}
								<!-- svelte-ignore a11y_no_static_element_interactions (the adjacent select provides the keyboard equivalent) -->
								<div
									draggable="true"
									ondragstart={(e) => onDragStart(e, t.id)}
									class="cursor-grab rounded-xl border border-[#2a3958] bg-[#0f172a] p-3 active:cursor-grabbing"
								>
									<div class="flex items-start gap-2">
										<span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full {priorityColor(t.priority)}"
										></span>
										<p class="flex-1 text-xs leading-tight font-medium">{t.title}</p>
									</div>
									<details class="mt-2 text-sm">
										<summary class="text-slate-300">Lihat instruksi</summary>
										<p class="help-text whitespace-pre-line">{t.description}</p>
									</details>
									{#if resultLabel(t)}<p class="mt-1 text-[10px] text-emerald-300">
											{resultLabel(t)}
										</p>{/if}
									<div class="mt-2 flex items-center gap-1">
										<span
											class="max-w-[110px] truncate rounded-full bg-[#1e293b] px-2 py-0.5 text-[10px] text-[#94a3b8]"
											>{t.subFiturTitle ??
												{
													high: 'Prioritas tinggi',
													medium: 'Prioritas sedang',
													low: 'Prioritas rendah'
												}[t.priority]}</span
										><span class="ml-auto text-[10px] text-[#475569]">{t.estimate}</span>
									</div>
									<select
										aria-label={`Pindahkan ${t.title}`}
										value={t.status ?? 'todo'}
										disabled={pendingIds.has(t.id)}
										onchange={(event) => moveTask(t.id, event.currentTarget.value as ColId)}
										class="mt-2 w-full rounded-lg border border-[#2a3958] bg-[#151c2f] px-2 py-1 text-[10px]"
									>
										{#each columns as option}<option value={option.id}>{option.title}</option
											>{/each}
									</select>
								</div>
							{:else}
								<p class="py-8 text-center text-xs text-[#475569]">
									{search ? 'Tidak ada tugas yang cocok.' : 'Belum ada tugas di tahap ini.'}
								</p>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		background: #0a0f1f;
	}
</style>
