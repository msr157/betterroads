import { useEffect, useRef } from 'react';
import { AttributionControl, LngLatBounds, Map, NavigationControl, type GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection, Geometry } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';

type Data = {
  segments: Array<{ geometry: [number, number][]; rqi: number }>;
  events: Array<{ lat: number; lon: number; type: string; severity: number }>;
  contracts: Array<{ geometry: Geometry; roadName: string }>;
  replayPath?: [number, number, number][];
};
const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

function applyData(map: Map, data: Data): void {
  const segments = data.segments.filter((segment) => segment.geometry.length >= 2).map((segment) => ({
    type: 'Feature' as const,
    properties: { rqi: segment.rqi },
    geometry: { type: 'LineString' as const, coordinates: segment.geometry.map(([lat, lon]) => [lon, lat]) },
  }));
  const replay = (data.replayPath ?? []).map(([lat, lon]) => [lon, lat]);
  (map.getSource('segments') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: segments });
  (map.getSource('events') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: data.events.map((event) => ({ type: 'Feature', properties: event, geometry: { type: 'Point', coordinates: [event.lon, event.lat] } })) });
  (map.getSource('contracts') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: data.contracts.map((contract) => ({ type: 'Feature', properties: { roadName: contract.roadName }, geometry: contract.geometry })) });
  (map.getSource('replay') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: replay.length >= 2 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: replay } }] : [] });

  const visible = replay.length >= 2 ? replay : segments.flatMap((feature) => feature.geometry.coordinates);
  if (visible.length >= 2) {
    const bounds = visible.reduce((value, coordinate) => value.extend(coordinate as [number, number]), new LngLatBounds(visible[0] as [number, number], visible[0] as [number, number]));
    map.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 650 });
  }
}

export default function AnalyticsMap({ data }: { data: Data | null }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const dataRef = useRef<Data | null>(data);
  dataRef.current = data;

  useEffect(() => {
    if (!elementRef.current) return;
    const map = new Map({
      container: elementRef.current,
      center: [79.5, 22.3],
      zoom: 4,
      attributionControl: false,
      style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap contributors' } }, layers: [{ id: 'osm', type: 'raster', source: 'osm' }] },
    });
    mapRef.current = map;
    map.addControl(new NavigationControl(), 'top-right');
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
    map.on('load', () => {
      map.addSource('segments', { type: 'geojson', data: empty });
      map.addSource('events', { type: 'geojson', data: empty });
      map.addSource('contracts', { type: 'geojson', data: empty });
      map.addSource('replay', { type: 'geojson', data: empty });
      map.addLayer({ id: 'segments', type: 'line', source: 'segments', paint: { 'line-color': ['interpolate', ['linear'], ['get', 'rqi'], 0, '#dc2626', 50, '#f59e0b', 100, '#16a34a'], 'line-width': 5 } });
      map.addLayer({ id: 'contracts', type: 'line', source: 'contracts', paint: { 'line-color': '#2563eb', 'line-width': 5, 'line-dasharray': [2, 1] } });
      map.addLayer({ id: 'replay', type: 'line', source: 'replay', paint: { 'line-color': '#a855f7', 'line-width': 7 } });
      map.addLayer({ id: 'events', type: 'circle', source: 'events', paint: { 'circle-color': '#dc2626', 'circle-radius': ['interpolate', ['linear'], ['get', 'severity'], 0, 3, 1, 9], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } });
      if (dataRef.current) applyData(map, dataRef.current);
    });
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.isStyleLoaded() && data) applyData(map, data);
  }, [data]);

  return <div ref={elementRef} aria-label="Road coverage map" className="mt-6 h-[30rem] overflow-hidden rounded-2xl border border-line" />;
}
