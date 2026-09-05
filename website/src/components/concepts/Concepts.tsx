import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchStats } from '@/components/map/api';
import type { PublicStats } from '@/components/map/api';
import { APP_DOWNLOAD } from '@/lib/constants';
import './concepts.css';

const DOWNLOAD_URL = 'https://betterroads.org/downloads/BetterRoads.apk';

type ConceptId = 'receipt' | 'ledger' | 'signal' | 'case-files' | 'paper-movement';

const concepts: Array<{ id: ConceptId; name: string; thesis: string; color: string }> = [
  { id: 'receipt', name: 'Journey Receipt', thesis: 'Every ride leaves proof.', color: '#e84b32' },
  { id: 'ledger', name: 'Evidence Ledger', thesis: 'The road has a witness.', color: '#b43027' },
  { id: 'signal', name: 'Signal Bridge', thesis: 'Movement becomes measurement.', color: '#c93420' },
  { id: 'case-files', name: 'Public Case Files', thesis: 'Build the record.', color: '#f0b323' },
  { id: 'paper-movement', name: 'Paper Movement', thesis: 'Your journey moves the system.', color: '#a52424' },
];

function useEvidence() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    let active = true;
    fetchStats()
      .then((value) => {
        if (!active) return;
        setStats(value);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('unavailable');
      });
    return () => { active = false; };
  }, []);

  return { stats, status };
}

function Brand({ light = false }: { light?: boolean }) {
  return <a className={`concept-brand${light ? ' concept-brand--light' : ''}`} href="/">betterroads<span>.</span></a>;
}

function DownloadLink({ children = 'Download the Android app', className = '' }: { children?: React.ReactNode; className?: string }) {
  return <a className={className} href={APP_DOWNLOAD.apkUrl} download={APP_DOWNLOAD.apkName}>{children}</a>;
}

function EvidenceLine({ stats, status }: ReturnType<typeof useEvidence>) {
  if (status === 'loading') return <p className="evidence-line" aria-live="polite">Reading the public record…</p>;
  if (status === 'unavailable' || !stats) return <p className="evidence-line">Live totals are temporarily unavailable. The public map remains open.</p>;
  return (
    <p className="evidence-line" aria-live="polite">
      Current public record · {stats.journeys.toLocaleString('en-IN')} accepted journeys · {stats.segments.toLocaleString('en-IN')} scored segments · {stats.kmRidden.toLocaleString('en-IN')} km recorded
    </p>
  );
}

function TrustStrip() {
  return (
    <div className="trust-strip">
      <span>Android 10+</span><span>No email required</span><span>Records only after you tap Start</span><span>Movement-filtered evidence</span>
    </div>
  );
}

function DownloadHandoff({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`download-handoff${dark ? ' download-handoff--dark' : ''}`}>
      <div>
        <p className="download-handoff__title">Put your next journey on record.</p>
        <p>Mount your phone securely, choose your vehicle, tap Start, and drive normally. BetterRoads pauses at traffic stops and uploads valid movement when the journey ends.</p>
        <DownloadLink className="download-handoff__button">Download BetterRoads · v{APP_DOWNLOAD.version}</DownloadLink>
      </div>
      <a className="download-handoff__qr" href={APP_DOWNLOAD.apkUrl} aria-label="Download BetterRoads APK">
        <QRCodeSVG value={DOWNLOAD_URL} size={120} bgColor="transparent" fgColor="currentColor" level="M" />
        <span>Scan on Android</span>
      </a>
    </div>
  );
}

function ConceptSwitcher({ active }: { active: ConceptId }) {
  const [open, setOpen] = useState(false);
  const [favorite, setFavorite] = useState<ConceptId | null>(() => localStorage.getItem('betterroads-concept-favorite') as ConceptId | null);
  const chooseFavorite = () => {
    localStorage.setItem('betterroads-concept-favorite', active);
    setFavorite(active);
  };
  return (
    <aside className={`concept-switcher${open ? ' is-open' : ''}`} aria-label="Concept comparison controls">
      <button className="concept-switcher__toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>Concept {concepts.findIndex((item) => item.id === active) + 1}/5</span>
        <svg viewBox="0 0 24 24" aria-hidden><path d="M5 8l7 7 7-7" /></svg>
      </button>
      <div className="concept-switcher__panel">
        <a href="/concepts">All concepts</a>
        {concepts.map((item) => <a key={item.id} className={item.id === active ? 'is-active' : ''} href={`/concepts/${item.id}`}>{item.name}</a>)}
        <button onClick={chooseFavorite}>{favorite === active ? 'Marked as my favourite' : 'Mark this as favourite'}</button>
      </div>
    </aside>
  );
}

