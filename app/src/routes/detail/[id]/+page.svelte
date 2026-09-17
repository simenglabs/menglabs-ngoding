<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let data: {
		perencanaan: {
			id: string;
			title: string;
			description: string;
			prompt: string;
			lang: string;
			techMode: string;
			techStackJson: string;
			createdAt: number;
		};
		fiturs: Array<{
			id: string;
			title: string;
			description: string;
			subFiturs: Array<{
				id: string;
				title: string;
				description: string;
				tasks: Array<{
					id: string;
					title: string;
					description: string;
					priority: string;
					estimate: string;
					status: string;
					resultJson?: string | null;
				}>;
			}>;
		}>;
		tasks: Array<{ id: string; title: string; status: string }>;
		counts: { fitur: number; subFitur: number; tasks: number };
	} | null = $state(null);
	let loading = $state(true);
	let error = $state('');
	let pendingTaskId = $state<string | null>(null);

	onMount(() => {
		void load();
	});
	async function load() {
		loading = true;
		error = '';
		try {
			const response = await fetch(`/api/perencanaan/${$page.params.id}`);
			if (!response.ok)
				throw new Error(
					response.status === 404
						? 'Proyek tidak ditemukan.'
						: 'Detail proyek belum bisa dimuat. Coba lagi.'
				);
			data = await response.json();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Periksa koneksi lalu coba lagi.';
		} finally {
			loading = false;
		}
	}

	async function moveTask(id: string, status: string) {
		if (pendingTaskId) return;
		pendingTaskId = id;
		error = '';
		try {
			const update = await fetch(`/api/kanban/${id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ status })
			});
			if (!update.ok) {
				const body = await update.json().catch(() => ({}));
				throw new Error(body.message ?? 'Gagal mengubah status task');
			}
			const res = await fetch(`/api/perencanaan/${$page.params.id}`);
			if (!res.ok) throw new Error('Status tersimpan tetapi refresh gagal');
			data = await res.json();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		} finally {
			pendingTaskId = null;
		}
	}

	function resultLabel(resultJson?: string | null) {
		if (!resultJson) return '';
		try {
			const result = JSON.parse(resultJson);
			return result.verification?.status === 'passed'
				? 'Lulus pemeriksaan'
				: 'Dijalankan, belum diperiksa';
		} catch {
			return 'Sudah dijalankan';
		}
	}
</script>

<svelte:head><title>Detail Perencanaan</title></svelte:head>

<div class="min-h-screen bg-[#0a0f1f] px-4 py-6 text-white">
	<div
		class="pointer-events-none fixed inset-0"
		style="background-image: radial-gradient(circle, rgba(255,255,255,0.14) 1px, transparent 1px); background-size:22px 22px; opacity:0.25"
	></div>
	<div class="relative mx-auto max-w-[1000px]">
		<button onclick={() => goto('/detail')} class="text-xs text-[#64748b] hover:text-white"
			>← Semua perencanaan</button
		>
		{#if loading}<p class="mt-6 text-sm text-[#94a3b8]">Memuat detail proyek…</p>{/if}
		{#if error}<div
				class="mt-6 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200"
			>
				{error}<button class="secondary-button mt-3" onclick={load}>Coba lagi</button>
			</div>{/if}
		{#if data}
			<div class="mt-3 rounded-2xl border border-[#2a3958] bg-[#151c2f]/80 p-5">
				<p class="text-[11px] font-semibold tracking-widest text-[#c45a36]">RENCANA PROYEK</p>
				<h1 class="mt-1 text-xl font-bold">{data.perencanaan.title}</h1>
				<p class="mt-1 text-sm text-[#94a3b8]">{data.perencanaan.description}</p>
				<p class="mt-2 text-xs text-[#475569]">
					Prompt: "{data.perencanaan.prompt}" · {data.perencanaan.lang} · {data.perencanaan
						.techMode}
				</p>
				<div class="mt-3 flex flex-wrap gap-2 text-xs">
					<span class="rounded-full bg-[#1e293b] px-2.5 py-1">{data.counts.fitur} fitur</span>
					<span class="rounded-full bg-[#1e293b] px-2.5 py-1">{data.counts.subFitur} sub fitur</span
					>
					<span class="rounded-full bg-[#1e293b] px-2.5 py-1">{data.counts.tasks} tugas</span>
					<button
						onclick={() => data && goto(`/implementasi?perencanaanId=${data.perencanaan.id}`)}
						class="ml-auto rounded-full border border-[#f97316]/50 bg-[#f97316]/10 px-3 py-1 text-[#f97316]"
						>Jalankan di komputer</button
					>
					<button
						onclick={() => {
							if (data) goto(`/kanban?perencanaanId=${data.perencanaan.id}`);
						}}
						class="rounded-full bg-[#c45a36] px-3 py-1">Kanban</button
					>
				</div>
			</div>

			<div class="mt-6 space-y-6">
				{#each data.fiturs as f}
					<div class="rounded-2xl border border-[#2a3958] bg-[#151c2f]/60 p-4">
						<p class="text-[11px] font-semibold tracking-widest text-[#64748b]">FITUR</p>
						<p class="text-sm font-semibold">{f.title}</p>
						<p class="text-xs text-[#94a3b8]">{f.description}</p>
						<div class="mt-3 grid gap-3 md:grid-cols-2">
							{#each f.subFiturs as s}
								<div class="rounded-xl border border-[#1e293b] bg-[#0f172a] p-3">
									<p class="text-[11px] font-semibold tracking-widest text-[#64748b]">SUB FITUR</p>
									<p class="text-xs font-semibold">{s.title}</p>
									<p class="text-[11px] text-[#64748b]">{s.description}</p>
									{#if s.tasks.length === 0}
										<p class="mt-2 text-[11px] text-amber-300">
											Belum ada tugas. Buka rencana untuk membuatnya.
										</p>
									{:else}
										<div class="mt-2 space-y-1">
											{#each s.tasks as t}
												<div
													class="flex items-center gap-2 rounded-lg border border-[#2a3958] bg-[#1a2235] px-2 py-1.5"
												>
													<span
														class="h-1.5 w-1.5 rounded-full {t.priority === 'high'
															? 'bg-red-400'
															: t.priority === 'medium'
																? 'bg-amber-400'
																: 'bg-emerald-400'}"
													></span>
													<span class="min-w-0 flex-1 text-sm">{t.title}</span>
													{#if resultLabel(t.resultJson)}<span class="text-[9px] text-emerald-300"
															>{resultLabel(t.resultJson)}</span
														>{/if}
													<select
														aria-label={`Status tugas ${t.title}`}
														value={t.status}
														disabled={pendingTaskId === t.id}
														onchange={(e) => moveTask(t.id, (e.target as HTMLSelectElement).value)}
														class="rounded bg-[#0f172a] px-1 py-0.5 text-[10px]"
													>
														<option value="backlog">Nanti</option><option value="todo">todo</option
														><option value="doing">Dikerjakan</option><option value="done"
															>Selesai</option
														>
													</select>
												</div>
											{/each}
										</div>
									{/if}
								</div>
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
