import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { perencanaan, fitur, subFitur, kanbanTask } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const p = await db.select().from(perencanaan).where(eq(perencanaan.id, params.id)).limit(1);
	if (!p[0]) return json({ message: 'not found' }, { status: 404 });

	const fiturs = await db.select().from(fitur).where(eq(fitur.perencanaanId, params.id)).orderBy(asc(fitur.orderIdx));
	const out = await Promise.all(
		fiturs.map(async (f) => {
			const subs = await db.select().from(subFitur).where(eq(subFitur.fiturId, f.id)).orderBy(asc(subFitur.orderIdx));
			const subsWithTasks = await Promise.all(
				subs.map(async (s) => {
					const tasks = await db.select().from(kanbanTask).where(eq(kanbanTask.subFiturId, s.id)).orderBy(asc(kanbanTask.createdAt));
					return { ...s, tasks };
				})
			);
			return { ...f, subFiturs: subsWithTasks };
		})
	);

	const allTasks = await db.select().from(kanbanTask).where(eq(kanbanTask.perencanaanId, params.id));

	return json({ perencanaan: p[0], fiturs: out, tasks: allTasks, counts: { fitur: fiturs.length, subFitur: out.reduce((a, f) => a + f.subFiturs.length, 0), tasks: allTasks.length } });
};