function ConceptFooter({ light = false }: { light?: boolean }) {
  return (
    <footer className={`concept-footer${light ? ' concept-footer--light' : ''}`}>
      <Brand light={!light} />
      <p>Citizen-recorded road evidence. Built in India.</p>
      <nav><a href="/map">Public map</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav>
    </footer>
  );
}

function ReceiptPage() {
  const evidence = useEvidence();
  return (
    <div className="receipt-world">
      <ConceptSwitcher active="receipt" />
      <header className="receipt-nav"><Brand light /><span>Citizen road record · India</span><a href="/map">Open map</a></header>
      <main>
        <section className="receipt-hero">
          <div className="receipt-road" aria-hidden><i /><i /><i /><i /></div>
          <article className="receipt-paper">
            <div className="receipt-paper__meta"><span>BETTERROADS / PUBLIC RECORD</span><span>BR–{new Date().getFullYear()}–IND</span></div>
            <h1>This road has<br />a memory now.</h1>
            <p className="receipt-paper__lead">Your phone can turn an ordinary drive into evidence nobody has to take on faith.</p>
            <div className="receipt-status"><b>JOURNEY</b><span>movement confirmed</span><strong>RECORDING</strong></div>
            <EvidenceLine {...evidence} />
            <DownloadLink className="receipt-cta"><span>ADD YOUR NEXT JOURNEY</span><b>DOWNLOAD APK ↓</b></DownloadLink>
          </article>
        </section>
        <section className="receipt-story">
          <p className="receipt-story__margin">HOW PROOF IS PRINTED</p>
          <div className="receipt-story__steps">
            <article><span>08:41:02</span><h2>You tap Start.</h2><p>The app waits for reliable GPS and confirmed movement. A shaking phone or parked vehicle scores nothing.</p></article>
            <article><span>08:41:24</span><h2>The road speaks.</h2><p>Location and motion signals become distance, roughness, bumps, and a filtered path while you move.</p></article>
            <article><span>09:06:11</span><h2>The record becomes public.</h2><p>Valid journeys update scored road segments. Uncertain data is kept out of public intelligence.</p></article>
          </div>
        </section>
        <section className="receipt-wall">
          <p>THE AMBITION / CLEARLY FUTURE-FACING</p>
          <h2>A receipt for every road.<br />A record no city can misplace.</h2>
          <div className="receipt-rolls" aria-hidden>{Array.from({ length: 12 }, (_, i) => <span key={i}>BR/{String(i + 1).padStart(3, '0')} · VERIFIED JOURNEY · INDIA</span>)}</div>
        </section>
        <section className="receipt-download"><DownloadHandoff dark /></section>
      </main>
      <TrustStrip /><ConceptFooter />
    </div>
  );
}

function LedgerPage() {
  const evidence = useEvidence();
  return (
    <div className="ledger-world">
      <ConceptSwitcher active="ledger" />
      <header className="ledger-nav"><Brand /><span>Citizens’ road measurement book</span><a href="/map">Inspect the live record ↗</a></header>
      <main>
        <section className="ledger-hero">
          <div className="ledger-rule" aria-hidden />
          <div className="ledger-hero__copy"><p>ENTRY / ROAD EVIDENCE / INDIA</p><h1>The road now<br />has a witness.</h1><p className="ledger-hero__lead">BetterRoads gives every moving phone one job: measure what the road feels like and put it on a public record.</p><DownloadLink className="ledger-button">Put your journey on record</DownloadLink></div>
          <div className="ledger-map" aria-label="Illustration of a measured road trace"><span className="ledger-stamp">RECORDED<br />BY CITIZENS</span><svg viewBox="0 0 500 620" aria-hidden><path className="ledger-gridline" d="M70 20v580M160 20v580M250 20v580M340 20v580M430 20v580M20 100h460M20 200h460M20 300h460M20 400h460M20 500h460"/><path className="ledger-route" d="M70 540C160 500 110 420 220 385s40-150 150-175 35-120 95-170"/><circle cx="70" cy="540" r="9"/><circle cx="465" cy="40" r="9"/></svg></div>
          <EvidenceLine {...evidence} />
        </section>
        <section className="ledger-entries">
          <article><b>SENSE</b><h2>The phone measures only while you move.</h2><p>Reliable fixes, accuracy-aware distance, and motion confirmation keep parking-lot drift out of the record.</p><span>Field note: traffic stops pause automatically</span></article>
          <article><b>VERIFY</b><h2>Uncertain data does not become public truth.</h2><p>Short, weak, discontinuous, or implausible journeys are discarded or quarantined before aggregation.</p><span>Field note: quality before quantity</span></article>
          <article><b>PUBLISH</b><h2>Accepted journeys redraw the shared ledger.</h2><p>Road segments, RQI, and verified events appear on the public map for anyone to inspect.</p><a href="/map">Open the public map ↗</a></article>
        </section>
        <section className="ledger-ambition"><div><p>NATIONAL REGISTER / INTENDED FUTURE</p><h2>Not another complaint counter.<br />A memory for the road network.</h2></div><p>Our ambition is a citizen-built record across India: comparable over time, open to scrutiny, and difficult to erase. The network is early. Every valid journey makes the next claim stronger.</p></section>
        <section className="ledger-download"><DownloadHandoff /></section>
      </main>
      <TrustStrip /><ConceptFooter light />
    </div>
  );
}

