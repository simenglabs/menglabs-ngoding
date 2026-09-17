CREATE TABLE `agent_token` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`perencanaan_id` text NOT NULL,
	`name` text DEFAULT 'Local agent' NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`perencanaan_id`) REFERENCES `perencanaan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_token_hash_idx` ON `agent_token` (`token_hash`);--> statement-breakpoint
CREATE INDEX `agent_token_scope_idx` ON `agent_token` (`user_id`,`perencanaan_id`);--> statement-breakpoint
CREATE TABLE `fitur` (
	`id` text PRIMARY KEY NOT NULL,
	`perencanaan_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`order_idx` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`perencanaan_id`) REFERENCES `perencanaan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fitur_plan_order_idx` ON `fitur` (`perencanaan_id`,`order_idx`);--> statement-breakpoint
CREATE TABLE `kanban_task` (
	`id` text PRIMARY KEY NOT NULL,
	`sub_fitur_id` text NOT NULL,
	`fitur_id` text NOT NULL,
	`perencanaan_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`estimate` text DEFAULT '1d' NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`claimed_by` text,
	`claim_token_hash` text,
	`lease_expires_at` integer,
	`result_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`sub_fitur_id`) REFERENCES `sub_fitur`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`perencanaan_id`) REFERENCES `perencanaan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kanban_plan_status_created_idx` ON `kanban_task` (`perencanaan_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `kanban_sub_feature_idx` ON `kanban_task` (`sub_fitur_id`);--> statement-breakpoint
CREATE INDEX `kanban_lease_idx` ON `kanban_task` (`status`,`lease_expires_at`);--> statement-breakpoint
CREATE TABLE `perencanaan` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`prompt` text NOT NULL,
	`lang` text DEFAULT 'Bahasa Indonesia' NOT NULL,
	`tech_mode` text,
	`tech_stack_json` text,
	`questions_json` text,
	`answers_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `perencanaan_user_created_idx` ON `perencanaan` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `prd_document` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`perencanaan_id` text,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`model` text NOT NULL,
	`usage_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`perencanaan_id`) REFERENCES `perencanaan`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `prd_user_created_idx` ON `prd_document` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_expiry_idx` ON `session` (`expires_at`);--> statement-breakpoint
CREATE TABLE `sub_fitur` (
	`id` text PRIMARY KEY NOT NULL,
	`fitur_id` text NOT NULL,
	`perencanaan_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`order_idx` integer DEFAULT 0 NOT NULL,
	`tasks_generated_at` integer,
	FOREIGN KEY (`fitur_id`) REFERENCES `fitur`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`perencanaan_id`) REFERENCES `perencanaan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sub_fitur_feature_order_idx` ON `sub_fitur` (`fitur_id`,`order_idx`);--> statement-breakpoint
CREATE TABLE `task` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`priority` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `todo` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);