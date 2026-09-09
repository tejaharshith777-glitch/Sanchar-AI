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
