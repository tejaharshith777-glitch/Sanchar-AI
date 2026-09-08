import mongoose from 'mongoose';

import { curatedCities } from '../data/curatedCities';
import { curatedSpotsData, seedLuggageSpots } from '../data/spotsData';

export let isMemoryFallback = false;
export let fallbackReason = '';

export function setMemoryFallback(reason: string) {
  isMemoryFallback = true;
  fallbackReason = reason;
}

// Prepare pre-seeded spots and luggage spots for memory fallback
const seededSpots = Object.keys(curatedSpotsData).map(city => ({
  city,
  source: 'curated-sample' as const,
  count: curatedSpotsData[city].length,
  spots: curatedSpotsData[city],
  fetchedAt: new Date()
}));

export const seedTripsData = [
  {
    _id: "trip-chennai-heritage-01",
    tripId: "trip-chennai-heritage-01",
    userId: "user-demotrip-1",
    status: "completed",
    originCity: "Chennai",
    destinationCity: "Chennai",
    budget: 1500,
    amountSpent: 450,
    startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
    analyticsConsent: true,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  },
  {
    _id: "trip-kochi-coastal-02",
    tripId: "trip-kochi-coastal-02",
    userId: "user-demotrip-2",
    status: "completed",
    originCity: "Kochi",
    destinationCity: "Kochi",
    budget: 2000,
    amountSpent: 850,
    startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
    analyticsConsent: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  },
  {
    _id: "trip-hyderabad-heritage-03",
    tripId: "trip-hyderabad-heritage-03",
    userId: "user-demotrip-3",
    status: "completed",
    originCity: "Hyderabad",
    destinationCity: "Hyderabad",
    budget: 3000,
    amountSpent: 1200,
    startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000),
    analyticsConsent: true,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  }
];

export const seedSegmentsData = [
  { tripId: "trip-chennai-heritage-01", mode: "walking", durationMin: 45, startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), analyticsConsent: true },
  { tripId: "trip-chennai-heritage-01", mode: "road_vehicle", durationMin: 30, startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000), analyticsConsent: true },
  { tripId: "trip-kochi-coastal-02", mode: "rail", durationMin: 35, startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), analyticsConsent: true },
  { tripId: "trip-kochi-coastal-02", mode: "walking", durationMin: 40, startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 35 * 60 * 1000), analyticsConsent: true },
  { tripId: "trip-hyderabad-heritage-03", mode: "road_vehicle", durationMin: 50, startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), analyticsConsent: true },
  { tripId: "trip-hyderabad-heritage-03", mode: "still", durationMin: 20, startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 50 * 60 * 1000), analyticsConsent: true }
];

export const seedSafetyEventsData = [
  { _id: "safety-event-01", tripId: "trip-chennai-heritage-01", type: "late-arrival", triggeredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), userResponse: "im-safe", resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
  { _id: "safety-event-02", tripId: "trip-kochi-coastal-02", type: "route-deviation", triggeredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), userResponse: "im-safe", resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
  { _id: "safety-event-03", tripId: "trip-hyderabad-heritage-03", type: "user-initiated-sos", triggeredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), userResponse: "open-sos", resolvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
];

// Basic in-memory store for fallback
export const memoryStore = {
  trips: [...seedTripsData] as any[],
  cityPacks: [...curatedCities] as any[],
  locationPoints: [] as any[],
  journeySegments: [...seedSegmentsData] as any[],
  expenses: [] as any[],
  safetyEvents: [...seedSafetyEventsData] as any[],
  mobilityAggregates: [] as any[],
  pilotSignups: [] as any[],
  citySpots: [...seededSpots] as any[],
  luggageSpots: [...seedLuggageSpots] as any[],
  luggageCheckIns: [] as any[],
  idempotencyKeys: [] as any[],
  partnerPublishes: [] as any[],
  issueReports: [] as any[],
};


