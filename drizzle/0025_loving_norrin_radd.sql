CREATE TABLE `growth_plan_links` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `growth_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `growth_plan_links_plan_idx` ON `growth_plan_links` (`plan_id`);--> statement-breakpoint
CREATE TABLE `growth_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`dimension_id` text NOT NULL,
	`title` text NOT NULL,
	`why` text,
	`target_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `growth_plans_user_dim_idx` ON `growth_plans` (`user_id`,`dimension_id`);--> statement-breakpoint
CREATE TABLE `growth_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`cadence` text NOT NULL,
	`review_date` text NOT NULL,
	`notes_json` text DEFAULT '{}' NOT NULL,
	`snapshot_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `growth_reviews_user_cadence_idx` ON `growth_reviews` (`user_id`,`cadence`,`review_date`);