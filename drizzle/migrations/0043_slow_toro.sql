CREATE TYPE "public"."campaign_recipient_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('sending', 'sent', 'interrupted');--> statement-breakpoint
CREATE TABLE "campaign" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"preheader" text,
	"body_markdown" text NOT NULL,
	"template_id" text,
	"target_kind" text NOT NULL,
	"recipient_count" integer NOT NULL,
	"without_email_count" integer NOT NULL,
	"unsubscribed_count" integer NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"status" "campaign_status" NOT NULL,
	"send_date" date NOT NULL,
	"author_user_id" uuid,
	"author_name" text,
	"on_behalf_of_user_id" uuid,
	"on_behalf_of_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "campaign_organization_submission_unique" UNIQUE("organization_id","submission_id")
);
--> statement-breakpoint
CREATE TABLE "campaign_recipient" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"member_profile_id" uuid,
	"status" "campaign_recipient_status" DEFAULT 'pending' NOT NULL,
	"unsubscribe_token" text NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "campaign_recipient_campaign_member_unique" UNIQUE("campaign_id","member_profile_id"),
	CONSTRAINT "campaign_recipient_organization_token_unique" UNIQUE("organization_id","unsubscribe_token")
);
--> statement-breakpoint
CREATE TABLE "member_unsubscribe" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_profile_id" uuid NOT NULL,
	"campaign_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_unsubscribe_organization_member_unique" UNIQUE("organization_id","member_profile_id")
);
--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_on_behalf_of_user_id_user_id_fk" FOREIGN KEY ("on_behalf_of_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipient" ADD CONSTRAINT "campaign_recipient_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipient" ADD CONSTRAINT "campaign_recipient_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipient" ADD CONSTRAINT "campaign_recipient_member_profile_id_member_profile_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_unsubscribe" ADD CONSTRAINT "member_unsubscribe_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_unsubscribe" ADD CONSTRAINT "member_unsubscribe_member_profile_id_member_profile_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_unsubscribe" ADD CONSTRAINT "member_unsubscribe_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_organization_created_idx" ON "campaign" USING btree ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "campaign_recipient_campaign_status_idx" ON "campaign_recipient" USING btree ("campaign_id","status");