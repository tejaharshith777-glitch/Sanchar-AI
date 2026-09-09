import React, { useState, useEffect } from 'react';
import { Shield, Calculator, MessageSquare, AlertTriangle, CheckCircle, Navigation, Volume2, Copy, Clock, ExternalLink } from 'lucide-react';
import axios from 'axios';
import { CityAutocomplete } from '../components/CityAutocomplete';

// A tariff is "official" ONLY when its numbers come from a verifiable
// government notification (values re-checked Sep 2026). Anything else is
// shown as indicative — or omitted with an explanation — never as fact.
interface Tariff {
  minFare: number;
  minDistKm: number;
  perKm: number;
  nightSurchargePct: number | null; // null = no verified night rule on file
  official: boolean;
  note?: string;
}

interface RateCard {
  city: string;
  source: string;
  sourceUrl?: string;
  effectiveDate: string;
  nightWindow?: string;
  auto: Tariff | null; // null = no metered tariff exists for this mode
  taxi: Tariff | null;
  modeNote?: string; // shown when the selected mode has no tariff
}

const OFFICIAL_RATE_CARDS: Record<string, RateCard> = {
  "Mumbai": {
    city: "Mumbai",
    source: "MMRTA fare revision",
    sourceUrl: "https://transport.maharashtra.gov.in",
    effectiveDate: "01/09/2026",
    nightWindow: "12 AM – 5 AM",
    auto: { minFare: 27, minDistKm: 1.5, perKm: 18.22, nightSurchargePct: 25, official: true, note: "Meters recalibrating till 30/11/2026 — RTO tariff cards apply meanwhile." },
    taxi: { minFare: 33, minDistKm: 1.5, perKm: 21.90, nightSurchargePct: 25, official: true, note: "Kaali-peeli metered taxis." }
  },
  "Chennai": {
    city: "Chennai",
    source: "TN Motor Vehicles Dept revised chart",
    sourceUrl: "https://tnsta.gov.in",
    effectiveDate: "2023 chart",
    nightWindow: "11 PM – 5 AM",
    auto: { minFare: 25, minDistKm: 1.8, perKm: 12.0, nightSurchargePct: 50, official: true },
    taxi: null,
    modeNote: "No gazetted metered-taxi tariff for Chennai — app fares are dynamic. Compare inside the app; autos above are metered."
  },
  "Bengaluru": {
    city: "Bengaluru",
    source: "Bengaluru Urban RTA order 14/07/2025",
    sourceUrl: "https://transport.karnataka.gov.in",
    effectiveDate: "01/08/2025",
    nightWindow: "10 PM – 5 AM",
    auto: { minFare: 36, minDistKm: 2.0, perKm: 18.0, nightSurchargePct: 50, official: true },
    taxi: null,
    modeNote: "App-cab fares are capped per KA orders and vary by class — compare in-app; autos above are metered."
  },
  "Delhi": {
    city: "Delhi",
    source: "Delhi Transport Dept notification 09/01/2023",
    sourceUrl: "https://transport.delhi.gov.in",
    effectiveDate: "09/01/2023",
    auto: { minFare: 30, minDistKm: 1.5, perKm: 11.0, nightSurchargePct: 25, official: true },
    taxi: { minFare: 40, minDistKm: 1.0, perKm: 17.0, nightSurchargePct: 25, official: true, note: "Non-AC black-yellow taxis; AC taxis ₹20/km." }
  },
  "Hyderabad": {
    city: "Hyderabad",
    source: "Telangana transport fares (in force since 2014)",
    sourceUrl: "https://transport.telangana.gov.in",
    effectiveDate: "2014 (revision proposed 03/09/2026, pending approval)",
    auto: { minFare: 20, minDistKm: 1.6, perKm: 11.0, nightSurchargePct: null, official: true, note: "Night rule under revision — insist on meter after 11 PM." },
    taxi: { minFare: 40, minDistKm: 2.0, perKm: 21.0, nightSurchargePct: 25, official: false, note: "From reported metered-cab tariff (Dec 2022, secondary source) — confirm on meter." }
  },
  "Kolkata": {
    city: "Kolkata",
    source: "WB notification 2529-WT",
    sourceUrl: "https://transport.wb.gov.in",
    effectiveDate: "11/06/2018",
    auto: null,
    modeNote: "Kolkata autos run route-wise fixed fares — no metered per-km tariff. Ask the route fare before boarding.",
    taxi: { minFare: 30, minDistKm: 2.0, perKm: 15.0, nightSurchargePct: null, official: true, note: "Yellow meter taxis. Night rule unverified — confirm on meter." }
  }
};

