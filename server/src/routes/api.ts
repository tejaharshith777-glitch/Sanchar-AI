import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Trip, LocationPoint, JourneySegment, Expense, CityPack, SafetyEvent, MobilityAggregate, PilotSignup, CitySpot, IdempotencyKey, LuggageSpot, LuggageCheckIn, User } from '../models';
import { isMemoryFallback, memoryStore } from '../services/db';
import { processTripPrivacySync } from '../services/privacy';

const router = Router();

// Rate limiter for API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // Limit each IP to 1000 requests per windowMs
});
router.use(apiLimiter);

// Helper to generate IDs for memory store objects
const generateId = () => 'mem_' + Math.random().toString(36).substring(2, 11);

async function checkIdempotency(key: string): Promise<any | null> {
  if (!key) return null;
  if (isMemoryFallback) {
    const existing = memoryStore.idempotencyKeys.find(ik => ik.key === key);
    return existing ? existing.response : null;
  } else {
    const existing = await IdempotencyKey.findOne({ key });
    return existing ? existing.response : null;
  }
}

async function saveIdempotency(key: string, responseData: any): Promise<void> {
  if (!key) return;
  if (isMemoryFallback) {
    memoryStore.idempotencyKeys.push({ key, response: responseData, createdAt: new Date() });
  } else {
    try {
      const doc = new IdempotencyKey({ key, response: responseData });
      await doc.save();
    } catch {
      // Key may already exist
    }
  }
}

async function recalculateTripBudget(tripId: string): Promise<number> {
  let totalSpent = 0;
  if (isMemoryFallback) {
    const tripExpenses = memoryStore.expenses.filter(e => String(e.tripId) === String(tripId));
    totalSpent = tripExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const trip = memoryStore.trips.find(t => String(t._id) === String(tripId));
    if (trip) {
      trip.amountSpent = totalSpent;
    }
  } else {
    const tripExpenses = await Expense.find({ tripId });
    totalSpent = tripExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    await Trip.findByIdAndUpdate(tripId, { amountSpent: totalSpent });
  }
  return totalSpent;
}

// ---------------------------
// HEALTH & UTILS
// ---------------------------
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    db: isMemoryFallback ? 'memory' : 'atlas',
    timestamp: new Date()
  });
});

router.get('/cities', (req, res) => {
  res.json({
    cities: [
      "Chennai", "Coimbatore", "Madurai", "Kochi", "Bengaluru",
      "Mumbai", "Pune", "Delhi", "Jaipur", "Kolkata",
      "Bhubaneswar", "Ahmedabad", "Guwahati", "Varanasi", "Other City"
    ]
  });
});

router.get('/city-packs/:city', async (req, res) => {
  try {
    const city = normalizeCityName(req.params.city);
    if (!city) {
      return res.status(400).json({ error: 'City parameter is required.' });
    }

    // 1. Get or create spots for this city via Wikipedia live engine
    const spotRecord = await getOrCreateCitySpots(city);
    
    // 2. Find CityPack or use general default fallback
    let pack: any = null;
    if (isMemoryFallback) {
      pack = memoryStore.cityPacks.find(p => p.city.toLowerCase() === city.toLowerCase());
      if (!pack) {
        const defaultPack = memoryStore.cityPacks.find(p => p.city === 'default');
        pack = defaultPack ? { ...defaultPack, city } : null;
      }
    } else {
      const dbPack = await CityPack.findOne({ city: new RegExp(`^${city}$`, 'i') });
      if (dbPack) {
        pack = dbPack.toObject();
      } else {
        const defaultPack = await CityPack.findOne({ city: 'default' });
        if (defaultPack) {
          pack = defaultPack.toObject();
          pack.city = city;
        }
      }
    }

    if (!pack) {
      pack = {
        city,
        languages: ["English", "Hindi"],
        emergencyNumbers: [
          { label: "National Emergency", number: "112" },
          { label: "Railway Helpline", number: "139" }
        ],
        transportGuidance: "General India guidance. Always confirm auto/taxi fares before boarding.",
        phrases: [
          { en: "Please help me.", local: "कृपया मेरी मदद करें।", localLang: "Hindi" },
          { en: "Where is the station?", local: "स्टेशन कहाँ है?", localLang: "Hindi" }
        ],
        contentStatus: "generic-fallback"
      };
    }

    const spots = spotRecord ? spotRecord.spots : [];
    const source = spotRecord ? spotRecord.source : 'wikipedia-live';
    const spotCount = spotRecord ? spotRecord.count : 0;

    res.json({
      ...pack,
      spots,
      source,
      spotCount
    });
  } catch (error) {
    console.error('Error fetching city pack:', error);
    res.status(500).json({ error: 'Server error fetching city pack.' });
  }
});

// ---------------------------
// CITY SPOTLIGHT (GET /api/city-spots/:city)
// ---------------------------

