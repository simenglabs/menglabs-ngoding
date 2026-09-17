import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { perencanaan, fitur, subFitur, kanbanTask } from '$lib/server/db/schema';
import { requireUser, readJson, requiredString } from '$lib/server/http';
import { rateLimit } from '$lib/server/rateLimit';
import { chatCompletion, LlmError, parseJsonObject } from '$lib/server/llm';
import { prependScaffold } from '$lib/server/taskScaffold';
import type { RequestHandler } from './$types';

const SYSTEM = `Buat breakdown proyek sebagai JSON valid tanpa markdown: {"perencanaan":{"title":"...","description":"..."},"fiturs":[{"title":"...","description":"...","subFiturs":[{"title":"...","description":"...","tasks":[{"title":"...","description":"...","priority":"high|medium|low","estimate":"2h|1d"}]}]}]}. Buat 3-4 fitur dan 2-4 sub fitur per fitur. Tasks hanya untuk satu sub fitur pertama, lainnya array kosong. Task pertama wajib menyiapkan kerangka frontend dan backend sesuai stack sebelum implementasi fitur. Bahasa mengikuti permintaan.`;
type GeneratedTask = {
	title: string;
	description: string;
	priority: 'high' | 'medium' | 'low';
	estimate: string;
};
type GeneratedSub = { title: string; description: string; tasks: GeneratedTask[] };
type GeneratedFeature = { title: string; description: string; subFiturs: GeneratedSub[] };
type GeneratedPlan = {
	perencanaan: { title: string; description: string };
	fiturs: GeneratedFeature[];
};

function short(value: unknown, field: string, max = 500): string {
	if (typeof value !== 'string' || !value.trim() || value.length > max)
		throw new LlmError('INVALID_OUTPUT', `invalid ${field}`);
	return value.trim();
}

