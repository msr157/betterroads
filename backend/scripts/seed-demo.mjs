/**
 * seed-demo.mjs — generate ~6 months of synthetic journeys so the public map
 * timeline is demoable before real data exists.
 *
 * DEV ONLY. Refuses to run unless SEED_DEMO=1 is set, and never against a
 * database whose host isn't local (localhost/127.0.0.1) unless
 * SEED_DEMO_FORCE=1 is also set.
 *
 * Usage:
 *   SEED_DEMO=1 DATABASE_URL=postgres://... API_URL=http://localhost:3000 node scripts/seed-demo.mjs
 *
 * It seeds through the real ingestion endpoint (POST /user/mobile/traveldata)
 * so the whole pipeline — validation, device upsert, aggregation, snapshots —
 * is exercised exactly as production traffic would.
 */

import { randomUUID } from 'node:crypto';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

if (process.env.SEED_DEMO !== '1') {
  console.error('Refusing to run: set SEED_DEMO=1 to seed demo data (dev only).');
  process.exit(1);
}
const dbUrl = process.env.DATABASE_URL ?? '';
const isLocal = /localhost|127\.0\.0\.1/.test(dbUrl) || /localhost|127\.0\.0\.1/.test(API_URL);
if (!isLocal && process.env.SEED_DEMO_FORCE !== '1') {
  console.error('Refusing to run against a non-local target without SEED_DEMO_FORCE=1.');
  process.exit(1);
}

// ─── Demo road network: a few well-known Mumbai corridors ────────────────────
// Each route is a rough polyline; journeys interpolate along it.

const ROUTES = [
  {
    name: 'Bandra → Mahim (SV Road)',
    // Quality degrades over the 6 months (monsoon), then partially recovers.
    qualityCurve: (t) => 78 - 25 * Math.sin(Math.min(t, 0.75) * Math.PI),
    points: [
      [19.0596, 72.8295], [19.0549, 72.8318], [19.0507, 72.8341],
      [19.0466, 72.8367], [19.0426, 72.8394], [19.0388, 72.8412], [19.0330, 72.8397],
    ],
  },
  {
    name: 'Worli Sea Face',
    // Consistently good road, slight wear.
    qualityCurve: (t) => 88 - 6 * t,
    points: [
      [19.0176, 72.8151], [19.0130, 72.8146], [19.0083, 72.8152],
      [19.0037, 72.8165], [18.9986, 72.8172],
    ],
  },
  {
    name: 'Kurla → Sion (LBS Marg)',
    // Bad road that gets repaired mid-window: sharp improvement.
    qualityCurve: (t) => (t < 0.55 ? 42 - 12 * t : 74),
    points: [
      [19.0726, 72.8845], [19.0687, 72.8810], [19.0645, 72.8772],
      [19.0605, 72.8737], [19.0563, 72.8703], [19.0466, 72.8656],
    ],
  },
];

const VEHICLES = ['CAR', 'BIKE', 'AUTO_RICKSHAW', 'CAR', 'BIKE'];
const envInt = (name, fallback, max) => {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) && value >= 1 ? Math.min(max, value) : fallback;
};
const DAYS = envInt('SEED_DAYS', 180, 365);
const JOURNEYS_PER_DAY = envInt('SEED_JOURNEYS_PER_DAY', 3, 20); // per route

// Deterministic-ish PRNG so reruns look similar.
let seed = 42;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return seed / 2 ** 31;
}

function interpolate(points, t) {
  const scaled = t * (points.length - 1);
  const i = Math.min(Math.floor(scaled), points.length - 2);
  const f = scaled - i;
  return [
    points[i][0] + (points[i + 1][0] - points[i][0]) * f,
    points[i][1] + (points[i + 1][1] - points[i][1]) * f,
  ];
}

