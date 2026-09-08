import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Phone, MessageCircle, MapPin, Store, Check, ArrowRight, X } from 'lucide-react';
import axios from 'axios';

interface VendorListing {
  id: string;
  name: string;
  category: string;
  city: string;
  area: string;
  story: string;
  price: string;
  phone: string;
  whatsapp: string;
  image: string;
  label: string;
}

const SAMPLE_LISTINGS: VendorListing[] = [
  {
    id: 'VEND-1',
    name: 'Kanchi Silk Weavers Guild',
    category: 'Handlooms & Crafts',
    city: 'Chennai',
    area: 'Mylapore / Kanchipuram',
    story: 'Traditional 4th-generation master weavers crafting handloom Kanchipuram silk sarees directly from loom to tourist.',
    price: 'From ₹3,500 / saree',
    phone: '+919876543210',
    whatsapp: '919876543210',
    image: '/images/spots/kapaleeshwarar.jpg',
    label: 'Sample listing (Demo Data)'
  },
  {
    id: 'VEND-2',
    name: 'Fort Kochi Heritage Food Walks',
    category: 'Street Food Trails',
    city: 'Kochi',
    area: 'Fort Kochi Beach Front',
    story: 'Local culinary explorer leading 2-hour morning spice and seafood tasting walks through historic Dutch-Portuguese lanes.',
    price: '₹600 / person',
    phone: '+919876543211',
    whatsapp: '919876543211',
    image: '/images/spots/chinese-fishing-nets.jpg',
    label: 'Sample listing (Demo Data)'
  },
  {
    id: 'VEND-3',
    name: 'Jaipur Block Print Workshop',
    category: 'Handlooms & Crafts',
    city: 'Jaipur',
    area: 'Johari Bazaar / Sanganer',
    story: 'Hands-on natural indigo dye and woodblock carving experience with local artisan family in Pink City.',
    price: '₹850 / 2-hour session',
    phone: '+919876543212',
    whatsapp: '919876543212',
    image: '/images/spots/hawa-mahal.jpg',
    label: 'Sample listing (Demo Data)'
  },
  {
    id: 'VEND-4',
    name: 'Backwater Kayak Eco-Tours',
    category: 'Eco-Tours',
    city: 'Kochi',
    area: 'Kumbalangi / Alleppey',
    story: 'Silent sunrise kayak tours through quiet canal village ecosystems guided by native fishermen.',
    price: '₹1,200 / tour',
    phone: '+919876543213',
    whatsapp: '919876543213',
    image: '/images/spots/mattancherry-palace.jpg',
    label: 'Sample listing (Demo Data)'
  }
];

