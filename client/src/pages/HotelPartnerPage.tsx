import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ChevronLeft, DollarSign, Languages, Check, ArrowRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';

const FESTIVALS = [
  { name: 'Diwali (Oct/Nov)', factor: 1.35, note: 'High peak nationwide (+35%)' },
  { name: 'Pongal / Sankranti (Jan 14-17)', factor: 1.30, note: 'South India peak (+30%)' },
  { name: 'Durga Puja (Oct)', factor: 1.40, note: 'East/Kolkata peak (+40%)' },
  { name: 'Onam (Aug/Sep)', factor: 1.25, note: 'Kerala peak (+25%)' },
  { name: 'Holi (March)', factor: 1.20, note: 'North/Central peak (+20%)' },
  { name: 'Regular Weekend', factor: 1.15, note: 'Weekend lift (+15%)' },
  { name: 'Regular Weekday', factor: 1.0, note: 'Baseline rate' }
];

const LOCAL_PHRASES: Record<string, Record<string, { phrase: string; translation: string; pronunciation: string }[]>> = {
  TA: {
    checkIn: [
      { phrase: 'வணக்கம், உங்கள் வரவேற்புப் படிவம் இதோ', translation: 'Welcome, here is your check-in form', pronunciation: 'Vanakkam, ungal varaverpu padiyam idho' },
      { phrase: 'அறை சாவி மற்றும் வைஃபை கடவுச்சொல்', translation: 'Room key and Wi-Fi password', pronunciation: 'Arai saavi matrum Wi-Fi kadavuchol' }
    ],
    amenities: [
      { phrase: 'காலை உணவு 7 மணி முதல் 10 மணி வரை', translation: 'Breakfast is served 7 AM to 10 AM', pronunciation: 'Kaalai unavu 7 mani mudhal 10 mani varai' },
      { phrase: 'சுடு தண்ணீர் 24 மணி நேரமும் கிடைக்கும்', translation: 'Hot water available 24/7', pronunciation: 'Sudu thanneer 24 mani neramum kidaikkum' }
    ],
    directions: [
      { phrase: 'கடற்கரை இங்கிருந்து 5 நிமிட நடைபயணம்', translation: 'Beach is 5 minutes walk from here', pronunciation: 'Kadarkarai ingirundhu 5 nimida nadai payanam' },
      { phrase: 'ஆட்டோ சவாரி செய்ய உதவி செய்கிறோம்', translation: 'We can assist with auto booking', pronunciation: 'Auto savaari seyya udhavi seigkirom' }
    ]
  },
  TE: {
    checkIn: [
      { phrase: 'స్వాగతం, ఇది మీ చెక్-ఇన్ ఫారమ్', translation: 'Welcome, here is your check-in form', pronunciation: 'Swagatam, idi mee check-in form' }
    ],
    amenities: [
      { phrase: 'ఉపాహారం ఉదయం 7 నుండి 10 గంటల వరకు', translation: 'Breakfast 7 AM to 10 AM', pronunciation: 'Upaharam udayam 7 nundi 10 gantala varaku' }
    ],
    directions: [
      { phrase: 'బస్సు నిలయం 10 నిమిషాల దూరంలో ఉంది', translation: 'Bus station is 10 minutes away', pronunciation: 'Bus nilayam 10 nimishala dooramlo undi' }
    ]
  },
  HI: {
    checkIn: [
      { phrase: 'नमस्ते, आपका चेक-इन फॉर्म तैयार है', translation: 'Hello, your check-in form is ready', pronunciation: 'Namaste, aapka check-in form taiyaar hai' }
    ],
    amenities: [
      { phrase: 'नाश्ता सुबह 7 से 10 बजे तक उपलब्ध है', translation: 'Breakfast available 7 AM to 10 AM', pronunciation: 'Naashta subah 7 se 10 baje tak uplabdha hai' }
    ],
    directions: [
      { phrase: 'रेलवे स्टेशन यहाँ से 2 किलोमीटर दूर है', translation: 'Railway station is 2 km from here', pronunciation: 'Railway station yahan se 2 km door hai' }
    ]
  }
};

