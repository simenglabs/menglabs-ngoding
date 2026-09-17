import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { fitur, subFitur, kanbanTask, perencanaan } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { readJson, requiredString, requireOwnedSubFeature, requireUser } from '$lib/server/http';
import { rateLimit } from '$lib/server/rateLimit';
import { chatCompletion, LlmError, parseJsonObject } from '$lib/server/llm';
import type { RequestHandler } from './$types';

const SYSTEM = `Buat 4-6 task actionable untuk satu sub fitur. Output JSON valid tanpa markdown: {"tasks":[{"title":"...","description":"...","priority":"high|medium|low","estimate":"4h|1d|2d"}]}.`;

export const POST: RequestHandler = async ({ request, locals }) => {
	const current = requireUser(locals.user);
	const body = await readJson(request);
	const subFiturId = requiredString(body, 'subFiturId', 100);
	const sub = await requireOwnedSubFeature(current, subFiturId);
	const existing = await db.select().from(kanbanTask).where(eq(kanbanTask.subFiturId, sub.id));
	if (existing.length || sub.tasksGeneratedAt) return json({ tasks: existing, generated: false });
	const limited = await rateLimit(`tasks:${current.id}`, 30, 60 * 60_000);
	if (limited) return limited;
	const [[feature], [plan]] = await Promise.all([
		db.select().from(fitur).where(eq(fitur.id, sub.fiturId)).limit(1),
		db.select().from(perencanaan).where(eq(perencanaan.id, sub.perencanaanId)).limit(1)
	]);
	try {
		const completion = await chatCompletion(
			[
				{ role: 'system', content: SYSTEM },
				{
					role: 'user',
					content: `Proyek: ${plan.title}\nFitur: ${feature.title}\nSub fitur: ${sub.title}\nDeskripsi: ${sub.description}\nBahasa: ${plan.lang}`
				}
			],
			{ maxTokens: 1500, temperature: 0.5 }
		);
		const parsed = parseJsonObject(completion.content);
		if (!Array.isArray(parsed.tasks) || !parsed.tasks.length || parsed.tasks.length > 8)
			throw new LlmError('INVALID_OUTPUT', 'invalid tasks');
		const normalized = parsed.tasks.map((raw) => {
			if (!raw || typeof raw !== 'object') throw new LlmError('INVALID_OUTPUT', 'invalid task');
			const item = raw as Record<string, unknown>;
			if (typeof item.title !== 'string' || !item.title.trim() || item.title.length > 300)
				throw new LlmError('INVALID_OUTPUT', 'invalid task title');
			if (
				typeof item.description !== 'string' ||
				!item.description.trim() ||
				item.description.length > 2000
			)
				throw new LlmError('INVALID_OUTPUT', 'invalid task description');
			const title = item.title.trim();
			const description = item.description.trim();
			const priority = ['high', 'medium', 'low'].includes(String(item.priority))
				? String(item.priority)
				: 'medium';
			const estimate = typeof item.estimate === 'string' ? item.estimate.slice(0, 20) : '1d';
			return { title, description, priority, estimate };
		});
		const rows = await db.transaction(async (tx) => {
			const [locked] = await tx
				.update(subFitur)
				.set({ tasksGeneratedAt: new Date() })
				.where(eq(subFitur.id, sub.id))
				.returning();
			if (!locked) throw new Error('sub feature disappeared');
			const nowExisting = await tx
				.select()
				.from(kanbanTask)
				.where(eq(kanbanTask.subFiturId, sub.id));
			if (nowExisting.length) return nowExisting;
			return tx
				.insert(kanbanTask)
				.values(
					normalized.map((task) => ({
						...task,
						subFiturId: sub.id,
						fiturId: sub.fiturId,
						perencanaanId: sub.perencanaanId,
						status: 'todo'
					}))
				)
				.returning();
		});
		return json({ tasks: rows, generated: true, usage: completion.usage });
	} catch (cause) {
		if (cause instanceof LlmError)
			return json({ message: cause.message, code: cause.code }, { status: cause.status });
		console.error('task generation failed', cause);
		return json({ message: 'tasks tidak tersimpan', code: 'PERSISTENCE_FAILED' }, { status: 500 });
	}
};
