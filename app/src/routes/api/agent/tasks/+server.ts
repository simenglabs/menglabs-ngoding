import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { kanbanTask, perencanaan, fitur, subFitur } from '$lib/server/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { checkAgentAuth } from '$lib/server/agentAuth';
import type { RequestHandler } from './$types';

// GET /api/agent/tasks?status=todo&perencanaanId=xxx&limit=5
// Agent lokal collect todo untuk dikerjakan
export const GET: RequestHandler = async ({ url, request }) => {
	const auth = checkAgentAuth(request);
	if (!auth.ok) return json({ message: auth.reason }, { status: 401 });

	const status = url.searchParams.get('status') ?? 'todo';
	const perencanaanId = url.searchParams.get('perencanaanId');
	const limit = Math.min(Number(url.searchParams.get('limit') ?? '10'), 50);

	let rows;
	if (perencanaanId) {
		rows = await db.select().from(kanbanTask).where(and(eq(kanbanTask.perencanaanId, perencanaanId), eq(kanbanTask.status, status))).orderBy(asc(kanbanTask.createdAt)).limit(limit);
	} else {
		rows = await db.select().from(kanbanTask).where(eq(kanbanTask.status, status)).orderBy(asc(kanbanTask.createdAt)).limit(limit);
	}

	// enrich dengan konteks fitur/subFitur/perencanaan untuk agent
	const enriched = await Promise.all(
		rows.map(async (t) => {
			const [ps] = await db.select().from(perencanaan).where(eq(perencanaan.id, t.perencanaanId)).limit(1);
			const [fs] = await db.select().from(fitur).where(eq(fitur.id, t.fiturId)).limit(1);
			const [ss] = await db.select().from(subFitur).where(eq(subFitur.id, t.subFiturId)).limit(1);
			return {
				...t,
				perencanaanTitle: ps?.title,
				perencanaanPrompt: ps?.prompt,
				fiturTitle: fs?.title,
				subFiturTitle: ss?.title
			};
		})
	);

	return json({ tasks: enriched, count: enriched.length, status });
};

// PATCH /api/agent/tasks — body {id, status}  agent ubah todo->doing->done otomatis
export const PATCH: RequestHandler = async ({ request }) => {
	const auth = checkAgentAuth(request);
	if (!auth.ok) return json({ message: auth.reason }, { status: 401 });

	const { id, status } = await request.json();
	if (!id || !status) return json({ message: 'id & status required' }, { status: 400 });
	if (!['todo', 'doing', 'done', 'backlog'].includes(status)) return json({ message: 'invalid status' }, { status: 400 });

	const [row] = await db.update(kanbanTask).set({ status }).where(eq(kanbanTask.id, id)).returning();
	if (!row) return json({ message: 'not found' }, { status: 404 });
	return json(row);
};

// POST /api/agent/tasks — agent collect & claim next todo atomik: ambil 1 todo terlama lalu ubah jadi doing
export const POST: RequestHandler = async ({ request }) => {
	const auth = checkAgentAuth(request);
	if (!auth.ok) return json({ message: auth.reason }, { status: 401 });

	const { perencanaanId, claim = true } = (await request.json().catch(() => ({}))) as { perencanaanId?: string; claim?: boolean };
	const where = perencanaanId ? and(eq(kanbanTask.status, 'todo'), eq(kanbanTask.perencanaanId, perencanaanId)) : eq(kanbanTask.status, 'todo');
	const [next] = await db.select().from(kanbanTask).where(where).orderBy(asc(kanbanTask.createdAt)).limit(1);
	if (!next) return json({ message: 'no todo tasks', task: null }, { status: 200 });
	if (claim) {
		const [claimed] = await db.update(kanbanTask).set({ status: 'doing' }).where(eq(kanbanTask.id, next.id)).returning();
		return json({ task: claimed, claimed: true });
	}
	return json({ task: next, claimed: false });
};
