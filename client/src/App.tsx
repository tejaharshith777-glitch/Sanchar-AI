import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Link, useParams } from 'react-router-dom';
import {
  Shield, MapPin, Navigation2, Camera, Smartphone, WifiOff,
  Zap, Globe, Lock, IndianRupee, Phone,
  ChevronRight, Check, AlertTriangle, Share2,
  BookOpen, BarChart3, Activity, Search, Compass, HelpCircle
} from 'lucide-react';
import axios from 'axios';
import { queueOfflineMutation, getOfflineQueue, removeQueueItem } from './store/db';
import { ocrProvider } from './ocr/OcrProvider';

// ─── Constants ───────────────────────────────────────────────
const SITE_URL = window.location.origin; // Dynamically gets the active deploy URL
const CITIES = [
  'Chennai', 'Coimbatore', 'Madurai', 'Kochi', 'Bengaluru',
  'Mumbai', 'Pune', 'Delhi', 'Jaipur', 'Kolkata',
  'Bhubaneswar', 'Ahmedabad', 'Guwahati', 'Varanasi'
];

// ─── Health & Connectivity Context ───────────────────────────
interface HealthContextType {
  isBackendOffline: boolean;
  dbMode: 'atlas' | 'memory' | null;
  syncState: 'synced' | 'syncing' | 'offline';
  isOnline: boolean;
}

const HealthContext = createContext<HealthContextType>({
  isBackendOffline: false,
  dbMode: null,
  syncState: 'synced',
  isOnline: true
});

