import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus, Minus, Target, WifiOff } from 'lucide-react';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom map controls component
function MapController({ 
  userPos, 
  onLocateClick 
}: { 
  userPos: [number, number] | null;
  onLocateClick?: () => void;
}) {
  const map = useMap();

  return (
    <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
      {/* Zoom In */}
      <button 
        onClick={() => map.zoomIn()}
        className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all text-[#1F2937] font-bold cursor-pointer"
        title="Zoom In"
      >
        <Plus size={20} />
      </button>
      {/* Zoom Out */}
      <button 
        onClick={() => map.zoomOut()}
        className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all text-[#1F2937] font-bold cursor-pointer"
        title="Zoom Out"
      >
        <Minus size={20} />
      </button>
      {/* Locate Me */}
      <button 
        onClick={() => {
          if (userPos) {
            map.flyTo(userPos, 16, { animate: true, duration: 0.6 });
          }
          if (onLocateClick) onLocateClick();
        }}
        className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all text-[#00695C] font-bold cursor-pointer"
        title="Locate Me"
      >
        <Target size={20} />
      </button>
    </div>
  );
}

interface SancharMapProps {
  center: [number, number];
  zoom?: number;
  userPos?: [number, number] | null;
  trackPoints?: [number, number][];
  stillnessStops?: [number, number][];
  showOfflineBanner?: boolean;
  markers?: {
    position: [number, number];
    popupContent: React.ReactNode;
    iconEmoji?: string;
  }[];
  polylines?: {
    positions: [number, number][];
    color?: string;
    dashArray?: string;
  }[];
  heightClass?: string;
}

export default function SancharMap({
  center,
  zoom = 14,
  userPos = null,
  trackPoints = [],
  stillnessStops = [],
  showOfflineBanner = false,
  markers = [],
  polylines = [],
  heightClass = "h-[420px]"
}: SancharMapProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLocate = () => {
    if (userPos && mapRef.current) {
      mapRef.current.flyTo(userPos, 16, { animate: true, duration: 0.6 });
    }
  };

  return (
    <div className={`relative w-full ${heightClass} rounded-[20px] overflow-hidden shadow-md border border-gray-250`}>
      {/* Offline Styled Grid Fallback */}
      {!isOnline && (
        <div 
          className="absolute inset-0 bg-[#E0F2F1]/10 pointer-events-none z-0" 
          style={{
            backgroundImage: 'linear-gradient(rgba(0,105,92,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,105,92,0.04) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            backgroundColor: '#FAF7F2'
          }}
        />
      )}

      {/* Map Container */}
      <MapContainer
        center={center}
        zoom={zoom}
        zoomControl={false} // Disable default controls
        style={{ width: '100%', height: '100%', background: 'transparent' }}
        ref={mapRef}
      >
        {isOnline ? (
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : (
          // Local cached or placeholder tiles fallback
          <TileLayer
            attribution='&copy; Offline Map Cache'
            url="/tiles/{z}/{x}/{y}.png"
          />
        )}

        {/* Live track polyline */}
        {trackPoints.length > 0 && (
          <Polyline 
            positions={trackPoints} 
            pathOptions={{ color: '#008080', weight: 4, lineCap: 'round', lineJoin: 'round' }} 
          />
        )}

        {/* Custom configured polylines */}
        {polylines.map((p, idx) => (
          <Polyline 
            key={idx}
            positions={p.positions}
            pathOptions={{ color: p.color || '#F59E0B', dashArray: p.dashArray, weight: 3 }}
          />
        ))}

        {/* Stillness stops (white rings) */}
        {stillnessStops.map((stop, idx) => (
          <CircleMarker 
            key={idx}
            center={stop}
            radius={6}
            pathOptions={{ color: '#004D40', fillColor: '#FFFFFF', fillOpacity: 1, weight: 3 }}
          />
        ))}

        {/* Live User Position (pulsing teal dot) */}
        {userPos && (
          <>
            {/* Center dot */}
            <CircleMarker 
              center={userPos} 
              radius={6} 
              pathOptions={{ color: '#FFFFFF', fillColor: '#008080', fillOpacity: 1, weight: 2 }}
            />
          </>
        )}

        {/* Configured Map Markers */}
        {markers.map((m, idx) => {
          const icon = m.iconEmoji ? L.divIcon({
            html: `<div style="font-size:26px;line-height:1;text-align:center;">${m.iconEmoji}</div>`,
            className: 'poi-emoji-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16],
          }) : undefined;

          return (
            <Marker key={idx} position={m.position} icon={icon}>
              <Popup>{m.popupContent}</Popup>
            </Marker>
          );
        })}

        {/* Overlay controls */}
        <MapController userPos={userPos || center} onLocateClick={handleLocate} />
      </MapContainer>

      {/* Offline Banner */}
      {!isOnline && showOfflineBanner && (
        <div className="absolute top-3 right-3 z-[1000] bg-amber-50/95 backdrop-blur-xs border border-amber-200 text-amber-900 text-[10px] font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm">
          <WifiOff size={11} /> Offline map — showing saved route
        </div>
      )}
    </div>
  );
}
