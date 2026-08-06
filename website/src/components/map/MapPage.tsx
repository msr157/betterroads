import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AttributionControl,
  Map as MaplibreMap,
  NavigationControl,
  Popup,
  setWorkerUrl,
} from 'maplibre-gl';
import type { ExpressionSpecification, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Vite's dep-optimizer breaks maplibre's own worker bundle (GeoJSON sources
// never finish loading, so nothing paints). `?worker&url` makes Vite bundle
// the worker entry properly in both dev and prod; setWorkerUrl points
// maplibre at it. See maplibre-gl-js#7339.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(maplibreWorkerUrl);
import type { FeatureCollection } from 'geojson';
import { SITE } from '@/lib/constants';
import TimelineBar from '@/components/map/TimelineBar';
import MapLegend from '@/components/map/MapLegend';
import {
  addDays,
  dayRange,
  fetchEvents,
  fetchRoads,
  fetchStats,
  fetchTimeline,
} from '@/components/map/api';
import type { PublicStats, RoadEvent, RoadSegment, TimelineData } from '@/components/map/api';
import {
  EVENT_COLOR,
  EVENT_TYPE_LABELS,
  rqiColorExpression,
  rqiLabel,
} from '@/components/map/rqiScale';

// India-only map. [lon, lat] — MapLibre order. The default view frames the
// whole country; maxBounds stops panning away from it (with margin so
// border cities and the islands aren't clipped against the edge).
const DEFAULT_CENTER: [number, number] = [79.5, 22.3];
const DEFAULT_ZOOM = 4.2;
const INDIA_MAX_BOUNDS: [[number, number], [number, number]] = [
  [61.0, 1.0], // SW [lon, lat]
  [104.0, 40.5], // NE
];
const MIN_ZOOM = 3.6;
/** Events shown alongside a day: the trailing 30-day window ending that day. */
const EVENT_WINDOW_DAYS = 30;
/** Debounce for refetches while scrubbing the timeline / panning the map. */
const FETCH_DEBOUNCE_MS = 250;

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

/* ── GeoJSON adapters (API sends [lat, lon]; GeoJSON wants [lon, lat]) ── */

function roadsToGeoJSON(segments: RoadSegment[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: segments.map((s) => ({
      type: 'Feature',
      properties: { rqi: s.rqi, sampleCount: s.sampleCount },
      geometry: {
        type: 'LineString',
        coordinates: s.geometry.map(([lat, lon]) => [lon, lat]),
      },
    })),
  };
}

function eventsToGeoJSON(events: RoadEvent[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: events.map((e) => ({
      type: 'Feature',
      properties: { type: e.type, severity: e.severity, occurredAt: e.occurredAt },
      geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
    })),
  };
}

/* ── Popup content — built with textContent (API strings stay untrusted) ── */

function eventPopupContent(type: string, severity: number, occurredAt: string): HTMLElement {
  const root = document.createElement('div');
  const title = document.createElement('p');
  title.className = 'font-display text-sm font-bold tracking-tight text-ink';
  title.textContent = EVENT_TYPE_LABELS[type] ?? type;
  const sev = document.createElement('p');
  sev.className = 'mt-1 text-xs text-ink-2';
  const sevValue = document.createElement('strong');
  sevValue.className = 'font-semibold text-ink';
  sevValue.textContent = `${Math.round(severity * 100)}%`;
  sev.append(sevValue, ' severity');
  const when = document.createElement('p');
  when.className = 'mt-0.5 text-xs text-ink-3';
  when.textContent = new Date(occurredAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  root.append(title, sev, when);
  return root;
}

function roadPopupContent(rqi: number, sampleCount: number): HTMLElement {
  const root = document.createElement('div');
  const title = document.createElement('p');
  title.className = 'font-display text-sm font-bold tracking-tight text-ink';
  title.textContent = `RQI ${Math.round(rqi)} · ${rqiLabel(rqi)}`;
  const meta = document.createElement('p');
  meta.className = 'mt-0.5 text-xs text-ink-3';
  meta.textContent = `from ${sampleCount} ride sample${sampleCount === 1 ? '' : 's'}`;
  root.append(title, meta);
  return root;
}

/**
 * /map — the public road-quality map. Full-viewport MapLibre canvas over OSM
 * raster tiles, road segments colored by RQI, event markers, and a draggable
 * timeline that replays how the same roads scored on any past day.
 */
export default function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  // Mirrors for the fetch path, so map event handlers never close over stale state.
  const daysRef = useRef<string[]>([]);
  const indexRef = useRef(0);

  const [mapReady, setMapReady] = useState(false);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [timelineFailed, setTimelineFailed] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [stats, setStats] = useState<PublicStats | null>(null);

  // Full calendar range + per-day activity for the timeline sparkline.
  const days = useMemo(
    () =>
      timeline?.earliest && timeline.latest
        ? dayRange(timeline.earliest, timeline.latest)
        : [],
    [timeline],
  );
  const activity = useMemo(() => {
    const byDay = new Map(timeline?.days.map((d) => [d.day, d.segmentsUpdated]) ?? []);
    return days.map((d) => byDay.get(d) ?? 0);
  }, [timeline, days]);
  daysRef.current = days;

  /** Fetch roads + events for the current bbox and selected day. */
  const loadData = useCallback(async () => {
    const map = mapRef.current;
    const allDays = daysRef.current;
    if (!map || allDays.length === 0) return;

    const b = map.getBounds();
    const bbox = {
      minLat: b.getSouth(),
      maxLat: b.getNorth(),
      minLon: b.getWest(),
      maxLon: b.getEast(),
    };
    const i = Math.min(indexRef.current, allDays.length - 1);
    const day = allDays[i];
    const isLatest = i === allDays.length - 1;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setUpdating(true);
    try {
      // At the newest position `at` is omitted → the segments' current state.
      const [segments, events] = await Promise.all([
        fetchRoads(bbox, isLatest ? undefined : day, ac.signal),
        fetchEvents(bbox, addDays(day, -(EVENT_WINDOW_DAYS - 1)), day, ac.signal),
      ]);
      (map.getSource('roads') as GeoJSONSource | undefined)?.setData(roadsToGeoJSON(segments));
      (map.getSource('events') as GeoJSONSource | undefined)?.setData(eventsToGeoJSON(events));
      setUpdating(false);
    } catch (err) {
      // Aborted = superseded by a newer request, which will clear the chip.
      if ((err as Error).name !== 'AbortError') setUpdating(false);
    }
  }, []);

  /** Debounced loadData — shared by map panning and timeline scrubbing. */
  const scheduleLoad = useCallback(
    (delayMs = FETCH_DEBOUNCE_MS) => {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => void loadData(), delayMs);
    },
    [loadData],
  );

  /* ── Map bootstrap (once) ───────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MaplibreMap({
      container: containerRef.current,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: MIN_ZOOM,
      maxBounds: INDIA_MAX_BOUNDS,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm' }],
      },
    });
    mapRef.current = map;
    if (import.meta.env.DEV) {
      // Debug handle + surfaced style errors (maplibre swallows them otherwise).
      (window as unknown as { __brMap?: MaplibreMap }).__brMap = map;
      map.on('error', (e) => console.error('[maplibre]', e.error));
    }
    // Top-right, above the bottom-docked timeline: zoom + compact attribution.
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new AttributionControl({ compact: true }), 'top-right');

    map.on('load', () => {
      map.addSource('roads', { type: 'geojson', data: EMPTY_FC });
      // Clustered: a dense corridor collapses to a handful of aggregate
      // circles at city zoom instead of a dot chain that buries the RQI line.
      map.addSource('events', {
        type: 'geojson',
        data: EMPTY_FC,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 48,
      });

      // White casing under the colored line keeps the RQI hues legible over
      // the basemap (the dataviz "surface ring" between marks).
      map.addLayer({
        id: 'roads-casing',
        type: 'line',
        source: 'roads',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-opacity': 0.9,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 5.5, 14, 9, 17, 14],
        },
      });
      map.addLayer({
        id: 'roads-line',
        type: 'line',
        source: 'roads',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          // Spread-built stops don't narrow to the style-spec tuple union.
          'line-color': rqiColorExpression as unknown as ExpressionSpecification,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 14, 6, 17, 10],
        },
      });
      map.addLayer({
        id: 'events-cluster',
        type: 'circle',
        source: 'events',
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': ['step', ['get', 'point_count'], 8, 25, 11, 100, 15],
          'circle-color': EVENT_COLOR,
          'circle-opacity': 0.55,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      });
      map.addLayer({
        id: 'events-dot',
        type: 'circle',
        source: 'events',
        filter: ['!', ['has', 'point_count']],
        paint: {
          // Recede at city scale so the RQI line carries the story; emerge on
          // zoom-in where individual potholes become actionable.
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11,
            ['interpolate', ['linear'], ['get', 'severity'], 0, 1.25, 1, 2.5],
            15,
            ['interpolate', ['linear'], ['get', 'severity'], 0, 3.5, 1, 8],
          ],
          'circle-color': EVENT_COLOR,
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.2, 13, 0.5, 15, 0.85],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 15, 1.5],
        },
      });

      const popup = new Popup({ closeButton: false, maxWidth: '260px', offset: 10 });
      popupRef.current = popup;

      map.on('click', 'events-dot', (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== 'Point') return;
        const p = f.properties as { type: string; severity: number; occurredAt: string };
        popup
          .setLngLat(f.geometry.coordinates as [number, number])
          .setDOMContent(eventPopupContent(p.type, p.severity, p.occurredAt))
          .addTo(map);
      });
      map.on('click', 'roads-line', (e: MapLayerMouseEvent) => {
        // Event dots win when both are under the pointer.
        if (map.queryRenderedFeatures(e.point, { layers: ['events-dot'] }).length > 0) return;
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { rqi: number; sampleCount: number };
        popup
          .setLngLat(e.lngLat)
          .setDOMContent(roadPopupContent(p.rqi, p.sampleCount))
          .addTo(map);
      });
      for (const layer of ['events-dot', 'roads-line']) {
        map.on('mouseenter', layer, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layer, () => {
          map.getCanvas().style.cursor = '';
        });
      }

      setMapReady(true);
    });

    map.on('moveend', () => scheduleLoad());

    return () => {
      window.clearTimeout(debounceRef.current);
      abortRef.current?.abort();
      map.remove();
      mapRef.current = null;
    };
  }, [scheduleLoad]);

  /* ── Timeline + panel stats bootstrap ───────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    fetchTimeline()
      .then((t) => {
        if (!cancelled) setTimeline(t);
      })
      .catch(() => {
        if (!cancelled) setTimelineFailed(true);
      });
    // Stats are decorative — failure just hides the strip.
    fetchStats()
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // First data load once both the map and the timeline are ready — start at
  // the newest day (the roads' current state).
  useEffect(() => {
    if (!mapReady || days.length === 0) return;
    indexRef.current = days.length - 1;
    setSelectedIndex(days.length - 1);
    void loadData();
  }, [mapReady, days, loadData]);

  const handleSelect = useCallback(
    (i: number) => {
      indexRef.current = i;
      setSelectedIndex(i);
      scheduleLoad();
    },
    [scheduleLoad],
  );

  const showEmpty = timelineFailed || (timeline !== null && !timeline.earliest);

  const statItems = stats
    ? [
        { label: 'km ridden', value: stats.kmRidden.toLocaleString('en-IN') },
        { label: 'road segments', value: stats.segments.toLocaleString('en-IN') },
        { label: 'events found', value: stats.events.toLocaleString('en-IN') },
        { label: 'avg RQI', value: stats.avgRqi === null ? '—' : String(stats.avgRqi) },
      ]
    : [];

  return (
    <div className="flex h-viewport flex-col bg-paper text-ink">
      {/* ── Header bar ──────────────────────────────────────────────── */}
      <header className="z-10 border-b border-line bg-paper">
        <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
          <a href="/" className="font-display text-lg font-bold tracking-tight text-ink">
            {SITE.wordmark}
            <span className="text-saffron">.</span>
          </a>
          <span className="eyebrow hidden sm:inline">Public panel · India</span>
          <div className="ml-auto flex items-center gap-5">
            <a
              href="/app"
              className="link-underline text-sm font-semibold text-saffron"
            >
              Get the app
            </a>
            <a
              href="/"
              className="link-underline hidden text-sm font-medium text-ink-2 transition-colors hover:text-ink sm:inline"
            >
              ← Home
            </a>
          </div>
        </div>
        {/* Live network stats — quiet single line under the masthead */}
        {statItems.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-line px-4 py-2 sm:px-6">
            {statItems.map((s) => (
              <p key={s.label} className="text-xs text-ink-3">
                <span className="font-display text-sm font-bold tabular-nums text-ink">
                  {s.value}
                </span>{' '}
                {s.label}
              </p>
            ))}
            {stats?.lastUpdatedAt && (
              <p className="ml-auto hidden text-xs text-ink-3 sm:block">
                Updated{' '}
                {new Date(stats.lastUpdatedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
            )}
          </div>
        )}
      </header>

      {/* ── Map + overlays ──────────────────────────────────────────── */}
      <div className="relative flex-1">
        {/* h-full/w-full, not inset-0: maplibre's stylesheet forces the
            container to position:relative, which would zero out an
            absolutely-positioned box. */}
        <div ref={containerRef} className="h-full w-full" />

        <div className="absolute left-3 top-3 sm:left-4 sm:top-4">
          <MapLegend />
        </div>

        {/* Refetch keeps the frame — just a quiet chip while data reloads */}
        {updating && (
          <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-line bg-paper/95 px-3 py-1 text-xs font-medium text-ink-2 shadow-sm backdrop-blur">
            Updating…
          </div>
        )}

        {/* Empty state — the map stays live, the timeline stays hidden */}
        {showEmpty && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
            <div className="pointer-events-auto max-w-sm rounded-2xl border border-line bg-paper/95 p-8 text-center shadow-[0_24px_60px_-24px_rgba(10,10,10,0.4)] backdrop-blur">
              <p className="eyebrow mb-3">Public panel</p>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
                {timelineFailed ? 'Map data is unavailable' : 'No road data yet'}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">
                {timelineFailed
                  ? 'We could not reach the road-quality service. Please check back in a little while.'
                  : 'Every ride with the BetterRoads app paints this map with the true condition of India’s roads. Be one of the first.'}
              </p>
              <a
                href="/app"
                className="link-underline mt-5 inline-block text-sm font-semibold text-saffron"
              >
                Get the app →
              </a>
            </div>
          </div>
        )}

        {/* Draggable timeline — the headline control */}
        {days.length > 0 && (
          <div className="absolute inset-x-3 bottom-3 z-10 sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:w-[min(40rem,calc(100vw-2rem))] sm:-translate-x-1/2">
            <TimelineBar
              days={days}
              activity={activity}
              selectedIndex={selectedIndex}
              onSelect={handleSelect}
            />
          </div>
        )}
      </div>
    </div>
  );
}
