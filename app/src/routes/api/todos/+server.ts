import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { todo } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const todos = await db.select().from(todo).orderBy(asc(todo.createdAt));
	return json(todos);
};

export const POST: RequestHandler = async ({ request }) => {
	const { title } = await request.json();

	if (!title || typeof title !== 'string' || !title.trim()) {
		return json({ message: 'title required' }, { status: 400 });
	}

	const [created] = await db
		.insert(todo)
		.values({ title: title.trim() })
		.returning();

	return json(created, { status: 201 });
};
