import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { perencanaan, fitur, subFitur, kanbanTask } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	let userId: string | null = null;
	try {
		const { getUserBySession, COOKIE_NAME } = await import('$lib/server/auth');
		const sid = cookies.get(COOKIE_NAME);
		if (sid) {
			const u = await getUserBySession(sid);
			if (u) userId = u.id;
		}
	} catch {}
	const where = userId ? eq(perencanaan.userId, userId) : undefined;
	const rows = where
		? await db.select().from(perencanaan).where(where).orderBy(desc(perencanaan.createdAt)).limit(20)
		: await db.select().from(perencanaan).orderBy(desc(perencanaan.createdAt)).limit(20);
	// enrich with counts
	const enriched = await Promise.all(
		rows.map(async (p) => {
			const fiturs = await db.select().from(fitur).where(eq(fitur.perencanaanId, p.id));
			const tasks = await db.select().from(kanbanTask).where(eq(kanbanTask.perencanaanId, p.id));
			return { ...p, fiturCount: fiturs.length, taskCount: tasks.length, todoCount: tasks.filter((t) => t.status === 'todo').length };
		})
	);
	return json(enriched);
};
