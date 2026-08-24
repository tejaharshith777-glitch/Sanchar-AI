import React, { useState, useEffect } from 'react';
import { getCachedCityPack } from '../store/db';
import SancharMap from './SancharMap';

interface POI {
  name: string;
  type: string;
  lat: number;
  lng: number;
}

interface PocketMapProps {
  points: { lat: number; lng: number }[];
  currentLocation?: { lat: number; lng: number };
  destinationCity: string;
}

// Haversine distance in km
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}

function getBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLon = deg2rad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(deg2rad(lat2));
  const x = Math.cos(deg2rad(lat1)) * Math.sin(deg2rad(lat2)) -
            Math.sin(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.cos(dLon);
  const brng = Math.atan2(y, x);
  return (brng * 180 / Math.PI + 360) % 360;
}

function getDirectionString(bearing: number) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
  return dirs[Math.round(bearing / 45)];
}

const PocketMap: React.FC<PocketMapProps> = ({ points, currentLocation, destinationCity }) => {
  const [pois, setPois] = useState<POI[]>([]);
  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);

  useEffect(() => {
    const loadPois = async () => {
      if (!destinationCity) return;
      try {
        const pack = await getCachedCityPack(destinationCity);
        if (pack && pack.pois) {
          setPois(pack.pois);
        }
      } catch (e) {
        console.warn('Failed to load POIs from cache', e);
      }
    };
    loadPois();
  }, [destinationCity]);

  const center = currentLocation || (points.length > 0 ? points[points.length - 1] : null);
  const centerCoords: [number, number] = center ? [center.lat, center.lng] : [20.59, 78.96];

  let navInfo = null;
  if (selectedPoi && center) {
    const dist = getDistanceFromLatLonInKm(center.lat, center.lng, selectedPoi.lat, selectedPoi.lng);
    const bearing = getBearing(center.lat, center.lng, selectedPoi.lat, selectedPoi.lng);
    const etaMins = Math.round((dist / 4.5) * 60); // 4.5 km/h walking
    
    navInfo = {
      dist: dist.toFixed(2),
      bearing,
      dirStr: getDirectionString(bearing),
      etaMins
    };
  }

  // POI Type Icons for Map Markers
  const POI_ICONS: Record<string, string> = {
    hotel: '🏨',
    hospital: '🚑',
    police: '🚓',
    temple: '🏛️',
    attraction: '🏛️',
    park: '🌳',
    water: '💧',
    luggageStorage: '🧳',
    station: '🚉',
  };

  return (
    <div className="card overflow-hidden border border-gray-250 relative">
      {/* Active Trip Map Header Info */}
      <div className="absolute top-3 left-3 z-[1000] bg-[#00695C]/95 backdrop-blur-xs text-white text-[10px] font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Tracking · low power
      </div>

      <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between pt-12">
        <div>
          <h3 className="font-bold text-[#1F2937] text-sm flex items-center gap-1">Pocket Map</h3>
          <p className="text-[10px] text-[#64748B]">Offline pocket map — saved places + your real track.</p>
        </div>
      </div>
      
      {navInfo && (
        <div className="bg-teal-50 p-3 border-b border-teal-100 text-xs text-teal-900">
          <p className="font-bold mb-1">Navigation to {selectedPoi?.name}</p>
          <p>📍 Distance: {navInfo.dist} km ({navInfo.etaMins} mins walking)</p>
          <p>🧭 Head {navInfo.dirStr} (Bearing {Math.round(navInfo.bearing)}°)</p>
          <p className="text-[10px] text-teal-700 italic mt-1">Approximate offline directions — best effort, no live road network.</p>
        </div>
      )}

      <div className="relative">
        <SancharMap 
          center={centerCoords}
          zoom={13}
          userPos={center ? [center.lat, center.lng] : null}
          trackPoints={points.map(p => [p.lat, p.lng])}
          showOfflineBanner={true}
          heightClass="h-[45vh] md:h-[420px]"
          markers={pois.map(poi => ({
            position: [poi.lat, poi.lng],
            popupContent: (
              <div className="text-center p-1">
                <h4 className="font-bold text-sm mb-1">{poi.name}</h4>
                <p className="text-xs text-gray-500 capitalize">{poi.type}</p>
                <button 
                  onClick={() => setSelectedPoi(poi)}
                  className="mt-2 text-xs bg-teal-600 text-white px-2 py-1 rounded cursor-pointer"
                >
                  Navigate Offline
                </button>
              </div>
            ),
            iconEmoji: POI_ICONS[poi.type] || '📍'
          }))}
          polylines={selectedPoi && center ? [
            {
              positions: [[center.lat, center.lng], [selectedPoi.lat, selectedPoi.lng]],
              color: '#F59E0B',
              dashArray: '5, 10'
            }
          ] : []}
        />
      </div>
      
      <div className="p-3 bg-white text-[11px] text-[#64748B] italic">
        POIs arrive with a verified city pack for {destinationCity}. Click a POI to start offline navigation.
      </div>
    </div>
  );
};

export default PocketMap;
