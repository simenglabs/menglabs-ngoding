export type GeneratedTaskInput = {
	title: string;
	description: string;
	priority: 'high' | 'medium' | 'low';
	estimate: string;
};

export const SCAFFOLD_TASK_TITLE = 'WAJIB: Buat kerangka frontend dan backend';

export function scaffoldTask(techStack: unknown): GeneratedTaskInput {
	const stack =
		techStack && typeof techStack === 'object' ? (techStack as Record<string, unknown>) : {};
	const frontend =
		typeof stack.frontend === 'string' && stack.frontend.trim() ? stack.frontend : 'sesuai PRD';
	const backend =
		typeof stack.backend === 'string' && stack.backend.trim() ? stack.backend : 'sesuai PRD';
	return {
		title: SCAFFOLD_TASK_TITLE,
		description: `Inisialisasi kerangka proyek sebelum fitur lain dikerjakan. Siapkan struktur frontend (${frontend}) dan backend (${backend}), konfigurasi environment contoh, koneksi dasar frontend ke backend, serta command development dan pemeriksaan awal yang dapat dijalankan.`,
		priority: 'high',
		estimate: '1d'
	};
}

export function prependScaffold(
	tasks: GeneratedTaskInput[],
	techStack: unknown
): GeneratedTaskInput[] {
	return [
		scaffoldTask(techStack),
		...tasks.filter((task) => task.title !== SCAFFOLD_TASK_TITLE)
	].slice(0, 8);
}
