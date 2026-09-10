# Sanchar AI — FIX-ERRORS-ONLY PROMPT (v1.0 • 2026-09-10)
### Paste this to any coding AI to fix ONLY the verified live-site bugs. No redesign. No new features.

> **Scope lock:** Fix the 9 items below and nothing else. Do not rename files, do not restyle,
> do not add pages. Every fix must keep `npm run build` green and keep all honesty rules.

---

## CONTEXT (read first)
- Repo: `Sanchar-AI` — client on Vercel (`https://sanchar-ai.vercel.app`),
  API on Render (`https://sanchar-ai.onrender.com`, axios `baseURL` from `client/src/config.ts`).
- Live API proof: `GET /api/site-stats` → `{"tripsRecorded":5,"cityPacksLive":9,"languagesSupported":6,"safetyChecks":0}`
- Live API proof: `GET /api/mobility/summary` → `totalTrips:5, totalCities:4, totalLanguages:8, safetyChecks:3, modeShare:[Walking:5, Still:5]`
- Live API proof: `GET /api/partner-publish?city=Chennai` → still returns 2 QA test docs
  (`pub_1788933617084_25s6y` "Test Cafe Guide", `pub_1788933616711_30lko` "Arena Test Homestay").

---

## FIX 1 [CRITICAL] — QA test partner items visible on live site
**Where seen:** `https://sanchar-ai.vercel.app/city/Chennai` and `/partners` show
"Test Cafe Guide" and "Arena Test Homestay".
**Root cause:** Render backend is running a stale deploy; the purge code in
`server/src/routes/api.ts` (`GET /api/partner-publish` + `PartnerPublish.deleteMany`) never ran in prod.
**Fix:**
1. Redeploy the Render service from branch HEAD (`arena/01a089b8-sanchar-ai`).
2. Run a one-time cleanup against prod MongoDB (script or shell, then delete the script):
   `db.partnerpublishes.deleteMany({ $or: [{ _id: { $in: ['pub_1788933617084_25s6y','pub_1788933616711_30lko'] } }, { title: /test/i }] })`
3. Verify: `GET /api/partner-publish?city=Chennai` returns `count:0` and both pages show the honest empty state.
4. Keep the standing purge filter in the GET route as a safety net.

## FIX 2 [HIGH] — Dashboard mode-share double-counts every trip
**Where seen:** `/dashboard` shows "Walking: 5, Still: 5" for only 5 trips (sums to 10).
**Root cause:** `server/src/routes/api.ts` → `GET /api/mobility/summary` fallback block:
`modeCounts.Walking += 1` sits OUTSIDE the if/else chain, so every trip adds +1 Walking AND +1 to its real bucket.
**Fix:** move the Walking increment into the final `else` so each trip counts **exactly once**:
```ts
if (mode.includes('train') || mode.includes('rail') || mode.includes('metro')) modeCounts.Rail += 1;
else if (mode.includes('bus') || mode.includes('cab') || mode.includes('road') || mode.includes('car')) modeCounts.Road += 1;
else if (mode.includes('still') || mode.includes('stop')) modeCounts.Still += 1;
else modeCounts.Walking += 1;   // default bucket — one increment per trip only
```
Apply the same one-count rule to the memory-fallback branch. Verify total across buckets === `totalTrips`.

## FIX 3 [HIGH] — "Safety checks" number differs between pages
**Where seen:** homepage (site-stats) says `0`, dashboard says `3`.
**Root cause:** `/api/site-stats` counts only `SafetyEvent`, while `/api/mobility/summary`
counts `SafetyEvent + IssueReport`.
**Fix:** create ONE shared helper `getSafetyChecksCount()` = `SafetyEvent.count + IssueReport.count`
(memory + Atlas branches) and use it in BOTH endpoints. Use the SAME label on both pages:
"Safety & issue reports". Homepage fallback when API is down stays `0` with the existing "—" connecting state.

