import { useEffect, useRef, useState } from 'react';
import { AttributionControl, Map as MaplibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import type { ExpressionSpecification, MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import './test-map-lab.css';

setWorkerUrl(maplibreWorkerUrl);

type ConceptId = 'search' | 'rail' | 'pulse' | 'report' | 'guide';
type Road = { name: string; area: string; score: number; condition: string; samples: number; updated: string };

const CONCEPTS: Array<{ id: ConceptId; name: string; short: string }> = [
  { id: 'search', name: 'Find my road', short: 'Search-first' },
  { id: 'rail', name: 'Evidence rail', short: 'Map + list' },
  { id: 'pulse', name: 'India coverage', short: 'Country-first' },
  { id: 'report', name: 'Road report', short: 'Selection-first' },
  { id: 'guide', name: 'Guided atlas', short: 'Explain-first' },
];

const DEMO_ROADS: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'Measured corridor A', area: 'Andheri East', score: 89, condition: 'Good', samples: 12, updated: 'Today' }, geometry: { type: 'LineString', coordinates: [[72.856, 19.108], [72.861, 19.106], [72.867, 19.104], [72.873, 19.100], [72.879, 19.097]] } },
    { type: 'Feature', properties: { name: 'Measured corridor B', area: 'Vile Parle', score: 64, condition: 'Fair', samples: 8, updated: 'Yesterday' }, geometry: { type: 'LineString', coordinates: [[72.837, 19.103], [72.843, 19.101], [72.849, 19.099], [72.855, 19.096], [72.861, 19.094]] } },
    { type: 'Feature', properties: { name: 'Measured corridor C', area: 'Santacruz East', score: 31, condition: 'Poor', samples: 17, updated: '2 days ago' }, geometry: { type: 'LineString', coordinates: [[72.842, 19.087], [72.848, 19.085], [72.855, 19.083], [72.862, 19.080], [72.868, 19.078]] } },
    { type: 'Feature', properties: { name: 'Measured corridor D', area: 'Bandra East', score: 75, condition: 'Good', samples: 5, updated: '3 days ago' }, geometry: { type: 'LineString', coordinates: [[72.845, 19.069], [72.852, 19.067], [72.860, 19.064], [72.868, 19.061]] } },
    { type: 'Feature', properties: { name: 'Measured corridor E', area: 'Kurla', score: 48, condition: 'Fair', samples: 3, updated: '4 days ago' }, geometry: { type: 'LineString', coordinates: [[72.872, 19.086], [72.878, 19.083], [72.885, 19.079], [72.891, 19.075]] } },
  ],
};

const COVERAGE: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { city: 'Mumbai', count: 8 }, geometry: { type: 'Point', coordinates: [72.8777, 19.076] } },
    { type: 'Feature', properties: { city: 'Kolkata', count: 7 }, geometry: { type: 'Point', coordinates: [88.3639, 22.5726] } },
    { type: 'Feature', properties: { city: 'Bengaluru', count: 2 }, geometry: { type: 'Point', coordinates: [77.5946, 12.9716] } },
    { type: 'Feature', properties: { city: 'Delhi NCR', count: 2 }, geometry: { type: 'Point', coordinates: [77.1025, 28.7041] } },
    { type: 'Feature', properties: { city: 'Lucknow', count: 1 }, geometry: { type: 'Point', coordinates: [80.9462, 26.8467] } },
  ],
};

const DEFAULT_ROAD: Road = { name: 'Measured corridor B', area: 'Vile Parle', score: 64, condition: 'Fair', samples: 8, updated: 'Yesterday' };

function Icon({ name }: { name: 'search' | 'locate' | 'layers' | 'close' | 'arrow' | 'info' | 'roads' | 'history' }) {
  const paths: Record<typeof name, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,
    locate: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></>,
    layers: <><path d="m12 3-9 5 9 5 9-5-9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
    roads: <><path d="M7 3 4 21M17 3l3 18M12 3v4m0 4v4m0 4v2"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
  };
  return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Brand() {
  return <a className="tml-brand" href="/">betterroads<span>.</span></a>;
}

function QualityKey({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`tml-quality-key${compact ? ' tml-quality-key--compact' : ''}`} aria-label="Road condition colors">
      <span><i className="tml-dot tml-dot--good"/>Good</span>
      <span><i className="tml-dot tml-dot--fair"/>Fair</span>
      <span><i className="tml-dot tml-dot--poor"/>Poor</span>
    </div>
  );
}

