<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			const r = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name, email, password })
			});
			const d = await r.json();
			if (!r.ok) {
				error = d.message ?? 'Register gagal';
				return;
			}
			const next = page.url.searchParams.get('next');
			await goto(next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>Daftar — MengLabs Ngoding</title></svelte:head>

<div class="flex min-h-screen items-center justify-center bg-[#0a0f1f] px-4 py-10 text-white">
	<div class="w-full max-w-[400px] rounded-2xl border border-[#1e293b] bg-[#151c2f] p-6">
		<div class="flex items-center gap-2">
			<span class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f97316] font-bold"
				>M</span
			><span class="text-sm font-bold">Menglabs Ngoding</span>
		</div>
		<h1 class="mt-4 text-xl font-bold">Daftar</h1>
		<p class="mt-1 text-xs text-[#94a3b8]">
			Simpan rencana dan pantau tugas proyekmu dalam satu akun.
		</p>
		<form onsubmit={submit} class="mt-5 space-y-3">
			<label for="name" class="field-label">Nama</label>
			<input
				id="name"
				autocomplete="name"
				bind:value={name}
				placeholder="Nama"
				required
				class="w-full rounded-xl border border-[#2a3958] bg-[#0f172a] px-3 py-2.5 text-sm placeholder:text-[#475569] focus:border-[#f97316] focus:outline-none"
			/>
			<label for="email" class="field-label">Email</label>
			<input
				id="email"
				autocomplete="email"
				bind:value={email}
				type="email"
				placeholder="Email"
				required
				class="w-full rounded-xl border border-[#2a3958] bg-[#0f172a] px-3 py-2.5 text-sm placeholder:text-[#475569] focus:border-[#f97316] focus:outline-none"
			/>
			<label for="password" class="field-label">Kata sandi</label>
			<input
				id="password"
				autocomplete="new-password"
				bind:value={password}
				type="password"
				minlength="8"
				placeholder="Kata sandi (minimal 8 karakter)"
				required
				class="w-full rounded-xl border border-[#2a3958] bg-[#0f172a] px-3 py-2.5 text-sm placeholder:text-[#475569] focus:border-[#f97316] focus:outline-none"
			/>
			{#if error}<p class="rounded-xl bg-red-950/40 px-3 py-2 text-xs text-red-300">{error}</p>{/if}
			<button
				type="submit"
				disabled={loading}
				class="w-full rounded-xl bg-[#f97316] py-2.5 text-sm font-semibold text-white hover:bg-[#ea6a0f] disabled:opacity-50"
				>{loading ? 'Mohon tunggu…' : 'Daftar'}</button
			>
		</form>
		<p class="mt-4 text-center text-xs text-[#64748b]">
			Sudah punya akun? <a href={`/login${page.url.search}`} class="text-[#f97316] hover:underline"
				>Masuk</a
			>
		</p>
		<p class="mt-2 text-center text-xs">
			<a href="/" class="text-[#64748b] hover:text-white">← Beranda</a>
		</p>
	</div>
</div>

<style>
	:global(body) {
		background: #0a0f1f;
	}
</style>
