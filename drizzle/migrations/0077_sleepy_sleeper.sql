ALTER TYPE "public"."campaign_recipient_status" ADD VALUE 'settled';--> statement-breakpoint
CREATE TABLE "unpaid_reminder" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"due_on" date NOT NULL,
	"rank" integer NOT NULL,
	"campaign_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unpaid_reminder_organization_due_on_rank_unique" UNIQUE("organization_id","due_on","rank"),
	CONSTRAINT "unpaid_reminder_rank_check" CHECK ("unpaid_reminder"."rank" between 1 and 3)
);
--> statement-breakpoint
ALTER TABLE "unpaid_reminder" ADD CONSTRAINT "unpaid_reminder_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unpaid_reminder" ADD CONSTRAINT "unpaid_reminder_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;