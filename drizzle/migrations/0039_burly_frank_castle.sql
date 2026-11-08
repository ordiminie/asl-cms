ALTER TABLE "member_profile" ADD COLUMN "pennylane_customer_id" text;--> statement-breakpoint
ALTER TABLE "parcel" ADD COLUMN "meter_number" text;--> statement-breakpoint
CREATE UNIQUE INDEX "member_profile_organization_pennylane_idx" ON "member_profile" USING btree ("organization_id","pennylane_customer_id") WHERE "member_profile"."pennylane_customer_id" is not null;