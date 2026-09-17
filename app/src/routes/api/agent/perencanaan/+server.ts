import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { perencanaan } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { requireAgent } from '$lib/server/agentAuth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const principal = await requireAgent(request);
	if (!principal) return json({ message: 'invalid agent token' }, { status: 401 });
	const rows =
		principal.kind === 'token'
			? await db
					.select()
					.from(perencanaan)
					.where(eq(perencanaan.id, principal.perencanaanId!))
					.limit(1)
			: await db.select().from(perencanaan).limit(50);
	return json(rows);
};
