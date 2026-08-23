import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { CitySpot } from './src/models';

dotenv.config();

const clear = async () => {
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    await CitySpot.deleteMany({});
    console.log('Cleared CitySpot cache in Atlas.');
    process.exit(0);
  } else {
    console.log('No MONGODB_URI, memory cache is transient anyway. Restart the server to clear it.');
    process.exit(0);
  }
};
clear();