function SearchBox({ label = 'Search a city, area or road' }: { label?: string }) {
  return <button className="tml-search" type="button"><Icon name="search"/><span>{label}</span><kbd>⌘ K</kbd></button>;
}

function MapCanvas({ mode = 'city', onSelect }: { mode?: 'city' | 'india'; onSelect?: (road: Road) => void }) {
  const mapNode = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onSelect);
  callbackRef.current = onSelect;

  useEffect(() => {
    if (!mapNode.current) return;
    const india = mode === 'india';
    const map = new MaplibreMap({
      container: mapNode.current,
      center: india ? [79.2, 22.4] : [72.862, 19.086],
      zoom: india ? 3.9 : 12.3,
      minZoom: india ? 3.3 : 9,
      maxZoom: 18,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' },
          boundary: { type: 'geojson', data: '/india-simplified.geojson' },
        },
        layers: [
          { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.75, 'raster-contrast': -0.08, 'raster-brightness-max': 0.96 } },
          { id: 'boundary-casing', type: 'line', source: 'boundary', paint: { 'line-color': '#ffffff', 'line-width': 4 } },
          { id: 'boundary', type: 'line', source: 'boundary', paint: { 'line-color': '#77736a', 'line-width': 1.2 } },
        ],
      },
    });
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(mapNode.current);
    requestAnimationFrame(() => map.resize());
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
    map.on('load', () => {
      if (india) {
        map.addSource('coverage', { type: 'geojson', data: COVERAGE });
        map.addLayer({ id: 'coverage-ring', type: 'circle', source: 'coverage', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 10, 8, 22], 'circle-color': '#e45b1a', 'circle-opacity': 0.18, 'circle-stroke-color': '#e45b1a', 'circle-stroke-width': 1.5 } });
        map.addLayer({ id: 'coverage-core', type: 'circle', source: 'coverage', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 4, 8, 9], 'circle-color': '#e45b1a', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
        map.addLayer({ id: 'coverage-label', type: 'symbol', source: 'coverage', layout: { 'text-field': ['concat', ['get', 'city'], '  ·  ', ['to-string', ['get', 'count']]], 'text-size': 12, 'text-font': ['Open Sans Semibold'], 'text-offset': [0, 1.8], 'text-anchor': 'top' }, paint: { 'text-color': '#171511', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
        map.on('click', 'coverage-core', (event: MapLayerMouseEvent) => {
          const feature = event.features?.[0];
          if (!feature || feature.geometry.type !== 'Point') return;
          map.flyTo({ center: feature.geometry.coordinates as [number, number], zoom: 10.5, duration: 900 });
        });
        map.on('mouseenter', 'coverage-core', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'coverage-core', () => { map.getCanvas().style.cursor = ''; });
        return;
      }

      map.addSource('demo-roads', { type: 'geojson', data: DEMO_ROADS });
      map.addLayer({ id: 'demo-road-casing', type: 'line', source: 'demo-roads', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-opacity': 0.96, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 6, 14, 12, 17, 17] } });
      map.addLayer({ id: 'demo-roads', type: 'line', source: 'demo-roads', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['match', ['get', 'condition'], 'Good', '#198754', 'Fair', '#e0a51b', '#c8463a'] as ExpressionSpecification, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 14, 8, 17, 12], 'line-opacity': ['case', ['<', ['get', 'samples'], 5], 0.58, 0.96] } });
      map.on('click', 'demo-roads', (event: MapLayerMouseEvent) => {
        const properties = event.features?.[0]?.properties as Road | undefined;
        if (properties) callbackRef.current?.(properties);
      });
      map.on('mouseenter', 'demo-roads', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'demo-roads', () => { map.getCanvas().style.cursor = ''; });
    });
    return () => {
      resizeObserver.disconnect();
      map.remove();
    };
  }, [mode]);

  return <div className="tml-map" ref={mapNode} aria-label={mode === 'india' ? 'Illustrative India coverage map' : 'Illustrative road-quality map of Mumbai'} />;
}

