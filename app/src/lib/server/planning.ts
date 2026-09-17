import crypto from 'node:crypto';
import { and, asc, eq, isNull, lt, ne, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { fitur, perencanaan, planningJob, subFitur } from '$lib/server/db/schema';
import { chatCompletion, LlmError, parseJsonObject } from '$lib/server/llm';
import { generateTasksForSubFeature } from '$lib/server/taskGeneration';

export type PlanningInput = {
	prompt: string;
	lang: string;
	techMode: 'ai' | 'manual';
	techStack: unknown;
	questions: unknown;
	answers: unknown;
};

type Outline = {
	perencanaan: { title: string; description: string };
	fiturs: Array<{
		title: string;
		description: string;
		subFiturs: Array<{ title: string; description: string }>;
	}>;
};

const OUTLINE_SYSTEM = `Susun struktur proyek sebagai JSON valid tanpa markdown: {"perencanaan":{"title":"...","description":"..."},"fiturs":[{"title":"...","description":"...","subFiturs":[{"title":"...","description":"..."}]}]}. Buat 3-4 fitur, masing-masing 2-4 sub fitur. Jangan membuat task pada tahap ini. Setiap deskripsi harus menjelaskan hasil yang terlihat dan batas tanggung jawabnya. Bahasa mengikuti pengguna.`;
const LEASE_MS = 70_000;
const MAX_ATTEMPTS_PER_PART = 3;

function short(value: unknown, field: string, max = 1000): string {
	if (typeof value !== 'string' || !value.trim() || value.length > max)
		throw new LlmError('INVALID_OUTPUT', `invalid ${field}`);
	return value.trim();
}

function validateOutline(value: Record<string, unknown>): Outline {
	const plan = value.perencanaan as Record<string, unknown>;
	if (!plan || typeof plan !== 'object' || !Array.isArray(value.fiturs))
		throw new LlmError('INVALID_OUTPUT', 'invalid plan outline');
	if (value.fiturs.length < 1 || value.fiturs.length > 6)
		throw new LlmError('INVALID_OUTPUT', 'invalid feature count');
	return {
		perencanaan: {
			title: short(plan.title, 'plan title', 200),
			description: short(plan.description, 'plan description')
		},
		fiturs: value.fiturs.map((raw) => {
			if (!raw || typeof raw !== 'object') throw new LlmError('INVALID_OUTPUT', 'invalid feature');
			const feature = raw as Record<string, unknown>;
			if (
				!Array.isArray(feature.subFiturs) ||
				feature.subFiturs.length < 1 ||
				feature.subFiturs.length > 8
			)
				throw new LlmError('INVALID_OUTPUT', 'invalid sub feature count');
			return {
				title: short(feature.title, 'feature title', 200),
				description: short(feature.description, 'feature description'),
				subFiturs: feature.subFiturs.map((rawSub) => {
					if (!rawSub || typeof rawSub !== 'object')
						throw new LlmError('INVALID_OUTPUT', 'invalid sub feature');
					const sub = rawSub as Record<string, unknown>;
					return {
						title: short(sub.title, 'sub feature title', 200),
						description: short(sub.description, 'sub feature description')
					};
				})
			};
		})
	};
}

function tokenHash(token: string) {
	return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyPlanningWorkerToken(storedHash: string, token: string) {
	const actual = Buffer.from(tokenHash(token));
	const expected = Buffer.from(storedHash);
	return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export async function createPlanningJob(userId: string, input: PlanningInput) {
	const token = crypto.randomBytes(32).toString('base64url');
	const [job] = await db
		.insert(planningJob)
		.values({ userId, inputJson: JSON.stringify(input), workerTokenHash: tokenHash(token) })
		.returning();
	return { job, token };
}

export async function rotatePlanningWorkerToken(
	id: string,
	userId: string,
	expectedStatus: string,
	resetAttempts = false
) {
	const token = crypto.randomBytes(32).toString('base64url');
	const [job] = await db
		.update(planningJob)
		.set({
			workerTokenHash: tokenHash(token),
			leaseExpiresAt: null,
			status: 'queued',
			...(resetAttempts ? { attempts: 0, errorCode: null, errorMessage: null } : {}),
			updatedAt: new Date()
		})
		.where(
			and(
				eq(planningJob.id, id),
				eq(planningJob.userId, userId),
				eq(planningJob.status, expectedStatus)
			)
		)
		.returning();
	return job ? { job, token } : null;
}

export async function dispatchPlanningJob(origin: string, id: string, token: string) {
	let lastError: unknown;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			const response = await fetch(new URL('/api/plan/run', origin), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id, token })
			});
			if (response.ok || response.status === 409) return;
			lastError = new Error(`planning dispatch returned ${response.status}`);
		} catch (cause) {
			lastError = cause;
		}
		await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
	}
	throw lastError instanceof Error ? lastError : new Error('planning dispatch failed');
}

async function generateOutline(input: PlanningInput) {
	const context = `Bahasa: ${input.lang}\nMode stack: ${input.techMode}\nStack: ${JSON.stringify(input.techStack)}\nPertanyaan: ${JSON.stringify(input.questions)}\nJawaban: ${JSON.stringify(input.answers)}\nIde: ${input.prompt}`;
	const completion = await chatCompletion(
		[
			{ role: 'system', content: OUTLINE_SYSTEM },
			{ role: 'user', content: context }
		],
		{ maxTokens: 3000, temperature: 0.5 }
	);
	return validateOutline(parseJsonObject(completion.content));
}

