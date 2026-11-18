CREATE TABLE "recipient_group" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipient_group_member" (
	"organization_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"member_profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipient_group_member_group_id_member_profile_id_pk" PRIMARY KEY("group_id","member_profile_id")
);
--> statement-breakpoint
ALTER TABLE "campaign" ADD COLUMN "target_group_id" uuid;--> statement-breakpoint
ALTER TABLE "campaign" ADD COLUMN "target_group_name" text;--> statement-breakpoint
ALTER TABLE "recipient_group" ADD CONSTRAINT "recipient_group_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_group_member" ADD CONSTRAINT "recipient_group_member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_group_member" ADD CONSTRAINT "recipient_group_member_group_id_recipient_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."recipient_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient_group_member" ADD CONSTRAINT "recipient_group_member_member_profile_id_member_profile_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recipient_group_organization_name_idx" ON "recipient_group" USING btree ("organization_id",lower("name"));--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_target_group_id_recipient_group_id_fk" FOREIGN KEY ("target_group_id") REFERENCES "public"."recipient_group"("id") ON DELETE set null ON UPDATE no action;