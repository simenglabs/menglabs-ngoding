import type { Handle } from '@sveltejs/kit';
import { getUserBySession, COOKIE_NAME } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const sid = event.cookies.get(COOKIE_NAME);
	if (sid) {
		const user = await getUserBySession(sid);
		if (user) event.locals.user = user;
		else event.locals.user = null;
	} else {
		event.locals.user = null;
	}
	return resolve(event);
};
