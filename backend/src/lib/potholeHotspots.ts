type Position = { lat: number; lon: number };
type TimedPosition = Position & { timestamp: number; accuracyM: number };

const EARTH_RADIUS_M = 6_371_000;

export function distanceMetres(a: Position, b: Position): number {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLon = (b.lon - a.lon) * radians;
  const lat1 = a.lat * radians;
  const lat2 = b.lat * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Recover precision only from a GPS sample close enough in both time and space. */
export function recoveredEventAccuracy(
  event: Position & { timestamp: number },
  samples: TimedPosition[],
): TimedPosition | null {
  const nearest = samples
    .filter((sample) => Math.abs(sample.timestamp - event.timestamp) <= 5_000)
    .map((sample) => ({ sample, distance: distanceMetres(event, sample) }))
    .filter(({ sample, distance }) => distance <= Math.max(20, sample.accuracyM * 2))
    .sort((a, b) => Math.abs(a.sample.timestamp - event.timestamp) - Math.abs(b.sample.timestamp - event.timestamp))[0];
  return nearest?.sample ?? null;
}

export type HotspotDetection = Position & { id: string; journeyId: string; occurredAt: string };

/** Deterministic chronological grouping used by migration checks and tests. */
export function associateHotspots(events: HotspotDetection[], radiusM = 20) {
  const hotspots: Array<{ id: string; centerLat: number; centerLon: number; eventIds: string[]; journeyIds: Set<string> }> = [];
  for (const event of [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id))) {
    const nearest = hotspots
      .map((hotspot) => ({ hotspot, distance: distanceMetres(event, { lat: hotspot.centerLat, lon: hotspot.centerLon }) }))
      .filter(({ distance }) => distance <= radiusM)
      .sort((a, b) => a.distance - b.distance || a.hotspot.id.localeCompare(b.hotspot.id))[0]?.hotspot;
    const hotspot = nearest ?? { id: `ph:${event.id}`, centerLat: event.lat, centerLon: event.lon, eventIds: [], journeyIds: new Set<string>() };
    if (!nearest) hotspots.push(hotspot);
    hotspot.eventIds.push(event.id);
    hotspot.journeyIds.add(event.journeyId);
  }
  return hotspots;
}
