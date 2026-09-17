<script lang="ts">
	import { page } from '$app/state';
	import { goto, afterNavigate } from '$app/navigation';
	let signedIn = $state(false);
	let message = $state('');
	afterNavigate(async () => {
		try {
			const response = await fetch('/api/auth/me');
			signedIn = response.ok && !!(await response.json()).user;
		} catch {
			/* Public navigation remains available offline. */
		}
	});
	const inProject = $derived(
		['/perencanaan', '/kanban', '/implementasi'].includes(page.url.pathname) ||
			page.url.pathname.startsWith('/detail/')
	);
	const projectId = $derived(
		inProject
			? page.url.searchParams.get('perencanaanId') ||
					page.url.searchParams.get('id') ||
					page.params.id
			: null
	);
	async function logout() {
		try {
			const response = await fetch('/api/auth/logout', { method: 'POST' });
			if (!response.ok) throw new Error();
			signedIn = false;
			await goto('/login');
		} catch {
			message = 'Belum bisa keluar. Coba lagi.';
		}
	}
</script>

<a href="#main-content" class="skip-link">Lewati navigasi</a>
<header class="app-header">
	<div class="header-inner">
		<a href="/" class="brand"
			><span aria-hidden="true">m</span>mager<span class="brand-caption">by MengLabs</span></a
		>
		<nav aria-label="Menu utama" class="header-links">
			<a href="/dashboard" aria-current={page.url.pathname === '/dashboard' ? 'page' : undefined}
				>Proyek saya</a
			>
			<a href="/create" class="primary-link">Buat proyek</a>
			{#if signedIn}<a
					href="/pengaturan"
					aria-current={page.url.pathname === '/pengaturan' ? 'page' : undefined}>Pengaturan</a
				><button onclick={logout} class="quiet-link">Keluar</button>{:else}<a href="/login">Masuk</a
				>{/if}
		</nav>
	</div>
	{#if projectId}
		<nav class="project-nav" aria-label="Menu proyek">
			<a
				href={`/perencanaan?id=${projectId}`}
				aria-current={page.url.pathname === '/perencanaan' ? 'page' : undefined}>Rencana</a
			>
			<a
				href={`/kanban?perencanaanId=${projectId}`}
				aria-current={page.url.pathname === '/kanban' ? 'page' : undefined}>Papan tugas</a
			>
			<a
				href={`/implementasi?perencanaanId=${projectId}`}
				aria-current={page.url.pathname === '/implementasi' ? 'page' : undefined}
				>Jalankan di komputer</a
			>
			<a
				href={`/detail/${projectId}`}
				aria-current={page.url.pathname.startsWith('/detail/') ? 'page' : undefined}
				>Detail proyek</a
			>
		</nav>
	{/if}
	{#if message}<p role="alert" class="notice">{message}</p>{/if}
</header>
