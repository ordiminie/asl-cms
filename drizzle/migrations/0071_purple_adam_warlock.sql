CREATE TYPE "public"."campaign_nature" AS ENUM('facultative', 'statutaire');--> statement-breakpoint
ALTER TABLE "campaign" ADD COLUMN "nature" "campaign_nature" DEFAULT 'facultative' NOT NULL;