function haversineM(a, b) {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function buildJourney(route, dayIndex, startMs) {
  const t = dayIndex / DAYS; // 0..1 through the demo window
  const baseRqi = route.qualityCurve(t);
  const vehicle = VEHICLES[Math.floor(rand() * VEHICLES.length)];

  const SEG_LEN_M = 300;
  const segments = [];
  const events = [];
  const pts = route.points;

  let totalM = 0;
  for (let i = 0; i < pts.length - 1; i++) totalM += haversineM(pts[i], pts[i + 1]);
  const segCount = Math.max(1, Math.round(totalM / SEG_LEN_M));

  for (let i = 0; i < segCount; i++) {
    const [sLat, sLon] = interpolate(pts, i / segCount);
    const [eLat, eLon] = interpolate(pts, (i + 1) / segCount);
    // Per-segment variation around the route's quality for this day.
    const rqi = Math.min(100, Math.max(5, baseRqi + (rand() - 0.5) * 18));
    let segEvents = 0;

    // Worse segments throw more pothole events.
    const eventChance = rqi < 45 ? 0.5 : rqi < 65 ? 0.2 : 0.05;
    if (rand() < eventChance) {
      segEvents = 1;
      const [lat, lon] = interpolate(pts, (i + rand()) / segCount);
      events.push({
        id: randomUUID(),
        type: rqi < 45 ? 'POTHOLE' : rand() < 0.4 ? 'SPEED_BREAKER' : 'BUMP',
        severity: Math.min(1, Math.max(0.1, (75 - rqi) / 60 + rand() * 0.2)),
        timestamp: startMs + Math.floor(rand() * 1200_000),
        lat,
        lon,
        speedKmh: 15 + rand() * 30,
        accelZ: 12 + rand() * 14,
      });
    }

    segments.push({
      segmentIndex: i,
      startLat: sLat,
      startLon: sLon,
      endLat: eLat,
      endLon: eLon,
      lengthM: totalM / segCount,
      rqiScore: Math.round(rqi * 10) / 10,
      eventCount: segEvents,
      avgRms: Math.max(0.1, (100 - rqi) / 40),
    });
  }

  const durationS = Math.round((totalM / 1000 / (18 + rand() * 12)) * 3600);
  const journeyRqi = segments.reduce((s, x) => s + x.rqiScore, 0) / segments.length;

  return {
    schemaVersion: 1,
    device: {
      uuid: DEVICE_POOL[Math.floor(rand() * DEVICE_POOL.length)],
      platform: 'android',
      model: 'Demo Seeder',
      appVersion: '0.0.0-demo',
    },
    journey: {
      id: randomUUID(),
      startedAt: startMs,
      endedAt: startMs + durationS * 1000,
      distanceM: Math.round(totalM),
      durationS,
      avgSpeedKmh: Math.round((totalM / 1000 / (durationS / 3600)) * 10) / 10,
      vehicleType: vehicle,
      phoneMountPosition: 'DASH_MOUNT',
      baseFloorRms: vehicle === 'AUTO_RICKSHAW' ? 1.1 : vehicle === 'BIKE' ? 0.7 : 0.35,
      rqiScore: Math.round(journeyRqi * 10) / 10,
      startLat: pts[0][0],
      startLon: pts[0][1],
      endLat: pts[pts.length - 1][0],
      endLon: pts[pts.length - 1][1],
    },
    segments,
    events,
    path: pts.map(([lat, lon], index) => [
      lat,
      lon,
      startMs + Math.round((durationS * 1000 * index) / Math.max(1, pts.length - 1)),
    ]),
  };
}

const DEVICE_POOL = Array.from({ length: 12 }, () => randomUUID());

async function main() {
  const authResponse = await fetch(`${API_URL}/api/mobile/auth/guest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      deviceUuid: DEVICE_POOL[0],
      platform: 'android',
      model: 'Demo Seeder',
      appVersion: '0.0.0-demo',
    }),
  });
  if (!authResponse.ok) {
    throw new Error(`Could not create demo contributor session (${authResponse.status}): ${await authResponse.text()}`);
  }
  const auth = await authResponse.json();
  if (!auth.token) throw new Error('Demo contributor session did not return a token.');

  const endOfWindow = Date.now() - 86_400_000; // through yesterday
  let sent = 0;
  let failed = 0;

  for (let day = 0; day < DAYS; day++) {
    const dayStartMs = endOfWindow - (DAYS - day) * 86_400_000;
    for (const route of ROUTES) {
      for (let j = 0; j < JOURNEYS_PER_DAY; j++) {
        const startMs = dayStartMs + Math.floor(rand() * 14 * 3600_000) + 6 * 3600_000;
        const payload = buildJourney(route, day, startMs);
        const res = await fetch(`${API_URL}/user/mobile/traveldata`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${auth.token}`,
            // Rotate the forwarded IP so the dev server's per-IP rate limiter
            // (6/min) doesn't throttle the seed run. Works because
            // TRUST_PROXY defaults to trusting this header in dev.
            'x-forwarded-for': `10.${(sent >> 16) & 255}.${(sent >> 8) & 255}.${sent & 255}`,
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) sent++;
        else {
          failed++;
          if (failed <= 3) console.error(`  upload failed (${res.status}):`, await res.text());
        }
      }
    }
    if (day % 30 === 0) console.log(`day ${day}/${DAYS} — ${sent} journeys sent`);
    // The ingestion route is rate-limited per IP (6/min) only in prod configs;
    // locally TRUST_PROXY defaults allow bursts. Small pause to be kind anyway.
    if (day % 10 === 9) await new Promise((r) => setTimeout(r, 50));
  }

  console.log(`done: ${sent} journeys sent, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
