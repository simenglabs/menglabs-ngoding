import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { kanbanTask } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const perencanaanId = url.searchParams.get('perencanaanId');
	if (!perencanaanId) return json({ message: 'perencanaanId required' }, { status: 400 });
	const rows = await db.select().from(kanbanTask).where(eq(kanbanTask.perencanaanId, perencanaanId)).orderBy(desc(kanbanTask.createdAt));
	return json(rows);
};
