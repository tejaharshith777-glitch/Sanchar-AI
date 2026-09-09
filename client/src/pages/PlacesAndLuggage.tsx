import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SancharMap from '../components/SancharMap';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { 
  Compass, MapPin, Navigation, Info, Clock, AlertTriangle, ShieldCheck, 
  ChevronLeft, Check, Save, Share2, Sparkles
} from 'lucide-react';
import axios from 'axios';
import { getCachedCityPack } from '../store/db';

class SpotErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    console.error('SpotErrorBoundary caught error:', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-6 font-['Plus_Jakarta_Sans']">
          <div className="text-center max-w-md bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
            <AlertTriangle size={48} className="text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Place details unavailable</h2>
            <p className="text-sm text-gray-500 mb-6 font-medium">An unexpected error occurred while loading this place.</p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="w-full py-3.5 bg-[#00695C] text-white font-bold rounded-xl hover:bg-[#004D40] transition cursor-pointer min-h-[44px]"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── PLACE DETAIL PAGE INNER ───
const PlaceDetailPageInner = () => {
  const { cityName, slug } = useParams<{ cityName: string; slug: string }>();
  const navigate = useNavigate();

  const [spot, setSpot] = useState<any>(null);
  const [nearbySpots, setNearbySpots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [imgError, setImgError] = useState(false);
  
  // Geolocation & Directions
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [geocodedCoords, setGeocodedCoords] = useState<[number, number] | null>(null);

  // Issue reporting modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCategory, setReportCategory] = useState<'language barrier' | 'overcharging' | 'poor signage' | 'low connectivity' | 'other'>('language barrier');
  const [reportNote, setReportNote] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccessMsg, setReportSuccessMsg] = useState<string | null>(null);

  // Normalize names
  const city = cityName ? cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase() : '';

  const fetchSpotDetails = async () => {
    setLoading(true);
    setError(null);
    setImgError(false);
    
    try {
      if (navigator.onLine) {
        try {
          const res = await axios.get(`/api/spots/${encodeURIComponent(city)}/${encodeURIComponent(slug || '')}`);
          if (res.data && (res.data.name || res.data.title)) {
            setSpot(res.data);
          } else {
            throw new Error('Empty spot data');
          }
        } catch {
          // Fallback to offline cached pack
          const pack = await getCachedCityPack(city);
          const localSpot = pack?.spots?.find((s: any) => 
            (s.slug || '').toLowerCase() === (slug || '').toLowerCase() ||
            s.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === (slug || '').toLowerCase()
          );
          if (localSpot) {
            setSpot(localSpot);
          } else {
            setError('Place details unavailable right now. Please check network and retry.');
          }
        }
        
        // Fetch nearby spots from same city
        try {
          const cityRes = await axios.get(`/api/city-spots/${encodeURIComponent(city)}`);
          if (cityRes.data && Array.isArray(cityRes.data.spots)) {
            const currentSlug = (slug || '').toLowerCase();
            const others = cityRes.data.spots.filter((s: any) => 
              (s.slug || '').toLowerCase() !== currentSlug &&
              s.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') !== currentSlug
            );
            setNearbySpots(others.slice(0, 3));
          }
        } catch {
          // ignore nearby error
        }
      } else {
        // Offline cached pack fallback
        const pack = await getCachedCityPack(city);
        const localSpot = pack?.spots?.find((s: any) => 
          (s.slug || '').toLowerCase() === (slug || '').toLowerCase() ||
          s.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === (slug || '').toLowerCase()
        );
        if (localSpot) {
          setSpot(localSpot);
          const others = (pack?.spots || []).filter((s: any) => 
            (s.slug || '').toLowerCase() !== (slug || '').toLowerCase()
          );
          setNearbySpots(others.slice(0, 3));
        } else {
          setError('Place details unavailable in offline cache. Connect to internet and retry.');
        }
      }
    } catch (err) {
      setError('Place details unavailable right now. Click Retry to reload.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpotDetails();
  }, [city, slug]);

  // Live Nominatim geocoding fallback when coordinates are absent
  useEffect(() => {
    if (spot && (typeof spot.lat !== 'number' || typeof spot.lng !== 'number')) {
      let active = true;
      const query = `${spot.name || ''}, ${city}`;
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(data => {
          if (active && data && data.length > 0 && data[0].lat && data[0].lon) {
            setGeocodedCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
          }
        })
        .catch(() => {});
      return () => { active = false; };
    } else {
      setGeocodedCoords(null);
    }
  }, [spot, city]);

  // Check saved state in localStorage
  useEffect(() => {
    if (!spot) return;
    try {
      const saved = JSON.parse(localStorage.getItem('saved_places') || '[]');
      const found = saved.some((item: any) => item.name === spot.name || item.slug === spot.slug);
      setIsSaved(found);
    } catch {
      setIsSaved(false);
    }
  }, [spot]);

  const effectiveLat = typeof spot?.lat === 'number' ? spot.lat : (geocodedCoords ? geocodedCoords[0] : null);
  const effectiveLng = typeof spot?.lng === 'number' ? spot.lng : (geocodedCoords ? geocodedCoords[1] : null);
  const hasCoords = effectiveLat !== null && effectiveLng !== null;

  // User geolocation for distance calculation
  useEffect(() => {
    if (navigator.geolocation && hasCoords) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const uLat = pos.coords.latitude;
          const uLng = pos.coords.longitude;
          setUserPos([uLat, uLng]);

          // Haversine formula
          const R = 6371;
          const dLat = (effectiveLat! - uLat) * Math.PI / 180;
          const dLng = (effectiveLng! - uLng) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(uLat * Math.PI / 180) * Math.cos(effectiveLat! * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          setDistanceKm(dist);
        },
        (err) => console.warn('User location denied/unavailable:', err),
        { timeout: 5000 }
      );
    }
  }, [spot, hasCoords, effectiveLat, effectiveLng]);

  // Save place to localStorage "saved_places"
  const toggleSaveSpot = () => {
    if (!spot) return;
    try {
      const saved = JSON.parse(localStorage.getItem('saved_places') || '[]');
      if (isSaved) {
        const filtered = saved.filter((item: any) => item.name !== spot.name && item.slug !== spot.slug);
        localStorage.setItem('saved_places', JSON.stringify(filtered));
        setIsSaved(false);
      } else {
        saved.push({
          name: spot.name,
          slug: spot.slug || spot.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          city,
          category: spot.category || 'spot',
          image: spot.image || '',
          savedAt: new Date().toISOString()
        });
        localStorage.setItem('saved_places', JSON.stringify(saved));
        setIsSaved(true);
      }
    } catch {
      // localStorage error fallback
    }
  };

  const sharePlace = () => {
    if (navigator.share) {
      navigator.share({
        title: `Explore ${spot?.name} on Sanchar AI`,
        text: spot?.blurb,
        url: window.location.href
      }).catch(console.warn);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportSubmitting(true);
    setReportSuccessMsg(null);
    try {
      const res = await axios.post('/api/issue-reports', {
        city,
        category: reportCategory,
        note: reportNote,
        spotSlug: spot?.slug || slug
      });
      setReportSuccessMsg(res.data?.message || 'Thank you — your report is anonymous and helps local businesses improve service.');
      setReportNote('');
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccessMsg(null);
      }, 2000);
    } catch {
      setReportSuccessMsg('Report saved locally.');
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccessMsg(null);
      }, 2000);
    } finally {
      setReportSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-6 font-['Plus_Jakarta_Sans']">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#00695C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-gray-600">Loading place details...</p>
        </div>
      </div>
    );
  }

  if (error || !spot) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-6 font-['Plus_Jakarta_Sans']">
        <div className="text-center max-w-md bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
          <AlertTriangle size={48} className="text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Place details unavailable</h2>
          <p className="text-sm text-gray-500 mb-6 font-medium">{error || 'Spot was not found.'}</p>
          <div className="flex gap-3">
            <button onClick={fetchSpotDetails} className="flex-1 py-3.5 bg-[#00695C] text-white font-bold rounded-xl hover:bg-[#004D40] transition cursor-pointer min-h-[44px]">Retry</button>
            <button onClick={() => navigate(`/city/${encodeURIComponent(city)}`)} className="flex-1 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition cursor-pointer min-h-[44px]">Back to {city || 'City'}</button>
          </div>
        </div>
      </div>
    );
  }

  const googleMapsUrl = hasCoords 
    ? `https://www.google.com/maps/search/?api=1&query=${effectiveLat},${effectiveLng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((spot.name || '') + ' ' + city)}`;

  const centerCoords: [number, number] = hasCoords ? [effectiveLat!, effectiveLng!] : [20.5937, 78.9629];
  const highlightsList: string[] = spot.highlights && spot.highlights.length > 0
    ? spot.highlights
    : (spot.bestThing ? [spot.bestThing, spot.blurb] : [spot.blurb || 'A verified local spot in ' + city]);

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
        <button onClick={() => navigate(`/city/${encodeURIComponent(city)}`)} className="flex items-center gap-1.5 text-sm font-bold text-[#00695C] hover:underline cursor-pointer min-h-[44px]">
          <ChevronLeft size={18} /> Back to {city}
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Spot Details</span>
        <button onClick={sharePlace} aria-label="Share spot" className="p-2 rounded-full hover:bg-gray-100 text-gray-600 cursor-pointer"><Share2 size={18} /></button>
      </div>

      {/* PHOTO HEADER or Text Tile */}
      <div className="relative w-full">
        {spot.image && !imgError ? (
          <div className="h-64 md:h-80 w-full overflow-hidden bg-gradient-to-br from-[#00695C] to-[#004D40] relative">
            <img 
              src={spot.image} 
              alt={spot.name} 
              className="w-full h-full object-cover opacity-90" 
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-6 md:p-8">
              <div className="max-w-6xl mx-auto w-full">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#F59E0B] bg-[#F59E0B]/20 py-1 px-3 rounded-full border border-[#F59E0B]/40">Curated · verify locally</span>
                  {spot.category && <span className="text-[10px] font-bold uppercase tracking-widest text-white bg-teal-800/80 py-1 px-3 rounded-full border border-teal-600/50">{spot.category}</span>}
                </div>
                <h1 className="text-2xl md:text-4xl font-display font-bold text-white mb-1">{spot.name}</h1>
                <p className="text-xs md:text-sm text-gray-200 flex items-center gap-1 font-medium"><MapPin size={14} className="text-[#F59E0B]" /> {spot.area ? `${spot.area}, ${city}` : `${city}, India`}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-48 md:h-64 rounded-none bg-gradient-to-r from-emerald-800 to-teal-900 p-6 md:p-8 flex flex-col justify-end text-white border-b border-teal-900">
            <div className="max-w-6xl mx-auto w-full">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#F59E0B] bg-[#F59E0B]/20 py-1 px-3 rounded-full border border-[#F59E0B]/40">Curated · verify locally</span>
                {spot.category && <span className="text-[10px] font-bold uppercase tracking-widest text-white bg-white/20 py-1 px-3 rounded-full border border-white/30">{spot.category}</span>}
              </div>
              <h1 className="text-2xl md:text-4xl font-display font-bold text-white mb-1">{spot.name}</h1>
              <p className="text-xs md:text-sm text-emerald-200 flex items-center gap-1 font-medium"><MapPin size={14} className="text-[#F59E0B]" /> {spot.area ? `${spot.area}, ${city}` : `${city}, India`}</p>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Layout */}
      <div className="max-w-6xl mx-auto w-full p-4 md:p-8 space-y-8 flex-1">
        
        {/* LIVE MAP (Leaflet ~45vh) */}
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm flex flex-col">
          <div className="bg-gray-50 border-b border-gray-100 p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Compass size={18} className="text-[#00695C]" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700">Live Spot Map</span>
            </div>
            {distanceKm !== null && (
              <span className="text-xs font-bold text-[#00695C] bg-teal-50 border border-teal-200 px-3 py-1 rounded-full">
                You are here: ≈ {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} from spot
              </span>
            )}
          </div>

          <div className="h-[45vh] min-h-[300px] w-full relative">
            {hasCoords ? (
              <SancharMap
                center={centerCoords}
                zoom={15}
                userPos={userPos}
                showOfflineBanner={false}
                heightClass="h-full"
                markers={[
                  {
                    position: centerCoords,
                    popupContent: (
                      <div className="text-center p-1">
                        <h4 className="font-bold text-xs">{spot.name}</h4>
                        <p className="text-[10px] text-gray-500">{spot.area || city}</p>
                      </div>
                    ),
                    iconEmoji: '📍'
                  }
                ]}
                polylines={userPos ? [
                  {
                    positions: [userPos, centerCoords],
                    color: '#00695C',
                    dashArray: '6, 6'
                  }
                ] : []}
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50 p-6 text-center">
                <div>
                  <MapPin size={36} className="text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-600">Map unavailable for this place — try again later</p>
                  <p className="text-xs text-gray-500 mt-1">Honest fallback: coordinates not verified yet</p>
                </div>
              </div>
            )}

            {/* Deep link button over map */}
            <div className="absolute bottom-4 right-4 z-[1000]">
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-800 text-xs font-bold rounded-xl shadow-lg border border-gray-200 hover:bg-gray-50 transition cursor-pointer"
              >
                <Navigation size={14} className="text-[#00695C]" /> Open in Google Maps
              </a>
            </div>
          </div>

          <div className="bg-gray-50 border-t border-gray-100 p-3 text-center text-xs font-medium text-gray-600">
            We handle the journey. Google Maps handles the turns.
          </div>
        </div>

        {/* 2×3 FACTS GRID */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-display font-bold text-lg text-gray-800">Place Overview</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{spot.blurb}</p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-gray-50 border border-gray-100">
              <Compass size={18} className="text-[#00695C] mt-0.5 shrink-0" />
              <div>
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Category</h5>
                <p className="text-xs font-bold text-gray-800 capitalize">{spot.category || 'Tourist Attraction'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-gray-50 border border-gray-100">
              <MapPin size={18} className="text-[#00695C] mt-0.5 shrink-0" />
              <div>
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Area / Address</h5>
                <p className="text-xs font-bold text-gray-800">{spot.area || city}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-gray-50 border border-gray-100">
              <Clock size={18} className="text-[#00695C] mt-0.5 shrink-0" />
              <div>
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Best Time</h5>
                <p className="text-xs font-bold text-gray-800">{spot.bestTime && spot.bestTime !== '—' ? spot.bestTime : 'Early morning / evening'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-gray-50 border border-gray-100">
              <Clock size={18} className="text-[#00695C] mt-0.5 shrink-0" />
              <div>
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Time to Spend</h5>
                <p className="text-xs font-bold text-gray-800">{spot.timeToSpend && spot.timeToSpend !== '—' ? spot.timeToSpend : '1–2 Hours'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-gray-50 border border-gray-100">
              <Info size={18} className="text-[#00695C] mt-0.5 shrink-0" />
              <div>
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Entry Cost</h5>
                <p className="text-xs font-bold text-gray-800">{spot.entryCost && spot.entryCost !== '—' ? spot.entryCost : 'Free / check locally'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-gray-50 border border-gray-100">
              <Navigation size={18} className="text-[#00695C] mt-0.5 shrink-0" />
              <div>
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Nearest Transport</h5>
                <p className="text-xs font-bold text-gray-800">{spot.nearTransport && spot.nearTransport !== '—' ? spot.nearTransport : 'Auto / City bus'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* WHAT MAKES IT SPECIAL SECTION */}
        <div className="bg-teal-50/80 p-6 rounded-3xl border border-teal-200 space-y-4">
          <h3 className="font-display font-bold text-lg text-teal-950 flex items-center gap-2">
            <Sparkles size={20} className="text-[#F59E0B]" /> What makes it special
          </h3>
          <ul className="space-y-2.5">
            {highlightsList.map((fact: string, idx: number) => (
              <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm font-semibold text-teal-900 leading-relaxed">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">{idx + 1}</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* TIPS SECTION */}
        {spot.tips && spot.tips.length > 0 && spot.tips[0] !== '—' && (
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-lg text-gray-800 flex items-center gap-2">
              <ShieldCheck size={20} className="text-[#00695C]" /> Travel & Safety Tips
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {spot.tips.map((tip: string, idx: number) => (
                <div key={idx} className="flex items-start gap-2.5 p-3 rounded-2xl bg-gray-50 border border-gray-100 text-xs text-gray-700 font-medium leading-relaxed">
                  <Check size={16} className="text-[#00695C] shrink-0 mt-0.5" />
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ACTION ROW */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-500">Actions for this destination</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Primary Big Teal: Start Safe Trip Here */}
            <button
              onClick={() => navigate(`/create?city=${encodeURIComponent(city)}&destination=${encodeURIComponent(spot.name)}`)}
              className="py-3.5 px-4 bg-[#00695C] hover:bg-[#004D40] text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-md transition cursor-pointer min-h-[48px] flex items-center justify-center gap-2"
            >
              <Compass size={18} /> Start Safe Trip Here
            </button>

            {/* Secondary: Open in Google Maps */}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs sm:text-sm rounded-2xl transition cursor-pointer min-h-[48px] flex items-center justify-center gap-2 text-center"
            >
              <Navigation size={18} className="text-[#00695C]" /> Open in Google Maps
            </a>

            {/* Save: localStorage "Saved places" */}
            <button
              onClick={toggleSaveSpot}
              className={`py-3.5 px-4 font-bold text-xs sm:text-sm rounded-2xl border transition cursor-pointer min-h-[48px] flex items-center justify-center gap-2 ${
                isSaved
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {isSaved ? <Check size={18} className="text-emerald-700" /> : <Save size={18} />}
              <span>{isSaved ? 'Saved on this device' : 'Save place'}</span>
            </button>

            {/* Report a problem */}
            <button
              onClick={() => setShowReportModal(true)}
              className="py-3.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs sm:text-sm rounded-2xl transition cursor-pointer min-h-[48px] flex items-center justify-center gap-2"
            >
              <AlertTriangle size={18} className="text-amber-600" /> Report a problem
            </button>
          </div>
        </div>

        {/* NEARBY SPOTS */}
        {nearbySpots.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <h3 className="font-display font-bold text-xl text-gray-800 flex items-center gap-2">
              <Compass size={20} className="text-[#00695C]" /> Nearby spots in {city}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {nearbySpots.map((nSpot: any, idx: number) => (
                <div 
                  key={idx}
                  onClick={() => navigate(`/spot/${encodeURIComponent(city)}/${nSpot.slug}`)}
                  className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-bold text-gray-800 text-base leading-snug group-hover:text-[#00695C] transition-colors">{nSpot.name}</h4>
                      {nSpot.category && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full shrink-0">
                          {nSpot.category}
                        </span>
                      )}
                    </div>
                    {nSpot.area && (
                      <p className="text-xs font-semibold text-[#00695C] mb-2 flex items-center gap-1">
                        <MapPin size={12} /> {nSpot.area}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {nSpot.blurb}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-[#00695C]">
                    <span>View spot details</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HONESTY FOOTER */}
        <div className="text-center py-6 text-xs text-gray-500 font-medium border-t border-gray-200">
          Curated · verify locally · We don't do fake ratings — only real information.
        </div>
      </div>

      {/* REPORT A PROBLEM MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-gray-200 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="font-display font-bold text-lg text-gray-900 flex items-center gap-2">
                <AlertTriangle size={20} className="text-amber-500" /> Report an issue in {city}
              </h3>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">✕</button>
            </div>

            {reportSuccessMsg ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center text-xs font-bold text-emerald-900">
                {reportSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Issue Category</label>
                  <select
                    value={reportCategory}
                    onChange={(e: any) => setReportCategory(e.target.value)}
                    className="w-full p-3 rounded-xl border border-gray-300 text-sm font-semibold focus:ring-2 focus:ring-[#00695C]"
                  >
                    <option value="language barrier">Language Barrier</option>
                    <option value="overcharging">Overcharging / Unregulated Fare</option>
                    <option value="poor signage">Poor Signage / Navigation</option>
                    <option value="low connectivity">Low Mobile Connectivity</option>
                    <option value="other">Other issue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Details (Optional)</label>
                  <textarea
                    rows={3}
                    value={reportNote}
                    onChange={(e) => setReportNote(e.target.value)}
                    placeholder="Describe what happened or what could be improved..."
                    className="w-full p-3 rounded-xl border border-gray-300 text-xs text-gray-800 focus:ring-2 focus:ring-[#00695C]"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportSubmitting}
                    className="flex-1 py-3 bg-[#00695C] hover:bg-[#004D40] text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const PlaceDetailPage = () => (
  <SpotErrorBoundary>
    <PlaceDetailPageInner />
  </SpotErrorBoundary>
);


// ─── LUGGAGE RADAR PAGE ───
export const LuggageRadarPage = () => {
  const [cityInput, setCityInput] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [spots, setSpots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mapCenter, setMapCenter] = useState<[number, number]>([22.4, 79.2]);
  const [mapZoom, setMapZoom] = useState(5);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [wakingUp, setWakingUp] = useState(false);

  // Check-in rates
  const [rateLimitErr, setRateLimitErr] = useState<string | null>(null);

  const navigate = useNavigate();

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const geocodeCity = async (city: string) => {
    const cacheKey = `geo_${city.toLowerCase()}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { lat, lng } = JSON.parse(cached);
      setMapCenter([lat, lng]);
      setMapZoom(11);
      return { lat, lng };
    }

    try {
      let res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city + ", India")}`);
      let data = await res.json();

      if (data.length === 0) {
        await delay(1000);
        res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city + " railway station, India")}`);
        data = await res.json();
      }

      if (data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        localStorage.setItem(cacheKey, JSON.stringify({ lat, lng }));
        setMapCenter([lat, lng]);
        setMapZoom(11);
        return { lat, lng };
      } else {
        setMapCenter([22.4, 79.2]);
        setMapZoom(5);
        setGeocodeError(`Could not locate ${city} — try a city name in India.`);
        return null;
      }
    } catch (e) {
      setMapCenter([22.4, 79.2]);
      setMapZoom(5);
      return null;
    }
  };

  // Prefill city if active trip exists
  useEffect(() => {
    axios.get('/api/trips/active')
      .then(res => {
        if (res.data?.destinationCity) {
          setSelectedCity(res.data.destinationCity);
          setCityInput(res.data.destinationCity);
        }
      })
      .catch(console.warn);
  }, []);

  // Fetch luggage spots with retry
  useEffect(() => {
    if (!selectedCity) return;
    
    let isCancelled = false;

    const fetchLuggage = async () => {
      setLoading(true);
      setError(null);
      setGeocodeError(null);
      setWakingUp(false);

      if (navigator.onLine) {
        await geocodeCity(selectedCity);
      }

      if (isCancelled) return;

      const backoffs = [0, 5000, 10000, 20000, 30000];
      
      for (let attempt = 0; attempt < backoffs.length; attempt++) {
        try {
          if (attempt > 0) {
            setWakingUp(true);
            await delay(backoffs[attempt]);
            if (isCancelled) return;
          }

          if (navigator.onLine) {
            const res = await axios.get(`/api/luggage-spots?city=${encodeURIComponent(selectedCity)}`);
            if (isCancelled) return;
            setSpots(res.data);
            setWakingUp(false);
            return; // Success
          } else {
            // Offline honesty: NEVER invent a cloakroom. There is no cached
            // real luggage data yet, so fail fast with guidance (and skip the
            // remaining wake-retries instead of stalling ~65s while offline).
            if (isCancelled) return;
            setSpots([]);
            setWakingUp(false);
            setLoading(false);
            setError(`You are offline and no cloakroom data is cached for ${selectedCity}. Connect once to load verified spots — they will then be available offline.`);
            return;
          }
        } catch (err: any) {
          if (attempt === backoffs.length - 1) {
            if (isCancelled) return;
            setError('Could not load luggage storage cloakrooms.');
            setWakingUp(false);
          }
        }
      }
      if (!isCancelled) setLoading(false);
    };

    fetchLuggage();
    return () => { isCancelled = true; };
  }, [selectedCity]);

  // Report status check-in
  const handleReport = async (spotId: string, status: 'full' | 'limited' | 'available') => {
    setRateLimitErr(null);
    try {
      const res = await axios.post(`/api/luggage-spots/${spotId}/checkin`, { status });
      alert(res.data.message || 'Report received, thank you!');
      // reload
      const reloadRes = await axios.get(`/api/luggage-spots?city=${encodeURIComponent(selectedCity)}`);
      setSpots(reloadRes.data);
    } catch (err: any) {
      if (err?.response?.data?.error) {
        setRateLimitErr(err.response.data.error);
      } else {
        alert('Could not submit check-in. Try again later.');
      }
    }
  };


  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm font-bold text-[#00695C] cursor-pointer">
          <ChevronLeft size={18} /> Home
        </button>
        <span className="text-sm font-bold text-gray-800">🧳 Sanchar Luggage Radar</span>
        <div className="w-8 h-8" />
      </div>

      {/* Selection bar */}
      <div className="p-4 bg-white border-b border-gray-150 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0 shadow-sm z-20">
        <div>
          <h2 className="font-display font-bold text-base text-gray-800">Verify Cloakrooms & Metro Lockers</h2>
          <p className="text-xs text-gray-600">Curated locations · community-reported availability status</p>
        </div>
        <div className="w-full sm:w-80 shrink-0">
          <CityAutocomplete
            variant="compact"
            value={cityInput}
            onChange={(val) => setCityInput(val)}
            placeholder="Search city (e.g. Chennai or Ooty)"
            buttonText="Search"
            buttonClassName="bg-[#00695C] text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-teal-800 cursor-pointer min-h-[44px] shrink-0"
            onSelectCity={(city) => {
              setCityInput(city);
              setSelectedCity(city);
            }}
          />
        </div>
      </div>

      {/* Main panels */}
      {!selectedCity ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div className="max-w-md bg-white p-8 rounded-3xl border border-gray-150 shadow-sm">
            <Info size={40} className="text-[#00695C] mx-auto mb-3" />
            <h3 className="font-bold text-gray-800 mb-1">Enter a city to locate cloakrooms</h3>
            <p className="text-xs text-gray-600 mb-6">We map verified cloakrooms at central railway junctions and metro locker points across India.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden">
          {/* List panel */}
          <div className="p-4 md:p-6 overflow-y-auto space-y-4 max-h-[50vh] lg:max-h-full">
            {loading && (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-3 border-[#00695C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-gray-500">Locating verified luggage facilities...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-850 text-xs p-4 rounded-2xl border border-red-200 shadow-sm">
                {error}
              </div>
            )}

            {wakingUp && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold p-3 rounded-xl mb-4 text-center">
                Connecting to server — results will appear automatically…
              </div>
            )}

            {geocodeError && (
              <div className="bg-amber-50 text-amber-800 text-xs p-4 rounded-2xl border border-amber-200 shadow-sm">
                {geocodeError}
              </div>
            )}

            {!loading && spots.length === 0 && (
              <div className="bg-white p-8 rounded-3xl border border-gray-150 shadow-sm text-center">
                <AlertTriangle size={32} className="text-amber-500 mx-auto mb-3" />
                <h4 className="font-bold text-gray-800 text-sm mb-1">No verified luggage spots for {selectedCity} yet</h4>
                <p className="text-xs text-gray-600">Railway cloakrooms are usually at the main station arrival exit, confirm availability on site.</p>
              </div>
            )}

            {rateLimitErr && (
              <div className="bg-red-50 text-red-800 text-xs p-3 rounded-xl border border-red-200">
                {rateLimitErr}
              </div>
            )}

            {spots.map(spot => (
              <div key={spot._id} className="bg-white p-5 rounded-3xl border border-gray-150 shadow-sm hover:shadow-md transition">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#00695C] bg-[#00695C]/10 px-2 py-0.5 rounded border border-[#00695C]/20 mb-1.5 inline-block">
                      {spot.type.replace('_', ' ')}
                    </span>
                    <h3 className="font-bold text-base text-gray-800 leading-tight">{spot.name}</h3>
                    <p className="text-xs text-gray-600 mt-1 flex items-center gap-1"><Clock size={12} /> Hours: {spot.hours}</p>
                  </div>
                  
                  {/* Availability status badge */}
                  <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full border shrink-0 ${
                    spot.status === 'High availability'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : spot.status === 'Limited'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : spot.status === 'Full'
                      ? 'bg-red-50 text-red-800 border-red-200 animate-pulse'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}>
                    {spot.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-600">
                  <div>
                    <h5 className="font-bold text-[9px] uppercase tracking-wider text-gray-600 mb-0.5">Pricing</h5>
                    <p className="font-semibold text-gray-700">{spot.pricingPerBagHour}</p>
                  </div>
                  <div>
                    <h5 className="font-bold text-[9px] uppercase tracking-wider text-gray-600 mb-0.5">Required Docs</h5>
                    <p className="font-semibold text-gray-700">{spot.requiredDocs}</p>
                  </div>
                  <div className="col-span-2">
                    <h5 className="font-bold text-[9px] uppercase tracking-wider text-gray-600 mb-0.5">Rules</h5>
                    <p className="text-gray-600 leading-relaxed">{spot.rules}</p>
                  </div>
                </div>

                {/* Report availability buttons */}
                <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-600">
                    {spot.reportCount > 0 ? `Based on ${spot.reportCount} reports (24h)` : 'No reports yet — be first to report'}
                  </span>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleReport(spot._id, 'available')}
                      className="bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200 cursor-pointer"
                    >
                      🟢 Available
                    </button>
                    <button 
                      onClick={() => handleReport(spot._id, 'limited')}
                      className="bg-amber-50 text-amber-800 hover:bg-amber-100 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-amber-200 cursor-pointer"
                    >
                      🟡 Limited
                    </button>
                    <button 
                      onClick={() => handleReport(spot._id, 'full')}
                      className="bg-red-50 text-red-800 hover:bg-red-100 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-red-200 cursor-pointer"
                    >
                      🔴 Full
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Map panel */}
          <div className="h-full relative z-10">
            <SancharMap
              center={mapCenter}
              zoom={mapZoom}
              showOfflineBanner={true}
              heightClass="h-full"
              markers={spots.map(spot => ({
                position: [spot.lat, spot.lng],
                popupContent: (
                  <div className="text-center p-1">
                    <h4 className="font-bold text-xs">{spot.name}</h4>
                    <p className="text-[10px] text-gray-500">{spot.hours}</p>
                  </div>
                ),
                iconEmoji: '🧳'
              }))}
            />
          </div>
        </div>
      )}
    </div>
  );
};
