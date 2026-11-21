CREATE TABLE "campaign_letter_profile" (
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"member_profile_id" uuid NOT NULL,
	CONSTRAINT "campaign_letter_profile_campaign_id_member_profile_id_pk" PRIMARY KEY("campaign_id","member_profile_id")
);
--> statement-breakpoint
ALTER TABLE "campaign_letter_profile" ADD CONSTRAINT "campaign_letter_profile_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_letter_profile" ADD CONSTRAINT "campaign_letter_profile_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_letter_profile" ADD CONSTRAINT "campaign_letter_profile_member_profile_id_member_profile_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profile"("id") ON DELETE cascade ON UPDATE no action;