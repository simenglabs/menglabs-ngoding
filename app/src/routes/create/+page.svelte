<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { loadDraft, saveDraft, defaultStack } from '$lib/stores/draft.svelte';
	let prompt = $state('');
	let lang = $state('Bahasa Indonesia');
	let error = $state('');
	const examples = [
		'Aplikasi catatan pengeluaran untuk pribadi. Bisa mencatat pemasukan, mengelompokkan belanja, dan melihat ringkasan bulanan.',
		'Website pemesanan untuk usaha katering. Pelanggan memilih menu dan tanggal kirim, lalu pemilik mengelola pesanan.'
	];
	onMount(() => {
		const draft = loadDraft();
		if (draft && !draft.dbId) {
			prompt = draft.prompt;
			lang = draft.lang;
		}
	});
	async function submit(event?: SubmitEvent) {
		event?.preventDefault();
		if (prompt.trim().length < 4) return;
		try {
			const previous = loadDraft();
			if (previous && !previous.dbId && previous.prompt === prompt.trim() && previous.lang === lang)
				saveDraft(previous);
			else
				saveDraft({
					prompt: prompt.trim(),
					lang,
					referensi: false,
					techMode: null,
					techStack: { ...defaultStack }
				});
			await goto('/preferensi');
		} catch {
			error = 'Ide belum tersimpan. Pastikan penyimpanan browser tersedia, lalu coba lagi.';
		}
	}
</script>

<svelte:head><title>Ceritakan ide — mager</title></svelte:head>
<div class="page-wrap narrow">
	<h1 class="page-title">Mau bikin aplikasi apa?</h1>
	<p class="page-intro">
		Ceritakan siapa yang akan memakainya dan apa yang ingin mereka lakukan. Pakai bahasa
		sehari-hari.
	</p>
	<form onsubmit={submit} class="surface mt-8">
		<label for="idea" class="field-label">Ide aplikasi kamu</label>
		<textarea
			id="idea"
			bind:value={prompt}
			class="field"
			rows="6"
			required
			minlength="4"
			placeholder="Saya ingin membuat aplikasi untuk… Penggunanya… Fitur yang dibutuhkan…"
			onkeydown={(event) => {
				if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
					event.preventDefault();
					void submit();
				}
			}}></textarea>
		<p class="help-text">
			Belum perlu lengkap. Di langkah berikutnya, kamu bisa memperjelas kebutuhannya.
		</p>
		<details class="mt-5">
			<summary class="text-sm">Bahasa rencana</summary><label for="language" class="field-label"
				>Bahasa yang digunakan untuk hasil</label
			><select id="language" class="field" bind:value={lang}
				>{#each ['Bahasa Indonesia', 'English', '日本語'] as language}<option>{language}</option
					>{/each}</select
			>
		</details>
		{#if error}<p role="alert" class="notice">{error}</p>{/if}
		<div class="action-row justify-end">
			<button type="submit" class="primary-button" disabled={prompt.trim().length < 4}
				>Lanjut: pilih teknologi →</button
			>
		</div>
	</form>
	<div class="mt-8">
		<h2 class="text-sm font-semibold">Butuh contoh ide?</h2>
		<div class="mt-3 grid gap-3 sm:grid-cols-2">
			{#each examples as example}<button
					class="secondary-button text-left"
					onclick={() => {
						prompt = example;
						document.getElementById('idea')?.focus();
					}}>{example}</button
				>{/each}
		</div>
	</div>
</div>
