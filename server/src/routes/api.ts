import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Trip, LocationPoint, JourneySegment, Expense, CityPack, SafetyEvent, MobilityAggregate, PilotSignup, CitySpot, IdempotencyKey } from '../models';
import { processTripPrivacySync } from '../services/privacy';
import { isMemoryFallback, memoryStore } from '../services/db';

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
    const city = req.params.city;
    if (isMemoryFallback) {
      let pack = memoryStore.cityPacks.find(p => p.city.toLowerCase() === city.toLowerCase());
      if (!pack) pack = memoryStore.cityPacks.find(p => p.city === 'default');
      return res.json(pack);
    }

    let pack = await CityPack.findOne({ city });
    if (!pack) pack = await CityPack.findOne({ city: 'default' }); // Fallback
    res.json(pack);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
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

function normalizeCityName(str: string): string {
  if (!str) return '';
  const trimmed = str.trim();
  return trimmed.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

router.get('/city-spots/:city', async (req, res) => {
  try {
    const city = normalizeCityName(req.params.city);
    if (!city) {
      return res.status(400).json({ error: 'City parameter is required.' });
    }

    // 1. Check Cache
    if (isMemoryFallback) {
      const cached = memoryStore.citySpots.find(c => c.city.toLowerCase() === city.toLowerCase());
      if (cached) return res.json(cached);
    } else {
      const cached = await CitySpot.findOne({ city: new RegExp(`^${city}$`, 'i') });
      if (cached) return res.json(cached);
    }

    // 2. Curated showcase check
    const curatedList = CURATED_CITY_SPOTS[city];
    if (curatedList) {
      const spots = curatedList.map(name => {
        const category = getCategoryForSpot(name);
        return {
          name,
          category,
          blurb: getCuratedBlurbForSpot(name, category, city)
        };
      });

      const citySpotRecord = {
        city,
        source: 'curated-sample' as const,
        count: spots.length,
        spots,
        fetchedAt: new Date()
      };

      if (isMemoryFallback) {
        memoryStore.citySpots.push(citySpotRecord);
      } else {
        const doc = new CitySpot(citySpotRecord);
        await doc.save();
      }

      return res.json(citySpotRecord);
    }

    // 3. Live Wikipedia Fetch
    const listTitlesToTry = [
      `List of tourist attractions in ${city}`,
      `${city} tourist attractions`,
      `Tourism in ${city}`,
      `${city} sightseeing`
    ];

    let wikitext = '';
    
    // Helper to clean wikitext descriptions
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

    const spotsList: { name: string; category: string; blurb: string }[] = [];
    const addSpot = (name: string, desc: string) => {
      console.log('addSpot called with:', name);
      if (name && !/^(file|image|category|special|media|wikipedia):/i.test(name) && !isInvalidSpot(name)) {
        if (!spotsList.some(s => s.name.toLowerCase() === name.toLowerCase())) {
          const category = getCategoryForSpot(name);
          spotsList.push({
            name,
            category,
            blurb: cleanDesc(desc) || ''
          });
          console.log('Added spot:', name);
        }
      } else {
        console.log('Rejected spot:', name, 'isInvalid:', isInvalidSpot(name));
      }
    };

    for (const title of listTitlesToTry) {
      try {
        console.log('Fetching list page:', title);
        const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&redirects=1`;
        const wikiRes = await fetch(url, { headers: { 'User-Agent': 'SancharAI/1.0' } });
        const data = await wikiRes.json();
        if (data.parse && data.parse.wikitext) {
          console.log('Found list page wikitext for:', title);
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
          if (spotsList.length > 5) break; // found enough in this list page
        }
      } catch (err) {
        console.warn(`Wikipedia list page load failed for ${title}:`, err);
      }
    }

    // If still no spots found, query the main city page
    if (spotsList.length < 5) {
      try {
        console.log('Fetching main page:', city);
        const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(city)}&prop=wikitext&format=json&redirects=1`;
        const wikiRes = await fetch(url, { headers: { 'User-Agent': 'SancharAI/1.0' } });
        const data = await wikiRes.json();
        if (data.parse && data.parse.wikitext) {
          console.log('Found main page wikitext for:', city);
          wikitext = data.parse.wikitext['*'];
          
          const lines = wikitext.split('\n');
          let inTourism = false;
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (/==\s*(Tourist attractions|Places of interest|Sights|Tourism)\s*==/i.test(trimmed)) {
              inTourism = true;
            } else if (inTourism && /^==[^=]/m.test(trimmed)) {
              inTourism = false;
            }
            
            if (inTourism) {
              const match = trimmed.match(/^\*\s*(?:'''''|'''|'')?\[\[(.*?)\]\](.*)/) || trimmed.match(/^\*\s*\{\{.*?\}\}\s*(?:'''''|'''|'')?\[\[(.*?)\]\](.*)/);
              if (match) {
                const parts = match[1].split('|');
                const name = parts[0].split('#')[0].trim();
                addSpot(name, match[2]);
              }
            }
          }
          
          if (spotsList.length < 10) {
            inTourism = false;
            for (const line of lines) {
              const trimmed = line.trim();
              if (/==\s*(Tourist attractions|Places of interest|Sights|Tourism)\s*==/i.test(trimmed)) {
                inTourism = true;
              } else if (inTourism && /^==[^=]/m.test(trimmed)) {
                inTourism = false;
              }
              
              if (inTourism) {
                const inlineMatches = trimmed.matchAll(/\[\[(.*?)\]\]/g);
                for (const m of inlineMatches) {
                  const parts = m[1].split('|');
                  const name = parts[0].split('#')[0].trim();
                  const ignoreList = ['india', 'state', 'district', 'city', 'tourism', 'tourist', 'government', 'railway station', 'airport', 'national highway', 'stupa', 'buddhism', 'hinduism', 'jainism', 'culture', 'history', 'population', 'demographics', 'climate', 'tiger', 'forest', 'census', 'latitude', 'longitude', 'utc', 'madhya pradesh', 'uttar pradesh', 'maharashtra', 'karnataka', 'tamil nadu', 'kerala', 'andhra pradesh', 'telangana', 'assam', 'west bengal', 'odisha', 'bihar', 'gujarat', 'rajasthan', 'punjab', 'haryana', 'jammu and kashmir', 'maharashtra', 'india'];
                  if (!ignoreList.includes(name.toLowerCase())) {
                    addSpot(name, '');
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Wikipedia main page load failed for city ${city}:`, err);
      }
    }

    if (spotsList.length === 0) {
      return res.json({ found: false });
    }

    const finalSpots = spotsList.slice(0, 25);
    const citySpotRecord = {
      city,
      source: 'wikipedia-live' as const,
      count: finalSpots.length,
      spots: finalSpots,
      fetchedAt: new Date()
    };

    if (isMemoryFallback) {
      memoryStore.citySpots.push(citySpotRecord);
    } else {
      const doc = new CitySpot(citySpotRecord);
      await doc.save();
    }

    res.json(citySpotRecord);
  } catch (error) {
    res.status(500).json({ error: 'Server error while fetching city spots.' });
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

// NOTE: Dashboard endpoints NEVER read LocationPoints. They only read MobilityAggregates.
router.get('/mobility/summary', async (req, res) => {
  try {
    if (isMemoryFallback) {
      const totalTrips = memoryStore.mobilityAggregates.length;
      return res.json({ totalTrips });
    }

    const agg = await MobilityAggregate.aggregate([
      { $group: { _id: null, totalTrips: { $sum: "$anonymousTripCount" } } }
    ]);
    res.json({ totalTrips: agg[0]?.totalTrips || 0 });
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

export default router;
