# 🇮🇳 SANCHAR AI — PRO PROMPT (Tourism-Aligned, paste to Antigravity)

---

You are a senior full-stack engineer building a hackathon-winning product. Work in the repo root of **Sanchar-AI** (`client/` React 19 + Vite 8 + Tailwind PWA · `server/` Express 5 + Mongoose 9 · `android/` Kotlin/Compose). Live: https://sanchar-ai.vercel.app/ · API: https://sanchar-ai.onrender.com.

**FIRST:** read `ERROR_LOG.md` (40 findings, 28 already fixed in this branch — do NOT regress; re-run matrix T01–T40 after every phase) and `LIVE.md` (feature × data-source contract — keep it updated).

## 0. PROBLEM STATEMENT — Boost Tourism & Travel in India

Millions avoid or cut short trips across India because of five trust gaps: **(1)** tourists get scammed on fares and can't prove it; **(2)** language barriers strand them outside metros; **(3)** safety anxiety (solo/women/night travel) with SOS tools that die without internet; **(4)** remote destinations (Himalayas, Northeast, islands, ghats, pilgrimage circuits) have no network, so Maps/Translate/UPI-assist all fail exactly where tourists need them; **(5)** tourism revenue leaks to middlemen instead of local hosts, artisans and guides. Sanchar AI closes all five with ONE offline-first companion. Every feature below must map to a tourism outcome (trust, safety, access, local economy, or tourism-board intelligence) — state the mapping in your final summary.

## 1. PRIME DIRECTIVE — REAL + LIVE DATA ONLY (non-negotiable, judges check this)

- Zero fake data: no hardcoded stats, no mock arrays rendered as real, no invented places/fares/timings/ratings/reviews. `grep`-verify every file you touch.
- Every number is live (MongoDB API or computed from real GPS/OCR/expense data) or an honest empty state. Never render "—" placeholders.
- Provenance tags on all content: `curated` / `live-generated` / `crowd (N reports)` / `unverified`. Unknown city → "No verified spot list for {city} yet" + General India pack (112 · 139).
- No `localhost` in shipped UI; API base from env. Keep design system (Plus Jakarta Sans + Inter, teal `#00695C`, saffron SOS-only, `#FAFAF7`).

## 2. SCOPE (acceptance criteria are binding)

### 2.1 SEO & Metadata — `[MODIFY] client/index.html`
- Add `og:title/description/image/url/type`, `twitter:card/title/description/image`, canonical `https://sanchar-ai.vercel.app/`, `theme-color #00695C`. Generate `og:image` (1200×630) from existing brand assets into `client/public/`. Verify with a head-tag dump + social-card validator rules (absolute URLs, image <5 MB).

### 2.2 Hero + Navigation — `[MODIFY] client/src/App.tsx`
- Router: add lazy routes `/fare-guardian` and `/train-mode` (keep all 21 existing routes working).
- Hero title → **"The travel companion that protects you when the network gives up."** Sub-line must name tourist outcomes: safe trips, scam-proof fares, offline language, zero-network SOS.
- **Airplane-Mode Offline Proof Widget** (hero, above fold): a toggle that simulates offline, writes a REAL test expense/note into the IndexedDB outbox via `client/src/store/db.ts` (`queueOfflineMutation` + `getOfflineQueue`), then "reconnects" and flushes through the REAL sync path, showing `Saved on Device (IndexedDB Outbox) → Syncing → Synced ✓`. No fake animations — drive it with the actual queue code and show the live queue depth.
- Nav: surface Fare Guardian + Train Mode in `InnerNav`, `MobileBottomNav`, and the mobile drawer with lucide icons.

### 2.3 Fare Guardian — `[NEW] client/src/pages/FareGuardianPage.tsx` + rate-card data
- **Tariff calculator** (Auto/Taxi/E-Rickshaw, day/night, minimum + per-km + distance slider + GPS-measured distance option): encode ONLY verified tariffs, each with `sourceUrl + effectiveDate` — STARTER (already researched): Mumbai/MMRTA w.e.f. 01/02/2025, auto min ₹26, ₹17.14/km, +25% midnight 12–5am (transport.maharashtra.gov.in tariff PDF). Research + encode Chennai, Bengaluru, Delhi, Hyderabad, Kolkata from official transport-dept notifications. Cities without a gazette show NO rate — only crowd median (below).
- **Dispute phrase cards** (Hindi, Tamil, Telugu, Kannada, Bengali, Marathi, Gujarati): calm, polite, pre-translated anti-overcharge phrases with pronunciation; structure ready for pre-generated TTS audio (`/audio/{lang}/{id}.mp3`, offline-cached) when the TTS key arrives.
- **Overcharge reporter**: `POST /api/fare-reports {city, vehicleType, distanceKm, farePaid, fareExpected, from, to}` → Mongo (grid-cell + timestamp + moderation flag `pending`); calculator shows live `crowd median of N reports` with N visible; N=0 → "No reports yet — be the first." Reuse `issue-reports` category `overcharging` only if you extend its schema — do not silently overload it.

