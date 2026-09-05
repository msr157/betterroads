ALTER TABLE "journeys" ADD COLUMN "quality_status" text DEFAULT 'LEGACY_APPROVED' NOT NULL;
ALTER TABLE "journeys" ADD COLUMN "quality_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "journeys" ADD COLUMN "quality_diagnostics" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "journeys" ADD COLUMN "detection_algorithm_version" text;
ALTER TABLE "journeys" ADD COLUMN "moving_duration_s" integer;
ALTER TABLE "journeys" ADD COLUMN "stationary_duration_s" integer;
CREATE INDEX "journeys_quality_status_idx" ON "journeys" USING btree ("quality_status");
