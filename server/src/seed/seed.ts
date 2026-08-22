import mongoose from 'mongoose';
import { CityPack } from '../models';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

import { curatedCities } from '../data/curatedCities';

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("⚠️ No MONGODB_URI found. Cannot run seed script. Use in-memory for testing.");
    process.exit(0);
  }

  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB for seeding.");
    
    await CityPack.deleteMany({});
    console.log("Cleared existing CityPacks.");

    await CityPack.insertMany(curatedCities as any);
    console.log("Seeded curated CityPacks successfully!");

    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
}

seed();
