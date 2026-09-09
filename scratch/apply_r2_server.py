"""Round 2 server fixes applier. Every replacement is asserted (count==1) or the script aborts."""
import re, json, sys

API = 'server/src/routes/api.ts'
src = open(API, encoding='utf-8').read()

def rep(name, old, new, count=1):
    global src
    found = src.count(old)
    assert found == count, f'{name}: expected {count}, found {found}'
    src = src.replace(old, new)
    print(f'OK  {name}')

# ---------- R1: word-boundary category engine ----------
m = re.search(r"function getCategoryForSpot\(name: string\): string \{.*?\n\}\n", src, re.DOTALL)
assert m, 'R1 anchor missing'
new_cat = '''// Word-boundary keyword matcher: avoids substring false positives
// ("Adam's" is not a dam, "Jubilee Hills" is not a lake, "Bharat" is not art).
function spotHas(n: string, ...words: string[]): boolean {
  return words.some(w => new RegExp(`\\\\b${w.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\\\b`, 'i').test(n));
}

function getCategoryForSpot(name: string): string {
  const n = name.toLowerCase();
  if (spotHas(n, 'temple', 'mandir', 'church', 'mosque', 'basilica', 'synagogue', 'dargah', 'gurudwara', 'cathedral', 'stupa', 'deekshabhoomi', 'ashram', 'shrine', 'mutt')) {
    return 'Temple';
  }
  if (spotHas(n, 'fort', 'palace', 'castle', 'monument', 'tomb', 'mahal', 'ruins', 'qila', 'haveli')) {
    return 'Fort';
  }
  if (spotHas(n, 'beach', 'island', 'lagoon', 'backwaters', 'sea face', 'coast')) {
    return 'Beach';
  }
  if (spotHas(n, 'lake', 'dam', 'tank', 'river', 'falls', 'waterfalls', 'reservoir', 'bund', 'sagar', 'sarovar', 'kund')) {
    return 'Lake';
  }
  if (spotHas(n, 'museum', 'gallery', 'science', 'planetarium', 'art')) {
    return 'Museum';
  }
  if (spotHas(n, 'park', 'zoo', 'garden', 'sanctuary', 'forest', 'hills', 'hill', 'valley', 'safari')) {
    return 'Park';
  }
  if (spotHas(n, 'bazaar', 'market', 'street', 'shopping', 'mall', 'square', 'chowk', 'haat')) {
    return 'Market';
  }
  if (spotHas(n, 'restaurant', 'food', 'shack', 'cuisine', 'snack', 'caf\\u00e9', 'cafe', 'dhaba', 'eatery')) {
    return 'Food';
  }
  if (spotHas(n, 'view', 'viewpoint', 'drive', 'sea face', 'link', 'promenade', 'bridge', 'ganges aarti', 'ghat', 'point')) {
    return 'Viewpoint';
  }
  if (spotHas(n, 'day trip', 'excursion', 'pilgrimage', 'hajo', 'pobitora', 'mahabalipuram', 'mysore', 'srirangapatna')) {
    return 'Day trip';
  }
  return '';
}
'''
src = src[:m.start()] + new_cat + src[m.end():]
print('OK  R1 getCategoryForSpot')

# ---------- R2: Lake blurb ----------
rep('R2 lake blurb',
    "    case 'Beach': return `A scenic waterfront attraction offering beautiful views and relaxation in ${city}.`;",
    "    case 'Beach': return `A scenic waterfront attraction offering beautiful views and relaxation in ${city}.`;\n    case 'Lake': return `A scenic lake, river, or waterfront attraction in ${city}.`;")

