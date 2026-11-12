CREATE TYPE "public"."campaign_part_status" AS ENUM('scheduled', 'sending', 'sent', 'failed');--> statement-breakpoint
ALTER TYPE "public"."campaign_recipient_status" ADD VALUE 'sending';--> statement-breakpoint
ALTER TYPE "public"."campaign_recipient_status" ADD VALUE 'to_verify';--> statement-breakpoint
ALTER TYPE "public"."campaign_recipient_status" ADD VALUE 'unsubscribed';--> statement-breakpoint
CREATE TABLE "campaign_part" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"scheduled_for" date NOT NULL,
	"recipient_count" integer NOT NULL,
	"status" "campaign_part_status" DEFAULT 'scheduled' NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "campaign_part_campaign_number_unique" UNIQUE("campaign_id","number")
);
--> statement-breakpoint
CREATE TABLE "scheduled_job" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"run_after" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scheduled_job_organization_kind_key_unique" UNIQUE("organization_id","kind","idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "campaign_recipient" ADD COLUMN "part_id" uuid;--> statement-breakpoint
ALTER TABLE "campaign_recipient" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaign_part" ADD CONSTRAINT "campaign_part_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_part" ADD CONSTRAINT "campaign_part_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_job" ADD CONSTRAINT "scheduled_job_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_part_organization_day_idx" ON "campaign_part" USING btree ("organization_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "scheduled_job_due_idx" ON "scheduled_job" USING btree ("organization_id","run_after") WHERE "scheduled_job"."completed_at" is null and "scheduled_job"."failed_at" is null;--> statement-breakpoint
ALTER TABLE "campaign_recipient" ADD CONSTRAINT "campaign_recipient_part_id_campaign_part_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."campaign_part"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_recipient_part_status_idx" ON "campaign_recipient" USING btree ("part_id","status");