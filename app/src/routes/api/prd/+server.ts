import { json } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { prdDocument } from '$lib/server/db/schema';
import { readJson, requiredString, requireOwnedPlan, requireUser } from '$lib/server/http';
import { rateLimit } from '$lib/server/rateLimit';
import { chatCompletion, LlmError } from '$lib/server/llm';
import type { RequestHandler } from './$types';

const SYSTEM = `Buat PRD Markdown ringkas dan konkret: ringkasan, pengguna/use case, prioritas fitur, flow, data model, stack, acceptance criteria, roadmap MVP, risiko. Bahasa mengikuti permintaan.`;

export const GET: RequestHandler = async ({ locals }) => {
	const current = requireUser(locals.user);
	return json(
		await db
			.select()
			.from(prdDocument)
			.where(eq(prdDocument.userId, current.id))
			.orderBy(desc(prdDocument.createdAt))
			.limit(30)
	);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const current = requireUser(locals.user);
	const limited = await rateLimit(`prd:${current.id}`, 10, 60 * 60_000);
	if (limited) return limited;
	const body = await readJson(request);
	const prompt = requiredString(body, 'prompt', 20_000);
	const planId = typeof body.perencanaanId === 'string' ? body.perencanaanId : null;
	if (planId) await requireOwnedPlan(current, planId);
	try {
		const completion = await chatCompletion(
			[
				{ role: 'system', content: SYSTEM },
				{
					role: 'user',
					content: `Bahasa: ${String(body.lang ?? 'Bahasa Indonesia').slice(0, 50)}\nStack: ${JSON.stringify(body.techStack ?? {})}\nJawaban: ${JSON.stringify(body.answers ?? {})}\nIde: ${prompt}`
				}
			],
			{ maxTokens: 4000, temperature: 0.6 },
			current.id
		);
		const title =
			completion.content.match(/^#\s+(?:PRD:\s*)?(.+)$/m)?.[1]?.slice(0, 200) ??
			prompt.slice(0, 100);
		const [row] = await db
			.insert(prdDocument)
			.values({
				userId: current.id,
				perencanaanId: planId,
				title,
				content: completion.content,
				model: completion.model,
				usageJson: JSON.stringify(completion.usage ?? {})
			})
			.returning();
		return json({ ...row, usage: completion.usage }, { status: 201 });
	} catch (cause) {
		if (cause instanceof LlmError)
			return json({ message: cause.message, code: cause.code }, { status: cause.status });
		console.error('PRD persistence failed', cause);
		return json({ message: 'PRD tidak tersimpan', code: 'PERSISTENCE_FAILED' }, { status: 500 });
	}
};
