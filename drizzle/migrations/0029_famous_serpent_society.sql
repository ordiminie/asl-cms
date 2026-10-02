CREATE TABLE "member_profile" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address_line" text,
	"address_complement" text,
	"postal_code" text,
	"city" text,
	"mail_only" boolean GENERATED ALWAYS AS ("email" IS NULL) STORED NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parcel" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"number" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parcel_organization_number_unique" UNIQUE("organization_id","number")
);
--> statement-breakpoint
CREATE TABLE "parcel_ownership" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"parcel_id" uuid NOT NULL,
	"member_profile_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parcel_ownership_period_check" CHECK ("parcel_ownership"."ends_on" IS NULL OR "parcel_ownership"."ends_on" > "parcel_ownership"."starts_on")
);
--> statement-breakpoint
ALTER TABLE "member_profile" ADD CONSTRAINT "member_profile_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_ownership" ADD CONSTRAINT "parcel_ownership_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_ownership" ADD CONSTRAINT "parcel_ownership_parcel_id_parcel_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcel"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_ownership" ADD CONSTRAINT "parcel_ownership_member_profile_id_member_profile_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profile"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_profile_organization_email_idx" ON "member_profile" USING btree ("organization_id",lower("email")) WHERE "member_profile"."email" is not null;--> statement-breakpoint
CREATE INDEX "parcel_ownership_parcel_starts_on_idx" ON "parcel_ownership" USING btree ("parcel_id","starts_on");--> statement-breakpoint
CREATE INDEX "parcel_ownership_member_profile_idx" ON "parcel_ownership" USING btree ("member_profile_id");