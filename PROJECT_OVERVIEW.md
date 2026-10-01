# BetterRoads Project: Complete Understanding

**Last Updated:** October 2, 2026  
**Current Version:** v1.3.1 (Mobile), v1.2.1 (Platform)  
**Branch:** `fix/android-background-recording`  
**Production URL:** https://betterroads.org

---

## Executive Summary

BetterRoads is a citizen-powered road infrastructure monitoring platform that turns smartphones into distributed road-sensing networks. Indian drivers mount their phones, record journeys, and contribute GPS + motion sensor data that scores road quality and creates public evidence of road conditions. The platform combines a React Native mobile app, Node.js backend API, public map interface, administrator dashboard, and Python AI analysis pipeline.

**Core Mission:** Phone to proof, proof to public record, public record to pressure.

**Key Innovation:** Manual, user-started foreground service on Android that keeps GPS and motion capture running with the screen locked, creating a durable journey journal that survives process death.

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         BetterRoads Platform                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Mobile App (React Native/Expo)                                  │
│  ├─ Android foreground service recording                         │
│  ├─ GPS + Accelerometer + Gyroscope (50Hz)                      │
│  ├─ On-device motion filtering & RQI calculation                │
│  ├─ Offline queue with encrypted account binding                │
│  └─ Device-linked identity + optional Google Sign-In            │
│                                                                   │
│  Backend API (Node.js/Hono)                                      │
│  ├─ Journey ingestion & validation                              │
│  ├─ Collection protocol v3 (vehicle-separated data)             │
│  ├─ User auth (device-linked + Google OAuth)                    │
│  ├─ Admin operations & contract management                       │
│  └─ Public data APIs (map, stats, leaderboard)                  │
│                                                                   │
│  Database (PostgreSQL)                                           │
│  ├─ Users, sessions, devices, journeys                          │
│  ├─ Collection sessions, windows, markers, raw objects          │
│  ├─ Road segments, snapshots, events, contracts                 │
│  └─ Drizzle ORM migrations                                      │
│                                                                   │
│  Website (React/Vite)                                            │
│  ├─ Public marketing & campaign pages                           │
│  ├─ MapLibre GL map with road quality overlays                  │
│  ├─ Historical timeline playback                                │
│  ├─ APK download & legal pages                                  │
│  └─ Feedback widget with CAPTCHA                                │
│                                                                   │
│  Dashboard (React/Vite)                                          │
│  ├─ Administrator authentication                                 │
│  ├─ Journey operations & device management                       │
│  ├─ Map analytics with filters & replay                         │
│  ├─ Contract CRUD & CSV import                                   │
│  └─ GeoJSON export                                              │
│                                                                   │
│  AI Engine (Python)                                              │
│  ├─ Event clustering & reclassification                         │
│  ├─ Speed breaker detection from repeated signals               │
│  └─ Deterministic aggregate rebuild                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Mobile** | React Native 0.86, Expo SDK 57, TypeScript 6.0, React 19.2 |
| **Backend** | Node.js 20, Hono 4.7, Drizzle ORM 0.44, Zod 3.25, PostgreSQL |
| **Frontend** | React 19, Vite, MapLibre GL, TypeScript |
| **Native** | Kotlin (Android recording service), Expo Modules |
| **AI/Data** | Python 3.11+, psycopg, NumPy |
| **Infra** | Docker, Dokploy, Traefik, Cloudflare Tunnel, nginx |
| **Maps** | CartoDB tiles, OpenStreetMap, DataMeet India GeoJSON |

---

## Current Branch: Android Background Recording

The active branch `fix/android-background-recording` implements **native foreground service recording** for Android, solving the critical limitation where journeys would stop when the screen locked.

### What's New

1. **Native Recording Service** (`RecordingService.kt`)
   - Foreground service with location service type
   - Owns hardware sensors independently of React/Activity lifecycle
   - Writes newline-delimited JSON journal to no-backup storage
   - Partial wake lock for screen-off operation
   - Health checks every 1s, syncs journal to disk
   - 12-hour and 256MB safety limits

2. **Journal Replay System** (`journalReplay.ts`)
   - Bounded page-based journal reading (1000 rows/page)
   - Replays sensor data through existing collection engine
   - Handles incomplete final lines from process death
   - Advances offset only after full page consumed

