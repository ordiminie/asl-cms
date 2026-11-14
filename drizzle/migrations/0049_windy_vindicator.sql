CREATE TABLE "deferred_email" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"nature" text NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"text_body" text NOT NULL,
	"html_body" text,
	"headers" jsonb,
	"reply_to" text,
	"sender_name" text,
	"send_on" date NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_send_budget" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"day" date NOT NULL,
	"reportable_count" integer DEFAULT 0 NOT NULL,
	"login_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "email_send_budget_organization_day_unique" UNIQUE("organization_id","day")
);
--> statement-breakpoint
ALTER TABLE "deferred_email" ADD CONSTRAINT "deferred_email_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_send_budget" ADD CONSTRAINT "email_send_budget_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deferred_email_organization_status_idx" ON "deferred_email" USING btree ("organization_id","status");