function validatePlan(value: Record<string, unknown>): GeneratedPlan {
	const plan = value.perencanaan as Record<string, unknown>;
	if (
		!plan ||
		typeof plan !== 'object' ||
		!Array.isArray(value.fiturs) ||
		value.fiturs.length < 1 ||
		value.fiturs.length > 6
	)
		throw new LlmError('INVALID_OUTPUT', 'invalid plan shape');
	return {
		perencanaan: {
			title: short(plan.title, 'plan title', 200),
			description: short(plan.description, 'plan description', 1000)
		},
		fiturs: value.fiturs.map((raw) => {
			if (!raw || typeof raw !== 'object') throw new LlmError('INVALID_OUTPUT', 'invalid feature');
			const feature = raw as Record<string, unknown>;
			if (
				!Array.isArray(feature.subFiturs) ||
				feature.subFiturs.length < 1 ||
				feature.subFiturs.length > 8
			)
				throw new LlmError('INVALID_OUTPUT', 'invalid sub features');
			return {
				title: short(feature.title, 'feature title', 200),
				description: short(feature.description, 'feature description', 1000),
				subFiturs: feature.subFiturs.map((rawSub) => {
					if (!rawSub || typeof rawSub !== 'object')
						throw new LlmError('INVALID_OUTPUT', 'invalid sub feature');
					const sub = rawSub as Record<string, unknown>;
					const rawTasks = Array.isArray(sub.tasks) ? sub.tasks.slice(0, 8) : [];
					return {
						title: short(sub.title, 'sub feature title', 200),
						description: short(sub.description, 'sub feature description', 1000),
						tasks: rawTasks.map((rawTask) => {
							if (!rawTask || typeof rawTask !== 'object')
								throw new LlmError('INVALID_OUTPUT', 'invalid task');
							const task = rawTask as Record<string, unknown>;
							const priority = ['high', 'medium', 'low'].includes(String(task.priority))
								? (String(task.priority) as GeneratedTask['priority'])
								: 'medium';
							return {
								title: short(task.title, 'task title', 300),
								description: short(task.description, 'task description', 2000),
								priority,
								estimate: short(task.estimate ?? '1d', 'estimate', 20)
							};
						})
					};
				})
			};
		})
	};
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const current = requireUser(locals.user);
	const limited = await rateLimit(`plan:${current.id}`, 10, 60 * 60_000);
	if (limited) return limited;
	const body = await readJson(request);
	const prompt = requiredString(body, 'prompt', 20_000);
	const lang = typeof body.lang === 'string' ? body.lang.slice(0, 50) : 'Bahasa Indonesia';
	const techMode = body.techMode === 'manual' ? 'manual' : 'ai';
	const context = `Bahasa: ${lang}\nMode stack: ${techMode}\nStack: ${JSON.stringify(body.techStack ?? {})}\nJawaban: ${JSON.stringify(body.answers ?? {})}\nIde: ${prompt}`;
	try {
		const completion = await chatCompletion(
			[
				{ role: 'system', content: SYSTEM },
				{ role: 'user', content: context }
			],
			{ maxTokens: 4000, temperature: 0.6 }
		);
		const generated = validatePlan(parseJsonObject(completion.content));
		generated.fiturs[0].subFiturs[0].tasks = prependScaffold(
			generated.fiturs[0].subFiturs[0].tasks,
			body.techStack
		);
		const saved = await db.transaction(async (tx) => {
			const [planRow] = await tx
				.insert(perencanaan)
				.values({
					userId: current.id,
					title: generated.perencanaan.title,
					description: generated.perencanaan.description,
					prompt,
					lang,
					techMode,
					techStackJson: JSON.stringify(body.techStack ?? {}),
					questionsJson: JSON.stringify(body.questions ?? []),
					answersJson: JSON.stringify(body.answers ?? {})
				})
				.returning();
			const output: GeneratedPlan & {
				perencanaan: GeneratedPlan['perencanaan'] & { id: string };
				fiturs: Array<
					GeneratedFeature & {
						id: string;
						subFiturs: Array<
							GeneratedSub & {
								id: string;
								tasks: Array<GeneratedTask & { id: string; status: string }>;
							}
						>;
					}
				>;
			} = { perencanaan: { ...generated.perencanaan, id: planRow.id }, fiturs: [] };
			for (const [featureIndex, generatedFeature] of generated.fiturs.entries()) {
				const [featureRow] = await tx
					.insert(fitur)
					.values({
						perencanaanId: planRow.id,
						title: generatedFeature.title,
						description: generatedFeature.description,
						orderIdx: featureIndex
					})
					.returning();
				const featureOut = {
					...generatedFeature,
					id: featureRow.id,
					subFiturs: [] as Array<
						GeneratedSub & {
							id: string;
							tasks: Array<GeneratedTask & { id: string; status: string }>;
						}
					>
				};
				for (const [subIndex, generatedSub] of generatedFeature.subFiturs.entries()) {
					const [subRow] = await tx
						.insert(subFitur)
						.values({
							fiturId: featureRow.id,
							perencanaanId: planRow.id,
							title: generatedSub.title,
							description: generatedSub.description,
							orderIdx: subIndex,
							tasksGeneratedAt: generatedSub.tasks.length ? new Date() : null
						})
						.returning();
					const taskOut: Array<GeneratedTask & { id: string; status: string }> = [];
					for (const generatedTask of generatedSub.tasks) {
						const [taskRow] = await tx
							.insert(kanbanTask)
							.values({
								subFiturId: subRow.id,
								fiturId: featureRow.id,
								perencanaanId: planRow.id,
								...generatedTask,
								status: 'todo'
							})
							.returning();
						taskOut.push({ ...generatedTask, id: taskRow.id, status: taskRow.status });
					}
					featureOut.subFiturs.push({ ...generatedSub, id: subRow.id, tasks: taskOut });
				}
				output.fiturs.push(featureOut);
			}
			return { id: planRow.id, plan: output };
		});
		return json({ plan: saved.plan, dbId: saved.id, usage: completion.usage }, { status: 201 });
	} catch (cause) {
		if (cause instanceof LlmError)
			return json({ message: cause.message, code: cause.code }, { status: cause.status });
		console.error('plan persistence failed', cause);
		return json(
			{ message: 'perencanaan tidak tersimpan', code: 'PERSISTENCE_FAILED' },
			{ status: 500 }
		);
	}
};
