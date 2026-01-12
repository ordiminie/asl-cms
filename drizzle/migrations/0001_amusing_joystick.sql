ALTER TYPE "public"."credit_source" ADD VALUE 'refund';--> statement-breakpoint
ALTER TABLE "credit_ledger" ALTER COLUMN "source_id" SET DATA TYPE text;