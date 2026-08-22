import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Trip, LocationPoint, JourneySegment, Expense, CityPack, SafetyEvent, MobilityAggregate, PilotSignup } from '../models';
import { processTripPrivacySync } from '../services/privacy';
import { isMemoryFallback, memoryStore } from '../services/db';

const router = Router();

// Rate limiter for API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // Limit each IP to 1000 requests per windowMs
});
router.use(apiLimiter);

// Helper to generate IDs for memory store objects
const generateId = () => 'mem_' + Math.random().toString(36).substring(2, 11);

// ---------------------------
// HEALTH & UTILS
// ---------------------------
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    db: isMemoryFallback ? 'memory' : 'atlas',
    timestamp: new Date()
  });
});

router.get('/cities', (req, res) => {
  res.json({
    cities: [
      "Chennai", "Coimbatore", "Madurai", "Kochi", "Bengaluru",
      "Mumbai", "Pune", "Delhi", "Jaipur", "Kolkata",
      "Bhubaneswar", "Ahmedabad", "Guwahati", "Varanasi", "Other City"
    ]
  });
});

router.get('/city-packs/:city', async (req, res) => {
  try {
    const city = req.params.city;
    if (isMemoryFallback) {
      let pack = memoryStore.cityPacks.find(p => p.city.toLowerCase() === city.toLowerCase());
      if (!pack) pack = memoryStore.cityPacks.find(p => p.city === 'default');
      return res.json(pack);
    }

    let pack = await CityPack.findOne({ city });
    if (!pack) pack = await CityPack.findOne({ city: 'default' }); // Fallback
    res.json(pack);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------
// SITE STATISTICS (GET /api/site-stats)
// ---------------------------
router.get('/site-stats', async (req, res) => {
  try {
    let tripsRecorded = 0;
    let cityPacksLive = 0;
    let languagesSupported = 6;
    let safetyChecks = 0;

    if (isMemoryFallback) {
      tripsRecorded = memoryStore.trips.length;
      cityPacksLive = memoryStore.cityPacks.length;
      safetyChecks = memoryStore.safetyEvents.length;
    } else {
      tripsRecorded = await Trip.countDocuments();
      cityPacksLive = await CityPack.countDocuments();
      safetyChecks = await SafetyEvent.countDocuments();
    }

    res.json({
      tripsRecorded,
      cityPacksLive,
      languagesSupported,
      safetyChecks
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch site statistics' });
  }
});

// ---------------------------
// PILOT SIGNUPS (POST /api/pilot-signups)
// ---------------------------
router.post('/pilot-signups', async (req, res) => {
  try {
    const { name, email, city, feedback } = req.body;
    if (!name || !city) {
      return res.status(400).json({ error: 'Name and City are required fields.' });
    }

    let totalSignups = 0;

    if (isMemoryFallback) {
      const record = {
        _id: generateId(),
        name,
        email,
        city,
        feedback,
        createdAt: new Date()
      };
      memoryStore.pilotSignups.push(record);
      totalSignups = memoryStore.pilotSignups.length;
    } else {
      const signup = new PilotSignup({ name, email, city, feedback });
      await signup.save();
      totalSignups = await PilotSignup.countDocuments();
    }

    res.status(201).json({
      success: true,
      message: "You're on the list",
      count: totalSignups
    });
  } catch (error) {
    res.status(500).json({ error: "Couldn't save — try again" });
  }
});

// ---------------------------
// TRIPS
// ---------------------------
router.post('/trips', async (req, res) => {
  try {
    const tripData = {
      ...req.body,
      expectedArrival: req.body.expectedArrival ? new Date(req.body.expectedArrival) : null,
      lastLateArrivalTriggerAt: null,
      lastRouteDeviationTriggerAt: null
    };

    if (isMemoryFallback) {
      const trip = {
        _id: generateId(),
        ...tripData,
        status: req.body.status || 'created',
        amountSpent: 0,
        createdAt: new Date()
      };
      memoryStore.trips.push(trip);
      return res.status(201).json(trip);
    }

    const trip = new Trip(tripData);
    await trip.save();
    res.status(201).json(trip);
  } catch (error) {
    res.status(400).json({ error: 'Invalid trip data' });
  }
});

router.get('/trips/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMemoryFallback) {
      const trip = memoryStore.trips.find(t => t._id === id);
      if (!trip) return res.status(404).json({ error: 'Trip not found' });
      return res.json(trip);
    }

    const trip = await Trip.findById(id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/trips/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMemoryFallback) {
      const tripIdx = memoryStore.trips.findIndex(t => t._id === id);
      if (tripIdx === -1) return res.status(404).json({ error: 'Trip not found' });
      memoryStore.trips[tripIdx] = { ...memoryStore.trips[tripIdx], ...req.body };
      return res.json(memoryStore.trips[tripIdx]);
    }

    const trip = await Trip.findByIdAndUpdate(id, req.body, { new: true });
    res.json(trip);
  } catch (error) {
    res.status(400).json({ error: 'Invalid update' });
  }
});

router.post('/trips/:id/start', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMemoryFallback) {
      const tripIdx = memoryStore.trips.findIndex(t => t._id === id);
      if (tripIdx === -1) return res.status(404).json({ error: 'Trip not found' });
      memoryStore.trips[tripIdx].status = 'active';
      memoryStore.trips[tripIdx].startTime = new Date();
      return res.json(memoryStore.trips[tripIdx]);
    }

    const trip = await Trip.findByIdAndUpdate(id, { status: 'active', startTime: new Date() }, { new: true });
    res.json(trip);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/trips/:id/complete', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMemoryFallback) {
      const tripIdx = memoryStore.trips.findIndex(t => t._id === id);
      if (tripIdx === -1) return res.status(404).json({ error: 'Trip not found' });
      memoryStore.trips[tripIdx].status = 'completed';
      memoryStore.trips[tripIdx].endTime = new Date();
      return res.json(memoryStore.trips[tripIdx]);
    }

    const trip = await Trip.findByIdAndUpdate(id, { status: 'completed', endTime: new Date() }, { new: true });
    res.json(trip);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/trips/:id/points', async (req, res) => {
  try {
    const id = req.params.id;
    const { points } = req.body;
    const pointsWithTrip = points.map((p: any) => ({
      _id: generateId(),
      ...p,
      tripId: id,
      timestamp: p.timestamp ? new Date(p.timestamp) : new Date()
    }));

    if (isMemoryFallback) {
      memoryStore.locationPoints.push(...pointsWithTrip);
      return res.status(201).json({ success: true, count: points.length });
    }

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
    const id = req.params.id;
    if (isMemoryFallback) {
      const segment = {
        _id: generateId(),
        ...req.body,
        tripId: id,
        startTime: req.body.startTime ? new Date(req.body.startTime) : new Date()
      };
      memoryStore.journeySegments.push(segment);
      return res.status(201).json(segment);
    }

    const segment = new JourneySegment({ ...req.body, tripId: id });
    await segment.save();
    res.status(201).json(segment);
  } catch (error) {
    res.status(400).json({ error: 'Invalid segment' });
  }
});

