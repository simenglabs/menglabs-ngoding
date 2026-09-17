import { env } from '$env/dynamic/private';
import { acquireConcurrency, releaseConcurrency } from '$lib/server/rateLimit';
import { assertSafeLlmBaseUrl, getLlmRuntimeConfig } from '$lib/server/llmSettings';

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
	options: { maxTokens: number; temperature: number },
	userId?: string | null
) {
	let config;
	try {
		config = await getLlmRuntimeConfig(userId);
		if (!config.custom && !config.apiKey) throw new Error('server API key missing');
		if (config.custom) await assertSafeLlmBaseUrl(config.baseUrl);
	} catch (cause) {
		console.error('LLM configuration failed', cause);
		throw new LlmError('CONFIG', 'Konfigurasi LLM tidak valid. Periksa pengaturan LLM.', 503);
	}
	const lease = await acquireConcurrency(
		'llm-provider',
		Math.max(1, Math.min(Number(env.LLM_MAX_CONCURRENCY) || 4, 20)),
		60_000
	);
	if (!lease) throw new LlmError('BUSY', 'LLM capacity is busy; retry later', 429);
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
	try {
		const response = await fetch(`${config.baseUrl}/chat/completions`, {
			method: 'POST',
			redirect: 'error',
			signal: controller.signal,
			headers: {
				'Content-Type': 'application/json',
				...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
			},
			body: JSON.stringify({
				model: config.model,
				stream: false,
				max_tokens: options.maxTokens,
				temperature: options.temperature,
				messages
			})
		});
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
			model: config.model
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
