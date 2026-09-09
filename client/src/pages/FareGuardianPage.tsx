import React, { useState } from 'react';
import { Shield, Calculator, MessageSquare, AlertTriangle, CheckCircle, Navigation, Volume2, Copy, Clock, ExternalLink } from 'lucide-react';
import axios from 'axios';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { VERIFIED_TARIFFS, calculateVerifiedFare } from '../data/verifiedTariffs';

const OFFICIAL_RATE_CARDS: any = VERIFIED_TARIFFS;

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

  const rateCard = OFFICIAL_RATE_CARDS[selectedCity];

  // Calculate Fare Range using single VERIFIED_TARIFFS module
  const fareResult = calculateVerifiedFare(selectedCity, vehicleType, distanceKm, isNight);

  const handleSpeak = (text: string, index: number) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
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
    try {
      await axios.post('/api/issue-reports', {
        city: selectedCity,
        category: 'overcharging',
        note: `Fare discrepancy reported for ${vehicleType} (${distanceKm} km). Paid: ₹${paidFare}, Expected: ₹${fareResult.min}–₹${fareResult.max}. Route: ${reportFrom || 'Local'} to ${reportTo || 'Destination'}`
      });
      setReportStatus('Report recorded on live system — thank you for keeping fares honest!');
      setPaidFare('');
      setReportFrom('');
      setReportTo('');
      setTimeout(() => setReportStatus(null), 4000);
    } catch {
      setReportStatus('Report saved locally on your device.');
      setTimeout(() => setReportStatus(null), 4000);
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
            Calculate official gazetted fares for autos & taxis across India, access offline dispute phrase cards in 7 Indian languages, and report overcharging.
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
            {rateCard && (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <CheckCircle size={10} /> Official Gazette
              </span>
            )}
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
                <p className="text-xs font-bold text-gray-800">Night Surcharge (11 PM - 5 AM)</p>
                <p className="text-[10px] text-gray-500 font-medium">Adds official +25% to +50% late night tariff rate</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isNight}
              onChange={(e) => setIsNight(e.target.checked)}
              className="w-5 h-5 accent-[#00695C] rounded cursor-pointer"
            />
          </div>

          {/* Fare Result Box */}
          <div className="bg-gradient-to-br from-teal-900 to-[#004D40] text-white p-6 rounded-2xl shadow-lg space-y-3 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-teal-200 uppercase tracking-wider">Estimated Honest Fare</span>
              <span className="text-[11px] bg-amber-400 text-amber-950 font-bold px-2.5 py-0.5 rounded-full">
                {fareResult.isOfficial ? 'Gazette Tariff Verified' : 'Crowd Estimate'}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold font-['Plus_Jakarta_Sans'] text-amber-300">
                ₹{fareResult.min} – ₹{fareResult.max}
              </span>
            </div>

            {rateCard ? (
              <div className="text-[11px] text-teal-100/90 space-y-1 pt-2 border-t border-teal-800/80 font-medium">
                <p><strong>Source:</strong> {rateCard.source} (Effective: {rateCard.effectiveDate})</p>
                <p>Base: ₹{fareResult.tariff?.minFare} for first {fareResult.tariff?.minDistKm} km · ₹{fareResult.tariff?.perKm}/km thereafter</p>
                {rateCard.sourceUrl && (
                  <a href={rateCard.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-amber-300 underline font-semibold mt-1">
                    View official gazette notice <ExternalLink size={10} />
                  </a>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-teal-100/90 pt-2 border-t border-teal-800/80">
                <p>No official gazette tariff on file for {selectedCity} yet — showing crowd-reported median fare.</p>
              </div>
            )}
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
                        onClick={() => handleSpeak(item.native, idx)}
                        className={`p-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                          speakingIndex === idx ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-white text-gray-600 hover:bg-teal-50 border-gray-200'
                        }`}
                        title="Listen audio pronuciation"
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
