# SANCHAR AI — WINNING MASTER PROMPT (paste to Antigravity)

---

You are a senior full-stack + Android engineer. You work in the repo root of **Sanchar-AI** (`client/` React 19 + Vite 8 + Tailwind PWA · `server/` Express 5 + Mongoose 9 · `android/` Kotlin/Compose). Live: https://sanchar-ai.vercel.app/ · API: https://sanchar-ai.onrender.com.

**FIRST:** read `ERROR_LOG.md` (40 findings, 50+ live tests) and `LIVE.md`. 28 fixes are already merged in this branch — DO NOT regress them. Re-run the full T01–T40 matrix from `ERROR_LOG.md` after every phase; everything must stay green.

## PRIME DIRECTIVE — REAL + LIVE DATA ONLY

1. Zero fake data: no hardcoded stats, mock arrays rendered as real, invented places/fares/ratings/reviews. The repo previously had 4 honesty violations (fake template spots, random heatmap cells, invented offline cloakroom, hardcoded eco km) — all fixed. Never reintroduce anything like them; grep-verify every file you touch.
2. Every number on screen is live (MongoDB API, or computed client-side from real GPS/OCR/expense data) or an honest empty state ("No trips recorded yet — start your first Safe Trip"). Never render "—" placeholder counts.
3. Content provenance tags everywhere: `curated` / `live-generated` / `crowd (N reports)` / `unverified`. Unknown city → "No verified spot list for {city} yet" + General India pack (112 · 139). Never invent.
4. No `localhost` in shipped UI; API base from env (`VITE_API_URL`). Keep design system (Plus Jakarta Sans + Inter, teal `#00695C`, saffron SOS-only, `#FAFAF7`).

## PHASE 0 — REGRESSION GATE (do before anything else)

- `node doctor.js`, `npm run install:all`, boot both servers, re-run T01–T40 + `npm run build/lint/typecheck/test` (client+server). Report the scoreboard. Fix any red before proceeding.

## PHASE 1 — CREDIBILITY (landing + trust)

1. Cut landing ~50%: Hero (ONE identity — "the travel companion that protects you when the network gives up" + single Start Safe Trip CTA + airplane-mode proof widget using the REAL IndexedDB queue in `client/src/store/db.ts`) → live trust strip (real numbers only) → how-offline-works → features → spots → FAQ → footer. Move Marketplace/Hotel/Eco under "Labs".
2. Bind every stat live (`GET /api/mobility/summary`, trips count); honest empty states, zero "—".
3. SEO/social: OG + Twitter card + canonical + `og:image` in `client/index.html`.
4. Mobile-first 360px audit: no h-scroll, ≥44px targets, thumb-reachable CTAs.
5. Fix H8 (dashboard mode double-count) + F30 (`totalLanguages` formula) with tests proving correct counts.

## PHASE 2 — PAY DOWN TECH DEBT (no behavior change, all 21 routes keep working)

