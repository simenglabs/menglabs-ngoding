import { json } from '@sveltejs/kit';
import { requireUser, readJson, requiredString } from '$lib/server/http';
import { rateLimit } from '$lib/server/rateLimit';
import { chatCompletion, LlmError } from '$lib/server/llm';
import type { RequestHandler } from './$types';

const SYSTEM = `Buat tepat 5 pertanyaan klarifikasi spesifik sebagai JSON array tanpa markdown. Format: [{"id":1,"text":"...","type":"text|single|multi","options":["..."],"placeholder":"..."}]. Pertanyaan pertama type text, sisanya utamakan pilihan. Maksimal 6 opsi.`;

export const POST: RequestHandler = async ({ request, locals }) => {
	const current = requireUser(locals.user);
	const limited = await rateLimit(`questions:${current.id}`, 20, 60 * 60_000);
	if (limited) return limited;
	const body = await readJson(request);
	const prompt = requiredString(body, 'prompt', 20_000);
	try {
		const completion = await chatCompletion(
			[
				{ role: 'system', content: SYSTEM },
				{
					role: 'user',
					content: `Bahasa: ${String(body.lang ?? 'Bahasa Indonesia').slice(0, 50)}\nIde: ${prompt}`
				}
			],
			{ maxTokens: 2000, temperature: 0.5 },
			current.id
		);
		const cleaned = completion.content
			.trim()
			.replace(/^```json\s*/i, '')
			.replace(/^```\s*/i, '')
			.replace(/\s*```$/i, '');
		const parsed: unknown = JSON.parse(cleaned);
		if (!Array.isArray(parsed) || parsed.length !== 5)
			throw new LlmError('INVALID_OUTPUT', 'LLM returned invalid questions');
		const questions = parsed.map((raw, index) => {
			if (!raw || typeof raw !== 'object') throw new LlmError('INVALID_OUTPUT', 'invalid question');
			const question = raw as Record<string, unknown>;
			if (typeof question.text !== 'string' || !question.text.trim() || question.text.length > 500)
				throw new LlmError('INVALID_OUTPUT', 'invalid question text');
			const type =
				index === 0
					? 'text'
					: question.type === 'multi'
						? 'multi'
						: question.type === 'text'
							? 'text'
							: 'single';
			const options =
				type === 'text'
					? undefined
					: Array.isArray(question.options)
						? question.options
								.filter((item): item is string => typeof item === 'string' && item.length <= 100)
								.slice(0, 6)
						: [];
			if (type !== 'text' && !options?.length)
				throw new LlmError('INVALID_OUTPUT', 'options required');
			return {
				id: index + 1,
				text: question.text.trim(),
				type,
				options,
				placeholder: 'Ketik jawaban...',
				allowCustom: true
			};
		});
		return json({ questions, usage: completion.usage });
	} catch (cause) {
		if (cause instanceof LlmError)
			return json({ message: cause.message, code: cause.code }, { status: cause.status });
		return json(
			{ message: 'LLM returned invalid questions', code: 'INVALID_OUTPUT' },
			{ status: 502 }
		);
	}
};
