# BetterRoads Mobile (React Native / Expo)

The production BetterRoads app — records road-quality sensor data while you
ride and uploads one `schemaVersion: 1` payload per completed journey to
`POST /api/user/mobile/traveldata` (contract: `docs/api-contracts/traveldata.md`).

React Native + Expo (SDK 57), TypeScript. One codebase for Android and iOS —
the Kotlin prototype this replaces lives at `mobile/android-prototype/` and
remains the reference for the sensor math.

## Run it

```bash
npm install
npx expo start            # Expo Go on a real phone (sensors need hardware)
# point the app at a local backend:
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000 npx expo start
```

`npm run typecheck` — strict tsc, no emit.

## What's implemented

- **`src/sensorEngine.ts`** — pure TS port of the prototype's SensingService:
  gravity low-pass (α 0.8), mount-stability gate, 500 ms sliding RMS window,
  per-vehicle vibration floors, jolt thresholds (>12 m/s² BUMP, >22 POTHOLE,
  speed-gated), swerve detection, 300 m segment RQI
  (`100 − roughness − events`, floor 10). No Expo imports — replayable/testable.
- **`src/journeyRecorder.ts`** — wires expo-sensors (50 Hz) + expo-location
  (navigation accuracy) into the engine; assembles the upload payload.
- **`src/upload.ts`** — immediate upload with an on-disk offline queue,
  flushed on next launch; idempotent on `journey.id`.
- **`src/deviceId.ts`** — install-time UUID; no accounts, no PII.
- **`App.tsx`** — v1 single screen: vehicle picker → start → live RQI/events →
  end → upload.

## Not yet (deliberate v1 cuts)

- **Background recording** — currently records with the app open (navigation
  style). Needs `expo-location` background updates + Android foreground
  service in a dev build; next milestone.
- Map/history/leaderboard screens (exist in the Kotlin prototype as design
  reference).
- Raw `sensorWindows` in the payload (schema supports it; app sends the
  processed segments/events/path only for now).
