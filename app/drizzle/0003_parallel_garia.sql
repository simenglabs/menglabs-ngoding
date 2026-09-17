CREATE TABLE `llm_setting` (
	`user_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`base_url` text NOT NULL,
	`model` text NOT NULL,
	`api_key_encrypted` text,
	`timeout_ms` integer DEFAULT 45000 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
