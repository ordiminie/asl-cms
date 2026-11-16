ALTER TABLE "member_unsubscribe" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "member_unsubscribe" CASCADE;--> statement-breakpoint
DROP INDEX "member_profile_organization_email_idx";--> statement-breakpoint
ALTER TABLE "campaign_recipient" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "member_profile" DROP COLUMN "mail_only";