export const MarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.get('demo') === '1';

  const [activeCategory, setActiveCategory] = useState('All');
  const [activeCity, setActiveCity] = useState('All');
  const [selectedVendor, setSelectedVendor] = useState<VendorListing | null>(null);

  // Form state
  const [formCity, setFormCity] = useState('Chennai');
  const [bizName, setBizName] = useState('');
  const [category, setCategory] = useState('Handlooms & Crafts');
  const [area, setArea] = useState('');
  const [story, setStory] = useState('');
  const [price, setPrice] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const categories = ['All', 'Handlooms & Crafts', 'Local Guides', 'Street Food Trails', 'Eco-Tours'];

  const filteredListings = SAMPLE_LISTINGS.filter(item => {
    const catMatch = activeCategory === 'All' || item.category === activeCategory;
    const cityMatch = activeCity === 'All' || item.city.toLowerCase() === activeCity.toLowerCase();
    return catMatch && cityMatch;
  });

  const handleListBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName.trim()) return;
    setSubmitting(true);
    setSubmitMsg(null);

    try {
      const res = await axios.post('/api/partner-publish', {
        role: 'Local Business',
        city: formCity,
        type: 'place_guide',
        name: bizName,
        category,
        area: area || formCity,
        cost: price || 'Contact directly',
        description: story,
        contact: phone,
        publisherName: bizName
      });
      setSubmitMsg(res.data?.message || 'Free listing submitted with Published by vendor · check locally attribution.');
      setBizName('');
      setArea('');
      setStory('');
      setPrice('');
      setPhone('');
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to submit business listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] pb-16">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm font-bold text-[#00695C] hover:underline cursor-pointer">
          <ChevronLeft size={18} /> Home
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Local Direct Marketplace</span>
        <div className="w-10" />
      </div>

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#00695C] to-teal-800 text-white py-10 px-4 md:px-8">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full border border-white/30">
              Direct Contact · No Middleman Commissions
            </span>
            {isDemo && (
              <span className="text-[10px] font-extrabold uppercase tracking-widest bg-[#F59E0B] text-gray-900 px-3 py-1 rounded-full">
                Demo Data Active
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-4xl font-display font-bold">Local Artisans & Experiences</h1>
          <p className="text-xs md:text-sm text-emerald-100 max-w-2xl leading-relaxed">
            Connect directly with verified local weavers, food trail leads, and eco-guides. Pay vendors directly on-site without platform markup.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full p-4 md:p-8 space-y-8">

        {/* Category Pills & City Filter */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-gray-700">Filter by Specialty</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">City:</span>
              <select
                value={activeCity}
                onChange={(e) => setActiveCity(e.target.value)}
                className="p-2 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
              >
                <option value="All">All Cities</option>
                <option value="Chennai">Chennai</option>
                <option value="Kochi">Kochi</option>
                <option value="Jaipur">Jaipur</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeCategory === cat ? 'bg-[#00695C] text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Vendor Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredListings.map((vendor) => (
            <div key={vendor.id} className="card-retreat bg-white rounded-3xl overflow-hidden border border-gray-200 shadow-sm flex flex-col group">
              <div className="h-48 w-full overflow-hidden relative">
                <img
                  src={vendor.image}
                  alt={vendor.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" fill="%2300695C"><rect width="100%25" height="100%25"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23FFFFFF" font-family="sans-serif" font-size="16px">Local Vendor</text></svg>';
                  }}
                />
                <div className="absolute top-3 right-3 bg-black/60 text-white text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm">
                  {vendor.label}
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#00695C] bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                      {vendor.category}
                    </span>
                    <span className="text-xs font-bold text-gray-700">{vendor.price}</span>
                  </div>
                  <h3 className="font-display font-bold text-lg text-gray-900">{vendor.name}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <MapPin size={12} className="text-[#F59E0B]" /> {vendor.area}, {vendor.city}
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed mt-3">{vendor.story}</p>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-gray-500 font-semibold italic">Published by vendor · check locally</span>
                  <button
                    type="button"
                    onClick={() => setSelectedVendor(vendor)}
                    className="px-4 py-2 bg-[#00695C] hover:bg-[#004D40] text-white text-xs font-bold rounded-full transition cursor-pointer"
                  >
                    Connect Direct
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CONNECT DIRECT MODAL */}
        {selectedVendor && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6 relative border border-gray-200 shadow-2xl animate-in fade-in zoom-in-95">
              <button
                onClick={() => setSelectedVendor(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
              >
                <X size={20} />
              </button>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#00695C] bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                  Direct Contact — Pay Vendor Directly
                </span>
                <h3 className="font-display font-bold text-xl text-gray-900 mt-2">{selectedVendor.name}</h3>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <MapPin size={12} className="text-[#F59E0B]" /> {selectedVendor.area}, {selectedVendor.city}
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2 text-xs">
                <div className="font-bold text-gray-800">Pricing & Availability:</div>
                <div className="text-[#00695C] font-bold text-sm">{selectedVendor.price}</div>
                <div className="text-[11px] text-gray-500 italic">No booking fee or platform markup.</div>
              </div>

              <div className="space-y-3 pt-2">
                <a
                  href={`tel:${selectedVendor.phone}`}
                  className="w-full py-3 bg-[#00695C] hover:bg-[#004D40] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition no-underline"
                >
                  <Phone size={16} /> Call Vendor ({selectedVendor.phone})
                </a>

                <a
                  href={`https://wa.me/${selectedVendor.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition no-underline"
                >
                  <MessageCircle size={16} /> WhatsApp Vendor Directly
                </a>
              </div>

              <div className="text-[10px] text-center text-gray-500 font-medium pt-2">
                Direct contact — pay the vendor directly on site.
              </div>
            </div>
          </div>
        )}

        {/* LIST YOUR BUSINESS FORM */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <div>
            <h3 className="font-display font-bold text-xl text-gray-900 flex items-center gap-2">
              <Store size={22} className="text-[#00695C]" /> List Your Local Business or Experience
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              Free listing · your contact is shared only when a tourist connects.
            </p>
          </div>

          {submitMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
              <Check size={16} /> {submitMsg}
            </div>
          )}

          <form onSubmit={handleListBusiness} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="e.g. Kochi, Jaipur, Chennai"
                  className="w-full p-3 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Business or Service Name</label>
                <input
                  type="text"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  placeholder="e.g. Fort Kochi Spice Walk"
                  className="w-full p-3 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
                >
                  <option value="Handlooms & Crafts">Handlooms & Crafts</option>
                  <option value="Local Guides">Local Guides</option>
                  <option value="Street Food Trails">Street Food Trails</option>
                  <option value="Eco-Tours">Eco-Tours</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Area / Landmark</label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Fort Kochi promenade"
                  className="w-full p-3 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Phone / WhatsApp</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full p-3 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Short Story & Service Blurb</label>
              <textarea
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder="Explain what you offer to tourists directly..."
                rows={3}
                className="w-full p-3 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-[#00695C]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full md:w-auto px-6 py-3.5 bg-[#00695C] hover:bg-[#004D40] text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? 'Submitting...' : 'List Business for Free'} <ArrowRight size={16} />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
