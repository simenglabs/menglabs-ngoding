<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let data: { perencanaan: { id: string; title: string; description: string; prompt: string; lang: string; techMode: string; techStackJson: string; createdAt: number }; fiturs: Array<{ id: string; title: string; description: string; subFiturs: Array<{ id: string; title: string; description: string; tasks: Array<{ id: string; title: string; description: string; priority: string; estimate: string; status: string }> }> }>; tasks: Array<{ id: string; title: string; status: string }>; counts: { fitur: number; subFitur: number; tasks: number } } | null = $state(null);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		const id = $page.params.id;
		const res = await fetch(`/api/perencanaan/${id}`);
		if (!res.ok) {
			error = await res.text();
			loading = false;
			return;
		}
		data = await res.json();
		loading = false;
	});

	async function moveTask(id: string, status: string) {
		await fetch(`/api/kanban/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
		// refresh
		const res = await fetch(`/api/perencanaan/${$page.params.id}`);
		data = await res.json();
	}
</script>

<svelte:head><title>Detail Perencanaan</title></svelte:head>

<div class="min-h-screen bg-[#0a0f1f] px-4 py-6 text-white">
	<div class="pointer-events-none fixed inset-0" style="background-image: radial-gradient(circle, rgba(255,255,255,0.14) 1px, transparent 1px); background-size:22px 22px; opacity:0.25"></div>
	<div class="relative mx-auto max-w-[1000px]">
		<button onclick={() => goto('/detail')} class="text-xs text-[#64748b] hover:text-white">← Semua perencanaan</button>
		{#if loading}<p class="mt-6 text-sm text-[#94a3b8]">Loading DB...</p>{/if}
		{#if error}<div class="mt-6 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>{/if}
		{#if data}
			<div class="mt-3 rounded-2xl border border-[#2a3958] bg-[#151c2f]/80 p-5">
				<p class="text-[11px] font-semibold tracking-widest text-[#c45a36]">PERENCANAAN · DB {data.perencanaan.id.slice(0, 8)}</p>
				<h1 class="mt-1 text-xl font-bold">{data.perencanaan.title}</h1>
				<p class="mt-1 text-sm text-[#94a3b8]">{data.perencanaan.description}</p>
				<p class="mt-2 text-xs text-[#475569]">Prompt: "{data.perencanaan.prompt}" · {data.perencanaan.lang} · {data.perencanaan.techMode}</p>
				<div class="mt-3 flex gap-2 text-xs">
					<span class="rounded-full bg-[#1e293b] px-2.5 py-1">{data.counts.fitur} fitur</span>
					<span class="rounded-full bg-[#1e293b] px-2.5 py-1">{data.counts.subFitur} sub fitur</span>
					<span class="rounded-full bg-[#1e293b] px-2.5 py-1">{data.counts.tasks} tasks di kanban_task</span>
					<button onclick={() => goto('/implementasi')} class="ml-auto rounded-full border border-[#f97316]/50 bg-[#f97316]/10 px-3 py-1 text-[#f97316]">⚡ Implementasi</button>
					<button onclick={() => { if (data) goto(`/kanban?perencanaanId=${data.perencanaan.id}`)}} class="rounded-full bg-[#c45a36] px-3 py-1">Kanban</button>
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
										<p class="mt-2 text-[11px] text-amber-300">Belum ada task — klik di Perencanaan untuk generate.</p>
									{:else}
										<div class="mt-2 space-y-1">
											{#each s.tasks as t}
												<div class="flex items-center gap-2 rounded-lg border border-[#2a3958] bg-[#1a2235] px-2 py-1.5">
													<span class="h-1.5 w-1.5 rounded-full {t.priority === 'high' ? 'bg-red-400' : t.priority === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'}"></span>
													<span class="flex-1 truncate text-[11px]">{t.title}</span>
													<select value={t.status} onchange={(e) => moveTask(t.id, (e.target as HTMLSelectElement).value)} class="rounded bg-[#0f172a] px-1 py-0.5 text-[10px]">
														<option value="backlog">backlog</option><option value="todo">todo</option><option value="doing">doing</option><option value="done">done</option>
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

<style>:global(body){background:#0a0f1f}</style>
