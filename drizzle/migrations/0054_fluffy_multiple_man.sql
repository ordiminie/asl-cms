CREATE TABLE "member_profile_account" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_profile_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "member_profile_organization_email_idx";--> statement-breakpoint
ALTER TABLE "member_profile_account" ADD CONSTRAINT "member_profile_account_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_profile_account" ADD CONSTRAINT "member_profile_account_member_profile_id_member_profile_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_profile_account" ADD CONSTRAINT "member_profile_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_profile_account_profile_idx" ON "member_profile_account" USING btree ("member_profile_id");--> statement-breakpoint
CREATE INDEX "member_profile_account_organization_user_idx" ON "member_profile_account" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "member_profile_organization_email_idx" ON "member_profile" USING btree ("organization_id",lower("email")) WHERE "member_profile"."email" is not null;