function Meter({ label, value, delay = 0 }: { label: string; value: number; delay?: number }) {
  return <div className="vu-meter" style={{ '--needle': `${-45 + value * 0.9}deg`, '--delay': `${delay}ms` } as React.CSSProperties}><div className="vu-meter__face"><span className="vu-meter__scale">−20　−10　−3　0　<span>+3</span></span><i /><b>{label}</b></div></div>;
}

function SignalPage() {
  const evidence = useEvidence();
  const values = [32, 47, 71, 58, 85, 63, 44, 77];
  return (
    <div className="signal-world">
      <ConceptSwitcher active="signal" />
      <header className="signal-nav"><Brand light /><span>ROAD SIGNAL BRIDGE</span><a href="/map">PUBLIC OUTPUT</a></header>
      <main>
        <section className="signal-hero">
          <div className="signal-title"><h1>When India moves,<br /><span>the needles move.</span></h1><p>One mounted phone feels a road. A verified network turns that feeling into public evidence.</p><DownloadLink className="signal-button">CONNECT YOUR PHONE</DownloadLink></div>
          <div className="meter-bridge" aria-hidden>{values.map((value, index) => <Meter key={index} label={`CH ${String(index + 1).padStart(2, '0')}`} value={value} delay={index * 70} />)}</div>
          <EvidenceLine {...evidence} />
        </section>
        <section className="signal-chain">
          <div className="signal-chain__copy"><h2>A bump is noise.<br />A pattern is evidence.</h2><p>The app rejects weak GPS, impossible jumps, parked drift, and stationary handling. It records road signals only after movement is confirmed.</p></div>
          <div className="signal-scope" aria-hidden><div className="signal-wave">{Array.from({ length: 52 }, (_, i) => <i key={i} style={{ height: `${12 + ((i * 17) % 65)}%` }} />)}</div><span>RAW MOTION</span><span>FILTERED MOVEMENT</span><span>ROAD SCORE</span></div>
        </section>
        <section className="signal-network"><h2>Today: an early instrument.<br />Tomorrow: a national listening network.</h2><p>That second line is the ambition—not a claim of current coverage. The public map shows exactly what citizens have recorded so far.</p><a href="/map">LISTEN TO THE LIVE MAP ↗</a></section>
        <section className="signal-download"><DownloadHandoff dark /></section>
      </main>
      <TrustStrip /><ConceptFooter />
    </div>
  );
}

function CaseFilesPage() {
  const evidence = useEvidence();
  return (
    <div className="case-world">
      <ConceptSwitcher active="case-files" />
      <header className="case-nav"><Brand light /><span>THE CITIZEN EVIDENCE DESK</span><a href="/map">OPEN FILES</a></header>
      <main>
        <section className="case-hero">
          <div className="case-photo" role="img" aria-label="A damaged road under a monsoon sky" />
          <div className="case-headline"><p>THE PUBLIC CASE FOR BETTER ROADS</p><h1>Bad roads leave<br />no record.<br /><em>Until now.</em></h1><div className="case-actions"><DownloadLink className="case-button">FILE YOUR NEXT JOURNEY</DownloadLink><a href="/map">Examine the evidence ↗</a></div></div>
          <div className="case-docket"><span>DOCKET BR–IND</span><strong>OPEN</strong><p>A mounted Android phone can turn the road beneath you into a measured, public trace.</p></div>
        </section>
        <EvidenceLine {...evidence} />
        <section className="case-files">
          <article><p>EXHIBIT A / THE MISSING MEMORY</p><h2>A complaint disappears.<br />A measured route remains.</h2><p>BetterRoads records location and motion during a journey you start. Accepted evidence updates a map anyone can inspect.</p></article>
          <article><p>EXHIBIT B / QUALITY CONTROL</p><h2>The case rejects bad evidence.</h2><ul><li>Parked GPS drift scores nothing.</li><li>Traffic stops pause the journey.</li><li>Impossible jumps are removed.</li><li>Uncertain uploads stay out of public totals.</li></ul></article>
          <article><p>EXHIBIT C / PUBLIC ACCESS</p><h2>No private dashboard required.</h2><p>The public map shows scored roads and verified events without exposing a contributor’s private journey history.</p><a href="/map">View the public record ↗</a></article>
        </section>
        <section className="case-ambition"><p>THE NEXT FILE / STATED AMBITION</p><h2>Build enough evidence that neglect becomes harder to deny.</h2><p>BetterRoads is early. The goal is a durable citizen record across India—not a claim that the country is already mapped or that a recorded road has been repaired.</p></section>
        <section className="case-download"><DownloadHandoff dark /></section>
      </main>
      <TrustStrip /><ConceptFooter />
    </div>
  );
}

