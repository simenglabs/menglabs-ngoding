import { json } from '@sveltejs/kit';
import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { concurrencySlot, rateLimitBucket } from '$lib/server/db/schema';

export async function rateLimit(key: string, limit: number, windowMs: number) {
	const now = Date.now();
	const nextReset = now + windowMs;
	const [current] = await db
		.insert(rateLimitBucket)
		.values({ key, count: 1, resetAt: nextReset })
		.onConflictDoUpdate({
			target: rateLimitBucket.key,
			set: {
				count: sql`case when ${rateLimitBucket.resetAt} <= ${now} then 1 else ${rateLimitBucket.count} + 1 end`,
				resetAt: sql`case when ${rateLimitBucket.resetAt} <= ${now} then ${nextReset} else ${rateLimitBucket.resetAt} end`
			}
		})
		.returning();
	if (current.count > limit) {
		const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
		return json(
			{ message: 'too many requests', code: 'RATE_LIMITED', retryAfter },
			{ status: 429, headers: { 'Retry-After': String(retryAfter) } }
		);
	}
	return null;
}

export type ConcurrencyLease = { key: string; slot: number; leaseId: string };

export async function acquireConcurrency(
	key: string,
	limit: number,
	leaseMs: number
): Promise<ConcurrencyLease | null> {
	const now = Date.now();
	const leaseId = crypto.randomUUID();
	for (let slot = 0; slot < limit; slot++) {
		const [row] = await db
			.insert(concurrencySlot)
			.values({ key, slot, leaseId, expiresAt: now + leaseMs })
			.onConflictDoUpdate({
				target: [concurrencySlot.key, concurrencySlot.slot],
				set: { leaseId, expiresAt: now + leaseMs },
				where: lt(concurrencySlot.expiresAt, now)
			})
			.returning();
		if (row?.leaseId === leaseId) return { key, slot, leaseId };
	}
	return null;
}

export async function releaseConcurrency(lease: ConcurrencyLease) {
	await db
		.delete(concurrencySlot)
		.where(
			and(
				eq(concurrencySlot.key, lease.key),
				eq(concurrencySlot.slot, lease.slot),
				eq(concurrencySlot.leaseId, lease.leaseId)
			)
		);
}
