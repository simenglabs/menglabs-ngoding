import { json } from '@sveltejs/kit';
import { COOKIE_NAME, deleteSession } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	const sid = cookies.get(COOKIE_NAME);
	if (sid) await deleteSession(sid);
	cookies.delete(COOKIE_NAME, { path: '/' });
	return json({ success: true });
};
