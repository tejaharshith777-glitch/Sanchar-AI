import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Trip, LocationPoint, JourneySegment, Expense, CityPack, SafetyEvent, MobilityAggregate } from '../models';
import { processTripPrivacySync } from '../services/privacy';

const router = Router();

// Rate limiter for API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // Limit each IP to 1000 requests per windowMs
});
router.use(apiLimiter);

// ---------------------------
// HEALTH & UTILS
// ---------------------------
router.get('/health', (req, res) => {
  res.json({ status: 'live', timestamp: new Date() });
});

router.get('/cities', (req, res) => {
  res.json({ cities: ["Chennai", "Coimbatore", "Madurai", "Kochi", "Bengaluru", "Mumbai", "Pune", "Delhi", "Jaipur", "Kolkata", "Bhubaneswar", "Ahmedabad", "Guwahati", "Varanasi", "Other City"] });
});

router.get('/city-packs/:city', async (req, res) => {
  try {
    const city = req.params.city;
    let pack = await CityPack.findOne({ city });
    if (!pack) pack = await CityPack.findOne({ city: 'default' }); // Fallback
    res.json(pack);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------
// TRIPS
// ---------------------------
router.post('/trips', async (req, res) => {
  try {
    const trip = new Trip(req.body);
    await trip.save();
    res.status(201).json(trip);
  } catch (error) {
    res.status(400).json({ error: 'Invalid trip data' });
  }
});

router.get('/trips/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/trips/:id', async (req, res) => {
  try {
    const trip = await Trip.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(trip);
  } catch (error) {
    res.status(400).json({ error: 'Invalid update' });
  }
});

router.post('/trips/:id/start', async (req, res) => {
  try {
    const trip = await Trip.findByIdAndUpdate(req.params.id, { status: 'active', startTime: new Date() }, { new: true });
    res.json(trip);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/trips/:id/complete', async (req, res) => {
  try {
    const trip = await Trip.findByIdAndUpdate(req.params.id, { status: 'completed', endTime: new Date() }, { new: true });
    res.json(trip);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/trips/:id/points', async (req, res) => {
  try {
    const { points } = req.body; // Array of points
    // Basic idempotency could be checked here via point timestamps, but skipping for brevity
    const pointsWithTrip = points.map((p: any) => ({ ...p, tripId: req.params.id }));
    await LocationPoint.insertMany(pointsWithTrip);
    res.status(201).json({ success: true, count: points.length });
  } catch (error) {
    res.status(400).json({ error: 'Invalid points' });
  }
});

// ---------------------------
// SEGMENTS
// ---------------------------
router.post('/trips/:id/segments', async (req, res) => {
  try {
    const segment = new JourneySegment({ ...req.body, tripId: req.params.id });
    await segment.save();
    res.status(201).json(segment);
  } catch (error) { res.status(400).json({ error: 'Invalid segment' }); }
});

router.patch('/segments/:id', async (req, res) => {
  try {
    const segment = await JourneySegment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(segment);
  } catch (error) { res.status(400).json({ error: 'Invalid update' }); }
});

// ---------------------------
// EXPENSES
// ---------------------------
router.post('/trips/:id/expenses', async (req, res) => {
  try {
    const expense = new Expense({ ...req.body, tripId: req.params.id });
    await expense.save();
    // Update trip budget
    await Trip.findByIdAndUpdate(req.params.id, { $inc: { amountSpent: expense.amount } });
    res.status(201).json(expense);
  } catch (error) { res.status(400).json({ error: 'Invalid expense' }); }
});

router.get('/trips/:id/expenses', async (req, res) => {
  try {
    const expenses = await Expense.find({ tripId: req.params.id });
    res.json(expenses);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

router.patch('/expenses/:id', async (req, res) => {
  try {
    const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(expense);
  } catch (error) { res.status(400).json({ error: 'Invalid update' }); }
});

router.delete('/expenses/:id', async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (expense) {
      await Trip.findByIdAndUpdate(expense.tripId, { $inc: { amountSpent: -expense.amount } });
    }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

// ---------------------------
// SAFETY EVENTS
// ---------------------------
router.post('/trips/:id/safety-events', async (req, res) => {
  try {
    const event = new SafetyEvent({ ...req.body, tripId: req.params.id });
    await event.save();
    res.status(201).json(event);
  } catch (error) { res.status(400).json({ error: 'Invalid safety event' }); }
});

// ---------------------------
// PRIVACY / SYNC / DASHBOARD
// ---------------------------
router.post('/sync/:tripId', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // ONLY invoke privacy pipeline if consent is TRUE
    if (trip.analyticsConsent) {
      await processTripPrivacySync(trip.id, trip.destinationCity);
    }
    
    res.json({ success: true, analyticsProcessed: trip.analyticsConsent });
  } catch (error) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

// NOTE: Dashboard endpoints NEVER read LocationPoints. They only read MobilityAggregates.
router.get('/mobility/summary', async (req, res) => {
  try {
    const agg = await MobilityAggregate.aggregate([
      { $group: { _id: null, totalTrips: { $sum: "$anonymousTripCount" } } }
    ]);
    res.json({ totalTrips: agg[0]?.totalTrips || 0 });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/mobility/heatmap', async (req, res) => {
  try {
    const heat = await MobilityAggregate.find({}, 'areaCell anonymousTripCount timeBucket modeCategory');
    // Suppress low volume cells before sending to client
    const safeHeat = heat.filter(h => h.anonymousTripCount >= 3);
    res.json(safeHeat);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

export default router;
