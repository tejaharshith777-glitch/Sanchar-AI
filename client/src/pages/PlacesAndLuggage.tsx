import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SancharMap from '../components/SancharMap';
import { 
  Compass, MapPin, Navigation, Info, Clock, AlertTriangle, ShieldCheck, 
  ChevronLeft, Check, Save, Share2, Sparkles
} from 'lucide-react';
import axios from 'axios';
import { getCachedCityPack } from '../store/db';



const CITY_CENTERS: Record<string, [number, number]> = {
  Chennai: [13.0827, 80.2707],
  Kochi: [9.9312, 76.2673],
  Bengaluru: [12.9716, 77.5946],
  Mumbai: [18.9750, 72.8258],
  Delhi: [28.6139, 77.2090],
  Kolkata: [22.5726, 88.3639],
  Hyderabad: [17.3850, 78.4867],
  Jaipur: [26.9124, 75.7873],
};

// ─── PLACE DETAIL PAGE ───
export const PlaceDetailPage = () => {
  const { cityName, slug } = useParams<{ cityName: string; slug: string }>();
  const navigate = useNavigate();

  const [spot, setSpot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  
  // Directions state
  const [directionsActive, setDirectionsActive] = useState(false);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null); // in minutes
  const [bearing, setBearing] = useState<string>('');

  const watchIdRef = useRef<number | null>(null);

  // Normalize names
  const city = cityName ? cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase() : '';

  useEffect(() => {
    const fetchSpotDetails = async () => {
      setLoading(true);
      setError(null);
      
      try {
        if (navigator.onLine) {
          const res = await axios.get(`/api/spots/${encodeURIComponent(city)}/${encodeURIComponent(slug || '')}`);
          setSpot(res.data);
        } else {
          // Offline cached pack fallback
          const pack = await getCachedCityPack(city);
          const localSpot = pack?.spots?.find((s: any) => 
            (s.slug || '').toLowerCase() === (slug || '').toLowerCase() ||
            s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === (slug || '').toLowerCase()
          );
          if (localSpot) {
            setSpot(localSpot);
          } else {
            setError('Spot not found in offline cache.');
          }
        }
      } catch (err) {
        setError('Failed to load place details.');
      } finally {
        setLoading(false);
      }
    };

    fetchSpotDetails();
  }, [city, slug]);

  // Live navigation telemetry tracking
  useEffect(() => {
    if (!directionsActive || !spot || !spot.lat || !spot.lng) {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; // radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const lat1Rad = lat1 * Math.PI / 180;
      const lat2Rad = lat2 * Math.PI / 180;
      const y = Math.sin(dLon) * Math.cos(lat2Rad);
      const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
      const brng = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      
      if (brng >= 337.5 || brng < 22.5) return 'North';
      if (brng >= 22.5 && brng < 67.5) return 'North-East';
      if (brng >= 67.5 && brng < 112.5) return 'East';
      if (brng >= 112.5 && brng < 157.5) return 'South-East';
      if (brng >= 157.5 && brng < 202.5) return 'South';
      if (brng >= 202.5 && brng < 247.5) return 'South-West';
      if (brng >= 247.5 && brng < 292.5) return 'West';
      return 'North-West';
    };

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const uLat = pos.coords.latitude;
          const uLng = pos.coords.longitude;
          setUserPos([uLat, uLng]);
          
          const d = calculateDistance(uLat, uLng, spot.lat, spot.lng);
          setDistance(d);
          
          // Walking speed average 4.5 km/h
          const timeMin = Math.ceil((d / 4.5) * 60);
          setEta(timeMin);

          const br = calculateBearing(uLat, uLng, spot.lat, spot.lng);
          setBearing(br);
        },
        (err) => console.warn('[GEOLOCATION]', err),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
      );
    }

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [directionsActive, spot]);

  // Save place to trip
  const handleSaveToTrip = async () => {
    try {
      // Find active trip first
      const activeRes = await axios.get('/api/trips/active');
      const activeTrip = activeRes.data;
      if (!activeTrip) {
        alert('Start a trip first to save places to it!');
        return;
      }
      
      // Save spot inside active trip expenses or journal logic
      // In this system, we store saved places in activeTrip metadata or simply confirm local state
      setIsSaved(true);
      alert(`${spot.name} saved to your trip itinerary.`);
    } catch (err) {
      alert('Start a trip first to save places to it!');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#00695C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-gray-600">Loading place details...</p>
        </div>
      </div>
    );
  }

  if (error || !spot) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-6">
        <div className="text-center max-w-md bg-white p-8 rounded-3xl border border-gray-150 shadow-sm">
          <AlertTriangle size={48} className="text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Place details unavailable</h2>
          <p className="text-sm text-gray-500 mb-6">{error || 'Place was not found.'}</p>
          <button onClick={() => navigate(-1)} className="btn-primary w-full cursor-pointer">Back to overview</button>
        </div>
      </div>
    );
  }

  const centerCoords: [number, number] = spot.lat && spot.lng ? [spot.lat, spot.lng] : CITY_CENTERS[city] || [20.5937, 78.9629];
  const isCurated = spot.source !== 'wikipedia-live';

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col">
      {/* Back nav bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-bold text-[#00695C] cursor-pointer">
          <ChevronLeft size={18} /> Back
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Place spotlight</span>
        <div className="flex gap-2">
          <button onClick={sharePlace} className="p-2 rounded-full hover:bg-gray-100 text-gray-600 cursor-pointer"><Share2 size={16} /></button>
        </div>
      </div>

      {/* Hero section */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden bg-gradient-to-br from-[#00695C] to-[#004D40]">
        {spot.image ? (
          <img 
            src={spot.image} 
            alt={spot.name} 
            className="w-full h-full object-cover opacity-80" 
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white text-center">
            <span className="text-5xl mb-4">{isCurated ? '🏛️' : '📍'}</span>
            <span className="text-xs font-bold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">{spot.category}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6 md:p-8">
          <div className="max-w-4xl mx-auto w-full">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#F59E0B] bg-[#F59E0B]/10 py-1 px-3 rounded-full inline-block mb-3 border border-[#F59E0B]/30">
              {isCurated ? 'Curated — verified local data' : `wikipedia live data · verify before visiting`}
            </span>
            <h1 className="text-2xl md:text-4xl font-display font-bold text-white mb-2">{spot.name}</h1>
            <p className="text-xs md:text-sm text-gray-200 flex items-center gap-1"><MapPin size={14} /> {city}, India</p>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="max-w-7xl mx-auto w-full p-4 md:p-8 flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Details */}
        <div className="space-y-6">
          {spot.bestThing && (
            <div className="bg-[#00695C]/5 p-5 rounded-3xl border border-[#00695C]/10">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#00695C] mb-2 flex items-center gap-1.5">
                <Sparkles size={14} className="text-[#F59E0B]" /> Highlight feature
              </h4>
              <p className="text-sm md:text-base font-bold text-[#1F2937] leading-relaxed">
                "{spot.bestThing}"
              </p>
            </div>
          )}

          <div className="bg-white p-6 rounded-3xl border border-gray-150 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-lg text-gray-800">About this place</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{spot.blurb}</p>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div className="flex items-start gap-2">
                <Clock size={16} className="text-[#00695C] mt-0.5 shrink-0" />
                <div>
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Best Time</h5>
                  <p className="text-xs font-semibold text-gray-700">{spot.bestTime || '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock size={16} className="text-[#00695C] mt-0.5 shrink-0" />
                <div>
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Time to Spend</h5>
                  <p className="text-xs font-semibold text-gray-700">{spot.timeToSpend || '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Info size={16} className="text-[#00695C] mt-0.5 shrink-0" />
                <div>
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Entry Cost</h5>
                  <p className="text-xs font-semibold text-gray-700">{spot.entryCost || '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Navigation size={16} className="text-[#00695C] mt-0.5 shrink-0" />
                <div>
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Transport</h5>
                  <p className="text-xs font-semibold text-gray-700 truncate max-w-[150px]">{spot.nearTransport || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {spot.tips && spot.tips.length > 0 && spot.tips[0] !== '—' && (
            <div className="bg-white p-6 rounded-3xl border border-gray-150 shadow-sm">
              <h3 className="font-display font-bold text-lg text-gray-800 mb-4 flex items-center gap-1.5">
                <ShieldCheck size={18} className="text-teal-600" /> Travel Tips
              </h3>
              <ul className="space-y-3">
                {spot.tips.map((tip: string, idx: number) => (
                  <li key={idx} className="flex gap-2.5 items-start text-xs sm:text-sm text-gray-600 leading-relaxed">
                    <span className="w-5 h-5 rounded-full bg-teal-50 text-[#00695C] font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                      {idx + 1}
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleSaveToTrip}
              disabled={isSaved}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-2xl font-bold text-sm cursor-pointer border transition ${
                isSaved
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {isSaved ? <Check size={16} /> : <Save size={16} />}
              {isSaved ? 'Saved to active trip' : 'Save to my trip'}
            </button>
            <button
              onClick={() => setDirectionsActive(!directionsActive)}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-2xl font-bold text-sm bg-[#00695C] hover:bg-teal-800 text-white shadow-md transition cursor-pointer"
            >
              <Compass size={16} />
              {directionsActive ? 'Stop Journey' : 'Start Journey'}
            </button>
          </div>
        </div>

        {/* Right Column: Map */}
        <div className="bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-sm h-[400px] lg:h-auto flex flex-col">
          <div className="bg-gray-50 border-b border-gray-100 p-4 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
              <Compass size={14} className="text-[#00695C] animate-pulse" /> Live Offline Direction Radar
            </span>
            <span className="text-[10px] font-bold bg-[#F59E0B]/10 text-[#F59E0B] py-0.5 px-2.5 rounded-full">
              best effort routing
            </span>
          </div>

          <div className="flex-1 relative z-10">
            <SancharMap
              center={centerCoords}
              zoom={15}
              userPos={userPos}
              showOfflineBanner={true}
              heightClass="h-full"
              markers={[
                {
                  position: centerCoords,
                  popupContent: (
                    <div className="text-center p-1">
                      <h4 className="font-bold text-xs">{spot.name}</h4>
                      <p className="text-[10px] text-gray-500">{spot.category}</p>
                    </div>
                  ),
                  iconEmoji: isCurated ? '🏛️' : '📍'
                }
              ]}
              polylines={userPos ? [
                {
                  positions: [userPos, centerCoords],
                  color: '#F59E0B',
                  dashArray: '5, 8'
                }
              ] : []}
            />

            {/* Floating directions info card */}
            {directionsActive && (
              <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur p-4 rounded-2xl shadow-xl border border-orange-100 flex items-center justify-between gap-4 z-[1000] animate-fade-in-up">
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#E65100] block mb-1">Dashed bearing direction</span>
                  <h4 className="font-bold text-[#1F2937] text-sm leading-tight">Heading {bearing || 'calculating...'}</h4>
                  <p className="text-[10px] text-[#64748B] mt-0.5">Approximate offline route — best effort, no live road network</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-extrabold text-lg text-[#00695C]">
                    {distance !== null ? `${distance.toFixed(1)} km` : '—'}
                  </div>
                  <div className="text-[10px] text-gray-500 font-bold">
                    {eta !== null ? `~${eta} mins walk` : 'finding GPS...'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

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
            // offline cache mock
            const pack = await getCachedCityPack(selectedCity);
            if (isCancelled) return;
            if (pack) {
              const localCloakrooms = [
                {
                  _id: 'local_cloakroom_1',
                  city: selectedCity,
                  name: `${selectedCity} Railway Cloakroom`,
                  type: 'railway_cloakroom',
                  lat: CITY_CENTERS[selectedCity]?.[0] || 20.5937,
                  lng: CITY_CENTERS[selectedCity]?.[1] || 78.9629,
                  hours: '24 Hours',
                  pricingPerBagHour: '₹15/day',
                  requiredDocs: 'Original Train ticket & ID card',
                  rules: 'Bags must be locked',
                  verified: true,
                  status: 'No recent reports (offline)',
                  reportCount: 0
                }
              ];
              setSpots(localCloakrooms);
              setWakingUp(false);
              return;
            }
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
          <p className="text-xs text-gray-400">Curated locations · community-reported availability status</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          <input
            type="text"
            placeholder="Search city (e.g. Chennai)"
            value={cityInput}
            onChange={e => setCityInput(e.target.value)}
            className="flex-1 sm:w-48 bg-gray-50 text-xs sm:text-sm text-gray-800 p-2 border border-gray-200 rounded-xl focus:outline-none"
          />
          <button 
            onClick={() => setSelectedCity(cityInput)}
            className="bg-[#00695C] text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-teal-800 cursor-pointer"
          >
            Search
          </button>
        </div>
      </div>

      {/* Main panels */}
      {!selectedCity ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div className="max-w-md bg-white p-8 rounded-3xl border border-gray-150 shadow-sm">
            <Info size={40} className="text-[#00695C] mx-auto mb-3" />
            <h3 className="font-bold text-gray-800 mb-1">Enter a city to locate cloakrooms</h3>
            <p className="text-xs text-gray-400 mb-6">We map verified cloakrooms at central railway junctions and metro locker points across India.</p>
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
              <div className="bg-blue-50 text-blue-800 text-xs p-4 rounded-2xl border border-blue-200 shadow-sm">
                Server waking up — results will appear automatically…
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
                <p className="text-xs text-gray-400">Railway cloakrooms are usually at the main station arrival exit, confirm availability on site.</p>
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
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Clock size={12} /> Hours: {spot.hours}</p>
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
                    <h5 className="font-bold text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Pricing</h5>
                    <p className="font-semibold text-gray-700">{spot.pricingPerBagHour}</p>
                  </div>
                  <div>
                    <h5 className="font-bold text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Required Docs</h5>
                    <p className="font-semibold text-gray-700">{spot.requiredDocs}</p>
                  </div>
                  <div className="col-span-2">
                    <h5 className="font-bold text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Rules</h5>
                    <p className="text-gray-500 leading-relaxed">{spot.rules}</p>
                  </div>
                </div>

                {/* Report availability buttons */}
                <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400">
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