const CURATED_CITY_SPOTS: Record<string, string[]> = {
  "Chennai": [
    "Marina Beach", "Marina Lighthouse", "Marina Drive", "Besant Nagar Beach", "Elliot's Beach (Mylapore)",
    "Kapaleeshwarar Temple (Mylapore)", "Parthasarathy Temple (Triplicane)", "Sri Mariamman Temple (Chetpet)",
    "San Thome Basilica", "Fort St. George", "Chennai Central station", "Ripon Building (Government Museum)",
    "Chennai Art Gallery", "Birla Planetarium", "Vandalur Zoo", "Guindy National Park", "Crocodile Bank (Perambur)",
    "Mahabalipuram UNESCO temples (day trip)", "Ouzhal Waterfalls (day trip)", "T. Nagar Commercial Street",
    "Gandhi Market (Mylapore)", "Royapettah market", "Chepauk", "Beach Road street food", "The Cantonment"
  ],
  "Kochi": [
    "Chinese Fishing Nets (Fort Kochi)", "Fort Kochi Beach", "Mattancherry Beach", "Mattancherry Palace",
    "Santa Cruz Basilica", "St. Francis Church", "Paradesi Synagogue (Jew Town)", "Jew Town bazaar",
    "Bolgatty Island", "Vypin Island", "Vypin View Tower", "Willingdon Island", "Marine Drive",
    "Kathakali night performance", "Kochi-Muziris heritage walk", "Napier Museum (Ernakulam)",
    "Kuzhimali Beach", "Palarivattom lagoon", "Aluva backwaters (houseboat)", "Cherthala old port",
    "Chavara Beach (day trip)", "Ernakulam Cathedral", "Fort Kochi seafood shacks", "Punnamada lake (Ernakulam)",
    "Cochin Shipyard waterfront"
  ],
  "Hyderabad": [
    "Charminar", "Laad Bazaar", "Gol Gumbaz", "Qutb Shahi Tombs", "Chowmahalla Palace",
    "Salar Jung Museum", "Falaknuma Palace", "Hussain Sagar Lake", "Buddha Statue (Hussain Sagar island)",
    "Lotus Temple", "Birla Mandir", "Durgamma Temple (Kukatpally)", "Ramoji Film City", "Lumbini Hills Park",
    "Necklace Road", "Tank Bund", "Ibrahim Bagh", "Old City snack crawl (Chowk Bazaar)",
    "Paradise Restaurant (heritage)", "Ameerpet market", "Abids", "Gachibowli district lakes",
    "Dilsuknagar food hub", "Tolichowki (old-city bazaars)", "Old city heritage walk"
  ],
  "Bengaluru": [
    "Cubbon Park", "Lalbagh Botanical Garden", "Bangalore Palace", "Vidhana Soudha",
    "Tipu Sultan's Summer Palace", "ISKCON Temple", "Jakkur Lake (bird sanctuary)", "Sankey Tank",
    "Hebbal Clock Tower", "MG Road", "Brigade Road", "Church Street heritage lanes",
    "Bannerghatta Biological Park", "Nandi Hills (day trip)", "Mysore Palace (day trip)",
    "Srirangapatna (day trip)", "Bangalore Zoo (Bangaloresuru)", "Kempe Gowda I Memorial Park",
    "UB City", "Coromandel Lane", "Indiranagar 100 Feet Road", "Malleshwaram (St. Mary's Basilica)",
    "Mantri Square", "Basavanagudi Fort", "Hesaraghatta Dam"
  ],
  "Mumbai": [
    "Gateway of India", "Marine Drive", "Colaba Causeway", "Elephanta Caves (ferry)", "Juhu Beach",
    "Chowpatty", "Bandra-Worli Sea Link", "Haji Ali Dargah", "Sanjay Gandhi National Park",
    "Bollywood & Film City", "Bandstand (Bandra)", "Worli Sea Face", "Carter Road",
    "Prabhadev (Marine Lines promenade)", "Dadar Station (heritage)", "Flora Fountain",
    "Chhatrapati Shivaji Terminus (CST)", "Prince of Wales Museum", "Siddhivinayak Temple",
    "Kala Ghoda art district", "Mahalaxmi Racecourse", "Bhuleshwar Temple", "Grant Road heritage lanes",
    "Dahanukar Circle (street food)", "BKC Bandra Kurla Complex"
  ],
  "Jaipur": [
    "Amber Fort", "City Palace", "Hawa Mahal", "Jantar Mantar", "Nahargarh Fort", "Jal Mahal",
    "Govind Dev Ji Temple", "Albert Hall Museum", "Central Museum", "Birla Mandir",
    "Chokhi Dhani (village experience)", "Panna Meena Ka Kund", "Ton Sahib Ni Baori stepwell",
    "Jaipur observatory area", "Johari Bazaar", "Bapu Bazaar", "MI Road (M.I. Road)",
    "Anokhi museum", "Galta Ji Temple (Monkey Temple)", "Jaigarh Fort", "Birla Planetarium",
    "City viewpoint and photo stop", "Old city food walk", "City heritage walk", "Evening promenade (local lanes)"
  ],
  "Varanasi": [
    "Dashashwamedh Ghat", "Kashi Vishwanath Temple", "Manikarnika Ghat", "Assi Ghat",
    "Sarnath Buddhist Site", "Dhamek Stupa (Sarnath)", "Chaukhandi Stupa (Sarnath)",
    "Sarnath Archaeological Museum", "Banaras Hindu University (BHU)", "New Vishwanath Temple (VT)",
    "Bharat Kala Bhavan", "Ramnagar Fort", "Tulsi Manas Mandir", "Durga Mandir (Durga Kund)",
    "Sankat Mochan Hanuman Temple", "Harishchandra Ghat", "Scindia Ghat", "Lalita Ghat",
    "Kedar Ghat", "Panchganga Ghat", "Darbhanga Ghat", "Ganga Aarti riverfront",
    "Godowlia Crossing bazaar", "Tibetan Temple (Sarnath)", "Vindhyachal (day trip)"
  ],
  "Guwahati": [
    "Kamakhya Temple (Nilachal Hills)", "Umananda Temple (Peacock Island)", "Brahmaputra River Cruise",
    "Assam State Museum", "Guwahati Zoo (Assam State Zoo)", "Srimanta Sankaradev Kalakshetra",
    "Regional Science Centre (Guwahati)", "Nehru Park (Guwahati)", "Dighalipukhuri Lake",
    "Navagraha Temple (Chitrachal Hill)", "Basistha Ashram Temple", "Sukreswar Temple",
    "Purva Tirupati Sri Balaji Temple", "Guwahati Planetarium", "Pobitora Wildlife Sanctuary (day trip)",
    "Hajo pilgrimage site (day trip)", "Madan Kamdev ruins (day trip)", "Chandubi Lake (day trip)",
    "Dipor Bil (bird sanctuary)", "Guwahati War Memorial", "Lankeshwar Temple",
    "Fancy Bazaar market", "Paltan Bazaar market", "Brahmaputra Heritage Centre", "Saraighat Bridge viewpoint"
  ]
};

function getCategoryForSpot(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('temple') || n.includes('mandir') || n.includes('church') || n.includes('mosque') || n.includes('basilica') || n.includes('synagogue') || n.includes('dargah') || n.includes('gurudwara') || n.includes('cathedral') || n.includes('stupa') || n.includes('deekshabhoomi') || n.includes('ashram')) {
    return 'Temple';
  }
  if (n.includes('fort') || n.includes('palace') || n.includes('castle') || n.includes('monument') || n.includes('tomb') || n.includes('mahal') || n.includes('ruins')) {
    return 'Fort';
  }
  if (n.includes('beach') || n.includes('island') || n.includes('lake') || n.includes('dam') || n.includes('tank') || n.includes('lagoon') || n.includes('backwaters') || n.includes('falls') || n.includes('waterfalls') || n.includes('bil') || n.includes('river')) {
    return 'Beach';
  }
  if (n.includes('museum') || n.includes('gallery') || n.includes('science') || n.includes('planetarium') || n.includes('art')) {
    return 'Museum';
  }
  if (n.includes('park') || n.includes('zoo') || n.includes('garden') || n.includes('sanctuary') || n.includes('forest') || n.includes('hills') || n.includes('hill')) {
    return 'Park';
  }
  if (n.includes('bazaar') || n.includes('market') || n.includes('street') || n.includes('shopping') || n.includes('mall') || n.includes('square') || n.includes('chowk')) {
    return 'Market';
  }
  if (n.includes('restaurant') || n.includes('food') || n.includes('shack') || n.includes('cuisine') || n.includes('snack') || n.includes('café') || n.includes('cafe')) {
    return 'Food';
  }
  if (n.includes('view') || n.includes('viewpoint') || n.includes('drive') || n.includes('sea face') || n.includes('link') || n.includes('promenade') || n.includes('bridge') || n.includes('ganges aarti') || n.includes('ghat')) {
    return 'Viewpoint';
  }
  if (n.includes('day trip') || n.includes('excursion') || n.includes('pilgrimage') || n.includes('hajo') || n.includes('pobitora') || n.includes('mahabalipuram') || n.includes('mysore') || n.includes('srirangapatna')) {
    return 'Day trip';
  }
  return '';
}

