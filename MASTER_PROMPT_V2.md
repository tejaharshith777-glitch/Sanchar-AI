# Sanchar AI — MASTER PROMPT v2.0 (Updated)
### Complete Rebuild Specification — audited against the LIVE site on 2026-09-10

> Copy-paste this entire prompt to any coding AI to rebuild the Sanchar AI website 1:1.
> **v2.0 changes vs v1.0:** 16 routes → **22 routes**; 7 new pages documented
> (Fare Guardian, Train Mode, Partners, Hotel Partner, Marketplace, Crowd Radar, Eco Rewards);
> 2 new models (`PartnerPublish`, `IssueReport`); split-deploy architecture
> (Vercel frontend + Render API); verified-tariff dataset; keepalive cron; and **9 live-site
> bug fixes baked in** (see §10). Live proof: `GET /api/site-stats` →
> `{"tripsRecorded":5,"cityPacksLive":9,"languagesSupported":6,"safetyChecks":0}`.

---

## 0. ONE-SENTENCE BRIEF
Build **Sanchar AI** — a **MERN + PWA + Offline-First showcase website** that proves how a tourist can travel
**safely, even offline** across **any city in India** with one companion for **safety tracking + language +
tickets/budget + memory diary**, PLUS tourism-economy tools (**fare protection, train alarms, partner publishing,
hotel suite, artisan marketplace, crowd planner, green rewards**) — honest real data, zero fakes, privacy-first,
and a working Android companion app scaffold.

Tagline: **"Travel confidently, even offline."**

---

## 1. TECH STACK — EXACT

### Client (`/client`) — unchanged from v1.0
- **React 19.2.8 + TypeScript 6 + Vite 8.2.0 + @vitejs/plugin-react 6.0.4**
- **React Router DOM 7.18.2** — `BrowserRouter` with **22 routes** (see §3)
- **Tailwind CSS 4.3.3 + @tailwindcss/postcss 4.3.3 + PostCSS 8.5.26 + Autoprefixer 10.5.4**
- **Recharts 3.10.1** — Pie/Bar/Area charts · **Leaflet 1.9.4 + react-leaflet 5.0.0 + @types/leaflet 1.9.22**
- **Zustand 5.0.15** (installed, minimal use) · **Axios 1.19.0** with `axios.defaults.baseURL = API_BASE`
  (`client/src/config.ts`: `VITE_API_URL || (DEV ? '' : 'https://sanchar-ai.onrender.com')`)
  + response interceptor: 3 retries (5s/10s/20s) on network/5xx, skips `/api/health` and `skipRetry`.
- **idb 8.0.3** (`sanchar-ai-db` v3) · **Tesseract.js 7.0.0** self-hosted at `/public/ocr/`
- **vite-plugin-pwa 1.3.0 + workbox-window 7.4.1**, `maximumFileSizeToCacheInBytes: 15MB`
- **lucide-react 1.33.0** · **Oxlint 1.75.0** · `tsc -b` build · dev server `host: 0.0.0.0`, `/api` proxy → `3000`

### Server (`/server`) — unchanged from v1.0
- **Node.js + Express 5.2.1 + TypeScript 7.0.2 + ts-node-dev 2.0.0** · **Mongoose 9.9.3**
  (`bufferCommands:false` + in-memory fallback) · **Helmet 8.3.0, CORS 2.8.6, express-rate-limit 8.6.2,
  dotenv 17.4.2, bcryptjs 3.0.3, jsonwebtoken 9.0.3, zod 4.4.3, ngeohash 0.6.4**

### Database — 2 new collections
`Trip, LocationPoint, JourneySegment, Expense, CityPack, CitySpot, LuggageSpot, LuggageCheckIn,
SafetyEvent, MobilityAggregate, PilotSignup, IdempotencyKey, User` (v1.0) **+ `PartnerPublish` +
`IssueReport`** (see §7).

### Deploy split (NEW — v1.0 omitted this)
- **Frontend:** Vercel, static SPA. `client/vercel.json` rewrites everything EXCEPT `/api/*` to `/index.html`.
  Direct `/api/*` on the Vercel domain 404s — by design; the browser calls Render via axios `baseURL`.