async function saveOutline(jobId: string, userId: string, input: PlanningInput, outline: Outline) {
	return db.transaction(async (tx) => {
		const [current] = await tx.select().from(planningJob).where(eq(planningJob.id, jobId)).limit(1);
		if (!current || current.perencanaanId) return current?.perencanaanId ?? null;
		const [planRow] = await tx
			.insert(perencanaan)
			.values({
				userId,
				title: outline.perencanaan.title,
				description: outline.perencanaan.description,
				prompt: input.prompt,
				lang: input.lang,
				techMode: input.techMode,
				techStackJson: JSON.stringify(input.techStack),
				questionsJson: JSON.stringify(input.questions),
				answersJson: JSON.stringify(input.answers)
			})
			.returning();
		let subCount = 0;
		for (const [featureIndex, generatedFeature] of outline.fiturs.entries()) {
			const [featureRow] = await tx
				.insert(fitur)
				.values({
					perencanaanId: planRow.id,
					title: generatedFeature.title,
					description: generatedFeature.description,
					orderIdx: featureIndex
				})
				.returning();
			for (const [subIndex, generatedSub] of generatedFeature.subFiturs.entries()) {
				await tx.insert(subFitur).values({
					fiturId: featureRow.id,
					perencanaanId: planRow.id,
					title: generatedSub.title,
					description: generatedSub.description,
					orderIdx: subIndex
				});
				subCount += 1;
			}
		}
		await tx
			.update(planningJob)
			.set({
				perencanaanId: planRow.id,
				status: 'queued',
				stage: 'tasks',
				currentPart: 1,
				totalParts: subCount + 1,
				attempts: 0,
				errorCode: null,
				errorMessage: null,
				leaseExpiresAt: null,
				updatedAt: new Date()
			})
			.where(eq(planningJob.id, jobId));
		return planRow.id;
	});
}

async function failOrRetry(jobId: string, cause: unknown) {
	const [current] = await db.select().from(planningJob).where(eq(planningJob.id, jobId)).limit(1);
	if (!current) return false;
	const code = cause instanceof LlmError ? cause.code : 'PERSISTENCE_FAILED';
	const message = cause instanceof Error ? cause.message : 'Planning gagal diproses.';
	const attempts = current.attempts + 1;
	const retryable = code !== 'CONFIG' && attempts < MAX_ATTEMPTS_PER_PART;
	await db
		.update(planningJob)
		.set({
			status: retryable ? 'queued' : 'failed',
			attempts,
			errorCode: code,
			errorMessage: message.slice(0, 1000),
			leaseExpiresAt: null,
			updatedAt: new Date()
		})
		.where(eq(planningJob.id, jobId));
	return retryable;
}

export async function processPlanningStep(
	jobId: string,
	token: string,
	origin: string,
	dispatch: (origin: string, id: string, token: string) => Promise<void> = dispatchPlanningJob
) {
	const [authorized] = await db
		.select()
		.from(planningJob)
		.where(eq(planningJob.id, jobId))
		.limit(1);
	if (!authorized || !verifyPlanningWorkerToken(authorized.workerTokenHash, token)) return;
	const now = new Date();
	const [claimed] = await db
		.update(planningJob)
		.set({ status: 'running', leaseExpiresAt: new Date(now.getTime() + LEASE_MS), updatedAt: now })
		.where(
			and(
				eq(planningJob.id, jobId),
				eq(planningJob.workerTokenHash, authorized.workerTokenHash),
				ne(planningJob.status, 'completed'),
				ne(planningJob.status, 'failed'),
				or(isNull(planningJob.leaseExpiresAt), lt(planningJob.leaseExpiresAt, now))
			)
		)
		.returning();
	if (!claimed) return;

	try {
		const input = JSON.parse(claimed.inputJson) as PlanningInput;
		if (claimed.stage === 'outline') {
			await saveOutline(jobId, claimed.userId, input, await generateOutline(input));
		} else if (claimed.stage === 'tasks' && claimed.perencanaanId) {
			const subs = await db
				.select({ id: subFitur.id })
				.from(subFitur)
				.innerJoin(fitur, eq(subFitur.fiturId, fitur.id))
				.where(eq(subFitur.perencanaanId, claimed.perencanaanId))
				.orderBy(asc(fitur.orderIdx), asc(subFitur.orderIdx));
			const subIndex = claimed.currentPart - 1;
			if (subs[subIndex])
				await generateTasksForSubFeature(subs[subIndex].id, { compact: claimed.attempts > 0 });
			const nextPart = Math.min(claimed.currentPart + 1, claimed.totalParts);
			const completed = nextPart >= claimed.totalParts;
			await db
				.update(planningJob)
				.set({
					status: completed ? 'completed' : 'queued',
					stage: completed ? 'complete' : 'tasks',
					currentPart: nextPart,
					attempts: 0,
					errorCode: null,
					errorMessage: null,
					leaseExpiresAt: null,
					updatedAt: new Date()
				})
				.where(eq(planningJob.id, jobId));
		}
		const [updated] = await db.select().from(planningJob).where(eq(planningJob.id, jobId)).limit(1);
		if (updated && updated.status !== 'completed') await dispatch(origin, jobId, token);
	} catch (cause) {
		console.error(`planning job ${jobId} part failed`, cause);
		if (await failOrRetry(jobId, cause)) await dispatch(origin, jobId, token);
	}
}

export function planningJobView(job: typeof planningJob.$inferSelect) {
	return {
		id: job.id,
		status: job.status,
		stage: job.stage,
		progress: Math.round((job.currentPart / Math.max(job.totalParts, 1)) * 100),
		completedParts: job.currentPart,
		totalParts: job.totalParts,
		perencanaanId: job.perencanaanId,
		error: job.errorMessage
			? { code: job.errorCode, message: job.errorMessage, attempts: job.attempts }
			: null,
		updatedAt: job.updatedAt
	};
}