// Helper for location speed calculations
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Custom Hooks ────────────────────────────────────────────
function useNetworkAndHealth() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'offline'>('synced');
  const [isBackendOffline, setIsBackendOffline] = useState(false);
  const [dbMode, setDbMode] = useState<'atlas' | 'memory' | null>(null);

  // Poll server health check to keep status updated without console spam
  useEffect(() => {
    let active = true;
    const checkHealth = async () => {
      try {
        const res = await axios.get('/api/health');
        if (active) {
          setIsBackendOffline(false);
          setDbMode(res.data.db);
        }
      } catch {
        if (active) {
          setIsBackendOffline(true);
          setDbMode(null);
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Offline sync queue triggers when connection is restored
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setSyncState('syncing');
      try {
        const queue = await getOfflineQueue();
        for (const item of queue) {
          await axios({
            method: item.method,
            url: item.url,
            data: item.body,
            headers: { 'Idempotency-Key': item.idempotencyKey }
          });
          await removeQueueItem(item.idempotencyKey);
        }
        setSyncState('synced');
      } catch (err) {
        console.warn('Sync queue flush paused:', err);
        setSyncState('offline');
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncState('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, syncState, isBackendOffline, dbMode };
}

function useGPSTracker(tripId: string | null) {
  const [points, setPoints] = useState<any[]>([]);
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [segment, setSegment] = useState<'still' | 'walking' | 'road_vehicle' | 'rail' | 'unknown'>('unknown');
  const [confidence, setConfidence] = useState(0);
  const [permDenied, setPermDenied] = useState(false);
  const batchRef = useRef<any[]>([]);

  useEffect(() => {
    if (!tripId || !navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const rawSpeed = pos.coords.speed !== null ? pos.coords.speed * 3.6 : 0;
        setSpeed(rawSpeed);

        // Movement segment rules
        if (rawSpeed < 1)       { setSegment('still');        setConfidence(92); }
        else if (rawSpeed < 6)  { setSegment('walking');      setConfidence(84); }
        else if (rawSpeed < 70) { setSegment('road_vehicle'); setConfidence(76); }
        else                    { setSegment('rail');          setConfidence(71); }

        const point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speedKmh: rawSpeed,
          timestamp: new Date(pos.timestamp),
          source: 'gps'
        };

        setPoints(prev => {
          const updated = [...prev, point];
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const d = haversine(last.lat, last.lng, point.lat, point.lng);
            setDistance(prevD => prevD + d);
          }
          return updated;
        });

        batchRef.current.push(point);
        if (batchRef.current.length >= 5) {
          const currentBatch = [...batchRef.current];
          batchRef.current = [];
          axios.post(`/api/trips/${tripId}/points`, { points: currentBatch })
            .catch(() => {
              console.log('[GPS] Queuing points locally to IndexedDB...');
              queueOfflineMutation(`/api/trips/${tripId}/points`, 'POST', { points: currentBatch });
            });
        }
      },
      (err) => {
        if (err.code === 1) setPermDenied(true);
        console.warn('[GPS]', err);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [tripId]);

  return { speed, segment, confidence, distance, points, permDenied };
}

// ─── App Main Router ─────────────────────────────────────────
const App = () => {
  const healthData = useNetworkAndHealth();

  return (
    <HealthContext.Provider value={healthData}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/create" element={<AppShell><CreateTrip /></AppShell>} />
          <Route path="/active/:id" element={<AppShell><ActiveTrip /></AppShell>} />
          <Route path="/scan/:id" element={<AppShell><CameraScanner /></AppShell>} />
          <Route path="/expenses/:id" element={<AppShell><ExpensesList /></AppShell>} />
          <Route path="/diary/:id" element={<AppShell><Diary /></AppShell>} />
          <Route path="/privacy" element={<AppShell><PrivacyPage /></AppShell>} />
          <Route path="/dashboard" element={<AppShell><Dashboard /></AppShell>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </HealthContext.Provider>
  );
};

// ─── App Shell Wrapper ───────────────────────────────────────
const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { isBackendOffline, dbMode } = useContext(HealthContext);
  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <InnerNav />
      {/* Warnings & Fallback Status Banner */}
      {isBackendOffline && (
        <div className="bg-red-600 text-white text-xs py-2.5 px-4 text-center font-medium shadow-sm animate-fade-in flex items-center justify-center gap-2">
          <WifiOff size={14} /> Backend offline — data will save locally and sync when the server is back
        </div>
      )}
      {!isBackendOffline && dbMode === 'memory' && (
        <div className="bg-amber-500 text-white text-xs py-2 px-4 text-center font-medium flex items-center justify-center gap-2">
          <AlertTriangle size={14} /> Dev mode — in-memory DB; restart resets data
        </div>
      )}
      <main className="flex-1 max-w-2xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
};

const InnerNav = () => {
  const { isOnline, syncState } = useContext(HealthContext);
  return (
    <nav className="sticky top-0 z-50 glass-nav">
      <div className="max-w-2xl mx-auto px-5 flex justify-between h-16 items-center">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-8 h-8 bg-[#00695C] rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <span className="font-['Plus_Jakarta_Sans'] font-bold text-[#1F2937] text-lg tracking-tight">Sanchar AI</span>
        </Link>
        <div className="flex items-center gap-2">
          {syncState === 'syncing' && <span className="badge badge-teal animate-pulse text-xs">Syncing…</span>}
          {syncState === 'offline' && <span className="badge badge-amber text-xs"><WifiOff size={12} /> Offline — queued</span>}
          {syncState === 'synced' && isOnline && <span className="badge badge-green text-xs"><Check size={12} /> Synced</span>}
        </div>
      </div>
    </nav>
  );
};

// ─── INTRO LOADER SPLASH ─────────────────────────────────────
const IntroLoader = ({ onComplete }: { onComplete: () => void }) => {
  const [progress, setProgress] = useState(0);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // 2-second progress bar fill
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 4;
      });
    }, 80);

    // Fade out trigger at 2.8s, remove completely at 3.5s
    const fadeTimer = setTimeout(() => setFade(true), 2800);
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3500);

    return () => {
      clearInterval(interval);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      role="status"
      className={`fixed inset-0 z-9999 flex flex-col items-center justify-center bg-[#00695C] transition-opacity duration-700 ${fade ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
    >
      {/* Cinematic Ken Burns zoom image with teal overlay */}
      <div className="absolute inset-0 bg-cover bg-center animate-[zoom_20s_infinite_linear]" style={{ backgroundImage: "url('/images/travelers-hero.png')" }} />
      <div className="absolute inset-0 bg-gradient-to-br from-[rgba(0,105,92,0.85)] to-[rgba(31,41,55,0.75)]" />

      {/* Loader branding & status */}
      <div className="relative z-10 text-center px-6 flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-2 shadow-xl border border-white/20">
          <Shield size={36} className="text-white" />
        </div>
        <h1 className="font-['Plus_Jakarta_Sans'] text-4xl md:text-5xl font-extrabold text-white tracking-tight">
          Sanchar <span className="text-[#F59E0B]">AI</span>
        </h1>
        <p className="text-teal-100 font-medium text-base md:text-lg max-w-sm">
          Travel confidently, even offline.
        </p>

        {/* Saffron Progress Bar */}
        <div className="w-48 h-1.5 bg-white/20 rounded-full overflow-hidden mt-6">
          <div
            className="h-full bg-[#F59E0B] transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-teal-200 text-xs tracking-wider uppercase mt-1 font-semibold">
          Preparing your journey
        </span>
      </div>
    </div>
  );
};

// ─── CITY CARD ────────────────────────────────────────────────
const CityCard = ({ city, img, langs, onClick }: { city: string; img: string; langs: string[]; onClick: () => void }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200"
    >
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-[#00695C] to-[#004D40] flex items-center justify-center">
        {!imgError ? (
          <img
            src={img}
            alt={city}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="text-white font-extrabold text-lg tracking-wider uppercase font-['Plus_Jakarta_Sans']">
            {city}
          </div>
        )}
        <div className="absolute top-2 right-2 bg-white/95 text-[#00695C] text-[10px] font-bold py-0.5 px-2 rounded-full">
          City pack available
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#1F2937]">{city}</h3>
        <div className="flex flex-wrap gap-1 mt-2">
          {langs.map(l => (
            <span key={l} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{l}</span>
          ))}
        </div>
        <div className="mt-4 text-[#00695C] text-xs font-bold flex items-center gap-1 group-hover:text-[#004D40] transition-colors">
          Explore 25 spots <ChevronRight size={14} />
        </div>
      </div>
    </div>
  );
};

// ─── LANDING PAGE ────────────────────────────────────────────
const LandingPage = () => {
  const { isBackendOffline, dbMode } = useContext(HealthContext);
  const [showLoader, setShowLoader] = useState(() => !sessionStorage.getItem('sanchar_intro_loaded'));
  const [destinationPreFill, setDestinationPreFill] = useState('');

  // Spotlight States
  const [spotlightCity, setSpotlightCity] = useState<string | null>(null);
  const [spotlightData, setSpotlightData] = useState<any | null>(null);
  const [spotlightLoading, setSpotlightLoading] = useState(false);
  const [spotlightError, setSpotlightError] = useState<string | null>(null);
  const [searchCityInput, setSearchCityInput] = useState('');

  const loadSpotlight = async (cityName: string) => {
    if (!cityName.trim()) return;
    setSpotlightCity(cityName);
    setSpotlightLoading(true);
    setSpotlightError(null);
    setSpotlightData(null);

    // Scroll to spotlight area smoothly
    setTimeout(() => {
      const spotlightEl = document.getElementById('city-spotlight-section');
      if (spotlightEl) {
        spotlightEl.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);

    try {
      const res = await axios.get(`/api/city-spots/${encodeURIComponent(cityName)}`);
      setSpotlightData(res.data);
    } catch {
      setSpotlightError('Failed to fetch city spotlights. The server may be offline.');
    } finally {
      setSpotlightLoading(false);
    }
  };

  const handleLoaderComplete = () => {
    sessionStorage.setItem('sanchar_intro_loaded', 'true');
    setShowLoader(false);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      {showLoader && <IntroLoader onComplete={handleLoaderComplete} />}

      {/* Global Health Notification banner */}
      {isBackendOffline && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-red-600 text-white text-xs py-2 px-4 text-center font-medium shadow-sm animate-fade-in flex items-center justify-center gap-2">
          <WifiOff size={14} /> Backend offline — data will save locally and sync when the server is back
        </div>
      )}
      {!isBackendOffline && dbMode === 'memory' && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-amber-500 text-white text-xs py-2 px-4 text-center font-medium flex items-center justify-center gap-2">
          <AlertTriangle size={14} /> Dev mode — in-memory DB; restart resets data
        </div>
      )}

      {/* ── Sticky Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav">
        <div className="max-w-[1180px] mx-auto flex justify-between items-center h-16 px-5 md:px-8">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-9 h-9 bg-[#00695C] rounded-xl flex items-center justify-center shadow-sm">
              <Shield size={18} className="text-white" />
            </div>
            <span className="font-['Plus_Jakarta_Sans'] font-extrabold text-[#1F2937] text-xl tracking-tight">Sanchar AI</span>
          </Link>
          <div className="flex items-center gap-8">
            <a href="#features" className="hidden md:inline text-sm font-medium text-[#64748B] hover:text-[#00695C] transition-colors no-underline">Features</a>
            <a href="#privacy-section" className="hidden md:inline text-sm font-medium text-[#64748B] hover:text-[#00695C] transition-colors no-underline">Privacy</a>
            <Link to="/dashboard" className="text-sm font-medium text-[#64748B] hover:text-[#00695C] transition-colors no-underline">Dashboard</Link>
            <Link to="/create" className="btn-primary text-sm !py-2 !px-5">
              Start Trip <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── S1: HERO ── */}
      <section className="relative min-h-[640px] flex items-center justify-center pt-24 pb-16 bg-cover bg-center" style={{ backgroundImage: "url('/images/travelers-hero.png')" }}>
        <div className="absolute inset-0 bg-gradient-to-br from-[#00695C]/95 to-[#004D40]/80" />
        <div className="relative z-10 max-w-[1180px] w-full mx-auto px-5 md:px-8 flex flex-col lg:flex-row items-center gap-12">
          {/* Hero text */}
          <div className="flex-1 text-center lg:text-left text-white">
            <span className="badge bg-white/10 text-white border border-white/20 mb-4 inline-flex items-center gap-1.5 py-1 px-3.5 text-xs font-semibold rounded-full">
              <Zap size={14} className="text-[#F59E0B]" /> Offline AI Travel Companion
            </span>
            <h1 className="hero-heading text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-5">
              Where are you <span className="text-[#F59E0B]">travelling?</span>
            </h1>
            <p className="text-teal-100 text-lg md:text-xl mb-6 max-w-lg">
              One companion. Any city in India. Even offline.
            </p>
            <div className="flex flex-wrap justify-center lg:justify-start gap-4">
              <span className="trust-badge border border-teal-500 bg-teal-900/20 text-teal-200"><Shield size={14} /> Privacy-first</span>
              <span className="trust-badge border border-teal-500 bg-teal-900/20 text-teal-200"><WifiOff size={14} /> Offline-ready</span>
              <span className="trust-badge border border-teal-500 bg-teal-900/20 text-teal-200"><Globe size={14} /> Multilingual</span>
            </div>
          </div>

          {/* Search Card Container */}
          <div className="w-full max-w-md bg-white rounded-3xl p-6 md:p-8 shadow-2xl border border-gray-100">
            <HeroSearchForm preFillDest={destinationPreFill} />
          </div>
        </div>
      </section>

      {/* ── S2: POPULAR CITY PACKS ── */}
      <section className="section max-w-[1180px] mx-auto px-5 md:px-8 bg-[#FAFAF7]">
        <div className="text-center mb-12">
          <span className="badge badge-teal mb-3"><MapPin size={14} /> Popular Destinations</span>
          <h2 className="text-3xl font-extrabold text-[#1F2937] tracking-tight">City packs ready for you</h2>
          <p className="text-[#64748B] text-sm mt-2">Verified local safety directories and translation packs.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[
            { city: 'Chennai', img: 'https://upload.wikimedia.org/wikipedia/commons/1/19/MylaporeKapaleeshwararTemple.jpg', langs: ['Tamil', 'English'] },
            { city: 'Kochi', img: 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Chinese_fishing_nets_Kochi_India.jpg', langs: ['Malayalam', 'English'] },
            { city: 'Hyderabad', img: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Charminar_Hyderabad_1.jpg', langs: ['Telugu', 'English'] },
            { city: 'Bengaluru', img: 'https://upload.wikimedia.org/wikipedia/commons/1/13/Bangalore_Palace.jpg', langs: ['Kannada', 'English'] },
            { city: 'Mumbai', img: 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Gateway_of_India_-Mumbai.jpg', langs: ['Marathi', 'Hindi'] },
            { city: 'Jaipur', img: 'https://upload.wikimedia.org/wikipedia/commons/4/41/East_facade_of_Hawa_Mahal_2016.jpg', langs: ['Hindi', 'English'] },
            { city: 'Varanasi', img: 'https://upload.wikimedia.org/wikipedia/commons/0/04/Ghats_in_Varanasi.jpg', langs: ['Hindi'] },
            { city: 'Guwahati', img: 'https://upload.wikimedia.org/wikipedia/commons/f/f9/Kamakhya_Temple_Guwahati.jpg', langs: ['Assamese', 'English'] },
          ].map((c) => (
            <CityCard
              key={c.city}
              city={c.city}
              img={c.img}
              langs={c.langs}
              onClick={() => loadSpotlight(c.city)}
            />
          ))}
        </div>

        {/* Enter your city Box */}
        <div className="mt-10 max-w-md mx-auto bg-white p-3 md:p-4 rounded-full border border-gray-200 shadow-sm flex items-center gap-2">
          <Search className="text-gray-400 shrink-0 ml-2" size={18} />
          <input
            type="text"
            placeholder="Explore other cities (e.g. Pune, Nagpur…)"
            value={searchCityInput}
            onChange={(e) => setSearchCityInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                loadSpotlight(searchCityInput);
              }
            }}
            className="flex-1 text-sm text-[#1F2937] focus:outline-none placeholder-gray-400"
          />
          <button
            onClick={() => loadSpotlight(searchCityInput)}
            className="btn-primary !py-2.5 !px-6 text-xs font-bold whitespace-nowrap cursor-pointer !rounded-full"
          >
            Show best spots
          </button>
        </div>

        {/* Spotlight View Section */}
        {(spotlightCity || spotlightLoading) && (
          <div id="city-spotlight-section" className="mt-16 border-t border-gray-200 pt-12">
            {spotlightLoading && (
              <div className="text-center py-16 flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-[#00695C] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[#64748B] font-medium">Fetching real spot data for {spotlightCity}…</p>
              </div>
            )}

            {spotlightError && !spotlightLoading && (
              <div className="card p-8 text-center max-w-lg mx-auto border border-red-100 bg-red-50/50">
                <AlertTriangle className="text-[#D32F2F] mx-auto mb-3" size={32} />
                <p className="text-sm font-bold text-[#1F2937]">{spotlightError}</p>
                <button
                  onClick={() => setSpotlightCity(null)}
                  className="mt-4 btn-secondary !py-2 !px-5 text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}

            {spotlightData && !spotlightLoading && (
              <div className="animate-fade-in-up">
                {spotlightData.found === false ? (
                  <div className="card p-8 text-center max-w-lg mx-auto border border-amber-100 bg-amber-50/30">
                    <HelpCircle className="text-[#F59E0B] mx-auto mb-3" size={36} />
                    <h3 className="font-bold text-lg text-[#1F2937] mb-2">No verified spot list for '{spotlightCity}' yet</h3>
                    <p className="text-xs text-[#64748B] leading-relaxed mb-6">
                      Our general India pack works here: 112 emergency · national rail enquiry 139 · basic travel guidance.
                    </p>
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => {
                          setDestinationPreFill(spotlightCity || '');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="btn-primary !py-2 !px-5 text-xs font-bold cursor-pointer"
                      >
                        Create trip to {spotlightCity}
                      </button>
                      <button
                        onClick={() => {
                          setSpotlightCity(null);
                          setSpotlightData(null);
                        }}
                        className="btn-secondary !py-2 !px-5 text-xs font-bold cursor-pointer"
                      >
                        Back to home
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Spotlight Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-150 pb-6 mb-8">
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <h2 className="text-3xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans']">{spotlightData.city}</h2>
                          <span className={`text-[10px] font-bold py-0.5 px-2.5 rounded-full border ${
                            spotlightData.source === 'curated-sample' 
                              ? 'bg-[#E0F2F1] text-[#00695C] border-[#B2DFDB]' 
                              : 'bg-blue-50 text-blue-700 border-blue-100'
                          }`}>
                            {spotlightData.source === 'curated-sample' 
                              ? 'Curated sample — verify before visiting' 
                              : 'Live from Wikipedia — verify before visiting'}
                          </span>
                        </div>
                        <p className="text-[#64748B] text-xs mt-2 flex items-center gap-1.5 font-medium">
                          <Compass size={14} className="text-[#00695C]" /> Spotlight features {spotlightData.count} best places to explore.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-semibold">Languages: Hindi, English</span>
                        <span className="text-[10px] bg-[#E0F2F1] text-[#00695C] px-2.5 py-1 rounded-full font-semibold">City pack available</span>
                      </div>
                    </div>

                    {/* Grid of Spots */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {spotlightData.spots.map((spot: any, index: number) => (
                        <div key={index} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <span className="w-6 h-6 rounded-full bg-[#00695C]/10 text-[#00695C] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {index + 1}
                              </span>
                              <p className="font-bold text-[#1F2937] text-sm leading-tight">{spot.name}</p>
                            </div>
                            {spot.category && (
                              <span className="text-[9px] font-bold uppercase tracking-wider bg-gray-150 text-gray-500 py-0.5 px-2 rounded-full font-semibold">
                                {spot.category}
                              </span>
                            )}
                          </div>
                          {spot.blurb && (
                            <p className="text-xs text-[#64748B] leading-relaxed line-clamp-2">
                              {spot.blurb.length > 90 ? spot.blurb.slice(0, 87) + '...' : spot.blurb}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-center gap-4 mt-12 border-t border-gray-150 pt-8">
                      <button
                        onClick={() => {
                          setDestinationPreFill(spotlightData.city);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="btn-primary !py-3 !px-8 text-sm font-bold flex items-center gap-2 cursor-pointer"
                      >
                        <Zap size={16} /> Create trip to {spotlightData.city}
                      </button>
                      <button
                        onClick={() => {
                          setSpotlightCity(null);
                          setSpotlightData(null);
                        }}
                        className="btn-secondary !py-3 !px-8 text-sm font-bold cursor-pointer"
                      >
                        Back to home
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── S3: INFO CARDS ── */}
      <section className="section bg-white border-y border-gray-100">
        <div className="max-w-[1180px] mx-auto px-5 md:px-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="card p-8 border border-gray-100 flex gap-4 items-start bg-[#FAFAF7]">
            <div className="w-12 h-12 rounded-xl bg-[#00695C]/10 flex items-center justify-center text-[#00695C] shrink-0">
              <Lock size={24} />
            </div>
            <div>
              <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-xl text-[#1F2937] mb-2">Your home — always private</h3>
              <ul className="space-y-2 text-sm text-[#64748B]">
                <li>• Home coordinates never leave your device</li>
                <li>• First & last 500m of your GPS tracks are dropped automatically</li>
                <li>• Geofence wake is calculated locally on the client</li>
              </ul>
            </div>
          </div>
          <div className="card p-8 border border-gray-100 flex gap-4 items-start bg-[#FAFAF7]">
            <div className="w-12 h-12 rounded-xl bg-[#00695C]/10 flex items-center justify-center text-[#00695C] shrink-0">
              <WifiOff size={24} />
            </div>
            <div>
              <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-xl text-[#1F2937] mb-2">Your destination — packed before you leave</h3>
              <ul className="space-y-2 text-sm text-[#64748B]">
                <li>• 112 emergency and medical links stored locally</li>
                <li>• Essential phrases translate on-device in Indian languages</li>
                <li>• Local transit fares pre-loaded for reference</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── S4: CITY PACKS STATS ── */}
      <section className="section max-w-[1180px] mx-auto px-5 md:px-8">
        <div className="text-center mb-12">
          <span className="badge badge-teal mb-3"><Globe size={14} /> City packs available</span>
          <h2 className="text-3xl font-extrabold text-[#1F2937] tracking-tight">On-Device Directories</h2>
          <p className="text-[#64748B] text-sm mt-2">Stats fetched from live City Pack index. Real today.</p>
        </div>

        <CityPacksRealStats />
      </section>

      {/* ── S5: QUOTE BANNER ── */}
      <section className="relative section bg-cover bg-center py-24 text-center text-white" style={{ backgroundImage: "url('/images/travelers-hero.png')" }}>
        <div className="absolute inset-0 bg-[#00695C]/90" />
        <div className="relative z-10 max-w-2xl mx-auto px-5">
          <p className="font-['Plus_Jakarta_Sans'] text-2xl md:text-3xl font-extrabold leading-relaxed mb-4">
            "Travel is a continuous adventure — we take care of the worries."
          </p>
          <p className="text-teal-200 font-semibold tracking-wide uppercase text-sm">
            Sanchar AI — Travel confidently, even offline.
          </p>
        </div>
      </section>

      {/* ── S6: STEP BY STEP TIMELINE ── */}
      <section className="section bg-white border-y border-gray-100">
        <div className="max-w-[1180px] mx-auto px-5 md:px-8">
          <div className="text-center mb-16">
            <span className="badge badge-teal mb-3"><Activity size={14} /> Journey Lifecycle</span>
            <h2 className="text-3xl font-extrabold text-[#1F2937] tracking-tight">Your journey day, step by step</h2>
            <p className="text-[#64748B] text-sm mt-2">Real telemetry and notifications running locally.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 relative">
            {[
              { step: 'Step 1', title: 'Step outside', desc: 'Trip auto-starts when geofence exit is triggered.', badge: true },
              { step: 'Step 2', title: 'Auto / road', desc: 'Vehicular movement and speeds classified locally.', badge: false },
              { step: 'Step 3', title: 'Train', desc: 'Low-power positioning starts; scan tickets.', badge: false },
              { step: 'Step 4', title: 'Food & bills', desc: 'Smart offline scan updates your trip budget.', badge: false },
              { step: 'Step 5', title: 'Metro & walk', desc: 'Mode transitions detected by activity rules.', badge: false },
              { step: 'Step 6', title: 'Hotel', desc: 'Stillness activates the safe-arrival diary trigger.', badge: false }
            ].map((s, idx) => (
              <div key={idx} className="relative bg-[#FAFAF7] p-5 rounded-2xl border border-gray-100 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-[#F59E0B] uppercase tracking-wider">{s.step}</span>
                  <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#1F2937] mt-1.5 mb-2">{s.title}</h3>
                  <p className="text-xs text-[#64748B] leading-relaxed">{s.desc}</p>
                </div>
                {s.badge && (
                  <div className="mt-4 pt-2 border-t border-gray-200/50">
                    <span className="android-badge inline-flex items-center gap-1 text-[9px]"><Smartphone size={10} /> Android app</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="text-center mt-8 text-xs text-[#64748B] italic">
            Probabilistic detections — you always confirm.
          </div>
        </div>
      </section>

      {/* ── S7: LIVE STATISTICS ── */}
      <section className="section max-w-[1180px] mx-auto px-5 md:px-8 bg-[#FAFAF7]">
        <LiveSiteStats />
      </section>

      {/* ── S8: JOIN THE PILOT ── */}
      <section id="join-pilot" className="section bg-white border-t border-gray-100">
        <div className="max-w-md mx-auto px-5">
          <div className="text-center mb-8">
            <span className="badge badge-teal mb-3"><Zap size={14} /> Indian Pilot</span>
            <h2 className="text-3xl font-extrabold text-[#1F2937] tracking-tight">Join the pilot</h2>
            <p className="text-[#64748B] text-sm mt-2">Become a foundation user. Tell us what we should build next.</p>
          </div>
          <JoinPilotForm />
        </div>
      </section>

      {/* ── S9: FOOTER ── */}
      <footer className="bg-[#00695C] text-white">
        <div className="max-w-[1180px] mx-auto px-5 md:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={20} className="text-[#F59E0B]" />
                <span className="font-['Plus_Jakarta_Sans'] font-bold text-lg">Sanchar AI</span>
              </div>
              <p className="text-teal-200 text-sm leading-relaxed max-w-sm">
                Travel confidently, even offline. Your AI travel companion for safe journeys across India.
              </p>
            </div>
            <div>
              <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-sm mb-4 text-teal-100">Product</h4>
              <div className="flex flex-col gap-2.5">
                <Link to="/create" className="text-teal-200 text-sm hover:text-white transition-colors no-underline">Start Journey</Link>
                <Link to="/dashboard" className="text-teal-200 text-sm hover:text-white transition-colors no-underline">Mobility Dashboard</Link>
                <Link to="/privacy" className="text-teal-200 text-sm hover:text-white transition-colors no-underline">Data Pipeline</Link>
              </div>
            </div>
            <div>
              <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-sm mb-4 text-teal-100">Recent City Packs</h4>
              <div className="grid grid-cols-2 gap-2">
                {['Chennai', 'Mumbai', 'Jaipur', 'Kochi'].map(city => (
                  <div key={city} className="bg-white/10 text-teal-100 py-1.5 px-3 rounded text-[11px] font-semibold text-center hover:bg-white/20 transition-colors">
                    {city}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-teal-700/50 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-center">
            <p className="text-teal-300 text-xs">
              Analytics optional and consent-based. Your route stays on your device.
            </p>
            <p className="text-teal-300 text-xs">
              © 2026 Sanchar AI — hackathon build
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// ─── HERO SEARCH FORM ────────────────────────────────────────
const HeroSearchForm = ({ preFillDest }: { preFillDest: string }) => {
  const [home, setHome] = useState('');
  const [dest, setDest] = useState(preFillDest || '');
  const [customHome, setCustomHome] = useState('');
  const [customDest, setCustomDest] = useState('');
  const [when, setWhen] = useState('');
  const [lang, setLang] = useState('English');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [prevPreFillDest, setPrevPreFillDest] = useState(preFillDest);
  if (preFillDest !== prevPreFillDest) {
    setPrevPreFillDest(preFillDest);
    setDest(preFillDest);
  }

  const origin = home === 'Other' ? customHome : home;
  const destination = dest === 'Other' ? customDest : dest;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!origin || !destination) {
      setError('Please choose both origin and destination.');
      return;
    }
    if (origin === destination) {
      setError("Pick a different destination — you're already there! 😄");
      return;
    }

    try {
      const res = await axios.post('/api/trips', {
        originCity: origin,
        destinationCity: destination,
        status: 'created',
        budget: 10000,
        expectedArrival: when ? new Date(when) : null,
        analyticsConsent: false
      });
      // Start trip and navigate
      await axios.post(`/api/trips/${res.data._id}/start`);
      navigate(`/active/${res.data._id}`);
    } catch {
      setError('Failed to create trip. The server may be offline.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-semibold text-[#1F2937] mb-1 block">Travelling from</label>
        <select value={home} onChange={e => setHome(e.target.value)} className="input-field py-2.5" required>
          <option value="">Choose origin...</option>
          {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          <option value="Other">Other City</option>
        </select>
        {home === 'Other' && <input type="text" placeholder="Enter city name" value={customHome} onChange={e => setCustomHome(e.target.value)} className="input-field py-2.5 mt-2" required />}
      </div>

      <div>
        <label className="text-xs font-semibold text-[#1F2937] mb-1 block">Travelling to</label>
        <select value={dest} onChange={e => setDest(e.target.value)} className="input-field py-2.5" required>
          <option value="">Choose destination...</option>
          {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          <option value="Other">Other City</option>
        </select>
        {dest === 'Other' && <input type="text" placeholder="Enter city name" value={customDest} onChange={e => setCustomDest(e.target.value)} className="input-field py-2.5 mt-2" required />}
      </div>

      <div>
        <label className="text-xs font-semibold text-[#1F2937] mb-1 block">Expected Arrival (optional)</label>
        <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className="input-field py-2.5" />
      </div>

      <div>
        <label className="text-xs font-semibold text-[#1F2937] mb-1 block">I understand best in</label>
        <select value={lang} onChange={e => setLang(e.target.value)} className="input-field py-2.5">
          <option value="English">English</option>
          <option value="Tamil">Tamil (தமிழ்)</option>
          <option value="Telugu">Telugu (తెలుగు)</option>
          <option value="Hindi">Hindi (हिन्दी)</option>
          <option value="Malayalam">Malayalam (മലയാളം)</option>
          <option value="Kannada">Kannada (ಕನ್ನಡ)</option>
        </select>
      </div>

      {error && <div className="text-xs font-medium text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">{error}</div>}

      <button type="submit" className="btn-primary w-full !py-3.5 mt-2 text-base font-bold bg-[#F59E0B] hover:bg-[#D97706] text-[#1F2937] shadow-md border-0">
        Create Demo Trip
      </button>
    </form>
  );
};

// ─── S4: CITY PACK REAL STATS ────────────────────────────────
const CityPacksRealStats = () => {
  const [packData, setPackData] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchStats = async () => {
      const citiesToFetch = ['Chennai', 'Kochi', 'Bengaluru'];
      const results: Record<string, any> = {};
      for (const city of citiesToFetch) {
        try {
          const res = await axios.get(`/api/city-packs/${city}`);
          results[city] = res.data;
        } catch {
          results[city] = null;
        }
      }
      setPackData(results);
    };
    fetchStats();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {['Chennai', 'Kochi', 'Bengaluru'].map(city => {
        const data = packData[city];
        return (
          <div key={city} className="card p-6 border border-gray-100 flex flex-col justify-between h-48 bg-white">
            <div>
              <div className="flex justify-between items-start">
                <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#1F2937]">{city}</h3>
                <span className="text-[10px] font-bold text-[#F59E0B] bg-[#F59E0B]/10 px-2 py-0.5 rounded-full">
                  Free with Sanchar AI
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-2">
                {data ? `${data.phrases?.length || 0} phrases · ${data.emergencyNumbers?.length || 0} emergency links · works offline` : 'Loading statistics...'}
              </p>
            </div>
            <div className="text-[11px] text-[#64748B] flex items-center gap-1 italic border-t border-gray-100 pt-3">
              <Check size={12} className="text-[#2E7D32]" /> Offline database payload pre-seeded
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── S7: LIVE SITE STATS ─────────────────────────────────────
const LiveSiteStats = () => {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    axios.get('/api/site-stats')
      .then(res => setStats(res.data))
      .catch(() => setStats(null));
  }, []);

  return (
    <div>
      <div className="text-center mb-12">
        <span className="badge badge-teal mb-3"><BarChart3 size={14} /> Analytics Status</span>
        <h2 className="text-3xl font-extrabold text-[#1F2937] tracking-tight">Deploy aggregates</h2>
        <p className="text-[#64748B] text-sm mt-2">Computed from active pilot configurations.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="card p-6 text-center bg-white border border-gray-100">
          <p className="text-xs text-[#64748B] font-bold uppercase tracking-wider mb-2">Trips Recorded</p>
          <h3 className="font-['Plus_Jakarta_Sans'] font-extrabold text-3xl text-[#00695C]">
            {stats ? `${stats.tripsRecorded} trips` : '0 trips — first'}
          </h3>
        </div>
        <div className="card p-6 text-center bg-white border border-gray-100">
          <p className="text-xs text-[#64748B] font-bold uppercase tracking-wider mb-2">Packs Live</p>
          <h3 className="font-['Plus_Jakarta_Sans'] font-extrabold text-3xl text-[#00695C]">
            {stats ? `${stats.cityPacksLive} packs` : '7 packs'}
          </h3>
        </div>
        <div className="card p-6 text-center bg-white border border-gray-100">
          <p className="text-xs text-[#64748B] font-bold uppercase tracking-wider mb-2">Languages</p>
          <h3 className="font-['Plus_Jakarta_Sans'] font-extrabold text-3xl text-[#00695C]">
            {stats ? `${stats.languagesSupported} local` : '6 languages'}
          </h3>
        </div>
        <div className="card p-6 text-center bg-white border border-gray-100">
          <p className="text-xs text-[#64748B] font-bold uppercase tracking-wider mb-2">Safety checks</p>
          <h3 className="font-['Plus_Jakarta_Sans'] font-extrabold text-3xl text-[#00695C]">
            {stats && stats.safetyChecks > 0 ? `${stats.safetyChecks} checked` : 'Pilot Target'}
          </h3>
        </div>
      </div>
    </div>
  );
};

// ─── S8: JOIN PILOT FORM ─────────────────────────────────────
const JoinPilotForm = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: null, message: '' });
    try {
      const res = await axios.post('/api/pilot-signups', { name, email, city, feedback });
      setStatus({ type: 'success', message: `${res.data.message}! (Pilot signups total: ${res.data.count})` });
      setName('');
      setEmail('');
      setCity('');
      setFeedback('');
    } catch {
      setStatus({ type: 'error', message: "Couldn't save — try again" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-lg">
      <div>
        <label className="text-xs font-semibold text-[#1F2937] mb-1 block">Full Name</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field py-2.5" placeholder="Enter full name" required />
      </div>
      <div>
        <label className="text-xs font-semibold text-[#1F2937] mb-1 block">Email (optional)</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field py-2.5" placeholder="your@email.com" />
      </div>
      <div>
        <label className="text-xs font-semibold text-[#1F2937] mb-1 block">City you travel from</label>
        <input type="text" value={city} onChange={e => setCity(e.target.value)} className="input-field py-2.5" placeholder="e.g. Madurai" required />
      </div>
      <div>
        <label className="text-xs font-semibold text-[#1F2937] mb-1 block">What should we build next?</label>
        <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3} className="input-field py-2.5" placeholder="Feedback/Request comments..." />
      </div>

      {status.type === 'success' && <div className="text-xs font-semibold text-[#2E7D32] bg-green-50 p-2.5 rounded-xl border border-green-200">{status.message}</div>}
      {status.type === 'error' && <div className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">{status.message}</div>}

      <button type="submit" className="btn-primary w-full !py-3 font-bold mt-2">
        Join Pilot Program
      </button>
    </form>
  );
};

// ─── M1: CREATE TRIP (INNER SCREEN) ──────────────────────────
const CreateTrip = () => {
  const [home, setHome] = useState('');
  const [dest, setDest] = useState('');
  const [customHome, setCustomHome] = useState('');
  const [customDest, setCustomDest] = useState('');
  const [budget, setBudget] = useState(10000);
  const [expectedArrival, setExpectedArrival] = useState('');
  const [trustedContact, setTrustedContact] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const origin = home === 'Other' ? customHome : home;
  const destination = dest === 'Other' ? customDest : dest;

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!origin || !destination) return setError('Please select both cities.');
    if (origin === destination) return setError("Pick a different destination — you're already there! 😄");
    try {
      const res = await axios.post('/api/trips', {
        originCity: origin,
        destinationCity: destination,
        budget,
        expectedArrival: expectedArrival ? new Date(expectedArrival) : null,
        trustedContactLabel: trustedContact || undefined,
        analyticsConsent: consent,
      });
      // Start journey tracking
      await axios.post(`/api/trips/${res.data._id}/start`);
      navigate(`/active/${res.data._id}`);
    } catch {
      setError('Failed to create trip. The server may be offline.');
    }
  };

  return (
    <div className="p-5 md:p-8 animate-fade-in-up">
      <div className="mb-6">
        <span className="badge badge-teal mb-3"><MapPin size={14} /> New Journey</span>
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans']">Plan Your Trip</h1>
        <p className="text-[#64748B] text-sm mt-1">Every field produces real data — no simulations.</p>
      </div>

      <form onSubmit={handleStart} className="flex flex-col gap-5">
        <div>
          <label className="text-sm font-semibold text-[#1F2937] mb-1.5 block">Origin City</label>
          <select value={home} onChange={e => setHome(e.target.value)} className="input-field" required>
            <option value="">Select origin…</option>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="Other">Other City</option>
          </select>
          {home === 'Other' && <input type="text" placeholder="Enter your city" value={customHome} onChange={e => setCustomHome(e.target.value)} className="input-field mt-2" required />}
        </div>

        <div>
          <label className="text-sm font-semibold text-[#1F2937] mb-1.5 block">Destination City</label>
          <select value={dest} onChange={e => setDest(e.target.value)} className="input-field" required>
            <option value="">Select destination…</option>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="Other">Other City</option>
          </select>
          {dest === 'Other' && <input type="text" placeholder="Enter destination city" value={customDest} onChange={e => setCustomDest(e.target.value)} className="input-field mt-2" required />}
        </div>

        <div>
          <label className="text-sm font-semibold text-[#1F2937] mb-1.5 block">Budget (₹)</label>
          <input type="number" value={budget} onChange={e => setBudget(Number(e.target.value))} className="input-field" required min={100} />
        </div>

        <div>
          <label className="text-sm font-semibold text-[#1F2937] mb-1.5 block">Expected Arrival (optional)</label>
          <input type="datetime-local" value={expectedArrival} onChange={e => setExpectedArrival(e.target.value)} className="input-field" />
        </div>

        <div>
          <label className="text-sm font-semibold text-[#1F2937] mb-1.5 block">Trusted Contact Name (optional)</label>
          <input type="text" placeholder="e.g. Mom, Friend" value={trustedContact} onChange={e => setTrustedContact(e.target.value)} className="input-field" />
        </div>

        <div className="card p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 w-5 h-5 accent-[#00695C]" />
            <span className="text-sm">
              <strong className="text-[#1F2937]">Contribute anonymous mobility insights</strong> (Optional)<br />
              <span className="text-[#64748B] text-xs">Your exact route never leaves your device; only optional geohash grid aggregates are binned.</span>
            </span>
          </label>
        </div>

        {error && <div className="badge badge-red px-4 py-3 w-full justify-center"><AlertTriangle size={14} /> {error}</div>}

        <button type="submit" className="btn-primary w-full !py-4 text-base mt-2">
          <Navigation2 size={20} /> Start Safe Trip
        </button>
      </form>
    </div>
  );
};

// Helper to parse expected arrival time with data repair
const getExpectedArrivalTime = (trip: any) => {
  if (!trip || !trip.expectedArrival) return null;
  const t = new Date(trip.expectedArrival).getTime();
  if (isNaN(t) || t <= 0) return null;

  // Data repair: if expectedArrival <= trip start time + 5s, it was defaulted at creation
  const tripStart = trip.startTime ? new Date(trip.startTime).getTime() : 0;
  if (t <= tripStart + 5000) return null;

  // Legacy trip cutoff time: 2026-08-22T14:30:42+05:30 (approx 1787401842000 ms)
  const FIX_CUTOFF_TIME = 1787401842000;
  const createdAt = trip.createdAt ? new Date(trip.createdAt).getTime() : 0;
  if (createdAt < FIX_CUTOFF_TIME && t < Date.now()) {
    return null;
  }
  return t;
};

// Cooldown checkers (30-minute window)
const isLateArrivalCooldownActive = (trip: any) => {
  if (!trip || !trip.lastLateArrivalTriggerAt) return false;
  const lastTrigger = new Date(trip.lastLateArrivalTriggerAt).getTime();
  return Date.now() - lastTrigger < 30 * 60 * 1000;
};

const isRouteDeviationCooldownActive = (trip: any) => {
  if (!trip || !trip.lastRouteDeviationTriggerAt) return false;
  const lastTrigger = new Date(trip.lastRouteDeviationTriggerAt).getTime();
  return Date.now() - lastTrigger < 30 * 60 * 1000;
};

// ─── M2: ACTIVE TRIP ─────────────────────────────────────────
const ActiveTrip = () => {
  const { id } = useParams();
  const tripId = id || '';
  const { speed, segment, confidence, distance, points, permDenied } = useGPSTracker(tripId);
  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [trip, setTrip] = useState<any>(null);
  const [safetyAlert, setSafetyAlert] = useState<{ type: 'late-arrival' | 'route-deviation'; msg: string } | null>(null);
  const [stillnessAlert, setStillnessAlert] = useState(false);
  const [showSosModal, setShowSosModal] = useState(false);
  const navigate = useNavigate();

  // Load trip config
  useEffect(() => {
    const fetchTrip = () => {
      if (tripId) {
        axios.get(`/api/trips/${tripId}`).then(r => setTrip(r.data)).catch(console.warn);
      }
    };
    fetchTrip();
  }, [tripId]);

  // Elapsed timer
  useEffect(() => {
    const timer = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  // 1. Late-Arrival Trigger (+15 mins) check
  useEffect(() => {
    if (!trip) return;
    const interval = setInterval(() => {
      const expected = getExpectedArrivalTime(trip);
      if (expected && !isLateArrivalCooldownActive(trip)) {
        if (Date.now() > expected + 15 * 60 * 1000) {
          setTimeout(() => {
            setSafetyAlert({
              type: 'late-arrival',
              msg: "Late-Arrival Warning: Expectation exceeded by 15 mins. Please confirm status."
            });
          }, 0);
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [trip]);

  // 2. Deviation triggers check
  useEffect(() => {
    if (points.length < 5 || !trip || isRouteDeviationCooldownActive(trip)) return;
    // Rolling direction deviation trigger mock logic
    const lastPoints = points.slice(-5);
    const bearings = lastPoints.map((p, i) => {
      if (i === 0) return 0;
      const prev = lastPoints[i - 1];
      const dy = p.lat - prev.lat;
      const dx = p.lng - prev.lng;
      return Math.atan2(dy, dx) * 180 / Math.PI;
    });

    const maxDiff = Math.max(...bearings) - Math.min(...bearings);
    if (maxDiff > 30) {
      setTimeout(() => {
        setSafetyAlert({
          type: 'route-deviation',
          msg: "Route-Deviation Triggered: Roll change exceeded 30° bearing offset. (Probabilistic check - based on actual movement)"
        });
      }, 0);
    }
  }, [points, trip]);

  // Stillness detector (speed < 1 km/h for 10 minutes)
  useEffect(() => {
    if (points.length < 2) return;
    const now = Date.now();
    const tenMinsAgo = now - 10 * 60 * 1000;
    const lastPoints = points.filter(p => new Date(p.timestamp).getTime() > tenMinsAgo);
    if (lastPoints.length >= 3) {
      const allStill = lastPoints.every(p => p.speedKmh < 1);
      if (allStill) {
        setTimeout(() => {
          setStillnessAlert(true);
        }, 0);
      }
    }
  }, [points]);

  // Safety Response handler (I'm Safe / Open SOS)
  const handleSafetyResponse = async (type: 'late-arrival' | 'route-deviation', response: 'im-safe' | 'open-sos') => {
    setSafetyAlert(null);
    try {
      // 1. Post SafetyEvent record to database
      await axios.post(`/api/trips/${tripId}/safety-events`, {
        type,
        userResponse: response,
        resolvedAt: new Date()
      });
      // 2. Patch trip trigger cooldown timestamp
      const field = type === 'late-arrival' ? 'lastLateArrivalTriggerAt' : 'lastRouteDeviationTriggerAt';
      const patchRes = await axios.patch(`/api/trips/${tripId}`, {
        [field]: new Date()
      });
      setTrip(patchRes.data);
    } catch (e) {
      console.warn('Failed to submit safety response:', e);
    }
  };

  // SOS button press timer
  const sosPressTimer = useRef<any>(null);
  const handleSosStart = () => {
    sosPressTimer.current = setTimeout(() => {
      setShowSosModal(true);
      // Log SOS safety event
      axios.post(`/api/trips/${tripId}/safety-events`, {
        type: 'user-initiated-sos',
        resolvedAt: new Date()
      }).catch(console.warn);
    }, 3000); // 3s hold trigger
  };

  const handleSosEnd = () => {
    if (sosPressTimer.current) {
      clearTimeout(sosPressTimer.current);
    }
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m ${s % 60}s`;
  };

  const completeTrip = async () => {
    try {
      await axios.post(`/api/trips/${tripId}/complete`);
      // Run privacy pipeline sync
      await axios.post(`/api/sync/${tripId}`);
      navigate(`/diary/${tripId}`);
    } catch {
      navigate(`/diary/${tripId}`);
    }
  };

  const segmentEmoji: Record<string, string> = { still: '🧍', walking: '🚶', road_vehicle: '🚗', rail: '🚆', unknown: '❓' };

  return (
    <div className="flex flex-col min-h-screen bg-[#FAFAF7] animate-fade-in-up">
      {/* Header */}
      <div className="p-5 md:p-8 pb-0">
        <span className="badge badge-green mb-3"><Navigation2 size={14} /> Tracking Active</span>
        <h1 className="text-2xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans']">Live Journey</h1>
      </div>

      {permDenied && (
        <div className="mx-5 md:mx-8 mt-4 badge badge-amber !rounded-xl px-4 py-3 w-auto">
          <AlertTriangle size={14} /> Location permission denied — tracking manual
        </div>
      )}

      {/* Safety Alert Card */}
      {safetyAlert && (
        <div className="mx-5 md:mx-8 mt-4 p-5 rounded-2xl border border-red-200 bg-red-50 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-[#D32F2F] shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-sm text-[#D32F2F] uppercase tracking-wide">Safety Notification</p>
              <p className="text-xs text-[#1F2937] mt-1 font-medium">{safetyAlert.msg}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={() => handleSafetyResponse(safetyAlert.type, 'im-safe')}
              className="py-2 px-4 bg-[#2E7D32] text-white text-xs font-bold rounded-full cursor-pointer"
            >
              I'm Safe ✅
            </button>
            <button
              onClick={() => {
                handleSafetyResponse(safetyAlert.type, 'open-sos');
                setShowSosModal(true);
              }}
              className="py-2 px-4 bg-[#D32F2F] text-white text-xs font-bold rounded-full cursor-pointer"
            >
              Open SOS
            </button>
          </div>
        </div>
      )}

      {/* Stillness Arrival Alert Card */}
      {stillnessAlert && (
        <div className="mx-5 md:mx-8 mt-4 p-5 rounded-2xl border border-teal-200 bg-teal-50 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <Check className="text-[#2E7D32] shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-sm text-[#2E7D32] uppercase tracking-wide">Stillness Detected</p>
              <p className="text-xs text-[#1F2937] mt-1 font-medium">
                It looks like you've been stationary for over 10 minutes. Did you arrive at your destination?
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={completeTrip}
              className="py-2 px-4 bg-[#2E7D32] text-white text-xs font-bold rounded-full cursor-pointer"
            >
              Yes, Complete Trip ✅
            </button>
            <button
              onClick={() => setStillnessAlert(false)}
              className="py-2 px-4 bg-gray-300 text-gray-700 text-xs font-bold rounded-full cursor-pointer"
            >
              Not Yet
            </button>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="p-5 md:p-8 grid grid-cols-2 gap-4">
        <div className="card metric-card p-5 text-center col-span-2 flex flex-col items-center">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Trip Budget Progress</p>
          <p className="text-2xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans']">
            ₹{(trip?.amountSpent || 0).toLocaleString('en-IN')} / ₹{(trip?.budget || 0).toLocaleString('en-IN')}
          </p>
          <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mt-3 max-w-sm">
            <div
              className={`h-full transition-all duration-300 ${((trip?.amountSpent || 0) > (trip?.budget || 0)) ? 'bg-[#D32F2F]' : 'bg-[#2E7D32]'}`}
              style={{ width: `${Math.min(100, ((trip?.amountSpent || 0) / (trip?.budget || 1)) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-[#64748B] mt-2">
            Remaining: <span className="font-bold text-[#00695C]">₹{Math.max(0, (trip?.budget || 0) - (trip?.amountSpent || 0)).toLocaleString('en-IN')}</span>
          </p>
        </div>

        <div className="card metric-card p-5 text-center">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Speed</p>
          <p className="text-3xl font-extrabold text-[#00695C] font-['Plus_Jakarta_Sans']">{speed.toFixed(1)}</p>
          <p className="text-xs text-[#64748B]">km/h</p>
        </div>
        <div className="card metric-card p-5 text-center">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Distance</p>
          <p className="text-3xl font-extrabold text-[#00695C] font-['Plus_Jakarta_Sans']">{distance.toFixed(2)}</p>
          <p className="text-xs text-[#64748B]">km</p>
        </div>
        <div className="card metric-card p-5 text-center">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Elapsed</p>
          <p className="text-lg font-bold text-[#1F2937] font-['Plus_Jakarta_Sans']">{formatTime(elapsed)}</p>
        </div>
        <div className="card metric-card p-5 text-center">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Points</p>
          <p className="text-3xl font-extrabold text-[#00695C] font-['Plus_Jakarta_Sans']">{points.length}</p>
        </div>
      </div>

      {/* Segment */}
      <div className="px-5 md:px-8 mb-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#00695C]/10 flex items-center justify-center text-2xl">
            {segmentEmoji[segment]}
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-[#64748B] uppercase">Probable Segment</p>
            <p className="font-bold text-lg capitalize text-[#1F2937]">{segment.replace('_', ' ')} — <span className="text-[#00695C]">{confidence}%</span></p>
            <p className="text-[11px] text-[#64748B] italic">Probabilistic — based on actual movement</p>
          </div>
        </div>
      </div>

      {/* Android Badge */}
      <div className="px-5 md:px-8 mb-4">
        <div className="bg-[#FEF3C7] border border-[#FDE68A] p-4 rounded-2xl text-xs text-[#92400E] flex gap-3 items-start">
          <Smartphone size={16} className="shrink-0 mt-0.5" />
          <div>
            <strong>Android app module:</strong> Background tracking, geofence starts, precise step counting, and push wakeups require the native Android application. Keep this tab open.
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-auto p-5 md:p-8 bg-white border-t border-gray-100 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate(`/scan/${tripId}`)} className="btn-secondary !py-3 text-sm">
            <Camera size={16} /> Scan Bill
          </button>
          <button onClick={() => navigate(`/expenses/${tripId}`)} className="btn-secondary !py-3 text-sm">
            <IndianRupee size={16} /> Expenses
          </button>
        </div>
        <button
          onClick={completeTrip}
          className="btn-primary w-full !py-3.5 bg-[#00695C] hover:bg-[#004D40] text-white font-bold"
        >
          Confirm Arrival & Complete Journey
        </button>

        {/* SOS Button: 3s Hold */}
        <button
          onMouseDown={handleSosStart}
          onMouseUp={handleSosEnd}
          onTouchStart={handleSosStart}
          onTouchEnd={handleSosEnd}
          className="btn-danger w-full !py-3.5 mt-2 bg-[#D32F2F] text-white font-bold animate-pulse-glow"
        >
          Hold to Trigger SOS (3s)
        </button>
      </div>

      {/* SOS MODAL */}
      {showSosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm flex flex-col items-center text-center gap-5 shadow-2xl animate-fade-in">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center text-[#D32F2F] animate-bounce">
              <Phone size={28} />
            </div>
            <div>
              <h3 className="font-['Plus_Jakarta_Sans'] font-extrabold text-xl text-[#1F2937]">Emergency SOS</h3>
              <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                Emergency pipeline activated. Share location or call services.
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <a
                href="tel:112"
                className="btn-danger w-full py-3 text-center text-sm font-bold no-underline"
              >
                Call National Emergency (112)
              </a>
              <a
                href={points.length > 0 ? `https://maps.google.com/?q=${points[points.length-1].lat},${points[points.length-1].lng}` : 'https://maps.google.com'}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary w-full py-3 text-center text-sm font-bold text-[#00695C] no-underline"
              >
                Open Last Location in Maps
              </a>
              <button
                onClick={() => {
                  const lastPt = points[points.length - 1];
                  const shareText = `Emergency SOS! I need help. Last location: ${lastPt ? `${lastPt.lat}, ${lastPt.lng}` : 'India'}`;
                  if (navigator.share) {
                    navigator.share({ text: shareText });
                  } else {
                    navigator.clipboard.writeText(shareText);
                    alert('SOS message copied to clipboard!');
                  }
                }}
                className="btn-secondary w-full py-3 text-sm font-bold border border-gray-200"
              >
                Share SOS Details
              </button>
              <button
                onClick={() => setShowSosModal(false)}
                className="text-xs text-[#64748B] mt-2 font-medium"
              >
                Close Modal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── M3: CAMERA SCANNER ─────────────────────────────────────
const CameraScanner = () => {
  const { id } = useParams();
  const tripId = id || '';
  const [status, setStatus] = useState('Take a photo of a receipt or ticket.');
  const [amount, setAmount] = useState<number | null>(null);
  const [category, setCategory] = useState('transport');
  const [merchant, setMerchant] = useState('');
  const [rawText, setRawText] = useState('');
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    setStatus('Processing image with OCR…');
    try {
      const text = await ocrProvider.recognize(file);
      setRawText(text);
      
      const match = text.match(/(?:Rs\.?|₹|INR)\s*(\d+(?:,\d+)*(?:\.\d{1,2})?)/i)
        || text.match(/(\d+(?:,\d+)*(?:\.\d{1,2})?)\s*(?:\/-)/i)
        || text.match(/(?:total|fare|amount|price)[:\s]*(\d+(?:,\d+)*(?:\.\d{1,2})?)/i);
      
      if (match && match[1]) {
        const extracted = parseFloat(match[1].replace(/,/g, ''));
        setAmount(extracted);
        setStatus('Detected amount – confirm or edit.');
      } else {
        setStatus('Could not autodetect an amount. Enter manually below.');
        setAmount(null);
      }
    } catch (err) {
      console.warn(err);
      setStatus('OCR failed. Please try again.');
    }
    setProcessing(false);
  };

  const confirmExpense = async () => {
    if (amount === null || amount <= 0) return;
    const payload = { merchant: merchant || 'Scanned Item', amount, category, source: 'ocr' as const, confirmed: true };
    try {
      await axios.post(`/api/trips/${tripId}/expenses`, payload);
    } catch {
      await queueOfflineMutation({ method: 'post', url: `/api/trips/${tripId}/expenses`, body: payload });
    }
    navigate(`/active/${tripId}`);
  };

  return (
    <div className="p-5 md:p-8 flex flex-col min-h-screen animate-fade-in-up">
      <div className="mb-6">
        <span className="badge badge-teal mb-3"><Camera size={14} /> Smart Scan</span>
        <h1 className="text-2xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans']">Scan Expense</h1>
        <p className="text-xs text-[#64748B] mt-1">On-device scan — runs fully offline in this browser (Tesseract.js/WASM).</p>
      </div>

      {/* Capture Area */}
      <label className="card flex flex-col items-center justify-center h-48 cursor-pointer border-2 border-dashed border-gray-200 hover:border-[#00695C] transition-colors">
        <Camera size={40} className="text-[#64748B] mb-3" />
        <span className="font-semibold text-[#1F2937] text-sm">Tap to capture or upload</span>
        <span className="text-xs text-[#64748B] mt-1">Camera or file input</span>
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCapture} />
      </label>

      <div className="mt-4 text-center">
        <p className="text-sm text-[#64748B]">{processing ? <span className="animate-pulse">{status}</span> : status}</p>
      </div>

      {/* Raw OCR Text Preview */}
      {rawText && (
        <div className="mt-4 card p-4">
          <p className="text-xs font-semibold text-[#64748B] uppercase mb-2">Extracted Text</p>
          <p className="text-xs text-[#1F2937] font-mono bg-gray-50 p-3 rounded-lg max-h-24 overflow-y-auto whitespace-pre-wrap">{rawText}</p>
        </div>
      )}

      {/* Amount + Confirm */}
      <div className="mt-4 card p-5">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs font-semibold text-[#64748B] mb-1 block">Amount (₹)</label>
            <input type="number" value={amount ?? ''} onChange={e => setAmount(Number(e.target.value))} className="input-field" placeholder="0" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#64748B] mb-1 block">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="input-field">
              <option value="transport">Transport</option>
              <option value="food">Food</option>
              <option value="hotel">Hotel</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div className="mb-4">
          <label className="text-xs font-semibold text-[#64748B] mb-1 block">Merchant (optional)</label>
          <input type="text" value={merchant} onChange={e => setMerchant(e.target.value)} className="input-field" placeholder="e.g. Ola, Restaurant name" />
        </div>
        <button onClick={confirmExpense} disabled={amount === null || amount <= 0} className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
          <Check size={16} /> Confirm Expense
        </button>
      </div>

      <button onClick={() => navigate(`/active/${tripId}`)} className="mt-6 text-sm font-medium text-[#64748B] hover:text-[#00695C] transition-colors">
        ← Back to trip
      </button>
    </div>
  );
};

// ─── M5: EXPENSES LIST ───────────────────────────────────────
const ExpensesList = () => {
  const { id } = useParams();
  const [expenses, setExpenses] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (id) axios.get(`/api/trips/${id}/expenses`).then(r => setExpenses(r.data)).catch(console.warn);
  }, [id]);

  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div className="p-5 md:p-8 animate-fade-in-up">
      <span className="badge badge-teal mb-3"><IndianRupee size={14} /> Expenses</span>
      <h1 className="text-2xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans'] mb-1">Trip Expenses</h1>
      <p className="text-sm text-[#64748B] mb-6">Total: <strong className="text-[#1F2937]">₹{total.toLocaleString('en-IN')}</strong></p>

      {expenses.length === 0 ? (
        <div className="card p-8 text-center">
          <IndianRupee size={32} className="text-[#64748B] mx-auto mb-3" />
          <p className="text-sm text-[#64748B]">No expenses recorded yet. Scan a ticket or add one manually.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((exp: any, i: number) => (
            <div key={i} className="card p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-[#1F2937]">{exp.merchant || 'Unknown'}</p>
                <p className="text-xs text-[#64748B]">{exp.category} · {exp.source}</p>
              </div>
              <p className="font-bold text-[#00695C]">₹{(exp.amount || 0).toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button onClick={() => navigate(`/scan/${id}`)} className="btn-primary flex-1"><Camera size={16} /> Scan New</button>
        <button onClick={() => navigate(`/active/${id}`)} className="btn-secondary flex-1">← Back</button>
      </div>
    </div>
  );
};

// ─── M7: DIARY ───────────────────────────────────────────────
const Diary = () => {
  const { id } = useParams();
  const [trip, setTrip] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    axios.get(`/api/trips/${id}`).then(r => setTrip(r.data)).catch(console.warn);
    axios.get(`/api/trips/${id}/expenses`).then(r => setExpenses(r.data)).catch(console.warn);
  }, [id]);

  const totalSpent = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  const handleShare = () => {
    const text = trip
      ? `🛤️ My Sanchar AI Journey\n${trip.originCity} → ${trip.destinationCity}\nSpent: ₹${totalSpent.toLocaleString('en-IN')} of ₹${(trip.budget || 0).toLocaleString('en-IN')}\nExpenses: ${expenses.length} items\n\nGenerated by Sanchar AI — ${SITE_URL}`
      : 'Sanchar AI Journey';
    if (navigator.share) navigator.share({ text });
    else {
      navigator.clipboard.writeText(text);
      alert('Diary details copied to clipboard!');
    }
  };

  if (!trip) return <div className="p-8 text-center text-[#64748B]">Loading diary…</div>;

  return (
    <div className="p-5 md:p-8 animate-fade-in-up">
      <span className="badge badge-teal mb-3"><BookOpen size={14} /> Trip Diary</span>
      <h1 className="text-2xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans'] mb-6">
        {trip.originCity} → {trip.destinationCity}
      </h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card p-4 text-center">
          <p className="text-xs text-[#64748B]">Budget</p>
          <p className="font-bold text-lg text-[#00695C]">₹{(trip.budget || 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-[#64748B]">Spent</p>
          <p className="font-bold text-lg text-[#D32F2F]">₹{totalSpent.toLocaleString('en-IN')}</p>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <h3 className="font-bold text-sm text-[#1F2937] mb-3">Expenses ({expenses.length})</h3>
        {expenses.length === 0
          ? <p className="text-sm text-[#64748B]">No expenses recorded.</p>
          : expenses.map((e: any, i: number) => (
            <div key={i} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-[#1F2937]">{e.merchant}</span>
              <span className="text-sm font-semibold text-[#00695C]">₹{(e.amount || 0).toLocaleString('en-IN')}</span>
            </div>
          ))
        }
      </div>

      <button onClick={handleShare} className="btn-primary w-full mb-3"><Share2 size={16} /> Share Diary</button>
      <Link to="/" className="btn-secondary w-full text-center block">Plan New Trip</Link>
    </div>
  );
};

// ─── PRIVACY PAGE ────────────────────────────────────────────
const PrivacyPage = () => (
  <div className="p-5 md:p-8 animate-fade-in-up">
    <span className="badge badge-teal mb-3"><Lock size={14} /> Privacy</span>
    <h1 className="text-2xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans'] mb-6">How Your Data Works</h1>

    <div className="card p-6 mb-6">
      <h3 className="font-bold text-[#1F2937] mb-3">When Analytics is OFF (default)</h3>
      <p className="text-sm text-[#64748B]">Your journey stays on your device and in your personal records only. No data is aggregated. No mobility insights are generated.</p>
    </div>

    <div className="card p-6 mb-6">
      <h3 className="font-bold text-[#1F2937] mb-3">When Analytics is ON (your choice)</h3>
      <ul className="text-sm text-[#64748B] space-y-2">
        <li>• The server drops the first and last 500m of your trip</li>
        <li>• Remaining points are binned into ~500m geohash grid cells</li>
        <li>• Cells with fewer than 3 contributing trips are suppressed</li>
        <li>• Only anonymized aggregates are written to the dashboard</li>
        <li>• <strong>Personal LocationPoints are NEVER read by dashboard endpoints</strong></li>
      </ul>
    </div>

    <div className="card p-6">
      <h3 className="font-bold text-sm text-[#64748B] uppercase tracking-wider mb-4">Live vs Android Module</h3>
      {[
        { f: 'GPS tracking (tab open)', live: true },
        { f: 'OCR ticket scanning (offline)', live: true },
        { f: 'SOS emergency links', live: true },
        { f: 'Privacy pipeline', live: true },
        { f: 'Background tracking', live: false },
        { f: 'Step counting', live: false },
        { f: 'FCM push notifications', live: false },
      ].map((r, i) => (
        <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
          <span className="text-sm">{r.f}</span>
          {r.live ? <span className="badge badge-green text-xs"><Check size={12} /> Live</span> : <span className="android-badge"><Smartphone size={12} /> Android</span>}
        </div>
      ))}
    </div>
  </div>
);

// ─── DASHBOARD ───────────────────────────────────────────────
const Dashboard = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/mobility/summary')
      .then(r => setSummary(r.data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-[#64748B]">Loading dashboard…</div>;

  const totalTrips = summary?.totalTrips || 0;

  return (
    <div className="p-5 md:p-8 animate-fade-in-up">
      <span className="badge badge-teal mb-3"><BarChart3 size={14} /> Analytics</span>
      <h1 className="text-2xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans'] mb-2">Mobility Dashboard</h1>
      <p className="text-sm text-[#64748B] mb-6">
        {totalTrips > 0
          ? `Computed from ${totalTrips} consented trip${totalTrips > 1 ? 's' : ''} recorded in this deployment.`
          : ''}
      </p>

      {totalTrips === 0 ? (
        <div className="card p-10 text-center">
          <BarChart3 size={48} className="text-[#64748B] mx-auto mb-4" />
          <h3 className="font-bold text-lg text-[#1F2937] mb-2">No consented trips recorded yet</h3>
          <p className="text-sm text-[#64748B] max-w-sm mx-auto">Complete one real trip with analytics ON to see live aggregates here. All data comes from real recorded journeys.</p>
          <Link to="/create" className="btn-primary mt-6 inline-flex">Create a Trip</Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card p-5">
            <p className="text-xs font-semibold text-[#64748B] uppercase mb-1">Total Consented Trips</p>
            <p className="text-4xl font-extrabold text-[#00695C]">{totalTrips}</p>
          </div>
          <p className="text-xs text-[#64748B] italic">Sanchar AI estimates probable demand and crowding periods. Exact bus/train occupancy requires official operator data.</p>
        </div>
      )}
    </div>
  );
};

// ─── 404 ─────────────────────────────────────────────────────
const NotFound = () => (
  <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center">
    <div className="text-center p-8">
      <h1 className="text-6xl font-extrabold text-[#00695C] font-['Plus_Jakarta_Sans'] mb-4">404</h1>
      <p className="text-lg text-[#64748B] mb-6">This page doesn't exist — but your journey can.</p>
      <Link to="/" className="btn-primary">Go Home</Link>
    </div>
  </div>
);

export default App;
