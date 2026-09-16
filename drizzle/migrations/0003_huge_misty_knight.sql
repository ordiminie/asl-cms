CREATE TYPE "public"."organization_module" AS ENUM('vote', 'voirie', 'annonces');--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "domain" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "enabled_modules" "organization_module"[] DEFAULT '{}'::organization_module[] NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_domain_unique" UNIQUE("domain");