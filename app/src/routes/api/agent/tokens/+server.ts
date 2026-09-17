import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { agentToken } from '$lib/server/db/schema';
import { hashAgentSecret } from '$lib/server/agentAuth';
import { readJson, requireOwnedPlan, requireUser } from '$lib/server/http';
import { rateLimit } from '$lib/server/rateLimit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const current = requireUser(locals.user);
	return json(
		await db
			.select({
				id: agentToken.id,
				perencanaanId: agentToken.perencanaanId,
				name: agentToken.name,
				expiresAt: agentToken.expiresAt,
				revokedAt: agentToken.revokedAt,
				createdAt: agentToken.createdAt
			})
			.from(agentToken)
			.where(eq(agentToken.userId, current.id))
	);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const current = requireUser(locals.user);
	const limited = await rateLimit(`agent-token:${current.id}`, 10, 60 * 60_000);
	if (limited) return limited;
	const body = await readJson(request);
	if (typeof body.perencanaanId !== 'string')
		return json({ message: 'perencanaanId required' }, { status: 400 });
	await requireOwnedPlan(current, body.perencanaanId);
	const secret = `mng_${crypto.randomBytes(30).toString('base64url')}`;
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000);
	const [row] = await db
		.insert(agentToken)
		.values({
			userId: current.id,
			perencanaanId: body.perencanaanId,
			name: typeof body.name === 'string' ? body.name.slice(0, 100) : 'Local agent',
			tokenHash: hashAgentSecret(secret),
			expiresAt
		})
		.returning();
	return json({ id: row.id, token: secret, expiresAt }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const current = requireUser(locals.user);
	const body = await readJson(request);
	if (typeof body.id !== 'string') return json({ message: 'id required' }, { status: 400 });
	const [row] = await db
		.update(agentToken)
		.set({ revokedAt: new Date() })
		.where(and(eq(agentToken.id, body.id), eq(agentToken.userId, current.id)))
		.returning();
	return row ? json({ success: true }) : json({ message: 'not found' }, { status: 404 });
};
