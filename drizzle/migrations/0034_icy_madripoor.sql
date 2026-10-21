ALTER TABLE "verification" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()::text;