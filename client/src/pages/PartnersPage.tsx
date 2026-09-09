import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Hotel, Store, Plus, Check, ChevronLeft, Sparkles, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { CityAutocomplete } from '../components/CityAutocomplete';



export const PartnersPage: React.FC = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<'Travel Agency' | 'Hotel' | 'Local Business'>('Travel Agency');
  const [city, setCity] = useState('Chennai');
  const [customCity, setCustomCity] = useState('');

  const [type, setType] = useState<'place_guide' | 'hotel'>('place_guide');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('heritage');
  const [area, setArea] = useState('');
  const [hours, setHours] = useState('');
  const [cost, setCost] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState('');
  const [checkInTip, setCheckInTip] = useState('');
  const [contact, setContact] = useState('');
  const [bestWayToArrive, setBestWayToArrive] = useState('');
  const [publisherName, setPublisherName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [publishedItems, setPublishedItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeCity = customCity.trim() || city;

  // Sync type with role selection
  useEffect(() => {
    if (role === 'Hotel') {
      setType('hotel');
    } else {
      setType('place_guide');
    }
  }, [role]);

  const fetchPartnerItems = async () => {
    setLoadingItems(true);
    try {
      const res = await axios.get(`/api/partner-publish?city=${encodeURIComponent(activeCity)}`);
      setPublishedItems(res.data?.items || []);
    } catch {
      setPublishedItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    fetchPartnerItems();
  }, [activeCity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setSuccessMessage(null);

    try {
      const payload = {
        role,
        city: activeCity,
        type,
        name,
        category: type === 'place_guide' ? category : undefined,
        area,
        hours: hours || 'check locally',
        cost: cost || 'check locally',
        description,
        photo,
        checkInTip: type === 'hotel' ? checkInTip : undefined,
        contact,
        bestWayToArrive: type === 'hotel' ? bestWayToArrive : undefined,
        publisherName: publisherName || role
      };

      const res = await axios.post('/api/partner-publish', payload);
      setSuccessMessage(res.data?.message || 'Published successfully with partner label.');
      
      // Reset form
      setName('');
      setDescription('');
      setPhoto('');
      setCheckInTip('');
      setBestWayToArrive('');
      
      // Refresh list
      fetchPartnerItems();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to publish item.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col">
      {/* Navigation Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm font-bold text-[#00695C] hover:underline cursor-pointer min-h-[44px]">
          <ChevronLeft size={18} /> Home
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-gray-600">For Tourism Partners</span>
        <div className="w-10" />
      </div>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-[#00695C] to-teal-800 text-white py-10 px-4 md:px-8">
        <div className="max-w-5xl mx-auto space-y-3">
          <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full border border-white/30">
            SIH Tourism Industry Solution
          </span>
          <h1 className="text-2xl md:text-4xl font-display font-bold">Publish Place & Hotel Guides</h1>
          <p className="text-xs md:text-sm text-emerald-100 max-w-2xl leading-relaxed">
            Empowering travel agencies, hotels, and local businesses to share authentic local information across India. All content carries transparent partner attribution.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full p-4 md:p-8 space-y-10 flex-1">
        
        {/* ROLE & CITY SELECTOR */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <h2 className="font-display font-bold text-lg text-gray-800 flex items-center gap-2">
            <Building2 size={20} className="text-[#00695C]" /> 1. Select Your Partner Role & Target City
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setRole('Travel Agency')}
              className={`p-4 rounded-2xl border-2 font-bold text-sm flex items-center gap-3 transition cursor-pointer ${
                role === 'Travel Agency' ? 'border-[#00695C] bg-teal-50 text-[#00695C]' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Store size={22} className={role === 'Travel Agency' ? 'text-[#00695C]' : 'text-gray-400'} />
              <div className="text-left">
                <div className="text-xs font-bold">Travel Agency</div>
                <div className="text-[10px] font-normal text-gray-500">Publish spot & place guides</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRole('Hotel')}
              className={`p-4 rounded-2xl border-2 font-bold text-sm flex items-center gap-3 transition cursor-pointer ${
                role === 'Hotel' ? 'border-[#00695C] bg-teal-50 text-[#00695C]' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Hotel size={22} className={role === 'Hotel' ? 'text-[#00695C]' : 'text-gray-400'} />
              <div className="text-left">
                <div className="text-xs font-bold">Hotel / Stay</div>
                <div className="text-[10px] font-normal text-gray-500">Publish hotel arrival profile</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRole('Local Business')}
              className={`p-4 rounded-2xl border-2 font-bold text-sm flex items-center gap-3 transition cursor-pointer ${
                role === 'Local Business' ? 'border-[#00695C] bg-teal-50 text-[#00695C]' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Building2 size={22} className={role === 'Local Business' ? 'text-[#00695C]' : 'text-gray-400'} />
              <div className="text-left">
                <div className="text-xs font-bold">Local Business</div>
                <div className="text-[10px] font-normal text-gray-500">Shops, food hubs, experiences</div>
              </div>
            </button>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-bold text-gray-700 mb-1">Target City in India (~800 fast search / ~8,000 deep search)</label>
            <CityAutocomplete
              variant="compact"
              value={customCity || city}
              onChange={(val) => {
                setCustomCity(val);
                setCity(val);
              }}
              onSelectCity={(val) => {
                setCustomCity(val);
                setCity(val);
              }}
              placeholder="Search or type any city in India (e.g. Chennai, Ooty, Jaipur...)"
            />
          </div>
        </div>

        {/* PUBLISH FORM */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <h2 className="font-display font-bold text-lg text-gray-800 flex items-center gap-2">
              <Plus size={20} className="text-[#00695C]" /> 2. Publish {type === 'hotel' ? 'Hotel Profile' : 'Place Guide'} for {activeCity}
            </h2>
            <span className="text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
              Partner published · check locally
            </span>
          </div>

          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2">
              <Check size={18} className="text-emerald-600" /> {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="partner-pub-name" className="block text-xs font-bold text-gray-700 mb-1">
                  {type === 'hotel' ? 'Hotel / Property Name *' : 'Place / Attraction Name *'}
                </label>
                <input
                  id="partner-pub-name"
                  name="publisherItemName"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={type === 'hotel' ? 'e.g. Grand Heritage Hotel' : 'e.g. Marina Sunset Food Walk'}
                  className="w-full p-3 rounded-xl border border-gray-300 text-sm font-semibold focus:ring-2 focus:ring-[#00695C]"
                />
              </div>

              <div>
                <label htmlFor="partner-pub-org" className="block text-xs font-bold text-gray-700 mb-1">Publisher Name / Organization</label>
                <input
                  id="partner-pub-org"
                  name="publisherOrg"
                  type="text"
                  value={publisherName}
                  onChange={(e) => setPublisherName(e.target.value)}
                  placeholder={`e.g. ${role} Team`}
                  className="w-full p-3 rounded-xl border border-gray-300 text-sm font-medium focus:ring-2 focus:ring-[#00695C]"
                />
              </div>
            </div>

            {type === 'place_guide' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="partner-pub-cat" className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                    <select
                      id="partner-pub-cat"
                      name="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full p-3 rounded-xl border border-gray-300 text-sm font-semibold"
                    >
                      <option value="heritage">Heritage & Monument</option>
                      <option value="food">Local Food & Dining</option>
                      <option value="shopping">Shopping & Bazaars</option>
                      <option value="transport">Transport & Tour</option>
                      <option value="other">Other Experience</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="partner-pub-area" className="block text-xs font-bold text-gray-700 mb-1">Area / Neighborhood</label>
                    <input
                      id="partner-pub-area"
                      name="area"
                      type="text"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="e.g. Mylapore"
                      className="w-full p-3 rounded-xl border border-gray-300 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="partner-pub-hours" className="block text-xs font-bold text-gray-700 mb-1">Timings ("or check locally")</label>
                    <input
                      id="partner-pub-hours"
                      name="hours"
                      type="text"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      placeholder="e.g. 9 AM - 7 PM or check locally"
                      className="w-full p-3 rounded-xl border border-gray-300 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="partner-pub-cost" className="block text-xs font-bold text-gray-700 mb-1">Entry / Guide Cost ("or check locally")</label>
                  <input
                    id="partner-pub-cost"
                    name="cost"
                    type="text"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="e.g. Free entry / ₹50 or check locally"
                    className="w-full p-3 rounded-xl border border-gray-300 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="partner-pub-desc" className="block text-xs font-bold text-gray-700 mb-1">Short Description (Real & Honest)</label>
                  <textarea
                    id="partner-pub-desc"
                    name="description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what makes this place special for visitors..."
                    className="w-full p-3 rounded-xl border border-gray-300 text-xs text-gray-800"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="partner-pub-addr" className="block text-xs font-bold text-gray-700 mb-1">Area / Full Address</label>
                    <input
                      id="partner-pub-addr"
                      name="areaAddress"
                      type="text"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="e.g. Near Central Station, Road No. 4"
                      className="w-full p-3 rounded-xl border border-gray-300 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="partner-pub-phone" className="block text-xs font-bold text-gray-700 mb-1">Contact Phone (Optional)</label>
                    <input
                      id="partner-pub-phone"
                      name="contactPhone"
                      type="text"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="e.g. +91 9876543210"
                      className="w-full p-3 rounded-xl border border-gray-300 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="partner-pub-arrive" className="block text-xs font-bold text-gray-700 mb-1">Best Way to Arrive (Station/Airport → Hotel)</label>
                  <input
                    id="partner-pub-arrive"
                    name="bestWayToArrive"
                    type="text"
                    value={bestWayToArrive}
                    onChange={(e) => setBestWayToArrive(e.target.value)}
                    placeholder="e.g. Take prepaid auto from Central Station (approx 15 mins)"
                    className="w-full p-3 rounded-xl border border-gray-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Check-in Tip / Travel Guidance</label>
                  <textarea
                    rows={2}
                    value={checkInTip}
                    onChange={(e) => setCheckInTip(e.target.value)}
                    placeholder="e.g. 24-hr check-in available. Keep photo ID ready at reception."
                    className="w-full p-3 rounded-xl border border-gray-300 text-xs text-gray-800"
                  />
                </div>
              </>
            )}

            <div className="pt-3">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-[#00695C] hover:bg-[#004D40] text-white font-extrabold text-sm rounded-2xl shadow-md transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 min-h-[48px]"
              >
                <Plus size={18} /> {submitting ? 'Publishing...' : `Publish ${type === 'hotel' ? 'Hotel Profile' : 'Place Guide'}`}
              </button>
            </div>
          </form>
        </div>

        {/* LIVE PARTNER PUBLISHED CONTENT SECTION */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-xl text-gray-800 flex items-center gap-2">
              <Sparkles size={20} className="text-[#00695C]" /> Published Partner Content for {activeCity}
            </h2>
            <button onClick={() => navigate(`/city/${encodeURIComponent(activeCity)}`)} className="text-xs font-bold text-[#00695C] hover:underline cursor-pointer">
              View on City Page →
            </button>
          </div>

          {loadingItems ? (
            <div className="bg-white p-8 rounded-3xl border border-gray-200 text-center text-xs font-bold text-gray-500">
              Loading partner publications...
            </div>
          ) : publishedItems.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-gray-200 text-center space-y-3">
              <AlertCircle size={36} className="text-amber-500 mx-auto" />
              <h3 className="font-bold text-sm text-gray-800">No partner-published guides for {activeCity} yet</h3>
              <p className="text-xs text-gray-500">Be the first to publish a verified local guide using the form above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {publishedItems.map((item: any, idx: number) => (
                <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3 relative">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#00695C] bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                      Partner published · check locally
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold">{item.role}</span>
                  </div>

                  <h4 className="font-bold text-gray-900 text-base">{item.name}</h4>
                  <p className="text-xs text-gray-600 line-clamp-2">{item.description || item.checkInTip || 'Local partner listing.'}</p>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-medium">
                    <span>📍 {item.area || activeCity}</span>
                    <span>By {item.publisherName || item.role}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
