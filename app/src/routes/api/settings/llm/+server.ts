import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { llmSetting } from '$lib/server/db/schema';
import { readJson, requireUser, requiredString } from '$lib/server/http';
import { chatCompletion, LlmError } from '$lib/server/llm';
import {
	assertSafeLlmBaseUrl,
	encryptApiKey,
	getLlmSettings,
	normalizeBaseUrl,
	serverDefaults
} from '$lib/server/llmSettings';
import { rateLimit } from '$lib/server/rateLimit';
import type { RequestHandler } from './$types';

function view(setting: typeof llmSetting.$inferSelect | undefined) {
	return {
		mode: setting?.enabled ? 'custom' : 'server',
		custom: setting
			? {
					baseUrl: setting.baseUrl,
					model: setting.model,
					timeoutMs: setting.timeoutMs,
					hasApiKey: Boolean(setting.apiKeyEncrypted)
				}
			: null,
		server: serverDefaults()
	};
}

export const GET: RequestHandler = async ({ locals }) => {
	const current = requireUser(locals.user);
	return json(view(await getLlmSettings(current.id)));
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const current = requireUser(locals.user);
	const body = await readJson(request);
	if (body.mode === 'server') {
		await db.delete(llmSetting).where(eq(llmSetting.userId, current.id));
		return json(view(undefined));
	}
	if (body.mode !== 'custom') return json({ message: 'Mode LLM tidak valid.' }, { status: 400 });
	try {
		const baseUrl = normalizeBaseUrl(requiredString(body, 'baseUrl', 1000));
		await assertSafeLlmBaseUrl(baseUrl);
		const model = requiredString(body, 'model', 200);
		const parsedTimeout = Number(body.timeoutMs);
		const minimumTimeout = process.env.NODE_ENV === 'test' ? 100 : 5000;
		if (!Number.isInteger(parsedTimeout) || parsedTimeout < minimumTimeout || parsedTimeout > 50000)
			return json({ message: 'Timeout harus antara 5 dan 50 detik.' }, { status: 400 });
		const currentSetting = await getLlmSettings(current.id);
		const suppliedKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
		const apiKeyEncrypted = body.clearApiKey
			? null
			: suppliedKey
				? encryptApiKey(suppliedKey)
				: (currentSetting?.apiKeyEncrypted ?? null);
		const [saved] = await db
			.insert(llmSetting)
			.values({
				userId: current.id,
				enabled: true,
				baseUrl,
				model,
				apiKeyEncrypted,
				timeoutMs: parsedTimeout,
				updatedAt: new Date()
			})
			.onConflictDoUpdate({
				target: llmSetting.userId,
				set: {
					enabled: true,
					baseUrl,
					model,
					apiKeyEncrypted,
					timeoutMs: parsedTimeout,
					updatedAt: new Date()
				}
			})
			.returning();
		return json(view(saved));
	} catch (cause) {
		return json(
			{ message: cause instanceof Error ? cause.message : 'Konfigurasi LLM tidak valid.' },
			{ status: 400 }
		);
	}
};

export const POST: RequestHandler = async ({ locals }) => {
	const current = requireUser(locals.user);
	const limited = await rateLimit(`llm-settings-test:${current.id}`, 5, 10 * 60_000);
	if (limited) return limited;
	try {
		const completion = await chatCompletion(
			[
				{ role: 'system', content: 'Balas dengan tepat: koneksi berhasil' },
				{ role: 'user', content: 'Tes koneksi.' }
			],
			{ maxTokens: 30, temperature: 0 },
			current.id
		);
		return json({ ok: true, model: completion.model });
	} catch (cause) {
		if (cause instanceof LlmError)
			return json({ message: cause.message, code: cause.code }, { status: cause.status });
		return json({ message: 'Koneksi LLM gagal.' }, { status: 502 });
	}
};