- **Backend:** Render (`https://sanchar-ai.onrender.com`). Free-tier cold starts handled by:
  client backoff retries (0/5/10/20/30s), "waking up" UI states, and `.github/workflows/keepalive.yml`
  cron (`*/5 * * * *` → `GET /api/health`).
- **Env:** `PORT, CLIENT_ORIGIN, MONGODB_URI (blank ⇒ memory), AI_API_KEY (Gemini), AI_MODEL=gemini-2.0-flash,
  JWT_SECRET` + client `VITE_API_URL` (optional override).

### New shared data files (v2.0)
- `client/src/data/indianCities.ts` — `LAUNCH_CITIES` (8) + `INDIAN_CITIES` (~1000 entries, single source
  for selects/autocomplete; UI copy says "145+ Indian cities" — conservative, keep).
- `client/src/data/verifiedTariffs.ts` — `VERIFIED_TARIFFS` + `calculateVerifiedFare(city, vehicle, km, night)`.
  Mumbai figures are VERIFIED against the real MMRTA notification w.e.f 01/09/2026
  (auto ₹27/1.5km + ₹18.22/km; taxi ₹33 + ₹21.90/km; night +25% 12AM–5AM). Chennai: TN Gazette Chart 2023
  (auto ₹25/1.8km + ₹12/km, night +50%). Non-official cities use `isOfficial:false` → "Crowd Estimate".
- `client/src/store/tripProof.ts` — airplane-mode outbox demo helpers. `client/src/components/CityAutocomplete.tsx`.
- `LIVE.md` — public feature-status ledger. `doctor.js` — local diagnostics (ports 5173/3000 + trip API smoke test).

---

## 2. DESIGN SYSTEM — unchanged from v1.0
Keep ALL v1.0 tokens, primitives (`.card/.card-retreat/.btn-primary/.btn-secondary/.btn-danger/.input-field/
.badge/.trust-badge/.glass-nav/.section-rhythm`), animations, reveal system, hero letter stagger,
reduced-motion support, nav/hero/map layouts. New pages MUST reuse these tokens
(teal `#00695C`, saffron `#F59E0B`, red `#D32F2F`, cream `#FAFAF7`/`#FAF7F2`).

---

## 3. GLOBAL APP BEHAVIOR + ROUTING (22 routes)

HealthContext, GPS hook, offline-queue flush, warm-up ping, VaultGuard, IntroLoader, AppShell,
ConnectivityHeaderChip — all exactly per v1.0 §3.

```
"/"                         → LandingPage
"/city/:cityName"           → CitySpotlightPage (+ partner section + fare guidance — see §4.2)
"/create"                   → <AppShell><CreateTrip/>
"/active/:id"               → <AppShell><ActiveTrip/>
"/scan/:id"                 → <AppShell><CameraScanner/>
"/expenses/:id"             → <AppShell><ExpensesList/>
"/diary/:id"                → <AppShell><VaultGuard><Diary/>
"/gallery/:id"              → <AppShell><VaultGuard><TripGallery/>
"/privacy"                  → <AppShell><PrivacyPage/>
"/history"                  → <AppShell><VaultGuard><HistoryPage/>
"/features"                 → <AppShell><FeaturesPage/>
"/faq"                      → <AppShell><FaqPage/>
"/dashboard"                → <AppShell><Dashboard/>              (partner analytics — see §4.13)
"/maps"                     → <AppShell><MapsPage/>
"/spot/:cityName/:slug"     → <AppShell><PlaceDetailPage/>
"/luggage"                  → <AppShell><LuggageRadarPage/>
"/fare-guardian"            → <AppShell><Suspense><FareGuardianPage/>      (NEW §4.17)
"/train-mode"               → <AppShell><Suspense><TrainModePage/>        (NEW §4.18)
"/partners"                 → <AppShell><PartnersPage/>                   (NEW §4.19)
"/hotel-partner"            → <AppShell><HotelPartnerPage/>               (NEW §4.20)
"/marketplace"              → <AppShell><MarketplacePage/>                (NEW §4.21)
"/crowd-radar"              → <AppShell><CrowdRadarPage/>                 (NEW §4.22)
"/green-credits"            → <AppShell><EcoRewardsPage/>                 (NEW §4.23)
"*"                         → NotFound
```
New lazy routes use `React.Suspense` with a centered teal `Loader2` fallback (fare-guardian, train-mode).

