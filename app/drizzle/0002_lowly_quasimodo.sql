CREATE TABLE `planning_job` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`perencanaan_id` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`stage` text DEFAULT 'outline' NOT NULL,
	`input_json` text NOT NULL,
	`worker_token_hash` text NOT NULL,
	`current_part` integer DEFAULT 0 NOT NULL,
	`total_parts` integer DEFAULT 1 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`error_code` text,
	`error_message` text,
	`lease_expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`perencanaan_id`) REFERENCES `perencanaan`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `planning_job_user_created_idx` ON `planning_job` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `planning_job_status_lease_idx` ON `planning_job` (`status`,`lease_expires_at`);