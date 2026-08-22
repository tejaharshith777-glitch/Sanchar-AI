import mongoose, { Schema, Document } from 'mongoose';

// --- TRIPS ---
export interface ITrip extends Document {
  originCity: string;
  destinationCity: string;
  destinationLatLng?: { lat: number, lng: number };
  startTime: Date;
  endTime?: Date;
  expectedArrival?: Date;
  status: 'created' | 'active' | 'paused' | 'completed' | 'arrived-confirmed';
  budget: number;
  amountSpent: number;
  analyticsConsent: boolean;
  createdAt: Date;
}

const tripSchema = new Schema<ITrip>({
  originCity: { type: String, required: true },
  destinationCity: { type: String, required: true },
  destinationLatLng: { lat: Number, lng: Number },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  expectedArrival: Date,
  status: { type: String, enum: ['created', 'active', 'paused', 'completed', 'arrived-confirmed'], default: 'created' },
  budget: { type: Number, default: 0 },
  amountSpent: { type: Number, default: 0 },
  analyticsConsent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const Trip = mongoose.model<ITrip>('Trip', tripSchema);

// --- LOCATION POINTS ---
export interface ILocationPoint extends Document {
  tripId: mongoose.Types.ObjectId;
  lat: number;
  lng: number;
  speedKmh: number;
  timestamp: Date;
  source: 'gps' | 'network';
}

const locationPointSchema = new Schema<ILocationPoint>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  speedKmh: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
  source: { type: String, enum: ['gps', 'network'], default: 'gps' }
});

export const LocationPoint = mongoose.model<ILocationPoint>('LocationPoint', locationPointSchema);

// --- JOURNEY SEGMENTS ---
export interface IJourneySegment extends Document {
  tripId: mongoose.Types.ObjectId;
  mode: 'walking' | 'road_vehicle' | 'rail' | 'still' | 'unknown';
  confidence: number;
  startTime: Date;
  endTime?: Date;
  distanceKm: number;
  userCorrected: boolean;
}

const journeySegmentSchema = new Schema<IJourneySegment>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  mode: { type: String, enum: ['walking', 'road_vehicle', 'rail', 'still', 'unknown'], required: true },
  confidence: { type: Number, min: 0, max: 1, default: 0 },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  distanceKm: { type: Number, default: 0 },
  userCorrected: { type: Boolean, default: false }
});

export const JourneySegment = mongoose.model<IJourneySegment>('JourneySegment', journeySegmentSchema);

// --- EXPENSES ---
export interface IExpense extends Document {
  tripId: mongoose.Types.ObjectId;
  merchant: string;
  amount: number;
  category: 'transport' | 'food' | 'hotel' | 'other';
  date: Date;
  source: 'ocr' | 'manual';
  ocrRawText?: string;
  confirmed: boolean;
}

const expenseSchema = new Schema<IExpense>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  merchant: { type: String, default: '' },
  amount: { type: Number, required: true },
  category: { type: String, enum: ['transport', 'food', 'hotel', 'other'], default: 'other' },
  date: { type: Date, default: Date.now },
  source: { type: String, enum: ['ocr', 'manual'], required: true },
  ocrRawText: { type: String },
  confirmed: { type: Boolean, default: false }
});

export const Expense = mongoose.model<IExpense>('Expense', expenseSchema);

// --- CITY PACKS ---
export interface ICityPack extends Document {
  city: string;
  languages: string[];
  version: string;
  updatedAt: Date;
  emergencyNumbers: { label: string, number: string }[];
  phrases: { en: string, local: string, localLang: string }[];
  attractions: { name: string, type: string }[];
  transportGuidance: string;
  contentStatus: 'curated-sample' | 'verified' | 'generic-fallback';
}

const cityPackSchema = new Schema<ICityPack>({
  city: { type: String, required: true, unique: true },
  languages: [String],
  version: { type: String, default: '1.0' },
  updatedAt: { type: Date, default: Date.now },
  emergencyNumbers: [{ label: String, number: String }],
  phrases: [{ en: String, local: String, localLang: String }],
  attractions: [{ name: String, type: String }],
  transportGuidance: String,
  contentStatus: { type: String, enum: ['curated-sample', 'verified', 'generic-fallback'], required: true }
});

export const CityPack = mongoose.model<ICityPack>('CityPack', cityPackSchema);

// --- SAFETY EVENTS ---
export interface ISafetyEvent extends Document {
  tripId: mongoose.Types.ObjectId;
  type: 'route-deviation' | 'late-arrival' | 'user-initiated-sos';
  triggeredAt: Date;
  userResponse?: string;
  resolvedAt?: Date;
}

const safetyEventSchema = new Schema<ISafetyEvent>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  type: { type: String, enum: ['route-deviation', 'late-arrival', 'user-initiated-sos'], required: true },
  triggeredAt: { type: Date, default: Date.now },
  userResponse: String,
  resolvedAt: Date
});

export const SafetyEvent = mongoose.model<ISafetyEvent>('SafetyEvent', safetyEventSchema);

// --- MOBILITY AGGREGATES ---
// Only written by server-side privacy pipeline
export interface IMobilityAggregate extends Document {
  city: string;
  areaCell: string; // geohash
  timeBucket: Date; // truncated to hour
  modeCategory: string;
  anonymousTripCount: number;
  issueCounts: Map<string, number>;
}

const mobilityAggregateSchema = new Schema<IMobilityAggregate>({
  city: { type: String, required: true },
  areaCell: { type: String, required: true },
  timeBucket: { type: Date, required: true },
  modeCategory: { type: String, required: true },
  anonymousTripCount: { type: Number, default: 0 },
  issueCounts: { type: Map, of: Number, default: {} }
});

// Compound index for efficient querying and updating
mobilityAggregateSchema.index({ city: 1, areaCell: 1, timeBucket: 1, modeCategory: 1 }, { unique: true });

export const MobilityAggregate = mongoose.model<IMobilityAggregate>('MobilityAggregate', mobilityAggregateSchema);
