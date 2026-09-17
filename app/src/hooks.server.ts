import { redirect, type Handle } from '@sveltejs/kit';
import { getUserBySession, COOKIE_NAME } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.requestId =
		event.request.headers.get('x-request-id')?.slice(0, 100) || crypto.randomUUID();
	const sid = event.cookies.get(COOKIE_NAME);
	if (sid) {
		const user = await getUserBySession(sid);
		if (user) event.locals.user = user;
		else event.locals.user = null;
	} else {
		event.locals.user = null;
	}
	const protectedPrefixes = [
		'/create',
		'/preferensi',
		'/pertanyaan',
		'/perencanaan',
		'/kanban',
		'/detail',
		'/implementasi',
		'/dashboard',
		'/pengaturan',
		'/hasil'
	];
	if (
		!event.locals.user &&
		protectedPrefixes.some(
			(path) => event.url.pathname === path || event.url.pathname.startsWith(`${path}/`)
		)
	)
		redirect(303, `/login?next=${encodeURIComponent(event.url.pathname + event.url.search)}`);
	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	response.headers.set('X-Request-Id', event.locals.requestId);
	return response;
};
