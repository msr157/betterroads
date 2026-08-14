# BetterRoads — Google Play Submission Guide

Verified against Google Play policy as of **2026-08-05**. App: `org.betterroads.app`,
versionName 1.0.0, versionCode 1, built with Expo SDK 57 / React Native 0.86.

---

## 1. What you upload

Play requires an **App Bundle (.aab)** for new apps — the APK is only for
sideload testing, you cannot upload it to Play.

| Artifact | Use |
|---|---|
| `BetterRoads-v<version>.aab` | Upload this to Play Console |
| `BetterRoads-v<version>.apk` | Direct-download channel: uploaded as a GitHub Release asset named `BetterRoads.apk`; the site links it at `betterroads.org/app` and `betterroads.org/downloads/BetterRoads.apk` 302s to the latest release. Also fine for `adb install` testing |

(`build-release.sh` copies both into `mobile/app/release/` with those names;
the raw Gradle outputs keep their default `app-release.*` names.)

Both are signed with the **upload keystore** at `mobile/app/signing/betterroads-upload.jks`
(password in `mobile/app/signing/keystore-password.txt` — **back both up somewhere safe
outside this machine; they are NOT in git**). On first upload, enroll in
**Play App Signing** (default) — Google holds the real signing key and our JKS is
just the upload key, so it can be reset if ever lost.

## 2. Hard requirements — status

| Requirement | Status |
|---|---|
| Target API level: new apps must target **API 36 (Android 16)** from Aug 31, 2026 | ✅ Expo SDK 57 targets API 36 |
| App Bundle format | ✅ `bundleRelease` output |
| 64-bit native code | ✅ RN 0.86 ships arm64-v8a |
| Privacy policy URL on the store listing **and** in-app reachable | ✅ https://betterroads.org/privacy — updated with a "BetterRoads mobile app" section covering location, motion sensors, install UUID. **Deploy the website before submitting.** |
| Data safety form | Fill using §4 below |
| Account deletion policy | Required: Google sign-in is mandatory. Users can delete the account in Profile; use https://betterroads.org/delete-account as the Play web URL. |
| Background location declaration | N/A — we request foreground `ACCESS_FINE_LOCATION` only, no background location, no foreground service. This avoids Play's hardest review track. |
| Sensitive-permission video declaration | N/A (only needed for background location / SMS / call log) |
| Ads declaration | "No ads" |

## 3. Developer account gotchas (check BEFORE you start)

1. **Organization vs personal account.** Publishing as **Bonbern Think Tank Studio
   Pvt Ltd** requires a Play **organization** account, which requires a
   **D-U-N-S number** (free from Dun & Bradstreet, but can take days–weeks in
   India). Plan for this lead time, or publish from a personal account
   (₹/$25 one-time fee) and transfer the app to the org account later.
2. **New personal accounts must run a closed test** with **at least 12 testers
   continuously for 14 days** before production access is granted.
   Organization accounts are exempt. With an Aug 15 launch target and today
   being Aug 5, a brand-new personal account **cannot reach production by
   Aug 15** — either use an org account or start the closed test immediately
   and treat Aug 15 as the closed-launch date.
3. Identity verification (and developer address shown publicly) applies either way.

## 4. Data safety form — exact answers

**Does your app collect or share any of the required user data types?** → Yes

| Data type | Collected? | Shared? | Purpose | Notes for the form |
|---|---|---|---|---|
| Location → Precise location | Yes | No | App functionality | Collection is optional (only during a journey the user starts). Not ephemeral (stored). |
| Device or other IDs | Yes | No | App functionality | Random install UUID; not the advertising ID. |
| Personal info → Name | Yes | No | Account management, optional public leaderboard | Required display name; public only after explicit opt-in. |
| Personal info → Email address | Yes | No | Account management, security | Immutable verified Google email; never public. |
| Personal info → Other info | Optional | No | Profile management | Optional DOB, gender, and city; never public. |
| App activity → Other user actions | Yes | No | App functionality | Journey recordings: vehicle type, detected road events, road-quality scores. |

- "Shared" in Play's definition means transferred to third parties — we don't.
  Publishing **aggregated, non-identifying** road scores on our public map does
  not count as sharing user data.
- Data encrypted in transit? **Yes** (HTTPS).
- Can users request deletion? **Yes** — in Profile → Delete account and via
  the privacy contact address. Deletion removes profile/session/ownership links;
  anonymized road measurements may be retained as described by the policy.

## 5. Store listing

| Field | Value |
|---|---|
| App name | BetterRoads |
| Short description (≤80 chars) | Map India's road quality as you ride. Every journey scores the road. |
| Category | Maps & Navigation |
| Tags | travel, navigation, civic |
| Content rating questionnaire | Utility app; no UGC shown to users, no ads, no purchases → expect "Everyone" |
| Target audience | 18+ (driving context; avoids Families policy obligations) |
| Contact email | use the privacy/support address from the website |

**Assets** (all generated in `mobile/app/assets/`):
- App icon 512×512: `playstore-icon.png` ✅
- Feature graphic 1024×500: `playstore-feature.png` ✅
- Phone screenshots: **need at least 2** — run the app on a real phone
  (`npx expo start`, or install `app-release.apk`), record one journey, and
  screenshot the home screen + live recording screen. Portrait, ≥1080 px wide.

## 6. Submission runbook

1. Deploy the updated website (privacy policy) — verify
   https://betterroads.org/privacy shows the "BetterRoads mobile app" section.
2. Play Console → Create app → "BetterRoads", App/Free.
3. Complete **App content**: privacy policy URL, ads = No, content rating
   questionnaire, target audience, data safety (§4), government-apps = No,
   account deletion = accounts supported; provide the public deletion URL.
4. Store listing: texts + icon + feature graphic + screenshots (§5).
5. Release → Testing → **Closed testing** → create release → upload
   `app-release.aab` → add tester emails → roll out.
   (Personal account: keep 12+ testers for 14 days, then apply for production.)
6. Production rollout when eligible.

## 7. Known v1 limitations to disclose to testers

- Recording runs with the app **open in the foreground** (navigation-style).
  Background/screen-off recording ships in a later release (needs a foreground
  service + Play's FGS-location declaration — plan that review time).
- iOS build exists in code but is untested; TestFlight later.

## 8. Rebuilding the release

Everything is scripted. From the repository root, with Docker running and
signing files in `mobile/app/signing/`, run:

```bash
npm run build:apk
```

The wrapper validates Docker/signing files, mounts the app and a persistent
Gradle cache, and runs `mobile/app/build-release.sh` in the Android container.

Bump `expo.android.versionCode` (and `version`) in `mobile/app/app.json` for
every new upload — Play rejects a reused versionCode.
