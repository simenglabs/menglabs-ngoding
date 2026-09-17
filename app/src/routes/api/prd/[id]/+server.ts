import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { prdDocument } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const current = requireUser(locals.user);
	const [row] = await db
		.select()
		.from(prdDocument)
		.where(and(eq(prdDocument.id, params.id), eq(prdDocument.userId, current.id)))
		.limit(1);
	if (!row) return json({ message: 'not found' }, { status: 404 });
	return json({ ...row, usage: row.usageJson ? JSON.parse(row.usageJson) : undefined });
};
