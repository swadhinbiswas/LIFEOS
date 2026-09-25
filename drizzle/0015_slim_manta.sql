CREATE TABLE `activity_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`secret_encrypted` text NOT NULL,
	`hint` text NOT NULL,
	`last_synced_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_connections_user_provider_unq` ON `activity_connections` (`user_id`,`provider`);--> statement-breakpoint
CREATE TABLE `code_activity_daily` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`total_seconds` real DEFAULT 0 NOT NULL,
	`ai_additions` integer DEFAULT 0 NOT NULL,
	`ai_deletions` integer DEFAULT 0 NOT NULL,
	`human_additions` integer DEFAULT 0 NOT NULL,
	`human_deletions` integer DEFAULT 0 NOT NULL,
	`ai_cost_usd` real DEFAULT 0 NOT NULL,
	`languages` text DEFAULT '[]' NOT NULL,
	`editors` text DEFAULT '[]' NOT NULL,
	`projects` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `code_activity_daily_user_day_unq` ON `code_activity_daily` (`user_id`,`day`);--> statement-breakpoint
CREATE INDEX `code_activity_daily_user_day_idx` ON `code_activity_daily` (`user_id`,`day`);