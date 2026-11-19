CREATE TABLE "billing_sync_state" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"unmatched_customers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"terrain_mismatches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_invoice" ALTER COLUMN "parcel_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "member_invoice" ADD COLUMN "has_pdf" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_sync_state" ADD CONSTRAINT "billing_sync_state_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invoice" ADD CONSTRAINT "member_invoice_parcel_required_for_site_check" CHECK ("member_invoice"."source" = 'pennylane' or "member_invoice"."parcel_id" is not null);