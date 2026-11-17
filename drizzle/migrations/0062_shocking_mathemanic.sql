ALTER TABLE "member_profile" RENAME COLUMN "address_line" TO "home_address_line";--> statement-breakpoint
ALTER TABLE "member_profile" RENAME COLUMN "address_complement" TO "home_address_complement";--> statement-breakpoint
ALTER TABLE "member_profile" RENAME COLUMN "postal_code" TO "home_postal_code";--> statement-breakpoint
ALTER TABLE "member_profile" RENAME COLUMN "city" TO "home_city";--> statement-breakpoint
ALTER TABLE "member_profile" ADD COLUMN "land_address_line" text;--> statement-breakpoint
ALTER TABLE "member_profile" ADD COLUMN "land_address_complement" text;--> statement-breakpoint
ALTER TABLE "member_profile" ADD COLUMN "land_postal_code" text;--> statement-breakpoint
ALTER TABLE "member_profile" ADD COLUMN "land_city" text;--> statement-breakpoint
ALTER TABLE "member_profile" ADD COLUMN "company_name" text;