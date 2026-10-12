CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting` text NOT NULL,
	`user` text NOT NULL,
	`joined` integer NOT NULL,
	`seen` integer NOT NULL,
	`left` integer,
	`reason` text,
	FOREIGN KEY (`meeting`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `visits_meeting_user` ON `visits` (`meeting`,`user`);
--> statement-breakpoint
INSERT INTO visits(id,meeting,user,joined,seen,left,reason) SELECT 'legacy-' || lower(hex(randomblob(16))),meeting,user,joined,seen,left,'legacy' FROM attendance;