### 2.4 Train Mode — `[NEW] client/src/pages/TrainModePage.tsx`
- **Offline station alarm**: search target station → pick geofence radius (1/3/5 km) → `watchPosition` tracks live distance/ETA → loud alarm + vibration on approach. MUST work in airplane mode with GPS on (document the behavior + handle `timeout/maximumAge` for tunnels).
- **Station directory**: REAL data only — seed from OSM Overpass (`railway=station` per city, cached at seed time) + `datameet/railways` open coords; each station stores `name/code/lat/lng/source`. Zero invented stations/timings/platforms.
- Offline rail safety card: 139 helpline, coach-position tips, "show the TTE" offline card. Station data cached in the city pack for true offline use.

### 2.5 Trip Proof & Journey Certificate — `[NEW] client/src/store/tripProof.ts` + Diary integration
- SHA-256 **hash-chained** log: each GPS point + expense hashes the previous record (tamper-evident; verify function recomputes + reports OK/BROKEN + first-broken index).
- Diary shows verification code (first 12 hex chars + record count) and exports a client-side **Journey & Expense Certificate** (printable view/PDF) from REAL trip data only: route, distance, duration, expense table, hash — for corporate reimbursement and family safety proof. (Correct placement: proof util + Diary, NOT the spots/luggage file.)

## 3. CONSTRAINTS

- Cross-platform commands only (`npm run …`, never `cmd /c`). Commit per workstream; push to the **deployment branch** and verify Vercel (client) + Render (server) builds go green — never push broken code to deploy.
- Mobile-first 360px: no h-scroll, ≥44px targets. No new UI framework (Tailwind only). Preserve honest microcopy tone.
- Performance: no new render-blocking weight on first paint; new routes lazy-loaded.

## 4. KEYS (user provides — wire via env, never hardcode; placeholders + boot validation in `.env.example`)

`MONGODB_URI` (Atlas — persistence) · `AI_API_KEY` + `AI_MODEL` (Gemini — online AI) · `JWT_SECRET` (fails fast in prod if missing) · TTS key later (Google Cloud TTS free tier or keyless `edge-tts`) · No key needed: Overpass, Wikipedia/Wikidata, Nominatim (server-side), datameet/railways, tariff PDFs.

## 5. VERIFICATION PLAN (binding)

**Automated (must be 0-error):** `npm run build`, `lint`, `typecheck`, `test` in BOTH `client/` and `server/`; T01–T40 regression green; new tests for fare median math, geofence trigger logic, and hash-chain verify/tamper detection.
**Manual matrix (report pass/fail each):** hero offline widget full cycle (queue depth 1 → Synced ✓) · Fare calculator for a gazette city vs crowd-only city vs N=0 city · dispute cards render all 7 languages · Train alarm triggers in a simulated-approach test + airplane-mode GPS note verified on a real phone · certificate export contains only real trip rows + verify reports OK, and BROKEN after tampering one record in devtools · 360px + desktop viewports · cold-start (Render sleep) skeleton behavior.
**Deploy check:** push → Vercel + Render green → smoke-test `/`, `/fare-guardian`, `/train-mode`, `/create`, `/active/:id` on the live URLs.

## 6. DEFINITION OF DONE

All §2 acceptance criteria met · §5 all-green with evidence (command output + manual matrix table) · `LIVE.md` + `ERROR_LOG.md` updated · no hardcoded user-facing numbers (grep evidence) · final summary maps each feature → tourism outcome from §0 in one table. Work in §2 order. If any real source is blocked → STOP and report; never substitute mocks.

*Build contract: this prompt + ERROR_LOG.md + LIVE.md. Judges' line: "the travel companion that protects you when the network gives up."*
