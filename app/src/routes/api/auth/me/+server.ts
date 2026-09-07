import { json } from '@sveltejs/kit';
import { getUserBySession, COOKIE_NAME } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const sid = cookies.get(COOKIE_NAME);
	if (!sid) return json({ user: null });
	const user = await getUserBySession(sid);
	return json({ user: user ?? null });
};
