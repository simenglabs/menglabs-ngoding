<script lang="ts">
	import { goto } from '$app/navigation';
	import { saveDraft, defaultStack } from '$lib/stores/draft.svelte';

	let prompt = $state('');
	let lang = $state('Bahasa Indonesia');
	let referensi = $state(false);
	let showLang = $state(false);
	let showReferensi = $state(false);
	let historyOpen = $state(false);
	let prdList = $state<{ id: string; title: string; date: string }[]>([]);

	const canSubmit = $derived(prompt.trim().length > 3);

	async function submit() {
		if (!canSubmit) return;
		// simpan draft, JANGAN eksekusi LLM — lanjut ke preferensi tech
		saveDraft({
			prompt: prompt.trim(),
			lang,
			referensi,
			techMode: null,
			techStack: { ...defaultStack }
		});
		await goto('/preferensi');
	}

	async function toggleHistory() {
		historyOpen = !historyOpen;
		if (historyOpen && prdList.length === 0) {
			const res = await fetch('/api/prd');
			prdList = await res.json();
		}
	}

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			submit();
		}
	}
</script>

<svelte:head>
	<title>Mau bikin apa? — PRD Builder</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center bg-[#121827] px-4 py-16 text-white selection:bg-[#b45309]/30">
	<div class="w-full max-w-[720px] text-center">
		<h1 class="flex items-center justify-center gap-3 text-[34px] font-extrabold leading-none tracking-tight sm:text-[42px]">
			<span>Mau bikin apa?</span>
			<span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a2a2b] sm:h-11 sm:w-11">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="text-emerald-400">
					<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
					<path d="M14 2v6h6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
					<path d="M10 13H8m8 4H8m4-8H8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.9"/>
				</svg>
			</span>
		</h1>
		<p class="mx-auto mt-4 max-w-[560px] text-[15px] leading-relaxed text-[#94a3b8]">
			Ubah Ide kamu menjadi rencana yang bisa dipahami<br class="hidden sm:block" />
			AI tools pilihanmu, atau mulai dari
			<span class="inline-flex items-center gap-1 rounded-full bg-[#1e2a4a] px-2.5 py-0.5 text-[13px] font-medium text-[#93c5fd]">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/></svg>
				codebase anda
			</span>
		</p>
	</div>

	<div class="mt-10 w-full max-w-[640px]">
		<div class="rounded-[20px] border border-[#252f47] bg-[#1a2235]/90 p-3 shadow-[0_8px_40px_rgba(0,0,0,0.4)] backdrop-blur sm:p-4">
			<textarea
				bind:value={prompt}
				onkeydown={handleKey}
				rows="3"
				placeholder={`Contoh: "Aplikasi tracking pengeluaran harian, bisa input lewat WhatsApp, ada dashboard ringkasan bulanan..."`}
				class="min-h-[84px] w-full resize-none bg-transparent px-3 py-2 text-[14.5px] leading-relaxed text-white placeholder:text-[#64748b] focus:outline-none"
			></textarea>

			<div class="mt-3 flex items-center gap-2">
				<div class="relative">
					<button
						onclick={() => (showReferensi = !showReferensi)}
						class="inline-flex items-center gap-1.5 rounded-full border border-[#2a3958] bg-[#1e293b]/60 px-2.5 py-1.5 text-xs font-medium text-[#94a3b8] hover:bg-[#23324d] hover:text-white"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
						Referensi
					</button>
					{#if showReferensi}
						<div class="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-[#2a3958] bg-[#0f172a] p-3 text-xs text-[#cbd5e1] shadow-xl">
							<p class="font-semibold text-white">Tambah referensi</p>
							<p class="mt-1 text-[#64748b]">Upload file / paste link PRD, design, atau repo untuk konteks.</p>
							<label class="mt-2 flex items-center gap-2">
								<input type="checkbox" bind:checked={referensi} class="rounded border-zinc-600" />
								Sertakan referensi
							</label>
						</div>
					{/if}
				</div>

				<div class="relative">
					<button
						onclick={() => (showLang = !showLang)}
						class="inline-flex items-center gap-1.5 rounded-full border border-[#2a3958] bg-[#1e293b]/60 px-2.5 py-1.5 text-xs font-medium text-[#94a3b8] hover:bg-[#23324d] hover:text-white"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
						{lang}
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="opacity-60"><path d="M6 9l6 6 6-6"/></svg>
					</button>
					{#if showLang}
						<div class="absolute bottom-full left-0 mb-2 w-44 rounded-xl border border-[#2a3958] bg-[#0f172a] py-1 shadow-xl">
							{#each ['Bahasa Indonesia', 'English', '日本語'] as l}
								<button onclick={() => { lang = l; showLang = false; }} class="w-full px-3 py-2 text-left text-xs hover:bg-[#1e293b] {lang === l ? 'text-white' : 'text-[#94a3b8]'}">{l}</button>
							{/each}
						</div>
					{/if}
				</div>

				<button
					onclick={submit}
					disabled={!canSubmit}
					aria-label="Kirim"
					class="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#9a3b2e] text-white shadow-md transition hover:bg-[#b54534] disabled:cursor-not-allowed disabled:opacity-40"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
				</button>
			</div>
		</div>

		<button onclick={toggleHistory} class="mx-auto mt-8 flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#94a3b8]">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
			Lihat PRD sebelumnya
		</button>

		{#if historyOpen}
			<div class="mx-auto mt-4 max-w-[520px] rounded-2xl border border-[#252f47] bg-[#1a2235] p-4 text-left">
				<p class="text-xs font-semibold text-white">PRD Sebelumnya</p>
				<ul class="mt-2 space-y-2">
					{#each prdList as p}
						<li class="flex items-center justify-between rounded-xl bg-[#0f172a] px-3 py-2 text-xs">
							<span class="text-[#cbd5e1]">{p.title}</span><span class="text-[#475569]">{p.date}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	<p class="mt-6 text-center text-[11px] text-[#475569]">Tekan ⌘+Enter untuk lanjut ke preferensi tech · Draft disimpan lokal</p>
</div>

<style>
	:global(body) { background: #121827; }
</style>
