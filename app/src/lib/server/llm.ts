import { env } from '$env/dynamic/private';
import { acquireConcurrency, releaseConcurrency } from '$lib/server/rateLimit';

export class LlmError extends Error {
	constructor(
		public code: 'CONFIG' | 'UPSTREAM' | 'TIMEOUT' | 'INVALID_OUTPUT' | 'BUSY',
		message: string,
		public status = 502
	) {
		super(message);
	}
}

export async function chatCompletion(
	messages: Array<{ role: 'system' | 'user'; content: string }>,
	options: { maxTokens: number; temperature: number }
) {
	const apiKey = env.LLM_API_KEY;
	if (!apiKey) throw new LlmError('CONFIG', 'LLM is not configured', 503);
	const lease = await acquireConcurrency(
		'llm-provider',
		Math.max(1, Math.min(Number(env.LLM_MAX_CONCURRENCY) || 4, 20)),
		60_000
	);
	if (!lease) throw new LlmError('BUSY', 'LLM capacity is busy; retry later', 429);
	const controller = new AbortController();
	const configuredTimeout = Number(env.LLM_REQUEST_TIMEOUT_MS);
	const timeoutMs = Number.isFinite(configuredTimeout)
		? Math.max(100, Math.min(configuredTimeout, 45_000))
		: 45_000;
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(
			`${env.LLM_BASE_URL ?? 'https://omni.menglabs.id/v1'}/chat/completions`,
			{
				method: 'POST',
				signal: controller.signal,
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
				body: JSON.stringify({
					model: env.LLM_MODEL ?? 'antigravity/claude-opus-4-6-thinking',
					stream: false,
					max_tokens: options.maxTokens,
					temperature: options.temperature,
					messages
				})
			}
		);
		if (!response.ok)
			throw new LlmError(
				'UPSTREAM',
				`LLM returned ${response.status}`,
				response.status === 429 ? 429 : 502
			);
		const data = await response.json();
		const content = data?.choices?.[0]?.message?.content;
		if (typeof content !== 'string' || !content.trim())
			throw new LlmError('INVALID_OUTPUT', 'LLM returned empty output');
		return {
			content,
			usage: data.usage,
			model: env.LLM_MODEL ?? 'antigravity/claude-opus-4-6-thinking'
		};
	} catch (cause) {
		if (cause instanceof LlmError) throw cause;
		if (cause instanceof DOMException && cause.name === 'AbortError')
			throw new LlmError('TIMEOUT', 'LLM request timed out', 504);
		throw new LlmError('UPSTREAM', 'LLM request failed');
	} finally {
		clearTimeout(timeout);
		await releaseConcurrency(lease);
	}
}

export function parseJsonObject(content: string): Record<string, unknown> {
	const cleaned = content
		.trim()
		.replace(/^```json\s*/i, '')
		.replace(/^```\s*/i, '')
		.replace(/\s*```$/i, '')
		.trim();
	try {
		const value = JSON.parse(cleaned);
		if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
		return value;
	} catch {
		throw new LlmError('INVALID_OUTPUT', 'LLM returned invalid JSON');
	}
}
