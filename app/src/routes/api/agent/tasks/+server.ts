import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { kanbanTask, perencanaan, fitur, subFitur, prdDocument } from '$lib/server/db/schema';
import { and, eq, asc, desc, gt, isNotNull, lt, or } from 'drizzle-orm';
import { hashAgentSecret, requireAgent, type AgentPrincipal } from '$lib/server/agentAuth';
import { readJson } from '$lib/server/http';
import type { RequestHandler } from './$types';

const LEASE_MS = 15 * 60_000;
const statuses = ['todo', 'doing', 'done', 'backlog'] as const;

function scopedPlan(principal: AgentPrincipal, requested?: string | null) {
	if (principal.kind === 'token') {
		if (requested && requested !== principal.perencanaanId) return null;
		return principal.perencanaanId!;
	}
	return requested || undefined;
}

async function contextFor(task: typeof kanbanTask.$inferSelect) {
	const [[plan], [feature], [sub], [prd]] = await Promise.all([
		db.select().from(perencanaan).where(eq(perencanaan.id, task.perencanaanId)).limit(1),
		db.select().from(fitur).where(eq(fitur.id, task.fiturId)).limit(1),
		db.select().from(subFitur).where(eq(subFitur.id, task.subFiturId)).limit(1),
		db
			.select({ id: prdDocument.id, title: prdDocument.title, content: prdDocument.content })
			.from(prdDocument)
			.where(eq(prdDocument.perencanaanId, task.perencanaanId))
			.orderBy(desc(prdDocument.createdAt))
			.limit(1)
	]);
	return {
		...task,
		perencanaanTitle: plan?.title,
		perencanaanPrompt: plan?.prompt,
		techStack: plan?.techStackJson ? JSON.parse(plan.techStackJson) : {},
		prd: prd ?? null,
		prdContent: prd?.content ?? '',
		fiturTitle: feature?.title,
		subFiturTitle: sub?.title,
		subFiturDescription: sub?.description
	};
}

export const GET: RequestHandler = async ({ url, request }) => {
	const principal = await requireAgent(request);
	if (!principal) return json({ message: 'invalid agent token' }, { status: 401 });
	const status = url.searchParams.get('status') ?? 'todo';
	if (!statuses.includes(status as (typeof statuses)[number]))
		return json({ message: 'invalid status' }, { status: 400 });
	const requestedPlan = url.searchParams.get('perencanaanId');
	const planId = scopedPlan(principal, requestedPlan);
	if (principal.kind === 'token' && !planId)
		return json({ message: 'token scope mismatch' }, { status: 403 });
	const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 10) || 10, 1), 50);
	const where = planId
		? and(eq(kanbanTask.perencanaanId, planId), eq(kanbanTask.status, status))
		: eq(kanbanTask.status, status);
	const rows = await db
		.select({
			task: kanbanTask,
			perencanaanTitle: perencanaan.title,
			perencanaanPrompt: perencanaan.prompt,
			techStackJson: perencanaan.techStackJson,
			fiturTitle: fitur.title,
			subFiturTitle: subFitur.title,
			subFiturDescription: subFitur.description
		})
		.from(kanbanTask)
		.innerJoin(perencanaan, eq(kanbanTask.perencanaanId, perencanaan.id))
		.innerJoin(fitur, eq(kanbanTask.fiturId, fitur.id))
		.innerJoin(subFitur, eq(kanbanTask.subFiturId, subFitur.id))
		.where(where)
		.orderBy(asc(kanbanTask.createdAt))
		.limit(limit);
	const tasks = rows.map((row) => ({
		...row.task,
		perencanaanTitle: row.perencanaanTitle,
		perencanaanPrompt: row.perencanaanPrompt,
		techStack: row.techStackJson ? JSON.parse(row.techStackJson) : {},
		fiturTitle: row.fiturTitle,
		subFiturTitle: row.subFiturTitle,
		subFiturDescription: row.subFiturDescription
	}));
	return json({ tasks, count: tasks.length, status });
};

