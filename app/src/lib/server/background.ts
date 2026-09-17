import { waitUntil } from '@vercel/functions';

export function scheduleBackground(task: Promise<unknown>) {
	if (process.env.VERCEL) waitUntil(task);
	else void task.catch((cause) => console.error('background task failed', cause));
}