function RoadCard({ road, quiet = false }: { road: Road; quiet?: boolean }) {
  return (
    <article className={`tml-road-card${quiet ? ' tml-road-card--quiet' : ''}`}>
      <div className="tml-road-card__top"><span className={`tml-status tml-status--${road.condition.toLowerCase()}`}>{road.condition}</span><span>{road.updated}</span></div>
      <h2>{road.name}</h2>
      <p>{road.area} · Based on {road.samples} accepted passes</p>
      <div className="tml-score"><strong>{road.score}</strong><span>Road condition<br/>out of 100</span></div>
      <p className="tml-confidence">{road.samples < 5 ? 'Early reading — more journeys will improve confidence.' : 'Repeated measurements support this reading.'}</p>
    </article>
  );
}

function SearchConcept() {
  const [road, setRoad] = useState(DEFAULT_ROAD);
  return <section className="tml-concept tml-search-concept">
    <header className="tml-topbar"><Brand/><div className="tml-topbar__center"><SearchBox/></div><a className="tml-app-link" href="/app">Record a journey <Icon name="arrow"/></a></header>
    <div className="tml-map-stage"><MapCanvas onSelect={setRoad}/><div className="tml-floating-key"><b>Road condition</b><QualityKey compact/><button><Icon name="info"/>How scores work</button></div><div className="tml-map-actions"><button aria-label="Find my location"><Icon name="locate"/></button><button aria-label="Choose map layers"><Icon name="layers"/></button></div><RoadCard road={road}/></div>
    <div className="tml-demo-note">Concept preview · illustrative road readings</div>
  </section>;
}

function EvidenceRailConcept() {
  const [road, setRoad] = useState(DEFAULT_ROAD);
  const roads: Road[] = [DEFAULT_ROAD, { name: 'Measured corridor A', area: 'Andheri East', score: 89, condition: 'Good', samples: 12, updated: 'Today' }, { name: 'Measured corridor C', area: 'Santacruz East', score: 31, condition: 'Poor', samples: 17, updated: '2 days ago' }];
  return <section className="tml-concept tml-rail-concept">
    <aside className="tml-rail"><Brand/><SearchBox label="Find your area"/><div className="tml-rail__intro"><h1>Road evidence near Mumbai</h1><p>Colored lines show road condition measured from accepted journeys—not traffic or navigation routes.</p><QualityKey/></div><div className="tml-road-list"><div className="tml-road-list__head"><b>Visible roads</b><span>3 readings</span></div>{roads.map((item) => <button key={item.name} className={road.name === item.name ? 'is-active' : ''} onClick={() => setRoad(item)}><i className={`tml-dot tml-dot--${item.condition.toLowerCase()}`}/><span><b>{item.area}</b><small>{item.condition} · {item.samples} passes</small></span><strong>{item.score}</strong></button>)}</div><a className="tml-rail__cta" href="/app">Help measure another road <Icon name="arrow"/></a></aside>
    <main className="tml-rail-map"><MapCanvas onSelect={setRoad}/><RoadCard road={road} quiet/><button className="tml-layer-button"><Icon name="layers"/>Map layers</button></main>
    <div className="tml-demo-note">Concept preview · illustrative road readings</div>
  </section>;
}

function CoverageConcept() {
  return <section className="tml-concept tml-pulse-concept">
    <header className="tml-topbar tml-topbar--dark"><Brand/><div className="tml-pulse-title"><b>India’s measured roads</b><span>Public evidence map</span></div><a className="tml-app-link" href="/app">Add your city <Icon name="arrow"/></a></header>
    <div className="tml-pulse-stage"><MapCanvas mode="india"/><div className="tml-pulse-intro"><h1>See where road evidence exists.</h1><p>Each orange marker is a city with accepted measurements. Choose one to inspect individual roads.</p><SearchBox label="Search your city"/><div className="tml-coverage-summary"><span><strong>5</strong> cities represented</span><span><strong>24</strong> measured sections</span></div><small>Illustrative concept data</small></div><div className="tml-city-dock"><button><span>Mumbai</span><b>8 sections</b></button><button><span>Kolkata</span><b>7 sections</b></button><button><span>Bengaluru</span><b>2 sections</b></button><button className="tml-city-dock__more">View all cities <Icon name="arrow"/></button></div></div>
  </section>;
}

