CREATE TABLE "water_analysis" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sampled_on" date NOT NULL,
	"poster_key" text NOT NULL,
	"report_key" text NOT NULL,
	"report_bytes" integer NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "water_analysis" ADD CONSTRAINT "water_analysis_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "water_analysis_organization_sampled_on_idx" ON "water_analysis" USING btree ("organization_id","sampled_on");