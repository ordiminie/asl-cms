DROP INDEX "rate_limit_event_lookup_idx";--> statement-breakpoint
ALTER TABLE "rate_limit_event" ADD COLUMN "day" date NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limit_event" ADD COLUMN "count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_event_counter_idx" ON "rate_limit_event" USING btree ("organization_id","fingerprint","day");--> statement-breakpoint
ALTER TABLE "rate_limit_event" DROP COLUMN "bucket";--> statement-breakpoint
ALTER TABLE "rate_limit_event" DROP COLUMN "created_at";