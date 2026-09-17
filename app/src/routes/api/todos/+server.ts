import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () =>
	json({ message: 'legacy endpoint removed' }, { status: 410 });

export const POST: RequestHandler = async () =>
	json({ message: 'legacy endpoint removed' }, { status: 410 });
