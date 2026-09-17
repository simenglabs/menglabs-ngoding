import { json } from '@sveltejs/kit';
import { readJson, requiredString, requireOwnedSubFeature, requireUser } from '$lib/server/http';
import { rateLimit } from '$lib/server/rateLimit';
import { LlmError } from '$lib/server/llm';
import { generateTasksForSubFeature } from '$lib/server/taskGeneration';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const current = requireUser(locals.user);
	const body = await readJson(request);
	const subFiturId = requiredString(body, 'subFiturId', 100);
	await requireOwnedSubFeature(current, subFiturId);
	const limited = await rateLimit(`tasks:${current.id}`, 30, 60 * 60_000);
	if (limited) return limited;
	try {
		return json(await generateTasksForSubFeature(subFiturId));
	} catch (cause) {
		if (cause instanceof LlmError)
			return json({ message: cause.message, code: cause.code }, { status: cause.status });
		console.error('task generation failed', cause);
		return json({ message: 'tasks tidak tersimpan', code: 'PERSISTENCE_FAILED' }, { status: 500 });
	}
};
