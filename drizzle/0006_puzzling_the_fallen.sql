CREATE TABLE `dashboard_widgets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`variant` text NOT NULL,
	`widget_id` text NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dashboard_widgets_unq` ON `dashboard_widgets` (`user_id`,`variant`,`widget_id`);--> statement-breakpoint
CREATE INDEX `dashboard_widgets_user_variant_idx` ON `dashboard_widgets` (`user_id`,`variant`);