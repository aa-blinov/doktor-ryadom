CREATE TABLE `survey_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`doctor_id` text NOT NULL,
	`definition` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`doctor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `assessments` ADD `definition` text;
