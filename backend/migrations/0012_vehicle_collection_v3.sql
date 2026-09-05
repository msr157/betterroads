CREATE TABLE "collection_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "device_id" integer NOT NULL REFERENCES "devices"("id"),
  "schema_version" integer DEFAULT 3 NOT NULL,
  "mode" text NOT NULL,
  "vehicle_class" text NOT NULL,
  "vehicle_subtype" text NOT NULL,
  "vehicle_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "mount_position" text NOT NULL,
  "profile_version" text NOT NULL,
  "feature_version" text NOT NULL,
  "trigger_version" text NOT NULL,
  "motion_algorithm_version" text NOT NULL,
  "consent_version" text NOT NULL,
  "authorization_source" text DEFAULT 'STANDARD_ACCOUNT' NOT NULL,
  "upload_state" text DEFAULT 'UPLOADING' NOT NULL,
  "quality_status" text,
  "quality_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "quality_diagnostics" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "ended_at" timestamp with time zone,
  "moving_duration_ms" integer,
  "stationary_duration_ms" integer,
  "accepted_distance_m" double precision,
  "average_moving_speed_kmh" double precision,
  "start_lat" double precision,
  "start_lon" double precision,
  "end_lat" double precision,
  "end_lon" double precision,
  "timing_diagnostics" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "sensor_quality" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "location_samples" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  CONSTRAINT "collection_sessions_schema_v3" CHECK ("schema_version" = 3),
  CONSTRAINT "collection_sessions_mode" CHECK ("mode" IN ('STANDARD', 'CONTROLLED_RESEARCH')),
  CONSTRAINT "collection_sessions_vehicle" CHECK ("vehicle_class" IN ('CAR', 'BIKE', 'AUTO_RICKSHAW', 'BUS', 'TRUCK', 'OTHER')),
  CONSTRAINT "collection_sessions_upload_state" CHECK ("upload_state" IN ('UPLOADING', 'COMPLETE', 'CANCELLED')),
  CONSTRAINT "collection_sessions_quality" CHECK ("quality_status" IS NULL OR "quality_status" IN ('RECEIVED', 'QUARANTINED'))
);

CREATE INDEX "collection_sessions_user_idx" ON "collection_sessions" ("user_id");
CREATE INDEX "collection_sessions_device_idx" ON "collection_sessions" ("device_id");
CREATE INDEX "collection_sessions_vehicle_idx" ON "collection_sessions" ("vehicle_class");
CREATE INDEX "collection_sessions_quality_idx" ON "collection_sessions" ("quality_status");
CREATE INDEX "collection_sessions_state_idx" ON "collection_sessions" ("upload_state");
CREATE INDEX "collection_sessions_completed_idx" ON "collection_sessions" ("completed_at");

CREATE TABLE "collection_windows" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL REFERENCES "collection_sessions"("id"),
  "encounter_id" text NOT NULL,
  "kind" text NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "trigger_at" timestamp with time zone,
  "ended_at" timestamp with time zone NOT NULL,
  "trigger_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "trigger_measurements" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "lat" double precision,
  "lon" double precision,
  "accuracy_m" double precision,
  "location_quality" text,
  "bracket_gap_ms" integer,
  "feature_version" text NOT NULL,
  "features" jsonb NOT NULL,
  "label_state" text DEFAULT 'UNLABELLED' NOT NULL,
  "export_eligible" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "collection_windows_kind" CHECK ("kind" IN ('CANDIDATE', 'RANDOM_NORMAL', 'CALIBRATION', 'MANUAL_MARKER', 'ARTIFACT')),
  CONSTRAINT "collection_windows_time" CHECK ("ended_at" > "started_at"),
  CONSTRAINT "collection_windows_location_quality" CHECK ("location_quality" IS NULL OR "location_quality" IN ('INTERPOLATED', 'NEAREST', 'UNUSABLE')),
  CONSTRAINT "collection_windows_label_state" CHECK ("label_state" IN ('UNLABELLED', 'IN_REVIEW', 'AGREED', 'DISPUTED', 'EXCLUDED'))
);

CREATE INDEX "collection_windows_session_idx" ON "collection_windows" ("session_id");
CREATE INDEX "collection_windows_encounter_idx" ON "collection_windows" ("encounter_id");
CREATE INDEX "collection_windows_kind_idx" ON "collection_windows" ("kind");
CREATE INDEX "collection_windows_label_idx" ON "collection_windows" ("label_state");
CREATE INDEX "collection_windows_started_idx" ON "collection_windows" ("started_at");

CREATE TABLE "collection_raw_objects" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL REFERENCES "collection_sessions"("id"),
  "window_id" text NOT NULL,
  "object_key" text NOT NULL,
  "content_type" text NOT NULL,
  "content_encoding" text NOT NULL,
  "expected_size" integer NOT NULL,
  "observed_size" integer,
  "sha256" text NOT NULL,
  "state" text DEFAULT 'PENDING' NOT NULL,
  "uploaded_at" timestamp with time zone,
  "verified_at" timestamp with time zone,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "collection_raw_objects_size" CHECK ("expected_size" BETWEEN 1 AND 1048576),
  CONSTRAINT "collection_raw_objects_sha" CHECK ("sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "collection_raw_objects_type" CHECK ("content_type" = 'application/json' AND "content_encoding" = 'gzip'),
  CONSTRAINT "collection_raw_objects_state" CHECK ("state" IN ('PENDING', 'UPLOADED', 'VERIFIED', 'DELETE_PENDING', 'DELETED'))
);

