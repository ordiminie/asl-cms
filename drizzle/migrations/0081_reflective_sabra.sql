ALTER TYPE "public"."campaign_recipient_status" ADD VALUE 'superseded';--> statement-breakpoint
ALTER TABLE "campaign" ADD COLUMN "letter_text" text;