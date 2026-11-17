CREATE TYPE "public"."member_invoice_source" AS ENUM('site', 'pennylane');--> statement-breakpoint
CREATE TABLE "invoice_status_alert" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" text NOT NULL,
	"notified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_status_alert_organization_status_unique" UNIQUE("organization_id","status")
);
--> statement-breakpoint
CREATE TABLE "member_invoice" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_profile_id" uuid NOT NULL,
	"parcel_id" uuid NOT NULL,
	"source" "member_invoice_source" NOT NULL,
	"external_id" text,
	"year" integer NOT NULL,
	"issued_on" date NOT NULL,
	"due_on" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_invoice_amount_positive_check" CHECK ("member_invoice"."amount_cents" > 0),
	CONSTRAINT "member_invoice_due_on_check" CHECK ("member_invoice"."due_on" >= "member_invoice"."issued_on")
);
--> statement-breakpoint
ALTER TABLE "invoice_status_alert" ADD CONSTRAINT "invoice_status_alert_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invoice" ADD CONSTRAINT "member_invoice_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invoice" ADD CONSTRAINT "member_invoice_member_profile_id_member_profile_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profile"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invoice" ADD CONSTRAINT "member_invoice_parcel_id_parcel_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcel"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_invoice_member_profile_idx" ON "member_invoice" USING btree ("member_profile_id","issued_on" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "member_invoice_organization_external_id_idx" ON "member_invoice" USING btree ("organization_id","external_id") WHERE "member_invoice"."external_id" is not null;