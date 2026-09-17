import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { kanbanTask, perencanaan, subFitur } from '$lib/server/db/schema';

type User = App.Locals['user'];

export function requireUser(user: User): NonNullable<User> {
	if (!user) error(401, 'authentication required');
	return user;
}

export async function requireOwnedPlan(user: NonNullable<User>, id: string) {
	const [row] = await db
		.select()
		.from(perencanaan)
		.where(and(eq(perencanaan.id, id), eq(perencanaan.userId, user.id)))
		.limit(1);
	if (!row) error(404, 'not found');
	return row;
}

export async function requireOwnedTask(user: NonNullable<User>, id: string) {
	const [row] = await db
		.select({ task: kanbanTask, plan: perencanaan })
		.from(kanbanTask)
		.innerJoin(perencanaan, eq(kanbanTask.perencanaanId, perencanaan.id))
		.where(and(eq(kanbanTask.id, id), eq(perencanaan.userId, user.id)))
		.limit(1);
	if (!row) error(404, 'not found');
	return row.task;
}

export async function requireOwnedSubFeature(user: NonNullable<User>, id: string) {
	const [row] = await db
		.select({ sub: subFitur, plan: perencanaan })
		.from(subFitur)
		.innerJoin(perencanaan, eq(subFitur.perencanaanId, perencanaan.id))
		.where(and(eq(subFitur.id, id), eq(perencanaan.userId, user.id)))
		.limit(1);
	if (!row) error(404, 'not found');
	return row.sub;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
	const length = Number(request.headers.get('content-length') ?? '0');
	if (length > 128_000) error(413, 'payload too large');
	try {
		const value: unknown = await request.json();
		if (!value || typeof value !== 'object' || Array.isArray(value))
			error(400, 'JSON object required');
		return value as Record<string, unknown>;
	} catch (cause) {
		if (cause && typeof cause === 'object' && 'status' in cause) throw cause;
		error(400, 'invalid JSON');
	}
}

export function requiredString(body: Record<string, unknown>, key: string, max = 10_000): string {
	const value = body[key];
	if (typeof value !== 'string' || !value.trim()) error(400, `${key} required`);
	const result = value.trim();
	if (result.length > max) error(400, `${key} too long`);
	return result;
}

export function apiError(cause: unknown, requestId: string) {
	console.error(`[${requestId}]`, cause);
	return json({ message: 'request failed', code: 'INTERNAL_ERROR', requestId }, { status: 500 });
}
