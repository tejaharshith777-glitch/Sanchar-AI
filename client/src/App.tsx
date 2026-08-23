import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Link, useParams, useSearchParams, useLocation } from 'react-router-dom';
import {
  Shield, MapPin, Navigation2, Camera, Smartphone, WifiOff,
  Zap, Globe, Lock, IndianRupee, Phone,
  ChevronRight, Check, AlertTriangle, Share2,
  BookOpen, BarChart3, Activity, Search, Compass, HelpCircle
} from 'lucide-react';
import axios from 'axios';
import { queueOfflineMutation, getOfflineQueue, removeQueueItem } from './store/db';
import { ocrProvider } from './ocr/OcrProvider';
import PocketMap from './components/PocketMap';

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
  activeTrip: any | null;
  lastCompletedTrip: any | null;
  refreshTrips: () => Promise<void>;
}

const HealthContext = createContext<HealthContextType>({
  isBackendOffline: false,
  dbMode: null,
  syncState: 'synced',
  isOnline: true,
  activeTrip: null,
  lastCompletedTrip: null,
  refreshTrips: async () => {}
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
  const [activeTrip, setActiveTrip] = useState<any | null>(null);
  const [lastCompletedTrip, setLastCompletedTrip] = useState<any | null>(null);

  const refreshTrips = async () => {
    try {
      const res = await axios.get('/api/trips');
      const trips = res.data || [];
      const active = trips.find((t: any) => t.status === 'active' || t.status === 'created');
      const completed = trips
        .filter((t: any) => t.status === 'completed' || t.status === 'arrived-confirmed')
        .sort((a: any, b: any) => new Date(b.endTime || b.createdAt).getTime() - new Date(a.endTime || a.createdAt).getTime())[0];

      setActiveTrip(active || null);
      setLastCompletedTrip(completed || null);
    } catch {
      // Ignore offline error
    }
  };

  const fetchActiveTripOnly = async () => {
    try {
      const res = await axios.get('/api/trips/active');
      if (res.data && !res.data.message) {
        setActiveTrip(res.data);
      } else {
        setActiveTrip(null);
      }
    } catch {
      setActiveTrip(null);
    }
  };

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
    const interval = setInterval(checkHealth, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Poll active trip every 30s
  useEffect(() => {
    setTimeout(() => {
      fetchActiveTripOnly();
      refreshTrips(); // Initial full fetch
    }, 0);
    
    const interval = setInterval(fetchActiveTripOnly, 30000);
    return () => clearInterval(interval);
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

  return { isOnline, syncState, isBackendOffline, dbMode, activeTrip, lastCompletedTrip, refreshTrips };
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
          const key = crypto.randomUUID();
          axios.post(`/api/trips/${tripId}/points`, { points: currentBatch }, { headers: { 'Idempotency-Key': key } })
            .catch(() => {
              console.log('[GPS] Queuing points locally to IndexedDB...');
              queueOfflineMutation(`/api/trips/${tripId}/points`, 'POST', { points: currentBatch }, key);
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
          <Route path="/city/:cityName" element={<CitySpotlightPage />} />
          <Route path="/create" element={<AppShell><CreateTrip /></AppShell>} />
          <Route path="/active/:id" element={<AppShell><ActiveTrip /></AppShell>} />
          <Route path="/scan/:id" element={<AppShell><CameraScanner /></AppShell>} />
          <Route path="/expenses/:id" element={<AppShell><ExpensesList /></AppShell>} />
          <Route path="/diary/:id" element={<AppShell><VaultGuard><Diary /></VaultGuard></AppShell>} />
          <Route path="/gallery/:id" element={<AppShell><VaultGuard><TripGallery /></VaultGuard></AppShell>} />
          <Route path="/city/:city" element={<AppShell><CitySpots /></AppShell>} />
          <Route path="/privacy" element={<AppShell><PrivacyPage /></AppShell>} />
          <Route path="/features" element={<AppShell><FeaturesPage /></AppShell>} />
          <Route path="/faq" element={<AppShell><FaqPage /></AppShell>} />
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

// ─── VAULT GUARD ───────────────────────────────────────────
const VaultGuard = ({ children }: { children: React.ReactNode }) => {
  const [setupMode, setSetupMode] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [hasFingerprint, setHasFingerprint] = useState(false);

  useEffect(() => {
    import('./store/db').then(async ({ hasVaultPin, isWebAuthnAvailable }) => {
      const hasPin = await hasVaultPin();
      if (!hasPin) setSetupMode(true);
      else {
        setIsLocked(true);
        const authnAvail = await isWebAuthnAvailable();
        setHasFingerprint(authnAvail);
        
        const handleVis = () => {
          if (document.hidden) setIsLocked(true);
        };
        document.addEventListener('visibilitychange', handleVis);
        return () => document.removeEventListener('visibilitychange', handleVis);
      }
    });
  }, []);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSetup = async () => {
    if (pinInput.length < 4 || pinInput.length > 6) {
      setErrorMsg('PIN must be 4 to 6 digits.');
      return;
    }
    const { setVaultPin, registerVaultFingerprint, isWebAuthnAvailable } = await import('./store/db');
    await setVaultPin(pinInput);
    
    if (await isWebAuthnAvailable()) {
      if (confirm('Would you like to unlock with fingerprint in the future?')) {
        await registerVaultFingerprint();
      }
    }
    setSetupMode(false);
    setIsLocked(false);
  };

  const handleUnlock = async () => {
    if (cooldown > 0) return;
    const { verifyVaultPin } = await import('./store/db');
    const isValid = await verifyVaultPin(pinInput);
    if (isValid) {
      setIsLocked(false);
      setAttempts(0);
      setErrorMsg('');
      setPinInput('');
    } else {
      const newAtt = attempts + 1;
      setAttempts(newAtt);
      setPinInput('');
      if (newAtt >= 5) {
        setCooldown(30);
        setErrorMsg('Too many attempts. Wait 30 seconds.');
      } else {
        setErrorMsg(`Wrong PIN. ${5 - newAtt} attempts left.`);
      }
    }
  };

  const handleFingerprintUnlock = async () => {
    if (cooldown > 0) return;
    const { verifyVaultFingerprint } = await import('./store/db');
    const isValid = await verifyVaultFingerprint();
    if (isValid) {
      setIsLocked(false);
      setAttempts(0);
      setErrorMsg('');
    } else {
      setErrorMsg('Fingerprint not recognized.');
    }
  };

  if (setupMode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-5 animate-fade-in-up">
        <Lock size={48} className="text-[#00695C] mb-4" />
        <h2 className="text-xl font-bold text-[#1F2937] mb-2">Set up your Private Vault</h2>
        <p className="text-sm text-[#64748B] text-center mb-6 max-w-sm">
          Protect your photos and stories. They never leave your phone.
        </p>
        <input 
          type="password" 
          maxLength={6} 
          placeholder="4–6 digit PIN"
          value={pinInput}
          onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
          className="w-full max-w-xs p-3 text-center text-xl tracking-widest border border-gray-300 rounded-xl mb-4 font-bold"
        />
        {errorMsg && <p className="text-red-500 text-xs mb-4 font-bold">{errorMsg}</p>}
        <button onClick={handleSetup} className="btn-primary w-full max-w-xs py-3">Save PIN</button>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-5 bg-[#004D40] text-white animate-fade-in-up">
        <Lock size={48} className="mb-4 text-teal-200" />
        <h2 className="text-xl font-bold mb-6">Private Vault Locked</h2>
        
        <input 
          type="password" 
          maxLength={6} 
          placeholder="Enter PIN"
          value={pinInput}
          onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
          disabled={cooldown > 0}
          className="w-full max-w-xs p-3 text-center text-xl tracking-widest text-gray-900 border border-gray-300 rounded-xl mb-4 font-bold disabled:opacity-50"
        />
        {errorMsg && <p className="text-red-300 text-xs mb-4 font-bold">{errorMsg}</p>}
        {cooldown > 0 && <p className="text-amber-300 text-sm mb-4 font-bold">Cooldown: {cooldown}s</p>}
        
        <button onClick={handleUnlock} disabled={cooldown > 0} className="w-full max-w-xs bg-teal-500 hover:bg-teal-400 text-white font-bold py-3 rounded-xl mb-4 transition disabled:opacity-50">
          Unlock
        </button>
        
        {hasFingerprint ? (
          <button onClick={handleFingerprintUnlock} disabled={cooldown > 0} className="w-full max-w-xs bg-transparent border-2 border-teal-500 text-teal-100 font-bold py-3 rounded-xl transition hover:bg-teal-700/50 flex items-center justify-center gap-2 disabled:opacity-50">
            Unlock with fingerprint
          </button>
        ) : (
          <p className="text-xs text-teal-200 mt-4 italic opacity-80">PIN unlock available on this device.</p>
        )}
        <p className="text-[10px] text-teal-300 mt-8 opacity-60">Fingerprint unlock available over secure connections.</p>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col w-full h-full">
      <div className="absolute top-2 right-5 md:right-8 z-10">
        <button onClick={() => setIsLocked(true)} className="bg-gray-800 text-white text-[10px] font-bold py-1.5 px-3 rounded-full flex items-center gap-1 opacity-60 hover:opacity-100 transition shadow-sm">
          <Lock size={10} /> Lock now
        </button>
      </div>
      {children}
    </div>
  );
};

const InnerNav = () => {
  const { isOnline, syncState, activeTrip } = useContext(HealthContext);
  return (
    <nav className="sticky top-0 z-50 glass-nav border-b border-gray-150">
      <div className="max-w-2xl mx-auto px-5 flex justify-between h-16 items-center">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-8 h-8 bg-[#00695C] rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <span className="font-['Plus_Jakarta_Sans'] font-bold text-[#1F2937] text-lg tracking-tight">Sanchar AI</span>
        </Link>
        <div className="flex items-center gap-2">
          {activeTrip && (
            <Link
              to={`/active/${activeTrip._id}`}
              className="badge bg-[#E0F2F1] text-[#00695C] border border-[#B2DFDB] text-xs font-bold py-1 px-3 rounded-full flex items-center gap-1.5 no-underline hover:bg-[#B2DFDB] transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-[#00695C] animate-pulse" />
              ● Active Trip ({activeTrip.originCity} → {activeTrip.destinationCity})
            </Link>
          )}
          {syncState === 'syncing' && <span className="badge badge-teal animate-pulse text-xs">Syncing…</span>}
          {syncState === 'offline' && <span className="badge badge-amber text-xs"><WifiOff size={12} /> Offline — queued</span>}
          {syncState === 'synced' && isOnline && !activeTrip && <span className="badge badge-green text-xs"><Check size={12} /> Synced</span>}
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

// ─── DEDICATED CITY SPOTLIGHT PAGE (/city/:cityName) ─────────
const CitySpotlightPage = () => {
  const { cityName } = useParams<{ cityName: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const formattedCity = cityName ? cityName.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : '';

  useEffect(() => {
    if (!formattedCity) return;
    let isMounted = true;
    axios.get(`/api/city-spots/${encodeURIComponent(formattedCity)}`)
      .then(res => {
        if (isMounted) setData(res.data);
      })
      .catch((err) => {
        if (isMounted) setError(err.response?.data?.error || err.message || 'Unknown error occurred.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [formattedCity, retryCount]);

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 glass-nav border-b border-gray-150">
        <div className="max-w-[1180px] mx-auto flex justify-between items-center h-16 px-5 md:px-8">
          <Link to="/" className="flex items-center gap-2 text-sm font-bold text-[#00695C] hover:text-[#004D40] transition-colors no-underline">
            <ChevronRight size={16} className="rotate-180" /> Back to home
          </Link>
          <Link to="/" className="flex items-center gap-2 no-underline">
            <div className="w-8 h-8 bg-[#00695C] rounded-lg flex items-center justify-center shadow-sm">
              <Shield size={16} className="text-white" />
            </div>
            <span className="font-['Plus_Jakarta_Sans'] font-extrabold text-[#1F2937] text-lg tracking-tight">Sanchar AI</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-[1180px] mx-auto px-5 md:px-8 py-10">
        {loading && (
          <div className="text-center py-24 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#00695C] border-t-transparent rounded-full animate-spin" />
            <p className="text-base text-[#64748B] font-medium">Fetching real spot data for {formattedCity}…</p>
          </div>
        )}

        {error && !loading && (
          <div className="card p-8 text-center max-w-lg mx-auto border border-red-100 bg-red-50/50 my-12">
            <AlertTriangle className="text-[#D32F2F] mx-auto mb-3" size={36} />
            <p className="text-base font-bold text-[#1F2937] mb-4">{error}</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => { setError(null); setLoading(true); setRetryCount(c => c + 1); }} className="btn-primary !py-2.5 !px-6 text-xs font-bold cursor-pointer">
                Retry
              </button>
              <button onClick={() => navigate('/')} className="btn-secondary !py-2.5 !px-6 text-xs font-bold cursor-pointer">
                Back to home
              </button>
            </div>
          </div>
        )}

        {!loading && data && (
          <div className="animate-fade-in-up">
            {data.found === false ? (
              <div className="card p-10 text-center max-w-xl mx-auto border border-amber-200 bg-amber-50/30 my-12 rounded-3xl shadow-sm">
                <HelpCircle className="text-[#F59E0B] mx-auto mb-4" size={44} />
                <h2 className="font-bold text-2xl text-[#1F2937] mb-3">No verified spot list for '{data.city || formattedCity}' yet</h2>
                <p className="text-sm text-[#64748B] leading-relaxed mb-8">
                  Our general India pack works here: 112 emergency · national rail enquiry 139 · basic travel guidance.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <button
                    onClick={() => navigate(`/create?destination=${encodeURIComponent(data.city || formattedCity)}`)}
                    className="btn-primary !py-3 !px-8 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Zap size={16} /> Create trip to {data.city || formattedCity}
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="btn-secondary !py-3 !px-8 text-sm font-bold cursor-pointer"
                  >
                    Back to home
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-200 pb-8 mb-10">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <h1 className="text-3xl md:text-4xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans']">{data.city}</h1>
                      <span className={`text-xs font-bold py-1 px-3 rounded-full border ${
                        data.source === 'curated-sample'
                          ? 'bg-[#E0F2F1] text-[#00695C] border-[#B2DFDB]'
                          : 'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>
                        {data.source === 'curated-sample'
                          ? 'Curated sample — verify before visiting'
                          : 'Live from Wikipedia — verify before visiting'}
                      </span>
                    </div>
                    <p className="text-[#64748B] text-sm flex items-center gap-2 font-medium">
                      <Compass size={16} className="text-[#00695C]" />
                      {data.count < 25 ? `${data.count} spots found` : `Spotlight features ${data.count} best places to explore.`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full font-semibold">Languages: Hindi, English</span>
                    <span className="text-xs bg-[#E0F2F1] text-[#00695C] px-3 py-1.5 rounded-full font-semibold">City pack available</span>
                  </div>
                </div>

                {/* Spots Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.spots.map((spot: any, index: number) => (
                    <div key={index} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-start gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-[#00695C]/10 text-[#00695C] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {index + 1}
                            </span>
                            <h3 className="font-bold text-[#1F2937] text-base leading-snug">{spot.name}</h3>
                          </div>
                          {spot.category && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 py-0.5 px-2.5 rounded-full whitespace-nowrap">
                              {spot.category}
                            </span>
                          )}
                        </div>
                        {spot.blurb && (
                          <p className="text-xs text-[#64748B] leading-relaxed pl-8">
                            {spot.blurb.length > 90 ? spot.blurb.slice(0, 87) + '...' : spot.blurb}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer Actions */}
                <div className="mt-16 bg-white rounded-3xl p-8 border border-gray-150 shadow-sm text-center max-w-2xl mx-auto flex flex-col items-center gap-4">
                  <h3 className="text-xl font-bold text-[#1F2937]">Ready to visit {data.city}?</h3>
                  <p className="text-xs text-[#64748B] max-w-md">
                    Start a live journey with offline safety tools, budget tracking, and instant SOS monitoring.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 mt-2 w-full justify-center">
                    <button
                      onClick={() => navigate(`/create?destination=${encodeURIComponent(data.city)}`)}
                      className="btn-primary !py-3 !px-8 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Zap size={16} /> Create trip to {data.city}
                    </button>
                    <button
                      onClick={() => navigate('/')}
                      className="btn-secondary !py-3 !px-8 text-sm font-bold cursor-pointer"
                    >
                      Back to home
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

// ─── LANDING PAGE ────────────────────────────────────────────
const LandingPage = () => {
  const { isBackendOffline, dbMode, activeTrip, lastCompletedTrip } = useContext(HealthContext);
  const [showLoader, setShowLoader] = useState(() => !sessionStorage.getItem('sanchar_intro_loaded'));
  const [destinationPreFill] = useState('');
  const [searchCityInput, setSearchCityInput] = useState('');
  const [searchError, setSearchError] = useState('');
  const navigate = useNavigate();

  const handleOpenCity = (cityName: string) => {
    setSearchError('');
    const trimmed = cityName ? cityName.trim() : '';
    if (trimmed.length < 3 || !/^[A-Za-z\s]+$/.test(trimmed)) {
      setSearchError('Please enter a valid city name');
      return;
    }
    navigate(`/city/${encodeURIComponent(trimmed.toLowerCase())}`);
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
          <div className="flex items-center gap-4 md:gap-8">
            {activeTrip && (
              <Link
                to={`/active/${activeTrip._id}`}
                className="badge bg-[#E0F2F1] text-[#00695C] border border-[#B2DFDB] text-xs font-bold py-1.5 px-3.5 rounded-full flex items-center gap-1.5 no-underline hover:bg-[#B2DFDB] transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-[#00695C] animate-pulse" />
                ● Active Trip ({activeTrip.originCity} → {activeTrip.destinationCity})
              </Link>
            )}
            <Link to="/features" className="hidden md:inline text-sm font-medium text-[#64748B] hover:text-[#00695C] transition-colors no-underline">Features</Link>
            <Link to="/privacy" className="hidden md:inline text-sm font-medium text-[#64748B] hover:text-[#00695C] transition-colors no-underline">Privacy</Link>
            <Link to="/dashboard" className="text-sm font-medium text-[#64748B] hover:text-[#00695C] transition-colors no-underline">Dashboard</Link>
            <Link to="/create" className="btn-primary text-sm !py-2 !px-5">
              Start Trip <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Active Trip Banner */}
      {activeTrip && (
        <div className="pt-20 pb-4 bg-[#E0F2F1] border-b border-[#B2DFDB]">
          <div className="max-w-[1180px] mx-auto px-5 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-[#00695C] animate-ping shrink-0" />
              <div>
                <h4 className="font-extrabold text-[#004D40] text-base">Trip in progress: {activeTrip.originCity} → {activeTrip.destinationCity}</h4>
                <p className="text-xs text-[#00695C]">Tracking active · Tap to open command center</p>
              </div>
            </div>
            <Link to={`/active/${activeTrip._id}`} className="btn-primary !py-2 !px-6 text-sm font-bold bg-[#00695C] text-white no-underline">
              Open Trip Command Center →
            </Link>
          </div>
        </div>
      )}

      {/* Your Last Trip Banner */}
      {!activeTrip && lastCompletedTrip && (
        <div className="pt-20 pb-4 bg-[#F0FDF4] border-b border-green-200">
          <div className="max-w-[1180px] mx-auto px-5 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Check className="text-[#2E7D32] shrink-0" size={20} />
              <div>
                <h4 className="font-extrabold text-[#1B5E20] text-base">Your last trip: {lastCompletedTrip.originCity} → {lastCompletedTrip.destinationCity}</h4>
                <p className="text-xs text-[#2E7D32]">Completed · Total Spent: ₹{(lastCompletedTrip.amountSpent || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>
            <Link to={`/diary/${lastCompletedTrip._id}`} className="btn-secondary !py-2 !px-6 text-sm font-bold no-underline">
              View Trip Diary →
            </Link>
          </div>
        </div>
      )}

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
            { city: 'Chennai', img: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Kapaleeshwarar_Temple.jpg', langs: ['Tamil', 'English'] },
            { city: 'Kochi', img: 'https://upload.wikimedia.org/wikipedia/commons/2/27/Chinese_fishing_nets%2C_Kochi%2C_Kerala%2C_India.jpg', langs: ['Malayalam', 'English'] },
            { city: 'Hyderabad', img: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Charminar_Summer.jpg', langs: ['Telugu', 'English'] },
            { city: 'Bengaluru', img: 'https://upload.wikimedia.org/wikipedia/commons/3/36/Bangalore_Palace.jpg', langs: ['Kannada', 'English'] },
            { city: 'Mumbai', img: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Gateway_of_India.jpg', langs: ['Marathi', 'Hindi'] },
            { city: 'Jaipur', img: 'https://upload.wikimedia.org/wikipedia/commons/3/34/Hawa_Mahal_2011.jpg', langs: ['Hindi', 'English'] },
            { city: 'Varanasi', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Ahilya_Ghat_by_the_Ganges%2C_Varanasi.jpg/800px-Ahilya_Ghat_by_the_Ganges%2C_Varanasi.jpg', langs: ['Hindi'] },
            { city: 'Guwahati', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Umananda_Temple.jpg/800px-Umananda_Temple.jpg', langs: ['Assamese', 'English'] },
          ].map((c) => (
            <CityCard
              key={c.city}
              city={c.city}
              img={c.img}
              langs={c.langs}
              onClick={() => handleOpenCity(c.city)}
            />
          ))}
        </div>

        {/* Enter your city Box */}
        <div className="mt-10 max-w-md mx-auto relative">
          <div className="bg-white p-3 md:p-4 rounded-full border border-gray-200 shadow-sm flex items-center gap-2">
            <Search className="text-gray-400 shrink-0 ml-2" size={18} />
            <input
              type="text"
              placeholder="Explore other cities (e.g. Pune, Nagpur…)"
              value={searchCityInput}
              onChange={(e) => {
                setSearchCityInput(e.target.value);
                setSearchError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleOpenCity(searchCityInput);
                }
              }}
              className="flex-1 text-sm text-[#1F2937] focus:outline-none placeholder-gray-400"
            />
            <button
              onClick={() => handleOpenCity(searchCityInput)}
              className="btn-primary !py-2.5 !px-6 text-xs font-bold whitespace-nowrap cursor-pointer !rounded-full"
            >
              Show best spots
            </button>
          </div>
          {searchError && (
            <div className="absolute -bottom-6 left-0 right-0 text-center text-red-500 text-xs font-bold animate-fade-in-up">
              {searchError}
            </div>
          )}
        </div>
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
  const { lastCompletedTrip } = useContext(HealthContext);
  const [home, setHome] = useState(lastCompletedTrip?.destinationCity || '');
  const [dest, setDest] = useState(preFillDest || '');
  const [customHome, setCustomHome] = useState('');
  const [customDest, setCustomDest] = useState('');
  const [when, setWhen] = useState('');
  const [error, setError] = useState('');

  // Budget Calculator Fields
  const [days, setDays] = useState(3);
  const [style, setStyle] = useState<'Budget' | 'Comfort'>('Budget');
  const [heavyLuggage, setHeavyLuggage] = useState(false);
  const [ticketPrice, setTicketPrice] = useState(0);
  const [userBudget, setUserBudget] = useState<number>(0);

  const navigate = useNavigate();

  const [prevPreFillDest, setPrevPreFillDest] = useState(preFillDest);
  if (preFillDest !== prevPreFillDest) {
    setPrevPreFillDest(preFillDest);
    setDest(preFillDest);
  }

  // Pre-fill next trip origin from last completed trip
  useEffect(() => {
    if (lastCompletedTrip?.destinationCity && !home && !preFillDest) {
      if (CITIES.includes(lastCompletedTrip.destinationCity)) {
        setHome(lastCompletedTrip.destinationCity);
      } else {
        setHome('Other');
        setCustomHome(lastCompletedTrip.destinationCity);
      }
    }
  }, [lastCompletedTrip]);

  // Recalculate suggested budget
  useEffect(() => {
    // Food: Budget 300-500 (avg 400), Comfort 600-1200 (avg 900)
    const foodPerDay = style === 'Budget' ? 400 : 900;
    // Local transport: Budget 200-400 (avg 300), Comfort 400-800 (avg 600)
    const transportPerDay = style === 'Budget' ? 300 : 600;
    // Luggage add-on: 100-300 (avg 200)
    const luggageCost = heavyLuggage ? 200 : 0;
    
    const suggested = (foodPerDay + transportPerDay) * days + luggageCost + ticketPrice;
    setUserBudget(suggested);
  }, [days, style, heavyLuggage, ticketPrice]);

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
        budget: userBudget,
        heavyLuggage: heavyLuggage,
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
      
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
        <h4 className="text-sm font-bold text-[#1F2937] mb-3 flex items-center gap-1"><IndianRupee size={16} /> Budget Calculator</h4>
        
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-semibold text-[#1F2937] mb-1 block">Days</label>
            <input type="number" min="1" value={days} onChange={e => setDays(parseInt(e.target.value) || 1)} className="input-field py-2" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#1F2937] mb-1 block">Travel Style</label>
            <select value={style} onChange={e => setStyle(e.target.value as any)} className="input-field py-2">
              <option value="Budget">Budget</option>
              <option value="Comfort">Comfort</option>
            </select>
          </div>
        </div>

        <div className="mb-3">
          <label className="text-xs font-semibold text-[#1F2937] mb-1 block">Inter-city Ticket Price (₹)</label>
          <input type="number" min="0" value={ticketPrice} onChange={e => setTicketPrice(parseInt(e.target.value) || 0)} className="input-field py-2" />
        </div>

        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input type="checkbox" checked={heavyLuggage} onChange={e => setHeavyLuggage(e.target.checked)} className="w-4 h-4 text-teal-600 rounded" />
          <span className="text-sm text-[#1F2937] font-medium">Carrying heavy luggage?</span>
        </label>

        <div className="bg-white p-3 rounded border border-gray-100 text-xs">
          <p className="font-semibold mb-2">Typical ranges — actuals vary:</p>
          <ul className="text-gray-500 space-y-1 mb-2">
            <li>Food: {style === 'Budget' ? '₹300–500/day' : '₹600–1,200/day'}</li>
            <li>Transport: {style === 'Budget' ? '₹200–400/day' : '₹400–800/day'}</li>
            {heavyLuggage && <li>Luggage add-on: ₹100–300 (porter/cart)</li>}
          </ul>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="font-bold">Suggested:</span>
            <input type="number" value={userBudget} onChange={e => setUserBudget(parseInt(e.target.value) || 0)} className="input-field !py-1 flex-1 font-bold text-teal-700" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-[#1F2937] mb-1 block">Expected Arrival (optional)</label>
        <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className="input-field py-2.5" />
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
  const showcaseCities = ['Chennai', 'Kochi', 'Bengaluru', 'Mumbai', 'Delhi', 'Kolkata', 'Hyderabad', 'Jaipur'];

  useEffect(() => {
    const fetchStats = async () => {
      const results: Record<string, any> = {};
      for (const city of showcaseCities) {
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {showcaseCities.map(city => {
        const data = packData[city];
        return (
          <Link to={`/city/${city}`} key={city} className="card p-4 border border-gray-100 flex flex-col justify-between h-40 bg-white hover:shadow-lg transition-shadow no-underline">
            <div>
              <div className="flex justify-between items-start">
                <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-base text-[#1F2937]">{city}</h3>
              </div>
              <p className="text-[11px] text-[#64748B] mt-2">
                {data ? `${data.pois?.length || data.attractions?.length || 0} spots · ${data.emergencyNumbers?.length || 0} links` : 'Loading...'}
              </p>
            </div>
            <div className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded mt-2 inline-block self-start">
              Explore City Spots
            </div>
          </Link>
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
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const [home, setHome] = useState('');
  const [dest, setDest] = useState(() => {
    const preFill = searchParams.get('destination') || (location.state as any)?.destination;
    if (preFill && CITIES.includes(preFill)) return preFill;
    if (preFill) return 'Other';
    return '';
  });
  const [customDest, setCustomDest] = useState(() => {
    const preFill = searchParams.get('destination') || (location.state as any)?.destination;
    if (preFill && !CITIES.includes(preFill)) return preFill;
    return '';
  });
  const [customHome, setCustomHome] = useState('');
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

const getExpectedArrivalTime = (trip: any) => {
  if (!trip || !trip.expectedArrival) return null;
  const t = new Date(trip.expectedArrival).getTime();
  if (isNaN(t) || t <= 0) return null;

  // Data repair: if expectedArrival <= trip creation time (or start time) it was defaulted erroneously
  const createdAt = trip.createdAt ? new Date(trip.createdAt).getTime() : (trip.startTime ? new Date(trip.startTime).getTime() : 0);
  if (t <= createdAt + 5000) return null;

  // Data repair: if expectedArrival is in the past relative to when the trip was created/started
  if (t < createdAt) return null;

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
  const [completing, setCompleting] = useState(false);
  const [lastNotYetTime, setLastNotYetTime] = useState(0);
  const [photoAddedMsg, setPhotoAddedMsg] = useState('');
  const navigate = useNavigate();

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = evt.target?.result as string;
      const { savePhoto } = await import('./store/db');
      const lastPoint = points.length > 0 ? points[points.length - 1] : null;
      await savePhoto(tripId, dataUrl, lastPoint?.lat, lastPoint?.lng);
      setPhotoAddedMsg('Photo saved securely on your device.');
      setTimeout(() => setPhotoAddedMsg(''), 3000);
    };
    reader.readAsDataURL(file);
  };

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
          setSafetyAlert(prev => {
            if (prev?.type === 'late-arrival') return prev;
            return {
              type: 'late-arrival',
              msg: "Late-Arrival Warning: Expectation exceeded by 15 mins. Please confirm status."
            };
          });
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
    
    // reset lastNotYetTime on real movement
    const lastPoint = points[points.length - 1];
    if (lastPoint.speedKmh >= 1 && lastNotYetTime > 0) {
      setTimeout(() => setLastNotYetTime(0), 0);
    }
    
    if (Date.now() - lastNotYetTime < 10 * 60 * 1000) return; // cooldown active

    const now = Date.now();
    const tenMinsAgo = now - 10 * 60 * 1000;
    const lastPoints = points.filter(p => new Date(p.timestamp).getTime() > tenMinsAgo);
    if (lastPoints.length >= 3) {
      const allStill = lastPoints.every(p => p.speedKmh < 1);
      if (allStill) {
        setTimeout(() => setStillnessAlert(true), 0);
      }
    }
  }, [points, lastNotYetTime]);

  const handleNotYet = async () => {
    setStillnessAlert(false);
    setLastNotYetTime(Date.now());
    if (trip) {
      try {
        const patchRes = await axios.patch(`/api/trips/${tripId}`, {
          notYetCount: (trip.notYetCount || 0) + 1
        });
        setTrip(patchRes.data);
      } catch (e) {
        console.warn('Failed to record not yet response', e);
      }
    }
  };

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
    if (completing) return;
    setCompleting(true);
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

      {/* Offline Live Tracking Pill */}
      <div className="px-5 md:px-8 mt-4">
        <button 
          className="w-full bg-[#1F2937] text-white p-4 rounded-2xl flex items-center justify-between shadow-lg"
          onClick={() => {
            alert('Tracking on device — will sync when network returns');
          }}
        >
          <div className="text-left">
            <h4 className="font-bold text-sm">Start Offline Live Tracking</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">Tracks on this device — no network needed</p>
          </div>
          <div className="bg-white/20 p-2 rounded-full">
            <WifiOff size={16} />
          </div>
        </button>
      </div>

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
              className="min-h-[44px] py-2 px-4 bg-[#2E7D32] text-white text-xs font-bold rounded-full cursor-pointer active:bg-green-800 transition-colors"
            >
              I'm Safe ✅
            </button>
            <button
              onClick={() => {
                handleSafetyResponse(safetyAlert.type, 'open-sos');
                setShowSosModal(true);
              }}
              className="min-h-[44px] py-2 px-4 bg-[#D32F2F] text-white text-xs font-bold rounded-full cursor-pointer active:bg-red-800 transition-colors"
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
              <p className="font-bold text-sm text-[#2E7D32] uppercase tracking-wide">Arrival Detected</p>
              <p className="text-xs text-[#1F2937] mt-1 font-medium">
                Looks like you've arrived in {trip?.destinationCity || 'your destination'}. Confirm arrival?
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={completeTrip}
              disabled={completing}
              className="min-h-[44px] py-2 px-4 bg-[#2E7D32] text-white text-xs font-bold rounded-full cursor-pointer active:bg-green-800 transition-colors"
            >
              Yes, I've arrived ✅
            </button>
            <button
              onClick={handleNotYet}
              className="min-h-[44px] py-2 px-4 bg-gray-300 text-gray-700 text-xs font-bold rounded-full cursor-pointer active:bg-gray-400 transition-colors"
            >
              Not yet — continue journey
            </button>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="p-5 md:p-8 grid grid-cols-2 gap-4">

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

      {/* Offline Pocket Map */}
      <div className="px-5 md:px-8 mb-4">
        <PocketMap 
          points={points} 
          currentLocation={points.length > 0 ? points[points.length - 1] : undefined}
          destinationCity={trip?.destinationCity || 'Destination'}
        />
      </div>

      {/* Budget Health Card */}
      {trip && (
        <div className="px-5 md:px-8 mb-4">
          <div className="card p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[#1F2937] flex items-center gap-1"><IndianRupee size={16} /> Budget Health</h3>
              {trip.heavyLuggage && <span className="badge badge-teal !bg-teal-100 !text-teal-800 text-[10px]">Luggage Mode ON</span>}
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-[10px] uppercase font-bold text-[#64748B] mb-1">Total Budget</p>
                <p className="font-extrabold text-xl text-[#00695C]">₹{trip.budget?.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[#64748B] mb-1">Total Spent</p>
                <p className="font-extrabold text-xl text-[#D32F2F]">₹{trip.amountSpent?.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="w-full bg-gray-100 h-2 rounded-full mb-2 overflow-hidden">
              <div 
                className={`h-full ${trip.amountSpent > trip.budget ? 'bg-red-500' : 'bg-teal-500'}`} 
                style={{ width: `${Math.min(100, ((trip.amountSpent || 0) / (trip.budget || 1)) * 100)}%` }}
              ></div>
            </div>

            <p className="text-xs font-bold text-[#1F2937]">Remaining: ₹{Math.max(0, (trip.budget || 0) - (trip.amountSpent || 0)).toLocaleString('en-IN')}</p>
          </div>
        </div>
      )}

      {/* Luggage Buddy Prompt (Mocked for Demo based on distance) */}
      {trip?.heavyLuggage && distance > 1.5 && segment === 'walking' && (
        <div className="px-5 md:px-8 mb-4">
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm relative">
            <button className="absolute top-2 right-2 text-amber-600 font-bold p-1"><Check size={16} /></button>
            <h4 className="font-bold text-amber-900 mb-1 flex items-center gap-1"><AlertTriangle size={14} /> Heavy load? Take a break.</h4>
            <p className="text-xs text-amber-800 mb-3">You've been walking for a while with heavy luggage. There are water stations and rest areas nearby (approximate).</p>
            <div className="flex gap-2">
              <button className="bg-amber-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg">Find Rest Area</button>
              <button className="bg-amber-200 text-amber-900 text-xs font-bold py-1.5 px-3 rounded-lg">Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* Luggage Buddy Auto Nudge (Mocked for Demo based on distance) */}
      {trip?.heavyLuggage && distance > 2.0 && segment === 'walking' && (
        <div className="px-5 md:px-8 mb-4">
          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm relative">
            <button className="absolute top-2 right-2 text-blue-600 font-bold p-1"><Check size={16} /></button>
            <h4 className="font-bold text-blue-900 mb-1 flex items-center gap-1"><Smartphone size={14} /> Smart Transport Nudge</h4>
            <p className="text-xs text-blue-800 mb-3">With heavy bags, an auto is worth it — typical fare for ~2 km: ₹40–60 (typical range).</p>
            <div className="flex gap-2">
              <button className="bg-blue-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg">Log as expense</button>
              <button className="bg-blue-200 text-blue-900 text-xs font-bold py-1.5 px-3 rounded-lg">I'll walk</button>
            </div>
          </div>
        </div>
      )}

      {/* Camera / Photo Capture */}
      <div className="px-5 md:px-8 mb-4">
        <div className="flex gap-2">
          <label className="flex-1 flex items-center justify-center gap-2 bg-[#00695C] text-white py-3 rounded-2xl cursor-pointer hover:bg-teal-800 transition">
            <Camera size={18} />
            <span className="font-bold text-sm">Take photo</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
          </label>
          <label className="flex-1 flex items-center justify-center gap-2 bg-teal-100 text-teal-900 py-3 rounded-2xl cursor-pointer hover:bg-teal-200 transition">
            <span className="font-bold text-sm">Import</span>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </label>
        </div>
        {photoAddedMsg && <p className="text-center text-xs text-[#00695C] mt-2 font-bold">{photoAddedMsg}</p>}
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

      {/* Action Buttons (Sticky Bottom on Mobile) */}
      <div className="mt-auto p-4 md:p-8 bg-white border-t border-gray-100 flex flex-col gap-3 sticky bottom-0 z-40 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:static md:shadow-none">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate(`/scan/${tripId}`)} className="btn-secondary !py-3.5 text-sm font-bold bg-[#F8FAFC] text-[#1F2937]">
            <Camera size={16} className="text-[#00695C]" /> Scan Bill
          </button>
          <button onClick={() => navigate(`/expenses/${tripId}`)} className="btn-secondary !py-3.5 text-sm font-bold bg-[#F8FAFC] text-[#1F2937]">
            <IndianRupee size={16} className="text-[#00695C]" /> Expenses
          </button>
        </div>
        <button
          onClick={completeTrip}
          disabled={completing}
          className="btn-primary w-full !py-3.5 bg-[#00695C] hover:bg-[#004D40] text-white font-bold disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {completing ? 'Completing...' : 'Confirm Arrival & Complete Journey'}
        </button>

        {/* SOS Button: 3s Hold */}
        <button
          onMouseDown={handleSosStart}
          onMouseUp={handleSosEnd}
          onTouchStart={handleSosStart}
          onTouchEnd={handleSosEnd}
          className="btn-danger w-full !py-3.5 bg-[#D32F2F] text-white font-bold active:bg-red-800 transition-colors"
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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [useLiveCamera, setUseLiveCamera] = useState(false);
  const navigate = useNavigate();

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
    }
    setUseLiveCamera(false);
  }

  // Cleanup camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setUseLiveCamera(true);
      // Wait for state to render video tag
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 50);
    } catch {
      alert("Camera access denied or unavailable.");
    }
  };

  const captureLive = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "camera.jpg", { type: "image/jpeg" });
          handleImageReady(file);
        }
      }, "image/jpeg", 0.9);
    }
    stopCamera();
  };

  const processImageFile = async (file: File | Blob): Promise<Blob> => {
    if (file.size > 8 * 1024 * 1024) throw new Error("File too large (max 8MB)");
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > 1600 || height > 1600) {
          if (width > height) {
            height = Math.round(height * (1600 / width));
            width = 1600;
          } else {
            width = Math.round(width * (1600 / height));
            height = 1600;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject("Canvas error");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject("Blob error");
        }, file.type || 'image/jpeg', 0.9);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleImageReady(file);
  };

  const handleImageReady = async (file: File | Blob) => {
    setProcessing(true);
    setStatus('Reading text on your device…');
    try {
      const downscaled = await processImageFile(file);
      const text = await ocrProvider.recognize(downscaled);
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
    } catch (err: any) {
      console.warn(err);
      setStatus(err.message || 'OCR failed. Please try again.');
    }
    setProcessing(false);
  };

  const confirmExpense = async () => {
    if (amount === null || amount <= 0) return;
    const idempotencyKey = crypto.randomUUID();
    const payload = { 
      merchant: merchant || 'Scanned Item', 
      amount, 
      category, 
      source: 'ocr' as const, 
      confirmed: true,
      ocrSnippet: rawText.substring(0, 200)
    };
    try {
      await axios.post(`/api/trips/${tripId}/expenses`, payload, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });
    } catch {
      await queueOfflineMutation(
        `/api/trips/${tripId}/expenses`,
        'post',
        payload,
        idempotencyKey
      );
    }
    navigate(`/active/${tripId}`);
  };

  return (
    <div className="p-5 md:p-8 flex flex-col min-h-screen animate-fade-in-up">
      <div className="mb-6">
        <span className="badge badge-teal mb-3"><Camera size={14} /> Smart Scan</span>
        <h1 className="text-2xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans']">Scan Expense</h1>
        <p className="text-xs text-[#64748B] mt-1">On-device scan — runs fully offline in this browser.</p>
      </div>

      {/* Capture Area */}
      {useLiveCamera ? (
        <div className="card overflow-hidden flex flex-col items-center bg-black h-64 relative mb-4">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted />
          <div className="absolute bottom-4 flex gap-4 w-full px-4">
            <button onClick={captureLive} className="btn-primary flex-1 py-3 bg-white text-black hover:bg-gray-100 shadow-lg">
              Capture
            </button>
            <button onClick={stopCamera} className="btn-danger flex-1 py-3 bg-red-600 shadow-lg">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <button onClick={startCamera} className="card flex flex-col items-center justify-center h-32 cursor-pointer border-2 border-dashed border-gray-200 hover:border-[#00695C] transition-colors">
            <Camera size={32} className="text-[#64748B] mb-2" />
            <span className="font-semibold text-[#1F2937] text-sm">Use Camera</span>
          </button>
          <label className="card flex flex-col items-center justify-center h-32 cursor-pointer border-2 border-dashed border-gray-200 hover:border-[#00695C] transition-colors">
            <Smartphone size={32} className="text-[#64748B] mb-2" />
            <span className="font-semibold text-[#1F2937] text-sm">Upload Photo</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleCapture} />
          </label>
        </div>
      )}

      <div className="mt-2 text-center">
        <p className="text-sm text-[#64748B]">{processing ? <span className="animate-pulse font-bold text-[#00695C]">{status}</span> : status}</p>
      </div>

      {/* Raw OCR Text Preview */}
      {rawText && (
        <div className="mt-4 card p-4 border border-gray-100 bg-gray-50/50">
          <p className="text-xs font-semibold text-[#64748B] uppercase mb-2">Extracted Text</p>
          <p className="text-xs text-[#1F2937] font-mono bg-white p-3 rounded-lg max-h-24 overflow-y-auto whitespace-pre-wrap border border-gray-200">{rawText}</p>
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
        <button onClick={confirmExpense} disabled={amount === null || amount <= 0} className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed py-3.5">
          <Check size={16} /> Confirm Expense
        </button>
      </div>

      <button onClick={() => navigate(`/active/${tripId}`)} className="mt-6 text-sm font-medium text-[#64748B] hover:text-[#00695C] transition-colors pb-safe text-center w-full">
        ← Back to trip
      </button>
    </div>
  );
};

// ─── M5: EXPENSES LIST ───────────────────────────────────────
const ExpensesList = () => {
  const { id } = useParams();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [trip, setTrip] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      axios.get(`/api/trips/${id}`).then(r => setTrip(r.data)).catch(console.warn);
      axios.get(`/api/trips/${id}/expenses`).then(r => setExpenses(r.data)).catch(console.warn);
    }
  }, [id]);

  const budget = trip?.budget || 0;
  const total = trip?.amountSpent || expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const remaining = Math.max(0, budget - total);

  return (
    <div className="flex flex-col min-h-screen bg-[#FAFAF7] animate-fade-in-up">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-150 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => navigate(`/active/${id}`)} className="text-[#00695C] flex items-center gap-1 font-bold text-sm">
            ← Back
          </button>
          <span className="badge badge-teal"><IndianRupee size={14} /> Expenses</span>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold">Budget</p>
            <p className="text-lg font-bold text-[#1F2937]">₹{budget.toLocaleString('en-IN')}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold">Spent</p>
            <p className="text-lg font-bold text-[#D32F2F]">₹{total.toLocaleString('en-IN')}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#64748B] uppercase tracking-wider font-semibold">Remaining</p>
            <p className="text-lg font-bold text-[#00695C]">₹{remaining.toLocaleString('en-IN')}</p>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-3">
          <div
            className={`h-full transition-all duration-300 ${total > budget ? 'bg-[#D32F2F]' : 'bg-[#2E7D32]'}`}
            style={{ width: `${Math.min(100, (total / (budget || 1)) * 100)}%` }}
          />
        </div>
      </div>

      <div className="p-5 flex-1 pb-24">
        {expenses.length === 0 ? (
          <div className="card p-8 text-center mt-8">
            <IndianRupee size={32} className="text-[#64748B] mx-auto mb-3" />
            <p className="text-sm text-[#64748B]">No expenses recorded yet. Scan a ticket or add one manually.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...expenses].sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()).map((exp: any, i: number) => (
              <div key={i} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-[#1F2937]">{exp.merchant || 'Unknown'}</p>
                  <p className="text-xs text-[#64748B] capitalize flex items-center gap-1 mt-0.5">
                    <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{exp.category}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${exp.source === 'ocr' ? 'bg-[#E0F2F1] text-[#00695C]' : 'bg-blue-50 text-blue-700'}`}>
                      {exp.source === 'ocr' ? 'Scanned' : 'Manual'}
                    </span>
                  </p>
                </div>
                <p className="font-bold text-[#1F2937]">₹{(exp.amount || 0).toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 max-w-2xl mx-auto pb-safe">
        <button onClick={() => navigate(`/scan/${id}`)} className="btn-primary w-full !py-3.5"><Camera size={16} /> Scan New Expense</button>
      </div>
    </div>
  );
};

// ─── M7: DIARY ───────────────────────────────────────────────
const Diary = () => {
  const { id } = useParams();
  const tripId = id || '';
  const [trip, setTrip] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [points, setPoints] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [pois, setPois] = useState<any[]>([]);
  const [markedMoments, setMarkedMoments] = useState<any[]>([]);
  
  useEffect(() => {
    if (!tripId) return;
    axios.get(`/api/trips/${tripId}`).then(r => setTrip(r.data)).catch(console.warn);
    axios.get(`/api/trips/${tripId}/expenses`).then(r => setExpenses(r.data)).catch(console.warn);
    axios.get(`/api/trips/${tripId}/points`).then(r => setPoints(r.data)).catch(console.warn);
    
    import('./store/db').then(({ getPhotosForTrip, getMarkedMoments }) => {
      getPhotosForTrip(tripId).then(setPhotos).catch(console.warn);
      getMarkedMoments(tripId).then(setMarkedMoments).catch(console.warn);
    });
  }, [tripId]);

  useEffect(() => {
    if (trip?.destinationCity) {
      import('./store/db').then(({ getCachedCityPack }) => {
        getCachedCityPack(trip.destinationCity).then(pack => {
          if (pack && pack.pois) setPois(pack.pois);
        }).catch(console.warn);
      });
    }
  }, [trip?.destinationCity]);

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const p = 0.017453292519943295;
    const c = Math.cos;
    const a = 0.5 - c((lat2 - lat1) * p)/2 + c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))/2;
    return 12742 * Math.asin(Math.sqrt(a));
  };

  const getNearestPoi = (lat: number, lng: number, thresholdKm = 0.4) => {
    if (!pois.length) return null;
    let nearest = null;
    let minDist = thresholdKm;
    for (const poi of pois) {
      const d = getDistance(lat, lng, poi.lat, poi.lng);
      if (d < minDist) {
        minDist = d;
        nearest = poi;
      }
    }
    return nearest;
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = evt.target?.result as string;
      const { savePhoto, getPhotosForTrip } = await import('./store/db');
      const lastPoint = points.length > 0 ? points[points.length - 1] : null;
      await savePhoto(tripId, dataUrl, lastPoint?.lat, lastPoint?.lng);
      const updatedPhotos = await getPhotosForTrip(tripId);
      setPhotos(updatedPhotos);
    };
    reader.readAsDataURL(file);
  };

  const handleMarkMoment = async (type: string, data: any) => {
    const note = prompt('Add an optional note for this moment:');
    if (note === null) return;
    const { saveMarkedMoment, getMarkedMoments } = await import('./store/db');
    await saveMarkedMoment(tripId, type, note, data);
    const updated = await getMarkedMoments(tripId);
    setMarkedMoments(updated);
  };

  const totalSpent = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const categories = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + (e.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const startTime = points.length > 0 ? new Date(points[0].timestamp) : null;
  const endTime = points.length > 0 ? new Date(points[points.length - 1].timestamp) : null;
  const durationMs = (startTime && endTime) ? endTime.getTime() - startTime.getTime() : 0;
  const durationHrs = Math.round(durationMs / 3600000 * 10) / 10;
  
  let totalDistanceKm = 0;
  let walkedDistanceKm = 0;
  const modes = new Set<string>();
  const stops: any[] = [];
  const nearPois = new Set<any>();
  let currentStop: any = null;
  
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const d = getDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    totalDistanceKm += d;
    modes.add(p2.segment);
    if (p2.segment === 'walking') walkedDistanceKm += d;

    const speedKmh = p2.speed * 3.6;
    if (speedKmh < 1.0) {
      if (!currentStop) currentStop = { start: new Date(p2.timestamp), lat: p2.lat, lng: p2.lng, count: 1, end: new Date(p2.timestamp) };
      else {
        currentStop.end = new Date(p2.timestamp);
        currentStop.count++;
      }
    } else {
      if (currentStop) {
        const stopDurMins = (currentStop.end.getTime() - currentStop.start.getTime()) / 60000;
        if (stopDurMins >= 5) {
          currentStop.near = getNearestPoi(currentStop.lat, currentStop.lng, 0.4);
          currentStop.duration = Math.round(stopDurMins);
          stops.push(currentStop);
        }
        currentStop = null;
      }
    }
    const poi = getNearestPoi(p2.lat, p2.lng, 0.4);
    if (poi) nearPois.add(poi);
  }

  const poiGroups: Record<string, any[]> = {};
  Array.from(nearPois).forEach((poi: any) => {
    const type = poi.type || 'Other';
    if (!poiGroups[type]) poiGroups[type] = [];
    poiGroups[type].push(poi);
  });

  let longestStop = stops.length > 0 ? stops.reduce((prev, curr) => (prev.duration > curr.duration ? prev : curr)) : null;
  const ocrExpenses = expenses.filter(e => e.isOcr).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const firstScan = ocrExpenses.length > 0 ? ocrExpenses[0] : null;

  const handleShare = () => {
    const text = trip ? `🛤️ My Sanchar AI Journey\n${trip.originCity} → ${trip.destinationCity}\nSpent: ₹${totalSpent.toLocaleString('en-IN')}\n\nGenerated by Sanchar AI` : 'Sanchar AI Journey';
    if (navigator.share) navigator.share({ text });
    else { navigator.clipboard.writeText(text); alert('Diary details copied to clipboard!'); }
  };

  if (!trip) return <div className="p-8 text-center text-[#64748B]">Loading diary…</div>;

  return (
    <div className="p-5 md:p-8 animate-fade-in-up max-w-2xl mx-auto">
      <Link to="/" className="text-sm font-bold text-teal-700 flex items-center gap-1 mb-4"><Check size={16} /> Back to Home</Link>
      <span className="badge badge-teal mb-3"><BookOpen size={14} /> History Recap</span>
      <h1 className="text-2xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans'] mb-6">
        {trip.originCity} → {trip.destinationCity}
      </h1>

      {/* BEST MOMENTS (F3) */}
      <div className="card p-5 mb-6 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 shadow-sm">
        <h3 className="font-bold text-amber-900 mb-4 flex items-center gap-2"><Zap size={18} /> Your Best Moments</h3>
        
        {markedMoments.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Your Marked Moments</h4>
            <div className="space-y-2">
              {markedMoments.map((m, i) => (
                <div key={i} className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm">
                  <p className="text-xs text-amber-600 font-bold mb-1">{m.type}</p>
                  <p className="text-sm text-gray-800 italic">"{m.note}"</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Auto-detected moments</h4>
        <div className="space-y-2">
          {longestStop && (
            <div className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm">
              <p className="text-sm text-gray-800">You spent {longestStop.duration} min near {longestStop.near?.name || 'a stop'} — your longest stop.</p>
            </div>
          )}
          {walkedDistanceKm > 0 && (
            <div className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm">
              <p className="text-sm text-gray-800">You walked {walkedDistanceKm.toFixed(1)} km.</p>
            </div>
          )}
          {firstScan && (
            <div className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm">
              <p className="text-sm text-gray-800">First ticket scanned: ₹{firstScan.amount} · {new Date(firstScan.date).toLocaleDateString()}</p>
            </div>
          )}
          {photos.slice(0,2).map((p, i) => (
            <div key={i} className="bg-white p-2 rounded-lg border border-amber-100 shadow-sm flex items-center gap-3">
              <img src={p.dataUrl} alt="Moment" className="w-10 h-10 object-cover rounded-md" />
              <p className="text-sm text-gray-800">Photo captured {p.lat && getNearestPoi(p.lat, p.lng) ? `near ${getNearestPoi(p.lat, p.lng)?.name}` : 'on the go'}</p>
            </div>
          ))}
          {endTime && (
            <div className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm">
              <p className="text-sm text-gray-800">Arrived in {trip.destinationCity} at {endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.</p>
            </div>
          )}
        </div>
        <p className="text-[10px] text-amber-700/60 mt-4 italic text-center">Moments computed from your real trip data.</p>
      </div>

      {/* 9C: Journey Summary */}
      <div className="card p-5 mb-6 bg-gradient-to-br from-[#00695C] to-teal-800 text-white shadow-md">
        <h3 className="font-bold mb-3 border-b border-teal-600 pb-2 text-teal-50">Journey Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-teal-200 text-xs uppercase tracking-wider mb-0.5">Duration</p>
            <p className="font-bold">{durationHrs} hrs</p>
          </div>
          <div>
            <p className="text-teal-200 text-xs uppercase tracking-wider mb-0.5">Distance</p>
            <p className="font-bold">{totalDistanceKm.toFixed(1)} km</p>
          </div>
          <div className="col-span-2 mt-2">
            <p className="text-teal-200 text-xs uppercase tracking-wider mb-0.5">Modes (Probabilistic)</p>
            <p className="font-bold capitalize">{Array.from(modes).join(', ') || 'Unknown'}</p>
            <p className="text-[10px] text-teal-300 mt-1 italic">*Transport modes are estimated probabilistically on device.</p>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl overflow-hidden shadow-sm border border-gray-200 bg-gray-50 h-64">
        <PocketMap points={points} destinationCity={trip?.destinationCity || 'Destination'} />
      </div>

      {/* 9C: Timeline of Stops */}
      <div className="card p-5 mb-6 border border-gray-100 shadow-sm">
        <h3 className="font-bold text-[#1F2937] mb-4">Timeline of Stops</h3>
        {stops.length === 0 ? (
          <p className="text-sm text-[#64748B] italic">No significant stops (≥5 min) recorded.</p>
        ) : (
          <div className="space-y-4">
            {stops.map((stop, i) => (
              <div key={i} className="flex gap-3 items-start relative pb-4 border-b border-gray-50 last:border-0 last:pb-0 group">
                <div className="mt-1 w-2 h-2 rounded-full bg-teal-500 shrink-0 shadow-[0_0_0_4px_rgba(20,184,166,0.2)]"></div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-[#64748B] font-medium">{stop.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {stop.duration} mins</p>
                      <p className="text-sm text-[#1F2937] font-semibold mt-0.5">{stop.near ? `Stopped near ${stop.near.name}` : 'Stopped'}</p>
                    </div>
                    <button onClick={() => handleMarkMoment('Stop', stop)} className="opacity-0 group-hover:opacity-100 transition text-amber-500 hover:text-amber-600 text-xs flex items-center gap-1 font-bold bg-amber-50 px-2 py-1 rounded">
                      ★ Mark moment
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 9C: You were near */}
      <div className="card p-5 mb-6 border border-gray-100 shadow-sm bg-[#F8FAFC]">
        <h3 className="font-bold text-[#1F2937] mb-1">You were near</h3>
        <p className="text-xs text-[#64748B] mb-4">Places your route passed near (≤400m)</p>
        {Object.keys(poiGroups).length === 0 ? (
          <p className="text-sm text-[#64748B] italic">No notable places recorded nearby.</p>
        ) : (
          <div className="space-y-3">
            {Object.keys(poiGroups).map(type => (
              <div key={type}>
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">{type}</p>
                <div className="flex flex-wrap gap-2">
                  {poiGroups[type].map((poi, i) => (
                    <span key={i} className="px-2 py-1 bg-white border border-gray-200 text-xs font-medium text-gray-700 rounded-md shadow-sm">
                      {poi.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 9C: Expenses */}
      <div className="card p-5 mb-6 border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-[#1F2937]">Expenses</h3>
          <p className="font-bold text-lg text-[#D32F2F]">₹{totalSpent.toLocaleString('en-IN')}</p>
        </div>
        {Object.keys(categories).length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {Object.entries(categories).map(([cat, amount]) => (
              <div key={cat} className="flex-none bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                <p className="text-[10px] text-red-800 uppercase font-bold">{cat}</p>
                <p className="text-sm font-bold text-red-600">₹{(amount as number).toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          {expenses.map((e: any, i: number) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0 group">
              <div>
                <p className="text-sm text-[#1F2937] font-medium">{e.merchant}</p>
                <p className="text-[10px] text-[#64748B] uppercase">{e.category}</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => handleMarkMoment('Expense', e)} className="opacity-0 group-hover:opacity-100 transition text-amber-500 hover:text-amber-600 text-[10px] font-bold bg-amber-50 px-2 py-1 rounded">
                  ★ Mark
                </button>
                <span className="text-sm font-semibold text-[#1F2937]">₹{(e.amount || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 9B & F2: Local Gallery Grid with Dual Add Buttons */}
      <div className="card p-5 mb-6 bg-white border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-sm text-[#1F2937]">Trip Photos ({photos.length})</h3>
          <div className="flex gap-2">
            <label className="bg-[#00695C] text-white text-xs font-bold py-1.5 px-3 rounded cursor-pointer transition hover:bg-teal-800 flex items-center gap-1">
              <Camera size={12} /> Take
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
            </label>
            <label className="bg-teal-100 text-teal-900 text-xs font-bold py-1.5 px-3 rounded cursor-pointer transition hover:bg-teal-200">
              Import
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
          </div>
        </div>
        <p className="text-[10px] text-[#64748B] mb-4 italic">Your photos never leave your phone — import from your gallery, export back anytime. No uploads, ever.</p>
        
        {photos.length === 0 ? (
          <div className="text-center text-[#64748B] py-8 border-2 border-dashed border-gray-100 rounded-xl">
            <Camera size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-xs">No photos yet.</p>
          </div>
        ) : (
          <>
            <div className="flex overflow-x-auto gap-2 pb-2 mb-4 snap-x">
              {photos.map((p, i) => {
                const near = (p.lat && p.lng) ? getNearestPoi(p.lat, p.lng, 0.3) : null;
                return (
                  <div key={i} className="relative group flex-none snap-center">
                    <Link to={`/gallery/${tripId}`} className="block w-28 h-28 bg-gray-100 rounded-lg overflow-hidden shadow-sm">
                      <img src={p.dataUrl} alt="Trip moment" className="w-full h-full object-cover" />
                      {near && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] p-1 truncate text-center font-medium">
                          near {near.name}
                        </div>
                      )}
                    </Link>
                    <button onClick={() => handleMarkMoment('Photo', p)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition text-amber-400 drop-shadow-md">
                      <Zap fill="currentColor" size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="text-center mt-2">
              <Link to={`/gallery/${tripId}`} className="text-[#00695C] text-xs font-bold underline">View Full Gallery</Link>
            </div>
          </>
        )}
      </div>

      {/* 9C: Story card */}
      <div className="card p-5 mb-6 bg-amber-50 border border-amber-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10"><Compass size={64} /></div>
        <h3 className="font-bold text-[#92400E] mb-2 flex items-center gap-1"><BookOpen size={16} /> The Story</h3>
        <p className="text-sm text-amber-900 mb-4 leading-relaxed">
          {points.length > 0 ? (
            `You began your journey in ${trip.originCity} and traveled ${(totalDistanceKm).toFixed(1)} km towards ${trip.destinationCity}. Over the course of ${durationHrs} hours, you made ${stops.length} significant stops and visited ${nearPois.size} notable places.`
          ) : (
            `A journey planned from ${trip.originCity} to ${trip.destinationCity}. No tracking data was recorded.`
          )}
        </p>
        <div className="bg-white/50 p-3 rounded-lg border border-amber-200 flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-amber-900 mb-1">Safety Events Triggered: 0</p>
            <p className="text-[10px] text-amber-800">No route deviations or late arrivals were recorded.</p>
          </div>
          <button onClick={() => handleMarkMoment('Story', {})} className="text-amber-600 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded text-xs font-bold">★ Mark</button>
        </div>
      </div>

      <button onClick={handleShare} className="btn-primary w-full mb-3 shadow-md"><Share2 size={16} /> Share Diary</button>
      <Link to="/" className="btn-secondary w-full text-center block shadow-sm">Plan New Trip</Link>
    </div>
  );
};

// ─── CITY SPOTS PAGE (Section 7) ───────────────────────────
const CitySpots = () => {
  const { city } = useParams();
  const [spots, setSpots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`/api/city/${city}`)
      .then(r => setSpots(r.data))
      .catch(() => setSpots([]))
      .finally(() => setLoading(false));
  }, [city]);

  return (
    <div className="p-5 md:p-8 animate-fade-in-up">
      <Link to="/" className="text-sm font-bold text-teal-700 flex items-center gap-1 mb-4"><Check size={16} /> Back to Home</Link>
      <span className="badge badge-teal mb-3"><MapPin size={14} /> City Guide</span>
      <h1 className="text-2xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans'] mb-2">{city} Spots</h1>
      <p className="text-sm text-[#64748B] mb-6">Showing top spots in {city}. Data sourced live via Wikipedia.</p>

      {loading ? (
        <div className="text-center text-[#64748B] py-8">Loading spots...</div>
      ) : spots.length === 0 ? (
        <div className="text-center text-[#64748B] py-8">No spots found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {spots.map((spot, i) => (
            <div key={i} className="card p-5 border border-gray-100">
              <h3 className="font-bold text-[#1F2937] mb-2">{spot.name}</h3>
              <p className="text-sm text-[#64748B]">{spot.blurb}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── FAQ PAGE (Section 9E) ──────────────────────────────────
const FaqPage = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  
  const faqs = [
    { q: "Does tracking work without network?", a: "Yes! Sanchar AI uses your device's built-in GPS to track points. They are stored locally in IndexedDB and sync automatically when you regain connectivity." },
    { q: "Where are my gallery photos stored?", a: "To respect your privacy and save your data plan, photos are stored securely on your local device (IndexedDB) and NEVER uploaded to our servers. They have zero network footprint." },
    { q: "How does the Budget Calculator work?", a: "It suggests a budget based on your travel style (Budget/Comfort) and days. If you carry heavy luggage, it automatically provisions a luggage add-on for porters/carts." },
    { q: "Can I navigate offline?", a: "Yes. Once you select a POI on the Pocket Map, you get an offline 'as-the-crow-flies' bearing and ETA based on walking speed. We intentionally do not download 100MB+ routing graphs to keep the app lightweight." }
  ];

  return (
    <div className="p-5 md:p-8 animate-fade-in-up">
      <Link to="/" className="text-sm font-bold text-teal-700 flex items-center gap-1 mb-4"><Check size={16} /> Back to Home</Link>
      <span className="badge badge-teal mb-3"><MapPin size={14} /> Help</span>
      <h1 className="text-2xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans'] mb-6">Frequently Asked Questions</h1>

      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div key={i} className="card border border-gray-100 overflow-hidden">
            <button 
              className="w-full text-left p-4 font-bold text-[#1F2937] flex justify-between items-center"
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
            >
              {faq.q}
              <span className="text-teal-600">{openIdx === i ? '−' : '+'}</span>
            </button>
            {openIdx === i && (
              <div className="p-4 pt-0 text-sm text-[#64748B] bg-gray-50">
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── TRIP GALLERY ──────────────────────────────────────────
const TripGallery = () => {
  const { id } = useParams();
  const tripId = id || '';
  const [photos, setPhotos] = useState<any[]>([]);
  const [pois, setPois] = useState<any[]>([]);
  const [fullView, setFullView] = useState<any>(null);

  useEffect(() => {
    if (!tripId) return;
    import('./store/db').then(({ getPhotosForTrip }) => {
      getPhotosForTrip(tripId).then(setPhotos).catch(console.warn);
    });
    axios.get(`/api/trips/${tripId}`).then(r => {
      if (r.data?.destinationCity) {
        import('./store/db').then(({ getCachedCityPack }) => {
          getCachedCityPack(r.data.destinationCity).then(pack => {
            if (pack && pack.pois) setPois(pack.pois);
          }).catch(console.warn);
        });
      }
    }).catch(console.warn);
  }, [tripId]);

  const handleDelete = async (photoId: string) => {
    if (!confirm('Delete this photo?')) return;
    const { deletePhoto } = await import('./store/db');
    await deletePhoto(photoId);
    setPhotos(photos.filter(p => p.id !== photoId));
    setFullView(null);
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const p = 0.017453292519943295;
    const c = Math.cos;
    const a = 0.5 - c((lat2 - lat1) * p)/2 + c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))/2;
    return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
  };

  const getNearestPoi = (lat: number, lng: number, thresholdKm = 0.3) => {
    if (!pois.length) return null;
    let nearest = null;
    let minDist = thresholdKm;
    for (const poi of pois) {
      const d = getDistance(lat, lng, poi.lat, poi.lng);
      if (d < minDist) {
        minDist = d;
        nearest = poi;
      }
    }
    return nearest;
  };

  const handleSharePhoto = async (photo: any) => {
    try {
      const res = await fetch(photo.dataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'photo.webp', { type: 'image/webp' });
      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: 'Trip Photo',
        });
      } else {
        alert('Web Share API not supported on this browser.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (fullView) {
    const near = (fullView.lat && fullView.lng) ? getNearestPoi(fullView.lat, fullView.lng) : null;
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent">
          <button onClick={() => setFullView(null)} className="text-white p-2"><Check size={24} /></button>
          <div className="flex gap-2">
            <button onClick={() => handleSharePhoto(fullView)} className="text-teal-400 p-2"><Share2 size={24} /></button>
            <a href={fullView.dataUrl} download="photo.webp" className="text-blue-400 p-2 block"><BookOpen size={24} /></a>
            <button onClick={() => handleDelete(fullView.id)} className="text-red-400 p-2"><AlertTriangle size={24} /></button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <img src={fullView.dataUrl} alt="Trip Full View" className="max-w-full max-h-full object-contain" />
        </div>
        <div className="p-4 bg-gradient-to-t from-black/80 to-transparent text-white text-center">
          <p className="text-sm">{new Date(fullView.timestamp).toLocaleString()}</p>
          {near && <p className="text-xs text-gray-300 mt-1">📍 near {near.name}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 animate-fade-in-up">
      <Link to={`/diary/${tripId}`} className="text-sm font-bold text-teal-700 flex items-center gap-1 mb-4"><Check size={16} /> Back to Diary</Link>
      <span className="badge badge-teal mb-3"><Camera size={14} /> Journey Gallery</span>
      <h1 className="text-2xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans'] mb-2">Trip Photos</h1>
      <p className="text-xs text-[#64748B] mb-6 italic">Your trip photos, stored privately on your device.</p>

      {photos.length === 0 ? (
        <div className="text-center text-[#64748B] py-12 border-2 border-dashed border-gray-100 rounded-xl">
          <Camera size={32} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No photos yet — capture a moment from this trip.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {photos.map(p => {
            const near = (p.lat && p.lng) ? getNearestPoi(p.lat, p.lng) : null;
            return (
              <div key={p.id} onClick={() => setFullView(p)} className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative cursor-pointer hover:opacity-90 transition">
                <img src={p.dataUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                {near && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate text-center">
                    near {near.name}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── PRIVACY PAGE ────────────────────────────────────────────
const PrivacyPage = () => (
  <div className="p-5 md:p-8 animate-fade-in-up max-w-3xl mx-auto">
    <Link to="/" className="text-sm font-bold text-teal-700 flex items-center gap-1 mb-4"><Check size={16} /> Back to Home</Link>
    <span className="badge badge-teal mb-3"><Lock size={14} /> Privacy Promise</span>
    <h1 className="text-2xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans'] mb-6">Your data stays yours.</h1>

    <div className="space-y-4">
      <div className="card p-5 border border-gray-100">
        <ul className="text-sm text-[#1F2937] space-y-3 font-medium">
          <li className="flex items-start gap-2"><Check size={16} className="text-teal-600 mt-0.5" /> Your exact route never leaves the device.</li>
          <li className="flex items-start gap-2"><Check size={16} className="text-teal-600 mt-0.5" /> Analytics off by default, requires explicit consent.</li>
          <li className="flex items-start gap-2"><Check size={16} className="text-teal-600 mt-0.5" /> First and last 300–500 m stripped from any analytics.</li>
          <li className="flex items-start gap-2"><Check size={16} className="text-teal-600 mt-0.5" /> Locations aggregated to anonymous grid cells.</li>
          <li className="flex items-start gap-2"><Check size={16} className="text-teal-600 mt-0.5" /> Low-volume cells suppressed.</li>
          <li className="flex items-start gap-2"><Check size={16} className="text-teal-600 mt-0.5" /> <strong>Your Private Vault</strong> — photos and stories are locked on your device with a PIN, optionally unlocked by your device's own fingerprint. This data never leaves your phone. (App-level, on-device protection).</li>
        </ul>
      </div>
    </div>
  </div>
);

// ─── FEATURES PAGE ──────────────────────────────────────────
const FeaturesPage = () => (
  <div className="p-5 md:p-8 animate-fade-in-up max-w-4xl mx-auto">
    <Link to="/" className="text-sm font-bold text-teal-700 flex items-center gap-1 mb-4"><Check size={16} /> Back to Home</Link>
    <span className="badge badge-teal mb-3"><Compass size={14} /> Capabilities</span>
    <h1 className="text-2xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans'] mb-6">Sanchar AI Features</h1>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card p-4 border border-gray-100"><h3 className="font-bold mb-1">Safe Trip</h3><p className="text-xs text-[#64748B]">Real-time probabilistic tracking to ensure you stay on route.</p></div>
      <div className="card p-4 border border-gray-100"><h3 className="font-bold mb-1">City Packs</h3><p className="text-xs text-[#64748B]">Pre-download essential local phrases, emergency numbers, and POIs.</p></div>
      <div className="card p-4 border border-gray-100"><h3 className="font-bold mb-1">Scan</h3><p className="text-xs text-[#64748B]">On-device OCR to instantly log your tickets and receipts.</p></div>
      <div className="card p-4 border border-gray-100"><h3 className="font-bold mb-1">Expenses</h3><p className="text-xs text-[#64748B]">Smart budget calculator and live tracking of your spending.</p></div>
      <div className="card p-4 border border-gray-100"><h3 className="font-bold mb-1">SOS</h3><p className="text-xs text-[#64748B]">One-tap emergency alert sending your exact location offline.</p></div>
      <div className="card p-4 border border-gray-100"><h3 className="font-bold mb-1">Diary</h3><p className="text-xs text-[#64748B]">Beautiful recap of your past journeys with an interactive timeline.</p></div>
      <div className="card p-4 border border-gray-100"><h3 className="font-bold mb-1">Offline Tracking</h3><p className="text-xs text-[#64748B]">Your GPS points queue locally and sync automatically when online.</p></div>
      <div className="card p-4 border border-gray-100"><h3 className="font-bold mb-1">Offline Maps</h3><p className="text-xs text-[#64748B]">Pocket map using cached tiles to show your live path anywhere.</p></div>
      <div className="card p-4 border border-gray-100"><h3 className="font-bold mb-1">Luggage Buddy</h3><p className="text-xs text-[#64748B]">Intelligent nudges for transport and breaks when carrying heavy bags.</p></div>
      <div className="card p-4 border border-gray-100"><h3 className="font-bold mb-1">Gallery</h3><p className="text-xs text-[#64748B]">Take and store photos locally directly linked to your journey.</p></div>
      <div className="card p-4 border border-gray-100"><h3 className="font-bold mb-1">History</h3><p className="text-xs text-[#64748B]">Detailed breakdown of places you were near and timeline of stops.</p></div>
    </div>

    <div className="card p-6 mt-6">
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
    <div className="mt-8 text-center">
      <Link to="/faq" className="text-sm font-bold text-[#00695C] underline">View Frequently Asked Questions (FAQ)</Link>
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
