CREATE TABLE "shared_document" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"file_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shared_document" ADD CONSTRAINT "shared_document_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_document" ADD CONSTRAINT "shared_document_category_id_association_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."association_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shared_document_organization_created_at_idx" ON "shared_document" USING btree ("organization_id","created_at");