<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { loadDraft, saveDraft, type Plan, type SubFitur } from '$lib/stores/draft.svelte';

	let loading = $state(true);
	let error = $state('');
	let plan = $state<Plan | null>(null);
	let draftLang = $state('Bahasa Indonesia');
	let taskLoading = $state<string | null>(null);
	let kanbanHint = $state<string | null>(null);

	// selected sub -> right panel
	let selected = $state<{ fiturIdx: number; sub: SubFitur } | null>(null);

	// canvas & n8n lines
	let canvasEl = $state<HTMLElement | null>(null);
	let perHandle = $state<HTMLElement | null>(null);
	let fiturLeftH = $state<(HTMLElement | null)[]>([]);
	let fiturRightH = $state<(HTMLElement | null)[]>([]);
	let subLeftH = $state<(HTMLElement | null)[]>([]);
	let lines = $state<{ d: string }[]>([]);
	let canvasSize = $state({ w: 1200, h: 800 });

	// draggable
	let nodePos = $state<Record<string, { x: number; y: number }>>({});
	let dragging: string | null = $state(null);
	let dragStart = { x: 0, y: 0 };
	let dragOrig = { x: 0, y: 0 };

	onMount(() => {
		(async () => {
			const d = loadDraft();
			if (!d || !d.prompt) { await goto('/'); return; }
			if (!d.techMode) { await goto('/preferensi'); return; }
			draftLang = d.lang;
			if (d.plan) { plan = d.plan; loading = false; await tick(); queueMicrotask(updateLines); }
			else {
				try {
					const res = await fetch('/api/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: d.prompt, lang: d.lang, techMode: d.techMode, techStack: d.techStack, questions: d.questions, answers: d.answers }) });
					const data = await res.json();
					if (!res.ok) error = data.message ?? 'Gagal generate perencanaan';
					else { plan = data.plan as Plan; saveDraft({ ...d, plan, dbId: data.dbId as string | undefined }); await tick(); queueMicrotask(updateLines); }
				} catch (e) { error = String(e); } finally { loading = false; }
			}
		})();
		window.addEventListener('resize', updateLines);
		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
		return () => { window.removeEventListener('resize', updateLines); window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
	});

	$effect(() => { void selected; void plan; if (plan && !loading) queueMicrotask(updateLines); });

	function updateLines() {
		if (!canvasEl || !perHandle || !plan) return;
		const el = canvasEl as HTMLElement;
		const cRect = el.getBoundingClientRect();
		canvasSize = { w: el.scrollWidth, h: el.scrollHeight };
		const ns: { d: string }[] = [];
		const perRect = perHandle.getBoundingClientRect();
		const px = perRect.left + perRect.width / 2 - cRect.left + el.scrollLeft;
		const py = perRect.top + perRect.height / 2 - cRect.top + el.scrollTop;
		plan.fiturs.forEach((_, i) => {
			const fl = fiturLeftH[i]?.getBoundingClientRect();
			const fr = fiturRightH[i]?.getBoundingClientRect();
			const sl = subLeftH[i]?.getBoundingClientRect();
			if (fl) { const x2 = fl.left + fl.width / 2 - cRect.left + el.scrollLeft; const y2 = fl.top + fl.height / 2 - cRect.top + el.scrollTop; const dx = Math.abs(x2 - px) * 0.5; ns.push({ d: `M ${px} ${py} C ${px + dx} ${py}, ${x2 - dx} ${y2}, ${x2} ${y2}` }); }
			if (fr && sl) { const x1 = fr.left + fr.width / 2 - cRect.left + el.scrollLeft; const y1 = fr.top + fr.height / 2 - cRect.top + el.scrollTop; const x2 = sl.left + sl.width / 2 - cRect.left + el.scrollLeft; const y2 = sl.top + sl.height / 2 - cRect.top + el.scrollTop; const dx = Math.abs(x2 - x1) * 0.5; ns.push({ d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}` }); }
		});
		lines = ns;
	}

	// drag handlers
	function startDrag(e: MouseEvent, id: string) {
		dragging = id;
		dragStart = { x: e.clientX, y: e.clientY };
		dragOrig = { ...(nodePos[id] ?? { x: 0, y: 0 }) };
		e.preventDefault();
	}
	function onMouseMove(e: MouseEvent) {
		if (!dragging) return;
		const dx = e.clientX - dragStart.x;
		const dy = e.clientY - dragStart.y;
		nodePos[dragging] = { x: dragOrig.x + dx, y: dragOrig.y + dy };
		updateLines();
	}
	function onMouseUp() { dragging = null; }
	function posStyle(id: string) {
		const p = nodePos[id]; if (!p || (p.x === 0 && p.y === 0)) return ''; return `transform: translate(${p.x}px, ${p.y}px);`;
	}

	async function selectSub(fiturIdx: number, sub: SubFitur) {
		selected = { fiturIdx, sub };
		// fetch tasks if belum ada -> masuk DB & panel kanan
		if (!sub.tasks || sub.tasks.length === 0) {
			taskLoading = sub.id;
			try {
				const draft = loadDraft();
				const res = await fetch('/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subFiturTitle: sub.title, subFiturDesc: sub.description, fiturTitle: plan?.fiturs[fiturIdx]?.title, perencanaanTitle: plan?.perencanaan.title, lang: draftLang, perencanaanId: draft?.dbId }) });
				const data = await res.json();
				if (res.ok && data.tasks) {
					sub.tasks = (data.tasks as typeof sub.tasks)?.map((t) => ({ ...t, status: 'todo' as const, subFiturId: sub.id, subFiturTitle: sub.title, fiturId: plan?.fiturs[fiturIdx]?.id, fiturTitle: plan?.fiturs[fiturIdx]?.title }));
					if (plan && draft) saveDraft({ ...draft, plan });
					kanbanHint = `${sub.tasks?.length ?? 0} task → Kanban Todo`;
					setTimeout(() => (kanbanHint = null), 3000);
					await tick(); updateLines();
				}
			} finally { taskLoading = null; }
		}
	}
</script>

<svelte:head><title>Perencanaan — workflow n8n + panel kanan</title></svelte:head>

<div class="relative min-h-screen bg-[#0a0f1f] text-white selection:bg-[#c45a36]/30">
	<div class="pointer-events-none absolute inset-0" style="background-image: radial-gradient(circle, rgba(255,255,255,0.16) 1px, transparent 1px); background-size: 22px 22px; opacity:0.28"></div>
	<div class="relative mx-auto max-w-[1600px] px-4 py-4">
		<div class="flex items-center justify-between gap-4">
			<div class="flex items-center gap-3">
				<button onclick={() => goto('/pertanyaan')} class="rounded-full border border-[#2a3958] bg-[#151c2f] px-3 py-1.5 text-xs text-[#94a3b8] hover:text-white">← Pertanyaan</button>
				<div>
					<h1 class="text-[17px] font-bold tracking-tight">Perencanaan</h1>
					<p class="text-[11px] text-[#64748b]">Geser card untuk atur workflow · Klik sub fitur → task muncul di panel kanan</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<button onclick={() => goto('/implementasi')} class="hidden rounded-full border border-[#f97316]/50 bg-[#f97316]/10 px-3 py-1.5 text-xs font-semibold text-[#f97316] hover:bg-[#f97316]/20 sm:inline-flex">⚡ Implementasi</button>
				<button onclick={() => goto('/detail')} class="hidden rounded-full border border-[#2a3958] bg-[#151c2f] px-3 py-1.5 text-xs text-[#94a3b8] hover:text-white sm:inline-flex">Detail DB</button>
				<button onclick={() => goto('/kanban')} class="inline-flex items-center gap-1.5 rounded-full bg-[#c45a36] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d06a47]">Kanban → {plan ? plan.fiturs.reduce((a: number, f) => a + f.subFiturs.reduce((b: number, s) => b + (s.tasks?.length ?? 0), 0), 0) : 0}</button>
			</div>
		</div>

		{#if kanbanHint}<div class="mt-3 rounded-xl border border-emerald-900/50 bg-emerald-950/50 px-4 py-2.5 text-xs text-emerald-200">{kanbanHint} <button onclick={() => goto('/kanban')} class="ml-2 rounded-full bg-emerald-800 px-3 py-1">Buka Kanban</button></div>{/if}
		{#if loading}<div class="mt-20 flex flex-col items-center gap-3"><svg class="h-6 w-6 animate-spin text-[#c45a36]" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg><p class="text-sm text-[#94a3b8]">AI nyusun workflow...</p></div>{/if}
		{#if error}<div class="mt-6 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>{/if}

		{#if plan && !loading}
			<div class="mt-6 flex gap-4">
				<!-- canvas (geser2 card) -->
				<div bind:this={canvasEl} class="relative flex-1 overflow-auto rounded-2xl border border-[#1e293b] bg-[#0a0f1f]/60 p-6" style="min-height: 640px;">
					<svg class="pointer-events-none absolute inset-0" width={canvasSize.w} height={canvasSize.h} style="width:100%; height:100%">
						<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1"/></marker></defs>
						{#each lines as l}<path d={l.d} fill="none" stroke="#cbd5e1" stroke-width="1.7" stroke-linecap="round" opacity="0.95" marker-end="url(#arrow)"/>{/each}
					</svg>

					<div class="relative grid grid-cols-1 gap-6 lg:grid-cols-[280px_320px_1fr]">
						<!-- PERENCANAAN draggable -->
						<div class="flex items-center lg:min-h-[560px]">
							<div
								onmousedown={(e) => startDrag(e, 'perencanaan')}
								style={posStyle('perencanaan')}
								class="relative w-full cursor-grab rounded-xl border-2 border-[#334155] bg-[#1e293b] p-4 shadow-xl active:cursor-grabbing select-none"
							>
								<div bind:this={perHandle} class="absolute -right-[7px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#0a0f1f] bg-white shadow"></div>
								<div class="flex items-center gap-2"><span class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0a0f1f] text-[#f59e0b]">◈</span><span class="text-[10px] font-bold tracking-[0.14em] text-[#f59e0b]">PERENCANAAN</span><span class="ml-auto text-[10px] text-[#64748b]">drag ⇅</span></div>
								<h2 class="mt-3 text-[14px] font-bold leading-snug">{plan.perencanaan.title}</h2>
								<p class="mt-2 text-[12px] leading-relaxed text-[#94a3b8]">{plan.perencanaan.description}</p>
							</div>
						</div>

						<!-- FITUR draggable each -->
						<div class="space-y-5">
							{#each plan.fiturs as fitur, i}
								<div
									onmousedown={(e) => startDrag(e, `fitur-${i}`)}
									style={posStyle(`fitur-${i}`)}
									class="relative cursor-grab rounded-xl border-2 bg-[#1e293b] p-4 shadow-lg active:cursor-grabbing select-none"
									style:border-color={i===0?'#f97316':i===1?'#22c55e':i===2?'#3b82f6':'#a855f7'}
								>
									<div bind:this={fiturLeftH[i]} class="absolute -left-[7px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#0a0f1f] bg-white"></div>
									<div bind:this={fiturRightH[i]} class="absolute -right-[7px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#0a0f1f] bg-white"></div>
									<div class="flex items-center gap-2">
										<span class="flex h-6 w-6 items-center justify-center rounded-md bg-[#0a0f1f] text-xs">{i===0?'⚡':i===1?'◉':i===2?'⬢':'⬣'}</span>
										<span class="text-[10px] font-bold tracking-[0.14em] text-[#94a3b8]">FITUR {i+1}</span>
										<span class="ml-auto text-[10px] text-[#64748b]">drag</span>
									</div>
									<h3 class="mt-2 text-[13px] font-bold leading-snug">{fitur.title}</h3>
									<p class="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-[#94a3b8]">{fitur.description}</p>
								</div>
							{/each}
						</div>

						<!-- SUB FITUR -->
						<div class="space-y-5">
							{#each plan.fiturs as fitur, i}
								<div
									onmousedown={(e) => startDrag(e, `sub-${i}`)}
									style={posStyle(`sub-${i}`)}
									class="relative cursor-grab rounded-xl border-2 border-[#334155] bg-[#1e293b]/90 p-4 shadow-lg active:cursor-grabbing select-none"
								>
									<div bind:this={subLeftH[i]} class="absolute -left-[7px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#0a0f1f] bg-white"></div>
									<div class="flex items-center gap-2"><span class="text-[10px] font-bold tracking-[0.14em] text-[#64748b]">SUB FITUR</span><span class="ml-auto text-[10px] text-[#64748b]">drag</span></div>
									<div class="mt-3 space-y-2">
										{#each fitur.subFiturs as sub}
											<button
												onclick={() => selectSub(i, sub)}
												class="group flex w-full items-center gap-2.5 rounded-full border px-3.5 py-[9px] text-left transition {selected?.sub.id===sub.id ? 'border-[#f97316] bg-[#2a1a0a] text-white' : 'border-[#25324d] bg-[#0f172a]/80 text-[#cbd5e1] hover:border-[#334155]'}"
											>
												<span class="h-[6px] w-[6px] shrink-0 rounded-full {taskLoading===sub.id ? 'bg-amber-400 animate-pulse' : selected?.sub.id===sub.id ? 'bg-[#f97316]' : 'bg-[#475569]'}"></span>
												<span class="min-w-0 flex-1 truncate text-[12px] font-medium">{sub.title}</span>
												<span class="shrink-0 text-[11px] {sub.tasks && sub.tasks.length>0 ? 'text-[#94a3b8]' : 'text-[#475569]'}">{#if taskLoading===sub.id}...{:else if sub.tasks && sub.tasks.length>0}{sub.tasks.length} tasks{:else}→{/if}</span>
											</button>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<!-- RIGHT panel task list (baru, bukan di dalam card) -->
				<div class="w-[380px] shrink-0">
					{#if selected}
						<div class="sticky top-6 rounded-2xl border border-[#2a3958] bg-[#151c2f] p-4 shadow-xl">
							<div class="flex items-start justify-between gap-2">
								<div>
									<p class="text-[10px] font-bold tracking-[0.14em] text-[#f97316]">TASK LIST</p>
									<h3 class="mt-1 text-sm font-bold leading-snug">{selected.sub.title}</h3>
									<p class="mt-1 text-xs text-[#94a3b8]">{selected.sub.description}</p>
									<p class="mt-1 text-[11px] text-[#64748b]">{plan.fiturs[selected.fiturIdx].title}</p>
								</div>
								<button onclick={() => (selected = null)} class="rounded-full bg-[#0f172a] px-2 py-1 text-xs text-[#94a3b8] hover:text-white">✕</button>
							</div>
							{#if taskLoading===selected.sub.id}
								<p class="mt-4 text-xs text-[#94a3b8]">Generate tasks...</p>
							{:else if selected.sub.tasks && selected.sub.tasks.length>0}
								<div class="mt-4 space-y-2">
									{#each selected.sub.tasks as t}
										<div class="rounded-xl border border-[#1e293b] bg-[#0f172a] p-3">
											<div class="flex items-center gap-2">
												<span class="h-1.5 w-1.5 rounded-full {t.priority==='high'?'bg-red-400':t.priority==='medium'?'bg-amber-400':'bg-emerald-400'}"></span>
												<span class="flex-1 text-xs font-semibold">{t.title}</span>
												<span class="rounded-full bg-[#1e293b] px-2 py-0.5 text-[10px] text-[#64748b]">{t.estimate}</span>
											</div>
											<p class="mt-1 text-[11px] leading-relaxed text-[#94a3b8]">{t.description}</p>
											<div class="mt-2 flex gap-1">
												<span class="rounded-full bg-[#1e293b] px-2 py-0.5 text-[10px] text-[#94a3b8]">{t.priority}</span>
												<span class="rounded-full bg-amber-950/40 px-2 py-0.5 text-[10px] text-amber-200">{t.status ?? 'todo'}</span>
											</div>
										</div>
									{/each}
								</div>
								<button onclick={() => goto('/kanban')} class="mt-4 w-full rounded-xl bg-[#c45a36] py-2.5 text-xs font-semibold hover:bg-[#d06a47]">Lihat semua di Kanban → {selected.sub.tasks.length}</button>
							{:else}
								<p class="mt-4 text-xs text-[#64748b]">Belum ada task.</p>
							{/if}
						</div>
					{:else}
						<div class="sticky top-6 rounded-2xl border border-dashed border-[#2a3958] bg-[#0a0f1f]/60 p-6 text-center">
							<p class="text-sm font-semibold text-[#94a3b8]">Panel Task</p>
							<p class="mt-1 text-xs text-[#475569]">Klik salah satu sub fitur di canvas → list task muncul di sini (bukan di dalam card), langsung INSERT ke DB.</p>
							<p class="mt-3 text-[11px] text-[#475569]">Geser card dengan drag handle untuk atur workflow seperti n8n.</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>:global(body){background:#0a0f1f}</style>
