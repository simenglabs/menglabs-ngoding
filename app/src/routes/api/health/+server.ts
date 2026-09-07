import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({ status: 'ok', time: new Date().toISOString(), svelte: '5', kit: '2' });
};