function getCuratedBlurbForSpot(name: string, category: string, city: string): string {
  switch (category) {
    case 'Temple': return `A sacred spiritual temple and architectural wonder in ${city}.`;
    case 'Beach': return `A scenic waterfront attraction offering beautiful views and relaxation in ${city}.`;
    case 'Museum': return `A repository of history, art, and cultural heritage in ${city}.`;
    case 'Park': return `A lush green park and scenic natural retreat in ${city}.`;
    case 'Market': return `A bustling local marketplace famous for shopping and souvenirs in ${city}.`;
    case 'Food': return `A popular culinary hotspot for authentic local delicacies in ${city}.`;
    case 'Viewpoint': return `An iconic viewpoint offering panoramic cityscapes and scenery in ${city}.`;
    case 'Day trip': return `A beautiful getaway destination perfect for a day trip near ${city}.`;
    default: return `A famous historical monument and heritage landmark in ${city}.`;
  }
}

function isInvalidSpot(name: string): boolean {
  const n = name.toLowerCase();
  
  // 1. Is a person
  if (/\((actor|singer|chess player|politician|writer|director|producer|musician|cricketer|athlete|scientist)\)/i.test(n) || n.includes('born in')) return true;
  
  // 2. Is an administrative entity
  if (n.includes('municipal corporation') || n.includes('city corporation') || n.includes('region') || n.includes('district') || n.includes('urban agglomeration') || n.includes('mandal') || n.includes('panchayat')) return true;
  
  // 3. Media / infrastructure
  if (/\b(fm|radio|am station|television|tv channel|newspaper|magazine|bus depot|airport terminal|airport|railway station)\b/i.test(n)) return true;
  
  // 4. Spot-like nature
  const validKeywords = ['park', 'temple', 'fort', 'beach', 'lake', 'museum', 'monument', 'market', 'ghat', 'garden', 'square', 'road', 'bridge', 'zoo', 'stadium', 'palace', 'church', 'mosque', 'stepwell', 'island', 'hill', 'dam', 'bazaar', 'viewpoint', 'food street', 'walk', 'sanctuary', 'falls', 'waterfalls', 'cave', 'caves', 'stupa', 'ashram', 'tomb', 'mahal', 'memorial', 'shrine', 'basilica', 'synagogue', 'cathedral', 'river'];
  
  const hasNature = validKeywords.some(kw => n.includes(kw));
  if (!hasNature) {
    return true;
  }
  
  return false;
}

const CITY_CENTERS_MAP: Record<string, [number, number]> = {
  Chennai: [13.0827, 80.2707],
  Kochi: [9.9312, 76.2673],
  Bengaluru: [12.9716, 77.5946],
  Mumbai: [18.9750, 72.8258],
  Delhi: [28.6139, 77.2090],
  Kolkata: [22.5726, 88.3639],
  Hyderabad: [17.3850, 78.4867],
  Jaipur: [26.9124, 75.7873],
  Guntur: [16.3067, 80.4365],
  Indore: [22.7196, 75.8577],
  Nagpur: [21.1458, 79.0882],
};

