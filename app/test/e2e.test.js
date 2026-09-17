import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';
import { createClient } from '@libsql/client';

const appDir = path.resolve(import.meta.dirname, '..');
const repoDir = path.resolve(appDir, '..');
const viteBin = path.join(appDir, 'node_modules/vite/bin/vite.js');

function spawnPreview(port, env) {
	return spawn(
		process.execPath,
		[viteBin, 'preview', '--host', '127.0.0.1', '--port', String(port)],
		{
			cwd: appDir,
			env,
			stdio: ['ignore', 'pipe', 'pipe']
		}
	);
}

async function freePort() {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			server.close(() => resolve(address.port));
		});
	});
}

async function listen(server) {
	return new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => resolve(server.address().port));
	});
}

async function waitFor(url, child) {
	for (let attempt = 0; attempt < 80; attempt++) {
		if (child.exitCode !== null) throw new Error(`app exited early with ${child.exitCode}`);
		try {
			const response = await fetch(url);
			if (response.ok) return;
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	throw new Error(`server did not become ready: ${url}`);
}

function run(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk) => (stdout += chunk));
		child.stderr.on('data', (chunk) => (stderr += chunk));
		child.once('error', reject);
		child.once('close', (code) => resolve({ code, stdout, stderr }));
	});
}

function mockCompletion(body) {
	const system = body.messages?.[0]?.content ?? '';
	if (system.includes('breakdown proyek')) {
		return JSON.stringify({
			perencanaan: { title: 'E2E Platform', description: 'Rencana pengujian penuh' },
			fiturs: [
				{
					title: 'Agent flow',
					description: 'Hubungkan task dengan agent lokal',
					subFiturs: [
						{
							title: 'CLI worker',
							description: 'Worker mengambil task dari platform',
							tasks: []
						}
					]
				}
			]
		});
	}
	if (system.includes('task actionable')) {
		return JSON.stringify({
			tasks: [
				{
					title: 'Jalankan agent lokal',
					description: 'Tulis marker sebagai bukti executable lokal berjalan',
					priority: 'high',
					estimate: '1h'
				}
			]
		});
	}
	if (system.includes('pertanyaan klarifikasi')) {
		return JSON.stringify([
			{ text: 'Siapa pengguna?', type: 'text' },
			{ text: 'Target?', type: 'single', options: ['Web'] },
			{ text: 'Login?', type: 'single', options: ['Ya'] },
			{ text: 'Data?', type: 'single', options: ['SQLite'] },
			{ text: 'Deploy?', type: 'single', options: ['Node'] }
		]);
	}
	return '# PRD: E2E Platform\n\n## Acceptance criteria\n\nAgent lokal menyelesaikan task.';
}