const DISPUTE_PHRASES: Record<string, { lang: string; native: string; english: string; audioText: string }[]> = {
  "Hindi": [
    { lang: "Hindi", native: "भैया, कृपया मीटर चालू कीजिये।", english: "Bhaiya, please run the meter.", audioText: "Bhaiya kripya meter chalu kijie" },
    { lang: "Hindi", native: "यह सरकारी रेट कार्ड से अधिक है।", english: "This is higher than the government rate card.", audioText: "Yeh sarkari rate card se adhik hai" },
    { lang: "Hindi", native: "आइए नज़दीकी ट्रैफिक पुलिस बूथ पर बात करते हैं।", english: "Let's talk to the nearest traffic police booth.", audioText: "Aaiye najdiki traffic police booth par baat karte hain" }
  ],
  "Tamil": [
    { lang: "Tamil", native: "அண்ணா, தயவுசெய்து மீட்டர் போடுங்கள்.", english: "Anna, please turn on the meter.", audioText: "Anna tayavuseydu meter podungal" },
    { lang: "Tamil", native: "இது அரசு நிர்ணயித்த கட்டணத்தை விட அதிகம்.", english: "This is more than the government fixed rate.", audioText: "Idu arasu kattanathai vida adhigam" },
    { lang: "Tamil", native: "ட்ராஃபிக் போலீஸிடம் கேட்கலாம் வாங்க.", english: "Let me ask the traffic police officer over there.", audioText: "Traffic policidam ketkalam vaanga" }
  ],
  "Telugu": [
    { lang: "Telugu", native: "అన్నా, దయచేసి మీటర్ వేయండి.", english: "Anna, please turn on the meter.", audioText: "Anna dayacesi meter veyandi" },
    { lang: "Telugu", native: "ఇది ప్రభుత్వం నిర్ణయించిన ఛార్జీ కంటే ఎక్కువ.", english: "This is higher than the government fare.", audioText: "Idi prabhutvam nirnayincina charge kante ekkuva" },
    { lang: "Telugu", native: "ట్రాఫిక్ పోలీసులను అడుగుదాం రండి.", english: "Let me check with the traffic police officer.", audioText: "Traffic policulanu adugudam randi" }
  ],
  "Kannada": [
    { lang: "Kannada", native: "ಅಣ್ಣ, ದಯವಿಟ್ಟು ಮೀಟರ್ ಹಾಕಿ.", english: "Anna, please turn on the meter.", audioText: "Anna dayavittu meter haaki" },
    { lang: "Kannada", native: "ಇದು ಸರ್ಕಾರಿ ದರಕ್ಕಿಂತ ಹೆಚ್ಚಾಗಿದೆ.", english: "This is higher than the government rate card.", audioText: "Idu sarkari darakkinta heccagide" },
    { lang: "Kannada", native: "ಟ್ರಾಫಿಕ್ ಪೋಲಿಸರನ್ನು ಕೇಳೋಣ ಬನ್ನಿ.", english: "Let's speak with the traffic police officer.", audioText: "Traffic policeranna kelona banni" }
  ],
  "Bengali": [
    { lang: "Bengali", native: "দাদা, দয়া করে মিটার চালান।", english: "Dada, please run the meter.", audioText: "Dada doya kore meter chalan" },
    { lang: "Bengali", native: "এটা সরকারি ভাড়ার চেয়ে বেশি।", english: "This is higher than official government fare.", audioText: "Eta sarkari bharar cheye beshi" },
    { lang: "Bengali", native: "চলুন ট্রাফিক পুলিশের সাথে কথা বলি।", english: "Let me ask the traffic police over there.", audioText: "Cholon traffic policher sathe kotha boli" }
  ],
  "Marathi": [
    { lang: "Marathi", native: "भाऊ, कृपया मीटर चालू करा.", english: "Bhau, please turn on the meter.", audioText: "Bhau krupaya meter chalu kara" },
    { lang: "Marathi", native: "हे सरकारी रेट कार्डपेक्षा जास्त आहे.", english: "This is more than the government rate card.", audioText: "He sarkari rate card peksha jasta aahe" },
    { lang: "Marathi", native: "चला जवळच्या ट्रॅफिक पोलिसांकडे जाऊया.", english: "Let's ask the nearest traffic police officer.", audioText: "Chala javalkchya traffic poliscankade jauya" }
  ],
  "Gujarati": [
    { lang: "Gujarati", native: "ભાઈ, કૃપા કરીને મીટર ચાલુ કરો.", english: "Bhai, please turn on the meter.", audioText: "Bhai krupa karine meter chalu karo" },
    { lang: "Gujarati", native: "આ સરકારી રેટ કાર્ડ કરતા વધારે છે.", english: "This is more than official government rate.", audioText: "Aa sarkari rate card karta vadhare chhe" },
    { lang: "Gujarati", native: "ચાલો નજીકના ટ્રાફિક પોલીસને પૂછીએ.", english: "Let's ask the nearest traffic police.", audioText: "Chalo najikna traffic police ne puchhie" }
  ]
};

