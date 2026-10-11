CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`doctor_id` text NOT NULL,
	`from_date` text NOT NULL,
	`to_date` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer,
	FOREIGN KEY (`patient_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
