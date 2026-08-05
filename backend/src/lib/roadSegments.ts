/**
 * Road-segment identity & RQI aggregation math.
 *
 * A "segment" is a quantized geographic cell, not an OSM way. We round the
 * midpoint of each journey-segment to a fixed grid (3 decimal places ≈ 111 m
 * of latitude) so repeated trips over the same stretch of road land in the
 * same cell and their scores accumulate into a history.
 *
 * Known limitation (accepted for v1): two distinct roads crossing one cell
 * collide, and a road hugging a cell boundary may split across two keys.
 * The AI engine will replace this with OSM map-matching; raw journeys are
 * retained (journey_raw) so all history can be re-keyed then.
 */

/** Grid resolution in decimal degrees. 0.001° ≈ 111 m latitude. */
export const CELL_SIZE_DEG = 0.001;

const DECIMALS = 3;

/** Quantize a coordinate pair to its cell key, e.g. "19.055:72.84". */
export function segmentKeyFor(lat: number, lon: number): string {
  const qLat = (Math.floor(lat / CELL_SIZE_DEG) * CELL_SIZE_DEG).toFixed(DECIMALS);
  const qLon = (Math.floor(lon / CELL_SIZE_DEG) * CELL_SIZE_DEG).toFixed(DECIMALS);
  return `${qLat}:${qLon}`;
}

/** Cell center for a key (for drawing / bbox queries). */
export function cellCenter(key: string): { lat: number; lon: number } {
  const [latStr, lonStr] = key.split(':');
  return {
    lat: Number(latStr) + CELL_SIZE_DEG / 2,
    lon: Number(lonStr) + CELL_SIZE_DEG / 2,
  };
}

/**
 * Minimum weight a new observation carries in the running average. Without
 * this floor the average becomes cumulative-all-time, and a repaired road
 * would stay "red" for months of history it can never outweigh. With 0.15,
 * ~15 fresh journeys move a segment most of the way to its new reality.
 */
export const RECENCY_ALPHA_FLOOR = 0.15;

/**
 * Merge a new observation into a recency-weighted running average.
 * For the first few samples this behaves like a plain mean (alpha = 1/n);
 * once enough samples accumulate it becomes an EMA with alpha floored at
 * RECENCY_ALPHA_FLOOR so recent journeys always register.
 */
export function mergeRqi(prevRqi: number, prevCount: number, newRqi: number): number {
  if (prevCount <= 0) return clampRqi(newRqi);
  const alpha = Math.max(1 / (prevCount + 1), RECENCY_ALPHA_FLOOR);
  return clampRqi(prevRqi * (1 - alpha) + newRqi * alpha);
}

export function clampRqi(v: number): number {
  return Math.min(100, Math.max(0, v));
}