export const POST: RequestHandler = async ({ request }) => {
	const principal = await requireAgent(request);
	if (!principal) return json({ message: 'invalid agent token' }, { status: 401 });
	const body = await readJson(request);
	const requested = typeof body.perencanaanId === 'string' ? body.perencanaanId : undefined;
	const planId = scopedPlan(principal, requested);
	if (principal.kind === 'token' && !planId)
		return json({ message: 'token scope mismatch' }, { status: 403 });
	if (body.claim === false) {
		const where = planId
			? and(eq(kanbanTask.status, 'todo'), eq(kanbanTask.perencanaanId, planId))
			: eq(kanbanTask.status, 'todo');
		const [task] = await db
			.select()
			.from(kanbanTask)
			.where(where)
			.orderBy(asc(kanbanTask.createdAt))
			.limit(1);
		return json({ task: task ? await contextFor(task) : null, claimed: false });
	}
	const workerId =
		typeof body.workerId === 'string' && body.workerId.length <= 100
			? body.workerId
			: `worker-${crypto.randomUUID()}`;
	for (let attempt = 0; attempt < 5; attempt++) {
		const available = or(
			eq(kanbanTask.status, 'todo'),
			and(
				eq(kanbanTask.status, 'doing'),
				isNotNull(kanbanTask.leaseExpiresAt),
				lt(kanbanTask.leaseExpiresAt, new Date())
			)
		);
		const where = planId ? and(eq(kanbanTask.perencanaanId, planId), available) : available;
		const [next] = await db
			.select()
			.from(kanbanTask)
			.where(where)
			.orderBy(asc(kanbanTask.createdAt))
			.limit(1);
		if (!next) return json({ task: null, claimed: false, message: 'no available tasks' });
		const claimSecret = crypto.randomBytes(24).toString('base64url');
		const condition =
			next.status === 'todo'
				? and(eq(kanbanTask.id, next.id), eq(kanbanTask.status, 'todo'))
				: and(
						eq(kanbanTask.id, next.id),
						eq(kanbanTask.status, 'doing'),
						eq(kanbanTask.leaseExpiresAt, next.leaseExpiresAt!)
					);
		const [claimed] = await db
			.update(kanbanTask)
			.set({
				status: 'doing',
				claimedBy: workerId,
				claimTokenHash: hashAgentSecret(claimSecret),
				leaseExpiresAt: new Date(Date.now() + LEASE_MS)
			})
			.where(condition)
			.returning();
		if (claimed)
			return json({
				task: await contextFor(claimed),
				claimed: true,
				claimToken: claimSecret,
				leaseExpiresAt: claimed.leaseExpiresAt
			});
	}
	return json({ message: 'claim contention; retry', code: 'CLAIM_CONTENTION' }, { status: 409 });
};

export const PATCH: RequestHandler = async ({ request }) => {
	const principal = await requireAgent(request);
	if (!principal) return json({ message: 'invalid agent token' }, { status: 401 });
	const body = await readJson(request);
	if (
		typeof body.id !== 'string' ||
		typeof body.status !== 'string' ||
		!statuses.includes(body.status as (typeof statuses)[number])
	)
		return json({ message: 'invalid id or status' }, { status: 400 });
	const [existing] = await db.select().from(kanbanTask).where(eq(kanbanTask.id, body.id)).limit(1);
	if (!existing) return json({ message: 'not found' }, { status: 404 });
	if (principal.kind === 'token' && existing.perencanaanId !== principal.perencanaanId)
		return json({ message: 'not found' }, { status: 404 });
	if (principal.kind === 'token' && existing.status !== 'doing')
		return json({ message: 'task must be claimed first' }, { status: 409 });
	if (existing.status === 'doing') {
		if (
			typeof body.claimToken !== 'string' ||
			existing.claimTokenHash !== hashAgentSecret(body.claimToken) ||
			(existing.leaseExpiresAt?.getTime() ?? 0) <= Date.now()
		)
			return json({ message: 'invalid or expired claim' }, { status: 409 });
	}
	const result =
		body.result && typeof body.result === 'object'
			? JSON.stringify(body.result).slice(0, 20_000)
			: null;
	const updates =
		body.status === 'doing'
			? { status: body.status, resultJson: result, leaseExpiresAt: new Date(Date.now() + LEASE_MS) }
			: {
					status: body.status,
					resultJson: result,
					claimedBy: null,
					claimTokenHash: null,
					leaseExpiresAt: null
				};
	const updateCondition =
		existing.status === 'doing'
			? and(
					eq(kanbanTask.id, existing.id),
					eq(kanbanTask.status, 'doing'),
					eq(kanbanTask.claimTokenHash, existing.claimTokenHash!),
					eq(kanbanTask.leaseExpiresAt, existing.leaseExpiresAt!),
					gt(kanbanTask.leaseExpiresAt, new Date())
				)
			: eq(kanbanTask.id, existing.id);
	const [row] = await db.update(kanbanTask).set(updates).where(updateCondition).returning();
	if (!row) return json({ message: 'claim changed or expired' }, { status: 409 });
	return json(row);
};