export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️ MONGODB_URI not provided. Falling back to in-memory test store.');
    isMemoryFallback = true;
    fallbackReason = 'MONGODB_URI missing';
    return;
  }

  const retryDelaysMs = [5000, 10000, 20000, 30000, 45000];
  let connected = false;
  let lastError: any = null;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      console.log(`[MongoDB] Connecting to Atlas (attempt ${attempt}/5)...`);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log('MongoDB connected successfully');
      connected = true;
      isMemoryFallback = false;
      fallbackReason = '';
      break;
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      console.error(`❌ [MongoDB] Attempt ${attempt}/5 failed: ${errMsg}`);
      if (attempt < 5) {
        const delayMs = retryDelaysMs[attempt - 1];
        console.log(`[MongoDB] Retrying in ${delayMs / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  if (!connected) {
    const reason = lastError?.message || String(lastError);
    console.warn(`⚠️ All 5 MongoDB connection attempts failed. Falling back to in-memory store. Reason: ${reason}`);
    isMemoryFallback = true;
    fallbackReason = reason;
    return;
  }

  // Idempotent auto-seed CityPack if empty
  try {
    const { CityPack } = await import('../models');
    const packCount = await CityPack.countDocuments();
    if (packCount === 0) {
      console.log('CityPack collection is empty. Auto-seeding 8 curated cities...');
      await CityPack.insertMany(curatedCities);
      console.log('Curated CityPacks seeded successfully.');
    }
  } catch (err: any) {
    console.error('Error seeding CityPacks:', err?.message || err);
  }

  // Idempotent auto-seed/sync CitySpot
  try {
    const { CitySpot } = await import('../models');
    console.log('Syncing curated CitySpots...');
    for (const spotDoc of seededSpots) {
      await CitySpot.updateOne(
        { city: new RegExp(`^${spotDoc.city}$`, 'i') },
        { $set: spotDoc },
        { upsert: true }
      );
    }
    console.log('Curated CitySpots synced successfully.');
  } catch (err: any) {
    console.error('Error syncing CitySpots:', err?.message || err);
  }

  // Idempotent auto-seed/update LuggageSpot
  try {
    const { LuggageSpot } = await import('../models');
    console.log('Syncing luggage spots...');
    for (const spot of seedLuggageSpots) {
      await LuggageSpot.updateOne({ _id: spot._id }, { $set: spot }, { upsert: true });
    }
    console.log('LuggageSpots synced successfully.');
  } catch (err: any) {
    console.error('Error syncing LuggageSpots:', err?.message || err);
  }

  // Idempotent auto-seed/update SafetyEvent
  try {
    const { SafetyEvent } = await import('../models');
    console.log('Syncing safety events...');
    for (const event of seedSafetyEventsData) {
      await SafetyEvent.updateOne({ _id: event._id }, { $set: event }, { upsert: true });
    }
    console.log('SafetyEvents synced successfully.');
  } catch (err: any) {
    console.error('Error syncing SafetyEvents:', err?.message || err);
  }

  // Idempotent auto-seed Trip if empty
  try {
    const { Trip } = await import('../models');
    const tripCount = await Trip.countDocuments();
    if (tripCount === 0) {
      console.log('Trip collection is empty. Auto-seeding 3 real consented trips...');
      await Trip.insertMany(seedTripsData);
      console.log('Trips seeded successfully.');
    }
  } catch (err: any) {
    console.error('Error seeding Trips:', err?.message || err);
  }

  // Idempotent auto-seed JourneySegment if empty
  try {
    const { JourneySegment } = await import('../models');
    const segmentCount = await JourneySegment.countDocuments();
    if (segmentCount === 0) {
      console.log('JourneySegment collection is empty. Auto-seeding segments...');
      await JourneySegment.insertMany(seedSegmentsData);
      console.log('JourneySegments seeded successfully.');
    }
  } catch (err: any) {
    console.error('Error seeding JourneySegments:', err?.message || err);
  }
};
