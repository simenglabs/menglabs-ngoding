<script lang="ts">
	import { onMount } from 'svelte';
	import { formatStoredDate } from '$lib/date';
	type Project = {
		id: string;
		title: string;
		description: string;
		taskCount: number;
		fiturCount: number;
		createdAt: number;
	};
	let rows = $state<Project[]>([]);
	let loading = $state(true);
	let error = $state('');
	let search = $state('');
	const filtered = $derived(
		rows.filter((row) =>
			`${row.title} ${row.description}`.toLowerCase().includes(search.toLowerCase())
		)
	);
	async function load() {
		loading = true;
		error = '';
		try {
			const response = await fetch('/api/perencanaan');
			if (!response.ok)
				throw new Error(
					response.status === 401
						? 'Sesi berakhir. Masuk kembali untuk melihat proyek.'
						: 'Proyek belum bisa dimuat. Coba lagi.'
				);
			rows = await response.json();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Periksa koneksi lalu coba lagi.';
		} finally {
			loading = false;
		}
	}
	onMount(() => {
		void load();
	});
</script>

<svelte:head><title>Proyek saya — mager</title></svelte:head>
<div class="page-wrap">
	<div class="page-heading">
		<div>
			<p class="eyebrow">Ruang kerja</p>
			<h1 class="page-title">Proyek saya</h1>
			<p class="page-intro">Lanjutkan proyek yang sudah ada atau mulai dari ide baru.</p>
		</div>
		<a href="/create" class="primary-button">+ Buat proyek</a>
	</div>
	{#if rows.length > 0}<div class="mt-8 max-w-md">
			<label for="project-search" class="field-label">Cari proyek</label><input
				id="project-search"
				class="field"
				bind:value={search}
				placeholder="Nama atau deskripsi proyek"
			/>
		</div>{/if}
	{#if loading}<p role="status" class="mt-10 text-slate-300">Memuat proyek…</p>
	{:else if error}<div role="alert" class="notice">
			<p>{error}</p>
			<div class="action-row">
				<button onclick={load} class="secondary-button">Coba lagi</button><a
					href="/login"
					class="secondary-button">Masuk kembali</a
				>
			</div>
		</div>
	{:else if rows.length === 0}<section class="surface empty-state">
			<h2>Mulai proyek pertamamu</h2>
			<p>
				Cukup ceritakan idenya. Kamu akan dipandu memilih teknologi, melengkapi kebutuhan, dan
				meninjau daftar tugas.
			</p>
			<a href="/create" class="primary-button">Ceritakan ide saya →</a>
		</section>
	{:else}<div class="project-grid">
			{#each filtered as project}<article class="surface project-card">
					<h2>{project.title}</h2>
					<p class="line-clamp-3">{project.description}</p>
					<p class="help-text mt-4">
						{project.fiturCount} fitur · {project.taskCount} tugas · {formatStoredDate(
							project.createdAt
						)}
					</p>
					<div class="action-row">
						<a class="primary-button" href={`/kanban?perencanaanId=${project.id}`}
							>Buka papan tugas</a
						><a class="secondary-button" href={`/perencanaan?id=${project.id}`}>Lihat rencana</a>
					</div>
				</article>{:else}<p class="text-slate-300">
					Tidak ada proyek yang cocok. Coba kata lain.
				</p>{/each}
		</div>{/if}
</div>
