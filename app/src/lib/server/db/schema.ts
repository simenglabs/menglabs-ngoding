import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const task = sqliteTable('task', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

export const todo = sqliteTable('todo', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// === Auth ===
export const user = sqliteTable('user', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	passwordHash: text('password_hash').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const session = sqliteTable('session', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

// === PRD Flow: Perencanaan -> Fitur -> SubFitur -> Kanban Task ===
export const perencanaan = sqliteTable('perencanaan', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description').notNull(),
	prompt: text('prompt').notNull(),
	lang: text('lang').notNull().default('Bahasa Indonesia'),
	techMode: text('tech_mode'),
	techStackJson: text('tech_stack_json'),
	questionsJson: text('questions_json'),
	answersJson: text('answers_json'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const fitur = sqliteTable('fitur', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	perencanaanId: text('perencanaan_id')
		.notNull()
		.references(() => perencanaan.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description').notNull(),
	orderIdx: integer('order_idx').notNull().default(0)
});

export const subFitur = sqliteTable('sub_fitur', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	fiturId: text('fitur_id')
		.notNull()
		.references(() => fitur.id, { onDelete: 'cascade' }),
	perencanaanId: text('perencanaan_id')
		.notNull()
		.references(() => perencanaan.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description').notNull(),
	orderIdx: integer('order_idx').notNull().default(0)
});

export const kanbanTask = sqliteTable('kanban_task', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	subFiturId: text('sub_fitur_id')
		.notNull()
		.references(() => subFitur.id, { onDelete: 'cascade' }),
	fiturId: text('fitur_id').notNull(),
	perencanaanId: text('perencanaan_id')
		.notNull()
		.references(() => perencanaan.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description').notNull(),
	priority: text('priority').notNull().default('medium'), // high|medium|low
	estimate: text('estimate').notNull().default('1d'),
	status: text('status').notNull().default('todo'), // backlog|todo|doing|done
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});