3. **Recovery Flow**
   - App checks for existing journal on launch
   - Restores recorder state if journal owner matches current user
   - Syncs native journal incrementally during recording
   - Prevents cross-account journal access

### Key Files Modified

- `mobile/app/modules/road-recorder/` — Native Kotlin module
- `mobile/app/src/journeyRecorder.ts` — Main recorder with native integration
- `mobile/app/src/collection/journalReplay.ts` — Journal parsing
- `mobile/app/src/collection/nativeRecording.ts` — Bridge interface
- `docs/ANDROID_BACKGROUND_RECORDING.md` — Implementation docs

---

## Data Collection Architecture

### Collection Protocol V3 (Vehicle-Separated)

The platform uses a research-grade **controlled collection protocol** that deliberately avoids camera/video and uses vehicle-specific sensor profiles.

#### Journey Recording Flow

```
User selects vehicle → Mounts phone → Starts journey
  ↓
Android: Native foreground service starts
  GPS (1Hz, navigation accuracy)
  Accelerometer (50Hz, m/s²)
  Gyroscope (50Hz, rad/s)
  ↓
Motion filter (quality fixes, speed gates)
  ↓
Collection engine (vehicle profile, mount calibration)
  ↓
Feature window extraction (candidates + random normals)
  ↓
Stop journey → Validation (distance, duration, GPS quality)
  ↓
Upload or queue if offline
```

#### What Gets Collected

**Standard Mode:**
- Feature windows (300ms sensor excerpts around triggers)
- GPS path (downsampled, max 2s intervals)
- Vehicle class, subtype, mount position, metadata
- RQI scores, event detections, quality diagnostics

**Controlled Research Mode:**
- Everything from standard mode
- Raw sensor windows (gzipped JSON → S3)
- Research markers (passenger/operator placed)
- Full replay capability for model development

### Vehicle Profiles

Separate calibrated profiles for:
- **CAR** (sedan, SUV, hatchback)
- **BIKE** (motorcycle, scooter)
- **AUTO_RICKSHAW** (3-wheeler)
- **BUS**, **TRUCK** (future)

Each profile defines:
- Trigger thresholds (impact, lateral, jerk)
- Mount positions (dashboard, handlebar, etc.)
- Metadata requirements (age band, powertrain, load)
- Feature versions and sampling rates

### Quality Gates

Journeys are quarantined if they fail:
- GPS cadence < 0.3 Hz
- Sensor cadence < 30 Hz
- Mean GPS accuracy > 50m
- Mount instability ratio > 0.4
- Distance < 100m or duration < 20s (standard mode)

---

## Mobile App Deep Dive

### Identity & Authentication

**Device-Linked Entry** (default, stable channel):
1. App generates random installation UUID
2. `POST /api/mobile/auth/guest` creates/resumes contributor
3. Returns 90-day bearer token
4. Token stored in Expo Secure Store
5. User gets immutable public ID + editable username

**Google Sign-In** (enabled v1.3.1):
- Optional Google OAuth in stable builds
- `POST /api/mobile/auth/google` exchanges ID token
- Links existing device account or creates new
- Profile pre-populated from Google

### Journey Recorder (`journeyRecorder.ts`)

Core class that orchestrates:
- Permission requests (location + notification)
- Native service lifecycle (Android) or foreground listeners (iOS)
- Sensor clock synchronization (epoch offset + drift)
- Motion state machine (stationary → moving → stationary)
- GPS path filtering and interpolation
- Feature window triggering and location attachment
- Stop validation and preparation

**Key Methods:**
- `static recover()` — Restore interrupted journey from journal
- `start()` — Begin recording (native service or foreground)
- `syncNative()` — Drain journal pages and replay
- `stop()` — Finalize and prepare for upload
- `markRoadFeature()` — Passenger marker (controlled mode only)

### Offline Queue

Completed journeys are saved to `pending-collections-v3/`:
- One JSON manifest per session
- Raw objects stored in session subdirectory
- Bound to user ID (cross-account isolation)
- Automatic flush on launch + connectivity
- Idempotent upload (session UUID)

### UI Structure

