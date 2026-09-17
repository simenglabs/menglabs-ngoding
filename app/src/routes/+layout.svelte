<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import SetupSteps from '$lib/components/SetupSteps.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<AppHeader />
<main id="main-content" tabindex="-1">
	{#if ['/create', '/preferensi', '/pertanyaan'].includes(page.url.pathname)}
		<SetupSteps />
	{/if}
	{@render children()}
</main>
