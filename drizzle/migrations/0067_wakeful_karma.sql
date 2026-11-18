CREATE TABLE "campaign_recipient_profile" (
	"organization_id" uuid NOT NULL,
	"campaign_recipient_id" uuid NOT NULL,
	"member_profile_id" uuid NOT NULL,
	CONSTRAINT "campaign_recipient_profile_campaign_recipient_id_member_profile_id_pk" PRIMARY KEY("campaign_recipient_id","member_profile_id")
);
--> statement-breakpoint
ALTER TABLE "campaign_recipient_profile" ADD CONSTRAINT "campaign_recipient_profile_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipient_profile" ADD CONSTRAINT "campaign_recipient_profile_campaign_recipient_id_campaign_recipient_id_fk" FOREIGN KEY ("campaign_recipient_id") REFERENCES "public"."campaign_recipient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipient_profile" ADD CONSTRAINT "campaign_recipient_profile_member_profile_id_member_profile_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profile"("id") ON DELETE cascade ON UPDATE no action;