CREATE TABLE `profile_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category` text NOT NULL,
	`entry` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`data` text NOT NULL,
	`shared` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
