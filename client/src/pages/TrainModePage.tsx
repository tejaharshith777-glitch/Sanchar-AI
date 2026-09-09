import React, { useState, useEffect, useRef } from 'react';
import { Train, Bell, MapPin, Shield, CheckCircle, Phone, Zap, Volume2 } from 'lucide-react';

interface Station {
  code: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
}

const POPULAR_INDIAN_STATIONS: Station[] = [
  { code: "MAS", name: "Puratchi Thalaivar Dr. M.G. Ramachandran Central (Chennai Central)", city: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2757 },
  { code: "NDLS", name: "New Delhi Railway Station", city: "New Delhi", state: "Delhi", lat: 28.6430, lng: 77.2197 },
  { code: "CSMT", name: "Chhatrapati Shivaji Maharaj Terminus", city: "Mumbai", state: "Maharashtra", lat: 18.9402, lng: 72.8356 },
  { code: "HWH", name: "Howrah Junction", city: "Kolkata", state: "West Bengal", lat: 22.5830, lng: 88.3426 },
  { code: "SBC", name: "KSR Bengaluru City Junction", city: "Bengaluru", state: "Karnataka", lat: 12.9781, lng: 77.5694 },
  { code: "HYB", name: "Hyderabad Deccan (Nampally)", city: "Hyderabad", state: "Telangana", lat: 17.3920, lng: 78.4682 },
  { code: "BSB", name: "Varanasi Junction", city: "Varanasi", state: "Uttar Pradesh", lat: 25.3268, lng: 82.9863 },
  { code: "JP", name: "Jaipur Junction", city: "Jaipur", state: "Rajasthan", lat: 26.9200, lng: 75.7878 },
  { code: "ERS", name: "Ernakulam Junction (Kochi South)", city: "Kochi", state: "Kerala", lat: 9.9678, lng: 76.2891 },
  { code: "GHY", name: "Guwahati Railway Station", city: "Guwahati", state: "Assam", lat: 26.1856, lng: 91.7539 },
  { code: "ADI", name: "Ahmedabad Junction", city: "Ahmedabad", state: "Gujarat", lat: 23.0270, lng: 72.6012 },
  { code: "UAM", name: "Udhagamandalam (Ooty Toy Train Station)", city: "Ooty", state: "Tamil Nadu", lat: 11.4060, lng: 76.6960 }
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export const TrainModePage: React.FC = () => {
  const [selectedStation, setSelectedStation] = useState<Station>(POPULAR_INDIAN_STATIONS[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [alarmRadiusKm, setAlarmRadiusKm] = useState(3);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [currentDist, setCurrentDist] = useState<number | null>(null);
  const [alarmTriggered, setAlarmTriggered] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  const watchIdRef = useRef<number | null>(null);

  const filteredStations = POPULAR_INDIAN_STATIONS.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (isAlarmActive && navigator.geolocation) {
      setAlarmTriggered(false);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const uLat = pos.coords.latitude;
          const uLng = pos.coords.longitude;
          setUserPos({ lat: uLat, lng: uLng });
          const dist = haversineKm(uLat, uLng, selectedStation.lat, selectedStation.lng);
          setCurrentDist(dist);

          if (dist <= alarmRadiusKm) {
            setAlarmTriggered(true);
            if ('vibrate' in navigator) {
              navigator.vibrate([1000, 500, 1000, 500, 1000]);
            }
            if ('speechSynthesis' in window) {
              const msg = new SpeechSynthesisUtterance(`Attention passenger! Approaching ${selectedStation.name}. Please prepare your luggage.`);
              window.speechSynthesis.speak(msg);
            }
          }
        },
        (err) => console.warn('[Train Alarm GPS Error]', err),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isAlarmActive, selectedStation, alarmRadiusKm]);

  // Demo approach simulator for testing
  const simulateApproach = () => {
    const mockDistance = alarmRadiusKm - 0.5; // Trigger alarm threshold
    setCurrentDist(mockDistance);
    setAlarmTriggered(true);
    if ('vibrate' in navigator) {
      navigator.vibrate([1000, 500, 1000]);
    }
    if ('speechSynthesis' in window) {
      const msg = new SpeechSynthesisUtterance(`Station Alert! Approaching ${selectedStation.name}. Get ready.`);
      window.speechSynthesis.speak(msg);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#004D40] to-[#00695C] text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
          <Train size={220} />
        </div>
        <div className="relative z-10 max-w-2xl space-y-3">
          <span className="bg-amber-400/20 text-amber-300 border border-amber-300/30 text-[11px] font-bold px-3 py-1 rounded-full inline-flex items-center gap-1.5 uppercase tracking-wider">
            <Zap size={12} /> Airplane-Mode Geofence
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-['Plus_Jakarta_Sans']">
            Train Mode & Station Geofence Alarm
          </h1>
          <p className="text-teal-100 text-xs sm:text-sm leading-relaxed font-medium">
            Sleep peacefully on Indian trains. Set an offline GPS station wake-up alarm that vibrates & rings before your station, working 100% offline in airplane mode.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Alarm Control & Station Selector */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Bell size={20} className="text-[#00695C]" />
              Offline Station Wake Alarm
            </h2>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <CheckCircle size={10} /> Airplane Mode GPS Ready
            </span>
          </div>

          {/* Target Station Card */}
          <div className="bg-teal-50/60 p-4 sm:p-5 rounded-2xl border border-teal-150 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-extrabold bg-[#00695C] text-white px-2 py-0.5 rounded-md">
                  STATION CODE: {selectedStation.code}
                </span>
                <h3 className="text-base font-bold text-gray-900 mt-1.5">{selectedStation.name}</h3>
                <p className="text-xs text-gray-600 font-medium">{selectedStation.city}, {selectedStation.state}</p>
              </div>
              <MapPin size={24} className="text-[#00695C] shrink-0" />
            </div>

            {currentDist !== null && (
              <div className="pt-2 border-t border-teal-200/60 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-gray-800">
                  <span>Distance to Station:</span>
                  <span className="text-[#00695C] text-sm font-extrabold">{currentDist} km</span>
                </div>
                {userPos && (
                  <p className="text-[10px] text-gray-500 font-mono">
                    Live GPS: {userPos.lat.toFixed(4)}°N, {userPos.lng.toFixed(4)}°E
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Alarm Radius Picker */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">Wake-up Alarm Distance (Geofence Radius)</label>
            <div className="grid grid-cols-3 gap-3">
              {[1, 3, 5].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setAlarmRadiusKm(r)}
                  className={`p-3 rounded-2xl border text-xs font-bold transition cursor-pointer flex flex-col items-center gap-1 ${
                    alarmRadiusKm === r
                      ? 'bg-[#00695C] text-white border-[#00695C] shadow-md'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-sm font-extrabold">{r} km before</span>
                  <span className="text-[10px] opacity-80 font-normal">
                    {r === 1 ? '~3-5 mins' : r === 3 ? '~10 mins' : '~15 mins'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Trigger Alert Notification Box */}
          {alarmTriggered && (
            <div className="bg-red-500 text-white p-5 rounded-2xl shadow-xl flex items-center justify-between gap-4 animate-bounce">
              <div className="flex items-center gap-3">
                <Bell size={28} className="animate-spin" />
                <div>
                  <h4 className="font-extrabold text-base">APPROACHING STATION!</h4>
                  <p className="text-xs text-red-100">You are within {alarmRadiusKm} km of {selectedStation.name}.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAlarmTriggered(false)}
                className="bg-white text-red-700 font-bold text-xs px-3.5 py-2 rounded-xl shadow-md cursor-pointer shrink-0"
              >
                Dismiss Alarm
              </button>
            </div>
          )}

          {/* Alarm Action Button */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAlarmActive(!isAlarmActive)}
              className={`w-full py-4 rounded-2xl font-bold text-sm sm:text-base transition cursor-pointer shadow-lg flex items-center justify-center gap-2 ${
                isAlarmActive
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-[#00695C] hover:bg-[#004D40] text-white'
              }`}
            >
              <Bell size={18} />
              {isAlarmActive ? 'Disable Station Alarm' : `Arm Station Geofence Alarm (${alarmRadiusKm} km)`}
            </button>

            <button
              type="button"
              onClick={simulateApproach}
              className="w-full py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs rounded-xl transition border border-amber-300 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Volume2 size={14} /> Test Alarm Sound & Vibration (Demo)
            </button>
          </div>

          {/* Station Directory Search */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <label className="block text-xs font-bold text-gray-700">Search Railway Stations in India</label>
            <input
              type="text"
              placeholder="Type station name, city, or station code (e.g. MAS, NDLS, Howrah)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-3 rounded-2xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
            />

            <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-2xl">
              {filteredStations.map((station) => (
                <div
                  key={station.code}
                  onClick={() => setSelectedStation(station)}
                  className={`p-3 cursor-pointer flex items-center justify-between text-xs transition-colors ${
                    selectedStation.code === station.code ? 'bg-teal-50 text-[#00695C] font-bold' : 'hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Train size={14} className={selectedStation.code === station.code ? 'text-[#00695C]' : 'text-gray-400'} />
                    <span><strong>[{station.code}]</strong> {station.name}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">{station.city}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Safety Card & 139 Helpline */}
        <div className="lg:col-span-5 space-y-6">
          {/* 139 Helpline Card */}
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-6 rounded-3xl shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="bg-black/20 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Indian Railways Helpline
              </span>
              <Phone size={18} />
            </div>
            <h3 className="text-xl font-extrabold font-['Plus_Jakarta_Sans']">Dial 139 Rail Helpline</h3>
            <p className="text-xs text-amber-100 leading-relaxed font-medium">
              24x7 toll-free helpline for train enquiry, medical assistance, security emergencies, and luggage support across Indian Railways.
            </p>
            <a
              href="tel:139"
              className="inline-flex items-center justify-center gap-2 w-full bg-white text-amber-950 font-bold text-xs py-3 rounded-xl shadow-md no-underline hover:bg-amber-50 transition"
            >
              <Phone size={14} /> Call 139 Helpline (Free)
            </a>
          </div>

          {/* Rail Safety Tips Card */}
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Shield size={18} className="text-[#00695C]" />
              Offline Rail Safety & TTE Assistance
            </h3>
            <div className="space-y-3 text-xs text-gray-600 font-medium">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p className="font-bold text-gray-800 mb-1">🎫 Show Ticket to TTE Offline</p>
                <p>Saved ticket scans in Sanchar AI work offline without network connection.</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p className="font-bold text-gray-800 mb-1">🌙 Night Safety Guidance</p>
                <p>Keep your station alarm armed at 3 km radius so you never miss your destination at night.</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p className="font-bold text-gray-800 mb-1">👮 RPF Security Assistance</p>
                <p>Railway Protection Force (RPF) is available on all major trains. Dial 139 or notify TTE immediately for assistance.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TrainModePage;
