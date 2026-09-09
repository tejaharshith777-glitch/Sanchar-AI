# SANCHAR AI — Antigravity Build Prompt (copy everything below the line)

---

You are working in the repo root of **Sanchar-AI** (monorepo: `client/` = React 19 + Vite + Tailwind PWA, `server/` = Node + Express + TypeScript + MongoDB/Mongoose, `android/` = native Kotlin app).

Live site: https://sanchar-ai.vercel.app/ | API: https://sanchar-ai.onrender.com
Run `node doctor.js` and `npm run install:all` first, then `npm run dev` to verify the app boots before changing anything.

## PRIME DIRECTIVE — REAL + LIVE DATA ONLY (non-negotiable)

1. **Zero fake data.** No hardcoded stats, no mock arrays rendered as real, no invented ratings/reviews/counts/testimonials anywhere in UI.
2. **Every number on screen must be live**: from a real API response (MongoDB-backed, with the existing in-memory fallback only when `MONGODB_URI` is absent) or computed client-side from real user data (GPS points, OCR results, expenses).
3. **Empty = honest empty state.** If N=0, show e.g. "No trips recorded yet — start your first Safe Trip." Never render "—" dashes or placeholder counts. If a section has no real data, hide it or show the honest empty state.
4. **City/spot content must be either (a) curated-verified data already in `server/src/data/` or (b) live-fetched from real open sources (Wikipedia/Wikidata/OpenStreetMap)** and cached. Every piece of content shows a provenance tag: `curated` / `live-generated` / `unverified`. Never invent places, timings, fares, or reviews. If a city has no data: "No verified spot list for {city} yet" + fall back to the General India pack (112 emergency, 139 rail enquiry).
5. **No `localhost` in deployed UI.** API base comes from env (`VITE_API_URL`), never hardcoded dev URLs.
6. After every change, grep to prove no new hardcoded user-facing numbers/claims were added.

## PHASE 1 — Credibility fixes (do FIRST, before new features)

1. **Fix duplicated city carousel** on the landing page — each city appears exactly once. Root-cause it (likely duplicated array/concat) rather than patching CSS.
2. **Fix all "—" placeholder stats** — bind "Packs Available / Languages / Trips Logged" to live endpoints (`GET /api/mobility/summary`, trips count). Honest empty state when N=0.
3. **Cut landing page length ~50%.** Target structure only: Hero (one-line value prop + single "Start Safe Trip" CTA + offline-proof demo) → live trust strip (REAL numbers only) → one "How offline works" block → features grid → spots preview → FAQ → footer. Move Marketplace / Hotel Partner / Eco Rewards under a "Labs" section — keep the pages, de-emphasize them in nav.
4. **Sharpen the hero to one identity**: "The travel companion that protects you when the network gives up." Sub-line must say what it DOES: Safe Trip tracking, SOS 112, offline fares, offline phrases — all working with zero network.
5. **Add SEO/social meta**: OG tags, Twitter card, canonical, `og:image` (generate one from existing assets), proper title/description in `client/index.html`.
6. **Mobile-first audit**: test at 360px width; primary CTAs thumb-reachable; no horizontal scroll; tap targets ≥44px; readable without zoom.
7. **Airplane-mode proof widget in hero**: an interactive "Go offline" toggle that simulates `navigator.onLine=false`, performs a real queued mutation (e.g. log an expense/note into the IndexedDB outbox with idempotency key), then "reconnects" and shows Saved on device → Syncing → Synced using the REAL sync queue code in `client/src/store/db.ts`. No fake animation — it must use the actual queue.

## PHASE 2 — Refactor (no behavior change, must keep all routes working)

