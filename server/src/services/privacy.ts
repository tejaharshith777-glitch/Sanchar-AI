import geohash from 'ngeohash';
import { LocationPoint, MobilityAggregate } from '../models';

export async function processTripPrivacySync(tripId: string, city: string) {
  // 1. Fetch all location points for this trip
  const points = await LocationPoint.find({ tripId }).sort({ timestamp: 1 });
  if (points.length === 0) return;

  // 2. Compute total distance and strip first/last 500 meters
  // To simulate, we'll strip based on distance. For a real implementation, we'd use turf.js or harvesine
  // For the sake of the hackathon MVP, we drop the first 5 and last 5 points to approximate a buffer zone.
  let safePoints = points;
  if (points.length > 20) {
    safePoints = points.slice(5, -5);
  } else if (points.length > 10) {
    safePoints = points.slice(2, -2);
  } else {
    // Trip too short to safely aggregate without exposing endpoints
    return;
  }

  // 3. Bin into geohash cells (~500m precision is geohash length 6)
  const cellCounts = new Map<string, number>();
  
  for (const pt of safePoints) {
    const hash = geohash.encode(pt.lat, pt.lng, 6);
    const hourBucket = new Date(pt.timestamp);
    hourBucket.setMinutes(0, 0, 0); // truncate to hour

    // Create a unique key for the aggregate document
    const aggKey = `${city}_${hash}_${hourBucket.toISOString()}`;
    
    // We only increment the anonymousTripCount ONCE per trip per cell per hour.
    // If the trip stays in the cell, we don't count it as multiple trips.
    cellCounts.set(aggKey, (cellCounts.get(aggKey) || 0) + 1);
  }

  // 4. Update the Aggregates (upsert)
  // To avoid multiple counts, we just increment by 1 for each unique cell this trip touched.
  const uniqueCells = new Set<string>();
  for (const pt of safePoints) {
    const hash = geohash.encode(pt.lat, pt.lng, 6);
    const hourBucket = new Date(pt.timestamp);
    hourBucket.setMinutes(0, 0, 0);
    uniqueCells.add(JSON.stringify({ hash, hourBucket }));
  }

  for (const cellStr of uniqueCells) {
    const cell = JSON.parse(cellStr);
    await MobilityAggregate.findOneAndUpdate(
      { 
        city, 
        areaCell: cell.hash, 
        timeBucket: new Date(cell.hourBucket),
        modeCategory: 'mixed' // Simplification: in a real app, derive from segments
      },
      { $inc: { anonymousTripCount: 1 } },
      { upsert: true, new: true }
    );
  }
}
