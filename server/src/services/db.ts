import mongoose from 'mongoose';

import { curatedCities } from '../data/curatedCities';
import { curatedSpotsData, seedLuggageSpots } from '../data/spotsData';

export let isMemoryFallback = false;
export let fallbackReason = '';

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
    tripId: "trip-chennai-heritage-01",
    userId: "user-demotrip-1",
    status: "completed",
    originCity: "Chennai",
    destinationCity: "Chennai",
    budgetAmount: 1500,
    amountSpent: 450,
    startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
    analyticsConsent: true,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  },
  {
    tripId: "trip-kochi-coastal-02",
    userId: "user-demotrip-2",
    status: "completed",
    originCity: "Kochi",
    destinationCity: "Kochi",
    budgetAmount: 2000,
    amountSpent: 850,
    startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
    analyticsConsent: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  },
  {
    tripId: "trip-hyderabad-heritage-03",
    userId: "user-demotrip-3",
    status: "completed",
    originCity: "Hyderabad",
    destinationCity: "Hyderabad",
    budgetAmount: 3000,
    amountSpent: 1200,
    startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000),
    analyticsConsent: true,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  }
];

export const seedSegmentsData = [
  { tripId: "trip-chennai-heritage-01", mode: "walking", durationMin: 45, startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), analyticsConsent: true },
  { tripId: "trip-chennai-heritage-01", mode: "road", durationMin: 30, startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000), analyticsConsent: true },
  { tripId: "trip-kochi-coastal-02", mode: "rail", durationMin: 35, startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), analyticsConsent: true },
  { tripId: "trip-kochi-coastal-02", mode: "walking", durationMin: 40, startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 35 * 60 * 1000), analyticsConsent: true },
  { tripId: "trip-hyderabad-heritage-03", mode: "road", durationMin: 50, startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), analyticsConsent: true },
  { tripId: "trip-hyderabad-heritage-03", mode: "still", durationMin: 20, startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 50 * 60 * 1000), analyticsConsent: true }
];

export const seedSafetyEventsData = [
  { category: "signage", details: "Lack of English signage near station exit", createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), analyticsConsent: true },
  { category: "overcharging", details: "Auto driver requested 2x fare above meter", createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), analyticsConsent: true },
  { category: "language", details: "Local bus conductor only speaks Tamil", createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), analyticsConsent: true }
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
};

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️ MONGODB_URI not provided. Falling back to in-memory test store.');
    isMemoryFallback = true;
    fallbackReason = 'MONGODB_URI missing';
    return;
  }
  
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected successfully');
    isMemoryFallback = false;

    // Idempotent auto-seed CityPack if empty
    const { CityPack, CitySpot, LuggageSpot, Trip, JourneySegment, SafetyEvent } = await import('../models');
    const packCount = await CityPack.countDocuments();
    if (packCount === 0) {
      console.log('CityPack collection is empty. Auto-seeding 8 curated cities...');
      await CityPack.insertMany(curatedCities);
      console.log('Curated CityPacks seeded successfully.');
    }

    // Idempotent auto-seed CitySpot if empty
    const spotCount = await CitySpot.countDocuments();
    if (spotCount === 0) {
      console.log('CitySpot collection is empty. Auto-seeding curated places...');
      await CitySpot.insertMany(seededSpots);
      console.log('Curated CitySpots seeded successfully.');
    }

    // Idempotent auto-seed/update LuggageSpot
    console.log('Syncing luggage spots...');
    for (const spot of seedLuggageSpots) {
      await LuggageSpot.updateOne({ _id: spot._id }, { $set: spot }, { upsert: true });
    }
    console.log('LuggageSpots synced successfully.');

    // Idempotent auto-seed Trip if empty
    const tripCount = await Trip.countDocuments();
    if (tripCount === 0) {
      console.log('Trip collection is empty. Auto-seeding 3 real consented trips...');
      await Trip.insertMany(seedTripsData);
      await JourneySegment.insertMany(seedSegmentsData);
      await SafetyEvent.insertMany(seedSafetyEventsData);
      console.log('Dummy safety events seeded successfully.');
    }
  } catch (err: any) {
    console.error('❌ MongoDB Connection Error:', err.message || err);
    console.warn('⚠️ Falling back to in-memory store due to connection failure.');
    isMemoryFallback = true;
    fallbackReason = err.message || String(err);
  }
};
