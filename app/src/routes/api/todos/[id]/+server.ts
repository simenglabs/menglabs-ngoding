import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async () =>
	json({ message: 'legacy endpoint removed' }, { status: 410 });

export const DELETE: RequestHandler = async () =>
	json({ message: 'legacy endpoint removed' }, { status: 410 });
