import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { kanbanTask } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { readJson, requireOwnedTask, requireUser } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	await requireOwnedTask(requireUser(locals.user), params.id);
	const body = await readJson(request);
	const updates: { status?: string; title?: string } = {};
	if (body.status !== undefined) {
		if (
			typeof body.status !== 'string' ||
			!['backlog', 'todo', 'doing', 'done'].includes(body.status)
		)
			return json({ message: 'invalid status' }, { status: 400 });
		updates.status = body.status;
	}
	if (body.title !== undefined) {
		if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 300)
			return json({ message: 'invalid title' }, { status: 400 });
		updates.title = body.title.trim();
	}
	if (!Object.keys(updates).length) return json({ message: 'nothing to update' }, { status: 400 });
	const [row] = await db
		.update(kanbanTask)
		.set(updates)
		.where(eq(kanbanTask.id, params.id))
		.returning();
	return json(row);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireOwnedTask(requireUser(locals.user), params.id);
	await db.delete(kanbanTask).where(eq(kanbanTask.id, params.id));
	return json({ success: true });
};
