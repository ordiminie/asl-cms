CREATE TABLE "association_category" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"name" text NOT NULL,
	"routing_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "incident_report" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"category_id" uuid,
	"location" text NOT NULL,
	"description" text NOT NULL,
	"reporter_name" text,
	"reporter_email" text,
	"reporter_phone" text,
	"status" text DEFAULT 'reported' NOT NULL,
	"member_id" uuid,
	"notification_failed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_report_event" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"status" text NOT NULL,
	"author_user_id" uuid,
	"author_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "association_category" ADD CONSTRAINT "association_category_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_report" ADD CONSTRAINT "incident_report_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_report" ADD CONSTRAINT "incident_report_category_id_association_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."association_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_report_event" ADD CONSTRAINT "incident_report_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_report_event" ADD CONSTRAINT "incident_report_event_report_id_incident_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."incident_report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_report_event" ADD CONSTRAINT "incident_report_event_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "association_category_active_name_idx" ON "association_category" USING btree ("organization_id","domain",lower("name")) WHERE "association_category"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "incident_report_organization_created_at_idx" ON "incident_report" USING btree ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "incident_report_event_report_created_at_idx" ON "incident_report_event" USING btree ("report_id","created_at");