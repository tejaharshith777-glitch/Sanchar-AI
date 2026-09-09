# 🧪 SANCHAR AI — Full Error Log (50+ checks, every section tested)

**Test date:** 2026-09-09 · **Method:** live API test matrix (T01–T40) + fix-verification re-runs (V16–V36) + static audit of all 25 client files + all server files + Android manifest/gradle + production build + lint + typecheck + live-site crawl.
**Result:** 40 findings · **28 FIXED in this branch** · 12 handed to Antigravity (in `WINNING_MASTER_PROMPT.md`).

---

## 🔴 P0 — HONESTY VIOLATIONS (brand-killers — all verified live)

| # | Error | Proof | Status |
|---|-------|-------|--------|
| H1 | **Server INVENTED fake spots** (`"{city} Central Fort"`, `"Old City Bazaar"`, `"Promenade Waterfront"`, `"Heritage Temple"`) labeled `source:wikipedia-live` when Wikipedia had nothing. Directly contradicts the FAQ "we never invent places". | T31: `GET /city-spots/Ooty` → `"Ooty Central Fort"` | ✅ FIXED — returns `source:no-verified-data, count:0` + honest message; empties never persisted to Mongo (V31 verified) |
| H2 | **Heatmap served RANDOM geohash cells** (`mem_geohash_84r`) with hardcoded modes in memory mode — fake spatial data on the dashboard. | T23: `"areaCell":"mem_geohash_84r"` | ✅ FIXED — memory aggregates carry `spatialCell:false`, excluded from heatmap layer (V23 → `[]`) |
| H3 | **Luggage page invented a cloakroom offline** (`"{city} Railway Cloakroom"`, `verified:true`, fake `₹15/day` pricing) whenever any pack was cached. | Code: `PlacesAndLuggage.tsx` "offline cache mock" | ✅ FIXED — honest "offline, no cached data" error + instant fail (no 65s stall) |
| H4 | **Eco Rewards showed HARDCODED km (3.5/12/45) as "your own journey"** — CO₂ + points were fiction. | Code: `EcoRewardsPage.tsx` constants | ✅ FIXED — user-entered distances + honest "manual estimate" copy everywhere |
| H5 | **Privacy pipeline claims "strips first/last 500m" but slices 5 points**; `modeCategory` hardcoded `'mixed'`. Claim ≠ implementation. | Code: `services/privacy.ts` | ⏳ ANTIGRAVITY — implement real haversine 500m strip + derive mode from segments, or reword claim |
| H6 | AI context injects fallback fare `'Auto ₹30-50/km'` that can surface as fact. | Code: `api.ts` ai/chat | ⏳ ANTIGRAVITY — remove invented fallback; use city rate card or "confirm locally" |
| H7 | `/crowd-radar` route name overpromises vs "Smart Visit Planner" heuristic content (page itself has an honest disclaimer — good). | Code: `CrowdRadarPage.tsx:99` | ⏳ ANTIGRAVITY — rename route or upgrade to report-backed radar |
| H8 | Dashboard mode share double-counts (5 trips → Walking 5 + Still 5) on live site. | Live `/dashboard` crawl | ⏳ ANTIGRAVITY — fix aggregation (segments vs trip fallback) |

## 🛡️ P0 — SECURITY (all verified live)

