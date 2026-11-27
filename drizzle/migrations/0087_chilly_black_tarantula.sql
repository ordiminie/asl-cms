ALTER TABLE "menu_item" ALTER COLUMN "page_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_item" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "menu_item" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_page_xor_address_check" CHECK (("menu_item"."page_id" is not null and "menu_item"."label" is null and "menu_item"."address" is null) or ("menu_item"."page_id" is null and "menu_item"."label" is not null and "menu_item"."address" is not null));