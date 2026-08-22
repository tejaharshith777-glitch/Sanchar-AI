# LIVE.md — Sanchar AI Feature Status

> Last updated: 2026-08-22

## ✅ Live in This Web App Today

| Feature | API Endpoint | Notes |
|---------|-------------|-------|
| **Trip Creation** | `POST /api/trips` | Origin/destination city selector (14 cities + Other), budget, expected arrival, trusted contact name, analytics consent (default OFF) |
| **Live GPS Tracking** | `POST /api/trips/:id/points` | Real `watchPosition`, batched every ~5 points, computes speed/distance/segment in real-time |
| **Segment Detection** | Client-side (rule-based) | Still / Walking / Road Vehicle / Rail — labelled "probable" with confidence %, user can confirm/correct |
| **OCR Ticket Scanner** | `POST /api/trips/:id/expenses` | Tesseract.js (WASM), self-hosted worker + traineddata, works offline after first load, shows raw text + detected amount for confirmation |
| **Expense Management** | `GET/POST/PATCH/DELETE /api/trips/:id/expenses` | Category picker (Transport/Food/Hotel/Other), merchant name, source tag (ocr/manual) |
| **Offline Mutation Queue** | IndexedDB via `idb` | Queues mutations with idempotency keys when offline, auto-flushes on reconnect, status bar shows Syncing/Synced/Offline |
| **City Packs** | `GET /api/city-packs/:city` | Emergency numbers (112), local phrases with contentStatus tags, transport guidance, cached in IndexedDB |
| **Privacy Pipeline** | `POST /api/sync/:tripId` | Drops first/last 500m, ~500m geohash bins, suppresses cells < 3 trips, writes only to MobilityAggregate. Dashboard endpoints NEVER read personal LocationPoints. |
| **Mobility Dashboard** | `GET /api/mobility/summary` | Reads only MobilityAggregate. Shows honest empty state when N=0. Correction line about occupancy data. |
| **Trip Diary** | `GET /api/trips/:id` + expenses | Auto-generated from real stored data (duration, distance, expenses, budget remaining). Web Share API for sharing. |
| **SOS Emergency** | Client-side | `tel:112` dial, Google Maps link with last real GPS point, Web Share with location + emergency phrase |
| **PWA (Service Worker)** | `vite-plugin-pwa` | App shell precached, OCR assets cached for offline use, manifest with icons |
| **Safety Checks** | Client-side + `POST /api/trips/:id/safety-events` | Route-deviation detection (rolling bearing, 30° threshold, 200m displacement, 5-min cooldown), late-arrival check (expectedArrival + 15 min) |

## 📱 Real Android App Implementation (Kotlin + Compose)

The native app code in `android/` implements the offline specifications using native Google Play Services, Room, and CameraX:

| Feature | Android Implementation | Notes |
|---------|------------------------|-------|
| **Foreground Tracking** | `SafeTripService` | System persistent notification with live speed updates. Continues tracking when screen is locked. |
| **Balanced-Power Location**| `FusedLocationProviderClient` | Real GPS + cellular fusion (5s intervals) to preserve battery. |
| **On-Device OCR** | Google ML Kit Text Recognition | Runs locally on captured CameraX bitmap (fully offline). |
| **Room Local Database** | `AppDatabase` | Stores `Trip`, `Expense`, and `LocationPoint` records locally. |
| **Geofence Exit Wake** | `GeofenceBroadcastReceiver` | Circular geofence (200m) around home coordinates auto-starts service on exit. |
| **Alarm departure check** | `AlarmBroadcastReceiver` | RTC exact alarm queries motion state to auto-start or prompt user. |
| **Stillness Arrival** | Google Activity Recognition | Wakes dialog to confirm arrival if stillness sustained for 10 mins. |
| **Trip Diary & Story** | Computed from Room records | Calculates real metrics, generates editable story card, shares via Intent. |

---

## 🎨 Web Design System

- **Typography:** Plus Jakarta Sans (headings, 600–800) + Inter (body, 400–500) via Google Fonts
- **Colors:** Deep teal `#00695C`, saffron `#F59E0B` (SOS/alerts only), safety red `#D32F2F`, success green `#2E7D32`, off-white `#FAFAF7`, charcoal `#1F2937`, slate `#64748B`
- **Layout:** Flowbite-inspired SaaS landing page structure (glass nav, hero with phone mockup, section rhythm 80–96px, card system with hover lift, pill buttons)
- **Icons:** Lucide React

## 🏗️ Stack

- **Client:** React 19 + TypeScript + Vite 8 + Tailwind CSS 4 + PWA (vite-plugin-pwa)
- **Server:** Node.js + Express + TypeScript + Mongoose
- **Database:** MongoDB
- **OCR:** Tesseract.js 7 (WASM, self-hosted, offline-capable)
- **Offline:** IndexedDB via `idb`, Service Worker via Workbox

## 📝 Honesty Rules

- No 100% accuracy claims
- Segment labels always carry "probable / confidence %"
- OCR always requires user confirmation
- City-pack content always shows its contentStatus tag
- Dashboard numbers are either real computed values or visibly labelled "Demo Data"
- No `localhost` in deployed UI — uses editable `SITE_URL` constant
