import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, createSession, sessionCookie } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { email, password } = await request.json();
	if (!email || !password) return json({ message: 'email & password required' }, { status: 400 });

	const [u] = await db.select().from(user).where(eq(user.email, email.toLowerCase())).limit(1);
	if (!u) return json({ message: 'email atau password salah' }, { status: 401 });

	const ok = await verifyPassword(u.passwordHash, password);
	if (!ok) return json({ message: 'email atau password salah' }, { status: 401 });

	const { id: sid, expiresAt } = await createSession(u.id);
	const c = sessionCookie(sid, expiresAt);
	cookies.set(c.name, c.value, c.options);

	return json({ id: u.id, email: u.email, name: u.name });
};
