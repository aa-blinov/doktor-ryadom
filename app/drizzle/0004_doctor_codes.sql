CREATE TABLE `doctor_codes` (
	`user_id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `doctor_codes_code_unique` ON `doctor_codes` (`code`);
