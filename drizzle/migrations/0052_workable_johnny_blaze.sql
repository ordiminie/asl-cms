CREATE TABLE "member_question" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"body" text NOT NULL,
	"notification_failed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_question" ADD CONSTRAINT "member_question_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_question" ADD CONSTRAINT "member_question_member_id_member_profile_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member_profile"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_question" ADD CONSTRAINT "member_question_category_id_association_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."association_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_question_organization_created_idx" ON "member_question" USING btree ("organization_id","created_at" DESC NULLS LAST);