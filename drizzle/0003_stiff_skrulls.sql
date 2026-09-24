ALTER TABLE `achievements` ADD `is_demo` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `is_demo` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `skills` ADD `is_demo` integer DEFAULT false NOT NULL;