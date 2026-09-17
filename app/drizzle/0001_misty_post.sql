CREATE TABLE `concurrency_slot` (
	`key` text NOT NULL,
	`slot` integer NOT NULL,
	`lease_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`key`, `slot`)
);
--> statement-breakpoint
CREATE INDEX `concurrency_expiry_idx` ON `concurrency_slot` (`key`,`expires_at`);--> statement-breakpoint
CREATE TABLE `rate_limit_bucket` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