| # | Error | Proof | Status |
|---|-------|-------|--------|
| S1 | **PATCH mass-assignment**: rewrote `_id`→`"HACKED"`, `status`, `amountSpent` on any trip/segment/expense. | T36: `{"_id":"HACKED",...}` | ✅ FIXED — `pickAllowed()` whitelists on all 3 PATCH handlers (V36 verified) |
| S2 | **Vault PINs stored PLAINTEXT in MongoDB** (client hashes with PBKDF2, server didn't). | Code: `user.vaultPin = pin` | ✅ FIXED — bcrypt hash + legacy plaintext migration on next verify |
| S3 | JWT signed with hardcoded fallback secret if env missing (forgeable tokens). | Code: `JWT_SECRET \|\| 'super-secret…'` | ✅ FIXED — throws in production, loud warning in dev |
| S4 | `GET /api/trips` leaks **EVERYONE's trips** to anonymous callers; `userId` never set/used. "Privacy-first" product with zero trip scoping. | T37: `trips visible to anonymous: 2` | ⏳ ANTIGRAVITY — user-scoped trips + auth middleware (breaking change, needs migration) |
| S5 | CORS sent `Allow-Origin:*` + `Allow-Credentials:true` (browsers reject this combo). | T32 headers | ✅ FIXED — echo origin + credentials only when origin present (verified both ways) |
| S6 | Zero input validation on all endpoints though `zod` is installed. | Code audit | ⏳ ANTIGRAVITY — zod schemas on trips/expenses/reports/signup |

## 🐞 P1 — FUNCTIONAL BUGS (verified live)

| # | Error | Proof | Status |
|---|-------|-------|--------|
| F1 | `GET /trips/:id/points` → **500 in memory mode** (no fallback branch) — Diary timeline breaks without Mongo. | T16: `bufferCommands = false` 500 | ✅ FIXED — memory branch with timestamp sort (V16 → 200) |
| F2 | **Duplicate `POST /trips/:id/safety-events`**: dead first handler shadowed the correct one → duplicate events on retry + trip cooldowns never set. | T19: same key → 2 `_id`s; T20: cooldown `null` | ✅ FIXED — deleted first handler; canonical one is idempotent + sets cooldowns (V19/V20 verified) |
| F3 | **4 more duplicate routes** (`GET/POST partner-publish`, `POST issue-reports`, `GET issue-reports/summary` defined twice; second copies unvalidated). | Route grep + T27/T29 first-wins proof | ✅ FIXED — deleted second block; validated handlers kept |
| F4 | Duplicate `GET /api/health` (index.ts copy dead, different shape `time` vs `timestamp`). | Code audit | ✅ FIXED — removed index copy, single router source of truth |
| F5 | `npm run seed` broken — root calls `server:seed` which doesn't exist. | `package.json` audit | ✅ FIXED — added `seed: npm run build && node dist/seed/seed.js` |
| F6 | `npm run test` broken — client has no `test`, server `test` always `exit 1`. | `package.json` audit | ✅ FIXED — honest smoke gates (`lint + tsc --noEmit`) both sides |
| F7 | `POST /ai/chat` returned 503 for empty message (config checked before validation). | T25: `{}` → 503 | ✅ FIXED — 400 first, then 503 (V25 verified) |
| F8 | `insertMany([])` throws on fresh boot (empty seed arrays) + misleading "seeding 3 trips" log. | Code: `services/db.ts` | ✅ FIXED — length guards + truthful logs |
| F9 | **Retry storm**: axios 3× (5+10+20s = 35s) × component wake-retries (0/5/10/20/30s) = minutes of hanging + duplicate POSTs (pilot signups!). | Code: `main.tsx` + `skipRetry` used once | ✅ PARTIAL — delays cut to 3/8/15s + mutating requests without `Idempotency-Key` never retried. ⏳ ANTIGRAVITY: unify into one retry policy |
| F10 | City-pack cache key case bug: `cacheCityPack("Chennai")` then `get("chennai")` misses. | Code: `store/db.ts` | ✅ FIXED — lowercase-normalized keys (+ `displayCity` preserved) |
| F11 | GPS `setState` inside `setPoints` updater (impure → **distance double-counts** under StrictMode/concurrent). | Code: `useGPSTracker` | ✅ FIXED — distance via `lastPointRef`, updater pure |
| F12 | GPS `points` array unbounded + copied every fix → O(n²) jank on long trips. | Code: `useGPSTracker` | ✅ FIXED — capped at last 500 (batches already sent/queued) |
| F13 | GPS accepts any-accuracy fixes → indoor drift inflates distance. | Code: `useGPSTracker` | ✅ FIXED — drops fixes with accuracy > 50m |
| F14 | Luggage page stalled ~65s through wake-retries while offline before erroring. | Code: retry loop | ✅ FIXED — offline fails fast with guidance (see H3) |
| F15 | Leaflet marker icons loaded from **unpkg CDN** — 404 offline + leaks requests (breaks "offline maps" claim). | Code: `SancharMap.tsx` | ✅ FIXED — icons copied to `public/images/leaflet/`, self-hosted |
| F16 | PWA manifest pointed to **non-existent** `pwa-192/512.png` → install prompt never fires; `includeAssets` listed 3 missing files. | `public/` audit | ✅ PARTIAL — manifest now uses real `favicon.svg` (`sizes:any`); `includeAssets` fixed. ⏳ ANTIGRAVITY: generate real 192/512 + maskable PNGs |
| F17 | Marquee renders city list twice (by design) but dupes exposed to screen readers/keyboard. | Code: `App.tsx:2051` | ✅ FIXED — second half `aria-hidden` + `tabIndex -1` |
| F18 | `helmet` + `cors` imported but never used (no security headers at all). | Code: `index.ts` | ✅ FIXED — dead imports removed (blanket helmet would break OSM tiles via CSP `img-src`; proper header config → ANTIGRAVITY) |
| F19–F22 | **Android**: `POST_NOTIFICATIONS` requested at runtime but undeclared (auto-denied, silent no-notify on 13+); `SCHEDULE_EXACT_ALARM` missing while `setExactAndAllowWhileIdle` used (crash on 12+); launcher `@mipmap/ic_launcher` missing (build FAILS); `targetSdk 34` outdated for 2026 Play. | Manifest + `MainActivity.kt:456` audit | ✅ FIXED manifest perms + adaptive launcher icons (anydpi-v26 covers minSdk 26). ⏳ ANTIGRAVITY: `canScheduleExactAlarms()` runtime check, targetSdk 35/36, drop `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (Play policy risk) |
| F23 | `server:dev` = one-shot `tsc && node` (no watch — painful loop). | `package.json` audit | ⏳ ANTIGRAVITY (DX) |
| F24 | Single **1.2 MB JS bundle** (346 KB gzip) + **32 MB PWA precache** (OCR models) — brutal on 2G/3G for an "offline-first" travel app. | `vite build` output | ⏳ ANTIGRAVITY — route code-splitting + runtime-cache OCR on demand |
| F25 | Nominatim called **direct from browser** in 3 places (usage-policy violation, IP-ban risk, no caching). | Code grep | ⏳ ANTIGRAVITY — server-side `/api/geocode` with Mongo cache |
| F26 | 15s health poll + 4-min keepalive ping = battery/data drain. | Code: `App.tsx` | ⏳ ANTIGRAVITY — visibility-aware backoff |
| F27 | Memory-fallback mode silently accepts writes that vanish on restart. | UX audit | ⏳ ANTIGRAVITY — persistent "temporary storage" banner |
| F28 | Landing: vague hero, 3×-too-long page, `"—"` stat placeholders; `App.tsx` 5,667-line monolith (129 `useState`s). | Live crawl + audit | ⏳ ANTIGRAVITY — Phase 1 + Phase 2 of master prompt |
| F29 | Client TS `strict` off — `any` everywhere; server-only strict. | `tsconfig` audit | ⏳ ANTIGRAVITY — gradual strictness (dozens of latent type bugs likely) |
| F30 | `totalLanguages: max(cities*2, cities?4:0)` ≠ documented formula; misleading on 1 city. | T22 (`4` for 1 city) | ⏳ ANTIGRAVITY (trivial) |

## ✅ API TEST MATRIX (all live, memory mode unless noted)

T01 health · T02 cities · T03 city-pack keys · T04 curated spots · T05 spot 200 · T06 spot 404 · T07 luggage 400-no-city · T08 luggage data · T09 site-stats · T10/T11 pilot signup 400/201 · T12–T15 trip lifecycle · T16 points-500→200 · T17/T18 expense idempotency · T19/T20 safety dup→fixed · T21 complete · T22 summary · T23 heatmap-random→`[]` · T24/T25 ai 503/400 · T26 auth-disabled · T27/T28 partner CRUD · T29 category whitelist · T30 issues · T31 Ooty-fake→honest-empty · T32 CORS-fixed · T33 rate-limit headers · T34 404 · T35 malformed-JSON 400 · T36 mass-assign→blocked · T37 trip-leak (open, S4) · T38 segments · T39 luggage bad-status 400 · T40 sync · + production `vite build` ✅ + `tsc` client/server ✅ + `oxlint` 38w/0e ✅ + live crawls `/`, `/dashboard` ✅.

**Files changed in this branch:** `server/src/routes/api.ts` (−120 dead/duplicate lines, +guards), `server/src/index.ts`, `server/src/services/db.ts`, `server/package.json`, `client/src/App.tsx`, `client/src/main.tsx`, `client/src/store/db.ts`, `client/src/components/SancharMap.tsx`, `client/src/pages/PlacesAndLuggage.tsx`, `client/src/pages/EcoRewardsPage.tsx`, `client/vite.config.ts`, `client/package.json`, `android/.../AndroidManifest.xml`, `+ drawable/ic_launcher_foreground.xml`, `+ mipmap-anydpi-v26/*`, `+ public/images/leaflet/*`.

---

# 🔁 ROUND 2 — Antigravity-feature audit ( Fare Guardian · Train Mode · Trip Proof · mobility )

**Test date:** 2026-09-10 · **Method:** merged `origin/main` (squashed Antigravity commit `c60151d`) with Round-1 branch; live crawls (Vercel + Render/Atlas); 9 cited fare-tariff searches; code-level verification of every claim; fix + re-test locally (memory mode).
**Result:** 35 new findings · **27 FIXED in this branch** · 8 handed to Antigravity (in `WINNING_MASTER_PROMPT.md` v2).

## 🔴 P0 — FARE DATA FABRICATION (anti-overcharge tool that enables overcharging — all cited)

| # | Error | Proof | Status |
|---|-------|-------|--------|
| R2-H1 | **Chennai card fabricated**: auto ₹35/₹18 vs gazetted **₹25/1.8km/₹12/km** (TN 2023 chart); taxi ₹100/4km vs **no gazetted taxi tariff**. 5km ride: tool says ₹92.60, truth ₹63.40 (**+46%**). | metersahi.in/chennai, metercalculator.in | ✅ FIXED — gazetted auto values; taxi replaced with honest "no metered tariff" explainer |
| R2-H2 | **Mumbai card stale**: Sep-2026 MMRTA revision → auto **₹27+₹18.22**, taxi **₹33+₹21.90** (card had 26/17.14, 31/21.43 — the per-km matched NO regime). | TOI 26/08/2026, NDTV Profit 31/08/2026 | ✅ FIXED — current rates + recalibration note |
| R2-H3 | **Bengaluru card stale**: RTA order 14/07/2025 → **₹36/2km + ₹18/km** (card had 2021-era 30/15). | The Hindu, Moneycontrol, Livemint 07/2025 | ✅ FIXED |
| R2-H4 | **Delhi taxi min ₹50 vs gazetted ₹40** (09/01/2023 notification; non-AC ₹17/km, AC ₹20/km). Auto 30/11 ✓ correct. | NIE, NDTV, HT 01/2023 | ✅ FIXED — min 40 + AC variant note |
| R2-H5 | **Hyderabad auto perKm 12 vs gazetted 11**; night +50% **unapproved** (1.5× only *proposed* 03/09/2026); taxi min 80 vs reported 40/2km. | NIE 06/09/2026, TelanganaTribune | ✅ FIXED — 20/1.6/11, night disabled + pending-revision note, taxi marked indicative |
| R2-H6 | **Kolkata auto per-km card is fiction** (route-based city, no metered tariff); taxi min 50 vs **₹30/2km + ₹15/km** (WB 2529-WT, 11/06/2018). | wbxpress (gazette mirror), welcomepickups | ✅ FIXED — auto removed w/ explainer, taxi corrected |
| R2-H7 | **All 6 `effectiveDate`s fiction** (Chennai 15/10/2024, Bengaluru 01/12/2024, Delhi 01/01/2025, Hyderabad 10/11/2024, Kolkata 01/09/2024 — no such revisions). | No notification exists for any | ✅ FIXED — real dates (or "pending approval" where true) |
| R2-H8 | **"Crowd-reported median fare" with zero reports fetched**; unknown-city "estimate" (25/50+14/20) labeled as median. Pure fabrication of crowd data. | `FareGuardianPage.tsx:326` + no GET wired | ✅ FIXED — honest labels (official/indicative/rough-guess); real median endpoint → Antigravity |
| R2-H9 | **"Report saved locally" with no save** — offline reports silently lost. | `handleReportSubmit` catch block | ✅ FIXED — real localStorage queue + auto-sync + pending count |
| R2-H10 | Fare "Source" links labeled **"official gazette notice"** but point at dept homepages. | All 6 `sourceUrl`s | ✅ FIXED — relabeled "issuing authority site" |
| R2-H11 | Night toggle applied **unverified surcharges** (incl. invented Kolkata +20%). | Rate cards | ✅ FIXED — toggle disabled without verified rule + explainer |
| R2-H12 | City-pack guidance contaminated: Hyderabad pack had **TN's ₹25+₹12**, Chennai "₹120–250" (metered truth ₹39–75), Bengaluru stale ₹30+₹15, Kochi unverified ₹30+₹15. | Live `/api/city-packs/*` | ✅ FIXED — verified-or-generic guidance in `curatedCities.ts` |

## 🔴 P0 — TRUST THEATER (verified live)

| # | Error | Proof | Status |
|---|-------|-------|--------|
| R2-T1 | **Trip Proof is theater**: Diary hardcoded `valid:true`, never called `verify*`; copy claimed "guarantee un-altered", "immutable logs", nonexistent "station ping". | `App.tsx:4692` + `tripProof.ts` | ✅ FIXED — explicit Seal → Verify flow wired to real `verifyTripProofHashChain`, honest copy |
| R2-T2 | `verify*` had **`GENESIS_VALIDATED` magic bypass** + `brokenIndex` always = last record (unknowable by design — final-hash-only compare). | `tripProof.ts` | ✅ FIXED — bypass removed; per-record chain compare yields the true first-broken index (−2 = honestly unknown) |
| R2-T3 | Diary `new Date()` fallback timestamps → signature churn. | `App.tsx` records builder | ✅ FIXED — deterministic fallback |
| R2-T4 | Dashboard **"real consented trips"** counted 2 `analyticsConsent:false` + 3 junk test trips (same-city, start-after-end). | Live `/api/trips` + `/api/mobility/summary` | ✅ FIXED — consent `$and` + junk-trip filter, verified: 4 seeded → 1 counted |
| R2-T5 | `totalLanguages = cities×2` (live "8" from 4 cities); site-stats `languagesSupported = 6` hardcoded. | Code + live | ✅ FIXED — real distinct count from packs (seeded: 10) |
| R2-T6 | `safetyChecks` = 0 on site-stats but 2 on summary (different formulas, same label). | Live both endpoints | ✅ FIXED — single formula (safety + reports) on both |
| R2-T7 | Train Mode **"100% offline in airplane mode"** — background-tab GPS throttle + no Wake Lock kills it (missed-station risk). | Code audit | ✅ FIXED — honest copy + screen Wake Lock + screen-on guidance |
| R2-T8 | Ooty cache poisoned (**Guntur coords** 16.28,80.43; all-13-spots "Beach") — Wikipedia API returns CORRECT Ooty coords, and repo code cannot produce Guntur coords → **external writer contaminated shared Atlas** (other sessions share `MONGODB_URI`). | Live `/api/city-spots/Ooty` + Wiki API check | ✅ FIXED — 150km coord validation + cache v2 auto-purge + upsert (purge fires on next request); per-env DBs → Antigravity/ops |

## 🐞 P1 — FUNCTIONAL BUGS

| # | Error | Proof | Status |
|---|-------|-------|--------|
| R2-F1 | **modeShare double-count**: stray `modeCounts.Walking += 1` outside the if/else → 5 trips = Walking 5 + Still 5 (closes R1-H8). | Code + live | ✅ FIXED — one vote per trip (+ Other bucket); verified Walking:1 |
| R2-F2 | Consent `$or` of two `$ne:false` matches everything (any doc with one field unset passes). | Code + live totalTrips 5 | ✅ FIXED — `$and` |
| R2-F3 | Category engine: `dam`→Beach ("Adam's"), `bil`→Beach ("Jubilee Hills"), `art`→Museum ("Bharat"), dams/lakes/rivers→Beach. | Code + live Ooty | ✅ FIXED — word-boundary matcher, `bil` removed, new `Lake` label; verified |
| R2-F4 | `isInvalidSpot` drops keyword-less real spots (**Charminar**) and kills "Regional…" via substring `region`. | Code | ✅ FIXED — name+blurb matching, bounded admin/media terms |
| R2-F5 | Train alarm **re-fires vibrate+speech on every GPS fix** (no latch; Dismiss futile; speech queue grows). | Code | ✅ FIXED — fire-once latch + `cancel()` before speak |
| R2-F6 | Train GPS errors only `console.warn` (denied/unavailable/timeout invisible → sleep-through-station). | Code | ✅ FIXED — visible error box with per-code guidance |
| R2-F7 | Dispute speech missing `utterance.lang` (wrong-voice reads). | Code | ✅ FIXED — BCP-47 map + matching-voice pick |
| R2-F8 | `max = exact×1.08` unexplained. | Code | ✅ FIXED — labeled "~8% traffic buffer" |
| R2-F9 | **"Bhubaneswar" typo** in dashboard filter + carousel + coords + image filename. | Live + code | ✅ FIXED — Bhubaneswar everywhere incl. image rename |
| R2-F10 | Mecca Masjid (a mosque) categorized `temple`. | Live pack | ✅ FIXED — `heritage` (taxonomy has no mosque) |
| R2-F11 | OpenSearch fallback mints non-attractions as spots (people, films, admin topics). | Antigravity hunk (merged, was missing here) | ✅ FIXED — merged + hardened (title+real-desc validation, person/district skip, cap) |
| R2-F12 | CitySpot blind `save()` creates duplicate city docs (case variants, regen). | Code | ✅ FIXED — `findOneAndUpdate` upsert (+ memory replace) |
| R2-F13 | 12-station list: no empty state, no coverage disclaimer ("Madurai" → blank). | Live `/train-mode` | ✅ FIXED — empty state + demo-coverage note |
| R2-F14 | `CITY_CENTERS_MAP` server-defined-never-used (11 cities, no Ooty). | Code | ✅ FIXED — extended to 26 cities + used for coord validation |
| R2-F15 | "Show Ticket to TTE Offline" — checked: ticket-scan feature EXISTS (30 refs) → claim stands. | Code grep | ✅ NO BUG (verified, dropped) |
| R2-F16 | `/train-mode` crawled empty twice ("Ask AI" only) — cache-busted re-crawl renders fully → lazy-chunk timing, not a crash. | 3 crawls | ✅ NO BUG (verified, dropped) |
| R2-F17 | Homepage "−20 Packs" strip reading — `AnimatedCounter` math proven non-negative (monotonic 0→value); transient crawler artifact. API 9 ✓. | Code proof | ✅ NO BUG (verified, dropped) |

## ✅ ROUND-2 VERIFICATION (merged tree, memory mode + builds)

`tsc` server ✅ · `tsc` client ✅ · `vite build` ✅ (PWA 26 precache) · seeded 4 trips (1 legit + junk + non-consented + bad-dates) → summary `totalTrips:1, modeShare:[Walking:1], langs:10`, site-stats identical ✅ · category spot-checks (Adam/Jubilee/Bharat/Sagar/Rose/Science) ✅ · Hyderabad pack = real TG tariff ✅ · Ooty = honest-empty v2 ✅.

**Round-2 files changed:** `server/src/routes/api.ts` (category/filter/engine + OpenSearch + validation + versioning + consent/junk/modeShare/languages/safety), `server/src/data/curatedCities.ts`, `server/src/data/generatedSpots.json`, `client/src/pages/FareGuardianPage.tsx` (verified-tariff rewrite), `client/src/pages/TrainModePage.tsx`, `client/src/store/tripProof.ts`, `client/src/App.tsx` (Diary seal/verify + R1 GPS/marquee re-apply + typo), `+ client/src/pages/*` (Antigravity, merged), `bhubaneswar.jpg` rename. **Rejected from merge:** Antigravity's CORS hunk (weaker than R1 allowlist — reflects any origin + credentials).
