#!/usr/bin/env node
// Read-only example. Use the maintained CLI runner to claim and complete real tasks.
const base = process.env.MENGLABS_API || process.env.API_BASE || 'http://localhost:5173';
const token = process.env.MENGLABS_KEY || process.env.AGENT_API_KEY;
const plan =
	process.env.MENGLABS_PERENCANAAN ||
	process.argv.find((arg) => arg.startsWith('--perencanaan='))?.split('=')[1];
if (!token)
	throw new Error('Set MENGLABS_KEY to a project-scoped token from the Implementasi page.');
const query = new URLSearchParams({ status: 'todo', limit: '5' });
if (plan) query.set('perencanaanId', plan);
const response = await fetch(`${base}/api/agent/tasks?${query}`, {
	headers: { Authorization: `Bearer ${token}` }
});
if (!response.ok)
	throw new Error(`API ${response.status}: ${(await response.text()).slice(0, 300)}`);
console.log(JSON.stringify(await response.json(), null, 2));
console.log(
	'Read-only example: no task was claimed or completed. Use `npx menglabs-ngoding run ...` for execution.'
);