**App.tsx** — Top-level routing:
1. SplashView (boot/restore)
2. OnboardingView (guest/Google entry)
3. ProfileEditor (initial setup + edits)
4. JourneyDashboard (main recording interface)

**JourneyDashboard** — Recording screen:
- Vehicle/mode/subtype/mount selection
- Real-time snapshot (distance, candidates, mount status)
- Start/Stop journey controls
- Mark road feature (research only)
- Pending upload count
- Profile pill + feedback button

---

## Backend API Architecture

### Route Groups

| Prefix | Auth | Purpose |
|--------|------|---------|
| `/api/mobile` | Bearer | Guest entry, Google exchange, profile, logout, deletion |
| `/api/user/mobile/collection` | Bearer | Collection v3 init, raw uploads, complete, cancel |
| `/api/user/mobile/traveldata` | Bearer | Legacy journey ingestion (deprecated) |
| `/api/public` | Public | Roads, events, stats, timeline, leaderboard, contracts |
| `/api/admin` | Admin bearer | Operations, map analytics, contracts, security |
| `/api/waitlist` | Public | Waitlist signup |
| `/health` | Public | Container health check |

### Collection V3 Upload Flow

```
1. POST /collection/sessions/init
   - Validates vehicle profile versions match
   - Checks controlled research authorization
   - Creates session row (UPLOADING state)
   - Returns session ID + upload state

2. POST /collection/sessions/:id/raw-uploads (controlled only)
   - Validates manifests against init
   - Generates S3 presigned PUT URLs
   - Returns upload URLs + headers
   - Client PUTs raw objects directly to S3

3. POST /collection/sessions/:id/complete
   - Validates payload against init
   - Evaluates quality (quarantine vs received)
   - Verifies raw objects in S3 (size + SHA256)
   - Inserts windows + markers
   - Updates session (COMPLETE state)
   - Returns status + optional quarantine reasons
```

### Security Model

- **Mobile sessions:** 90-day bearer tokens, HMAC-SHA-256 hashed
- **Admin sessions:** 24-hour bearer tokens, HMAC-SHA-256 hashed
- **Admin passwords:** scrypt with salt
- **Rate limiting:** In-memory per-process (needs Redis for multi-replica)
- **CORS:** Explicit production allowlist
- **Account deletion:** Anonymizes journeys, preserves road data

### Database Schema Highlights

**Collection Tables:**
- `collection_sessions` — Session metadata, quality status, timing
- `collection_windows` — Feature windows with triggers + location
- `collection_markers` — Research operator markers
- `collection_raw_objects` — S3 manifest + verification state

**Core Tables:**
- `users` — Public ID, username, Google subject, leaderboard opt-in
- `user_sessions` — Token hashes, expiry, revocation
- `devices` — Installation UUID, platform, model, owner
- `journeys` — Legacy schema (being migrated to collection v3)
- `road_segments` — Quantized cell RQI aggregates
- `segment_snapshots` — Daily historical state for timeline

---

## Map & Website

### Public Map (`/map`)

**Design Philosophy:** "The Civic Evidence Desk"
- Desaturated OSM base (CartoDB light_nolabels + light_only_labels)
- Official India boundary overlay (DataMeet composite GeoJSON)
- Red cracked-road pins for pothole evidence
- Saffron reserved for participation/actions
- Warm paper controls over quiet cartography

**Features:**
- Search by place name (no autocomplete)
- Historical timeline dock (day-by-day playback)
- Activity sparkline + change summary
- Road quality overlays (red/amber/green)
- Published contract geometry
- Evidence detail panels with GPS accuracy
- MapLibre GL attribution preserved

**Timeline Implementation:**
- Native range input for scrubbing
- Play/pause/prev/next controls
- One calendar day per second advance
- Fetches daily snapshot state
- Reduced-motion preferences respected

### Website Routes

- `/` — Hero/campaign landing page
- `/map` — Public evidence map (lazy-loaded)
- `/app` — APK download instructions
- `/privacy` — Privacy policy
- `/terms` — Terms of service
- `/delete-account` — Account deletion flow
- `/downloads/BetterRoads.apk` — nginx redirect to latest GitHub Release

### Feedback System

- Requires completed profile (name + email)
- Math CAPTCHA for spam protection
- Silent metadata capture (source, device OS, timezone)
- Integrated in website + mobile app

---

