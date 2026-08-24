import mongoose from 'mongoose';

import { curatedCities } from '../data/curatedCities';
import { curatedSpotsData, seedLuggageSpots } from '../data/spotsData';

export let isMemoryFallback = false;

// Prepare pre-seeded spots and luggage spots for memory fallback
const seededSpots = Object.keys(curatedSpotsData).map(city => ({
  city,
  source: 'curated-sample' as const,
  count: curatedSpotsData[city].length,
  spots: curatedSpotsData[city],
  fetchedAt: new Date()
}));

// Basic in-memory store for fallback
export const memoryStore = {
  trips: [] as any[],
  cityPacks: [...curatedCities] as any[],
  locationPoints: [] as any[],
  journeySegments: [] as any[],
  expenses: [] as any[],
  safetyEvents: [] as any[],
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
    return;
  }
  
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected successfully');
    isMemoryFallback = false;

    // Idempotent auto-seed CityPack if empty
    const { CityPack, CitySpot, LuggageSpot } = await import('../models');
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

    // Idempotent auto-seed LuggageSpot if empty
    const luggageCount = await LuggageSpot.countDocuments();
    if (luggageCount === 0) {
      console.log('LuggageSpot collection is empty. Auto-seeding luggage spots...');
      await LuggageSpot.insertMany(seedLuggageSpots);
      console.log('LuggageSpots seeded successfully.');
    }
  } catch (error) {
    console.error('MongoDB connection error, falling back to memory store:', error);
    isMemoryFallback = true;
  }
};
