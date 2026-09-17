import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { kanbanTask } from '$lib/server/db/schema';
import { eq, asc, sql } from 'drizzle-orm';
import { requireOwnedPlan, requireUser } from '$lib/server/http';
import { SCAFFOLD_TASK_TITLE } from '$lib/server/taskScaffold';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const id = url.searchParams.get('perencanaanId');
	if (!id) return json({ message: 'perencanaanId required' }, { status: 400 });
	await requireOwnedPlan(requireUser(locals.user), id);
	return json(
		await db
			.select()
			.from(kanbanTask)
			.where(eq(kanbanTask.perencanaanId, id))
			.orderBy(
				sql`case when ${kanbanTask.title} = ${SCAFFOLD_TASK_TITLE} then 0 else 1 end`,
				asc(kanbanTask.createdAt)
			)
	);
};