function ReportConcept() {
  const [road, setRoad] = useState(DEFAULT_ROAD);
  return <section className="tml-concept tml-report-concept">
    <div className="tml-report-map"><MapCanvas onSelect={setRoad}/><header><Brand/><SearchBox label="Search the road map"/><div className="tml-report-tools"><button><Icon name="locate"/>Near me</button><button><Icon name="layers"/>Layers</button></div></header><QualityKey/></div>
    <aside className="tml-report-sheet"><div className="tml-sheet-handle"/><div className="tml-report-sheet__heading"><div><span className={`tml-status tml-status--${road.condition.toLowerCase()}`}>{road.condition}</span><h1>{road.area}</h1><p>{road.name}</p></div><button aria-label="Close road report"><Icon name="close"/></button></div><div className="tml-report-score"><strong>{road.score}</strong><div><b>Road condition</b><p>Measured from {road.samples} accepted journeys. Last reading {road.updated.toLowerCase()}.</p></div></div><div className="tml-report-explain"><div><Icon name="roads"/><span><b>What the line means</b><small>Color follows the road section that was actually measured.</small></span></div><div><Icon name="history"/><span><b>Confidence</b><small>{road.samples >= 5 ? 'Supported by repeated passes.' : 'More passes are needed.'}</small></span></div></div><button className="tml-report-primary">See how this score is calculated <Icon name="arrow"/></button></aside>
    <div className="tml-demo-note">Concept preview · illustrative road readings</div>
  </section>;
}

function GuideConcept() {
  const [road, setRoad] = useState(DEFAULT_ROAD);
  const [step, setStep] = useState(0);
  const steps = [
    { title: 'Color shows condition', text: 'Green is good, amber is fair, and red is poor. Gray or faded lines need more evidence.' },
    { title: 'Lines are measured sections', text: 'These are not suggested routes. Each line follows a road section recorded by contributors.' },
    { title: 'Select any line for proof', text: 'Open a road report to see its score, number of accepted passes, and freshness.' },
  ];
  return <section className="tml-concept tml-guide-concept">
    <header className="tml-guide-header"><Brand/><SearchBox label="Go to a city or area"/><a className="tml-app-link" href="/app">Contribute <Icon name="arrow"/></a></header>
    <main className="tml-guide-main"><aside className="tml-guide-copy"><p className="tml-guide-count">Understanding the map · {step + 1} of 3</p><h1>{steps[step].title}</h1><p>{steps[step].text}</p>{step === 0 && <QualityKey/>}<div className="tml-guide-progress">{steps.map((item, index) => <button key={item.title} aria-label={`Show step ${index + 1}`} className={index === step ? 'is-active' : ''} onClick={() => setStep(index)}/>)}</div><button className="tml-guide-next" onClick={() => setStep((step + 1) % steps.length)}>{step === 2 ? 'Explore the map' : 'Next'} <Icon name="arrow"/></button><button className="tml-guide-skip">Skip guide</button></aside><div className="tml-guide-map"><MapCanvas onSelect={setRoad}/><RoadCard road={road} quiet/></div></main>
    <div className="tml-demo-note">Concept preview · illustrative road readings</div>
  </section>;
}

const CONCEPT_COMPONENTS: Record<ConceptId, React.ComponentType> = { search: SearchConcept, rail: EvidenceRailConcept, pulse: CoverageConcept, report: ReportConcept, guide: GuideConcept };

export default function TestMapLab() {
  const initial = new URLSearchParams(window.location.search).get('v') as ConceptId | null;
  const [active, setActive] = useState<ConceptId>(CONCEPTS.some((item) => item.id === initial) ? initial! : 'search');
  const ActiveConcept = CONCEPT_COMPONENTS[active];

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (index >= 0 && index < CONCEPTS.length) setActive(CONCEPTS[index].id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const choose = (id: ConceptId) => {
    setActive(id);
    const url = new URL(window.location.href);
    url.searchParams.set('v', id);
    window.history.replaceState({}, '', url);
  };

  return <div className="tml-shell">
    <nav className="tml-switcher" aria-label="Map concept versions">
      <div><b>Map lab</b><span>Choose a direction</span></div>
      <div className="tml-switcher__options">{CONCEPTS.map((concept, index) => <button key={concept.id} className={active === concept.id ? 'is-active' : ''} onClick={() => choose(concept.id)}><kbd>{index + 1}</kbd><span><b>{concept.name}</b><small>{concept.short}</small></span></button>)}</div>
      <a href="/map">Current map</a>
    </nav>
    <div className="tml-viewport"><ActiveConcept key={active}/></div>
  </div>;
}
