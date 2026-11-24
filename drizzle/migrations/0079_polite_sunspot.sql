CREATE TABLE "member_invitation_state" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_invited_at" timestamp with time zone,
	"first_signed_in_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "member_invitation_state" ADD CONSTRAINT "member_invitation_state_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invitation_state" ADD CONSTRAINT "member_invitation_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_invitation_state_organization_user_idx" ON "member_invitation_state" USING btree ("organization_id","user_id");