---

## 4. PAGES

### 4.1 LandingPage (`/`) — v1.0 §4.1 + these v2.0 deltas
- **AirplaneModeProofWidget** in hero: "Network: Online/Offline" chip + "Queue Offline" test button writing a
  real IndexedDB outbox row; shows `IndexedDB Outbox Queue: N items` + status `Saved on device → Syncing → Synced`.
- **Direct Local Economy** section (after Special Spots): 2 cards → `/hotel-partner`, `/marketplace`.
- **AI mock bubble** quotes the REAL Chennai gazette line (₹25 base/1.8km + ₹12/km, +50% night).
- **DiarySlide (FIXED):** receives `lastCompletedTrip` from context — if a server completed trip exists it renders
  the real route + "Open History Vault", never contradicting the last-trip banner. localStorage notes stay as
  "Latest Story Entry". Empty state only when BOTH are absent.
- Stats sections share ONE `stats` state from `/api/site-stats`; below-fold `AnimatedCounter`s animate on
  IntersectionObserver (threshold 0.1) — this is by design, not a bug.

### 4.2 CitySpotlightPage — v1.0 + (a) "N local issues reported" line from `GET /api/mobility/issues?city=`,
(b) **"From local partners in {city}"** section (`GET /api/partner-publish?city=`) with honest empty state and
"Publish as Partner →" link, each card badged "Partner published · check locally",
(c) **Transport Fare Guidance** block using `calculateVerifiedFare` (official vs crowd-estimate badges,
"Report a large difference" → issue report). Live proof: Chennai = 25 curated spots.

### 4.3–4.12 — unchanged from v1.0 (CreateTrip, ActiveTrip, CameraScanner, ExpensesList, Diary, TripGallery,
PrivacyPage+VoiceDiary, HistoryPage, FeaturesPage, FaqPage).

### 4.13 Dashboard (`/dashboard`) — v1.0 + partner analytics + FIXES
- Header: "Mobility & Partner Dashboard" + live subtitle "computed from N consented trips recorded in this deployment".
- **City filter** row (All Cities + 14) → `GET /api/mobility/summary?city=`.
- Stat cards use the UNIFIED helpers (§6): Safety = `getSafetyChecksCount()`, Languages = `getLanguagesSupported()`
  — identical values to the homepage, same labels.
- 14-day chart carries caption `"Showing trips in the last 14 days (X of Y total)."` (FIXED — window math was
  correct, label was missing). All-zero charts keep the honest "No consented trips yet…" empty state.
- Mode-share buckets MUST sum to `totalTrips` (FIXED double-count — see §10).
- GIS heatmap: honest note when zero cells pass the ≥3-trip suppression threshold.

### 4.14 MapsPage · 4.15 PlaceDetailPage · 4.16 LuggageRadarPage — unchanged from v1.0.

### 4.17 FareGuardianPage (`/fare-guardian`) — NEW
Anti-overcharge guardian: city select + vehicle toggle (🛺 Auto / 🚕 Cab) + distance slider (1–50km) +
night-surcharge toggle → `calculateVerifiedFare` → fare-range card with badge
**"As per published gazette — verify on meter card"** (official) or **"Crowd Estimate"** (unofficial) +
`officialCitation` + notes. **Phrase cards** in 7 languages (Hindi/Tamil/Telugu/Kannada/Bengali/Marathi/Gujarati),
3 dispute lines each ("run the meter", "higher than rate card", "let's talk at police booth").
**Report form** (amount, from, to) → `POST /api/issue-reports {category:'overcharging'}`.

### 4.18 TrainModePage (`/train-mode`) — NEW
Station geofence alarm: 12 coded stations (MAS/NDLS/CSMT/HWH/SBC/HYB/BSB/JP/ERS/GHY/ADI/UAM) with search,
radius picker (1/3/5 km + walk-ETA hints), "Arm Station Geofence Alarm" (GPS `watchPosition` distance check,
vibration + audio when inside radius) + "Test Alarm Sound & Vibration (Demo)" button.
Copy rule (FIXED): "works in airplane mode using GPS radio — no network needed. Background alarms need the Android app."
(no "100%" claim). 139 helpline card (`tel:139`) + offline TTE/night-safety/RPF guidance cards.

