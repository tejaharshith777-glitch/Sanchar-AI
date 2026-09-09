# 🏆 SANCHAR AI — WINNING MASTER PROMPT v2 (paste into Antigravity)

> **Context for the builder:** Two audit rounds are DONE and MERGED in this branch (`arena/01a08795-sanchar-ai`): Round 1 fixed 28/40 findings, Round 2 fixed 27/35 (all verified: `tsc` server+client ✅, `vite build` ✅, live API re-tests ✅). Full proof is in `ERROR_LOG.md`. **Do NOT re-litigate fixed items. Do NOT reintroduce hardcoded/estimated numbers as facts.** Every number you show must be measured, gazetted-and-cited, or explicitly labeled.
>
> **Problem statement you serve:** "boost indian tourism and travel". Every feature below must map to tourist trust, tourist safety, or tourism-partner value.

## PHASE 0 — Non-negotiable ground rules

1. **Real data only.** No invented spots, fares, medians, counts, or "AI estimates" presented as fact. Guesses must wear the label `Rough guess — verify locally`.
2. **One shared Atlas is already contaminated** (Round-2 proof: Ooty coords + Hyderabad spots no repo code could write). Use **per-env database names** from today: `sancharai_prod`, `sancharai_staging`, `sancharai_dev_<name>`. Never point a sandbox/preview at prod again.
3. **Keep the branch green:** `tsc` (server + client) and `vite build` must pass after every phase. Add a regression test or curl-check for each fix.

## PHASE 1 — Finish the honesty backlog (P0, ~1 day)

1. **Crowd fare medians (real).** Add `GET /api/issue-reports/stats?city=&vehicleType=` returning `{ medianPerKm, n, windowDays }` from structured reports (`paidFare/distanceKm`, min **n=3**, 90-day window, junk-filtered). Wire `FareGuardianPage` to show "Crowd median ₹X/km (n=Y)" next to the gazetted estimate. Never show a median with n<3.
2. **Server-anchored Trip Proof.** Add `TripProof` model `{ tripId, signature, chain[], sealedAt }` + `POST /api/trips/:id/proof/seal` + `GET .../proof/verify`. Client keeps its local seal as offline fallback but prefers server verdict when online. Replace `JSON.stringify` hashing with stable key-sorted stringify.
3. **Privacy pipeline truth.** `services/privacy.ts` claims "strips first/last 500m" but slices 5 points; `modeCategory` is hardcoded `'mixed'`. Implement the real haversine strip + derive mode from segments — or reword the claim to match reality.
4. **AI fare fallback.** `api.ts` ai/chat injects fallback `'Auto ₹30-50/km'` that can surface as fact. Delete it; fall back to the city rate card or "confirm locally".
5. **Stale-tariff safety net.** Fares rot (Mumbai revised Sep-2026, Bengaluru Aug-2025, Hyderabad pending). Add a "Flag stale tariff" button on Fare Guardian → `IssueReport{category:'stale-tariff'}` + a quarterly tariff-review checklist in `docs/FARE_REVIEW.md`.

## PHASE 2 — Security + scale (P1, ~1–2 days)

6. **User-scoped trips + auth (R1-S4, breaking).** `GET /api/trips` currently leaks everyone's trips; `userId` unset. Add auth middleware, scope trips/expenses/points, migrate prod data, then delete the 3 junk test trips + 1 test fare report from prod Atlas.
7. **Zod validation (R1-S6).** Schemas on trips/expenses/segments/reports/pilot-signup (`zod` already installed). Reject junk at write time (same-city+zero-budget, end<start) instead of only filtering at read time.
8. **Server geocode (R1-F25).** Browser-direct Nominatim calls violate usage policy. Add cached server-side `/api/geocode` (Mongo cache, 30-day TTL).
9. **Full station directory.** Replace the 12-station demo list with the 8,500+ station dataset (Overpass `node[railway=station]` seed script + quarterly refresh) and a background-resilient alarm strategy (persistent notification; document native-wrapper path).

## PHASE 3 — Tourism wins (differentiation, ~2 days)

10. **Partner analytics that sell.** Dashboard already has honest consented-trip data — add: per-city demand calendar (tripsOverTime × city), top issue categories per city with severity, and a one-click "Tourism board PDF export". This is the revenue story.
11. **Trip Planning → booking handoff.** The planner is advisory-only; add deep links (IRCTC/RTC/app-cab) per leg + "share itinerary" link. Track handoff clicks as a partner metric.
12. **Offline-first proof.** PWA + queued reports exist — add an offline-mode banner, a "pending sync" tray (reports + diary + expenses), and background-sync retry. Demo it with Wi-Fi off: the single most convincing judge moment.
13. **Cleanup.** Rename `/crowd-radar` → `/visit-planner` (or back it with report data); visibility-aware polling backoff; gradual client `strict` TS; visual pass on the widened `AppShell` (diary/active/places pages).

## ACCEPTANCE (all must hold)

- [ ] New vetting: zero hardcoded user-facing numbers without a source label.
- [ ] `curl` matrix green: consent filter, junk filter, modeShare one-vote, site-stats == summary, Ooty regenerates with Ooty coords (cache v2 purge fires once).
- [ ] Fare page: 6 metros show gazetted values with real effective dates; unknown cities show "rough guess"; offline report → queued → synced.
- [ ] Diary: Seal → edit diary → Verify shows "Record #k differs".
- [ ] Train alarm: arms, fires once, survives screen-on; GPS-denied shows guidance, not silence.
- [ ] Prod Atlas: junk test data deleted; staging/dev on separate DBs.

**If any API key is needed (none expected — all sources above are public), ask for it as an env var. Never hardcode secrets.**
