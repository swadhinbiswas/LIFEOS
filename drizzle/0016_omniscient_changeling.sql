ALTER TABLE `companies` ADD `career_page` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `linkedin` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `relationship` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `target_country` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `interviews` ADD `due_at` integer;--> statement-breakpoint
ALTER TABLE `interviews` ADD `status` text DEFAULT 'planned' NOT NULL;--> statement-breakpoint
ALTER TABLE `interviews` ADD `outcome` text;--> statement-breakpoint
ALTER TABLE `interviews` ADD `preparation` text;--> statement-breakpoint
CREATE INDEX `interviews_user_due_idx` ON `interviews` (`user_id`,`due_at`);--> statement-breakpoint
ALTER TABLE `job_applications` ADD `contact_id` text REFERENCES contacts(id);--> statement-breakpoint
ALTER TABLE `job_applications` ADD `next_action` text;--> statement-breakpoint
ALTER TABLE `job_applications` ADD `next_action_due` integer;--> statement-breakpoint
ALTER TABLE `job_applications` ADD `apply_by` integer;--> statement-breakpoint
ALTER TABLE `job_applications` ADD `date_applied` integer;--> statement-breakpoint
ALTER TABLE `job_applications` ADD `seniority` text;--> statement-breakpoint
ALTER TABLE `job_applications` ADD `apply_email` text;--> statement-breakpoint
ALTER TABLE `job_applications` ADD `req_id` text;--> statement-breakpoint
ALTER TABLE `job_applications` ADD `location` text;