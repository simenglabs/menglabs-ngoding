import { json } from '@sveltejs/kit';
import { and, desc, eq, ne } from 'drizzle-orm';
import { scheduleBackground } from '$lib/server/background';
import { db } from '$lib/server/db';
import { planningJob } from '$lib/server/db/schema';
import { readJson, requiredString, requireUser } from '$lib/server/http';
import {
	createPlanningJob,
	dispatchPlanningJob,
	planningJobView,
	rotatePlanningWorkerToken,
	type PlanningInput
} from '$lib/server/planning';
import { rateLimit } from '$lib/server/rateLimit';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 60 };

export const GET: RequestHandler = async ({ locals, url }) => {
	const current = requireUser(locals.user);
	const id = url.searchParams.get('jobId');
	if (!id) {
		const jobs = await db
			.select()
			.from(planningJob)
			.where(and(eq(planningJob.userId, current.id), ne(planningJob.status, 'completed')))
			.orderBy(desc(planningJob.createdAt))
			.limit(20);
		for (const job of jobs) {
			const stale =
				job.status === 'queued'
					? new Date(job.updatedAt).getTime() < Date.now() - 5000
					: !job.leaseExpiresAt || new Date(job.leaseExpiresAt).getTime() < Date.now();
			if (job.status !== 'failed' && stale) {
				const rotated = await rotatePlanningWorkerToken(job.id, current.id, job.status);
				if (rotated) scheduleBackground(dispatchPlanningJob(url.origin, job.id, rotated.token));
			}
		}
		return json(jobs.map(planningJobView));
	}
	if (id.length > 100) return json({ message: 'Planning job tidak valid.' }, { status: 400 });
	const [job] = await db
		.select()
		.from(planningJob)
		.where(and(eq(planningJob.id, id), eq(planningJob.userId, current.id)))
		.limit(1);
	if (!job) return json({ message: 'Planning job tidak ditemukan.' }, { status: 404 });

	// A stale lease means the previous invocation was interrupted. Visiting any page that polls
	// this endpoint safely creates a fresh worker capability and resumes from the saved part.
	const stale =
		job.status === 'queued'
			? new Date(job.updatedAt).getTime() < Date.now() - 5000
			: job.status === 'running' &&
				(!job.leaseExpiresAt || new Date(job.leaseExpiresAt).getTime() < Date.now());
	if (stale) {
		const rotated = await rotatePlanningWorkerToken(job.id, current.id, job.status);
		if (rotated) scheduleBackground(dispatchPlanningJob(url.origin, job.id, rotated.token));
	}
	return json(planningJobView(job));
};

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const current = requireUser(locals.user);
	const limited = await rateLimit(`plan:${current.id}`, 10, 60 * 60_000);
	if (limited) return limited;
	const body = await readJson(request);
	const input: PlanningInput = {
		prompt: requiredString(body, 'prompt', 20_000),
		lang: typeof body.lang === 'string' ? body.lang.slice(0, 50) : 'Bahasa Indonesia',
		techMode: body.techMode === 'manual' ? 'manual' : 'ai',
		techStack: body.techStack ?? {},
		questions: body.questions ?? [],
		answers: body.answers ?? {}
	};
	const { job, token } = await createPlanningJob(current.id, input);
	scheduleBackground(dispatchPlanningJob(url.origin, job.id, token));
	return json(planningJobView(job), { status: 202 });
};
