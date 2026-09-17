import { json } from '@sveltejs/kit';
import { scheduleBackground } from '$lib/server/background';
import { db } from '$lib/server/db';
import { planningJob } from '$lib/server/db/schema';
import { readJson, requiredString } from '$lib/server/http';
import { processPlanningStep, verifyPlanningWorkerToken } from '$lib/server/planning';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 60 };

export const POST: RequestHandler = async ({ request, url }) => {
	const body = await readJson(request);
	const id = requiredString(body, 'id', 100);
	const token = requiredString(body, 'token', 200);
	const [job] = await db.select().from(planningJob).where(eq(planningJob.id, id)).limit(1);
	if (!job || !verifyPlanningWorkerToken(job.workerTokenHash, token))
		return json({ message: 'Worker token tidak valid.' }, { status: 401 });
	if (job.status === 'completed') return json({ status: 'completed' });
	if (job.status === 'failed') return json({ status: 'failed' }, { status: 409 });
	scheduleBackground(processPlanningStep(id, token, url.origin));
	return json({ status: 'accepted' }, { status: 202 });
};
