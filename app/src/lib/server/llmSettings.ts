import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { env } from '$env/dynamic/private';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { llmSetting } from '$lib/server/db/schema';

export type LlmRuntimeConfig = {
	baseUrl: string;
	model: string;
	apiKey: string;
	timeoutMs: number;
	custom: boolean;
};

const DEFAULT_BASE_URL = 'https://omni.menglabs.id/v1';
const DEFAULT_MODEL = 'antigravity/claude-opus-4-6-thinking';

function credentialKey() {
	const secret = env.LLM_CREDENTIAL_KEY || env.LLM_API_KEY;
	if (!secret) throw new Error('LLM credential encryption is not configured');
	return crypto.createHash('sha256').update(secret).digest();
}

export function encryptApiKey(value: string) {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', credentialKey(), iv);
	const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
	return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
}

function decryptApiKey(value: string) {
	const [version, iv, tag, encrypted] = value.split(':');
	if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('invalid encrypted API key');
	const decipher = crypto.createDecipheriv(
		'aes-256-gcm',
		credentialKey(),
		Buffer.from(iv, 'base64url')
	);
	decipher.setAuthTag(Buffer.from(tag, 'base64url'));
	return Buffer.concat([
		decipher.update(Buffer.from(encrypted, 'base64url')),
		decipher.final()
	]).toString('utf8');
}

export function normalizeBaseUrl(value: string) {
	const parsed = new URL(value.trim());
	if (parsed.username || parsed.password || parsed.search || parsed.hash)
		throw new Error('Base URL tidak boleh berisi kredensial, query, atau hash.');
	if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:')
		throw new Error('Base URL produksi wajib menggunakan HTTPS.');
	if (!['http:', 'https:'].includes(parsed.protocol))
		throw new Error('Base URL harus menggunakan HTTP atau HTTPS.');
	let result = parsed.toString().replace(/\/$/, '');
	result = result.replace(/\/chat\/completions$/i, '');
	if (result.length > 1000) throw new Error('Base URL terlalu panjang.');
	return result;
}

function isPrivateIp(address: string) {
	const normalized = address.toLowerCase();
	if (net.isIPv6(normalized)) {
		return (
			normalized === '::1' ||
			normalized === '::' ||
			normalized.startsWith('fc') ||
			normalized.startsWith('fd') ||
			normalized.startsWith('fe8') ||
			normalized.startsWith('fe9') ||
			normalized.startsWith('fea') ||
			normalized.startsWith('feb') ||
			normalized.startsWith('::ffff:127.') ||
			normalized.startsWith('::ffff:10.') ||
			normalized.startsWith('::ffff:192.168.')
		);
	}
	if (!net.isIPv4(normalized)) return true;
	const [a, b] = normalized.split('.').map(Number);
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		a >= 224 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168)
	);
}

export async function assertSafeLlmBaseUrl(baseUrl: string) {
	if (process.env.NODE_ENV !== 'production') return;
	const hostname = new URL(baseUrl).hostname.toLowerCase();
	if (hostname === 'localhost' || hostname.endsWith('.local'))
		throw new Error('Endpoint jaringan lokal tidak diizinkan.');
	const addresses = net.isIP(hostname)
		? [{ address: hostname }]
		: await dns.lookup(hostname, { all: true });
	if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address)))
		throw new Error('Endpoint LLM harus berada di jaringan publik.');
}

export function serverDefaults() {
	return {
		baseUrl: normalizeBaseUrl(env.LLM_BASE_URL ?? DEFAULT_BASE_URL),
		model: env.LLM_MODEL ?? DEFAULT_MODEL,
		timeoutMs: Math.max(100, Math.min(Number(env.LLM_REQUEST_TIMEOUT_MS) || 45_000, 50_000))
	};
}

export async function getLlmSettings(userId: string) {
	const [setting] = await db
		.select()
		.from(llmSetting)
		.where(eq(llmSetting.userId, userId))
		.limit(1);
	return setting;
}

export async function getLlmRuntimeConfig(userId?: string | null): Promise<LlmRuntimeConfig> {
	const defaults = serverDefaults();
	if (!userId) return { ...defaults, apiKey: env.LLM_API_KEY ?? '', custom: false };
	const setting = await getLlmSettings(userId);
	if (!setting?.enabled) return { ...defaults, apiKey: env.LLM_API_KEY ?? '', custom: false };
	return {
		baseUrl: normalizeBaseUrl(setting.baseUrl),
		model: setting.model,
		apiKey: setting.apiKeyEncrypted ? decryptApiKey(setting.apiKeyEncrypted) : '',
		timeoutMs: Math.max(
			process.env.NODE_ENV === 'test' ? 100 : 5_000,
			Math.min(setting.timeoutMs, 50_000)
		),
		custom: true
	};
}
