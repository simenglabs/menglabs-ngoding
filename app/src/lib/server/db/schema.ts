import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';

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

export const session = sqliteTable(
	'session',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('session_user_idx').on(table.userId),
		index('session_expiry_idx').on(table.expiresAt)
	]
);

// === PRD Flow: Perencanaan -> Fitur -> SubFitur -> Kanban Task ===
export const perencanaan = sqliteTable(
	'perencanaan',
	{
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
	},
	(table) => [index('perencanaan_user_created_idx').on(table.userId, table.createdAt)]
);

export const fitur = sqliteTable(
	'fitur',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		perencanaanId: text('perencanaan_id')
			.notNull()
			.references(() => perencanaan.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		description: text('description').notNull(),
		orderIdx: integer('order_idx').notNull().default(0)
	},
	(table) => [index('fitur_plan_order_idx').on(table.perencanaanId, table.orderIdx)]
);

export const subFitur = sqliteTable(
	'sub_fitur',
	{
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
		orderIdx: integer('order_idx').notNull().default(0),
		tasksGeneratedAt: integer('tasks_generated_at', { mode: 'timestamp' })
	},
	(table) => [index('sub_fitur_feature_order_idx').on(table.fiturId, table.orderIdx)]
);

export const kanbanTask = sqliteTable(
	'kanban_task',
	{
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
		claimedBy: text('claimed_by'),
		claimTokenHash: text('claim_token_hash'),
		leaseExpiresAt: integer('lease_expires_at', { mode: 'timestamp' }),
		resultJson: text('result_json'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		index('kanban_plan_status_created_idx').on(table.perencanaanId, table.status, table.createdAt),
		index('kanban_sub_feature_idx').on(table.subFiturId),
		index('kanban_lease_idx').on(table.status, table.leaseExpiresAt)
	]
);

export const agentToken = sqliteTable(
	'agent_token',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		perencanaanId: text('perencanaan_id')
			.notNull()
			.references(() => perencanaan.id, { onDelete: 'cascade' }),
		name: text('name').notNull().default('Local agent'),
		tokenHash: text('token_hash').notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		revokedAt: integer('revoked_at', { mode: 'timestamp' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		uniqueIndex('agent_token_hash_idx').on(table.tokenHash),
		index('agent_token_scope_idx').on(table.userId, table.perencanaanId)
	]
);

export const prdDocument = sqliteTable(
	'prd_document',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		perencanaanId: text('perencanaan_id').references(() => perencanaan.id, {
			onDelete: 'set null'
		}),
		title: text('title').notNull(),
		content: text('content').notNull(),
		model: text('model').notNull(),
		usageJson: text('usage_json'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [index('prd_user_created_idx').on(table.userId, table.createdAt)]
);

export const rateLimitBucket = sqliteTable('rate_limit_bucket', {
	key: text('key').primaryKey(),
	count: integer('count').notNull(),
	resetAt: integer('reset_at').notNull()
});

export const concurrencySlot = sqliteTable(
	'concurrency_slot',
	{
		key: text('key').notNull(),
		slot: integer('slot').notNull(),
		leaseId: text('lease_id').notNull(),
		expiresAt: integer('expires_at').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.key, table.slot] }),
		index('concurrency_expiry_idx').on(table.key, table.expiresAt)
	]
);
