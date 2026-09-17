import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { fitur, subFitur, kanbanTask } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { requireOwnedPlan, requireUser } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const plan = await requireOwnedPlan(requireUser(locals.user), params.id);
	const [features, subs, tasks] = await Promise.all([
		db.select().from(fitur).where(eq(fitur.perencanaanId, params.id)).orderBy(asc(fitur.orderIdx)),
		db
			.select()
			.from(subFitur)
			.where(eq(subFitur.perencanaanId, params.id))
			.orderBy(asc(subFitur.orderIdx)),
		db
			.select()
			.from(kanbanTask)
			.where(eq(kanbanTask.perencanaanId, params.id))
			.orderBy(asc(kanbanTask.createdAt))
	]);
	const out = features.map((feature) => ({
		...feature,
		subFiturs: subs
			.filter((sub) => sub.fiturId === feature.id)
			.map((sub) => ({ ...sub, tasks: tasks.filter((task) => task.subFiturId === sub.id) }))
	}));
	return json({
		perencanaan: plan,
		fiturs: out,
		tasks,
		counts: { fitur: features.length, subFitur: subs.length, tasks: tasks.length }
	});
};
