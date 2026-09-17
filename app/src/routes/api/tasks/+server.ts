import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { fitur, subFitur, kanbanTask, perencanaan, prdDocument } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { readJson, requiredString, requireOwnedSubFeature, requireUser } from '$lib/server/http';
import { rateLimit } from '$lib/server/rateLimit';
import { chatCompletion, LlmError, parseJsonObject } from '$lib/server/llm';
import { prependScaffold } from '$lib/server/taskScaffold';
import { parseDetailedTask, TASK_DETAIL_CONTRACT } from '$lib/server/taskDetails';
import type { RequestHandler } from './$types';

const SYSTEM = `Buat 3-4 task actionable dan mendalam untuk satu sub fitur. Output JSON valid tanpa markdown: {"tasks":[...task sesuai format di bawah...]}. Urutkan berdasarkan dependensi, jangan menduplikasi tugas yang sudah ada. ${TASK_DETAIL_CONTRACT}`;

export const POST: RequestHandler = async ({ request, locals }) => {
	const current = requireUser(locals.user);
	const body = await readJson(request);
	const subFiturId = requiredString(body, 'subFiturId', 100);
	const sub = await requireOwnedSubFeature(current, subFiturId);
	const existing = await db.select().from(kanbanTask).where(eq(kanbanTask.subFiturId, sub.id));
	if (existing.length || sub.tasksGeneratedAt) return json({ tasks: existing, generated: false });
	const limited = await rateLimit(`tasks:${current.id}`, 30, 60 * 60_000);
	if (limited) return limited;
	const [[feature], [plan], [prd], otherTasks] = await Promise.all([
		db.select().from(fitur).where(eq(fitur.id, sub.fiturId)).limit(1),
		db.select().from(perencanaan).where(eq(perencanaan.id, sub.perencanaanId)).limit(1),
		db
			.select({ content: prdDocument.content })
			.from(prdDocument)
			.where(eq(prdDocument.perencanaanId, sub.perencanaanId))
			.orderBy(desc(prdDocument.createdAt))
			.limit(1),
		db
			.select({ title: kanbanTask.title, status: kanbanTask.status })
			.from(kanbanTask)
			.where(eq(kanbanTask.perencanaanId, sub.perencanaanId))
			.limit(80)
	]);
	try {
		const completion = await chatCompletion(
			[
				{ role: 'system', content: SYSTEM },
				{
					role: 'user',
					content: `Proyek: ${plan.title}\nFitur: ${feature.title}\nSub fitur: ${sub.title}\nDeskripsi: ${sub.description}\nDeskripsi proyek: ${plan.description}\nIde asli: ${plan.prompt}\nDeskripsi fitur: ${feature.description}\nTeknologi: ${plan.techStackJson}\nPertanyaan: ${plan.questionsJson}\nJawaban: ${plan.answersJson}\nBahasa: ${plan.lang}\nDokumen kebutuhan (maksimal 30.000 karakter): ${prd?.content.slice(0, 30_000) ?? 'Belum tersedia; gunakan ide dan jawaban.'}\nTugas yang sudah ada (maksimal 80): ${JSON.stringify(otherTasks)}`
				}
			],
			{ maxTokens: 12000, temperature: 0.4 }
		);
		const parsed = parseJsonObject(completion.content);
		if (!Array.isArray(parsed.tasks) || !parsed.tasks.length || parsed.tasks.length > 8)
			throw new LlmError('INVALID_OUTPUT', 'invalid tasks');
		let normalized;
		try {
			normalized = parsed.tasks.map(parseDetailedTask);
		} catch (cause) {
			throw new LlmError(
				'INVALID_OUTPUT',
				cause instanceof Error ? cause.message : 'Detail tugas belum lengkap.'
			);
		}

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
			const projectTasks = await tx
				.select({ id: kanbanTask.id })
				.from(kanbanTask)
				.where(eq(kanbanTask.perencanaanId, sub.perencanaanId))
				.limit(1);
			const tasksToInsert = projectTasks.length
				? normalized
				: prependScaffold(normalized, plan.techStackJson ? JSON.parse(plan.techStackJson) : {});
			return tx
				.insert(kanbanTask)
				.values(
					tasksToInsert.map((task) => ({
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
