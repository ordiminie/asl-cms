ALTER TABLE "member_profile" DROP CONSTRAINT "member_profile_user_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "member_profile_organization_user_idx";--> statement-breakpoint
ALTER TABLE "member_profile" DROP COLUMN "user_id";