## Administrator Dashboard

### Panels

1. **Overview** — Journey/event counts, 14-day trends
2. **Live** — Recent city activity, journey feed
3. **Journeys** — Paginated operations table with filters
4. **Devices** — Installation inventory
5. **Waitlist** — Signup records
6. **Map Analytics** — OSM map + filters + replay + GeoJSON export
7. **Contracts** — Contractor/contract CRUD, CSV import, publication
8. **Profile & Security** — Password change, session management

### Authentication

- Username + password login
- 24-hour session expiry
- Token stored in localStorage (XSS risk for broader rollout)
- Session revocation capability

---

## AI/Data Engine

### Purpose

Batch intelligence layer that reads retained journeys and writes corrected aggregates (not online inference).

### Commands

- `classify` — Cluster repeated bump/pothole events, reclassify consistent clusters as speed breakers
- `rebuild` — Deterministically rebuild road segments + snapshots from journey_raw
- `run-all` — Classify then rebuild

### Scheduled Execution

Production runs nightly at 02:30 IST via Docker/cron.

### Current Limitations

- RQI still comes from on-device scoring
- No FFT surface analysis yet
- No learned vehicle normalization
- Road identity is ~100m grid, not OSM way ID

---

## Deployment & Operations

### Infrastructure

```
Browser/Mobile
  ↓
Cloudflare Edge + Tunnel (TLS termination)
  ↓
Host port 80 / Dokploy Traefik
  ↓
Docker Swarm services:
  - betterroads-website (nginx + React SPA)
  - betterroads-backend (Node.js API)
  - betterroads-dashboard (nginx + React SPA)
  ↓
PostgreSQL HA cluster
```

### Production Hosts

- `betterroads.org` — Public website + API
- `admin.betterroads.org` — Dashboard + API
- `betterroads.rackops.in` — Alternate admin host

### CI/CD Pipeline

**GitHub Actions** (on push/PR):
1. Install dependencies (pnpm workspace + npm)
2. Build backend, website, dashboard
3. Typecheck mobile app
4. Run backend/mobile/AI tests
5. Build all Docker images

**Dokploy** (on main push):
- Webhook triggers auto-deploy
- Website, backend, dashboard update
- Health checks verify deployment

**Android Releases:**
- Separate manual/tagged workflow
- Requires Docker + signing keystore
- Outputs APK + AAB to `mobile/app/release/`
- Published as GitHub Release asset

### Current Status (from git log)

Recent commits show:
- v1.3.1: Google Sign-In enabled on stable channel
- v1.3.0: Map history and pothole evidence improvements
- Vehicle-separated collection v3 implemented
- Android background recording in progress

---

## Key Product Decisions

### Why No Video?

Controlled collection protocol deliberately uses no camera. Labels come from:
- Pre-surveyed sites (admin research routes)
- Passenger/research operator markers
- Repeat passes
- Independent post-drive review

### Why Device-Linked Entry?

- No Google account requirement
- Works offline-first
- Privacy-preserving (no mandatory email)
- Fast onboarding

### Why India-Only?

- CartoDB + DataMeet GeoJSON ensures mapping law compliance
- Focus on single regulatory environment
- Road conditions addressable at national scale

### Why Manual Start?

- Driver awareness + safety
- Explicit consent per journey
- Prevents silent background tracking
- Battery management transparency

---

## Development Workflow

### Local Setup

```bash
# Clone repo
git clone <repo-url>
cd betterroads-fork

# Install dependencies
pnpm install  # backend + website
cd dashboard && npm install
cd mobile/app && npm install

# Run backend dev
pnpm --filter @betterroads/backend dev

# Run website dev
pnpm --filter website dev

# Run mobile
cd mobile/app && npm start
```

### Docker Compose (simple)

```bash
docker compose up --build
# → http://localhost
```

### Build Android APK

Requires:
- Docker Desktop running
- `mobile/app/signing/betterroads-upload.jks`
- `mobile/app/signing/keystore-password.txt`

```bash
npm run build:apk  # Stable channel
npm run build:apk:test  # Test channel with Google
```

Outputs:
- `mobile/app/release/BetterRoads.apk`
- `mobile/app/release/BetterRoads-v1.3.1.apk`
- `mobile/app/release/BetterRoads-v1.3.1.aab`