function PaperMachine() {
  return (
    <div className="paper-machine" role="img" aria-label="A paper mechanism connecting a phone to a public road map">
      <div className="paper-phone"><span>START</span><i /></div><div className="paper-link paper-link--one" />
      <div className="paper-wheel"><i /><i /><i /><i /></div><div className="paper-link paper-link--two" />
      <div className="paper-map"><svg viewBox="0 0 180 140" aria-hidden><path d="M18 115C42 95 30 65 72 60s33-35 82-43"/><circle cx="18" cy="115" r="5"/><circle cx="154" cy="17" r="5"/></svg><b>PUBLIC</b></div>
      <div className="paper-crank" aria-hidden><span /><i /></div>
    </div>
  );
}

function PaperPage() {
  const evidence = useEvidence();
  return (
    <div className="paper-world">
      <ConceptSwitcher active="paper-movement" />
      <header className="paper-nav"><Brand /><span>A CITIZEN MACHINE FOR ROAD EVIDENCE</span><a href="/map">THE PUBLIC MAP</a></header>
      <main>
        <section className="paper-hero">
          <div className="paper-hero__copy"><h1>Your journey<br /><span>moves the record.</span></h1><p>Tap Start. Drive normally. Watch one ordinary phone action connect to something larger than a complaint.</p><DownloadLink className="paper-button">ADD YOUR PHONE TO THE MOVEMENT</DownloadLink></div>
          <PaperMachine />
          <EvidenceLine {...evidence} />
        </section>
        <section className="paper-process"><article><span>SENSE</span><h2>The phone moves.</h2><p>Mounted location and motion sensors observe only the journey you chose to start.</p></article><i aria-hidden /><article><span>VERIFY</span><h2>The mechanism checks.</h2><p>Movement gates and server checks keep stationary drift and impossible data out.</p></article><i aria-hidden /><article><span>PUBLISH</span><h2>The map remembers.</h2><p>Accepted journeys add scored segments to a public road record.</p></article></section>
        <section className="paper-crowd"><div className="paper-crowd__figures" aria-hidden>{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}</div><div><p>THE FUTURE MECHANISM</p><h2>One phone draws a line.<br />A country of journeys could redraw the conversation.</h2><p>That scale is the ambition. The live public record shows where the movement actually stands today.</p><a href="/map">See today’s record ↗</a></div></section>
        <section className="paper-download"><DownloadHandoff /></section>
      </main>
      <TrustStrip /><ConceptFooter light />
    </div>
  );
}

function ConceptIndex() {
  const favorite = useMemo(() => localStorage.getItem('betterroads-concept-favorite'), []);
  return (
    <div className="concept-index">
      <header><Brand light /><p>Private homepage study · five complete directions</p></header>
      <main><h1>Five ways to make<br />the road impossible to ignore.</h1><p className="concept-index__intro">Open every direction on desktop and mobile. Judge the first ten seconds, the clarity of the mechanism, and whether the page makes you want to record a journey.</p><ol>{concepts.map((item, index) => <li key={item.id} style={{ '--concept-color': item.color } as React.CSSProperties}><a href={`/concepts/${item.id}`}><span>{String(index + 1).padStart(2, '0')}</span><div><h2>{item.name}</h2><p>{item.thesis}</p></div><b>{favorite === item.id ? 'YOUR FAVOURITE' : 'OPEN CONCEPT'} ↗</b></a></li>)}</ol></main>
    </div>
  );
}

export default function Concepts({ path }: { path: string }) {
  useEffect(() => {
    window.scrollTo(0, 0);
    const id = path.split('/')[2] as ConceptId | undefined;
    const current = concepts.find((item) => item.id === id);
    document.title = current ? `${current.name} — BetterRoads concept` : 'BetterRoads homepage concepts';
    return () => { document.title = 'BetterRoads — Freedom From Potholes'; };
  }, [path]);
  const id = path.split('/')[2] as ConceptId | undefined;
  if (!id) return <ConceptIndex />;
  if (id === 'receipt') return <ReceiptPage />;
  if (id === 'ledger') return <LedgerPage />;
  if (id === 'signal') return <SignalPage />;
  if (id === 'case-files') return <CaseFilesPage />;
  if (id === 'paper-movement') return <PaperPage />;
  return <ConceptIndex />;
}
