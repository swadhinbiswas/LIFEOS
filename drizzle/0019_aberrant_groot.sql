ALTER TABLE `contacts` ADD `last_contacted_at` integer;--> statement-breakpoint
ALTER TABLE `contacts` ADD `follow_up_at` integer;--> statement-breakpoint
CREATE INDEX `contacts_user_follow_up_idx` ON `contacts` (`user_id`,`follow_up_at`);