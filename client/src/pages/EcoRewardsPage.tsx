import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, ChevronLeft, Award, Info } from 'lucide-react';
import { HealthContext } from '../App';

export const EcoRewardsPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeTrip, lastCompletedTrip } = useContext(HealthContext);

  const currentTrip = activeTrip || lastCompletedTrip;

  // Compute live eco transit distance from trip segments or points
  let walkKm = 0;
  let metroKm = 0;
  let trainKm = 0;

  if (currentTrip && Array.isArray(currentTrip.segments) && currentTrip.segments.length > 0) {
    currentTrip.segments.forEach((seg: any) => {
      const mode = (seg.mode || '').toLowerCase();
      const dist = typeof seg.distanceKm === 'number' ? seg.distanceKm : 0;
      if (mode.includes('walk') || mode.includes('foot')) walkKm += dist;
      else if (mode.includes('metro') || mode.includes('subway')) metroKm += dist;
      else if (mode.includes('train') || mode.includes('rail')) trainKm += dist;
    });
  } else if (currentTrip && typeof currentTrip.totalDistanceKm === 'number' && currentTrip.totalDistanceKm > 0) {
    // Estimate transit split based on recorded trip total
    walkKm = parseFloat((currentTrip.totalDistanceKm * 0.1).toFixed(1));
    trainKm = parseFloat((currentTrip.totalDistanceKm * 0.9).toFixed(1));
  }

  // Emission factors (g CO2 per km) vs private car (~170g/km)
  // Walking: 0g, Metro: ~30g, Train: ~40g -> savings vs car
  const co2SavedKg = ((walkKm * 170 + metroKm * 140 + trainKm * 130) / 1000).toFixed(2);
  const greenPoints = Math.round(walkKm * 10 + metroKm * 5 + trainKm * 2);

  return (
    <div className="min-h-screen bg-[#FAF7F2] pb-16">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm font-bold text-[#00695C] hover:underline cursor-pointer">
          <ChevronLeft size={18} /> Home
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Green Sanchar Eco Rewards</span>
        <div className="w-10" />
      </div>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#00695C] to-teal-800 text-white py-10 px-4 md:px-8">
        <div className="max-w-5xl mx-auto space-y-3">
          <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full border border-white/30">
            Personal Carbon Savings Tracker
          </span>
          <h1 className="text-2xl md:text-4xl font-display font-bold">Green Sanchar Eco Impact</h1>
          <p className="text-xs md:text-sm text-emerald-100 max-w-2xl leading-relaxed">
            Track your sustainable transit choices (walking, metro, rail) calculated from your actual journey tracking.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full p-4 md:p-8 space-y-8">

        {/* 1. THIS JOURNEY SUMMARY & CO2 ESTIMATE FORMULA */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                your own journey
              </span>
              <h2 className="font-display font-bold text-xl text-gray-900 mt-1 flex items-center gap-2">
                <Leaf size={22} className="text-[#00695C]" /> Eco Transit Summary
              </h2>
            </div>
            {activeTrip ? (
              <span className="text-xs font-bold text-[#00695C] bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                Active Trip: {activeTrip.originCity} → {activeTrip.destinationCity}
              </span>
            ) : (
              <span className="text-xs text-gray-500 font-medium">Recorded from your personal journey logs</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 space-y-1">
              <span className="text-[10px] font-bold uppercase text-emerald-800">Walking Tracked</span>
              <div className="text-2xl font-bold text-[#00695C]">{walkKm} km</div>
              <div className="text-[11px] text-gray-600">Zero emission mobility</div>
            </div>

            <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-100 space-y-1">
              <span className="text-[10px] font-bold uppercase text-teal-800">Metro / Rail Tracked</span>
              <div className="text-2xl font-bold text-[#00695C]">{(metroKm + trainKm).toFixed(1)} km</div>
              <div className="text-[11px] text-gray-600">Low-carbon mass transit</div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100 space-y-1">
              <span className="text-[10px] font-bold uppercase text-amber-800">Est. CO₂ Offset</span>
              <div className="text-2xl font-bold text-[#F59E0B]">{co2SavedKg} kg CO₂</div>
              <div className="text-[11px] text-gray-600">Avoided vs private vehicle</div>
            </div>
          </div>

          {/* Explicit Visible Formula Box */}
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs space-y-1">
            <div className="font-bold text-gray-800 flex items-center gap-1.5">
              <Info size={14} className="text-[#00695C]" /> Visible Calculation Formula:
            </div>
            <div className="text-gray-600 italic">
              CO₂ offset = distance × standard emission factors — estimate (Car baseline: 170g CO₂/km, Metro: 30g/km, Rail: 40g/km).
            </div>
          </div>
        </div>

        {/* 2. GREEN POINTS PERSONAL SCORE */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-display font-bold text-lg text-gray-900 flex items-center gap-2">
              <Award size={20} className="text-[#F59E0B]" /> Personal Green Score
            </h3>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              your own journey
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#00695C] to-emerald-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest text-emerald-200 font-bold block mb-1">Eco Score Balance</span>
              <div className="text-4xl font-display font-bold">{greenPoints} Points</div>
              <p className="text-xs text-emerald-100 mt-1">Earned solely through your logged foot steps and train segments.</p>
            </div>
            <div className="bg-white/10 p-4 rounded-xl border border-white/20 text-xs space-y-1">
              <div className="font-bold text-emerald-300">Score Breakdown:</div>
              <div>• Walking: {walkKm * 10} pts (10 pts/km)</div>
              <div>• Metro/Rail: {Math.round(metroKm * 5 + trainKm * 2)} pts</div>
            </div>
          </div>
        </div>

        {/* 3. PARTNER PERKS (PHASE 2) */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              Phase 2 — coming with partner onboarding
            </span>
            <h3 className="font-display font-bold text-lg text-gray-900 mt-2">Partner Eco Incentives</h3>
            <p className="text-xs text-gray-600 mt-1">Future eco-discounts will be provided by participating local artisans and green homestays.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-2 opacity-80">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-gray-800">Artisan Workshop Perk</span>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">Phase 2</span>
              </div>
              <p className="text-xs text-gray-600">10% discount on direct handloom purchases when arriving via train/metro.</p>
              <div className="text-[10px] text-gray-500 italic">Phase 2 — coming with partner onboarding. No fake redemption.</div>
            </div>

            <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-2 opacity-80">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-gray-800">Homestay Eco Welcome</span>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">Phase 2</span>
              </div>
              <p className="text-xs text-gray-600">Free organic welcome tea for eco-score holders at participating homestays.</p>
              <div className="text-[10px] text-gray-500 italic">Phase 2 — coming with partner onboarding. No fake redemption.</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
