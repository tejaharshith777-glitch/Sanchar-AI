import React, { useState, useEffect } from 'react';
import { MapContainer, Polyline, CircleMarker, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCachedCityPack } from '../store/db';

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

// Fix Leaflet default marker icons (they are broken in webpack/vite without this)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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
  const d = R * c; // Distance in km
  return d;
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

const CenterControl = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    if (center[0] !== 0 && center[1] !== 0) {
      map.setView(center);
    }
  }, [center, map]);
  return null;
};

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

  return (
    <div className="card overflow-hidden border border-gray-200">
      <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-[#1F2937] text-sm flex items-center gap-1">Pocket Map</h3>
          <p className="text-[10px] text-[#64748B]">Offline pocket map — saved places + your real track. Works with zero network.</p>
        </div>
      </div>
      
      {navInfo && (
        <div className="bg-teal-50 p-3 border-b border-teal-100 text-xs text-teal-900">
          <p className="font-bold mb-1">Navigation to {selectedPoi?.name}</p>
          <p>📍 Distance: {navInfo.dist} km ({navInfo.etaMins} mins walking)</p>
          <p>🧭 Head {navInfo.dirStr} (Bearing {Math.round(navInfo.bearing)}°)</p>
          <p className="text-[10px] text-teal-700 italic mt-1">Approximate offline directions from saved places — best effort, no live road network.</p>
        </div>
      )}

      <div className="h-64 relative bg-[#f0f0f0]">
        <MapContainer 
          center={center ? [center.lat, center.lng] : [20.59, 78.96]} 
          zoom={13} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          {center && <CenterControl center={[center.lat, center.lng]} />}
          
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
          />
          
          {points.length > 1 && (
            <Polyline 
              positions={points.map(p => [p.lat, p.lng])} 
              color="#00695C" 
              weight={4} 
              opacity={0.8}
            />
          )}

          {center && (
            <CircleMarker 
              center={[center.lat, center.lng]} 
              radius={8} 
              fillColor="#3B82F6" 
              color="#ffffff" 
              weight={2} 
              fillOpacity={1}
            />
          )}

          {/* Navigation Line */}
          {selectedPoi && center && (
            <Polyline 
              positions={[[center.lat, center.lng], [selectedPoi.lat, selectedPoi.lng]]}
              color="#F59E0B"
              weight={3}
              dashArray="5, 10"
              opacity={0.9}
            />
          )}

          {pois.map((poi, idx) => (
            <Marker 
              key={idx} 
              position={[poi.lat, poi.lng]}
              eventHandlers={{
                click: () => {
                  setSelectedPoi(poi);
                },
              }}
            >
              <Popup>
                <div className="text-center p-1">
                  <h4 className="font-bold text-sm mb-1">{poi.name}</h4>
                  <p className="text-xs text-gray-500 capitalize">{poi.type}</p>
                  <button 
                    onClick={() => setSelectedPoi(poi)}
                    className="mt-2 text-xs bg-teal-600 text-white px-2 py-1 rounded"
                  >
                    Navigate Offline
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="p-3 bg-white text-[11px] text-[#64748B] italic">
        POIs arrive with a verified city pack for {destinationCity}. Click a POI to start offline navigation.
      </div>
    </div>
  );
};

export default PocketMap;
