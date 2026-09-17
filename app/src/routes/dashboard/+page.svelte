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
	type PlanningJob = {
		id: string;
		status: 'queued' | 'running' | 'failed';
		stage: 'outline' | 'tasks';
		progress: number;
		perencanaanId: string | null;
		error: { message: string } | null;
	};
	let rows = $state<Project[]>([]);
	let jobs = $state<PlanningJob[]>([]);
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
			const [response, jobsResponse] = await Promise.all([
				fetch('/api/perencanaan'),
				fetch('/api/plan')
			]);
			if (!response.ok || !jobsResponse.ok)
				throw new Error(
					response.status === 401 || jobsResponse.status === 401
						? 'Sesi berakhir. Masuk kembali untuk melihat proyek.'
						: 'Proyek belum bisa dimuat. Coba lagi.'
				);
			jobs = await jobsResponse.json();
			const hiddenIds = new Set(jobs.map((job) => job.perencanaanId).filter(Boolean));
			rows = ((await response.json()) as Project[]).filter((project) => !hiddenIds.has(project.id));
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
	{#if rows.length > 0 || jobs.length > 0}<div class="mt-8 max-w-md">
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
	{:else if rows.length === 0 && jobs.length === 0}<section class="surface empty-state">
			<h2>Mulai proyek pertamamu</h2>
			<p>
				Cukup ceritakan idenya. Kamu akan dipandu memilih teknologi, melengkapi kebutuhan, dan
				meninjau daftar tugas.
			</p>
			<a href="/create" class="primary-button">Ceritakan ide saya →</a>
		</section>
	{:else}<div class="project-grid">
			{#each jobs as job}<article class="surface project-card">
					<p class="eyebrow">
						{job.status === 'failed' ? 'Planning perlu dilanjutkan' : 'Planning berjalan'}
					</p>
					<h2>
						{job.stage === 'outline' ? 'Menyusun struktur proyek' : 'Menyusun tugas per bagian'}
					</h2>
					<div class="mt-4 h-2 overflow-hidden rounded-full bg-[#1e293b]">
						<div class="h-full bg-[#c45a36]" style={`width: ${job.progress}%`}></div>
					</div>
					<p class="help-text mt-3">
						{job.progress}% selesai{job.error ? ` · ${job.error.message}` : ''}
					</p>
					<div class="action-row">
						<a class="primary-button" href={`/perencanaan?job=${job.id}`}
							>{job.status === 'failed' ? 'Lanjutkan planning' : 'Lihat progres'}</a
						>
					</div>
				</article>{/each}
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
