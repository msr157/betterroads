ALTER TABLE "users" ALTER COLUMN "google_subject" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "public_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
UPDATE "users" SET "public_id" = 'br_legacy_' || "id"::text, "username" = 'roaduser_' || "id"::text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "public_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_public_id_idx" ON "users" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");
