import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { kanbanTask } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { status, title } = await request.json();
	if (!status && !title) return json({ message: 'nothing to update' }, { status: 400 });

	const updates: Record<string, unknown> = {};
	if (status) {
		if (!['backlog', 'todo', 'doing', 'done'].includes(status)) return json({ message: 'invalid status' }, { status: 400 });
		updates.status = status;
	}
	if (title) updates.title = String(title).trim();

	const [row] = await db.update(kanbanTask).set(updates).where(eq(kanbanTask.id, params.id)).returning();
	if (!row) return json({ message: 'not found' }, { status: 404 });
	return json(row);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const [row] = await db.delete(kanbanTask).where(eq(kanbanTask.id, params.id)).returning();
	if (!row) return json({ message: 'not found' }, { status: 404 });
	return json({ success: true });
};
