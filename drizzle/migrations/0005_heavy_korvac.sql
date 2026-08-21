CREATE TYPE "public"."affiliate_payout_method" AS ENUM('credit', 'manual');--> statement-breakpoint
CREATE TYPE "public"."affiliate_payout_status" AS ENUM('pending', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."affiliate_status" AS ENUM('pending', 'active', 'suspended', 'banned');--> statement-breakpoint
CREATE TYPE "public"."affiliate_type" AS ENUM('customer', 'professional');--> statement-breakpoint
CREATE TYPE "public"."affiliate_commission_status" AS ENUM('pending', 'approved', 'paid', 'refunded', 'voided');--> statement-breakpoint
CREATE TYPE "public"."affiliate_commission_type" AS ENUM('bounty', 'clawback', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."referral_source" AS ENUM('cookie', 'signup_code', 'manual');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('active', 'self_referral', 'voided');--> statement-breakpoint
CREATE TABLE "affiliate" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" "affiliate_status" DEFAULT 'active' NOT NULL,
	"type" "affiliate_type" DEFAULT 'customer' NOT NULL,
	"payout_method" "affiliate_payout_method" DEFAULT 'manual' NOT NULL,
	"legal_name" text,
	"tax_id" text,
	"country" text,
	"suspended_at" timestamp,
	"suspended_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_commission" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"referral_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "affiliate_commission_type" DEFAULT 'bounty' NOT NULL,
	"status" "affiliate_commission_status" DEFAULT 'pending' NOT NULL,
	"plan_code" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"source_id" text,
	"stripe_subscription_id" text,
	"matures_at" timestamp NOT NULL,
	"approved_at" timestamp,
	"paid_at" timestamp,
	"voided_at" timestamp,
	"void_reason" text,
	"parent_commission_id" uuid,
	"payout_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_payout" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"status" "affiliate_payout_status" DEFAULT 'pending' NOT NULL,
	"method" "affiliate_payout_method" DEFAULT 'manual' NOT NULL,
	"external_reference" text,
	"affiliate_snapshot" jsonb,
	"initiated_by_user_id" uuid,
	"notes" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_program_reward" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"plan_code" text NOT NULL,
	"bounty_cents" integer NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"hold_days" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"referred_user_id" uuid NOT NULL,
	"source" "referral_source" DEFAULT 'cookie' NOT NULL,
	"status" "referral_status" DEFAULT 'active' NOT NULL,
	"locked_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliate" ADD CONSTRAINT "affiliate_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_affiliate_id_affiliate_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_referral_id_referral_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referral"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payout" ADD CONSTRAINT "affiliate_payout_affiliate_id_affiliate_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payout" ADD CONSTRAINT "affiliate_payout_initiated_by_user_id_user_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_affiliate_id_affiliate_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referred_user_id_user_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_user_id_unique_idx" ON "affiliate" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_code_unique_idx" ON "affiliate" USING btree ("code");--> statement-breakpoint
CREATE INDEX "affiliate_status_idx" ON "affiliate" USING btree ("status");--> statement-breakpoint
CREATE INDEX "affiliate_commission_affiliate_status_idx" ON "affiliate_commission" USING btree ("affiliate_id","status","matures_at");--> statement-breakpoint
CREATE INDEX "affiliate_commission_organization_id_idx" ON "affiliate_commission" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "affiliate_commission_payout_id_idx" ON "affiliate_commission" USING btree ("payout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_commission_source_dedup_idx" ON "affiliate_commission" USING btree ("affiliate_id","source_id") WHERE "affiliate_commission"."source_id" IS NOT NULL AND "affiliate_commission"."type" = 'bounty';--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_commission_organization_bounty_idx" ON "affiliate_commission" USING btree ("organization_id") WHERE "affiliate_commission"."type" = 'bounty';--> statement-breakpoint
CREATE INDEX "affiliate_payout_affiliate_id_idx" ON "affiliate_payout" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "affiliate_payout_status_idx" ON "affiliate_payout" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_program_reward_plan_code_idx" ON "affiliate_program_reward" USING btree ("plan_code");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_organization_id_unique_idx" ON "referral" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "referral_affiliate_id_idx" ON "referral" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "referral_referred_user_id_idx" ON "referral" USING btree ("referred_user_id");