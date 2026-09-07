import { env } from '$env/dynamic/private';

export function checkAgentAuth(request: Request): { ok: boolean; reason?: string } {
	const key = env.AGENT_API_KEY;
	if (!key) return { ok: true }; // jika tidak set, open (dev)
	const auth = request.headers.get('authorization') ?? '';
	const xkey = request.headers.get('x-api-key') ?? '';
	const token = auth.startsWith('Bearer ') ? auth.slice(7) : xkey;
	if (token !== key) return { ok: false, reason: 'invalid AGENT_API_KEY' };
	return { ok: true };
}