# ---------- R3: isInvalidSpot(name, blurb) ----------
m = re.search(r"function isInvalidSpot\(name: string\): boolean \{.*?\n\}\n", src, re.DOTALL)
assert m, 'R3 anchor missing'
new_inv = '''function isInvalidSpot(name: string, blurb: string = ''): boolean {
  const n = name.toLowerCase();
  const hay = `${n} ${blurb.toLowerCase()}`;

  // 1. Is a person
  if (/\\((actor|singer|chess player|politician|writer|director|producer|musician|cricketer|athlete|scientist)\\)/i.test(n) || n.includes('born in')) return true;

  // 2. Is an administrative entity (word-bounded so "Regional Science Centre" survives)
  if (spotHas(n, 'municipal corporation', 'city corporation', 'region', 'district', 'urban agglomeration', 'mandal', 'panchayat', 'assembly', 'constituency', 'taluk', 'tehsil')) return true;

  // 3. Media / infrastructure
  if (/\\b(fm|radio|am station|television|tv channel|newspaper|magazine|bus depot|airport terminal|airport|railway station|metro station)\\b/i.test(n)) return true;

  // 4. Spot-like nature — checked against NAME + BLURB so famous names
  // without generic keywords ("Charminar", "Victoria Memorial") survive.
  const validKeywords = ['park', 'temple', 'fort', 'beach', 'lake', 'museum', 'monument', 'market', 'ghat', 'garden', 'square', 'road', 'bridge', 'zoo', 'stadium', 'palace', 'church', 'mosque', 'stepwell', 'island', 'hill', 'dam', 'bazaar', 'viewpoint', 'food street', 'walk', 'sanctuary', 'falls', 'waterfalls', 'cave', 'caves', 'stupa', 'ashram', 'tomb', 'mahal', 'memorial', 'shrine', 'basilica', 'synagogue', 'cathedral', 'river', 'statue', 'tower', 'minar'];

  const hasNature = validKeywords.some(kw => hay.includes(kw));
  if (!hasNature) {
    return true;
  }

  return false;
}
'''
src = src[:m.start()] + new_inv + src[m.end():]
print('OK  R3 isInvalidSpot')

# ---------- R4: addSpot passes blurb; category from name+desc ----------
rep('R4 addSpot',
    "    if (name && !/^(file|image|category|special|media|wikipedia):/i.test(name) && !isInvalidSpot(name)) {\n      if (!spotsList.some(s => s.name.toLowerCase() === name.toLowerCase())) {\n        const category = getCategoryForSpot(name).toLowerCase();",
    "    if (name && !/^(file|image|category|special|media|wikipedia):/i.test(name) && !isInvalidSpot(name, desc)) {\n      if (!spotsList.some(s => s.name.toLowerCase() === name.toLowerCase())) {\n        const category = getCategoryForSpot(`${name} ${desc}`).toLowerCase();")

# ---------- R5: OpenSearch fallback (hardened) before honesty-rule block ----------
rep('R5 opensearch',
    "  // Honesty rule: NEVER invent spots.",
    '''  // OpenSearch fallback for the long tail of Indian towns/cities.
  // Hardened: titles must independently look like attractions (checked against
  // the title + Wikipedia's own description, NOT our template text).
  if (spotsList.length < 5) {
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(city)}&limit=12&format=json`;
      const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'SancharAI/1.0' }, signal: AbortSignal.timeout(2500) });
      const searchData = await searchRes.json();
      if (Array.isArray(searchData) && Array.isArray(searchData[1])) {
        const titles: string[] = searchData[1];
        const descriptions: string[] = searchData[2] || [];
        for (let i = 0; i < titles.length; i++) {
          const itemTitle = (titles[i] || '').trim();
          const realDesc = (descriptions[i] || '').trim();
          if (!itemTitle) continue;
          const low = itemTitle.toLowerCase();
          if (low.includes('district') || low.includes('demographics')) continue;
          if (isInvalidSpot(itemTitle, realDesc)) continue;
          addSpot(itemTitle, realDesc || `A notable landmark in ${city}.`);
          if (spotsList.length >= 8) break;
        }
      }
    } catch (err) {
      // ignore
    }
  }

  // Honesty rule: NEVER invent spots.''')

# ---------- R6: extend CITY_CENTERS_MAP ----------
rep('R6 centers',
    "  Guntur: [16.3067, 80.4365],\n  Indore: [22.7196, 75.8577],\n  Nagpur: [21.1458, 79.0882],\n};",
    "  Guntur: [16.3067, 80.4365],\n  Indore: [22.7196, 75.8577],\n  Nagpur: [21.1458, 79.0882],\n  Ooty: [11.4102, 76.6997],\n  Udaipur: [24.5854, 73.7125],\n  Varanasi: [25.3176, 82.9739],\n  Agra: [27.1767, 78.0081],\n  Amritsar: [31.6340, 74.8723],\n  Shimla: [31.1048, 77.1734],\n  Panaji: [15.4909, 73.8278],\n  Mysuru: [12.2958, 76.6394],\n  Madurai: [9.9252, 78.1198],\n  Coimbatore: [11.0168, 76.9558],\n  Pondicherry: [11.9416, 79.8083],\n  Lucknow: [26.8467, 80.9462],\n  Bhopal: [23.2599, 77.4126],\n  Patna: [25.5941, 85.1376],\n  Bhubaneswar: [20.2961, 85.8245],\n};")

