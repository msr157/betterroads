ALTER TABLE "journeys" ADD COLUMN "accepted_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "journeys_accepted_at_idx" ON "journeys" ("accepted_at");