function normalizeCityName(str: string): string {
  if (!str) return '';
  const trimmed = str.trim();
  return trimmed.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

async function fetchWikiCoordinates(spotName: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=coordinates&format=json&titles=${encodeURIComponent(spotName)}&redirects=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'SancharAI/1.0' } });
    const data = await res.json();
    if (data.query && data.query.pages) {
      const pages = data.query.pages;
      const pageId = Object.keys(pages)[0];
      if (pageId && pages[pageId].coordinates && pages[pageId].coordinates[0]) {
        const coords = pages[pageId].coordinates[0];
        return { lat: coords.lat, lng: coords.lon };
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch coordinates for ${spotName}:`, err);
  }
  return null;
}

import { curatedSpotsData } from '../data/spotsData';

async function getOrCreateCitySpots(cityName: string): Promise<any> {
  const city = normalizeCityName(cityName);
  if (!city) return null;

  // 1. Check Curated static first
  const curated = curatedSpotsData[city];
  if (curated) {
    return {
      city,
      source: 'curated-sample' as const,
      count: curated.length,
      spots: curated,
      fetchedAt: new Date()
    };
  }

  // 2. Check Database/Memory Cache
  let cached: any = null;
  if (isMemoryFallback) {
    cached = memoryStore.citySpots.find(c => c.city.toLowerCase() === city.toLowerCase());
  } else {
    cached = await CitySpot.findOne({ city: new RegExp(`^${city}$`, 'i') });
  }

  if (cached) {
    return cached;
  }

  // 3. Wikipedia Live attraction scraper
  console.log(`[WIKI SCRAPER] Fetching tourist spots for ${city}...`);
  const listTitlesToTry = [
    `List of tourist attractions in ${city}`,
    `Tourist attractions in ${city}`,
    `Places of interest in ${city}`,
    `Tourism in ${city}`
  ];

  let wikitext = '';
  const spotsList: any[] = [];

  const cleanDesc = (desc: string) => {
    let d = desc.trim();
    d = d.replace(/^''':?\s*/, '');
    if (d.startsWith('-') || d.startsWith('–') || d.startsWith(':') || d.startsWith(',')) {
      d = d.substring(1).trim();
    }
    d = d.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');
    d = d.replace(/\{\{.*?\}\}/g, '');
    d = d.replace(/<ref.*?>.*?<\/ref>/g, '');
    d = d.replace(/<.*?>/g, '');
    return d;
  };

  const addSpot = (name: string, desc: string) => {
    if (name && !/^(file|image|category|special|media|wikipedia):/i.test(name) && !isInvalidSpot(name)) {
      if (!spotsList.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        const category = getCategoryForSpot(name).toLowerCase();
        spotsList.push({
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          category: category || 'monument',
          blurb: cleanDesc(desc) || `A real tourist attraction in ${city}.`,
          bestThing: `Discovering the historic charm of ${name}.`,
          bestTime: '—',
          timeToSpend: '—',
          entryCost: '—',
          nearTransport: '—',
          tips: ['—'],
          image: '',
          source: 'wikipedia-live'
        });
      }
    }
  };

  for (const title of listTitlesToTry) {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&redirects=1`;
      const wikiRes = await fetch(url, { headers: { 'User-Agent': 'SancharAI/1.0' } });
      const data = await wikiRes.json();
      if (data.parse && data.parse.wikitext) {
        wikitext = data.parse.wikitext['*'];
        const lines = wikitext.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          const match = trimmed.match(/^\*\s*(?:'''''|'''|'')?\[\[(.*?)\]\](.*)/) || trimmed.match(/^\*\s*\{\{.*?\}\}\s*(?:'''''|'''|'')?\[\[(.*?)\]\](.*)/) || trimmed.match(/^#\s*(?:'''''|'''|'')?\[\[(.*?)\]\](.*)/);
          if (match) {
            const parts = match[1].split('|');
            const name = parts[0].split('#')[0].trim();
            addSpot(name, match[2]);
          }
        }
        if (spotsList.length >= 8) break;
      }
    } catch (err) {
      // ignore
    }
  }

  // Fallback to Wikipedia Category API if spotsList is still sparse
  if (spotsList.length < 5) {
    try {
      const catUrl = `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:Tourist_attractions_in_${encodeURIComponent(city)}&cmlimit=25&cmtype=page&format=json`;
      const catRes = await fetch(catUrl, { headers: { 'User-Agent': 'SancharAI/1.0' } });
      const catData = await catRes.json();
      if (catData.query && catData.query.categorymembers) {
        for (const member of catData.query.categorymembers) {
          addSpot(member.title, `A verified tourist attraction in ${city}.`);
        }
      }
    } catch (err) {
      // ignore
    }
  }

  const finalSpots = spotsList.slice(0, 25);

  // Fetch coordinates for real spots
  const center = CITY_CENTERS_MAP[city] || [16.3067, 80.4365];
  for (let i = 0; i < Math.min(finalSpots.length, 12); i++) {
    const spot = finalSpots[i];
    const coords = await fetchWikiCoordinates(spot.name);
    if (coords) {
      spot.lat = coords.lat;
      spot.lng = coords.lng;
      spot.coords = coords;
    } else {
      spot.lat = center[0] + (Math.random() - 0.5) * 0.04;
      spot.lng = center[1] + (Math.random() - 0.5) * 0.04;
    }
  }

  const record = {
    city,
    source: 'wikipedia-live' as const,
    count: finalSpots.length,
    spots: finalSpots,
    fetchedAt: new Date()
  };

  if (isMemoryFallback) {
    memoryStore.citySpots.push(record);
  } else {
    try {
      const doc = new CitySpot(record);
      await doc.save();
    } catch (err) {
      console.warn('Failed to cache generated city spots:', err);
    }
  }

  return record;
}

