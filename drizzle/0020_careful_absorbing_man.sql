CREATE TABLE `weather_cache` (
	`user_id` text PRIMARY KEY NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`place` text,
	`temperature_c` real,
	`code` integer,
	`is_day` integer,
	`observed_at` integer NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `user_settings` ADD `weather_lat` real;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `weather_lon` real;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `weather_place` text;