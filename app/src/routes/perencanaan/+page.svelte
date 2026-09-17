<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { loadDraft, saveDraft, type Plan, type SubFitur } from '$lib/stores/draft.svelte';

	let loading = $state(true);
	let diagram = $state(false);
	let error = $state('');
	let plan = $state<Plan | null>(null);
	let taskLoading = $state<string | null>(null);
	let kanbanHint = $state<string | null>(null);
	let activePlanId = $state<string | null>(null);
	let loadedLayoutId: string | null = null;

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
			// 1. cek ?id= atau ?perencanaanId= di URL (deep link setelah deploy)
			const urlId =
				new URLSearchParams(window.location.search).get('id') ||
				new URLSearchParams(window.location.search).get('perencanaanId');
			if (urlId) {
				try {
					const r = await fetch(`/api/perencanaan/${urlId}`);
					if (r.ok) {
						const d = await r.json();
						// map DB -> Plan shape
						plan = {
							perencanaan: { title: d.perencanaan.title, description: d.perencanaan.description },
							fiturs: d.fiturs.map(
								(f: {
									id: string;
									title: string;
									description: string;
									subFiturs: {
										id: string;
										title: string;
										description: string;
										tasks: {
											id: string;
											title: string;
											description: string;
											priority: string;
											estimate: string;
											status: string;
										}[];
									}[];
								}) => ({
									id: f.id,
									title: f.title,
									description: f.description,
									subFiturs: f.subFiturs.map((s) => ({
										id: s.id,
										title: s.title,
										description: s.description,
										tasks: s.tasks
									}))
								})
							)
						} as Plan;
						activePlanId = urlId;
						loading = false;
						await tick();
						queueMicrotask(updateLines);
						return;
					}
					error = r.status === 404 ? 'Perencanaan tidak ditemukan.' : 'Gagal memuat perencanaan.';
				} catch {
					error = 'Gagal memuat perencanaan.';
				}
				loading = false;
				return;
			}

			const d = loadDraft();
			// Draft hanya untuk wizard yang belum pernah disimpan.
			if (d?.plan && !d.dbId) {
				plan = d.plan;
				loading = false;
				await tick();
				queueMicrotask(updateLines);
				return;
			}
			if (d?.dbId) {
				await goto('/dashboard');
				return;
			}
			if (d?.prompt && d?.techMode) {
				// 4. generate baru via LLM -> persist ke Turso
				try {
					const res = await fetch('/api/plan', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							prompt: d.prompt,
							lang: d.lang,
							techMode: d.techMode,
							techStack: d.techStack,
							questions: d.questions,
							answers: d.answers
						})
					});
					const data = await res.json();
					if (!res.ok) error = data.message ?? 'Gagal generate perencanaan';
					else {
						plan = data.plan as Plan;
						activePlanId = data.dbId as string;
						saveDraft({ ...d, plan, dbId: data.dbId as string | undefined });
						if (data.dbId)
							await goto(`/perencanaan?id=${data.dbId}`, { replaceState: true, noScroll: true });
						await tick();
						queueMicrotask(updateLines);
					}
				} catch (e) {
					error = String(e);
				} finally {
					loading = false;
				}
				return;
			}
			// Tanpa ID atau draft, jangan memilih proyek terbaru secara diam-diam.
			await goto('/create');
		})();
		window.addEventListener('resize', updateLines);
		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
		return () => {
			window.removeEventListener('resize', updateLines);
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
		};
	});

	$effect(() => {
		void selected;
		void plan;
		if (plan && !loading) queueMicrotask(updateLines);
	});
	$effect(() => {
		if (!activePlanId || loadedLayoutId === activePlanId) return;
		const raw = sessionStorage.getItem(`plan-layout:${activePlanId}`);
		if (raw) {
			try {
				nodePos = JSON.parse(raw) as typeof nodePos;
			} catch {
				nodePos = {};
			}
		}
		loadedLayoutId = activePlanId;
	});
	$effect(() => {
		if (activePlanId && loadedLayoutId === activePlanId)
			sessionStorage.setItem(`plan-layout:${activePlanId}`, JSON.stringify(nodePos));
	});

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
			if (fl) {
				const x2 = fl.left + fl.width / 2 - cRect.left + el.scrollLeft;
				const y2 = fl.top + fl.height / 2 - cRect.top + el.scrollTop;
				const dx = Math.abs(x2 - px) * 0.5;
				ns.push({ d: `M ${px} ${py} C ${px + dx} ${py}, ${x2 - dx} ${y2}, ${x2} ${y2}` });
			}
			if (fr && sl) {
				const x1 = fr.left + fr.width / 2 - cRect.left + el.scrollLeft;
				const y1 = fr.top + fr.height / 2 - cRect.top + el.scrollTop;
				const x2 = sl.left + sl.width / 2 - cRect.left + el.scrollLeft;
				const y2 = sl.top + sl.height / 2 - cRect.top + el.scrollTop;
				const dx = Math.abs(x2 - x1) * 0.5;
				ns.push({ d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}` });
			}
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
	function moveNodeKey(e: KeyboardEvent, id: string) {
		const delta = e.shiftKey ? 20 : 5;
		const current = nodePos[id] ?? { x: 0, y: 0 };
		if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
		e.preventDefault();
		nodePos[id] = {
			x: current.x + (e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0),
			y: current.y + (e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0)
		};
		updateLines();
	}
	function onMouseMove(e: MouseEvent) {
		if (!dragging) return;
		const dx = e.clientX - dragStart.x;
		const dy = e.clientY - dragStart.y;
		nodePos[dragging] = { x: dragOrig.x + dx, y: dragOrig.y + dy };
		updateLines();
	}
	function onMouseUp() {
		dragging = null;
	}
	function posStyle(id: string) {
		const p = nodePos[id];
		if (!p || (p.x === 0 && p.y === 0)) return '';
		return `transform: translate(${p.x}px, ${p.y}px);`;
	}

	async function selectSub(fiturIdx: number, sub: SubFitur) {
		selected = { fiturIdx, sub };
		// fetch tasks if belum ada -> masuk DB & panel kanan
		if (!sub.tasks || sub.tasks.length === 0) {
			taskLoading = sub.id;
			try {
				const draft = loadDraft();
				const res = await fetch('/api/tasks', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ subFiturId: sub.id })
				});
				const data = await res.json();
				if (res.ok && data.tasks) {
					sub.tasks = (data.tasks as typeof sub.tasks)?.map((t) => ({
						...t,
						status: 'todo' as const,
						subFiturId: sub.id,
						subFiturTitle: sub.title,
						fiturId: plan?.fiturs[fiturIdx]?.id,
						fiturTitle: plan?.fiturs[fiturIdx]?.title
					}));
					if (plan && draft) saveDraft({ ...draft, plan });
					kanbanHint = `${sub.tasks?.length ?? 0} task → Kanban Todo`;
					setTimeout(() => (kanbanHint = null), 3000);
					await tick();
					updateLines();
				} else error = data.message ?? 'Gagal membuat tugas';
			} catch {
				error = 'Tugas belum bisa dibuat. Periksa koneksi lalu coba lagi.';
			} finally {
				taskLoading = null;
			}
		}
	}
</script>

<svelte:head><title>Rencana proyek — mager</title></svelte:head>

<div class="relative min-h-screen bg-[#0a0f1f] text-white selection:bg-[#c45a36]/30">
	<div
		class="pointer-events-none absolute inset-0"
		style="background-image: radial-gradient(circle, rgba(255,255,255,0.16) 1px, transparent 1px); background-size: 22px 22px; opacity:0.28"
	></div>
	<div
		class="relative mx-auto px-4 py-8"
		class:max-w-[1600px]={diagram}
		class:max-w-[1120px]={!diagram}
	>
		<div class="flex items-center justify-between gap-4">
			<div class="flex items-center gap-3">
				<button
					onclick={() => goto('/dashboard')}
					class="rounded-full border border-[#2a3958] bg-[#151c2f] px-3 py-1.5 text-xs text-[#94a3b8] hover:text-white"
					>← Proyek saya</button
				>
				<div>
					<h1 class="text-2xl font-bold tracking-tight">Perencanaan</h1>
					<p class="text-[11px] text-[#64748b]">
						Periksa fitur dan tugas sebelum menjalankannya di komputer.
					</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<button
					onclick={() =>
						goto(`/implementasi${activePlanId ? `?perencanaanId=${activePlanId}` : ''}`)}
					class="hidden rounded-full border border-[#f97316]/50 bg-[#f97316]/10 px-3 py-1.5 text-xs font-semibold text-[#f97316] hover:bg-[#f97316]/20 sm:inline-flex"
					>Jalankan di komputer</button
				>
				<button
					onclick={() => goto(activePlanId ? `/detail/${activePlanId}` : '/dashboard')}
					class="hidden rounded-full border border-[#2a3958] bg-[#151c2f] px-3 py-1.5 text-xs text-[#94a3b8] hover:text-white sm:inline-flex"
					>Detail proyek</button
				>
				<button
					onclick={() => goto(`/kanban${activePlanId ? `?perencanaanId=${activePlanId}` : ''}`)}
					class="inline-flex items-center gap-1.5 rounded-full bg-[#c45a36] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d06a47]"
					>Papan tugas → {plan
						? plan.fiturs.reduce(
								(a: number, f) =>
									a + f.subFiturs.reduce((b: number, s) => b + (s.tasks?.length ?? 0), 0),
								0
							)
						: 0}</button
				>
			</div>
		</div>

		{#if kanbanHint}<div
				class="mt-3 rounded-xl border border-emerald-900/50 bg-emerald-950/50 px-4 py-2.5 text-xs text-emerald-200"
			>
				{kanbanHint}
				<button
					onclick={() => goto(`/kanban${activePlanId ? `?perencanaanId=${activePlanId}` : ''}`)}
					class="ml-2 rounded-full bg-emerald-800 px-3 py-1">Buka Kanban</button
				>
			</div>{/if}
		{#if loading}<div class="mt-20 flex flex-col items-center gap-3">
				<svg class="h-6 w-6 animate-spin text-[#c45a36]" viewBox="0 0 24 24" fill="none"
					><circle
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="3"
						opacity="0.2"
					/><path
						d="M12 2a10 10 0 0 1 10 10"
						stroke="currentColor"
						stroke-width="3"
						stroke-linecap="round"
					/></svg
				>
				<p class="text-sm text-[#94a3b8]">
					Sedang menyusun fitur dan tugas. Tunggu hingga rencana selesai…
				</p>
			</div>{/if}
		{#if error}<div
				class="mt-6 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200"
			>
				{error}
			</div>{/if}

		{#if plan && !loading}
			<div class="action-row">
				<button
					class="secondary-button"
					aria-pressed={!diagram}
					onclick={() => {
						diagram = false;
					}}>Daftar fitur</button
				><button
					class="secondary-button"
					aria-pressed={diagram}
					onclick={async () => {
						diagram = true;
						await tick();
						updateLines();
					}}>Diagram (lanjutan)</button
				>
			</div>
			{#if !diagram}
				<section class="surface mt-6">
					<h2 class="text-2xl font-semibold">{plan.perencanaan.title}</h2>
					<p class="page-intro mt-3">{plan.perencanaan.description}</p>
					<p class="help-text mt-4">
						Mulai dari kerangka frontend dan backend, lalu kerjakan fitur berikutnya. Buka papan
						tugas untuk melihat urutan dan perkembangannya.
					</p>
				</section>
				<div class="mt-6 space-y-4">
					{#each plan.fiturs as fitur, i}
						<section class="surface">
							<p class="eyebrow">Fitur {i + 1}</p>
							<h2 class="mt-2 text-xl font-semibold">{fitur.title}</h2>
							<p class="help-text">{fitur.description}</p>
							{#each fitur.subFiturs as sub}<details class="mt-4 border-t border-slate-700 pt-2">
									<summary
										>{sub.title}
										<span class="text-sm font-normal text-slate-400"
											>· {sub.tasks?.length ?? 0} tugas</span
										></summary
									>
									<p class="help-text">{sub.description}</p>
									{#if sub.tasks?.length}<ol class="mt-4 space-y-4">
											{#each sub.tasks as task}<li class="rounded-lg bg-[#0c1424] p-4">
													<h3 class="text-sm font-semibold">{task.title}</h3>
													<p class="help-text whitespace-pre-line">{task.description}</p>
													<p class="help-text">Perkiraan: {task.estimate}</p>
												</li>{/each}
										</ol>
									{:else}<button
											class="secondary-button mt-3"
											disabled={!!taskLoading}
											onclick={() => selectSub(i, sub)}
											>{taskLoading === sub.id
												? 'Menyiapkan tugas…'
												: 'Buat tugas untuk bagian ini'}</button
										>{/if}
								</details>{/each}
						</section>
					{/each}
				</div>
			{:else}
				<div class="mt-6 flex flex-col gap-4 xl:flex-row">
					<!-- canvas (geser2 card) -->
					<div
						bind:this={canvasEl}
						class="relative flex-1 overflow-auto rounded-2xl border border-[#1e293b] bg-[#0a0f1f]/60 p-6"
						style="min-height: 640px;"
					>
						<svg
							class="pointer-events-none absolute inset-0"
							width={canvasSize.w}
							height={canvasSize.h}
							style="width:100%; height:100%"
						>
							<defs
								><marker
									id="arrow"
									viewBox="0 0 10 10"
									refX="9"
									refY="5"
									markerWidth="6"
									markerHeight="6"
									orient="auto-start-reverse"
									><path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" /></marker
								></defs
							>
							{#each lines as l}<path
									d={l.d}
									fill="none"
									stroke="#cbd5e1"
									stroke-width="1.7"
									stroke-linecap="round"
									opacity="0.95"
									marker-end="url(#arrow)"
								/>{/each}
						</svg>

						<div class="relative grid grid-cols-1 gap-6 lg:grid-cols-[280px_320px_1fr]">
							<!-- PERENCANAAN draggable -->
							<div class="flex items-center lg:min-h-[560px]">
								<div
									style={posStyle('perencanaan')}
									class="relative w-full cursor-grab rounded-xl border-2 border-[#334155] bg-[#1e293b] p-4 shadow-xl select-none active:cursor-grabbing"
								>
									<div
										bind:this={perHandle}
										class="absolute top-1/2 -right-[7px] h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#0a0f1f] bg-white shadow"
									></div>
									<div class="flex items-center gap-2">
										<span
											class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0a0f1f] text-[#f59e0b]"
											>◈</span
										><span class="text-[10px] font-bold tracking-[0.14em] text-[#f59e0b]"
											>PERENCANAAN</span
										><button
											class="ml-auto text-[10px] text-[#64748b]"
											onmousedown={(e) => startDrag(e, 'perencanaan')}
											onkeydown={(e) => moveNodeKey(e, 'perencanaan')}
											aria-label="Geser node perencanaan">drag ⇅</button
										>
									</div>
									<h2 class="mt-3 text-[14px] leading-snug font-bold">{plan.perencanaan.title}</h2>
									<p class="mt-2 text-[12px] leading-relaxed text-[#94a3b8]">
										{plan.perencanaan.description}
									</p>
								</div>
							</div>

							<!-- FITUR draggable each -->
							<div class="space-y-5">
								{#each plan.fiturs as fitur, i}
									<div
										style={posStyle(`fitur-${i}`)}
										class="relative cursor-grab rounded-xl border-2 bg-[#1e293b] p-4 shadow-lg select-none active:cursor-grabbing"
										style:border-color={i === 0
											? '#f97316'
											: i === 1
												? '#22c55e'
												: i === 2
													? '#3b82f6'
													: '#a855f7'}
									>
										<div
											bind:this={fiturLeftH[i]}
											class="absolute top-1/2 -left-[7px] h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#0a0f1f] bg-white"
										></div>
										<div
											bind:this={fiturRightH[i]}
											class="absolute top-1/2 -right-[7px] h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#0a0f1f] bg-white"
										></div>
										<div class="flex items-center gap-2">
											<span
												class="flex h-6 w-6 items-center justify-center rounded-md bg-[#0a0f1f] text-xs"
												>{i === 0 ? '⚡' : i === 1 ? '◉' : i === 2 ? '⬢' : '⬣'}</span
											>
											<span class="text-[10px] font-bold tracking-[0.14em] text-[#94a3b8]"
												>FITUR {i + 1}</span
											>
											<button
												class="ml-auto text-[10px] text-[#64748b]"
												onmousedown={(e) => startDrag(e, `fitur-${i}`)}
												onkeydown={(e) => moveNodeKey(e, `fitur-${i}`)}
												aria-label={`Geser fitur ${fitur.title}`}>drag</button
											>
										</div>
										<h3 class="mt-2 text-[13px] leading-snug font-bold">{fitur.title}</h3>
										<p class="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-[#94a3b8]">
											{fitur.description}
										</p>
									</div>
								{/each}
							</div>

							<!-- SUB FITUR -->
							<div class="space-y-5">
								{#each plan.fiturs as fitur, i}
									<div
										style={posStyle(`sub-${i}`)}
										class="relative cursor-grab rounded-xl border-2 border-[#334155] bg-[#1e293b]/90 p-4 shadow-lg select-none active:cursor-grabbing"
									>
										<div
											bind:this={subLeftH[i]}
											class="absolute top-1/2 -left-[7px] h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#0a0f1f] bg-white"
										></div>
										<div class="flex items-center gap-2">
											<span class="text-[10px] font-bold tracking-[0.14em] text-[#64748b]"
												>SUB FITUR</span
											><button
												class="ml-auto text-[10px] text-[#64748b]"
												onmousedown={(e) => startDrag(e, `sub-${i}`)}
												onkeydown={(e) => moveNodeKey(e, `sub-${i}`)}
												aria-label={`Geser grup sub fitur ${i + 1}`}>drag</button
											>
										</div>
										<div class="mt-3 space-y-2">
											{#each fitur.subFiturs as sub}
												<button
													onclick={() => selectSub(i, sub)}
													class="group flex w-full items-center gap-2.5 rounded-full border px-3.5 py-[9px] text-left transition {selected
														?.sub.id === sub.id
														? 'border-[#f97316] bg-[#2a1a0a] text-white'
														: 'border-[#25324d] bg-[#0f172a]/80 text-[#cbd5e1] hover:border-[#334155]'}"
												>
													<span
														class="h-[6px] w-[6px] shrink-0 rounded-full {taskLoading === sub.id
															? 'animate-pulse bg-amber-400'
															: selected?.sub.id === sub.id
																? 'bg-[#f97316]'
																: 'bg-[#475569]'}"
													></span>
													<span class="min-w-0 flex-1 truncate text-[12px] font-medium"
														>{sub.title}</span
													>
													<span
														class="shrink-0 text-[11px] {sub.tasks && sub.tasks.length > 0
															? 'text-[#94a3b8]'
															: 'text-[#475569]'}"
														>{#if taskLoading === sub.id}...{:else if sub.tasks && sub.tasks.length > 0}{sub
																.tasks.length} tasks{:else}→{/if}</span
													>
												</button>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>

					<!-- RIGHT panel task list (baru, bukan di dalam card) -->
					<div class="w-full shrink-0 xl:w-[380px]">
						{#if selected}
							<div
								class="sticky top-6 rounded-2xl border border-[#2a3958] bg-[#151c2f] p-4 shadow-xl"
							>
								<div class="flex items-start justify-between gap-2">
									<div>
										<p class="text-[10px] font-bold tracking-[0.14em] text-[#f97316]">
											DAFTAR TUGAS
										</p>
										<h3 class="mt-1 text-sm leading-snug font-bold">{selected.sub.title}</h3>
										<p class="mt-1 text-xs text-[#94a3b8]">{selected.sub.description}</p>
										<p class="mt-1 text-[11px] text-[#64748b]">
											{plan.fiturs[selected.fiturIdx].title}
										</p>
									</div>
									<button
										onclick={() => (selected = null)}
										class="rounded-full bg-[#0f172a] px-2 py-1 text-xs text-[#94a3b8] hover:text-white"
										>✕</button
									>
								</div>
								{#if taskLoading === selected.sub.id}
									<p class="mt-4 text-xs text-[#94a3b8]">Menyiapkan tugas…</p>
								{:else if selected.sub.tasks && selected.sub.tasks.length > 0}
									<div class="mt-4 space-y-2">
										{#each selected.sub.tasks as t}
											<div class="rounded-xl border border-[#1e293b] bg-[#0f172a] p-3">
												<div class="flex items-center gap-2">
													<span
														class="h-1.5 w-1.5 rounded-full {t.priority === 'high'
															? 'bg-red-400'
															: t.priority === 'medium'
																? 'bg-amber-400'
																: 'bg-emerald-400'}"
													></span>
													<span class="flex-1 text-xs font-semibold">{t.title}</span>
													<span
														class="rounded-full bg-[#1e293b] px-2 py-0.5 text-[10px] text-[#64748b]"
														>{t.estimate}</span
													>
												</div>
												<p class="mt-1 text-[11px] leading-relaxed text-[#94a3b8]">
													{t.description}
												</p>
												<div class="mt-2 flex gap-1">
													<span
														class="rounded-full bg-[#1e293b] px-2 py-0.5 text-[10px] text-[#94a3b8]"
														>{t.priority}</span
													>
													<span
														class="rounded-full bg-amber-950/40 px-2 py-0.5 text-[10px] text-amber-200"
														>{t.status ?? 'todo'}</span
													>
												</div>
											</div>
										{/each}
									</div>
									<button
										onclick={() =>
											goto(`/kanban${activePlanId ? `?perencanaanId=${activePlanId}` : ''}`)}
										class="mt-4 w-full rounded-xl bg-[#c45a36] py-2.5 text-xs font-semibold hover:bg-[#d06a47]"
										>Lihat semua di Kanban → {selected.sub.tasks.length}</button
									>
								{:else}
									<p class="mt-4 text-xs text-[#64748b]">Belum ada task.</p>
								{/if}
							</div>
						{:else}
							<div
								class="sticky top-6 rounded-2xl border border-dashed border-[#2a3958] bg-[#0a0f1f]/60 p-6 text-center"
							>
								<p class="text-sm font-semibold text-[#94a3b8]">Panel Task</p>
								<p class="mt-1 text-xs text-[#475569]">
									Pilih bagian fitur pada diagram untuk melihat atau membuat tugasnya.
								</p>
								<p class="mt-3 text-[11px] text-[#475569]">
									Gunakan tombol geser untuk mengatur posisi diagram.
								</p>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	:global(body) {
		background: #0a0f1f;
	}
</style>
