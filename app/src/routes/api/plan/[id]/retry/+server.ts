import { json } from '@sveltejs/kit';
import { scheduleBackground } from '$lib/server/background';
import {
	dispatchPlanningJob,
	planningJobView,
	rotatePlanningWorkerToken
} from '$lib/server/planning';
import { requireUser } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 60 };

export const POST: RequestHandler = async ({ params, locals, url }) => {
	const current = requireUser(locals.user);
	const rotated = await rotatePlanningWorkerToken(params.id, current.id, 'failed', true);
	if (!rotated) return json({ message: 'Planning job tidak ditemukan.' }, { status: 404 });
	scheduleBackground(dispatchPlanningJob(url.origin, rotated.job.id, rotated.token));
	return json(planningJobView(rotated.job), { status: 202 });
};
