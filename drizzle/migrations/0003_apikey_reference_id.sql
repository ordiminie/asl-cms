ALTER TABLE "apikey" RENAME COLUMN "user_id" TO "reference_id";--> statement-breakpoint
ALTER TABLE "apikey" RENAME CONSTRAINT "apikey_user_id_user_id_fk" TO "apikey_reference_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "config_id" text DEFAULT 'default' NOT NULL;
