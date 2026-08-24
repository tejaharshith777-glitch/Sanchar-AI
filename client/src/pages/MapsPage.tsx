import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCachedCityPack } from '../store/db';
import { Link } from 'react-router-dom';
import { Map as MapIcon, Download, Check, WifiOff, Compass, ChevronDown } from 'lucide-react';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── POI TYPE ICONS (emoji-based divIcons) ───
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

function createPoiIcon(type: string) {
  const emoji = POI_ICONS[type] || '📍';
  return L.divIcon({
    html: `<span style="font-size:24px;line-height:1;display:block;text-align:center;">${emoji}</span>`,
    className: 'poi-emoji-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

// ─── CITY CENTERS ───
const CITY_CENTERS: Record<string, [number, number]> = {
  Chennai: [13.0827, 80.2707],
  Kochi: [9.9312, 76.2673],
  Bengaluru: [12.9716, 77.5946],
  Mumbai: [18.9750, 72.8258],
  Delhi: [28.6139, 77.2090],
  Kolkata: [22.5726, 88.3639],
  Hyderabad: [17.3850, 78.4867],
  Jaipur: [26.9124, 75.7873],
};

const SHOWCASE_CITIES = ['Chennai', 'Kochi', 'Bengaluru', 'Mumbai', 'Delhi', 'Kolkata', 'Hyderabad', 'Jaipur'];

// ─── HAVERSINE ───
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function bearingToDir(b: number) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
  return dirs[Math.round(b / 45)];
}

// ─── MAP RECENTER COMPONENT ───
function RecenterMap({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

// ─── POI INTERFACE ───
interface POI {
  name: string;
  type: string;
  lat: number;
  lng: number;
}

// ─── TILE CACHE HELPERS ───
async function downloadTilesForCity(city: string, center: [number, number]): Promise<number> {
  const cache = await caches.open('sanchar-map-tiles');
  let count = 0;
  // Cache tiles at zoom levels 12-15 for a ~10km radius around center
  for (let z = 12; z <= 15; z++) {
    const tileX = Math.floor((center[1] + 180) / 360 * (1 << z));
    const tileY = Math.floor((1 - Math.log(Math.tan(center[0] * Math.PI / 180) + 1 / Math.cos(center[0] * Math.PI / 180)) / Math.PI) / 2 * (1 << z));
    // Download a 3x3 grid of tiles centered on the city
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const url = `https://tile.openstreetmap.org/${z}/${tileX + dx}/${tileY + dy}.png`;
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
            count++;
          }
        } catch { /* skip failed tiles */ }
      }
    }
  }
  // Store cache metadata
  localStorage.setItem(`sanchar_map_cache_${city}`, JSON.stringify({ cachedAt: Date.now(), tileCount: count }));
  return count;
}

function getCityTileCacheStatus(city: string): { cached: boolean; tileCount: number } {
  try {
    const data = JSON.parse(localStorage.getItem(`sanchar_map_cache_${city}`) || '{}');
    return { cached: !!data.cachedAt, tileCount: data.tileCount || 0 };
  } catch {
    return { cached: false, tileCount: 0 };
  }
}

