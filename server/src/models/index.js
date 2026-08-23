"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyKey = exports.CitySpot = exports.PilotSignup = exports.MobilityAggregate = exports.SafetyEvent = exports.CityPack = exports.Expense = exports.JourneySegment = exports.LocationPoint = exports.Trip = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const tripSchema = new mongoose_1.Schema({
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
    createdAt: { type: Date, default: Date.now }
});
exports.Trip = mongoose_1.default.model('Trip', tripSchema);
const locationPointSchema = new mongoose_1.Schema({
    tripId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Trip', required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    speedKmh: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
    source: { type: String, enum: ['gps', 'network'], default: 'gps' }
});
exports.LocationPoint = mongoose_1.default.model('LocationPoint', locationPointSchema);
const journeySegmentSchema = new mongoose_1.Schema({
    tripId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Trip', required: true },
    mode: { type: String, enum: ['walking', 'road_vehicle', 'rail', 'still', 'unknown'], required: true },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    startTime: { type: Date, default: Date.now },
    endTime: Date,
    distanceKm: { type: Number, default: 0 },
    userCorrected: { type: Boolean, default: false }
});
exports.JourneySegment = mongoose_1.default.model('JourneySegment', journeySegmentSchema);
const expenseSchema = new mongoose_1.Schema({
    tripId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Trip', required: true },
    merchant: { type: String, default: '' },
    amount: { type: Number, required: true },
    category: { type: String, enum: ['transport', 'food', 'hotel', 'other'], default: 'other' },
    date: { type: Date, default: Date.now },
    source: { type: String, enum: ['ocr', 'manual'], required: true },
    ocrRawText: { type: String },
    confirmed: { type: Boolean, default: false }
});
exports.Expense = mongoose_1.default.model('Expense', expenseSchema);
const cityPackSchema = new mongoose_1.Schema({
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
exports.CityPack = mongoose_1.default.model('CityPack', cityPackSchema);
const safetyEventSchema = new mongoose_1.Schema({
    tripId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Trip', required: true },
    type: { type: String, enum: ['route-deviation', 'late-arrival', 'user-initiated-sos'], required: true },
    triggeredAt: { type: Date, default: Date.now },
    userResponse: String,
    resolvedAt: Date
});
exports.SafetyEvent = mongoose_1.default.model('SafetyEvent', safetyEventSchema);
const mobilityAggregateSchema = new mongoose_1.Schema({
    city: { type: String, required: true },
    areaCell: { type: String, required: true },
    timeBucket: { type: Date, required: true },
    modeCategory: { type: String, required: true },
    anonymousTripCount: { type: Number, default: 0 },
    issueCounts: { type: Map, of: Number, default: {} }
});
// Compound index for efficient querying and updating
mobilityAggregateSchema.index({ city: 1, areaCell: 1, timeBucket: 1, modeCategory: 1 }, { unique: true });
exports.MobilityAggregate = mongoose_1.default.model('MobilityAggregate', mobilityAggregateSchema);
const pilotSignupSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    email: String,
    city: { type: String, required: true },
    feedback: String,
    createdAt: { type: Date, default: Date.now }
});
exports.PilotSignup = mongoose_1.default.model('PilotSignup', pilotSignupSchema);
const citySpotSchema = new mongoose_1.Schema({
    city: { type: String, required: true, unique: true },
    source: { type: String, enum: ['curated-sample', 'wikipedia-live'], required: true },
    count: { type: Number, required: true },
    spots: [{
            name: { type: String, required: true },
            category: String,
            blurb: String
        }],
    fetchedAt: { type: Date, default: Date.now }
});
exports.CitySpot = mongoose_1.default.model('CitySpot', citySpotSchema);
const idempotencyKeySchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true },
    response: { type: mongoose_1.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now, expires: 86400 }
});
exports.IdempotencyKey = mongoose_1.default.model('IdempotencyKey', idempotencyKeySchema);