# ---------- R7: helpers + version const before curatedSpotsData import ----------
rep('R7 helpers',
    "import { curatedSpotsData } from '../data/spotsData';",
    '''// Cache version for generated city-spot records. Bump when the scraper,
// category engine, or coordinate validation changes so stale/poisoned
// records are purged and regenerated exactly once.
const CITY_SPOTS_CACHE_VERSION = 2;

function haversineKmServer(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

import { curatedSpotsData } from '../data/spotsData';''')

# ---------- R8: version-gated cache read with stale purge ----------
rep('R8 cache gate',
    "  if (cached) {\n    return cached;\n  }",
    '''  // Cache version gate: poisoned/stale records (e.g. wrong-city coordinates
  // cached by older builds) are purged and regenerated exactly once.
  if (cached) {
    if ((cached as any).cacheVersion === CITY_SPOTS_CACHE_VERSION) {
      return cached;
    }
    console.warn(`[WIKI SCRAPER] Purging stale cache v${(cached as any).cacheVersion} for ${city}.`);
    try {
      if (isMemoryFallback) {
        const idx = memoryStore.citySpots.findIndex((c: any) => c.city.toLowerCase() === city.toLowerCase());
        if (idx !== -1) memoryStore.citySpots.splice(idx, 1);
      } else if ((cached as any)._id) {
        await CitySpot.deleteOne({ _id: (cached as any)._id });
      }
    } catch (err) {
      console.warn('Failed to purge stale city spots cache:', err);
    }
  }''')

# ---------- R9: version stamp on writes ----------
rep('R9 empty version', "      source: 'no-verified-data' as const,\n      count: 0,",
    "      source: 'no-verified-data' as const,\n      cacheVersion: CITY_SPOTS_CACHE_VERSION,\n      count: 0,")
rep('R9 record version', "    source: 'wikipedia-live' as const,\n    count: finalSpots.length,",
    "    source: 'wikipedia-live' as const,\n    cacheVersion: CITY_SPOTS_CACHE_VERSION,\n    count: finalSpots.length,")

# ---------- R10: validated coords attach ----------
rep('R10 coords',
    """  // Fetch coordinates concurrently for top 8 spots
  await Promise.allSettled(
    finalSpots.slice(0, 8).map(async (spot) => {
      const coords = await fetchWikiCoordinates(spot.name);
      if (coords) {
        spot.lat = coords.lat;
        spot.lng = coords.lng;
        spot.coords = coords;
      }
    })
  );""",
    """  // Fetch coordinates concurrently for top 8 spots, validated against the
  // known city center (Wikipedia sometimes resolves ambiguous titles to
  // far-away places — never plot a spot >150 km from its city).
  const cityCenter = CITY_CENTERS_MAP[city];
  await Promise.allSettled(
    finalSpots.slice(0, 8).map(async (spot) => {
      const coords = await fetchWikiCoordinates(spot.name);
      if (coords) {
        if (cityCenter) {
          const driftKm = haversineKmServer(cityCenter[0], cityCenter[1], coords.lat, coords.lng);
          if (driftKm > 150) {
            console.warn(`[WIKI SCRAPER] Discarding drifted coords for ${spot.name} (${city}): ${driftKm.toFixed(0)} km from city center.`);
            return;
          }
        }
        spot.lat = coords.lat;
        spot.lng = coords.lng;
        spot.coords = coords;
      }
    })
  );""")

# ---------- R11: upsert save ----------
rep('R11 upsert',
    """  if (isMemoryFallback) {
    memoryStore.citySpots.push(record);
  } else {
    try {
      const doc = new CitySpot(record);
      await doc.save();
    } catch (err) {
      console.warn('Failed to cache generated city spots:', err);
    }
  }""",
    """  if (isMemoryFallback) {
    const mIdx = memoryStore.citySpots.findIndex((c: any) => c.city && c.city.toLowerCase() === city.toLowerCase());
    if (mIdx !== -1) memoryStore.citySpots[mIdx] = record;
    else memoryStore.citySpots.push(record);
  } else {
    try {
      await CitySpot.findOneAndUpdate(
        { city: new RegExp(`^${city}$`, 'i') },
        record,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      console.warn('Failed to cache generated city spots:', err);
    }
  }""")

# ---------- R12: consent $or -> $and (all occurrences) ----------
n_or = src.count('$or: [\n          { analyticsConsent: { $ne: false } },\n          { analyticsConsented: { $ne: false } }\n        ]')
assert n_or >= 1, f'R12: consent $or not found'
src = src.replace('$or: [\n          { analyticsConsent: { $ne: false } },\n          { analyticsConsented: { $ne: false } }\n        ]',
                  '$and: [\n          { analyticsConsent: { $ne: false } },\n          { analyticsConsented: { $ne: false } }\n        ]')