8. **Split `client/src/App.tsx` (~5,600 lines, ~129 useStates)** into a feature-folder structure with lazy-loaded routes (`React.lazy` + `Suspense`): `features/landing/`, `features/trips/`, `features/scanner/`, `features/diary/`, `features/safety/`, `features/offline/`, `shared/`. Every existing route (`/`, `/city/:cityName`, `/create`, `/active/:id`, `/scan/:id`, `/expenses/:id`, `/diary/:id`, `/gallery/:id`, `/privacy`, `/history`, `/features`, `/faq`, `/dashboard`, `/maps`, `/spot/:cityName/:slug`, `/luggage`, `/partners`, `/hotel-partner`, `/marketplace`, `/crowd-radar`, `/green-credits`) must keep working.
9. **Fix wasteful networking**: replace 15s health polling + 4-min keepalive pings with visibility-aware exponential-backoff checks. Handle Render cold starts with skeleton + retry UI. If the server is in memory-fallback mode, the UI must WARN the user ("temporary storage — data may not persist") instead of silently accepting writes.
10. Keep the existing design system: Plus Jakarta Sans + Inter, deep teal `#00695C`, saffron `#F59E0B` for SOS/alerts only, off-white `#FAFAF7`. Tailwind only, no new UI framework. Preserve the honest microcopy tone.

## PHASE 3 — Differentiators (build in this order, each with REAL data)

11. **Fare Guardian (web, offline-first)** — NEW route `/fare-guardian`:
    - Offline auto/taxi fare estimator: GPS-measured distance × per-city rate card stored in the city pack. Rate cards must come from REAL sources: published state-transport/municipal rates where available, otherwise crowd-reported fares showing `median of N reports` — with N visible. Never invent a rate.
    - One-tap dispute phrase cards in the city's language + **pre-generated TTS audio cached offline** (generate at build/seed time with a real TTS, store mp3 in `client/public/audio/`, playable with zero network).
    - Scam/overcharge report submission (`POST /api/reports`, stored in MongoDB with lat/lng grid-cell, moderation flag, report count). Reports feed back into the estimator's crowd median. Show "No reports yet — be the first" honestly when N=0.
12. **Train Mode (web, offline-first)** — NEW route `/train-mode`:
    - Offline station alarm: user picks a train route/station; GPS geofence triggers a loud alarm + vibration before arrival. Must work in airplane mode with GPS on (document + handle the `watchPosition` behavior).
    - Station data from REAL open data (OpenStreetMap/rail open datasets), cached per city pack with provenance tags. No invented stations/platforms/timings.
13. **SOS Mesh (Android + web fallback)**:
    - Web: harden existing SOS — `tel:112`, Google Maps link with last REAL GPS point, Web Share with location + emergency phrase. All from live position only.
    - Android (`android/`): implement Bluetooth/Wi-Fi Direct SOS relay — encrypted SOS broadcast to nearby Sanchar devices that store-and-forward when they regain connectivity, plus SMS fallback to the trip's trusted contact. This is the headline feature: "SOS that works with ₹0 data balance." Document the protocol in `android/SOS-MESH.md`.
14. **Offline Trip Proof** — extend Diary: hash-chained GPS log (each point hashes the previous — tamper-evident), exportable journey certificate + expense reimbursement PDF generated client-side from REAL trip data only.

## DEFINITION OF DONE (verify all)

- `npm run build`, `npm run lint`, `npm run typecheck` pass for client AND server.
- Full offline loop verified manually: load app → go offline → create trip → track GPS → OCR-scan a real receipt image → queue mutations → reconnect → confirm Synced with no duplicates (idempotency keys).
- No hardcoded user-facing numbers/claims (show grep evidence for the files you touched).
- No route from the Phase-2 list returns 404; no console errors on landing, /create, /active/:id, /scan/:id.
- Mobile 360px: no horizontal scroll, CTAs reachable, Lighthouse mobile Performance ≥ 80 if achievable without rewrites.
- Update `LIVE.md` feature-status table with everything you changed/added, marking data source (MongoDB live / open-data live / on-device real) per row.

Work phase by phase in order. After each phase, summarize: what changed, which files, how you verified with REAL data, and what remains. If any real data source is unavailable or blocked, STOP and report it — do not substitute mock data.
