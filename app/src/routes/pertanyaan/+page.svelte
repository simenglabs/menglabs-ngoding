<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { loadDraft, saveDraft, type Question } from '$lib/stores/draft.svelte';

	let loading = $state(true);
	let error = $state('');
	let questions = $state<Question[]>([]);
	let answers = $state<Record<number, string | string[]>>({});
	let customInputs = $state<Record<number, string>>({});
	let draftPrompt = $state('');

	// derived answered count (lewati tidak hitung)
	let answered = $derived(
		questions.filter((q) => {
			const v = answers[q.id];
			if (Array.isArray(v)) return v.length > 0;
			return typeof v === 'string' && v.trim().length > 0;
		}).length
	);

	onMount(async () => {
		const d = loadDraft();
		if (!d || !d.prompt) {
			await goto('/');
			return;
		}
		if (!d.techMode) {
			await goto('/preferensi');
			return;
		}
		draftPrompt = d.prompt.slice(0, 80);

		// jika sudah punya questions di draft, reuse
		if (d.questions && d.questions.length > 0) {
			questions = d.questions;
			answers = (d.answers as typeof answers) ?? {};
			loading = false;
			return;
		}

		try {
			const res = await fetch('/api/questions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ prompt: d.prompt, lang: d.lang, techMode: d.techMode, techStack: d.techStack })
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.message ?? 'Gagal generate pertanyaan';
			} else {
				questions = data.questions as Question[];
				// simpan ke draft agar tidak regenerate
				saveDraft({ ...d, questions, answers: {} });
			}
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	});

	function toggleOption(q: Question, opt: string) {
		const cur = answers[q.id];
		const arr = Array.isArray(cur) ? [...cur] : [];
		if (q.type === 'single') {
			answers[q.id] = [opt];
		} else {
			if (arr.includes(opt)) {
				answers[q.id] = arr.filter((x) => x !== opt);
			} else {
				// batasi 3 untuk multi jika ada hint "Pilih 3" — tapi allow lebih
				answers[q.id] = [...arr, opt];
			}
		}
	}

	function isSelected(q: Question, opt: string) {
		const v = answers[q.id];
		return Array.isArray(v) && v.includes(opt);
	}

	function skip(q: Question) {
		delete answers[q.id];
		// trigger reactivity
		answers = { ...answers };
	}

	function addCustom(q: Question) {
		const val = (customInputs[q.id] ?? '').trim();
		if (!val) return;
		toggleOption(q, val);
		customInputs[q.id] = '';
	}

	async function lanjut() {
		const d = loadDraft();
		if (!d) return;
		saveDraft({ ...d, questions, answers });
		await goto('/perencanaan');
	}
</script>

<svelte:head>
	<title>Beberapa pertanyaan — PRD Builder</title>
</svelte:head>

<div class="min-h-screen bg-[#121827] px-4 py-10 text-white">
	<div class="mx-auto max-w-[720px]">
		<h1 class="text-[28px] font-extrabold tracking-tight">Beberapa pertanyaan</h1>
		<div class="mt-1 flex items-center justify-between">
			<p class="text-[14px] text-[#94a3b8]">Biar PRD-nya lebih akurat. Jawab semua pertanyaan di bawah.</p>
			<span class="text-xs font-medium text-[#94a3b8]">{answered}/{questions.length || 5}</span>
		</div>
		{#if draftPrompt}<p class="mt-2 truncate text-xs text-[#475569]">Ide: "{draftPrompt}..." · {loading ? 'AI lagi analisa...' : ''}</p>{/if}

		{#if loading}
			<div class="mt-8 space-y-4">
				{#each Array(5) as _}
					<div class="h-28 animate-pulse rounded-2xl bg-[#1a2235] border border-[#252f47]"></div>
				{/each}
			</div>
		{/if}

		{#if error}
			<div class="mt-6 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
		{/if}

		{#if !loading && questions.length > 0}
			<div class="mt-6 divide-y divide-[#1e293b]">
				{#each questions as q, i}
					<div class="py-6">
						<div class="flex items-start justify-between gap-3">
							<p class="text-[14px] font-medium leading-relaxed">
								<span class="text-[#64748b]">{i + 1}.</span>
								{q.text}
								{#if q.type === 'multi'}<span class="font-normal text-[#64748b]"> (boleh pilih beberapa)</span>{/if}
							</p>
							<button onclick={() => skip(q)} class="shrink-0 text-xs text-[#64748b] hover:text-[#94a3b8]">Lewati</button>
						</div>

						{#if q.type === 'text'}
							<textarea
								value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
								oninput={(e) => (answers[q.id] = (e.currentTarget as HTMLTextAreaElement).value)}
								placeholder={q.placeholder ?? 'Ketik jawaban...'}
								rows="2"
								class="mt-3 min-h-[56px] w-full resize-none rounded-xl border border-[#2a3958] bg-[#0f172a] px-4 py-3 text-sm placeholder:text-[#475569] focus:border-[#334155] focus:outline-none"
							></textarea>
						{:else}
							<div class="mt-3 flex flex-wrap gap-2">
								{#each q.options ?? [] as opt}
									<button
										onclick={() => toggleOption(q, opt)}
										class="rounded-full border px-3.5 py-1.5 text-xs font-medium transition
										{isSelected(q, opt)
											? 'border-[#c45a36] bg-[#2a1f1a] text-white'
											: 'border-[#2a3958] bg-[#1e293b]/60 text-[#cbd5e1] hover:border-[#334155]'}"
									>
										{opt}
									</button>
								{/each}
								<!-- + Lainnya inline input -->
								<div class="flex items-center gap-1">
									<input
										bind:value={customInputs[q.id]}
										placeholder="+ Lainnya"
										onkeydown={(e) => {
											if (e.key === 'Enter') {
												e.preventDefault();
												addCustom(q);
											}
										}}
										class="w-28 rounded-full border border-dashed border-[#2a3958] bg-transparent px-3 py-1.5 text-xs placeholder:text-[#475569] focus:border-[#c45a36] focus:outline-none"
									/>
									{#if (customInputs[q.id] ?? '').trim()}
										<button onclick={() => addCustom(q)} class="rounded-full bg-[#1e293b] px-2 py-1 text-xs text-white">+</button>
									{/if}
								</div>
							</div>
							{#if Array.isArray(answers[q.id]) && (answers[q.id] as string[]).length > 0}
								<p class="mt-2 text-[11px] text-[#64748b]">Dipilih: {(answers[q.id] as string[]).join(', ')}</p>
							{/if}
						{/if}
					</div>
				{/each}
			</div>

			<div class="mt-8 flex items-center justify-between">
				<button onclick={() => goto('/preferensi')} class="text-sm text-[#64748b] hover:text-white">← Kembali</button>
				<button onclick={lanjut} class="rounded-xl bg-[#c45a36] px-7 py-2.5 text-sm font-semibold text-white hover:bg-[#d06a47]">
					Lanjut {answered > 0 ? `(${answered} terjawab)` : ''}
				</button>
			</div>
			<p class="mt-2 text-center text-[11px] text-[#475569]">Lewati boleh — tapi makin lengkap, PRD makin akurat. Hasil tetap disimpan untuk LLM final.</p>
		{/if}
	</div>
</div>

<style>
	:global(body) { background: #121827; }
</style>
