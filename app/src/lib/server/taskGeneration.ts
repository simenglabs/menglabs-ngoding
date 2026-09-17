import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { fitur, kanbanTask, perencanaan, prdDocument, subFitur } from '$lib/server/db/schema';
import { chatCompletion, LlmError, parseJsonObject } from '$lib/server/llm';
import { parseDetailedTask, TASK_DETAIL_CONTRACT } from '$lib/server/taskDetails';
import { prependScaffold, type GeneratedTaskInput } from '$lib/server/taskScaffold';

const systemPrompt = (compact: boolean) =>
	`${compact ? 'Buat tepat satu task actionable dan mendalam' : 'Buat 1-2 task actionable dan mendalam'} untuk satu sub fitur. Output JSON valid tanpa markdown: {"tasks":[...task sesuai format di bawah...]}. Urutkan berdasarkan dependensi, jangan menduplikasi tugas yang sudah ada. ${TASK_DETAIL_CONTRACT}`;

export async function generateTasksForSubFeature(
	subFiturId: string,
	options: { compact?: boolean } = {}
) {
	const [sub] = await db.select().from(subFitur).where(eq(subFitur.id, subFiturId)).limit(1);
	if (!sub) throw new LlmError('INVALID_OUTPUT', 'sub fitur tidak ditemukan', 404);
	const existing = await db.select().from(kanbanTask).where(eq(kanbanTask.subFiturId, sub.id));
	if (existing.length || sub.tasksGeneratedAt) return { tasks: existing, generated: false };

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
	if (!feature || !plan) throw new LlmError('INVALID_OUTPUT', 'konteks sub fitur tidak lengkap');

	const completion = await chatCompletion(
		[
			{ role: 'system', content: systemPrompt(Boolean(options.compact)) },
			{
				role: 'user',
				content: `Proyek: ${plan.title}\nFitur: ${feature.title}\nSub fitur: ${sub.title}\nDeskripsi: ${sub.description}\nDeskripsi proyek: ${plan.description}\nIde asli: ${plan.prompt}\nDeskripsi fitur: ${feature.description}\nTeknologi: ${plan.techStackJson}\nPertanyaan: ${plan.questionsJson}\nJawaban: ${plan.answersJson}\nBahasa: ${plan.lang}\nDokumen kebutuhan (maksimal 30.000 karakter): ${prd?.content.slice(0, 30_000) ?? 'Belum tersedia; gunakan ide dan jawaban.'}\nTugas yang sudah ada (maksimal 80): ${JSON.stringify(otherTasks)}`
			}
		],
		{ maxTokens: options.compact ? 4000 : 6000, temperature: 0.4 }
	);
	const parsed = parseJsonObject(completion.content);
	if (!Array.isArray(parsed.tasks) || !parsed.tasks.length || parsed.tasks.length > 8)
		throw new LlmError('INVALID_OUTPUT', 'invalid tasks');
	let normalized: GeneratedTaskInput[];
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
		const nowExisting = await tx.select().from(kanbanTask).where(eq(kanbanTask.subFiturId, sub.id));
		if (nowExisting.length) return nowExisting;
		const projectTasks = await tx
			.select({ id: kanbanTask.id })
			.from(kanbanTask)
			.where(eq(kanbanTask.perencanaanId, sub.perencanaanId))
			.limit(1);
		let stack: unknown;
		try {
			stack = plan.techStackJson ? JSON.parse(plan.techStackJson) : {};
		} catch {
			stack = {};
		}
		const tasksToInsert = projectTasks.length ? normalized : prependScaffold(normalized, stack);
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
	return { tasks: rows, generated: true, usage: completion.usage };
}
