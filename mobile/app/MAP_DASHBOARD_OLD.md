# Open-Source Map Dashboard: Development Specification & Technical Pipeline Guide

> **For Humans & LLM AI Agents**: This document is the strict specification, architectural guide, and bare-minimum contract for building the user-facing road health map dashboard. Any developer or AI working on the mapping frontend **MUST** adhere to the rules, thresholds, API contracts, and spatial query patterns outlined here.

---

## 1. Core Mission & Visual Specification

The user-facing map dashboard visualizes city-wide road health in real time using 100% open-source mapping tech (Leaflet.js + OpenStreetMap).

### Visual Color Thresholds (Strict Rule)
Every road segment geometry returned by the API contains an `rqi` (Road Quality Index) score between `0` and `100`:

| RQI Range | Road Status | Hex Color Code | Map Polyline Styling |
| :--- | :--- | :--- | :--- |
| **$75 \le \text{RQI} \le 100$** | **Great Road** (Smooth highway) | `#22c55e` (Bright Green) | `weight: 5, opacity: 0.8` |
| **$45 \le \text{RQI} < 75$** | **Fair / Bumpy Road** (Moderate wear) | `#eab308` (Amber / Orange) | `weight: 5, opacity: 0.85` |
| **$0 \le \text{RQI} < 45$** | **Severe Bad Road** (Cracks & Potholes) | `#ef4444` (Vibrant Red) | `weight: 6, opacity: 0.9` |

---

## 2. End-to-End Technical Data Pipeline

How does a physical bump under a car wheel turn into a Red line on an OpenStreetMap? Here is the exact 7-step pipeline:

```
[1. Car Hits Pothole] ──> [2. Mobile Sensor Engine] ──> [3. HTTP POST Upload]
                                                              │
[6. Map Color Shift]  <── [5. Bounding Box Query]  <── [4. Grid Quantization & DB]
```

### Step 1: Mobile Hardware Sampling ($50\text{ Hz}$)
- **Accelerometer**: Reads linear motion $X, Y, Z$ in $\text{m/s}^2$.
- **Gyroscope**: Reads rotational yaw ($Z$-axis) in $\text{rad/s}$.
- **GPS**: Records lat, lon, speed ($\text{km/h}$), and heading every 1 second.

### Step 2: Sensor Engine Math & Event Triggering
1. **Gravity Isolation**: A low-pass filter isolates gravity $\mathbf{g}_t = 0.8 \mathbf{g}_{t-1} + 0.2 \mathbf{a}_t$.
2. **Vehicle Baseline Subtraction**: Dynamic vertical force minus baseline vehicle vibration floor ($1.2\text{ m/s}^2$ for sedan, $4.0\text{ m/s}^2$ for motorcycle):
   $$\text{cleanZ} = \max(0, |z_t - g_z| - \text{baselineRMS})$$
3. **Sliding Window RMS (500 ms)**: Smooths acceleration values over a rolling window.
4. **Pothole Detection**: If $\text{cleanZ} > 22\text{ m/s}^2$ at speed $>8\text{ km/h} \to$ Log `POTHOLE` event.
5. **RQI Calculation**: $\text{RQI} = 100 - \text{roughnessPenalty} - \text{eventPenalty}$.

### Step 3: Batch Ingestion API (`POST /user/mobile/traveldata`)
When the user ends their drive, the mobile app sends a single JSON payload to the backend server containing:
- `journey`: ID, vehicle type, total RQI.
- `segments`: Array of 300m GPS segments with localized RQI scores.
- `events`: Array of pothole/bump coordinates and severity spikes.

### Step 4: Spatial Quantization & Database Aggregation
When the server receives the trip:
1. **Grid Keying**: It quantizes the midpoint of each segment to a $0.001^\circ \approx 111\text{m}$ grid cell:
   ```typescript
   segmentKey = `${Math.floor(lat / 0.001) * 0.001}:${Math.floor(lon / 0.001) * 0.001}`;
   ```
2. **Running Average**: It updates the running average RQI for that grid cell using recency weighting ($\alpha = 0.15$):
   $$\text{RQI}_{new} = \text{RQI}_{prev} \times (1 - \alpha) + \text{RQI}_{sample} \times \alpha$$
3. **Daily Snapshot**: Writes a row to `segment_snapshots` for historic timeline playback.

### Step 5: Bounding Box Fetching (`GET /public/roads`)
The web map sends a `GET` request containing its current screen bounds:
```http
GET /public/roads?minLat=19.00&maxLat=19.10&minLon=72.80&maxLon=72.90
```

### Step 6: Map Rendering
The frontend iterates over the returned `segments` array and draws colored `L.polyline()` overlays matching the RQI color rules!

---

## 3. Hosting, Networking, & Connection Technicals

To connect the standalone frontend map dashboard to the backend server in production, follow this hosting architecture:

```
                  ┌─────────────────────────────────────────┐
                  │          DNS / Reverse Proxy            │
                  │             (Nginx / Traefik)           │
                  └────────────────────┬────────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                │                                             │
                v Port 80/443                                 v Port 80/443
┌───────────────────────────────────────┐   ┌───────────────────────────────────┐
│          Frontend Map UI              │   │        Backend API Server         │
│      (Vite + React + Leaflet)         │   │         (Hono + Node.js)          │
│   Docker Container / Static Host      │   │   Docker Container / Node Host    │
└───────────────────────────────────────┘   └───────────────────────────────────┘
```

### Environment Configuration
The frontend must read the API base URL from an environment variable:
```env
# .env.production
VITE_API_BASE_URL=https://api.betterroads.org
```

### Handling CORS (Cross-Origin Resource Sharing)
The Hono backend must allow requests from the map domain:
```typescript
import { cors } from 'hono/cors';

app.use('/public/*', cors({
  origin: ['https://map.betterroads.org', 'http://localhost:5173'],
  allowMethods: ['GET', 'OPTIONS'],
}));
```

---

## 4. Mandatory Rules for Developers & AI Agents

When implementing or modifying the map dashboard, **YOU MUST RESPECT THE FOLLOWING RULES**:

1. **NEVER Fetch All Data at Once**: Always use `map.getBounds()` to include `minLat`, `maxLat`, `minLon`, `maxLon` parameters in `/public/roads` requests. Fetching un-bounded data will crash the browser.
2. **Debounce Map Drag Events**: Wrap map pan/zoom listeners in a `300ms` debounce timer to avoid hammering the backend API with 50 requests per second while a user drags the map.
3. **Handle Empty & Error States**: If a geographic area has zero trips recorded, render a subtle gray dash line (`#9ca3af`) indicating *"Unmapped Road"*.
4. **Interactive Popups**: Clicking any colored road segment MUST open a popup showing:
   - Current RQI Score & Status Label
   - Total sample count (number of trips recorded)
   - Detected pothole count
5. **Mobile Responsiveness**: The map controls and search bar must work smoothly on mobile browser screens (touch events, full screen bounds).

---

## 5. Research & Technology Checklist

Before writing code for the new dashboard, make sure to review and install these packages:

- **Mapping Core**: `leaflet` and `@types/leaflet` (or `react-leaflet` if using React).
- **Map Tile Source**: CartoDB Positron (`https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`) for clean monochrome basemaps.
- **Geocoding Search**: Nominatim OpenStreetMap API (`https://nominatim.openstreetmap.org/search`).
- **Data Caching**: `SWR` or `@tanstack/react-query` to cache spatial tile responses so panning back to a previously loaded neighborhood doesn't re-trigger network requests.
