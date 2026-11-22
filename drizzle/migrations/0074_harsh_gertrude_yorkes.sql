ALTER TABLE "campaign" ADD COLUMN "stats_tracked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign" ADD COLUMN "stats_unique_opens" integer;--> statement-breakpoint
ALTER TABLE "campaign" ADD COLUMN "stats_unique_clicks" integer;--> statement-breakpoint
ALTER TABLE "campaign" ADD COLUMN "stats_read_at" timestamp with time zone;