router.patch('/segments/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMemoryFallback) {
      const segIdx = memoryStore.journeySegments.findIndex(s => s._id === id);
      if (segIdx === -1) return res.status(404).json({ error: 'Segment not found' });
      memoryStore.journeySegments[segIdx] = { ...memoryStore.journeySegments[segIdx], ...req.body };
      return res.json(memoryStore.journeySegments[segIdx]);
    }

    const segment = await JourneySegment.findByIdAndUpdate(id, req.body, { new: true });
    res.json(segment);
  } catch (error) {
    res.status(400).json({ error: 'Invalid update' });
  }
});

// ---------------------------
// EXPENSES
// ---------------------------
router.post('/trips/:id/expenses', async (req, res) => {
  try {
    const id = req.params.id;
    const amount = Number(req.body.amount || 0);

    if (isMemoryFallback) {
      const expense = {
        _id: generateId(),
        ...req.body,
        amount,
        tripId: id,
        date: new Date()
      };
      memoryStore.expenses.push(expense);

      const tripIdx = memoryStore.trips.findIndex(t => t._id === id);
      if (tripIdx !== -1) {
        memoryStore.trips[tripIdx].amountSpent = (memoryStore.trips[tripIdx].amountSpent || 0) + amount;
      }
      return res.status(201).json(expense);
    }

    const expense = new Expense({ ...req.body, tripId: id });
    await expense.save();
    await Trip.findByIdAndUpdate(id, { $inc: { amountSpent: expense.amount } });
    res.status(201).json(expense);
  } catch (error) {
    res.status(400).json({ error: 'Invalid expense' });
  }
});