## FIX 4 [MEDIUM] — "Languages" number differs between pages
**Where seen:** homepage says `6`, dashboard says `8`.
**Root cause:** site-stats hardcodes `6`; mobility/summary computes `max(totalCities*2, …)`.
**Fix:** create ONE shared helper `getLanguagesSupported()` = distinct `localLang` values across
`CityPack.phrases` (both memory + Atlas branches), fallback `6`, and use it in BOTH endpoints.
Both pages then show the same real number with zero copy changes needed.

## FIX 5 [MEDIUM] — Timeline confuses ("5 trips but only 2 on graph")
**Where seen:** `/dashboard` 14-day chart sums to 2 while header says 5 trips (3 trips are older than 14 days — the math is correct, the label is not).
**Fix (copy + caption only, no logic change):** under the 14-day chart add:
`"Showing trips in the last 14 days (X of Y total)."` computed from the same response
(`tripsOverTime` sum vs `totalTrips`). Same for Hourly Demand if all-zero: keep the honest
"No consented trips yet…" empty state that already exists.

## FIX 6 [MEDIUM] — "No completed trips yet" contradicts the "last trip" banner
**Where seen:** homepage Memory Store section says "No completed trips yet" while the top banner
shows "Your last trip: Chennai → Ooty".
**Root cause:** `DiarySlide` in `client/src/App.tsx` only checks `localStorage sanchar_private_diary`,
ignoring the server's `lastCompletedTrip` already in `HealthContext`.
**Fix:** pass `lastCompletedTrip` into `DiarySlide`; if a server completed trip exists, render its
real route + "Open History Vault" link instead of the empty state. Keep localStorage notes as the
"Latest Story Entry" when present. No new API calls.

## FIX 7 [LOW] — Broken marketplace image (404)
**Where seen:** `/marketplace` first card requests `/images/spots/kapaleeshwarar.jpg` which does not exist.
**Fix:** in `client/src/pages/MarketplacePage.tsx` change the Kanchi Silk card image to the real file
`/images/spots/kapaleeshwarar-temple.jpg` (verified present in `client/public/images/spots/`).
The `onError` SVG fallback stays as-is.

## FIX 8 [PRIVACY HARDENING] — Analytics consent filter must be explicit opt-in
**Where seen:** code only — `GET /api/mobility/summary` uses `{ analyticsConsent: { $ne: false } }`,
which in MongoDB ALSO matches documents where the field is missing. Our public claim is
"consent-ON trips only".
**Fix:** change both the Atlas query and the memory filter to explicit opt-in:
Atlas: `{ $or: [{ analyticsConsent: true }, { analyticsConsented: true }] }`;
memory: `t.analyticsConsent === true || t.analyticsConsented === true`.
Dashboard empty state ("No anonymous mobility data yet — consent-ON trips only.") must still render when N=0.

## FIX 9 [COPY HONESTY] — Soften two absolute claims (wording only)
1. `client/src/pages/TrainModePage.tsx` hero: replace "working 100% offline in airplane mode"
   with "works in airplane mode using GPS radio — no network needed. Background alarms need the Android app."
2. `client/src/pages/FareGuardianPage.tsx` badge: replace "Gazette Tariff Verified" with
   "As per published gazette — verify on meter card". (The Mumbai Sept-2026 figures themselves are
   verified correct against the MMRTA notification: auto ₹27/1.5km + ₹18.22/km, taxi ₹33 + ₹21.90/km,
   night +25% — DO NOT change the numbers.)

---

## ACCEPTANCE CHECKLIST (must all pass)
- [ ] `/city/Chennai` + `/partners` show ZERO test items; partner empty state renders.
- [ ] `/dashboard` mode buckets sum === total trips; Safety number === homepage Safety number; Languages number === homepage Languages number.
- [ ] 14-day chart carries the "X of Y total" caption.
- [ ] Homepage Memory section agrees with the last-trip banner.
- [ ] No 404 images on `/marketplace` (Network tab).
- [ ] `/dashboard` with zero consented trips still shows the honest empty state.
- [ ] `npm run build` passes for client + server. No new routes, no redesign, no version bumps.

**Output when done:** list each FIX 1–9 with file + line changed, then the checklist with PASS/FAIL.