// 1. GET /api/city-spots/:city (Legacy support)
router.get('/city-spots/:city', async (req, res) => {
  try {
    const city = normalizeCityName(req.params.city);
    if (!city) {
      return res.status(400).json({ error: 'City parameter is required.' });
    }
    const spots = await getOrCreateCitySpots(city);
    res.json(spots || { found: false, spots: [], source: 'wikipedia-live', count: 0 });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. GET /api/spots/:city/:slug (Individual Spot Detail)
router.get('/spots/:city/:slug', async (req, res) => {
  try {
    const city = normalizeCityName(req.params.city);
    const slug = req.params.slug.trim().toLowerCase();

    const spotRecord = await getOrCreateCitySpots(city);
    if (!spotRecord || !spotRecord.spots) {
      return res.status(404).json({ error: 'City pack not found.' });
    }

    const spot = spotRecord.spots.find((s: any) => (s.slug || '').toLowerCase() === slug || s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === slug);
    if (!spot) {
      return res.status(404).json({ error: 'Spot not found.' });
    }

    res.json(spot);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching spot details.' });
  }
});

// 3. GET /api/luggage-spots (Luggage Radar search)
router.get('/luggage-spots', async (req, res) => {
  try {
    const city = req.query.city ? normalizeCityName(req.query.city as string) : '';
    if (!city) {
      return res.status(400).json({ error: 'City query parameter is required.' });
    }

    let spots: any[] = [];
    if (isMemoryFallback) {
      spots = memoryStore.luggageSpots.filter(s => s.city.toLowerCase() === city.toLowerCase());
    } else {
      spots = await LuggageSpot.find({ city: new RegExp(`^${city}$`, 'i') });
    }

    // Compute status based on last 24h checkins
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cutoff2h = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const finalSpots = [];
    for (const spot of spots) {
      const spotObj = typeof spot.toObject === 'function' ? spot.toObject() : { ...spot };
      let checkins: any[] = [];

      if (isMemoryFallback) {
        checkins = memoryStore.luggageCheckIns.filter(c => String(c.spotId) === String(spotObj._id) && c.createdAt >= cutoff24h);
      } else {
        checkins = await LuggageCheckIn.find({ spotId: spotObj._id, createdAt: { $gte: cutoff24h } });
      }

      const reportCount = checkins.length;
      let status = 'No reports yet — be the first to report';

      if (reportCount > 0) {
        const recentFull = checkins.some(c => c.status === 'full' && c.createdAt >= cutoff2h);
        if (recentFull) {
          status = 'Full';
        } else {
          const fullCount = checkins.filter(c => c.status === 'full').length;
          const limitedCount = checkins.filter(c => c.status === 'limited').length;
          const availableCount = checkins.filter(c => c.status === 'available').length;

          if (fullCount > 0 && availableCount > 0) {
            status = 'Limited';
          } else if (limitedCount > availableCount) {
            status = 'Limited';
          } else {
            status = 'High availability';
          }
        }
      }

      finalSpots.push({
        ...spotObj,
        status,
        reportCount
      });
    }

    res.json(finalSpots);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching luggage spots.' });
  }
});

// Rate-limiter for checkins: max 5 requests per hour per IP
const checkinLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Rate limit exceeded. Maximum 5 reports per hour.' }
});

// 4. POST /api/luggage-spots/:id/checkin (Report availability)
router.post('/luggage-spots/:id/checkin', checkinLimiter, async (req, res) => {
  try {
    const spotId = req.params.id;
    const { status } = req.body;
    if (!status || !['full', 'limited', 'available'].includes(status)) {
      return res.status(400).json({ error: 'Invalid check-in status.' });
    }

    if (isMemoryFallback) {
      const record = {
        _id: generateId(),
        spotId: spotId as any,
        status: status as any,
        createdAt: new Date()
      };
      memoryStore.luggageCheckIns.push(record);
    } else {
      const checkin = new LuggageCheckIn({ spotId, status });
      await checkin.save();
    }

    res.json({ success: true, message: 'Thank you for reporting!' });
  } catch (error) {
    res.status(500).json({ error: 'Server error processing check-in.' });
  }
});

// ---------------------------
// SITE STATISTICS (GET /api/site-stats)
// ---------------------------
router.get('/site-stats', async (req, res) => {
  try {
    let tripsRecorded = 0;
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
    }

    res.json({
      tripsRecorded,
      cityPacksLive,
      languagesSupported,
      safetyChecks
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch site statistics' });
  }
});

// ---------------------------
// PILOT SIGNUPS (POST /api/pilot-signups)
// ---------------------------
router.post('/pilot-signups', async (req, res) => {
  try {
    const { name, email, city, feedback } = req.body;
    if (!name || !city) {
      return res.status(400).json({ error: 'Name and City are required fields.' });
    }

    let totalSignups = 0;

    if (isMemoryFallback) {
      const record = {
        _id: generateId(),
        name,
        email,
        city,
        feedback,
        createdAt: new Date()
      };
      memoryStore.pilotSignups.push(record);
      totalSignups = memoryStore.pilotSignups.length;
    } else {
      const signup = new PilotSignup({ name, email, city, feedback });
      await signup.save();
      totalSignups = await PilotSignup.countDocuments();
    }

    res.status(201).json({
      success: true,
      message: "You're on the list",
      count: totalSignups
    });
  } catch (error) {
    res.status(500).json({ error: "Couldn't save — try again" });
  }
});

// ---------------------------
// TRIPS
// ---------------------------
router.post('/trips', async (req, res) => {
  try {
    const tripData = {
      ...req.body,
      expectedArrival: req.body.expectedArrival ? new Date(req.body.expectedArrival) : null,
      lastLateArrivalTriggerAt: null,
      lastRouteDeviationTriggerAt: null
    };

    if (isMemoryFallback) {
      const trip = {
        _id: generateId(),
        ...tripData,
        status: req.body.status || 'created',
        amountSpent: 0,
        createdAt: new Date()
      };
      memoryStore.trips.push(trip);
      return res.status(201).json(trip);
    }

    const trip = new Trip(tripData);
    await trip.save();
    res.status(201).json(trip);
  } catch (error) {
    res.status(400).json({ error: 'Invalid trip data' });
  }
});

router.get('/trips', async (req, res) => {
  try {
    if (isMemoryFallback) {
      return res.json(memoryStore.trips);
    }
    const trips = await Trip.find().sort({ createdAt: -1 });
    res.json(trips);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/trips/active', async (req, res) => {
  try {
    if (isMemoryFallback) {
      const activeTrip = memoryStore.trips.find(t => t.status === 'active');
      return res.json(activeTrip || { message: 'No active trip' });
    }
    const activeTrip = await Trip.findOne({ status: 'active' });
    if (!activeTrip) {
      return res.json({ message: 'No active trip' });
    }
    res.json(activeTrip);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/trips/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMemoryFallback) {
      const trip = memoryStore.trips.find(t => t._id === id);
      if (!trip) return res.status(404).json({ error: 'Trip not found' });
      return res.json(trip);
    }

    const trip = await Trip.findById(id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/trips/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMemoryFallback) {
      const tripIdx = memoryStore.trips.findIndex(t => t._id === id);
      if (tripIdx === -1) return res.status(404).json({ error: 'Trip not found' });
      memoryStore.trips[tripIdx] = { ...memoryStore.trips[tripIdx], ...req.body };
      return res.json(memoryStore.trips[tripIdx]);
    }

    const trip = await Trip.findByIdAndUpdate(id, req.body, { new: true });
    res.json(trip);
  } catch (error) {
    res.status(400).json({ error: 'Invalid update' });
  }
});

router.post('/trips/:id/start', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMemoryFallback) {
      const tripIdx = memoryStore.trips.findIndex(t => t._id === id);
      if (tripIdx === -1) return res.status(404).json({ error: 'Trip not found' });
      memoryStore.trips[tripIdx].status = 'active';
      memoryStore.trips[tripIdx].startTime = new Date();
      return res.json(memoryStore.trips[tripIdx]);
    }

    const trip = await Trip.findByIdAndUpdate(id, { status: 'active', startTime: new Date() }, { new: true });
    res.json(trip);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/trips/:id/complete', async (req, res) => {
  try {
    const key = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string;
    const cached = await checkIdempotency(key);
    if (cached) return res.json(cached);

    const id = req.params.id;
    let completedTrip: any = null;

    if (isMemoryFallback) {
      const tripIdx = memoryStore.trips.findIndex(t => String(t._id) === String(id));
      if (tripIdx === -1) return res.status(404).json({ error: 'Trip not found' });
      memoryStore.trips[tripIdx].status = 'completed';
      memoryStore.trips[tripIdx].endTime = new Date();
      completedTrip = memoryStore.trips[tripIdx];
    } else {
      completedTrip = await Trip.findByIdAndUpdate(id, { status: 'completed', endTime: new Date() }, { new: true });
    }

    if (completedTrip && completedTrip.analyticsConsent) {
      if (isMemoryFallback) {
        memoryStore.mobilityAggregates.push({
          city: completedTrip.destinationCity,
          areaCell: 'mem_geohash_' + Math.random().toString(36).substring(2, 5),
          timeBucket: new Date(),
          modeCategory: 'road',
          anonymousTripCount: 1,
          issueCounts: new Map()
        });
      } else {
        await processTripPrivacySync(completedTrip.id, completedTrip.destinationCity);
      }
    }

    await saveIdempotency(key, completedTrip);
    res.json(completedTrip);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/trips/:id/points', async (req, res) => {
  try {
    const points = await LocationPoint.find({ tripId: req.params.id }).sort({ timestamp: 1 });
    res.json(points);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/trips/:id/points', async (req, res) => {
  try {
    const key = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string;
    const cached = await checkIdempotency(key);
    if (cached) return res.status(201).json(cached);

    const id = req.params.id;
    const { points } = req.body;
    const pointsWithTrip = (points || []).map((p: any) => ({
      _id: p.id || generateId(),
      ...p,
      tripId: id,
      timestamp: p.timestamp ? new Date(p.timestamp) : new Date()
    }));

    if (isMemoryFallback) {
      for (const p of pointsWithTrip) {
        if (!memoryStore.locationPoints.some(existing => existing._id === p._id)) {
          memoryStore.locationPoints.push(p);
        }
      }
    } else {
      for (const p of pointsWithTrip) {
        try {
          await LocationPoint.updateOne({ _id: p._id }, { $setOnInsert: p }, { upsert: true });
        } catch {
          // Ignore duplicate insertion
        }
      }
    }

    const response = { success: true, count: pointsWithTrip.length };
    await saveIdempotency(key, response);
    res.status(201).json(response);
  } catch (error) {
    res.status(400).json({ error: 'Invalid points' });
  }
});
// ---------------------------
// SAFETY EVENTS
// ---------------------------
router.post('/trips/:id/safety-events', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMemoryFallback) {
      const event = {
        _id: generateId(),
        ...req.body,
        tripId: id,
        triggeredAt: new Date()
      };
      memoryStore.safetyEvents.push(event);
      return res.status(201).json(event);
    }

    const event = new SafetyEvent({ ...req.body, tripId: id, triggeredAt: new Date() });
    await event.save();
    res.status(201).json(event);
  } catch (error) {
    res.status(400).json({ error: 'Invalid safety event' });
  }
});