---

## Testing Strategy

### Mobile Tests

- `mobile/app/src/**/*.test.ts` — Sensor logic, motion filter
- Run: `npm test` (tsx --test)

### Backend Tests

- `backend/src/**/*.test.ts` — Schema, quality, storage
- Run: `npm test` (tsx --test)

### AI Tests

- `ai/**/*.py` — 81 tests for classify/rebuild
- Run: pytest

### Manual Testing Checklist

Before release:
1. Android physical device (screen-locked 15+ min)
2. Entry → Permission grant/deny → Retry flow
3. Record → Stop → Upload → Offline recovery
4. Profile edit → Leaderboard opt-in
5. Account deletion → Removal from rankings
6. Admin login → Contract publish → Public visibility

---

## Open Work Items

### P0: Launch Blockers

1. ✅ Android background recording implemented (this branch)
2. Test on physical Android devices (screen-off 15+ min)
3. Build and publish v1.4.0 APK
4. Real-device end-to-end validation
5. Seed real journeys for public map demo

### P1: Important Engineering

1. Hashed installation secret (UUID → not resumable alone)
2. Map-match GPS traces to OSM way IDs
3. Mobile history/map/leaderboard screens
4. Database-backed integration tests
5. Shared rate limiting (Redis)
6. OSM tile hosting/caching plan

### P2: Quality & Scale

1. Split large map/dashboard bundles
2. Component-level tests
3. Observability (metrics, alerts, request IDs)
4. iOS testing and release
5. Play Store submission

---

## Documentation

Key docs in `docs/`:
- `ARCHITECTURE_STATUS.md` — Comprehensive tech reference
- `ANDROID_BACKGROUND_RECORDING.md` — Native service implementation
- `CONTROLLED_COLLECTION_PROTOCOL.md` — Research-grade data collection
- `COLLECTION_PRIVACY_RETENTION.md` — Data handling policy
- `VEHICLE_SEPARATED_DATA_COLLECTION_PLAN.md` — v3 protocol design
- `DEPLOYMENT_KB.md` — Production deployment guide
- `api-contracts/collection-v3.md` — API contract spec

Root docs:
- `PRODUCT.md` — Product vision, users, principles
- `DESIGN.md` — Map design system (civic evidence desk)
- `README.md` — Quickstart, features, CI/CD

---

## Product Principles

From `PRODUCT.md`:

1. Turn frustration into a specific action a citizen can take today
2. Demonstrate the phone-to-proof mechanism before explaining it
3. Separate current evidence from future ambition visibly and honestly
4. Make participation feel collective without overstating network scale
5. Treat privacy, safe mounting, and data quality as sources of trust

---

## Design System

From `DESIGN.md`:

**Palette:**
- Civic Ink (#0a0a0a) — Text, controls, badges
- Warm Paper (#fffdf8) — Overlays, controls
- Saffron Action (#e0611c) — Participation, focus
- Evidence Red (#c83231) — Pothole pins
- Condition Amber/Green — Road quality scale

**Typography:**
- Headlines: Bricolage Grotesque (heavy, tight tracking)
- Body: Inter (neutral, legible)

**Components:**
- Gently rounded (0.4–0.75rem)
- Structural shadows only
- Cracked-road pin silhouette preserved
- Saffron focus outlines
- Responsive down to mobile

---

## Key Metrics

From `ARCHITECTURE_STATUS.md` (Aug 2026 snapshot):
- Zero journeys in production (awaiting real data seeding)
- Zero road segments scored
- Zero events detected
- Zero public leaderboard entries

Current app version: **v1.3.1** (Google Sign-In enabled)
Current API release: **device-identity-v2**

---

## Contact & Links

- Production: https://betterroads.org
- Admin: https://admin.betterroads.org
- Map: https://betterroads.org/map
- APK: https://betterroads.org/downloads/BetterRoads.apk

Repository: Private (msr157/betterroads or similar)
License: MIT

---

*This document synthesizes information from: PRODUCT.md, README.md, DESIGN.md, ARCHITECTURE_STATUS.md, ANDROID_BACKGROUND_RECORDING.md, CONTROLLED_COLLECTION_PROTOCOL.md, source code inspection, git history, and active branch status.*
