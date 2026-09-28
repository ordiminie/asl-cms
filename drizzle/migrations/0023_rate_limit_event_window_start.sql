DROP INDEX "rate_limit_event_counter_idx";--> statement-breakpoint
ALTER TABLE "rate_limit_event" ADD COLUMN "window_start" timestamp with time zone NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_event_counter_idx" ON "rate_limit_event" USING btree ("organization_id","fingerprint","window_start");--> statement-breakpoint
ALTER TABLE "rate_limit_event" DROP COLUMN "day";