// ─── MAPS PAGE ───
export default function MapsPage() {
  const [selectedCity, setSelectedCity] = useState('Chennai');
  const [pois, setPois] = useState<POI[]>([]);
  const [trackPoints, setTrackPoints] = useState<[number, number][]>([]);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [navTarget, setNavTarget] = useState<POI | null>(null);
  const [cityOpen, setCityOpen] = useState(false);
  const [_refreshKey, setRefreshKey] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const watchIdRef = useRef<number | null>(null);

  // Online/offline detection
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Load POIs from city pack
  useEffect(() => {
    getCachedCityPack(selectedCity).then(pack => {
      if (pack?.pois && Array.isArray(pack.pois)) {
        setPois(pack.pois.filter((p: any) => p.lat && p.lng));
      } else {
        setPois([]);
      }
    }).catch(() => setPois([]));
  }, [selectedCity]);

  // Derive tile status during render (no setState needed)
  const tileStatus = getCityTileCacheStatus(selectedCity);

  // GPS tracking
  useEffect(() => {
    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setCurrentPos(newPos);
          setTrackPoints(prev => {
            if (prev.length > 0) {
              const last = prev[prev.length - 1];
              const dist = haversineKm(last[0], last[1], newPos[0], newPos[1]);
              if (dist < 0.005) return prev; // Skip if < 5m
            }
            return [...prev.slice(-500), newPos]; // Keep last 500 points
          });
        },
        () => { /* GPS unavailable */ },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Download tiles
  const handleDownloadTiles = async () => {
    if (!isOnline) return;
    setDownloading(true);
    const center = CITY_CENTERS[selectedCity] || [13.0827, 80.2707];
    try {
      await downloadTilesForCity(selectedCity, center);
      setRefreshKey(k => k + 1); // force re-render to pick up new tile status
    } catch { /* ignore */ }
    setDownloading(false);
  };

  const mapCenter = CITY_CENTERS[selectedCity] || [13.0827, 80.2707];

  // Nav info
  const navInfo = navTarget && currentPos ? (() => {
    const dist = haversineKm(currentPos[0], currentPos[1], navTarget.lat, navTarget.lng);
    const bearing = getBearing(currentPos[0], currentPos[1], navTarget.lat, navTarget.lng);
    const dir = bearingToDir(bearing);
    const walkEta = Math.ceil(dist / 5 * 60); // 5km/h walking speed
    return { dist, dir, walkEta, bearing };
  })() : null;

  return (
    <div className="animate-fade-in-up flex flex-col h-full" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Top Bar */}
      <div className="p-4 bg-white border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link to="/" className="text-sm font-bold text-teal-700 flex items-center gap-1 no-underline shrink-0">
            <Check size={16} /> Home
          </Link>
          <span className="badge badge-teal"><MapIcon size={14} /> Maps</span>
          
          {/* City selector */}
          <div className="relative">
            <button
              onClick={() => setCityOpen(!cityOpen)}
              className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-[#1F2937] hover:bg-gray-100 transition-colors cursor-pointer"
            >
              {selectedCity} <ChevronDown size={14} />
            </button>
            {cityOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 min-w-[180px] max-h-[300px] overflow-y-auto">
                {SHOWCASE_CITIES.map(city => (
                  <button
                    key={city}
                    onClick={() => { setSelectedCity(city); setCityOpen(false); }}
                    className={`block w-full text-left px-4 py-2.5 text-sm hover:bg-teal-50 transition-colors cursor-pointer ${city === selectedCity ? 'font-bold text-[#00695C] bg-teal-50' : 'text-[#1F2937]'}`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tile cache status + download */}
        <div className="flex items-center gap-2 shrink-0">
          {tileStatus.cached ? (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
              <Check size={12} /> Map cache: {selectedCity} · works offline
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-200">
              No offline map cache
            </span>
          )}
          {isOnline && (
            <button
              onClick={handleDownloadTiles}
              disabled={downloading}
              className="text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-full border border-teal-200 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download size={12} /> {downloading ? 'Downloading…' : `Download map for ${selectedCity}`}
            </button>
          )}
        </div>
      </div>

      {/* Nav info bar */}
      {navTarget && navInfo && (
        <div className="px-4 py-3 bg-gradient-to-r from-teal-50 to-emerald-50 border-b border-teal-100 flex items-center gap-3 shrink-0">
          <Compass size={18} className="text-teal-700" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#1F2937] truncate">→ {navTarget.name}</p>
            <p className="text-xs text-[#64748B]">
              {navInfo.dist < 1 ? `${Math.round(navInfo.dist * 1000)}m` : `${navInfo.dist.toFixed(1)}km`} · {navInfo.dir} · ~{navInfo.walkEta} min walk
            </p>
            <p className="text-[10px] text-[#94A3B8] italic mt-0.5">Approximate offline route — best effort, no live road network</p>
          </div>
          <button
            onClick={() => setNavTarget(null)}
            className="text-xs font-bold text-red-600 hover:underline cursor-pointer shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative" style={{ minHeight: '400px' }}>
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ width: '100%', height: '100%', minHeight: '400px' }}
          scrollWheelZoom={true}
        >
          <RecenterMap center={mapCenter} zoom={13} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            errorTileUrl=""
          />

          {/* POIs with type icons */}
          {pois.map((poi, i) => (
            <Marker
              key={`poi-${i}`}
              position={[poi.lat, poi.lng]}
              icon={createPoiIcon(poi.type)}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold mb-1">{POI_ICONS[poi.type] || '📍'} {poi.name}</p>
                  <p className="text-xs text-gray-500 capitalize mb-2">{poi.type}</p>
                  {currentPos && (
                    <button
                      onClick={() => setNavTarget(poi)}
                      className="text-xs font-bold text-white bg-[#00695C] hover:bg-[#004D40] px-3 py-1.5 rounded-lg transition-colors w-full cursor-pointer"
                    >
                      Get approximate directions
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* User track polyline (teal) */}
          {trackPoints.length > 1 && (
            <Polyline positions={trackPoints} color="#00695C" weight={3} opacity={0.7} />
          )}

          {/* Current position dot */}
          {currentPos && (
            <CircleMarker
              center={currentPos}
              radius={8}
              pathOptions={{ color: '#00695C', fillColor: '#00695C', fillOpacity: 1, weight: 3 }}
            >
              <Popup>Your current location</Popup>
            </CircleMarker>
          )}

          {/* Nav bearing line (dashed) */}
          {navTarget && currentPos && (
            <Polyline
              positions={[currentPos, [navTarget.lat, navTarget.lng]]}
              color="#FF6F00"
              weight={2}
              opacity={0.8}
              dashArray="8 6"
            />
          )}
        </MapContainer>

        {/* Offline overlay for no tiles */}
        {!isOnline && !tileStatus.cached && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-[1000] pointer-events-none">
            <div className="text-center p-6">
              <WifiOff size={40} className="text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-bold text-[#1F2937] mb-1">No offline data here</p>
              <p className="text-xs text-[#64748B]">Online needed for this area. Download map tiles while connected.</p>
            </div>
          </div>
        )}
      </div>

      {/* Privacy note */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center shrink-0">
        <p className="text-[10px] text-[#94A3B8]">Your tracks are stored locally only · Anonymous aggregates shown only with consent ON</p>
      </div>
    </div>
  );
}
