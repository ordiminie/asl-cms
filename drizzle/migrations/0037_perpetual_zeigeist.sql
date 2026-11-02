CREATE TYPE "public"."impersonation_event_kind" AS ENUM('opened', 'closed');--> statement-breakpoint
CREATE TABLE "impersonation_event" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" "impersonation_event_kind" NOT NULL,
	"admin_user_id" uuid,
	"admin_name" text,
	"target_user_id" uuid,
	"target_name" text,
	"session_id" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incident_report_event" ADD COLUMN "on_behalf_of_user_id" uuid;--> statement-breakpoint
ALTER TABLE "incident_report_event" ADD COLUMN "on_behalf_of_name" text;--> statement-breakpoint
ALTER TABLE "member_role_event" ADD COLUMN "on_behalf_of_user_id" uuid;--> statement-breakpoint
ALTER TABLE "member_role_event" ADD COLUMN "on_behalf_of_name" text;--> statement-breakpoint
ALTER TABLE "impersonation_event" ADD CONSTRAINT "impersonation_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonation_event" ADD CONSTRAINT "impersonation_event_admin_user_id_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonation_event" ADD CONSTRAINT "impersonation_event_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "impersonation_event_organization_created_at_idx" ON "impersonation_event" USING btree ("organization_id","created_at");--> statement-breakpoint
ALTER TABLE "incident_report_event" ADD CONSTRAINT "incident_report_event_on_behalf_of_user_id_user_id_fk" FOREIGN KEY ("on_behalf_of_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_role_event" ADD CONSTRAINT "member_role_event_on_behalf_of_user_id_user_id_fk" FOREIGN KEY ("on_behalf_of_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;