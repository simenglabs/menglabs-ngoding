import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, createSession, sessionCookie } from '$lib/server/auth';
import { rateLimit } from '$lib/server/rateLimit';
import { readJson, requiredString } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const limited = await rateLimit(`register:${getClientAddress()}`, 5, 60 * 60_000);
	if (limited) return limited;
	const body = await readJson(request);
	const email = requiredString(body, 'email', 254).toLowerCase();
	const password = requiredString(body, 'password', 256);
	const name = requiredString(body, 'name', 100);
	if (password.length < 8) return json({ message: 'password minimum 8 karakter' }, { status: 400 });
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		return json({ message: 'email invalid' }, { status: 400 });
	if ((await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1))[0])
		return json({ message: 'email sudah terdaftar' }, { status: 409 });
	const id = crypto.randomUUID();
	try {
		await db.insert(user).values({ id, email, name, passwordHash: await hashPassword(password) });
	} catch (cause) {
		if (String(cause).toLowerCase().includes('unique'))
			return json({ message: 'email sudah terdaftar' }, { status: 409 });
		console.error('registration failed', cause);
		return json({ message: 'registrasi gagal', code: 'PERSISTENCE_FAILED' }, { status: 500 });
	}
	const created = await createSession(id);
	const cookie = sessionCookie(created.id, created.expiresAt);
	cookies.set(cookie.name, cookie.value, cookie.options);
	return json({ id, email, name }, { status: 201 });
};
