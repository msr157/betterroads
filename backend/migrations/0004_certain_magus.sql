CREATE TABLE "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_uuid" text NOT NULL,
	"platform" text DEFAULT 'android' NOT NULL,
	"model" text,
	"app_version" text,
	"default_vehicle_type" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"journey_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_raw" (
	"journey_id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journeys" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"distance_m" double precision NOT NULL,
	"duration_s" integer NOT NULL,
	"avg_speed_kmh" double precision NOT NULL,
	"vehicle_type" text NOT NULL,
	"phone_mount_position" text,
	"base_floor_rms" double precision,
	"rqi_score" double precision NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"start_lat" double precision NOT NULL,
	"start_lon" double precision NOT NULL,
	"end_lat" double precision NOT NULL,
	"end_lon" double precision NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "road_events" (
	"id" text PRIMARY KEY NOT NULL,
	"journey_id" text NOT NULL,
	"type" text NOT NULL,
	"severity" double precision NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"altitude_m" double precision,
	"speed_kmh" double precision,
	"accel_x" double precision,
	"accel_y" double precision,
	"accel_z" double precision,
	"gyro_z" double precision,
	"heading" double precision,
	"segment_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "road_segments" (
	"segment_key" text PRIMARY KEY NOT NULL,
	"center_lat" double precision NOT NULL,
	"center_lon" double precision NOT NULL,
	"geometry" jsonb NOT NULL,
	"current_rqi" double precision NOT NULL,
	"sample_count" integer DEFAULT 0 NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segment_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"segment_key" text NOT NULL,
	"day" date NOT NULL,
	"rqi" double precision NOT NULL,
	"sample_count" integer NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journey_raw" ADD CONSTRAINT "journey_raw_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "road_events" ADD CONSTRAINT "road_events_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_snapshots" ADD CONSTRAINT "segment_snapshots_segment_key_road_segments_segment_key_fk" FOREIGN KEY ("segment_key") REFERENCES "public"."road_segments"("segment_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "devices_uuid_idx" ON "devices" USING btree ("device_uuid");--> statement-breakpoint
CREATE INDEX "journeys_device_idx" ON "journeys" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "journeys_ended_at_idx" ON "journeys" USING btree ("ended_at");--> statement-breakpoint
CREATE INDEX "road_events_journey_idx" ON "road_events" USING btree ("journey_id");--> statement-breakpoint
CREATE INDEX "road_events_segment_idx" ON "road_events" USING btree ("segment_key");--> statement-breakpoint
CREATE INDEX "road_events_occurred_idx" ON "road_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "road_events_latlon_idx" ON "road_events" USING btree ("lat","lon");--> statement-breakpoint
CREATE INDEX "road_segments_latlon_idx" ON "road_segments" USING btree ("center_lat","center_lon");--> statement-breakpoint
CREATE UNIQUE INDEX "segment_snapshots_key_day_idx" ON "segment_snapshots" USING btree ("segment_key","day");--> statement-breakpoint
CREATE INDEX "segment_snapshots_day_idx" ON "segment_snapshots" USING btree ("day");