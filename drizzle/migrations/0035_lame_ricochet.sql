CREATE TYPE "public"."member_role_event_reason" AS ENUM('assignment', 'presidency_transfer', 'email_change', 'removal');--> statement-breakpoint
CREATE TABLE "member_role_event" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_profile_id" uuid,
	"target_user_id" uuid,
	"target_name" text,
	"author_user_id" uuid,
	"author_name" text,
	"from_role" "organization_role",
	"to_role" "organization_role",
	"reason" "member_role_event_reason" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_role_event" ADD CONSTRAINT "member_role_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_role_event" ADD CONSTRAINT "member_role_event_member_profile_id_member_profile_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_role_event" ADD CONSTRAINT "member_role_event_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_role_event" ADD CONSTRAINT "member_role_event_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_role_event_organization_created_at_idx" ON "member_role_event" USING btree ("organization_id","created_at");