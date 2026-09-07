import crypto from 'crypto';
import { db } from '$lib/server/db';
import { user, session } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const SESSION_COOKIE = 'menglabs_session';
const SESSION_DAYS = 7;

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.randomBytes(16).toString('hex');
	const hash = await new Promise<Buffer>((res, rej) => crypto.scrypt(password, salt, 64, (e, h) => (e ? rej(e) : res(h as Buffer))));
	return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
	const [salt, hash] = stored.split(':');
	if (!salt || !hash) return false;
	const derived = await new Promise<Buffer>((res, rej) => crypto.scrypt(password, salt, 64, (e, h) => (e ? rej(e) : res(h as Buffer))));
	return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derived);
}

export async function createSession(userId: string) {
	const id = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
	await db.insert(session).values({ id, userId, expiresAt });
	return { id, expiresAt };
}

export async function getUserBySession(sessionId: string) {
	const [s] = await db.select().from(session).where(eq(session.id, sessionId)).limit(1);
	if (!s) return null;
	if (new Date(s.expiresAt).getTime() < Date.now()) {
		await db.delete(session).where(eq(session.id, s.id));
		return null;
	}
	const [u] = await db.select().from(user).where(eq(user.id, s.userId)).limit(1);
	if (!u) return null;
	return { id: u.id, email: u.email, name: u.name };
}

export async function deleteSession(sessionId: string) {
	await db.delete(session).where(eq(session.id, sessionId));
}

export function sessionCookie(sessionId: string, expiresAt: Date) {
	return {
		name: SESSION_COOKIE,
		value: sessionId,
		options: {
			httpOnly: true,
			sameSite: 'lax' as const,
			path: '/',
			expires: expiresAt,
			secure: process.env.NODE_ENV === 'production'
		}
	};
}

export const COOKIE_NAME = SESSION_COOKIE;