### 4.19 PartnersPage (`/partners`) — NEW
"SIH Tourism Industry Solution": role picker (Travel Agency / Hotel / Local Business) + target-city input →
conditional publish form (place guide: name/publisher/category/area/timings/cost/description;
hotel: arrival profile variant) → `POST /api/partner-publish` → "Published successfully with partner label."
Below: "Published Partner Content for {city}" list with "View on City Page →",
"Partner published · check locally" badges, and `DELETE /api/partner-publish/:id` for owners.
Standing server-side purge of QA/test docs (see §10 FIX 1).

### 4.20 HotelPartnerPage (`/hotel-partner`) — NEW
Small-hotel suite: reservation mini-table (seeded rows visibly tagged **Demo Data**, `?demo=1` gate),
occupancy mini-chart ("Illustrative scenario — Demo Data"), 100% Offline Phrasebook guest cards,
rate-guidance planner, "List property" form → partner-publish (type hotel). Zero-commission copy throughout.

### 4.21 MarketplacePage (`/marketplace`) — NEW
Zero-commission artisan market: city + category filters (Handlooms & Crafts / Local Guides /
Street Food Trails / Eco-Tours); cards with image + `onError` SVG fallback ("Local Vendor"),
price line, area, blurb, "Published by vendor · check locally" + "Connect Direct" (`tel:` link).
Seeded cards badged **"Sample listing (Demo Data)"**. "List Your Business for Free" form
(city/name/category/area/phone/story). Image paths MUST all resolve (FIXED: Kanchi card uses
`/images/spots/kapaleeshwarar-temple.jpg`).

### 4.22 CrowdRadarPage (`/crowd-radar`) — NEW
"Smart Visit & Quiet Window Planner" for 6 cities: honest banner
**"Typical patterns from verified local knowledge — not live counts or artificial wait times."**
Leaflet window map (🟢 quiet / 🟡 busy / 🔴 peak markers) + landmark picker + "Quieter Alternative Engine"
+ "Re-route My Day" plan steps badged "Suggested plan — check locally". NEVER invents wait times or footfall numbers.

### 4.23 EcoRewardsPage (`/green-credits`) — NEW
Green-credits explainer: walk/cycle/transit actions earn credits; honest "pilot concept" framing,
no fake balances, no invented CO₂ numbers — formula shown, values computed from the user's own logged modes only.

### 4.24 Shared components — v1.0 §4.17 + `CityAutocomplete` (keyboard-navigable city search over `INDIAN_CITIES`).
Chatbot offline KB fare answers MUST cite `VERIFIED_TARIFFS` citations.

---

## 5. OFFLINE / PWA / SYNC — unchanged from v1.0
(idb `sanchar-ai-db` v3 stores, outbox flush with idempotency keys, Workbox runtime caching,
15MB cap, manifest.) ADD: airplane-mode widget (§4.1) is the canonical offline demo for judges.

---

## 6. BACKEND API — v1.0 §6 + new endpoints + unified helpers + consent hardening

**Shared helpers (NEW — fixes cross-page mismatches):**
- `getSafetyChecksCount()` = `SafetyEvent.count + IssueReport.count` (memory + Atlas). Used by BOTH
  `/api/site-stats` and `/api/mobility/summary`. Label everywhere: "Safety & issue reports".
- `getLanguagesSupported()` = distinct `localLang` across `CityPack.phrases`, fallback `6`. Used by BOTH endpoints.

**Consent hardening (FIXED):** `/api/mobility/summary` trip filter MUST be explicit opt-in:
Atlas `{ $or: [{ analyticsConsent: true }, { analyticsConsented: true }] }`;
memory `t.analyticsConsent === true || t.analyticsConsented === true`.
(`$ne:false` wrongly matches docs missing the field — forbidden.)

