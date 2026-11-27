ALTER TYPE "public"."member_profile_email_status" ADD VALUE 'disabled_by_import';--> statement-breakpoint
ALTER TABLE "member_profile" ADD COLUMN "pennylane_import_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "member_profile" ADD COLUMN "pennylane_imported_at" timestamp with time zone;