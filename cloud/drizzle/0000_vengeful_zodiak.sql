CREATE TABLE `attendance` (
	`meeting` text NOT NULL,
	`user` text NOT NULL,
	`joined` integer NOT NULL,
	`seen` integer NOT NULL,
	`left` integer,
	PRIMARY KEY(`meeting`, `user`),
	FOREIGN KEY (`meeting`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`kind` text NOT NULL,
	`duration` integer NOT NULL,
	`room` text NOT NULL,
	`closed` integer,
	`created` integer NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recordings` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting` text NOT NULL,
	`owner` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`size` integer NOT NULL,
	FOREIGN KEY (`meeting`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recordings_expiry` ON `recordings` (`expires`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`created` integer NOT NULL
);
