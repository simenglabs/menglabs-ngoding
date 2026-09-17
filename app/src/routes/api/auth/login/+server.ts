import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, createSession, sessionCookie } from '$lib/server/auth';
import { rateLimit } from '$lib/server/rateLimit';
import { readJson, requiredString } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const limited = await rateLimit(`login:${getClientAddress()}`, 10, 15 * 60_000);
	if (limited) return limited;
	const body = await readJson(request);
	const email = requiredString(body, 'email', 254).toLowerCase();
	const password = requiredString(body, 'password', 256);
	const [u] = await db.select().from(user).where(eq(user.email, email)).limit(1);
	if (!u || !(await verifyPassword(u.passwordHash, password)))
		return json({ message: 'email atau password salah' }, { status: 401 });
	const { id, expiresAt } = await createSession(u.id);
	const cookie = sessionCookie(id, expiresAt);
	cookies.set(cookie.name, cookie.value, cookie.options);
	return json({ id: u.id, email: u.email, name: u.name });
};
