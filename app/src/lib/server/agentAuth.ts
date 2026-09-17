import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { agentToken } from '$lib/server/db/schema';

export type AgentPrincipal = {
	kind: 'admin' | 'token';
	tokenId?: string;
	userId?: string;
	perencanaanId?: string;
};

export function hashAgentSecret(secret: string) {
	return crypto.createHash('sha256').update(secret).digest('hex');
}

export async function requireAgent(request: Request): Promise<AgentPrincipal | null> {
	const auth = request.headers.get('authorization') ?? '';
	const xkey = request.headers.get('x-api-key') ?? '';
	const secret = auth.startsWith('Bearer ') ? auth.slice(7) : xkey;
	if (!secret) return null;
	if (
		env.AGENT_API_KEY &&
		secret.length === env.AGENT_API_KEY.length &&
		crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(env.AGENT_API_KEY))
	)
		return { kind: 'admin' };
	const [row] = await db
		.select()
		.from(agentToken)
		.where(
			and(
				eq(agentToken.tokenHash, hashAgentSecret(secret)),
				isNull(agentToken.revokedAt),
				gt(agentToken.expiresAt, new Date())
			)
		)
		.limit(1);
	return row
		? { kind: 'token', tokenId: row.id, userId: row.userId, perencanaanId: row.perencanaanId }
		: null;
}
