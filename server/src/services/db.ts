import mongoose from 'mongoose';

import { curatedCities } from '../data/curatedCities';

export let isMemoryFallback = false;

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
  citySpots: [] as any[],
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

    // Idempotent auto-seed if collection is empty
    const { CityPack } = await import('../models');
    const count = await CityPack.countDocuments();
    if (count === 0) {
      console.log('CityPack collection is empty. Auto-seeding 8 curated cities...');
      await CityPack.insertMany(curatedCities);
      console.log('Curated CityPacks seeded successfully.');
    }
  } catch (error) {
    console.error('MongoDB connection error, falling back to memory store:', error);
    isMemoryFallback = true;
  }
};
