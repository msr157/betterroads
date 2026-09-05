ALTER TABLE "road_events" ADD COLUMN "accuracy_m" double precision;
ALTER TABLE "road_events" ADD COLUMN "location_quality" text;
ALTER TABLE "road_events" ADD COLUMN "pothole_hotspot_id" text;

CREATE TABLE "pothole_hotspots" (
  "id" text PRIMARY KEY NOT NULL,
  "center_lat" double precision NOT NULL,
  "center_lon" double precision NOT NULL,
  "segment_key" text NOT NULL,
  "first_detected_at" timestamp with time zone NOT NULL,
  "last_detected_at" timestamp with time zone NOT NULL
);
CREATE INDEX "pothole_hotspots_latlon_idx" ON "pothole_hotspots" ("center_lat", "center_lon");
CREATE INDEX "pothole_hotspots_segment_idx" ON "pothole_hotspots" ("segment_key");
CREATE INDEX "road_events_hotspot_idx" ON "road_events" ("pothole_hotspot_id");

DO $$
DECLARE e record; matched_id text;
BEGIN
  FOR e IN
    SELECT re.id, re.segment_key, re.lat, re.lon, re.occurred_at
    FROM road_events re JOIN journeys j ON j.id = re.journey_id
    WHERE re.type = 'POTHOLE' AND j.accepted_at IS NOT NULL
      AND j.quality_status IN ('LEGACY_APPROVED', 'APPROVED')
    ORDER BY re.occurred_at, re.id
  LOOP
    SELECT ph.id INTO matched_id FROM pothole_hotspots ph
    WHERE 6371000 * 2 * asin(sqrt(
        power(sin(radians(ph.center_lat - e.lat) / 2), 2) +
        cos(radians(e.lat)) * cos(radians(ph.center_lat)) * power(sin(radians(ph.center_lon - e.lon) / 2), 2)
      )) <= 20
    ORDER BY ph.first_detected_at, ph.id LIMIT 1;
    IF matched_id IS NULL THEN
      matched_id := 'ph:' || e.id;
      INSERT INTO pothole_hotspots VALUES (matched_id, e.lat, e.lon, e.segment_key, e.occurred_at, e.occurred_at);
    ELSE
      UPDATE pothole_hotspots SET last_detected_at = greatest(last_detected_at, e.occurred_at) WHERE id = matched_id;
    END IF;
    UPDATE road_events SET pothole_hotspot_id = matched_id WHERE id = e.id;
  END LOOP;
END $$;
