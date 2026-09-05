# BetterRoads Mobile (React Native / Expo)

The production BetterRoads mobile application — records crowdsourced road-quality sensor data while citizens commute and uploads a validated `schemaVersion: 1` payload per completed journey to `POST /api/user/mobile/traveldata` (API contract: `docs/api-contracts/traveldata.md`).

Built with React Native + Expo (SDK 57), TypeScript, and `@expo/vector-icons`. Single unified codebase for Android, iOS, and Web preview.

---

## 🎨 Design System & Visual Identity

The mobile application shares design DNA directly with the BetterRoads website (`website/src/index.css`), presenting a high-contrast obsidian aesthetic with authentic Indian civic accents.

### 1. Color Palette Tokens (`src/theme.ts`)

| Token | Hex / Value | Role |
| :--- | :--- | :--- |
| `bg` | `#0a0a0a` | Pure obsidian dark canvas |
| `bg2` | `#121211` | Primary card and sheet container background |
| `bg3` | `#1a1a19` | Elevated input fields, metric tiles, and pills |
| `ink` | `#f5f5f4` | High-contrast off-white primary text |
| `ink2` | `#a8a5a0` | Secondary muted body labels and captions |
| `ink3` | `#716e69` | Tertiary placeholders and borders |
| `saffron` | `#ff9933` | Signature saffron accent (dots, badges, indicators) |
| `saffronDeep` | `#e0611c` | Primary interactive CTA color (pill buttons, active focus) |
| `saffronLift` | `#f07f33` | Active hover / pressed highlights |
| `saffronTint` | `#2a1d0e` | Selected chip background tint on dark |
| `saffronGlow` | `rgba(224, 97, 28, 0.35)` | Drop shadow glow for primary actions |
| `flagSaffron` | `#ff9933` | Indian flag top stripe |
| `flagWhite` | `#ffffff` | Indian flag middle stripe |
| `flagGreen` | `#138808` | Indian flag bottom stripe / Good RQI score (75–100) |
| `warn` | `#fab219` | Moderate roughness RQI score (45–74) / mount alert |
| `danger` | `#d03b3b` | Severe pothole RQI score (0–44) / stop button |

---

### 2. The Signature Tricolor Flag Rule (`src/components/FlagRule.tsx`)

A prominent 3-stripe horizontal rule inspired by the Indian National Flag:
- Top stripe: Saffron (`#ff9933`)
- Middle stripe: White (`#ffffff`)
- Bottom stripe: Green (`#138808`)

Used across the top header bar, onboarding banners, and section dividers to unify the civic citizen movement identity.

---

### 3. Typography Hierarchy

- **Wordmark**: `BetterRoads` in weight `900` with letter spacing `-0.8px` (clean capitalised editorial headline).
- **Monumental Headlines**: `Freedom from Potholes.`, `Every ride scores the Road.` with saffron-accented keywords.
- **Tracked Eyebrows**: `fontSize: 11`, `fontWeight: '700'`, `letterSpacing: 1.5`, uppercase (`AUTOMATIC SENSING`, `EDGE AI SENSING`, `SOVEREIGN IDENTITY`).
- **Data & Telemetry**: Monospace / tabular numbers for real-time RQI (0–100), distance in km, and event counters.

---

### 4. Minimal Iconography & UI Elements

- **Vector Icons**: Zero cartoon emojis. Clean vector icons powered by `@expo/vector-icons` (`Ionicons` and `MaterialCommunityIcons`):
  - Car / Sedan: `car-side`
  - Bike / Scooter: `motorbike`
  - Auto Rickshaw: `rickshaw`
  - Bus: `bus-side`
  - Truck: `truck-outline`
  - Other: `car-multiple`
  - Settings, Calendar, Location, Security: `Ionicons`
- **Interactive SVG Circular Next Arrow (`src/components/ArrowNextButton.tsx`)**:
  - Precision 68x68 SVG progress ring with saffron stroke (`#ff9933`), white interior disc, and dark directional glyph.
- **High-Contrast Modal Picker (`src/components/SearchModalPicker.tsx`)**:
  - Dark-themed bottom sheet with real-time fuzzy search across all 36 Indian States/UTs and thousands of cities from the checked-in India-only dataset.

---

### 5. Official Social Channels

Integrated into Onboarding and Journey Dashboard footer:
- **Instagram**: [instagram.com/betterroads_org](https://www.instagram.com/betterroads_org/)
- **X (Twitter)**: [x.com/BetterRoadz](https://x.com/BetterRoadz)
- **LinkedIn**: [linkedin.com/company/betterroads](https://www.linkedin.com/company/betterroads)
- **YouTube**: [youtube.com/@BetterRoadsOrg](https://www.youtube.com/@BetterRoadsOrg)

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run on physical device via Expo Go (sensors require real hardware)
npx expo start

# 3. Run in browser preview
npx expo start --web --port 8081

# 4. Typecheck & Tests
npm run typecheck
npm test
```

---

## 📱 Core Screen Architecture

1. **Splash (`src/components/SplashView.tsx`)**:
   - Clean animated entrance with `BetterRoads` wordmark, tricolor flag rule, and connection status.
2. **Onboarding (`src/components/OnboardingView.tsx`)**:
   - 3-step carousel with 5-second auto-swipe, interactive pagination dots, citizen movement banner with social links, and circular saffron SVG next button.
   - Step 3 triggers location permission to automatically resolve state and city.
3. **Profile Setup (`src/components/ProfileEditor.tsx`)**:
   - Opens immediately after onboarding or via header profile pill.
   - Pre-fills state and city from reverse geocoding.
   - Strictly 3 gender options: `Male`, `Female`, `Prefer not to say`.
   - Date of birth picker with 12+ age constraint.
   - Clear "Skip for now" option for instant testing.
4. **Journey Dashboard (`src/components/JourneyDashboard.tsx`)**:
   - Vehicle selector calibrating sensor vibration floor.
   - Live telemetry HUD (Distance km, Live RQI, Event count, Segment count, Mount stability warning).
   - RQI Road Quality Index explanation modal.
   - Bottom feedback link and official social channels card.
5. **Feedback Modal (`src/components/FeedbackModal.tsx`)**:
   - Dark modal with anti-spam math verification and submission to `/api/public/feedback`.