// ---------------------------
// SEGMENTS
// ---------------------------
router.post('/trips/:id/segments', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMemoryFallback) {
      const segment = {
        _id: generateId(),
        ...req.body,
        tripId: id,
        startTime: req.body.startTime ? new Date(req.body.startTime) : new Date()
      };
      memoryStore.journeySegments.push(segment);
      return res.status(201).json(segment);
    }

    const segment = new JourneySegment({ ...req.body, tripId: id });
    await segment.save();
    res.status(201).json(segment);
  } catch (error) {
    res.status(400).json({ error: 'Invalid segment' });
  }
});

router.patch('/segments/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMemoryFallback) {
      const segIdx = memoryStore.journeySegments.findIndex(s => s._id === id);
      if (segIdx === -1) return res.status(404).json({ error: 'Segment not found' });
      memoryStore.journeySegments[segIdx] = { ...memoryStore.journeySegments[segIdx], ...req.body };
      return res.json(memoryStore.journeySegments[segIdx]);
    }

    const segment = await JourneySegment.findByIdAndUpdate(id, req.body, { new: true });
    res.json(segment);
  } catch (error) {
    res.status(400).json({ error: 'Invalid update' });
  }
});

// ---------------------------
// EXPENSES
// ---------------------------
router.post('/trips/:id/expenses', async (req, res) => {
  try {
    const key = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string;
    const cached = await checkIdempotency(key);
    if (cached) return res.status(201).json(cached);

    const id = req.params.id;
    const amount = Number(req.body.amount || 0);

    let expense: any = null;

    if (isMemoryFallback) {
      expense = {
        _id: req.body._id || generateId(),
        ...req.body,
        amount,
        tripId: id,
        createdAt: new Date()
      };
      memoryStore.expenses.push(expense);
    } else {
      expense = new Expense({ ...req.body, amount, tripId: id });
      await expense.save();
    }

    await recalculateTripBudget(id);
    await saveIdempotency(key, expense);
    res.status(201).json(expense);
  } catch (error) {
    res.status(400).json({ error: 'Invalid expense' });
  }
});

router.get('/trips/:id/expenses', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMemoryFallback) {
      const expenses = memoryStore.expenses.filter(e => String(e.tripId) === String(id));
      return res.json(expenses);
    }

    const expenses = await Expense.find({ tripId: id });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/expenses/:id', async (req, res) => {
  try {
    const key = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string;
    const cached = await checkIdempotency(key);
    if (cached) return res.json(cached);

    const id = req.params.id;
    let updatedExpense: any = null;
    let tripId = '';

    if (isMemoryFallback) {
      const expIdx = memoryStore.expenses.findIndex(e => String(e._id) === String(id));
      if (expIdx === -1) return res.status(404).json({ error: 'Expense not found' });
      memoryStore.expenses[expIdx] = { ...memoryStore.expenses[expIdx], ...req.body };
      updatedExpense = memoryStore.expenses[expIdx];
      tripId = updatedExpense.tripId;
    } else {
      updatedExpense = await Expense.findByIdAndUpdate(id, req.body, { new: true });
      if (!updatedExpense) return res.status(404).json({ error: 'Expense not found' });
      tripId = updatedExpense.tripId;
    }

    await recalculateTripBudget(tripId);
    await saveIdempotency(key, updatedExpense);
    res.json(updatedExpense);
  } catch (error) {
    res.status(400).json({ error: 'Invalid update' });
  }
});

