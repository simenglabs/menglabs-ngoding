import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, createSession, sessionCookie } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { email, password, name } = await request.json();
	if (!email || !password || !name) return json({ message: 'email, password, name required' }, { status: 400 });
	if (password.length < 6) return json({ message: 'password min 6' }, { status: 400 });
	if (!email.includes('@')) return json({ message: 'email invalid' }, { status: 400 });

	const [exists] = await db.select().from(user).where(eq(user.email, email.toLowerCase())).limit(1);
	if (exists) return json({ message: 'email sudah terdaftar' }, { status: 409 });

	const passwordHash = await hashPassword(password);
	const id = crypto.randomUUID();
	await db.insert(user).values({ id, email: email.toLowerCase(), name: name.trim(), passwordHash });

	const { id: sid, expiresAt } = await createSession(id);
	const c = sessionCookie(sid, expiresAt);
	cookies.set(c.name, c.value, c.options);

	return json({ id, email: email.toLowerCase(), name: name.trim() }, { status: 201 });
};