CREATE UNIQUE INDEX "collection_raw_objects_key_idx" ON "collection_raw_objects" ("object_key");
CREATE INDEX "collection_raw_objects_session_idx" ON "collection_raw_objects" ("session_id");
CREATE INDEX "collection_raw_objects_window_idx" ON "collection_raw_objects" ("window_id");
CREATE INDEX "collection_raw_objects_state_idx" ON "collection_raw_objects" ("state");

CREATE TABLE "collection_labels" (
  "id" serial PRIMARY KEY NOT NULL,
  "window_id" text NOT NULL REFERENCES "collection_windows"("id"),
  "reviewer_id" integer NOT NULL REFERENCES "administrators"("id"),
  "taxonomy_version" text NOT NULL,
  "primary_label" text NOT NULL,
  "secondary_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "confidence" double precision NOT NULL,
  "review_round" integer DEFAULT 1 NOT NULL,
  "evidence_source" text NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "collection_labels_confidence" CHECK ("confidence" BETWEEN 0 AND 1),
  CONSTRAINT "collection_labels_round" CHECK ("review_round" > 0)
);

CREATE INDEX "collection_labels_window_idx" ON "collection_labels" ("window_id");
CREATE INDEX "collection_labels_reviewer_idx" ON "collection_labels" ("reviewer_id");
CREATE UNIQUE INDEX "collection_labels_round_idx" ON "collection_labels" ("window_id", "reviewer_id", "review_round");

CREATE TABLE "research_devices" (
  "device_uuid" text PRIMARY KEY NOT NULL,
  "status" text DEFAULT 'AUTHORIZED' NOT NULL,
  "permitted_vehicle_classes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "expires_at" timestamp with time zone,
  "operator_note" text,
  "approved_by" integer REFERENCES "administrators"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  CONSTRAINT "research_devices_status" CHECK ("status" IN ('AUTHORIZED', 'REVOKED'))
);
CREATE INDEX "research_devices_status_idx" ON "research_devices" ("status");

CREATE TABLE "research_routes" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "city" text NOT NULL,
  "route_version" text NOT NULL,
  "geometry" jsonb NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_by" integer NOT NULL REFERENCES "administrators"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "research_sites" (
  "id" serial PRIMARY KEY NOT NULL,
  "route_id" integer NOT NULL REFERENCES "research_routes"("id"),
  "stable_site_id" text NOT NULL,
  "site_type" text NOT NULL,
  "lat" double precision NOT NULL,
  "lon" double precision NOT NULL,
  "direction" text,
  "notes" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "research_sites_stable_id_idx" ON "research_sites" ("route_id", "stable_site_id");
CREATE INDEX "research_sites_route_idx" ON "research_sites" ("route_id");

CREATE TABLE "collection_markers" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL REFERENCES "collection_sessions"("id"),
  "route_id" integer REFERENCES "research_routes"("id"),
  "site_id" integer REFERENCES "research_sites"("id"),
  "marked_at" timestamp with time zone NOT NULL,
  "marker_type" text NOT NULL,
  "match_status" text DEFAULT 'UNMATCHED' NOT NULL,
  "match_diagnostics" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "collection_markers_match_status" CHECK ("match_status" IN ('UNMATCHED', 'MATCHED', 'AMBIGUOUS', 'REJECTED'))
);
CREATE INDEX "collection_markers_session_idx" ON "collection_markers" ("session_id");
CREATE INDEX "collection_markers_site_idx" ON "collection_markers" ("site_id");

CREATE TABLE "model_registry" (
  "id" text PRIMARY KEY NOT NULL,
  "model_version" text NOT NULL,
  "vehicle_class" text NOT NULL,
  "task" text NOT NULL,
  "feature_version" text NOT NULL,
  "training_dataset_hash" text NOT NULL,
  "artifact_key" text NOT NULL,
  "artifact_sha256" text NOT NULL,
  "metrics" jsonb NOT NULL,
  "calibration" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "decision_thresholds" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "stage" text DEFAULT 'EXPERIMENT' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "approved_at" timestamp with time zone,
  "retired_at" timestamp with time zone,
  CONSTRAINT "model_registry_vehicle" CHECK ("vehicle_class" IN ('CAR', 'BIKE', 'AUTO_RICKSHAW', 'BUS', 'TRUCK')),
  CONSTRAINT "model_registry_stage" CHECK ("stage" IN ('EXPERIMENT', 'SHADOW', 'POSSIBLE_ONLY', 'CONFIRMED_ELIGIBLE', 'RETIRED')),
  CONSTRAINT "model_registry_sha" CHECK ("artifact_sha256" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "model_registry_version_idx" ON "model_registry" ("vehicle_class", "task", "model_version");
CREATE INDEX "model_registry_stage_idx" ON "model_registry" ("stage");
