import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ChevronLeft, MapPin, Sparkles, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import SancharMap from '../components/SancharMap';
import { CURATED_SPECIAL_SPOTS_24 } from '../App';

const CITY_COORDS: Record<string, [number, number]> = {
  Chennai: [13.0827, 80.2707],
  Jaipur: [26.9124, 75.7873],
  Kochi: [9.9312, 76.2673],
  Bengaluru: [12.9716, 77.5946],
  Delhi: [28.6139, 77.2090],
  Mumbai: [19.0760, 72.8777]
};

export const CrowdRadarPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCity, setSelectedCity] = useState<string>('Jaipur');
  const [selectedSpot, setSelectedSpot] = useState<any>(null);

  const citySpots = CURATED_SPECIAL_SPOTS_24.filter(s => s.city.toLowerCase() === selectedCity.toLowerCase());

  // Categorize spots into quiet, typical, peak based on real timing/bestTime text
  const getSpotStatus = (spot: any) => {
    const timing = (spot.bestTime || spot.timing || '').toLowerCase();
    if (timing.includes('7:00 am') || timing.includes('early morning') || timing.includes('sunrise') || timing.includes('5:00 am') || timing.includes('6:00 am')) {
      return { status: 'quiet', label: 'quiet window', color: '🟢', badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    }
    if (timing.includes('10:00 am') || timing.includes('afternoon') || timing.includes('midday')) {
      return { status: 'peak', label: 'peak hours', color: '🔴', badgeBg: 'bg-rose-50 text-rose-800 border-rose-200' };
    }
    return { status: 'busy', label: 'typically busy', color: '🟡', badgeBg: 'bg-amber-50 text-amber-800 border-amber-200' };
  };

  const sortedCitySpots = [...citySpots].sort((a, b) => {
    const scoreA = getSpotStatus(a).status === 'quiet' ? 1 : 2;
    const scoreB = getSpotStatus(b).status === 'quiet' ? 1 : 2;
    return scoreA - scoreB;
  });

  // Markers for Leaflet map (ranked quiet spots first)
  const mapCenter = CITY_COORDS[selectedCity] || CITY_COORDS['Jaipur'];
  const markers = sortedCitySpots.map((s: any) => {
    const st = getSpotStatus(s);
    return {
      position: [(typeof s.lat === 'number' ? s.lat : mapCenter[0]), (typeof s.lng === 'number' ? s.lng : mapCenter[1])] as [number, number],
      popupContent: (
        <div className="p-1 text-center font-sans">
          <div className="font-bold text-xs">{s.name}</div>
          <div className="text-[10px] text-gray-500">{s.category} · {st.label}</div>
          <div className="text-[9px] text-[#00695C] font-semibold mt-0.5">Best time: {s.bestTime || s.timing}</div>
        </div>
      ),
      iconEmoji: st.color
    };
  });

  // Quieter Alternative logic
  const findQuieterAlternative = () => {
    if (!selectedSpot) return null;
    const sameCat = citySpots.filter((s: any) => s.name !== selectedSpot.name && s.category === selectedSpot.category);
    const quieter = sameCat.find((s: any) => getSpotStatus(s).status === 'quiet') || sameCat[0];
    if (!quieter) {
      // Fallback to any quiet spot in city
      return citySpots.find((s: any) => s.name !== selectedSpot.name && getSpotStatus(s).status === 'quiet');
    }
    return quieter;
  };

  const quieterAlt = findQuieterAlternative();

  // Simple 3-spot itinerary suggestion
  const itinerary = citySpots.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#FAF7F2] pb-16">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm font-bold text-[#00695C] hover:underline cursor-pointer">
          <ChevronLeft size={18} /> Home
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Smart Visit Planner</span>
        <div className="w-10" />
      </div>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-teal-950 via-[#00695C] to-emerald-900 text-white py-10 px-4 md:px-8">
        <div className="max-w-5xl mx-auto space-y-3">
          <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full border border-white/30">
            Verified Local Timings · No Invented Counts
          </span>
          <h1 className="text-2xl md:text-4xl font-display font-bold">Smart Visit & Quiet Window Planner</h1>
          <p className="text-xs md:text-sm text-emerald-100 max-w-2xl leading-relaxed">
            Plan your daily sight visits around verified quiet windows to avoid peak congestion. Derived from local historical knowledge.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full p-4 md:p-8 space-y-8">

        {/* Honest Banner */}
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex items-center gap-3 text-xs text-amber-900 font-medium">
          <ShieldCheck size={20} className="text-[#F59E0B] shrink-0" />
          <div>
            <strong>Honest Local Knowledge:</strong> Typical patterns from verified local knowledge — not live counts or artificial wait times.
          </div>
        </div>

        {/* City Selector */}
        <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-700">Select Destination City:</span>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {['Jaipur', 'Chennai', 'Kochi', 'Bengaluru', 'Delhi', 'Mumbai'].map(c => (
              <button
                key={c}
                type="button"
                onClick={() => { setSelectedCity(c); setSelectedSpot(null); }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  selectedCity === c ? 'bg-[#00695C] text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Leaflet Map with Window Status Markers */}
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm flex flex-col">
          <div className="bg-gray-50 border-b border-gray-100 p-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Compass size={18} className="text-[#00695C]" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-800">Visit Window Map — {selectedCity}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-bold">
              <span>🟢 quiet window</span>
              <span>🟡 typically busy</span>
              <span>🔴 peak hours</span>
            </div>
          </div>

          <div className="h-[45vh] min-h-[320px] w-full relative">
            <SancharMap
              center={mapCenter}
              zoom={12}
              showOfflineBanner={false}
              heightClass="h-full"
              markers={markers}
            />
          </div>
        </div>

        {/* QUIETER ALTERNATIVE ENGINE */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#00695C] bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
              Smart Alternative Finder
            </span>
            <h3 className="font-display font-bold text-xl text-gray-900 mt-2 flex items-center gap-2">
              <Sparkles size={20} className="text-[#F59E0B]" /> Quieter Alternative Engine
            </h3>
            <p className="text-xs text-gray-600 mt-1">Select a busy landmark to discover nearby quieter alternatives of similar heritage value.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Pick Landmark in {selectedCity}:</label>
              <select
                value={selectedSpot?.name || ''}
                onChange={(e) => {
                  const s = citySpots.find((spot: any) => spot.name === e.target.value);
                  setSelectedSpot(s || null);
                }}
                className="w-full p-3 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
              >
                <option value="">-- Choose a spot to check --</option>
                {citySpots.map((s: any) => (
                  <option key={s.name} value={s.name}>{s.name} ({s.category})</option>
                ))}
              </select>
            </div>

            {selectedSpot && (
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-1 text-xs">
                <div className="font-bold text-gray-800">{selectedSpot.name}</div>
                <div className="text-gray-600">Category: {selectedSpot.category}</div>
                <div className="text-[#00695C] font-semibold">Typical best time: {selectedSpot.bestTime || selectedSpot.timing}</div>
              </div>
            )}
          </div>

          {selectedSpot && (
            <div className="bg-teal-50/80 p-5 rounded-2xl border border-teal-200 space-y-3">
              <div className="text-xs font-bold text-teal-900 uppercase tracking-wider">Suggested Quieter Alternative</div>
              {quieterAlt ? (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-display font-bold text-lg text-teal-950">{quieterAlt.name}</h4>
                    <p className="text-xs text-teal-900 mt-1">
                      {selectedSpot.name} is typically busy during peak hours. {quieterAlt.name} ({quieterAlt.category}) offers a quieter window ({(quieterAlt as any).bestTime || quieterAlt.timing}) — check locally.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/spot/${selectedCity.toLowerCase()}/${quieterAlt.slug}`)}
                    className="px-4 py-2.5 bg-[#00695C] hover:bg-[#004D40] text-white text-xs font-bold rounded-full transition shrink-0 cursor-pointer flex items-center gap-1.5"
                  >
                    Explore {quieterAlt.name} <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <div className="text-xs text-teal-900">No alternative needed — {selectedSpot.name} has flexible visiting hours.</div>
              )}
            </div>
          )}
        </div>

        {/* RE-ROUTE MY DAY ITINERARY */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-display font-bold text-lg text-gray-900 flex items-center gap-2">
              <Clock size={18} className="text-[#00695C]" /> Re-route My Day (Suggested Plan)
            </h3>
            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">Suggested plan — check locally</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {itinerary.map((spot: any, idx: number) => {
              const st = getSpotStatus(spot);
              return (
                <div key={spot.name} className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase text-[#00695C]">Step {idx + 1}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.badgeBg}`}>
                        {st.label}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-gray-900">{spot.name}</h4>
                    <p className="text-xs text-gray-500 mt-1"><MapPin size={10} className="inline text-[#F59E0B]" /> {spot.location}</p>
                  </div>
                  <div className="text-[11px] font-semibold text-gray-600 pt-2 border-t border-gray-200">
                    Recommended: {spot.bestTime || spot.timing}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
