CREATE TYPE "public"."member_profile_email_origin" AS ENUM('file', 'site');--> statement-breakpoint
CREATE TYPE "public"."member_profile_email_role" AS ENUM('holder', 'additional');--> statement-breakpoint
CREATE TYPE "public"."member_profile_email_status" AS ENUM('active', 'pending');--> statement-breakpoint
CREATE TABLE "member_profile_email" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_profile_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "member_profile_email_role" NOT NULL,
	"status" "member_profile_email_status" NOT NULL,
	"origin" "member_profile_email_origin" NOT NULL,
	"added_by_user_id" uuid,
	"replaces_email_id" uuid,
	"confirmation_token_hash" text,
	"expires_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_recipient" DROP CONSTRAINT "campaign_recipient_campaign_member_unique";--> statement-breakpoint
DROP INDEX "member_profile_account_profile_idx";--> statement-breakpoint
ALTER TABLE "campaign_recipient" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "member_profile_email" ADD CONSTRAINT "member_profile_email_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_profile_email" ADD CONSTRAINT "member_profile_email_member_profile_id_member_profile_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_profile_email" ADD CONSTRAINT "member_profile_email_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_profile_email" ADD CONSTRAINT "member_profile_email_replaces_email_id_member_profile_email_id_fk" FOREIGN KEY ("replaces_email_id") REFERENCES "public"."member_profile_email"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_profile_email_profile_email_idx" ON "member_profile_email" USING btree ("member_profile_id",lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "member_profile_email_active_holder_idx" ON "member_profile_email" USING btree ("member_profile_id") WHERE "member_profile_email"."role" = 'holder' and "member_profile_email"."status" = 'active';--> statement-breakpoint
CREATE INDEX "member_profile_email_organization_email_idx" ON "member_profile_email" USING btree ("organization_id",lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_recipient_campaign_email_idx" ON "campaign_recipient" USING btree ("campaign_id",lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "member_profile_account_profile_user_idx" ON "member_profile_account" USING btree ("member_profile_id","user_id");