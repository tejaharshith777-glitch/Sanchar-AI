import mongoose, { Schema, Document } from 'mongoose';

// --- TRIPS ---
export interface ITrip extends Document {
  originCity: string;
  destinationCity: string;
  destinationLatLng?: { lat: number, lng: number };
  startTime: Date;
  endTime?: Date;
  expectedArrival?: Date;
  lastLateArrivalTriggerAt?: Date;
  lastRouteDeviationTriggerAt?: Date;
  notYetCount?: number;
  status: 'created' | 'active' | 'paused' | 'completed' | 'arrived-confirmed';
  budget: number;
  amountSpent: number;
  analyticsConsent: boolean;
  heavyLuggage: boolean;
  createdAt: Date;
}

const tripSchema = new Schema<ITrip>({
  originCity: { type: String, required: true },
  destinationCity: { type: String, required: true },
  destinationLatLng: { lat: Number, lng: Number },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  expectedArrival: { type: Date, default: null },
  lastLateArrivalTriggerAt: { type: Date, default: null },
  lastRouteDeviationTriggerAt: { type: Date, default: null },
  notYetCount: { type: Number, default: 0 },
  status: { type: String, enum: ['created', 'active', 'paused', 'completed', 'arrived-confirmed'], default: 'created' },
  budget: { type: Number, default: 0 },
  amountSpent: { type: Number, default: 0 },
  analyticsConsent: { type: Boolean, default: false },
  heavyLuggage: { type: Boolean, default: false },
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

// --- PILOT SIGNUPS ---
export interface IPilotSignup extends Document {
  name: string;
  email?: string;
  city: string;
  feedback?: string;
  createdAt: Date;
}

const pilotSignupSchema = new Schema<IPilotSignup>({
  name: { type: String, required: true },
  email: String,
  city: { type: String, required: true },
  feedback: String,
  createdAt: { type: Date, default: Date.now }
});

export const PilotSignup = mongoose.model<IPilotSignup>('PilotSignup', pilotSignupSchema);

// --- CITY SPOTS ---
export interface ICitySpot extends Document {
  city: string;
  source: 'curated-sample' | 'wikipedia-live';
  count: number;
  spots: {
    name: string;
    slug?: string;
    category?: string;
    blurb?: string;
    bestThing?: string;
    bestTime?: string;
    timeToSpend?: string;
    entryCost?: string;
    nearTransport?: string;
    tips?: string[];
    lat?: number;
    lng?: number;
    image?: string;
    coords?: { lat: number; lng: number } | null;
    source?: string;
  }[];
  fetchedAt: Date;
}

const citySpotSchema = new Schema<ICitySpot>({
  city: { type: String, required: true, unique: true },
  source: { type: String, enum: ['curated-sample', 'wikipedia-live'], required: true },
  count: { type: Number, required: true },
  spots: [{
    name: { type: String, required: true },
    slug: String,
    category: String,
    blurb: String,
    bestThing: String,
    bestTime: String,
    timeToSpend: String,
    entryCost: String,
    nearTransport: String,
    tips: [String],
    lat: Number,
    lng: Number,
    image: String,
    coords: { lat: Number, lng: Number },
    source: String
  }],
  fetchedAt: { type: Date, default: Date.now }
});

export const CitySpot = mongoose.model<ICitySpot>('CitySpot', citySpotSchema);

// --- LUGGAGE SPOTS ---
export interface ILuggageSpot extends Document {
  city: string;
  name: string;
  type: 'railway_cloakroom' | 'airport_counter' | 'metro_locker' | 'partner';
  lat: number;
  lng: number;
  hours: string;
  pricingPerBagHour: string;
  requiredDocs: string;
  rules: string;
  verified: boolean;
}

const luggageSpotSchema = new Schema<ILuggageSpot>({
  city: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['railway_cloakroom', 'airport_counter', 'metro_locker', 'partner'], required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  hours: { type: String, default: '24 Hours' },
  pricingPerBagHour: { type: String, default: '₹15/bag/hour' },
  requiredDocs: { type: String, default: 'Valid ID Card & Train Ticket' },
  rules: { type: String, default: 'Lockable bags only' },
  verified: { type: Boolean, default: false }
});

export const LuggageSpot = mongoose.model<ILuggageSpot>('LuggageSpot', luggageSpotSchema);

// --- LUGGAGE CHECKINS ---
export interface ILuggageCheckIn extends Document {
  spotId: mongoose.Types.ObjectId;
  status: 'full' | 'limited' | 'available';
  createdAt: Date;
}

const luggageCheckInSchema = new Schema<ILuggageCheckIn>({
  spotId: { type: Schema.Types.ObjectId, ref: 'LuggageSpot', required: true },
  status: { type: String, enum: ['full', 'limited', 'available'], required: true },
  createdAt: { type: Date, default: Date.now }
});

export const LuggageCheckIn = mongoose.model<ILuggageCheckIn>('LuggageCheckIn', luggageCheckInSchema);

// --- IDEMPOTENCY KEYS ---
export interface IIdempotencyKey extends Document {
  key: string;
  response: any;
  createdAt: Date;
}

const idempotencyKeySchema = new Schema<IIdempotencyKey>({
  key: { type: String, required: true, unique: true },
  response: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 }
});

export const IdempotencyKey = mongoose.model<IIdempotencyKey>('IdempotencyKey', idempotencyKeySchema);

