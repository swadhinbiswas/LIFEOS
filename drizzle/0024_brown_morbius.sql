CREATE TABLE `obligation_decisions` (
	`occurrence_id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`linked_transaction_id` text,
	`decided_at` integer,
	`rejection_note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `obligation_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `obligation_decisions_plan_idx` ON `obligation_decisions` (`plan_id`);--> statement-breakpoint
CREATE TABLE `obligation_history` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`occurrence_id` text,
	`action` text NOT NULL,
	`details` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `obligation_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `obligation_history_plan_idx` ON `obligation_history` (`plan_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `obligation_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`direction` text DEFAULT 'debt' NOT NULL,
	`name` text NOT NULL,
	`person` text,
	`notes` text,
	`schedule_type` text DEFAULT 'one_time' NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`cadence` text,
	`interval_count` integer DEFAULT 1 NOT NULL,
	`total_payments` integer,
	`end_date` text,
	`start_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`optional_subscription` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `obligation_plans_user_idx` ON `obligation_plans` (`user_id`,`status`);