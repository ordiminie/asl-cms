CREATE TYPE "public"."news_status" AS ENUM('draft', 'published', 'unpublished');--> statement-breakpoint
CREATE TABLE "news" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"slug" text,
	"title" text DEFAULT '' NOT NULL,
	"published_on" date NOT NULL,
	"image_key" text,
	"image_alt" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"status" "news_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_organization_slug_unique" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "news_organization_status_published_on_idx" ON "news" USING btree ("organization_id","status","published_on");