print(f'OK  R12 consent $and ({n_or} occurrence(s))')

# ---------- R13: junk-trip helper + filter ----------
rep('R13 helper', "router.get('/mobility/summary'",
    """// Junk-trip filter: excludes obvious test/seed rows (same-city zero-budget
// trips, end-before-start dates) from PUBLIC analytics. Raw trips stay in DB.
function isJunkTrip(t: any): boolean {
  if (!t) return true;
  const o = (t.originCity || '').toString().trim().toLowerCase();
  const d = (t.destinationCity || '').toString().trim().toLowerCase();
  const budget = Number(t.budget);
  if (o && d && o === d && !(budget > 0)) return true;
  if (t.startTime && t.endTime) {
    const s = new Date(t.startTime).getTime();
    const e = new Date(t.endTime).getTime();
    if (Number.isFinite(s) && Number.isFinite(e) && s > e) return true;
  }
  return false;
}

router.get('/mobility/summary'""")
rep('R13 apply', "    const totalTrips = trips.length;",
    "    trips = trips.filter(t => !isJunkTrip(t));\n    const totalTrips = trips.length;")

# ---------- R14: modeShare one-vote-per-trip ----------
rep('R14 init',
    "    // a. Donut — mode share (walking / road / rail / still)\n    const modeCounts: Record<string, number> = { Walking: 0, Road: 0, Rail: 0, Still: 0 };",
    "    // a. Donut — mode share (walking / road / rail / still / other)\n    const modeCounts: Record<string, number> = { Walking: 0, Road: 0, Rail: 0, Still: 0, Other: 0 };")
rep('R14 loop',
    """    if (Object.values(modeCounts).reduce((a, b) => a + b, 0) === 0 && totalTrips > 0) {
      trips.forEach(t => {
        const mode = (t.transportMode || 'walking').toLowerCase();
        if (mode.includes('train') || mode.includes('rail') || mode.includes('metro')) modeCounts.Rail += 1;
        else if (mode.includes('bus') || mode.includes('cab') || mode.includes('road') || mode.includes('car')) modeCounts.Road += 1;
        else modeCounts.Still += 1;
        modeCounts.Walking += 1;
      });
    }""",
    """    if (Object.values(modeCounts).reduce((a, b) => a + b, 0) === 0 && totalTrips > 0) {
      // Fallback: exactly one vote per trip (the old code added Walking
      // unconditionally, double-counting every trip).
      trips.forEach(t => {
        const mode = (t.transportMode || 'walking').toLowerCase();
        if (mode.includes('train') || mode.includes('rail') || mode.includes('metro')) modeCounts.Rail += 1;
        else if (mode.includes('bus') || mode.includes('cab') || mode.includes('road') || mode.includes('car') || mode.includes('auto') || mode.includes('taxi')) modeCounts.Road += 1;
        else if (mode.includes('still') || mode.includes('stop') || mode.includes('rest')) modeCounts.Still += 1;
        else if (mode.includes('walk') || mode.includes('cycle') || mode.includes('trek') || mode.includes('hik')) modeCounts.Walking += 1;
        else modeCounts.Other += 1;
      });
    }""")

# ---------- R15: real distinct-language count ----------
rep('R15 compute',
    "    const safetyChecksCount = safetyEvents.length;",
    """    const safetyChecksCount = safetyEvents.length;

    // Real distinct-language count from city packs (replaces the old cities*2 estimate).
    let totalLanguages = 0;
    try {
      const langSet = new Set<string>();
      const packs = isMemoryFallback ? (memoryStore.cityPacks || []) : await CityPack.find({}, 'languages');
      packs.forEach((p: any) => (p.languages || []).forEach((l: string) => langSet.add(l)));
      totalLanguages = langSet.size;
    } catch { totalLanguages = 0; }""")
rep('R15 use', "      totalLanguages: Math.max(totalCities * 2, totalCities ? 4 : 0),",
    "      totalLanguages,")

