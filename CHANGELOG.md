# Changelog

## Unreleased

### Identity and mobile

- Replaced required Google sign-in with device-linked "Enter BetterRoads"
  onboarding. Every contributor receives an immutable public ID and unique,
  editable username; email and Google identity are optional and unique when
  linked later.
- Added stable/test mobile channels: the website build keeps Google disabled,
  while GitHub prereleases retain Google sign-in and account-link testing.
- Added database-backed users, HMAC-hashed revocable sessions, Secure Store
  restoration, validated profile editing, logout, and account deletion.
- Authenticated journey ingestion is transactional and preserves legacy
  anonymous ownership. Only fully accepted contributions enter rankings.
- Fixed offline profile restoration and retained rejected/conflicting queued
  uploads for support inspection.
- Removed the obsolete Kotlin Android prototype after retaining its sensing
  formulas in the Expo sensor engine.

### Public map and administration

- Added opted-in monthly/lifetime contributor rankings and public contribution
  summaries without exposing private profile fields.
- Added published contractor/road-contract APIs, map overlays, road-popup
  accountability details, and full administrator CRUD/quoted CSV import.
- Replaced environment bearer administration with scrypt passwords, database
  sessions, first-account bootstrap, profile/security/preferences, search,
  derived alerts, map filters/layers, route replay, and GeoJSON export.

### Build and deployment

- Added `npm run build:apk`; it validates Docker/signing inputs and creates
  signed versioned APK/AAB artifacts plus `BetterRoads.apk` under
  `mobile/app/release/`.
- Added tag/manual GitHub release automation for stable `BetterRoads.apk` and
  separate `BetterRoads-Test.apk` prerelease artifacts.
- Made website, backend, and dashboard Docker contexts reproducible and expanded
  CI to build/typecheck/test every application and all three production images.
- API startup now fails when migrations or administrator bootstrap fail, and
  CORS supports the dashboard's PUT/DELETE workflows.
