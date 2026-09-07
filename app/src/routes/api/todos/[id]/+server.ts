import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { todo } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const updates: Partial<{ title: string; completed: boolean }> = {};

	if (typeof body.title === 'string') updates.title = body.title.trim();
	if (typeof body.completed === 'boolean') updates.completed = body.completed;

	if (Object.keys(updates).length === 0) {
		return json({ message: 'no valid fields' }, { status: 400 });
	}

	const [updated] = await db
		.update(todo)
		.set(updates)
		.where(eq(todo.id, params.id))
		.returning();

	if (!updated) return json({ message: 'not found' }, { status: 404 });
	return json(updated);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const [deleted] = await db.delete(todo).where(eq(todo.id, params.id)).returning();
	if (!deleted) return json({ message: 'not found' }, { status: 404 });
	return json({ success: true });
};
