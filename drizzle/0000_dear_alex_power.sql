CREATE TABLE `handoffs` (
	`id` text PRIMARY KEY NOT NULL,
	`sealed` text,
	`revoke_hash` text NOT NULL,
	`client_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `handoffs_expiry` ON `handoffs` (`expires_at`);--> statement-breakpoint
CREATE INDEX `handoffs_client` ON `handoffs` (`client_hash`);