**Mode-share rule (FIXED):** each trip counts in EXACTLY ONE bucket (Rail/Road/Still/Walking-default);
bucket sum MUST equal `totalTrips`. The Walking increment lives in the final `else` only.

**New endpoints:**
- `GET /api/partner-publish?city=` → `{city, items[], count}` (standing QA purge filter +
  `deleteMany` for `_id` in known QA ids OR `title: /test/i`).
- `POST /api/partner-publish {role,city,type,name,category,area,hours,cost,description,…}` → 201 item.
- `DELETE /api/partner-publish/:id` → `{success:true}`.
- `GET /api/mobility/issues?city=` → 5-bucket aggregate (Language/Signage/Overcharging/Connectivity/Transport)
  from SafetyEvent + IssueReport. `POST /api/issue-reports {category,city,details,amount,…}` → 201.

All other endpoints identical to v1.0 §6. Dashboard still NEVER reads `LocationPoint`.

---

## 7. DATA MODELS — v1.0 + 2 new
- **PartnerPublish** `_id String, role enum travel_agency|hotel|local_business!, city!, type place_guide|hotel!,
  name!, category?, area?, hours?, cost?, description?, photo?, publisherName?, contact?, publishedAt now`
- **IssueReport** `_id String, category enum language|signage|overcharging|connectivity|transport!,
  city?, details?, amount?, from?, to?, tripId?, createdAt now`
- `memoryStore` gains `partnerPublishes[], issueReports[]`. All v1.0 schemas unchanged.

---

## 8. BUILD & DEPLOYMENT — v1.0 + split-deploy runbook
- `npm run install:all` → `cp .env.example .env` → `npm run seed` → `npm run dev` (5173 + 3000).
- **Deploy order (MANDATORY):** push branch → Render auto-deploys API → verify
  `GET /api/health`, `/api/site-stats`, `/api/partner-publish?city=Chennai` →
  then Vercel deploys client → verify homepage stats match API JSON exactly.
- Keepalive cron keeps Render warm. `node doctor.js` for local diagnostics.
- **HONESTY RULES (unchanged + extended):** no fake ratings/counts; segment labels carry confidence;
  OCR requires Confirm; packs show contentStatus; dashboard real-or-empty; no localhost in UI;
  sample rows badged "Demo Data"; partner/vendor rows badged "Partner published · check locally";
  tariffs badged official-vs-estimate with citations; crowd page never invents counts; no "100%" claims
  (use the airplane-mode wording in §4.18).

---

## 9. MASTER INSTRUCTION FOR AI REBUILD
> **SYSTEM:** Senior full-stack engineer. Rebuild the ENTIRE Sanchar AI site per this v2.0 spec —
> 22 routes, all components, CSS tokens, animations, API endpoints, DB schemas, offline rules, copy.
> Tech versions EXACT per §1. `App.tsx` monolith (~5900 LOC) acceptable; `PlacesAndLuggage.tsx` (~1000 LOC),
> `SancharChatbot.tsx` (~500 LOC), `db.ts` (~350 LOC), `api.ts` (~1900 LOC), `models` (~400 LOC).
> MUST pass `npm run build`, MUST satisfy the §10 checklist, MUST keep the privacy pipeline
> (dashboard never reads LocationPoints; analytics only explicit-consent trips).
> Output the full file tree when done.

---

## 10. BAKED-IN FIXES (all verified against live, 2026-09-10)
1. QA partner docs purged + redeploy runbook (§8) — no test content on live pages.
2. Mode-share counts each trip once; buckets sum to totalTrips.
3. `getSafetyChecksCount()` shared by site-stats + mobility/summary; one label.
4. `getLanguagesSupported()` shared by both endpoints.
5. 14-day chart carries "X of Y total" caption.
6. DiarySlide honors server `lastCompletedTrip`.
7. Marketplace Kanchi image path corrected.
8. Explicit `=== true` consent filter (Atlas + memory).
9. "100% offline" → airplane-mode wording; "Gazette Tariff Verified" → "As per published gazette — verify on meter card"
   (Mumbai Sept-2026 figures verified REAL — never alter the numbers).

*End of Master Prompt — Version 2.0 • 2026-09-10 • Audited live: sanchar-ai.vercel.app + sanchar-ai.onrender.com*
