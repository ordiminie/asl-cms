CREATE TYPE "public"."member_note_channel" AS ENUM('phone', 'mail', 'in_person', 'email');--> statement-breakpoint
CREATE TYPE "public"."member_note_kind" AS ENUM('note', 'exchange');--> statement-breakpoint
CREATE TABLE "member_note" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_profile_id" uuid NOT NULL,
	"kind" "member_note_kind" NOT NULL,
	"channel" "member_note_channel",
	"entry_date" date NOT NULL,
	"body" text NOT NULL,
	"author_user_id" uuid,
	"author_name" text,
	"on_behalf_of_user_id" uuid,
	"on_behalf_of_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "member_note_channel_kind_check" CHECK (("member_note"."kind" = 'exchange') = ("member_note"."channel" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "member_note" ADD CONSTRAINT "member_note_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_note" ADD CONSTRAINT "member_note_member_profile_id_member_profile_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profile"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_note" ADD CONSTRAINT "member_note_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_note" ADD CONSTRAINT "member_note_on_behalf_of_user_id_user_id_fk" FOREIGN KEY ("on_behalf_of_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_note_organization_member_entry_idx" ON "member_note" USING btree ("organization_id","member_profile_id","entry_date" DESC NULLS LAST,"created_at" DESC NULLS LAST);