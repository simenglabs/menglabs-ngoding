<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { loadDraft } from '$lib/stores/draft.svelte';

	let loading = $state(true);
	let error = $state('');
	let result = $state<{ id: string; content: string; model: string; usage?: { total_tokens: number } } | null>(null);
	let draft = $state<ReturnType<typeof loadDraft>>(null);

	onMount(async () => {
		draft = loadDraft();
		if (!draft || !draft.prompt) {
			await goto('/');
			return;
		}
		if (!draft.techMode) {
			await goto('/preferensi');
			return;
		}
		// eksekusi LLM sekarang (setelah preferensi + pertanyaan)
		try {
			const res = await fetch('/api/prd', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					prompt: draft.prompt,
					lang: draft.lang,
					referensi: draft.referensi,
					techMode: draft.techMode,
					techStack: draft.techStack,
					questions: draft.questions,
					answers: draft.answers
				})
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.message ?? 'Gagal generate';
				if (data.detail) error += ' — ' + String(data.detail).slice(0, 400);
			} else {
				result = data;
			}
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	});

	async function copy() {
		if (result?.content) await navigator.clipboard.writeText(result.content);
	}
</script>

<svelte:head>
	<title>Hasil PRD — PRD Builder</title>
</svelte:head>

<div class="min-h-screen bg-[#121827] px-4 py-8 text-white">
	<div class="mx-auto max-w-[760px]">
		<button onclick={() => goto('/preferensi')} class="text-xs text-[#64748b] hover:text-white">← Kembali ke preferensi</button>
		<h1 class="mt-3 text-xl font-bold">Generating PRD...</h1>
		{#if draft}
			<p class="mt-1 text-xs text-[#64748b]">Ide: "{draft.prompt.slice(0, 90)}..." · {draft.techMode === 'ai' ? 'AI pilih stack' : `Manual: ${Object.values(draft.techStack).filter(Boolean).join(', ') || 'belum pilih'}`}</p>
		{/if}

		{#if loading}
			<div class="mt-6 flex items-center gap-3 rounded-2xl border border-[#2a3958] bg-[#1a2235] p-6">
				<svg class="h-5 w-5 animate-spin text-[#c45a36]" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
				<span class="text-sm text-[#94a3b8]">AI lagi nyusun PRD via {`antigravity/claude-opus-4-6-thinking`}... (±15-30 detik)</span>
			</div>
		{/if}

		{#if error}
			<div class="mt-6 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
			<button onclick={() => goto('/preferensi')} class="mt-3 rounded-xl bg-[#1e293b] px-4 py-2 text-xs">Coba lagi</button>
		{/if}

		{#if result}
			<div class="mt-6 overflow-hidden rounded-2xl border border-[#252f47] bg-[#0f172a]">
				<div class="flex items-center justify-between border-b border-[#1e293b] px-4 py-3">
					<div class="text-xs font-semibold">✓ PRD siap <span class="font-mono font-normal text-[#64748b]">{result.id.slice(0, 8)} · {result.model} · {result.usage?.total_tokens ?? ''} tokens</span></div>
					<div class="flex gap-2">
						<button onclick={copy} class="rounded-full bg-[#1e293b] px-3 py-1 text-xs hover:bg-[#2a3958]">Copy</button>
						<button onclick={() => goto('/')} class="rounded-full bg-[#c45a36] px-3 py-1 text-xs hover:bg-[#d06a47]">Buat baru</button>
					</div>
				</div>
				<pre class="max-h-[70vh] overflow-auto whitespace-pre-wrap p-5 text-[13px] leading-relaxed text-[#cbd5e1]">{result.content}</pre>
			</div>
		{/if}
	</div>
</div>

<style>
	:global(body) { background: #121827; }
</style>