router.get('/trips/:id/expenses', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMemoryFallback) {
      const expenses = memoryStore.expenses.filter(e => e.tripId === id);
      return res.json(expenses);
    }

    const expenses = await Expense.find({ tripId: id });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/expenses/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMemoryFallback) {
      const expIdx = memoryStore.expenses.findIndex(e => e._id === id);
      if (expIdx === -1) return res.status(404).json({ error: 'Expense not found' });
      
      const oldAmount = memoryStore.expenses[expIdx].amount;
      memoryStore.expenses[expIdx] = { ...memoryStore.expenses[expIdx], ...req.body };
      const newAmount = Number(memoryStore.expenses[expIdx].amount || 0);
      
      const tripIdx = memoryStore.trips.findIndex(t => t._id === memoryStore.expenses[expIdx].tripId);
      if (tripIdx !== -1) {
        memoryStore.trips[tripIdx].amountSpent = (memoryStore.trips[tripIdx].amountSpent || 0) - oldAmount + newAmount;
      }
      return res.json(memoryStore.expenses[expIdx]);
    }

    const expense = await Expense.findByIdAndUpdate(id, req.body, { new: true });
    res.json(expense);
  } catch (error) {
    res.status(400).json({ error: 'Invalid update' });
  }
});

router.delete('/expenses/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMemoryFallback) {
      const expIdx = memoryStore.expenses.findIndex(e => e._id === id);
      if (expIdx === -1) return res.status(404).json({ error: 'Expense not found' });
      
      const expense = memoryStore.expenses[expIdx];
      memoryStore.expenses.splice(expIdx, 1);
      
      const tripIdx = memoryStore.trips.findIndex(t => t._id === expense.tripId);
      if (tripIdx !== -1) {
        memoryStore.trips[tripIdx].amountSpent = (memoryStore.trips[tripIdx].amountSpent || 0) - expense.amount;
      }
      return res.json({ success: true });
    }

    const expense = await Expense.findByIdAndDelete(id);
    if (expense) {
      await Trip.findByIdAndUpdate(expense.tripId, { $inc: { amountSpent: -expense.amount } });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------
// SAFETY EVENTS
// ---------------------------
router.post('/trips/:id/safety-events', async (req, res) => {
  try {
    const id = req.params.id;
    if (isMemoryFallback) {
      const event = {
        _id: generateId(),
        ...req.body,
        tripId: id,
        triggeredAt: new Date()
      };
      memoryStore.safetyEvents.push(event);
      return res.status(201).json(event);
    }

    const event = new SafetyEvent({ ...req.body, tripId: id });
    await event.save();
    res.status(201).json(event);
  } catch (error) {
    res.status(400).json({ error: 'Invalid safety event' });
  }
});

// ---------------------------
// PRIVACY / SYNC / DASHBOARD
// ---------------------------
router.post('/sync/:tripId', async (req, res) => {
  try {
    const id = req.params.tripId;
    let consent = false;
    let destination = '';

    if (isMemoryFallback) {
      const trip = memoryStore.trips.find(t => t._id === id);
      if (!trip) return res.status(404).json({ error: 'Trip not found' });
      consent = !!trip.analyticsConsent;
      destination = trip.destinationCity;

      if (consent) {
        memoryStore.mobilityAggregates.push({
          city: destination,
          areaCell: 'mem_geohash_' + Math.random().toString(36).substring(2, 5),
          timeBucket: new Date(),
          modeCategory: 'rail',
          anonymousTripCount: 1,
          issueCounts: new Map()
        });
      }
    } else {
      const trip = await Trip.findById(id);
      if (!trip) return res.status(404).json({ error: 'Trip not found' });
      consent = !!trip.analyticsConsent;
      destination = trip.destinationCity;

      if (consent) {
        await processTripPrivacySync(trip.id, destination);
      }
    }
    
    res.json({ success: true, analyticsProcessed: consent });
  } catch (error) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

// NOTE: Dashboard endpoints NEVER read LocationPoints. They only read MobilityAggregates.
router.get('/mobility/summary', async (req, res) => {
  try {
    if (isMemoryFallback) {
      const totalTrips = memoryStore.mobilityAggregates.length;
      return res.json({ totalTrips });
    }

    const agg = await MobilityAggregate.aggregate([
      { $group: { _id: null, totalTrips: { $sum: "$anonymousTripCount" } } }
    ]);
    res.json({ totalTrips: agg[0]?.totalTrips || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/mobility/heatmap', async (req, res) => {
  try {
    if (isMemoryFallback) {
      // In memory fallback we mock data to make sure demo works smoothly
      return res.json(memoryStore.mobilityAggregates);
    }

    const heat = await MobilityAggregate.find({}, 'areaCell anonymousTripCount timeBucket modeCategory');
    // Suppress low volume cells before sending to client
    const safeHeat = heat.filter(h => h.anonymousTripCount >= 3);
    res.json(safeHeat);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
