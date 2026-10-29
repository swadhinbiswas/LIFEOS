CREATE TABLE `email_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`host` text NOT NULL,
	`port` integer DEFAULT 993 NOT NULL,
	`username` text NOT NULL,
	`password_encrypted` text NOT NULL,
	`mailbox` text DEFAULT 'INBOX' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `email_accounts_user_idx` ON `email_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `email_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`messages_json` text DEFAULT '[]' NOT NULL,
	`summary_date` text,
	`summary_at` integer,
	`summary_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `email_cache_user_idx` ON `email_cache` (`user_id`);