test(
	'full flow: account -> LLM plan -> project token -> local CLI agent -> verified completion',
	{ timeout: 90_000 },
	async (t) => {
		const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ngoding-e2e-'));
		const databaseUrl = `file:${path.join(tempDir, 'e2e.db')}`;
		const migration = spawnSync('npm', ['run', 'db:migrate'], {
			cwd: appDir,
			env: { ...process.env, DATABASE_URL: databaseUrl },
			encoding: 'utf8'
		});
		assert.equal(migration.status, 0, migration.stderr || migration.stdout);

		const llmServer = http.createServer((request, response) => {
			let raw = '';
			request.on('data', (chunk) => (raw += chunk));
			request.on('end', () => {
				const body = JSON.parse(raw || '{}');
				const send = () => {
					response.writeHead(200, { 'content-type': 'application/json' });
					response.end(
						JSON.stringify({
							choices: [{ message: { content: mockCompletion(body) } }],
							usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
						})
					);
				};
				if (JSON.stringify(body.messages).includes('slow concurrency')) setTimeout(send, 250);
				else send();
			});
		});
		const llmPort = await listen(llmServer);
		t.after(() => llmServer.close());

		const appPort = await freePort();
		const appEnv = {
			...process.env,
			HOST: '127.0.0.1',
			DATABASE_URL: databaseUrl,
			LLM_API_KEY: 'e2e-key',
			LLM_BASE_URL: `http://127.0.0.1:${llmPort}`,
			LLM_MAX_CONCURRENCY: '1'
		};
		const app = spawnPreview(appPort, appEnv);
		let appLog = '';
		app.stdout.on('data', (chunk) => (appLog += chunk));
		app.stderr.on('data', (chunk) => (appLog += chunk));
		t.after(() => app.kill('SIGTERM'));

		const base = `http://127.0.0.1:${appPort}`;
		await waitFor(`${base}/api/ready`, app);

		let cookie = '';
		async function api(url, options = {}) {
			const response = await fetch(`${base}${url}`, {
				...options,
				headers: {
					'content-type': 'application/json',
					...(cookie ? { cookie } : {}),
					...options.headers
				}
			});
			const setCookie = response.headers.get('set-cookie');
			if (setCookie) cookie = setCookie.split(';')[0];
			const text = await response.text();
			const body = text ? JSON.parse(text) : null;
			return { response, body };
		}

		const registered = await api('/api/auth/register', {
			method: 'POST',
			body: JSON.stringify({ name: 'E2E User', email: 'e2e@example.test', password: 'password123' })
		});
		assert.equal(registered.response.status, 201, JSON.stringify(registered.body));

		const concurrentQuestions = await Promise.all([
			api('/api/questions', {
				method: 'POST',
				body: JSON.stringify({ prompt: 'slow concurrency request pertama' })
			}),
			api('/api/questions', {
				method: 'POST',
				body: JSON.stringify({ prompt: 'slow concurrency request kedua' })
			})
		]);
		assert.deepEqual(concurrentQuestions.map(({ response }) => response.status).sort(), [200, 429]);

		const questions = await api('/api/questions', {
			method: 'POST',
			body: JSON.stringify({ prompt: 'Buat platform agent lokal lengkap' })
		});
		assert.equal(questions.response.status, 200, JSON.stringify(questions.body));
		assert.equal(questions.body.questions.length, 5);

		const planned = await api('/api/plan', {
			method: 'POST',
			body: JSON.stringify({
				prompt: 'Buat platform agent lokal lengkap',
				lang: 'Bahasa Indonesia',
				techMode: 'manual',
				techStack: { frontend: 'Svelte', backend: 'Node', database: 'SQLite' },
				questions: questions.body.questions,
				answers: { 1: 'Developer' }
			})
		});
		assert.equal(planned.response.status, 201, JSON.stringify(planned.body));
		const projectId = planned.body.dbId;
		const subFeatureId = planned.body.plan.fiturs[0].subFiturs[0].id;

		const prd = await api('/api/prd', {
			method: 'POST',
			body: JSON.stringify({
				prompt: 'Buat platform agent lokal lengkap',
				perencanaanId: projectId,
				lang: 'Bahasa Indonesia',
				techStack: { frontend: 'Svelte', backend: 'Node', database: 'SQLite' },
				answers: { 1: 'Developer' }
			})
		});
		assert.equal(prd.response.status, 201, JSON.stringify(prd.body));

		const generated = await api('/api/tasks', {
			method: 'POST',
			body: JSON.stringify({ subFiturId: subFeatureId })
		});
		assert.equal(generated.response.status, 200, JSON.stringify(generated.body));
		assert.equal(generated.body.tasks.length, 1);

		const createdToken = await api('/api/agent/tokens', {
			method: 'POST',
			body: JSON.stringify({ perencanaanId: projectId, name: 'E2E local CLI' })
		});
		assert.equal(createdToken.response.status, 201, JSON.stringify(createdToken.body));
		const agentToken = createdToken.body.token;
		const agentHeaders = {
			'content-type': 'application/json',
			authorization: `Bearer ${agentToken}`
		};
		const firstClaim = await fetch(`${base}/api/agent/tasks`, {
			method: 'POST',
			headers: agentHeaders,
			body: JSON.stringify({ perencanaanId: projectId, workerId: 'stale-worker' })
		}).then((response) => response.json());
		const directDb = createClient({ url: databaseUrl });
		await directDb.execute({
			sql: 'update kanban_task set lease_expires_at = 0 where id = ?',
			args: [firstClaim.task.id]
		});
		directDb.close();
		const secondClaim = await fetch(`${base}/api/agent/tasks`, {
			method: 'POST',
			headers: agentHeaders,
			body: JSON.stringify({ perencanaanId: projectId, workerId: 'replacement-worker' })
		}).then((response) => response.json());
		assert.equal(secondClaim.task.id, firstClaim.task.id);
		const staleCompletion = await fetch(`${base}/api/agent/tasks`, {
			method: 'PATCH',
			headers: agentHeaders,
			body: JSON.stringify({
				id: firstClaim.task.id,
				status: 'done',
				claimToken: firstClaim.claimToken
			})
		});
		assert.equal(staleCompletion.status, 409);
		const releaseReplacement = await fetch(`${base}/api/agent/tasks`, {
			method: 'PATCH',
			headers: agentHeaders,
			body: JSON.stringify({
				id: secondClaim.task.id,
				status: 'todo',
				claimToken: secondClaim.claimToken
			})
		});
		assert.equal(releaseReplacement.status, 200);

		const marker = path.join(tempDir, 'agent-ran.json');
		const localAgent = path.join(tempDir, 'local-agent.mjs');
		const verifyAgent = path.join(tempDir, 'verify-agent.mjs');
		await writeFile(
			localAgent,
			`import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, process.env.TASK_JSON); console.log('local agent completed', process.env.TASK_ID);`
		);
		await writeFile(
			verifyAgent,
			`import fs from 'node:fs'; if (!fs.existsSync(${JSON.stringify(marker)})) process.exit(1); console.log('verification passed');`
		);

		const cli = await run(
			process.execPath,
			[
				path.join(repoDir, 'cli/bin/cli.js'),
				'autopilot',
				'--url',
				base,
				'--key',
				agentToken,
				'--perencanaan',
				projectId,
				'--exec',
				`${process.execPath} ${localAgent}`,
				'--verify',
				`${process.execPath} ${verifyAgent}`
			],
			{ cwd: tempDir, env: process.env }
		);
		assert.equal(cli.code, 0, `${cli.stdout}\n${cli.stderr}\n${appLog}`);
		assert.match(cli.stdout, /local agent completed/);
		assert.match(cli.stdout, /verification passed/);
		assert.match(cli.stdout, /\[done\]/);
		assert.match(cli.stdout, /antrean kosong/);
		const taskContext = JSON.parse(await readFile(marker, 'utf8'));
		assert.match(taskContext.prdContent, /Acceptance criteria/);

		const kanban = await api(`/api/kanban?perencanaanId=${projectId}`);
		assert.equal(kanban.response.status, 200);
		assert.equal(kanban.body[0].status, 'done');
		const result = JSON.parse(kanban.body[0].resultJson);
		assert.equal(result.execution.exitCode, 0);
		assert.equal(result.verification.status, 'passed');

		const tokenList = await api('/api/agent/tokens');
		assert.equal(tokenList.body.filter((token) => !token.revokedAt).length, 1);
		const revoked = await api('/api/agent/tokens', {
			method: 'DELETE',
			body: JSON.stringify({ id: createdToken.body.id })
		});
		assert.equal(revoked.response.status, 200);
		const rejected = await fetch(`${base}/api/agent/tasks?status=done`, {
			headers: { authorization: `Bearer ${agentToken}` }
		});
		assert.equal(rejected.status, 401);

		cookie = '';
		const secondUser = await api('/api/auth/register', {
			method: 'POST',
			body: JSON.stringify({
				name: 'Other User',
				email: 'other@example.test',
				password: 'password123'
			})
		});
		assert.equal(secondUser.response.status, 201);
		const crossUser = await api(`/api/perencanaan/${projectId}`);
		assert.equal(crossUser.response.status, 404);

		const secondPort = await freePort();
		const secondApp = spawnPreview(secondPort, appEnv);
		t.after(() => secondApp.kill('SIGTERM'));
		await waitFor(`http://127.0.0.1:${secondPort}/api/ready`, secondApp);
		const loginStatuses = [];
		for (let attempt = 0; attempt < 6; attempt++) {
			const response = await fetch(`${base}/api/auth/login`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: 'missing@example.test', password: 'password123' })
			});
			loginStatuses.push(response.status);
		}
		for (let attempt = 0; attempt < 5; attempt++) {
			const response = await fetch(`http://127.0.0.1:${secondPort}/api/auth/login`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: 'missing@example.test', password: 'password123' })
			});
			loginStatuses.push(response.status);
		}
		assert.deepEqual(loginStatuses.slice(0, 10), Array(10).fill(401));
		assert.equal(loginStatuses[10], 429, 'rate limit must be shared by both app instances');
	}
);
