// Shared draft for 2-step flow: ide -> preferensi -> hasil (LLM exec)
export type TechStack = {
	frontend: string;
	backend: string;
	database: string;
	deployment: string;
};

export type Question = {
	id: number;
	text: string;
	type: 'text' | 'single' | 'multi';
	options?: string[];
	placeholder?: string;
	allowCustom?: boolean;
};

export type SubFitur = {
	id: string;
	title: string;
	description: string;
	tasks?: Task[];
};

export type Fitur = {
	id: string;
	title: string;
	description: string;
	subFiturs: SubFitur[];
};

export type Task = {
	id: string;
	title: string;
	description: string;
	priority: 'high' | 'medium' | 'low';
	estimate: string;
	status?: 'backlog' | 'todo' | 'doing' | 'done';
	fiturId?: string;
	fiturTitle?: string;
	subFiturId?: string;
	subFiturTitle?: string;
};

export type Plan = {
	perencanaan: { title: string; description: string };
	fiturs: Fitur[];
};

export type Draft = {
	prompt: string;
	lang: string;
	referensi: boolean;
	techMode: 'ai' | 'manual' | null;
	techStack: TechStack;
	questions?: Question[];
	answers?: Record<number, string | string[]>;
	plan?: Plan;
	dbId?: string; // perencanaan.id di DB
};

const KEY = 'prd_draft';

export function saveDraft(d: Draft) {
	if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(KEY, JSON.stringify(d));
}

export function loadDraft(): Draft | null {
	if (typeof sessionStorage === 'undefined') return null;
	const raw = sessionStorage.getItem(KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as Draft;
	} catch {
		return null;
	}
}

export function clearDraft() {
	if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(KEY);
}

export const defaultStack: TechStack = { frontend: '', backend: '', database: '', deployment: '' };