6. Split `client/src/App.tsx` (5,667 lines) into lazy feature folders (`features/landing|trips|scanner|diary|safety|offline`, `shared/`) with `React.lazy` + `Suspense`. Kill the 1.2 MB single bundle (F24): route-split + move Tesseract models out of precache into runtime on-demand caching (32 MB precache is unacceptable on 2G).
7. Unify retry policy (F9 remainder): ONE policy — axios interceptor handles idempotent retries only; delete all component wake-retry loops (5× backoff loops in `PlacesAndLuggage`, city-spotlight, dashboard). No request may hang >30s total.
8. Replace 15s health poll + 4-min ping with visibility-aware exponential backoff (F26). Add persistent "temporary storage — data may not persist" banner whenever `db:memory` (F27).
9. Server-side `GET /api/geocode?city=` with Mongo cache (F25) — remove all 3 browser-direct Nominatim calls (policy/ban risk). Add `zod` validation to trips/expenses/reports/signup (S6). Configure `helmet` WITHOUT breaking OSM tiles/self-hosted images (CSP `img-src 'self' data: https://*.tile.openstreetmap.org`) (F18).
10. User-scope trips (S4): auth middleware, `userId` on trips, `GET /api/trips` returns only caller's trips (migration: existing anonymous trips stay readable via explicit id). Add `GET /api/trips/:id/segments` (needed by Eco auto-sync + Trip Proof).
11. Real privacy pipeline (H5): haversine-based first/last 500m strip in `processTripPrivacySync` (not point slicing) + `modeCategory` derived from real segments; add unit tests with synthetic tracks proving endpoints are stripped.
12. Android: `canScheduleExactAlarms()` runtime flow (F21), `targetSdk 35`, remove `tools:targetApi`, justify-or-remove `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, verify `./gradlew assembleDebug` passes with the new adaptive icons. Generate PWA `pwa-192/512.png` + maskable from the shield logo (F16 remainder).

## PHASE 3 — NEVER-EXISTED-BEFORE FEATURES (the win — in this order)

**13. Fare Guardian** — NEW `/fare-guardian` (web, offline-first). Offline auto/taxi estimator: GPS distance × per-city rate card in the city pack. Rate sources (REAL only): (a) official state tariff cards — STARTER DATA RESEARCHED: Maharashtra/Mumbai MMRTA w.e.f. 01/02/2025: auto min ₹26, ₹17.14/km, +25% midnight 12–5am, rounding ±50p (source: transport.maharashtra.gov.in tariff PDF) — encode Mumbai + Nagpur from this; research + encode Chennai/Bengaluru/Delhi/Hyderabad/Kolkata from their transport-dept notifications, each card storing `sourceUrl + effectiveDate`; (b) where no gazette exists: crowd median of `POST /api/fare-reports` showing `median of N reports`. One-tap dispute cards + **pre-generated TTS audio cached offline** (`client/public/audio/{lang}/{phrase}.mp3`, generated at build with the user's TTS key, playable with zero network). Scam reports → Mongo with grid-cell + moderation flag → feed crowd median.
**14. Train Mode** — NEW `/train-mode` (web, offline-first). Offline station alarm: pick route/station → GPS geofence → loud alarm + vibration before arrival; MUST work airplane-mode + GPS on. Station data (REAL, no key needed): OSM Overpass `node(bbox)[railway=station]` per city cached into packs at seed time + `datameet/railways` (~8,900 Indian station coords, GitHub) + Wikidata WikiProject Indian Railways codes; store `name/code/lat/lng/source`. No invented stations/timings/platforms.
**15. SOS Mesh** — Android headline ("SOS with ₹0 data balance"). Google **Nearby Connections API works fully offline** (Bluetooth/WiFi, no internet — verified) — implement: encrypted SOS broadcast → nearby Sanchar devices store-and-forward when THEY regain connectivity + SMS fallback to trusted contact. Add `BLUETOOTH_*`, `SEND_SMS`, `ACCESS_FINE_LOCATION` flows; document protocol in `android/SOS-MESH.md` (payload schema, dedup by id, hop limit, relay ack). Web: harden SOS sheet (tel:112 + maps link from LAST REAL fix + Web Share) — live position only, never cached-as-live.
**16. Offline Trip Proof** — extend Diary: hash-chained GPS log (each point hashes previous — tamper-evident), journey certificate + reimbursement PDF generated client-side from REAL trip data only. Eco page: auto-fill per-mode km from `GET /trips/:id/segments` when a trip is active (keep manual inputs as fallback).
**17. Remove AI fare fallback** (H6): delete `'Auto ₹30-50/km'` default; AI uses city rate card or says "confirm locally". Align `/crowd-radar` naming with planner content or back it with real `issue-reports` data (H7).

## 🔑 KEYS THE USER WILL PROVIDE (wire them, never hardcode)

- `MONGODB_URI` (Atlas free tier — persistence; without it the app runs honest-but-temporary memory mode)
- `AI_API_KEY` + `AI_MODEL` (Gemini free tier — online AI; offline KB already works without it)
- `JWT_SECRET` (any long random string — fails fast in prod if missing)
- TTS key for build-time phrase audio: Google Cloud TTS (free tier) preferred; fallback: Microsoft Edge `edge-tts` (free, no key) — implement provider switch in `scripts/generate_phrase_audio.*`
- NO key needed (already researched, just implement): Wikipedia/Wikidata, OSM Overpass, Nominatim (server-side), datameet/railways, state tariff PDFs
- Put placeholders + instructions in `.env.example`; validate at boot with clear errors.

## DEFINITION OF DONE

- T01–T40 all green + new tests for Fare/ Train/ Mesh/ Proof/ privacy-strip/ geocode-cache/ trip-scoping; `build+lint+typecheck+test` pass client+server; `./gradlew assembleDebug` passes.
- Full offline loop on a REAL phone: airplane ON → create trip → walk (GPS moves) → scan real ticket → queue → airplane OFF → Synced, no dupes. Record it — this video is the stage demo.
- No hardcoded user-facing numbers (grep evidence per phase); Lighthouse mobile Perf ≥80; 360px clean; update `LIVE.md` (feature × data-source table) + `ERROR_LOG.md` (mark H5–H8/S4/S6/F9/F16/F18/F21/F23–F30 fixed with proof).
- Work phase by phase, in order. After each: changed files, verification with REAL data, remaining. If any real source is blocked → STOP and report. Never substitute mocks.

*End — this prompt + ERROR_LOG.md + LIVE.md are the complete build contract. Judges' line: "the travel companion that protects you when the network gives up."*
