import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { perencanaan, fitur, kanbanTask } from '$lib/server/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { requireUser } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	const current = requireUser(locals.user);
	const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20) || 20, 1), 50);
	const rows = await db
		.select({
			id: perencanaan.id,
			userId: perencanaan.userId,
			title: perencanaan.title,
			description: perencanaan.description,
			prompt: perencanaan.prompt,
			lang: perencanaan.lang,
			techMode: perencanaan.techMode,
			techStackJson: perencanaan.techStackJson,
			questionsJson: perencanaan.questionsJson,
			answersJson: perencanaan.answersJson,
			createdAt: perencanaan.createdAt,
			fiturCount: sql<number>`count(distinct ${fitur.id})`,
			taskCount: sql<number>`count(distinct ${kanbanTask.id})`,
			todoCount: sql<number>`count(distinct case when ${kanbanTask.status} = 'todo' then ${kanbanTask.id} end)`
		})
		.from(perencanaan)
		.leftJoin(fitur, eq(fitur.perencanaanId, perencanaan.id))
		.leftJoin(kanbanTask, eq(kanbanTask.perencanaanId, perencanaan.id))
		.where(eq(perencanaan.userId, current.id))
		.groupBy(perencanaan.id)
		.orderBy(desc(perencanaan.createdAt))
		.limit(limit);
	return json(rows);
};
