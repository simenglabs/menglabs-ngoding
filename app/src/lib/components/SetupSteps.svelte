<script lang="ts">
	import { page } from '$app/state';
	const steps = [
		{ path: '/create', label: 'Ceritakan ide' },
		{ path: '/preferensi', label: 'Pilih teknologi' },
		{ path: '/pertanyaan', label: 'Lengkapi kebutuhan' }
	];
	const current = $derived(steps.findIndex((step) => step.path === page.url.pathname));
</script>

<nav aria-label="Langkah membuat proyek" class="setup-steps">
	<ol>
		{#each steps as step, i}
			<li aria-current={current === i ? 'step' : undefined} class:step-complete={i < current}>
				<span class="step-number">{i < current ? '✓' : i + 1}</span><span>{step.label}</span>
			</li>
		{/each}
	</ol>
	<p>Langkah {current + 1} dari 3. Setelah ini, rencana dan daftar tugas akan dibuat.</p>
</nav>