const LANG_LOCALE: Record<string, string> = {
  Hindi: 'hi-IN', Tamil: 'ta-IN', Telugu: 'te-IN', Kannada: 'kn-IN',
  Bengali: 'bn-IN', Marathi: 'mr-IN', Gujarati: 'gu-IN'
};

const PENDING_REPORTS_KEY = 'fareReportsPending';

async function flushPendingReports(): Promise<number> {
  try {
    const raw = localStorage.getItem(PENDING_REPORTS_KEY);
    if (!raw) return 0;
    const pending = JSON.parse(raw);
    if (!Array.isArray(pending) || pending.length === 0) return 0;
    const remaining: any[] = [];
    for (const r of pending) {
      try { await axios.post('/api/issue-reports', r); }
      catch { remaining.push(r); }
    }
    if (remaining.length) localStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(remaining));
    else localStorage.removeItem(PENDING_REPORTS_KEY);
    return pending.length - remaining.length;
  } catch { return 0; }
}

function queuePendingReport(payload: any): number {
  try {
    const raw = localStorage.getItem(PENDING_REPORTS_KEY);
    const pending = raw ? JSON.parse(raw) : [];
    pending.push(payload);
    localStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(pending));
    return pending.length;
  } catch { return -1; }
}

export const FareGuardianPage: React.FC = () => {
  const [selectedCity, setSelectedCity] = useState('Mumbai');
  const [vehicleType, setVehicleType] = useState<'auto' | 'taxi'>('auto');
  const [distanceKm, setDistanceKm] = useState(5);
  const [isNight, setIsNight] = useState(false);
  const [selectedLang, setSelectedLang] = useState('Hindi');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  // Scam reporting form
  const [paidFare, setPaidFare] = useState<string>('');
  const [reportFrom, setReportFrom] = useState<string>('');
  const [reportTo, setReportTo] = useState<string>('');
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Try syncing offline-queued reports whenever the page opens online.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PENDING_REPORTS_KEY);
      const n = raw ? (JSON.parse(raw) || []).length : 0;
      setPendingCount(n);
      if (n > 0 && navigator.onLine) {
        flushPendingReports().then(synced => {
          if (synced > 0) {
            setPendingCount(Math.max(0, n - synced));
            setReportStatus(`${synced} offline report(s) synced to the live system.`);
            setTimeout(() => setReportStatus(null), 4000);
          }
        });
      }
    } catch { /* ignore */ }
  }, []);

  const rateCard = OFFICIAL_RATE_CARDS[selectedCity];
  const tariff = rateCard ? (vehicleType === 'auto' ? rateCard.auto : rateCard.taxi) : null;

  // Calculate Fare Range
  const calculateFare = () => {
    if (!rateCard) {
      // No tariff on file: an explicit rough guess, never a "median".
      const base = vehicleType === 'auto' ? 25 : 50;
      const perKm = vehicleType === 'auto' ? 14 : 20;
      const distEst = Math.round(base + Math.max(0, distanceKm - 1.5) * perKm);
      const min = Math.round(distEst * 0.9);
      const max = Math.round(distEst * 1.15);
      return { min, max, kind: 'guess' as const, tariff: null };
    }
    if (!tariff) {
      return { min: 0, max: 0, kind: 'unavailable' as const, tariff: null };
    }
    const extraDist = Math.max(0, distanceKm - tariff.minDistKm);
    const baseFare = tariff.minFare + extraDist * tariff.perKm;
    const nightMult = isNight && tariff.nightSurchargePct ? (1 + tariff.nightSurchargePct / 100) : 1.0;
    const exactFare = Math.round(baseFare * nightMult);

    return {
      min: exactFare,
      max: Math.round(exactFare * 1.08),
      kind: (tariff.official ? 'official' : 'indicative') as 'official' | 'indicative',
      tariff
    };
  };

  const fareResult = calculateFare();
  const nightApplicable = !!tariff?.nightSurchargePct;

  const handleSpeak = (text: string, index: number, lang: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.lang = LANG_LOCALE[lang] || 'hi-IN';
      try {
        const voice = window.speechSynthesis.getVoices()
          .find(v => (v.lang || '').toLowerCase().startsWith(utterance.lang.split('-')[0]));
        if (voice) utterance.voice = voice;
      } catch { /* ignore */ }
      setSpeakingIndex(index);
      utterance.onend = () => setSpeakingIndex(null);
      utterance.onerror = () => setSpeakingIndex(null);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paidFare) return;
    // Structured fields (vehicleType/distanceKm/paidFare/expected) let a future
    // median endpoint aggregate real per-km reports; the note keeps it readable.
    const payload = {
      city: selectedCity,
      category: 'overcharging',
      vehicleType,
      distanceKm,
      paidFare: Number(paidFare),
      expectedMin: fareResult.kind === 'unavailable' ? null : fareResult.min,
      expectedMax: fareResult.kind === 'unavailable' ? null : fareResult.max,
      note: `Fare discrepancy reported for ${vehicleType} (${distanceKm} km). Paid: ₹${paidFare}, Expected: ₹${fareResult.min}–₹${fareResult.max}. Route: ${reportFrom || 'Local'} to ${reportTo || 'Destination'}`
    };
    try {
      await flushPendingReports();
      await axios.post('/api/issue-reports', payload);
      setPendingCount(0);
      setReportStatus('Report recorded on live system — thank you for keeping fares honest!');
      setPaidFare('');
      setReportFrom('');
      setReportTo('');
      setTimeout(() => setReportStatus(null), 4000);
    } catch {
      const n = queuePendingReport(payload);
      setPendingCount(Math.max(0, n));
      setReportStatus(n >= 0
        ? `No connection — saved on this device (${n} pending). It will sync automatically.`
        : 'No connection — could not save on this device. Please retry online.');
      setTimeout(() => setReportStatus(null), 5000);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#00695C] to-[#004D40] text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
          <Shield size={220} />
        </div>
        <div className="relative z-10 max-w-2xl space-y-3">
          <span className="bg-amber-400/20 text-amber-300 border border-amber-300/30 text-[11px] font-bold px-3 py-1 rounded-full inline-flex items-center gap-1.5 uppercase tracking-wider">
            <Shield size={12} /> Anti-Overcharge Guardian
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-['Plus_Jakarta_Sans']">
            Fare Guardian & Meter Protection
          </h1>
          <p className="text-teal-100 text-xs sm:text-sm leading-relaxed font-medium">
            Check metered auto & taxi fares against verified government tariffs for 6 metros, access offline dispute phrase cards in 7 Indian languages, and report overcharging.
          </p>
        </div>
      </div>

      {/* Main Grid: Calculator + Dispute Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* LEFT COLUMN: Calculator */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Calculator size={20} className="text-[#00695C]" />
              Official Tariff Estimator
            </h2>
            {tariff?.official ? (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <CheckCircle size={10} /> Official Tariff
              </span>
            ) : tariff ? (
              <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <AlertTriangle size={10} /> Indicative
              </span>
            ) : null}
          </div>

          {/* City Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">Select City in India</label>
            <CityAutocomplete
              value={selectedCity}
              onChange={(val) => setSelectedCity(val)}
              onSelectCity={(city) => setSelectedCity(city)}
              placeholder="Select or type city name..."
            />
          </div>

          {/* Transport Mode & Surcharge Toggle */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setVehicleType('auto')}
              className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                vehicleType === 'auto'
                  ? 'bg-[#00695C] text-white border-[#00695C] shadow-md'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              🛺 Auto-Rickshaw
            </button>
            <button
              type="button"
              onClick={() => setVehicleType('taxi')}
              className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                vehicleType === 'taxi'
                  ? 'bg-[#00695C] text-white border-[#00695C] shadow-md'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              🚕 Cab / Taxi
            </button>
          </div>

          {/* Distance Slider */}
          <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
            <div className="flex justify-between items-center text-xs font-bold text-gray-800">
              <span className="flex items-center gap-1.5"><Navigation size={14} className="text-[#00695C]" /> Distance:</span>
              <span className="text-[#00695C] font-extrabold text-sm">{distanceKm} km</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={distanceKm}
              onChange={(e) => setDistanceKm(parseInt(e.target.value) || 1)}
              className="w-full accent-[#00695C] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-semibold">
              <span>1 km</span>
              <span>25 km</span>
              <span>50 km</span>
            </div>
          </div>

          {/* Night Surcharge Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/70">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-600" />
              <div>
                <p className="text-xs font-bold text-gray-800">Night Surcharge{rateCard?.nightWindow ? ` (${rateCard.nightWindow})` : ''}</p>
                <p className="text-[10px] text-gray-500 font-medium">
                  {tariff
                    ? (nightApplicable
                      ? `Adds official +${tariff.nightSurchargePct}% late-night tariff`
                      : 'No verified night rule for this tariff — night toggle disabled')
                    : 'Night rules vary by city'}
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isNight && nightApplicable}
              disabled={!nightApplicable}
              onChange={(e) => setIsNight(e.target.checked)}
              className="w-5 h-5 accent-[#00695C] rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>

          {/* Fare Result Box */}
          <div className="bg-gradient-to-br from-teal-900 to-[#004D40] text-white p-6 rounded-2xl shadow-lg space-y-3 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-teal-200 uppercase tracking-wider">Estimated Honest Fare</span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                fareResult.kind === 'official' ? 'bg-amber-400 text-amber-950'
                : fareResult.kind === 'indicative' ? 'bg-amber-200 text-amber-900'
                : fareResult.kind === 'unavailable' ? 'bg-slate-500 text-white'
                : 'bg-slate-400 text-slate-900'
              }`}>
                {fareResult.kind === 'official' ? 'Tariff Verified'
                  : fareResult.kind === 'indicative' ? 'Indicative — verify on meter'
                  : fareResult.kind === 'unavailable' ? 'No metered tariff'
                  : 'Rough guess'}
              </span>
            </div>

            {fareResult.kind === 'unavailable' ? (
              <p className="text-sm text-teal-100 leading-relaxed font-medium">{rateCard?.modeNote}</p>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold font-['Plus_Jakarta_Sans'] text-amber-300">
                  ₹{fareResult.min} – ₹{fareResult.max}
                </span>
              </div>
            )}

            {rateCard && tariff ? (
              <div className="text-[11px] text-teal-100/90 space-y-1 pt-2 border-t border-teal-800/80 font-medium">
                <p><strong>Source:</strong> {rateCard.source} (Effective: {rateCard.effectiveDate})</p>
                <p>Base: ₹{tariff.minFare} for first {tariff.minDistKm} km · ₹{tariff.perKm}/km thereafter{nightApplicable ? ` · Night +${tariff.nightSurchargePct}%` : ''}</p>
                <p className="text-teal-200/70">Upper bound adds ~8% traffic buffer.</p>
                {tariff.note && <p className="text-amber-200/90">{tariff.note}</p>}
                {rateCard.sourceUrl && (
                  <a href={rateCard.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-amber-300 underline font-semibold mt-1">
                    View issuing authority site <ExternalLink size={10} />
                  </a>
                )}
              </div>
            ) : !rateCard ? (
              <div className="text-[11px] text-teal-100/90 pt-2 border-t border-teal-800/80">
                <p>No verified tariff on file for {selectedCity} yet — rough all-India guess only. Insist on meter.</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* RIGHT COLUMN: Dispute Cards & Report Form */}
        <div className="lg:col-span-5 space-y-6">

          {/* Dispute Cards */}
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <MessageSquare size={18} className="text-[#00695C]" />
                Anti-Overcharge Phrase Cards
              </h2>
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="text-xs font-bold text-[#00695C] bg-teal-50 border border-teal-200 rounded-xl px-2.5 py-1 focus:outline-none"
              >
                {Object.keys(DISPUTE_PHRASES).map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {(DISPUTE_PHRASES[selectedLang] || DISPUTE_PHRASES['Hindi']).map((item, idx) => (
                <div key={idx} className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2 hover:border-teal-300 transition-colors">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-bold text-gray-900 leading-snug">{item.native}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSpeak(item.native, idx, item.lang)}
                        className={`p-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                          speakingIndex === idx ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-white text-gray-600 hover:bg-teal-50 border-gray-200'
                        }`}
                        title="Listen to audio pronunciation"
                      >
                        <Volume2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(item.native, idx)}
                        className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-teal-50 text-xs font-semibold transition cursor-pointer"
                        title="Copy phrase"
                      >
                        {copiedIndex === idx ? <CheckCircle size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 italic">"{item.english}"</p>
                </div>
              ))}
            </div>
          </div>

          {/* Overcharge Scam Reporter */}
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              Report Overcharge or Refusal
            </h2>
            <form onSubmit={handleReportSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Amount Paid / Quoted (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 250"
                  value={paidFare}
                  onChange={(e) => setPaidFare(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-semibold focus:ring-2 focus:ring-[#00695C]"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">From</label>
                  <input
                    type="text"
                    placeholder="e.g. Airport"
                    value={reportFrom}
                    onChange={(e) => setReportFrom(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-300 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">To</label>
                  <input
                    type="text"
                    placeholder="e.g. Hotel"
                    value={reportTo}
                    onChange={(e) => setReportTo(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-300 font-medium"
                  />
                </div>
              </div>
              {reportStatus && (
                <p className="text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 font-bold text-center">
                  {reportStatus}
                </p>
              )}
              {pendingCount > 0 && !reportStatus && (
                <p className="text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-bold text-center">
                  {pendingCount} report(s) queued on this device — will sync when online.
                </p>
              )}
              <button
                type="submit"
                className="w-full bg-[#00695C] hover:bg-[#004D40] text-white font-bold py-3 rounded-xl transition shadow-md cursor-pointer"
              >
                Submit Honest Report
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};

export default FareGuardianPage;