# ---------- R16: honest site-stats ----------
rep('R16 sitestats',
    """    let tripsRecorded = 0;
    let cityPacksLive = 0;
    let languagesSupported = 6;
    let safetyChecks = 0;

    if (isMemoryFallback) {
      tripsRecorded = memoryStore.trips.length;
      cityPacksLive = memoryStore.cityPacks.length;
      safetyChecks = memoryStore.safetyEvents.length;
    } else {
      tripsRecorded = await Trip.countDocuments();
      cityPacksLive = await CityPack.countDocuments();
      safetyChecks = await SafetyEvent.countDocuments();
    }""",
    """    let tripsRecorded = 0;
    let cityPacksLive = 0;
    let languagesSupported = 0;
    let safetyChecks = 0;

    // Same honest filters as /api/mobility/summary: consented + non-junk trips,
    // real distinct languages, safety checks + issue reports combined.
    const consentFilter = (t: any) => t.analyticsConsent !== false && t.analyticsConsented !== false;
    const langSet = new Set<string>();
    if (isMemoryFallback) {
      tripsRecorded = (memoryStore.trips || []).filter((t: any) => consentFilter(t) && !isJunkTrip(t)).length;
      cityPacksLive = (memoryStore.cityPacks || []).length;
      safetyChecks = (memoryStore.safetyEvents || []).length + (memoryStore.issueReports || []).length;
      (memoryStore.cityPacks || []).forEach((p: any) => (p.languages || []).forEach((l: string) => langSet.add(l)));
    } else {
      const trips = await Trip.find({ $and: [{ analyticsConsent: { $ne: false } }, { analyticsConsented: { $ne: false } }] });
      tripsRecorded = trips.filter(t => !isJunkTrip(t)).length;
      cityPacksLive = await CityPack.countDocuments();
      const [safetyCount, reportCount] = await Promise.all([SafetyEvent.countDocuments(), IssueReport.countDocuments()]);
      safetyChecks = safetyCount + reportCount;
      const packs = await CityPack.find({}, 'languages');
      packs.forEach((p: any) => (p.languages || []).forEach((l: string) => langSet.add(l)));
    }
    languagesSupported = langSet.size;""")

open(API, 'w', encoding='utf-8').write(src)
print('SERVER api.ts DONE')

# ---------- curatedCities.ts fare honesty ----------
CC = 'server/src/data/curatedCities.ts'
cc = open(CC, encoding='utf-8').read()
def repcc(old, new):
    global cc
    assert cc.count(old) == 1, f'CC missing: {old[:60]}'
    cc = cc.replace(old, new)
    print(f'OK  CC {old[:50]}...')
repcc('transportGuidance: "Typical auto fare 3-6 km: ₹120-₹250 - confirm with driver. Metro available for longer routes.",',
      'transportGuidance: "Autos run on meter: ₹25 for the first 1.8 km + ₹12/km (TN tariff) — insist on meter. Metro available for longer routes.",')
repcc('transportGuidance: "Ferries are a fast way to cross between Fort Kochi and Ernakulam. Auto fare: ₹30 base + ₹15/km.",',
      'transportGuidance: "Ferries are a fast way to cross between Fort Kochi and Ernakulam. Autos are metered — insist on meter and confirm fare before boarding.",')
repcc('transportGuidance: "Traffic can be heavy. Use Namma Metro when possible. Auto fare: ₹30 base + ₹15/km.",',
      'transportGuidance: "Traffic can be heavy. Use Namma Metro when possible. Auto fare: ₹36 for 2 km + ₹18/km (Bengaluru RTA order Jul 2025).",')
repcc('transportGuidance: "MMTS local trains connect key areas. Hyderabad Metro runs key corridors. Auto fare: ₹25 base + ₹12/km.",',
      'transportGuidance: "MMTS local trains connect key areas. Hyderabad Metro runs key corridors. Auto fare: ₹20 for 1.6 km + ₹11/km (2014 tariff; revision proposed Sep 2026, pending approval).",')
repcc('Auto ₹25 base + ₹10/km.', 'Auto roughly ₹25 base + ₹10/km (indicative — meters vary).')
open(CC, 'w', encoding='utf-8').write(cc)
print('CURATED CITIES DONE')

# ---------- generatedSpots.json: mosque mislabel ----------
GJ = 'server/src/data/generatedSpots.json'
gj = json.load(open(GJ, encoding='utf-8'))
cats = set()
def walk(o):
    if isinstance(o, dict):
        if 'category' in o and isinstance(o['category'], str): cats.add(o['category'])
        for v in o.values(): walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
walk(gj)
print('categories in use:', sorted(cats))
fixed = 0
def fix(o):
    global fixed
    if isinstance(o, dict):
        if o.get('name') == 'Mecca Masjid' and o.get('category') == 'temple':
            o['category'] = 'mosque' if 'mosque' in cats else ('heritage' if 'heritage' in cats else 'monument')
            fixed += 1
        for v in o.values(): fix(v)
    elif isinstance(o, list):
        for v in o: fix(v)
fix(gj)
assert fixed == 1, f'Mecca fix count {fixed}'
json.dump(gj, open(GJ, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print(f'MECCA -> done')
