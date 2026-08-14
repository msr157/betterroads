# BetterRoads Mobile (React Native / Expo)

The production BetterRoads app — records road-quality sensor data while you
ride and uploads one `schemaVersion: 1` payload per completed journey to
`POST /api/user/mobile/traveldata` (contract: `docs/api-contracts/traveldata.md`).

React Native + Expo (SDK 57), TypeScript. One codebase for Android and iOS —
The production sensor formulas are maintained in `src/sensorEngine.ts`.

## Run it

```bash
npm install
npx expo start            # Expo Go on a real phone (sensors need hardware)
# point the app at a local backend:
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000 npx expo start
```

Google authentication is disabled in the stable release and retained in the
test channel for account-linking verification. Test builds require
`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` and
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. Configure Google Cloud for Android package
`org.betterroads.app` with the release/debug SHA-1 certificates. The Expo deep
link redirect is `betterroads://oauth`. Bearer credentials are encrypted by
Expo Secure Store; queued offline journeys upload only after session restore.
Expo Auth Session uses these OAuth client IDs directly; Firebase and
`google-services.json` are not required for this sign-in flow. Copy
`.env.example` to `.env` for local/release configuration.

`npm run typecheck` — strict tsc, no emit.

## Signed release

Place `betterroads-upload.jks` and `keystore-password.txt` under
`mobile/app/signing/` (or set `BETTERROADS_SIGNING_DIR`), start Docker, and run
`npm run build:apk` at the repository root for the website/stable build, or
`npm run build:apk:test` for the GitHub prerelease test build. Outputs are
`mobile/app/release/BetterRoads-v<version>.apk`, `.aab`, and the stable
`BetterRoads.apk` filename used for GitHub Releases.

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
- **`src/deviceId.ts`** — install-time UUID linked to the authenticated account
  only when a journey is uploaded.
- **`src/auth.ts`** — device-linked entry, optional Google exchange/linking,
  encrypted session/profile cache, offline restoration, profile management,
  logout, and account deletion.
- **`App.tsx`** — contributor entry and profile editor around the preserved
  journey screen: vehicle picker → start → live RQI/events → end → upload.

## Not yet (deliberate v1 cuts)

- **Background recording** — currently records with the app open (navigation
  style). Needs `expo-location` background updates + Android foreground
  service in a dev build; next milestone.
- In-app map/history/leaderboard screens; these are available on the website.
- Raw `sensorWindows` in the payload (schema supports it; app sends the
  processed segments/events/path only for now).