const SAMPLE_RESERVATIONS = [
  { id: 'RES-101', guest: 'Rahul Sharma', checkIn: '2026-09-10', checkOut: '2026-09-12', rooms: 1, status: 'Confirmed', label: 'Demo Data' },
  { id: 'RES-102', guest: 'Ananya Roy', checkIn: '2026-09-11', checkOut: '2026-09-14', rooms: 2, status: 'Checked In', label: 'Demo Data' },
  { id: 'RES-103', guest: 'Karthik Raja', checkIn: '2026-09-15', checkOut: '2026-09-16', rooms: 1, status: 'Upcoming', label: 'Demo Data' }
];

export const HotelPartnerPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.get('demo') === '1';

  // State
  const [propertyName, setPropertyName] = useState('Green View Heritage Stays');
  const [roomsCount, setRoomsCount] = useState(12);
  const [baseRate, setBaseRate] = useState(2500);

  // Rate planner
  const [selectedCity, setSelectedCity] = useState('Chennai');
  const [selectedFestival, setSelectedFestival] = useState(FESTIVALS[0]);

  // Phrase helper
  const [guestLang, setGuestLang] = useState('TA');
  const [phraseTopic, setPhraseTopic] = useState<'checkIn' | 'amenities' | 'directions'>('checkIn');

  // Form submission
  const [formCity, setFormCity] = useState('Chennai');
  const [hotelName, setHotelName] = useState('');
  const [area, setArea] = useState('');
  const [checkInTip, setCheckInTip] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const calculatedMin = Math.round(baseRate * selectedFestival.factor);
  const calculatedMax = Math.round(baseRate * selectedFestival.factor * 1.25);

  const chartData = [
    { day: 'Mon', rate: baseRate },
    { day: 'Tue', rate: baseRate },
    { day: 'Wed', rate: baseRate * 1.05 },
    { day: 'Thu', rate: baseRate * 1.1 },
    { day: 'Fri', rate: calculatedMin },
    { day: 'Sat', rate: calculatedMax },
    { day: 'Sun', rate: Math.round((calculatedMin + calculatedMax) / 2) }
  ];

  const handlePublishHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelName.trim()) return;
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const res = await axios.post('/api/partner-publish', {
        role: 'Hotel',
        city: formCity,
        type: 'hotel',
        name: hotelName,
        area: area || formCity,
        cost: `₹${baseRate} / night`,
        hours: 'Check-in: 12 PM',
        description: `Homestay/Hotel listing by ${hotelName}`,
        checkInTip: checkInTip || 'Key pick-up at reception desk',
        contact: contact || 'Contact hotel reception directly',
        publisherName: hotelName
      });
      setSubmitMsg(res.data?.message || 'Property listed successfully with Sanchar Partner (self-listed) label.');
      setHotelName('');
      setArea('');
      setCheckInTip('');
      setContact('');
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to list property.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] pb-16">
      {/* Navigation Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm font-bold text-[#00695C] hover:underline cursor-pointer">
          <ChevronLeft size={18} /> Home
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Sanchar Partner Portal</span>
        <div className="w-10" />
      </div>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-[#004D40] via-[#00695C] to-teal-800 text-white py-10 px-4 md:px-8">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full border border-white/30">
              Sanchar Partner (self-listed)
            </span>
            {isDemo && (
              <span className="text-[10px] font-extrabold uppercase tracking-widest bg-[#F59E0B] text-gray-900 px-3 py-1 rounded-full">
                Demo Data Active
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-4xl font-display font-bold">Small Hotel & Homestay Suite</h1>
          <p className="text-xs md:text-sm text-emerald-100 max-w-2xl leading-relaxed">
            Empowering independent hoteliers and homestay owners with local rate guidance, offline guest translation tools, and direct tourist discovery.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full p-4 md:p-8 space-y-10">

        {/* 1. PROPERTY HEADER & CONTROLS */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#00695C] bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                Sanchar Partner (self-listed)
              </span>
              <h2 className="text-xl md:text-2xl font-display font-bold text-gray-900 mt-2">{propertyName}</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-gray-50 px-4 py-2 rounded-2xl border border-gray-200 text-center">
                <span className="text-[10px] font-bold uppercase text-gray-500 block">Inventory</span>
                <span className="text-sm font-bold text-gray-800">{roomsCount} Rooms</span>
              </div>
              <div className="bg-gray-50 px-4 py-2 rounded-2xl border border-gray-200 text-center">
                <span className="text-[10px] font-bold uppercase text-gray-500 block">Base Rate</span>
                <span className="text-sm font-bold text-[#00695C]">₹{baseRate} / night</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="hotel-prop-name" className="block text-xs font-bold text-gray-700 mb-1">Property Name</label>
              <input
                id="hotel-prop-name"
                name="propertyName"
                type="text"
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
              />
            </div>
            <div>
              <label htmlFor="hotel-rooms-count" className="block text-xs font-bold text-gray-700 mb-1">Total Rooms</label>
              <input
                id="hotel-rooms-count"
                name="roomsCount"
                type="number"
                value={roomsCount}
                onChange={(e) => setRoomsCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full p-3 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
              />
            </div>
            <div>
              <label htmlFor="hotel-base-rate" className="block text-xs font-bold text-gray-700 mb-1">Base Nightly Rate (₹)</label>
              <input
                id="hotel-base-rate"
                name="baseRate"
                type="number"
                value={baseRate}
                onChange={(e) => setBaseRate(Math.max(100, parseInt(e.target.value) || 500))}
                className="w-full p-3 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
              />
            </div>
          </div>
        </div>

        {/* 2. RATE GUIDANCE PLANNER */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#F59E0B] bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                Decision Support Tool
              </span>
              <h3 className="font-display font-bold text-lg text-gray-900 mt-1 flex items-center gap-2">
                <DollarSign size={20} className="text-[#00695C]" /> Rate Guidance Planner
              </h3>
            </div>
            <span className="text-xs text-gray-500 font-medium">guidance, not a price guarantee</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Select Target City</label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
              >
                {['Chennai', 'Kochi', 'Jaipur', 'Varanasi', 'Guwahati', 'Bengaluru', 'Mumbai'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Select Season / Festival Period</label>
              <select
                value={selectedFestival.name}
                onChange={(e) => {
                  const found = FESTIVALS.find(f => f.name === e.target.value);
                  if (found) setSelectedFestival(found);
                }}
                className="w-full p-3 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
              >
                {FESTIVALS.map(f => (
                  <option key={f.name} value={f.name}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Recommended Rate Range Card */}
          <div className="bg-teal-50/70 p-5 rounded-2xl border border-teal-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">Recommended Guidance Range for {selectedCity}</span>
              <div className="text-2xl font-bold text-[#00695C] mt-1">
                ₹{calculatedMin.toLocaleString()} – ₹{calculatedMax.toLocaleString()} / night
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Assumptions: {selectedFestival.note}. Festivals + weekends typically lift rates 20–40% — guidance, not a price guarantee.
              </p>
            </div>
          </div>

          {/* Recharts Scenario Graph */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
              <span>Weekly Rate Trend Scenario</span>
              <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold">Illustrative scenario — Demo Data</span>
            </div>
            <div className="h-64 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip formatter={(value: any) => [`₹${value}`, 'Suggested Rate']} />
                  <Area type="monotone" dataKey="rate" stroke="#00695C" fill="#CCFBF1" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 3. GUEST PHRASE HELPER (OFFLINE) */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              100% Offline Phrasebook
            </span>
            <h3 className="font-display font-bold text-lg text-gray-900 mt-1 flex items-center gap-2">
              <Languages size={20} className="text-[#00695C]" /> Guest Phrase Helper for Staff
            </h3>
            <p className="text-xs text-gray-600 mt-1">Instant local translation phrases to welcome guests smoothly in their native language.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">Guest Language:</span>
              <select
                value={guestLang}
                onChange={(e) => setGuestLang(e.target.value)}
                className="p-2.5 rounded-xl border border-gray-300 text-xs font-bold focus:ring-2 focus:ring-[#00695C]"
              >
                <option value="TA">Tamil (தமிழ்)</option>
                <option value="TE">Telugu (తెలుగు)</option>
                <option value="HI">Hindi (हिंदी)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">Topic:</span>
              <div className="flex items-center gap-1.5">
                {(['checkIn', 'amenities', 'directions'] as const).map(topic => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => setPhraseTopic(topic)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition cursor-pointer ${
                      phraseTopic === topic ? 'bg-[#00695C] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {topic === 'checkIn' ? 'Check-in' : topic}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Big-Text Phrase Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {(LOCAL_PHRASES[guestLang]?.[phraseTopic] || LOCAL_PHRASES['TA']['checkIn']).map((item, i) => (
              <div key={i} className="p-5 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-2">
                <div className="text-lg font-bold text-[#00695C]">{item.phrase}</div>
                <div className="text-xs font-semibold text-gray-800">English: {item.translation}</div>
                <div className="text-[11px] text-gray-500 italic">Pronunciation: "{item.pronunciation}"</div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. RESERVATIONS LIST */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-gray-900">Reservations & Check-ins</h3>
            <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full">
              Demo Data
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="py-3 px-3">Res ID</th>
                  <th className="py-3 px-3">Guest Name</th>
                  <th className="py-3 px-3">Check-In</th>
                  <th className="py-3 px-3">Check-Out</th>
                  <th className="py-3 px-3">Rooms</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-semibold text-gray-800">
                {SAMPLE_RESERVATIONS.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-3 px-3 text-[#00695C] font-bold">{r.id}</td>
                    <td className="py-3 px-3">{r.guest}</td>
                    <td className="py-3 px-3">{r.checkIn}</td>
                    <td className="py-3 px-3">{r.checkOut}</td>
                    <td className="py-3 px-3">{r.rooms}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-[#00695C] border border-teal-200">
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[10px] text-amber-700 font-bold">{r.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. LIST YOUR PROPERTY FORM */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <div>
            <h3 className="font-display font-bold text-xl text-gray-900 flex items-center gap-2">
              <Building2 size={22} className="text-[#00695C]" /> List Your Property for Direct Discovery
            </h3>
            <p className="text-xs text-gray-600 mt-1">Self-list your property on Sanchar AI with transparent partner attribution.</p>
          </div>

          {submitMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
              <Check size={16} /> {submitMsg}
            </div>
          )}

          <form onSubmit={handlePublishHotel} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="pub-form-city" className="block text-xs font-bold text-gray-700 mb-1">City</label>
                <input
                  id="pub-form-city"
                  name="formCity"
                  type="text"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="e.g. Chennai, Ooty, Jaipur"
                  className="w-full p-3 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
                  required
                />
              </div>
              <div>
                <label htmlFor="pub-hotel-name" className="block text-xs font-bold text-gray-700 mb-1">Property / Hotel Name</label>
                <input
                  id="pub-hotel-name"
                  name="hotelName"
                  type="text"
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                  placeholder="e.g. Blue Lagoon Homestay"
                  className="w-full p-3 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="pub-area-landmark" className="block text-xs font-bold text-gray-700 mb-1">Area / Landmark</label>
                <input
                  id="pub-area-landmark"
                  name="area"
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Near Beach Promenade"
                  className="w-full p-3 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
                />
              </div>
              <div>
                <label htmlFor="pub-reception-contact" className="block text-xs font-bold text-gray-700 mb-1">Direct Reception / Contact</label>
                <input
                  id="pub-reception-contact"
                  name="contact"
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full p-3 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Key Check-in Tip for Tourists</label>
              <textarea
                value={checkInTip}
                onChange={(e) => setCheckInTip(e.target.value)}
                placeholder="e.g. Reception desk open until 11 PM. Free parking behind lobby."
                rows={2}
                className="w-full p-3 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full md:w-auto px-6 py-3.5 bg-[#00695C] hover:bg-[#004D40] text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? 'Submitting...' : 'Submit Property Listing'} <ArrowRight size={16} />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