router.delete('/expenses/:id', async (req, res) => {
  try {
    const key = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string;
    const cached = await checkIdempotency(key);
    if (cached) return res.json(cached);

    const id = req.params.id;
    let tripId = '';

    if (isMemoryFallback) {
      const expIdx = memoryStore.expenses.findIndex(e => String(e._id) === String(id));
      if (expIdx === -1) return res.status(404).json({ error: 'Expense not found' });
      tripId = memoryStore.expenses[expIdx].tripId;
      memoryStore.expenses.splice(expIdx, 1);
    } else {
      const expense = await Expense.findByIdAndDelete(id);
      if (expense) tripId = String(expense.tripId);
    }

    if (tripId) {
      await recalculateTripBudget(tripId);
    }

    const response = { success: true };
    await saveIdempotency(key, response);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------
// SAFETY EVENTS
// ---------------------------
router.post('/trips/:id/safety-events', async (req, res) => {
  try {
    const key = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string;
    const cached = await checkIdempotency(key);
    if (cached) return res.status(201).json(cached);

    const id = req.params.id;
    const now = new Date();
    let event: any = null;

    if (isMemoryFallback) {
      event = {
        _id: generateId(),
        ...req.body,
        tripId: id,
        triggeredAt: now
      };
      memoryStore.safetyEvents.push(event);

      const trip = memoryStore.trips.find(t => String(t._id) === String(id));
      if (trip) {
        if (req.body.type === 'late-arrival') trip.lastLateArrivalTriggerAt = now;
        if (req.body.type === 'route-deviation') trip.lastRouteDeviationTriggerAt = now;
      }
    } else {
      event = new SafetyEvent({ ...req.body, tripId: id, triggeredAt: now });
      await event.save();

      const updateFields: any = {};
      if (req.body.type === 'late-arrival') updateFields.lastLateArrivalTriggerAt = now;
      if (req.body.type === 'route-deviation') updateFields.lastRouteDeviationTriggerAt = now;
      if (Object.keys(updateFields).length > 0) {
        await Trip.findByIdAndUpdate(id, updateFields);
      }
    }

    await saveIdempotency(key, event);
    res.status(201).json(event);
  } catch (error) {
    res.status(400).json({ error: 'Invalid safety event' });
  }
});

// ---------------------------
// PRIVACY / SYNC / DASHBOARD
// ---------------------------
router.post('/sync/:tripId', async (req, res) => {
  try {
    const id = req.params.tripId;
    let consent = false;
    let destination = '';

    if (isMemoryFallback) {
      const trip = memoryStore.trips.find(t => t._id === id);
      if (!trip) return res.status(404).json({ error: 'Trip not found' });
      consent = !!trip.analyticsConsent;
      destination = trip.destinationCity;

      if (consent) {
        memoryStore.mobilityAggregates.push({
          city: destination,
          areaCell: 'mem_geohash_' + Math.random().toString(36).substring(2, 5),
          timeBucket: new Date(),
          modeCategory: 'rail',
          anonymousTripCount: 1,
          issueCounts: new Map()
        });
      }
    } else {
      const trip = await Trip.findById(id);
      if (!trip) return res.status(404).json({ error: 'Trip not found' });
      consent = !!trip.analyticsConsent;
      destination = trip.destinationCity;

      if (consent) {
        await processTripPrivacySync(trip.id, destination);
      }
    }
    
    res.json({ success: true, analyticsProcessed: consent });
  } catch (error) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

// NOTE: Dashboard endpoints NEVER read LocationPoints. They only read MobilityAggregates & consented Trip metadata.
router.get('/mobility/summary', async (req, res) => {
  try {
    let trips: any[] = [];
    let safetyEvents: any[] = [];
    let aggregates: any[] = [];

    if (isMemoryFallback) {
      trips = (memoryStore.trips || []).filter(t => t.analyticsConsent !== false && t.analyticsConsented !== false);
      safetyEvents = memoryStore.safetyEvents || [];
      aggregates = memoryStore.mobilityAggregates || [];
    } else {
      trips = await Trip.find({
        $or: [
          { analyticsConsent: { $ne: false } },
          { analyticsConsented: { $ne: false } }
        ]
      });
      safetyEvents = await SafetyEvent.find();
      aggregates = await MobilityAggregate.find();
    }

    const totalTrips = trips.length;
    const citiesSet = new Set(trips.map(t => t.destinationCity || t.originCity).filter(Boolean));
    const totalCities = citiesSet.size;
    const safetyChecksCount = safetyEvents.length;

    // a. Donut — mode share (walking / road / rail / still)
    const modeCounts: Record<string, number> = { Walking: 0, Road: 0, Rail: 0, Still: 0 };
    aggregates.forEach(a => {
      const mode = (a.modeCategory || 'walking').toLowerCase();
      if (mode.includes('rail') || mode.includes('train') || mode.includes('metro')) modeCounts.Rail += (a.anonymousTripCount || 1);
      else if (mode.includes('road') || mode.includes('bus') || mode.includes('cab') || mode.includes('auto')) modeCounts.Road += (a.anonymousTripCount || 1);
      else if (mode.includes('still') || mode.includes('stop')) modeCounts.Still += (a.anonymousTripCount || 1);
      else modeCounts.Walking += (a.anonymousTripCount || 1);
    });

    if (Object.values(modeCounts).reduce((a, b) => a + b, 0) === 0 && totalTrips > 0) {
      trips.forEach(t => {
        const mode = (t.transportMode || 'walking').toLowerCase();
        if (mode.includes('train') || mode.includes('rail') || mode.includes('metro')) modeCounts.Rail += 1;
        else if (mode.includes('bus') || mode.includes('cab') || mode.includes('road') || mode.includes('car')) modeCounts.Road += 1;
        else modeCounts.Still += 1;
        modeCounts.Walking += 1;
      });
    }

    const modeShare = Object.entries(modeCounts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));

    // b. Bar — demand by hour
    const hourBuckets: Record<string, number> = {};
    for (let h = 0; h < 24; h += 3) {
      const label = `${String(h).padStart(2, '0')}:00`;
      hourBuckets[label] = 0;
    }
    trips.forEach(t => {
      const date = new Date(t.createdAt || Date.now());
      const h = Math.floor(date.getHours() / 3) * 3;
      const label = `${String(h).padStart(2, '0')}:00`;
      if (hourBuckets[label] !== undefined) hourBuckets[label] += 1;
    });
    const demandByHour = Object.entries(hourBuckets).map(([hour, trips]) => ({ hour, trips }));

    // c. Bar — reported issue categories
    const issueCounts: Record<string, number> = { Language: 0, Signage: 0, Overcharging: 0, Accessibility: 0, Transport: 0 };
    safetyEvents.forEach(e => {
      const cat = (e.eventType || e.category || 'Transport').toLowerCase();
      if (cat.includes('lang')) issueCounts.Language += 1;
      else if (cat.includes('sign')) issueCounts.Signage += 1;
      else if (cat.includes('charge') || cat.includes('cost') || cat.includes('fare')) issueCounts.Overcharging += 1;
      else if (cat.includes('access')) issueCounts.Accessibility += 1;
      else issueCounts.Transport += 1;
    });
    const issueCategories = Object.entries(issueCounts).map(([category, count]) => ({ category, count }));

    // d. Area — trips over time (last 14 days)
    const timelineMap: Record<string, number> = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      timelineMap[key] = 0;
    }
    trips.forEach(t => {
      const date = new Date(t.createdAt || Date.now());
      const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (timelineMap[key] !== undefined) timelineMap[key] += 1;
    });
    const tripsOverTime = Object.entries(timelineMap).map(([date, count]) => ({ date, count }));

    res.json({
      totalTrips,
      totalCities,
      totalLanguages: Math.max(totalCities * 2, 7),
      safetyChecks: safetyChecksCount,
      modeShare,
      demandByHour,
      issueCategories,
      tripsOverTime
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/mobility/heatmap', async (req, res) => {
  try {
    if (isMemoryFallback) {
      // In memory fallback we mock data to make sure demo works smoothly
      return res.json(memoryStore.mobilityAggregates);
    }

    const heat = await MobilityAggregate.find({}, 'areaCell anonymousTripCount timeBucket modeCategory');
    // Suppress low volume cells before sending to client
    const safeHeat = heat.filter(h => h.anonymousTripCount >= 3);
    res.json(safeHeat);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trips/:id/safety-checks (Record safety response / check)
router.post('/trips/:id/safety-checks', async (req, res) => {
  try {
    const tripId = req.params.id;
    const { type, userResponse, notes, category } = req.body || {};

    const safetyCategory = category || (type === 'route-deviation' ? 'route-deviation' : type === 'late-arrival' ? 'late-arrival' : 'sos');

    const eventRecord = {
      tripId,
      eventType: type || 'safety-check',
      category: safetyCategory,
      details: notes || userResponse || `Safety check response: ${type}`,
      userResponse: userResponse || 'acknowledged',
      createdAt: new Date(),
      analyticsConsent: true
    };

    if (isMemoryFallback) {
      memoryStore.safetyEvents.push(eventRecord);
    } else {
      const doc = new SafetyEvent(eventRecord);
      await doc.save();
    }

    res.json({ success: true, event: eventRecord });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record safety check.' });
  }
});

// GET /api/mobility/issues (Aggregated Reported Safety & Mobility Issues)
router.get('/mobility/issues', async (req, res) => {
  try {
    let events: any[] = [];
    if (isMemoryFallback) {
      events = memoryStore.safetyEvents || [];
    } else {
      events = await SafetyEvent.find();
    }

    const categoryMap: Record<string, number> = {
      Language: 0,
      Signage: 0,
      Overcharging: 0,
      Accessibility: 0,
      Transport: 0
    };

    events.forEach(e => {
      const cat = (e.eventType || e.category || 'Transport').toLowerCase();
      if (cat.includes('lang')) categoryMap.Language++;
      else if (cat.includes('sign')) categoryMap.Signage++;
      else if (cat.includes('charge') || cat.includes('cost') || cat.includes('fare')) categoryMap.Overcharging++;
      else if (cat.includes('access')) categoryMap.Accessibility++;
      else categoryMap.Transport++;
    });

    const issues = Object.entries(categoryMap).map(([category, count]) => ({ category, count }));
    res.json(issues);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching mobility issues.' });
  }
});

// AI CHATBOT ASSISTANT ENDPOINT (POST /api/ai/chat)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  message: { error: 'Too many questions — wait a moment' },
  statusCode: 429
});

router.post('/ai/chat', aiLimiter, async (req, res) => {
  const apiKey = process.env.AI_API_KEY;
  const modelName = process.env.AI_MODEL || 'gemini-2.0-flash';

  if (!apiKey) {
    console.warn(`[AI-CHAT] [${new Date().toISOString()}] Config Error: Missing AI_API_KEY env variable.`);
    return res.status(503).json({ error: 'AI service is being configured — try shortly' });
  }

  try {
    const { message, tripContext } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    // Server-constructed system prompt
    let contextStr = 'None';
    let spotsContextStr = '';
    if (tripContext) {
      const origin = tripContext.originCity || 'Origin';
      const dest = tripContext.destinationCity || 'Destination';
      const day = tripContext.dayNumber || 1;
      const budget = tripContext.budgetTotal ? `₹${tripContext.budgetTotal}` : 'Not set';
      const remaining = tripContext.budgetRemaining ? `₹${tripContext.budgetRemaining}` : 'N/A';
      const mode = tripContext.currentMode || 'transit';
      const highlights = Array.isArray(tripContext.topAttractions) ? tripContext.topAttractions.slice(0, 5).join(', ') : 'City highlights';
      const phrases = Array.isArray(tripContext.keyPhrases) ? tripContext.keyPhrases.slice(0, 3).join(', ') : 'Local phrases';
      const fares = tripContext.typicalFares || 'Auto ₹30-50/km';

      contextStr = `${origin} → ${dest} · day ${day} · budget ${budget} · remaining ${remaining} · current segment ${mode} · destination highlights: ${highlights} · key phrases: ${phrases} · typical fares: ${fares}`;

      if (dest) {
        try {
          const destSpots = await getOrCreateCitySpots(dest);
          if (destSpots && destSpots.spots && destSpots.spots.length > 0) {
            const spotsInfo = destSpots.spots.slice(0, 10).map((s: any) => `${s.name} (${s.category})`).join(', ');
            spotsContextStr = ` Verified spots in ${dest} (${destSpots.source}): ${spotsInfo}.`;
          }
        } catch (e) {
          // ignore
        }
      }
    }

    const systemPrompt = `You are Sanchar AI, a practical Indian travel companion. Answer SHORT (2-4 sentences). If the user writes in Tamil/Telugu/Hindi/Kannada/Malayalam, answer in that language; else English. Never invent exact prices — honest ranges only. Mention 112 whenever safety is involved. Injected context: ${contextStr}.${spotsContextStr} If describing places, mention real attractions from the injected list. If the city spots source is 'wikipedia-live', honestly note 'based on Wikipedia data — verify locally'. Never invent history, timing, or prices.`;

    // 10s AbortController timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const apiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${systemPrompt}\n\nUser Question: ${message}` }
            ]
          }
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Logging timestamp + token estimate ONLY (zero prompt/key logging)
    const tokenEst = Math.ceil((systemPrompt.length + message.length) / 4);
    console.log(`[AI-CHAT] [${new Date().toISOString()}] Tokens est: ~${tokenEst} | Status: ${apiRes.status}`);

    if (apiRes.status === 404 || apiRes.status === 400) {
      const errBody = await apiRes.text().catch(() => '');
      console.warn(`[AI-CHAT] Model/Key Config error (${apiRes.status}): ${errBody.slice(0, 200)}`);
      return res.status(503).json({ error: 'AI service is being configured — try shortly' });
    }

    if (apiRes.status === 429) {
      return res.status(429).json({ error: 'Too many questions — wait a moment' });
    }

    if (!apiRes.ok) {
      return res.status(503).json({ error: 'AI is busy — try again in a moment' });
    }

    const data: any = await apiRes.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return res.status(503).json({ error: 'AI is busy — try again in a moment' });
    }

    return res.json({ reply });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn(`[AI-CHAT] [${new Date().toISOString()}] Request timed out after 10s`);
      return res.status(503).json({ error: 'AI is busy — try again in a moment' });
    }
    console.warn(`[AI-CHAT] [${new Date().toISOString()}] Server Error:`, err.message || err);
    return res.status(503).json({ error: 'AI is busy — try again in a moment' });
  }
});
// ---------------------------
// AUTH & VAULT
// ---------------------------
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-sanchar-ai';

router.post('/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    
    if (isMemoryFallback) return res.status(400).json({ error: 'Auth disabled in memory mode' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({ email, passwordHash });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { email: user.email, hasVault: !!user.vaultPin } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    
    if (isMemoryFallback) return res.status(400).json({ error: 'Auth disabled in memory mode' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { email: user.email, hasVault: !!user.vaultPin } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/user/vault-pin', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    const { pin } = req.body;
    if (!pin || pin.length !== 4) return res.status(400).json({ error: '4-digit PIN required' });

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.vaultPin = pin;
    await user.save();
    
    res.json({ success: true, hasVault: true });
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

router.post('/user/verify-pin', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: 'PIN required' });

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.vaultPin !== pin) return res.status(401).json({ error: 'Invalid PIN' });
    
    res.json({ success: true });
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

export default router;
