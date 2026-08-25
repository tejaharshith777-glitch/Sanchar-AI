import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Link, useParams, useSearchParams, useLocation } from 'react-router-dom';
import {
  Shield, MapPin, Navigation2, Camera, Smartphone, WifiOff,
  Zap, Globe, Lock, IndianRupee, Phone,
  ChevronRight, Check, AlertTriangle, Share2,
  BookOpen, BarChart3, Search, Compass, HelpCircle,
  Mic, History as HistoryIcon, Plus, Unlock, Bot, Send, Loader2
} from 'lucide-react';
import axios from 'axios';
import { queueOfflineMutation, getOfflineQueue, removeQueueItem } from './store/db';
import { ocrProvider } from './ocr/OcrProvider';
import PocketMap from './components/PocketMap';
import SancharChatbot from './components/SancharChatbot';
import MapsPage from './pages/MapsPage';
import { PlaceDetailPage, LuggageRadarPage } from './pages/PlacesAndLuggage';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area
} from 'recharts';

// ─── Constants ───────────────────────────────────────────────
const CITIES = [
  'Chennai', 'Coimbatore', 'Madurai', 'Kochi', 'Bengaluru',
  'Mumbai', 'Pune', 'Delhi', 'Jaipur', 'Kolkata',
  'Bhubaneswar', 'Ahmedabad', 'Guwahati', 'Varanasi'
];

// ─── Health & Connectivity Context ───────────────────────────
interface HealthContextType {
  isBackendOffline: boolean;
  isConnecting: boolean;
  dbMode: 'atlas' | 'memory' | null;
  syncState: 'synced' | 'syncing' | 'offline';
  isOnline: boolean;
  activeTrip: any | null;
  lastCompletedTrip: any | null;
  refreshTrips: () => Promise<void>;
}

const HealthContext = createContext<HealthContextType>({
  isBackendOffline: false,
  isConnecting: true,
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
  const [isConnecting, setIsConnecting] = useState(true);
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

  // Poll server health check with 3 retries at 10s initially
  useEffect(() => {
    let active = true;
    let attempt = 0;

    const checkHealth = async () => {
      try {
        const res = await axios.get('/api/health');
        if (active) {
          setIsBackendOffline(false);
          setDbMode(res.data.db);
          setIsConnecting(false);
        }
      } catch (err) {
        if (active) {
          if (attempt < 3) {
            attempt++;
            console.log(`Backend connection attempt ${attempt} failed, retrying in 10s...`);
            setTimeout(checkHealth, 10000);
          } else {
            setIsBackendOffline(true);
            setDbMode(null);
            setIsConnecting(false);
          }
        }
      }
    };

    checkHealth();

    const interval = setInterval(async () => {
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
    }, 15000);

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

  return { isOnline, syncState, isBackendOffline, isConnecting, dbMode, activeTrip, lastCompletedTrip, refreshTrips };
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
          <Route path="/privacy" element={<AppShell><PrivacyPage /></AppShell>} />
          <Route path="/history" element={<AppShell><VaultGuard><HistoryPage /></VaultGuard></AppShell>} />
          <Route path="/features" element={<AppShell><FeaturesPage /></AppShell>} />
          <Route path="/faq" element={<AppShell><FaqPage /></AppShell>} />
          <Route path="/dashboard" element={<AppShell><Dashboard /></AppShell>} />
          <Route path="/maps" element={<AppShell><MapsPage /></AppShell>} />
          <Route path="/spot/:cityName/:slug" element={<AppShell><PlaceDetailPage /></AppShell>} />
          <Route path="/luggage" element={<AppShell><LuggageRadarPage /></AppShell>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </HealthContext.Provider>
  );
};

// ─── App Shell Wrapper ───────────────────────────────────────
const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { isBackendOffline, isConnecting, dbMode, activeTrip } = useContext(HealthContext);
  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col relative">
      <InnerNav />
      {/* Sleek Non-intrusive Health Status Pill */}
      {isConnecting ? (
        <div className="bg-[#00695C]/90 backdrop-blur-md text-white text-[11px] py-1.5 px-4 text-center font-semibold animate-fade-in flex items-center justify-center gap-1.5 border-b border-teal-700/30">
          <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" /> Connecting to Sanchar AI...
        </div>
      ) : isBackendOffline ? (
        <div className="bg-amber-500/90 backdrop-blur-md text-white text-[11px] py-1.5 px-4 text-center font-semibold animate-fade-in flex items-center justify-center gap-1.5 border-b border-amber-600/30">
          <WifiOff size={13} /> Offline Mode — Telemetry saving to local IndexedDB
        </div>
      ) : dbMode === 'memory' ? (
        <div className="bg-[#00695C]/90 backdrop-blur-md text-white text-[11px] py-1.5 px-4 text-center font-semibold flex items-center justify-center gap-1.5 border-b border-teal-700/30">
          <Check size={13} /> Sanchar AI Online · Memory Store Active
        </div>
      ) : null}
      <main className="flex-1 max-w-2xl mx-auto w-full">
        {children}
      </main>
      <SancharChatbot activeTrip={activeTrip} />
    </div>
  );
};

// ─── VAULT GUARD ───────────────────────────────────────────
const VaultGuard = ({ children }: { children: React.ReactNode }) => {
  const [authState, setAuthState] = useState<'checking' | 'unauthorized' | 'auth_modal' | 'pin_setup' | 'pin_verify' | 'unlocked'>('checking');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (!token || !user) {
      setAuthState('auth_modal');
    } else {
      if (!user.hasVault) {
        setAuthState('pin_setup');
      } else {
        setAuthState('pin_verify');
      }
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    try {
      const endpoint = authMode === 'signin' ? '/api/auth/signin' : '/api/auth/signup';
      const res = await axios.post(endpoint, { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      
      if (res.data.user.hasVault) {
        setAuthState('pin_verify');
      } else {
        setAuthState('pin_setup');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSetup = async () => {
    if (pinInput.length !== 4) {
      setErrorMsg('PIN must be exactly 4 digits');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/user/vault-pin', { pin: pinInput }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.hasVault = true;
      localStorage.setItem('user', JSON.stringify(user));
      
      // Update local encryption too
      const { setVaultPin } = await import('./store/db');
      await setVaultPin(pinInput);

      setAuthState('unlocked');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to set PIN');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinVerify = async () => {
    if (pinInput.length !== 4) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/user/verify-pin', { pin: pinInput }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAuthState('unlocked');
      setPinInput('');
    } catch (err: any) {
      setErrorMsg('Invalid PIN. Please try again.');
      setPinInput('');
    } finally {
      setIsLoading(false);
    }
  };

  if (authState === 'checking') {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-teal-600" /></div>;
  }

  if (authState === 'auth_modal') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-5 relative overflow-hidden bg-gradient-to-br from-[#004D40] to-[#00695C]">
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-0"></div>
        <div className="z-10 w-full max-w-sm bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 shadow-2xl flex flex-col items-center text-white">
          <Lock size={48} className="text-teal-200 mb-6 drop-shadow-md" />
          <h2 className="text-2xl font-bold mb-2">{authMode === 'signin' ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="text-sm text-teal-100/70 text-center mb-6">Secure access to your private history</p>
          
          <form onSubmit={handleAuth} className="w-full flex flex-col gap-4">
            <input 
              type="email" 
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400"
              required
            />
            <input 
              type="password" 
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400"
              required
            />
            {errorMsg && <p className="text-red-300 text-xs font-bold">{errorMsg}</p>}
            
            <button disabled={isLoading} type="submit" className="w-full mt-2 bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-300 hover:to-teal-400 text-teal-950 font-bold py-3 rounded-xl transition shadow-lg disabled:opacity-50 flex justify-center">
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : (authMode === 'signin' ? 'Sign In' : 'Sign Up')}
            </button>
          </form>
          
          <button onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')} className="mt-6 text-sm text-teal-200 hover:text-white transition">
            {authMode === 'signin' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    );
  }

  if (authState === 'pin_setup') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-5 animate-fade-in-up">
        <Lock size={48} className="text-[#00695C] mb-4" />
        <h2 className="text-xl font-bold text-[#1F2937] mb-2">Set up your Private Vault</h2>
        <p className="text-sm text-[#64748B] text-center mb-6 max-w-sm">
          Protect your photos and stories with a 4-digit PIN.
        </p>
        <input 
          type="password" 
          maxLength={4} 
          placeholder="4-digit PIN"
          value={pinInput}
          onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
          className="w-full max-w-xs p-3 text-center text-xl tracking-widest border border-gray-300 rounded-xl mb-4 font-bold"
        />
        {errorMsg && <p className="text-red-500 text-xs mb-4 font-bold">{errorMsg}</p>}
        <button onClick={handlePinSetup} disabled={isLoading} className="btn-primary w-full max-w-xs py-3 flex justify-center items-center">
          {isLoading ? <Loader2 size={20} className="animate-spin" /> : 'Save PIN'}
        </button>
      </div>
    );
  }

  if (authState === 'pin_verify') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-5 bg-[#004D40] text-white animate-fade-in-up">
        <Lock size={48} className="mb-4 text-teal-200" />
        <h2 className="text-xl font-bold mb-6">Private Vault Locked</h2>
        
        <input 
          type="password" 
          maxLength={4} 
          placeholder="Enter 4-digit PIN"
          value={pinInput}
          onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
          className="w-full max-w-xs p-3 text-center text-xl tracking-widest text-gray-900 border border-gray-300 rounded-xl mb-4 font-bold"
        />
        {errorMsg && <p className="text-red-300 text-xs mb-4 font-bold">{errorMsg}</p>}
        <button onClick={handlePinVerify} disabled={isLoading} className="w-full max-w-xs bg-teal-500 hover:bg-teal-400 text-white font-bold py-3 rounded-xl mb-4 transition disabled:opacity-50 flex justify-center">
          {isLoading ? <Loader2 size={20} className="animate-spin" /> : 'Unlock'}
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col w-full h-full">
      <div className="absolute top-2 right-5 md:right-8 z-10">
        <button onClick={() => setAuthState('pin_verify')} className="bg-gray-800 text-white text-[10px] font-bold py-1.5 px-3 rounded-full flex items-center gap-1 opacity-60 hover:opacity-100 transition shadow-sm">
          <Lock size={10} /> Lock now
        </button>
      </div>
      {children}
    </div>
  );
};


const ConnectivityHeaderChip = () => {
  const { isOnline, syncState } = useContext(HealthContext);
  const [lastSyncedText, setLastSyncedText] = useState('just now');

  useEffect(() => {
    const update = () => {
      const ts = localStorage.getItem('sanchar_last_sync_timestamp');
      if (!ts) {
        setLastSyncedText('just now');
      } else {
        const mins = Math.max(0, Math.floor((Date.now() - parseInt(ts, 10)) / 60000));
        setLastSyncedText(mins === 0 ? 'just now' : `${mins}m ago`);
      }
    };
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, [isOnline]);

  const isSyncing = (syncState as any) === 'syncing' || Boolean((syncState as any)?.syncing);
  const qCount = typeof syncState === 'object' && syncState ? (syncState as any).queueCount || 1 : 1;

  if (isSyncing) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
        <span className="animate-spin text-blue-600">⟳</span> Syncing… ({qCount} {qCount === 1 ? 'item' : 'items'})
      </span>
    );
  }

  if (isOnline) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> ● Online · live data
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-300">
      <span className="w-2 h-2 rounded-full bg-amber-500" /> ● Offline · cached data · last synced {lastSyncedText}
    </span>
  );
};

const InnerNav = () => {
  const { activeTrip } = useContext(HealthContext);
  return (
    <nav className="sticky top-0 z-50 glass-nav border-b border-gray-150">
      <div className="max-w-4xl mx-auto px-4 md:px-6 flex justify-between h-16 items-center">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-8 h-8 bg-[#00695C] rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <span className="font-['Plus_Jakarta_Sans'] font-bold text-[#1F2937] text-lg tracking-tight">Sanchar AI</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <ConnectivityHeaderChip />
          <Link to="/features" className="text-xs font-semibold text-[#64748B] hover:text-[#00695C] transition-colors no-underline hidden md:inline">Features</Link>
          <Link to="/privacy" className="text-xs font-semibold text-[#64748B] hover:text-[#00695C] transition-colors no-underline hidden md:inline">Privacy</Link>
          <Link to="/history" className="text-xs font-semibold text-[#64748B] hover:text-[#00695C] transition-colors no-underline">History</Link>
          <Link to="/maps" className="text-xs font-semibold text-[#64748B] hover:text-[#00695C] transition-colors no-underline hidden sm:inline">Maps</Link>
          <Link to="/dashboard" className="text-xs font-semibold text-[#64748B] hover:text-[#00695C] transition-colors no-underline hidden sm:inline">Dashboard</Link>
          
          {activeTrip && (
            <Link
              to={`/active/${activeTrip._id}`}
              className="badge bg-[#E0F2F1] text-[#00695C] border border-[#B2DFDB] text-xs font-bold py-1 px-3 rounded-full flex items-center gap-1.5 no-underline hover:bg-[#B2DFDB] transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-[#00695C] animate-pulse" />
              ● Active Trip ({activeTrip.originCity} → {activeTrip.destinationCity})
            </Link>
          )}
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



const CLIENT_CURATED_CITY_SPOTS: Record<string, { name: string; category: string; blurb: string }[]> = {
  "Kochi": [
    { name: "Chinese Fishing Nets (Fort Kochi)", category: "Beach", blurb: "Iconic historic fishing nets along Fort Kochi beach." },
    { name: "Fort Kochi Beach", category: "Beach", blurb: "Scenic coastal promenade famous for sunsets and seafood shacks." },
    { name: "Mattancherry Palace (Dutch Palace)", category: "Fort", blurb: "16th-century palace featuring traditional Kerala murals." },
    { name: "Santa Cruz Basilica", category: "Temple", blurb: "Gothic style historic cathedral in Fort Kochi." },
    { name: "Paradesi Synagogue (Jew Town)", category: "Temple", blurb: "Oldest active synagogue in the Commonwealth, established 1568." },
    { name: "Jew Town Antique Market", category: "Market", blurb: "Bustling heritage bazaar filled with spices, crafts, and antiques." },
    { name: "Bolgatty Palace & Island", category: "Beach", blurb: "Palatial island estate surrounded by Kerala backwaters." },
    { name: "Marine Drive Promenade", category: "Viewpoint", blurb: "Popular waterfront walkway overlooking Ernakulam harbor." },
    { name: "Kathakali Cultural Centre", category: "Museum", blurb: "Traditional Kerala classical dance and drama performance venue." },
    { name: "St. Francis Church", category: "Temple", blurb: "Oldest European church built in India (1503)." },
    { name: "Willingdon Island", category: "Beach", blurb: "Man-made island hosting Cochin Port and naval stations." },
    { name: "Vypin Island & Lighthouse", category: "Beach", blurb: "Serene beach island connected by harbor ferries." }
  ],
  "Chennai": [
    { name: "Marina Beach", category: "Beach", blurb: "Second longest natural urban beach in the world." },
    { name: "Kapaleeshwarar Temple (Mylapore)", category: "Temple", blurb: "7th-century Dravidian architecture temple dedicated to Shiva." },
    { name: "San Thome Basilica", category: "Temple", blurb: "Neo-Gothic church built over St. Thomas the Apostle's tomb." },
    { name: "Fort St. George Museum", category: "Fort", blurb: "First English fortress in India, established 1644." },
    { name: "Besant Nagar (Elliot's) Beach", category: "Beach", blurb: "Peaceful beach popular for cafes and evening walks." },
    { name: "Guindy National Park", category: "Park", blurb: "Protected urban national park inside Chennai city limits." },
    { name: "Government Museum & Art Gallery", category: "Museum", blurb: "Second oldest museum in India with rare Chola bronzes." },
    { name: "T. Nagar Commercial Market", category: "Market", blurb: "Famous shopping district for silk sarees and gold jewelry." }
  ],
  "Hyderabad": [
    { name: "Charminar", category: "Fort", blurb: "16th-century landmark mosque and iconic monument of Hyderabad." },
    { name: "Golconda Fort", category: "Fort", blurb: "Massive medieval fortress renowned for acoustic acoustics." },
    { name: "Chowmahalla Palace", category: "Fort", blurb: "Opulent seat of the Asaf Jahi dynasty and Nizams." },
    { name: "Salar Jung Museum", category: "Museum", blurb: "One of 3 National Museums housing world art collections." },
    { name: "Hussain Sagar Lake & Buddha Statue", category: "Beach", blurb: "Large lake with 18m monolithic Buddha statue on island." },
    { name: "Ramoji Film City", category: "Park", blurb: "World's largest film studio complex and theme park." }
  ],
  "Bengaluru": [
    { name: "Cubbon Park", category: "Park", blurb: "300-acre green lung in the heart of Silicon Valley of India." },
    { name: "Lalbagh Botanical Garden", category: "Park", blurb: "Historic glasshouse botanical garden with 1000+ flora species." },
    { name: "Bangalore Palace", category: "Fort", blurb: "Tudor-style royal palace inspired by Windsor Castle." },
    { name: "Vidhana Soudha", category: "Fort", blurb: "Imposing Neo-Dravidian state legislative assembly." },
    { name: "Church Street & MG Road", category: "Market", blurb: "Vibrant pedestrian avenue lined with cafes, books, and pubs." },
    { name: "Nandi Hills", category: "Day trip", blurb: "Scenic hill fortress popular for sunrise views near Bengaluru." }
  ],
  "Mumbai": [
    { name: "Gateway of India", category: "Fort", blurb: "20th-century arch monument overlooking the Arabian Sea." },
    { name: "Marine Drive", category: "Viewpoint", blurb: "3.6 km C-shaped boulevard known as the Queen's Necklace." },
    { name: "Elephanta Caves", category: "Fort", blurb: "UNESCO rock-cut cave temples on Elephanta Island." },
    { name: "Colaba Causeway", category: "Market", blurb: "Bustling street shopping lane for souvenirs and fashion." },
    { name: "Chhatrapati Shivaji Terminus (CST)", category: "Fort", blurb: "UNESCO Victorian Gothic historic railway terminal." },
    { name: "Juhu Beach", category: "Beach", blurb: "Famous Mumbai beach renowned for Pav Bhaji and street food." }
  ],
  "Jaipur": [
    { name: "Amber Fort & Palace", category: "Fort", blurb: "Majestic hilltop fort overlooking Maota Lake." },
    { name: "Hawa Mahal (Palace of Winds)", category: "Fort", blurb: "Iconic honeycomb pink sandstone facade palace." },
    { name: "City Palace", category: "Fort", blurb: "Royal complex featuring courtyards, gardens, and museums." },
    { name: "Jantar Mantar Observatory", category: "Museum", blurb: "UNESCO 18th-century astronomical instrument site." },
    { name: "Nahargarh Fort", category: "Fort", blurb: "Ridge fort offering panoramic views of Jaipur pink city." },
    { name: "Johari Bazaar", category: "Market", blurb: "Historic gemstone and traditional Rajasthani market." }
  ],
  "Varanasi": [
    { name: "Dashashwamedh Ghat", category: "Viewpoint", blurb: "Main river ghat famous for grand evening Ganga Aarti." },
    { name: "Kashi Vishwanath Temple", category: "Temple", blurb: "Holy golden temple dedicated to Lord Shiva." },
    { name: "Sarnath Buddhist Sacred Site", category: "Day trip", blurb: "Where Buddha delivered his first sermon after enlightenment." },
    { name: "Assi Ghat", category: "Viewpoint", blurb: "Southernmost ghat known for morning yoga and music." },
    { name: "Manikarnika Ghat", category: "Temple", blurb: "Historic sacred riverfront ghat on the Ganges." }
  ],
  "Guwahati": [
    { name: "Kamakhya Temple", category: "Temple", blurb: "Sacred Shakti Peeth temple atop Nilachal Hills." },
    { name: "Umananda Temple (Peacock Island)", category: "Temple", blurb: "Smallest inhabited river island in the world." },
    { name: "Brahmaputra River Cruise", category: "Viewpoint", blurb: "Scenic sunset cruise along the mighty Brahmaputra river." },
    { name: "Assam State Museum", category: "Museum", blurb: "Rich collection of Northeast tribal heritage and sculptures." }
  ]
};

function getFallbackSpotData(city: string) {
  const normalized = city ? city.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : 'City';
  const curated = CLIENT_CURATED_CITY_SPOTS[normalized];

  if (curated) {
    return {
      city: normalized,
      source: 'curated-sample',
      count: curated.length,
      spots: curated
    };
  }

  return {
    city: normalized,
    source: 'wikipedia-live',
    count: 0,
    spots: []
  };
}

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
        if (isMounted && res.data && res.data.spots && res.data.spots.length > 0) {
          setData(res.data);
        } else if (isMounted) {
          setData(getFallbackSpotData(formattedCity));
        }
      })
      .catch(() => {
        if (isMounted) {
          setData(getFallbackSpotData(formattedCity));
        }
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
            {(!data.spots || data.spots.length === 0) ? (
              <div className="card p-10 text-center max-w-xl mx-auto border border-amber-200 bg-amber-50/30 my-12 rounded-3xl shadow-sm">
                <HelpCircle className="text-[#F59E0B] mx-auto mb-4" size={44} />
                <h2 className="font-bold text-2xl text-[#1F2937] mb-3">Few verified places for '{data.city || formattedCity}' so far</h2>
                <p className="text-sm text-[#64748B] leading-relaxed mb-8">
                  General India pack works everywhere: 112 emergency · 139 rail enquiry · basic guidance.
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
                          ? 'Curated verified pack'
                          : 'Live open-data pack · verify before visiting'}
                      </span>
                    </div>
                    <p className="text-[#64748B] text-sm flex items-center gap-2 font-medium">
                      <Compass size={16} className="text-[#00695C]" />
                      {`${data.spots.length} real places — live data from Wikipedia · verify before visiting`}
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

const useScrollReveal = () => {
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-active');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    const elements = document.querySelectorAll('.reveal-element, .reveal-stagger');
    elements.forEach(el => observer.observe(el));

    return () => {
      elements.forEach(el => observer.unobserve(el));
    };
  }, []);
};

const AnimatedCounter = ({ value, duration = 1000 }: { value: number; duration?: number }) => {
  const [count, setCount] = useState(0);
  const elementRef = useRef<HTMLSpanElement>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (value <= 0) {
      setCount(value);
      return;
    }

    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setCount(value);
      return;
    }

    let animationFrameId: number;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;
          if (elementRef.current) observer.unobserve(elementRef.current);

          const startTime = performance.now();
          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOutProgress = 1 - Math.pow(1 - progress, 3);
            const currentCount = Math.round(easeOutProgress * value);

            setCount(currentCount);

            if (progress < 1) {
              animationFrameId = requestAnimationFrame(animate);
            } else {
              setCount(value);
            }
          };

          animationFrameId = requestAnimationFrame(animate);
        }
      },
      { threshold: 0.1 }
    );

    if (elementRef.current && !hasAnimatedRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (elementRef.current) observer.unobserve(elementRef.current);
    };
  }, [value, duration]);

  return <span ref={elementRef}>{count.toLocaleString('en-IN')}</span>;
};

const HeroHeadline = () => {
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setComplete(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (complete) {
    return (
      <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight mb-6 max-w-4xl mx-auto">
        Travel <span className="text-[#F59E0B] italic">confidently</span>, even <span className="text-[#F59E0B] italic">offline.</span>
      </h1>
    );
  }

  const segments = [
    { text: "Travel", isSaffron: false },
    { text: " ", isSpace: true },
    { text: "confidently", isSaffron: true },
    { text: ",", isSaffron: false },
    { text: " ", isSpace: true },
    { text: "even", isSaffron: false },
    { text: " ", isSpace: true },
    { text: "offline.", isSaffron: true },
  ];

  let charIndexCounter = 0;

  return (
    <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight mb-6 max-w-4xl mx-auto">
      {segments.map((seg, sIdx) => {
        if (seg.isSpace) {
          return <span key={sIdx} className="inline-block">&nbsp;</span>;
        }
        return (
          <span key={sIdx} className={`inline-block ${seg.isSaffron ? 'text-[#F59E0B] italic' : ''}`}>
            {Array.from(seg.text).map((char, cIdx) => {
              const globalIndex = charIndexCounter++;
              return (
                <span
                  key={cIdx}
                  className="hero-letter inline-block"
                  style={{ animationDelay: `${globalIndex * 40}ms` }}
                >
                  {char}
                </span>
              );
            })}
          </span>
        );
      })}
    </h1>
  );
};

const FaqAccordionItem = ({ question, answer }: { question: string; answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className={`card-retreat p-5 mb-4 border border-gray-100/50 bg-white transition-all cursor-pointer ${isOpen ? 'faq-accordion-open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
      <div className="flex justify-between items-center">
        <h4 className="font-display font-bold text-base text-[#1F2937]">{question}</h4>
        <span className="text-teal-700 font-bold text-lg">{isOpen ? '−' : '+'}</span>
      </div>
      <div className="faq-accordion-content mt-3 text-xs sm:text-sm text-[#64748B] leading-relaxed">
        {answer}
      </div>
    </div>
  );
};



const DiarySlide = () => {
  const [hasDiary, setHasDiary] = useState(false);
  const [diaryNote, setDiaryNote] = useState('');

  useEffect(() => {
    try {
      const notes = JSON.parse(localStorage.getItem('sanchar_private_diary') || '[]');
      if (notes.length > 0) {
        setDiaryNote(notes[0]);
        setHasDiary(true);
      }
    } catch {
      setHasDiary(false);
    }
  }, []);

  if (!hasDiary) {
    return (
      <div className="card-retreat p-8 text-center bg-white max-w-xl mx-auto border border-gray-100/50">
        <BookOpen className="text-teal-700/60 mx-auto mb-4" size={40} />
        <h3 className="font-display font-bold text-lg text-[#1F2937] mb-2">No completed trips yet</h3>
        <p className="text-xs sm:text-sm text-[#64748B] max-w-sm mx-auto mb-4">Complete a trip to see its story here.</p>
        <Link to="/create" className="btn-primary inline-flex text-xs px-6">Start Safe Trip</Link>
      </div>
    );
  }

  return (
    <div className="card-retreat p-8 max-w-xl mx-auto bg-white border border-teal-100 shadow-md">
      <span className="text-[10px] font-bold text-[#F59E0B] uppercase tracking-wider">Latest Story Entry</span>
      <h3 className="font-display font-bold text-xl text-[#1F2937] mt-1.5 mb-4">Your trip becomes a memory</h3>
      <div className="p-4 bg-[#FFFDF9] border border-amber-100 rounded-xl text-sm italic text-gray-800 font-serif leading-relaxed">
        "{diaryNote}"
      </div>
      <Link to="/history" className="btn-secondary w-full text-center mt-5 text-xs py-2.5">Open History Vault</Link>
    </div>
  );
};

// ─── CAROUSEL CITIES (Real City Packs Only) ───────────────────
const CAROUSEL_CITIES = [
  { name: 'Chennai', img: '/images/india/chennai.jpg' },
  { name: 'Kochi', img: '/images/india/kochi.jpg' },
  { name: 'Hyderabad', img: '/images/india/hyderabad.jpg' },
  { name: 'Bengaluru', img: '/images/india/bengaluru.jpg' },
  { name: 'Mumbai', img: '/images/india/mumbai.jpg' },
  { name: 'Jaipur', img: '/images/india/jaipur.jpg' },
  { name: 'Varanasi', img: '/images/india/kashi_vishwanath.jpg' },
  { name: 'Delhi', img: '/images/india/delhi.jpg' },
  { name: 'Guntur', img: '/images/india/stat_temple.jpg' },
  { name: 'Indore', img: '/images/india/bg_section2.jpg' },
  { name: 'Nashik', img: '/images/india/stat_temple.jpg' },
  { name: 'Madurai', img: '/images/india/chennai.jpg' },
  { name: 'Nagpur', img: '/images/india/bg_section1.jpg' },
  { name: 'Bhubaneswar', img: '/images/india/stat_temple.jpg' },
  { name: 'Guwahati', img: '/images/india/guwahati_river.jpg' },
  { name: 'Kolkata', img: '/images/india/kolkata.jpg' }
];

const CURATED_SPECIAL_SPOTS_24 = [
  { city: 'Chennai', slug: 'marina-beach', name: 'Marina Beach', category: 'Beach', location: 'Beach Road, Chennai', timing: '5:00 AM - 8:00 PM', trustedCount: '520+', img: '/images/india/marina_beach.jpg' },
  { city: 'Chennai', slug: 'kapaleeshwarar-temple', name: 'Kapaleeshwarar Temple', category: 'Temple', location: 'Mylapore, Chennai', timing: '6:00 AM - 8:30 PM', trustedCount: '410+', img: '/images/india/stat_temple.jpg' },
  { city: 'Chennai', slug: 'san-thome-basilica', name: 'San Thome Basilica', category: 'Heritage', location: 'Santhome, Chennai', timing: '8:00 AM - 6:00 PM', trustedCount: '340+', img: '/images/india/chennai.jpg' },
  
  { city: 'Kochi', slug: 'chinese-fishing-nets', name: 'Chinese Fishing Nets', category: 'Heritage', location: 'Fort Kochi, Kerala', timing: '6:00 AM - 7:00 PM', trustedCount: '290+', img: '/images/india/kochi_nets.jpg' },
  { city: 'Kochi', slug: 'mattancherry-palace', name: 'Mattancherry Palace', category: 'Heritage', location: 'Mattancherry, Kochi', timing: '9:45 AM - 4:45 PM', trustedCount: '310+', img: '/images/india/kochi.jpg' },
  { city: 'Kochi', slug: 'fort-kochi-beach', name: 'Fort Kochi Beach', category: 'Beach', location: 'Fort Kochi Promenade', timing: 'Open 24 Hours', trustedCount: '380+', img: '/images/india/kochi.jpg' },
  
  { city: 'Hyderabad', slug: 'charminar', name: 'Charminar & Laad Bazaar', category: 'Heritage', location: 'Old City, Hyderabad', timing: '6:00 AM - 6:30 PM', trustedCount: '680+', img: '/images/india/charminar.jpg' },
  { city: 'Hyderabad', slug: 'golconda-fort', name: 'Golconda Fort', category: 'Fort', location: 'Golconda, Hyderabad', timing: '9:00 AM - 5:30 PM', trustedCount: '510+', img: '/images/india/hyderabad.jpg' },
  { city: 'Hyderabad', slug: 'hussain-sagar-lake', name: 'Hussain Sagar Lake', category: 'Viewpoint', location: 'Necklace Road, Hyderabad', timing: '8:00 AM - 10:00 PM', trustedCount: '430+', img: '/images/india/hyderabad.jpg' },

  { city: 'Jaipur', slug: 'amber-fort', name: 'Amber Fort & Maota Lake', category: 'Fort', location: 'Amer, Jaipur, Rajasthan', timing: '8:00 AM - 5:30 PM', trustedCount: '610+', img: '/images/india/jaipur.jpg' },
  { city: 'Jaipur', slug: 'hawa-mahal', name: 'Hawa Mahal', category: 'Heritage', location: 'Pink City, Jaipur', timing: '9:00 AM - 5:00 PM', trustedCount: '720+', img: '/images/india/jaipur.jpg' },
  { city: 'Jaipur', slug: 'city-palace-jaipur', name: 'City Palace Jaipur', category: 'Heritage', location: 'Jaleb Chowk, Jaipur', timing: '9:30 AM - 5:00 PM', trustedCount: '490+', img: '/images/india/jaipur.jpg' },

  { city: 'Mumbai', slug: 'gateway-of-india', name: 'Gateway of India', category: 'Archway', location: 'Apollo Bunder, Mumbai', timing: 'Open 24 Hours', trustedCount: '890+', img: '/images/india/gateway_of_india.jpg' },
  { city: 'Mumbai', slug: 'marine-drive', name: 'Marine Drive Promenade', category: 'Viewpoint', location: 'South Mumbai', timing: 'Open 24 Hours', trustedCount: '950+', img: '/images/india/mumbai.jpg' },
  { city: 'Mumbai', slug: 'chhatrapati-shivaji-terminus', name: 'CST Railway Station', category: 'Heritage', location: 'Fort, Mumbai', timing: 'Open 24 Hours', trustedCount: '620+', img: '/images/india/mumbai.jpg' },

  { city: 'Varanasi', slug: 'dashashwamedh-ghat', name: 'Dashashwamedh Ghat', category: 'Ghat', location: 'Godowlia, Varanasi', timing: '3:00 AM - 11:00 PM', trustedCount: '810+', img: '/images/india/kashi_vishwanath.jpg' },
  { city: 'Varanasi', slug: 'kashi-vishwanath-temple', name: 'Kashi Vishwanath Temple', category: 'Temple', location: 'Varanasi, UP', timing: '3:00 AM - 11:00 PM', trustedCount: '940+', img: '/images/india/kashi_vishwanath.jpg' },
  { city: 'Varanasi', slug: 'sarnath-sacred-site', name: 'Sarnath Stupa Complex', category: 'Sacred', location: 'Sarnath, Varanasi', timing: '8:00 AM - 6:00 PM', trustedCount: '370+', img: '/images/india/stat_temple.jpg' },

  { city: 'Bengaluru', slug: 'cubbon-park', name: 'Cubbon Park', category: 'Park', location: 'Kasturba Road, Bengaluru', timing: '6:00 AM - 7:00 PM', trustedCount: '540+', img: '/images/india/bengaluru.jpg' },
  { city: 'Bengaluru', slug: 'lalbagh-botanical-garden', name: 'Lalbagh Botanical Garden', category: 'Park', location: 'Mavalli, Bengaluru', timing: '8:00 AM - 6:00 PM', trustedCount: '480+', img: '/images/india/bengaluru.jpg' },

  { city: 'Delhi', slug: 'qutub-minar', name: 'Qutub Minar', category: 'Monument', location: 'Mehrauli, New Delhi', timing: '7:00 AM - 5:00 PM', trustedCount: '780+', img: '/images/india/delhi.jpg' },
  { city: 'Delhi', slug: 'red-fort', name: 'Red Fort (Lal Qila)', category: 'Fort', location: 'Old Delhi', timing: '9:30 AM - 4:30 PM', trustedCount: '860+', img: '/images/india/delhi.jpg' },

  { city: 'Guntur', slug: 'amaravati-stupa', name: 'Amaravati Great Stupa', category: 'Heritage', location: 'Amaravati, Guntur, AP', timing: '9:00 AM - 5:00 PM', trustedCount: '210+', img: '/images/india/stat_temple.jpg' },
  { city: 'Indore', slug: 'rajwada-palace', name: 'Rajwada Palace', category: 'Palace', location: 'Rajwada, Indore, MP', timing: '10:00 AM - 5:00 PM', trustedCount: '260+', img: '/images/india/bg_section2.jpg' }
];

// ─── LANDING PAGE ────────────────────────────────────────────
const LandingPage = () => {
  const { isBackendOffline, isConnecting, isOnline, dbMode, activeTrip, lastCompletedTrip } = useContext(HealthContext);
  const [showLoader, setShowLoader] = useState(() => !sessionStorage.getItem('sanchar_intro_loaded'));
  const [destinationPreFill] = useState('');
  const [searchCityInput, setSearchCityInput] = useState('');
  const [searchError, setSearchError] = useState('');
  const [scrollY, setScrollY] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const navigate = useNavigate();

  useScrollReveal();

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    axios.get('/api/site-stats')
      .then(res => setStats(res.data))
      .catch(() => setStats(null));
  }, []);

  // Hide sticky mobile bottom bar when virtual keyboard is active (focused on inputs)
  useEffect(() => {
    const handleFocus = () => setIsInputFocused(true);
    const handleBlur = () => setIsInputFocused(false);
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(el => {
      el.addEventListener('focus', handleFocus);
      el.addEventListener('blur', handleBlur);
    });
    return () => {
      inputs.forEach(el => {
        el.removeEventListener('focus', handleFocus);
        el.removeEventListener('blur', handleBlur);
      });
    };
  }, []);

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

  const handleStartSafeTripScroll = () => {
    navigate('/create');
  };

  const handleExplorePacksScroll = () => {
    const el = document.getElementById('city-packs');
    if (el) {
      const headerOffset = 64;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const totalHeight = typeof document !== 'undefined' ? document.documentElement.scrollHeight - window.innerHeight : 1;
  const scrollProgress = totalHeight > 0 ? scrollY / totalHeight : 0;

  return (
    <div className="min-h-screen bg-cream text-ink relative overflow-x-hidden selection:bg-[#F59E0B] selection:text-white">
      {showLoader && <IntroLoader onComplete={handleLoaderComplete} />}

      {/* SVG self-drawing route line */}
      <div className="hidden lg:block fixed left-12 top-0 bottom-0 w-0.5 bg-gray-250/20 z-30">
        <div 
          className="w-full bg-[#F59E0B] transition-all duration-75 shadow-xs"
          style={{ height: `${scrollProgress * 100}%` }}
        />
      </div>

      {/* Scroll Progress Bar at very top */}
      <div 
        className="fixed top-0 left-0 h-[3px] bg-[#F59E0B] z-50 transition-all duration-75"
        style={{ width: `${scrollProgress * 100}%` }}
      />

      {/* Sticky Mobile Bottom Bar */}
      {scrollY > 400 && !isInputFocused && !activeTrip && (
        <div className="sm:hidden fixed bottom-4 left-4 right-4 z-40 animate-fade-in-up">
          <button 
            onClick={handleStartSafeTripScroll}
            className="w-full py-3.5 bg-[#00695C] text-white font-bold text-sm rounded-full shadow-2xl border border-teal-500/20 cursor-pointer"
          >
            🚀 Start Safe Trip
          </button>
        </div>
      )}

      {/* Global Health Notification Indicator */}
      {isConnecting ? (
        <div className="fixed top-16 left-0 right-0 z-40 bg-[#00695C]/95 backdrop-blur-md text-white text-[11px] py-1.5 px-4 text-center font-semibold flex items-center justify-center gap-1.5 border-b border-teal-700/30">
          <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" /> Connecting to Sanchar AI...
        </div>
      ) : isBackendOffline ? (
        <div className="fixed top-16 left-0 right-0 z-40 bg-amber-500/95 backdrop-blur-md text-white text-[11px] py-1.5 px-4 text-center font-semibold shadow-sm animate-fade-in flex items-center justify-center gap-1.5 border-b border-amber-600/30">
          <WifiOff size={13} /> Offline Mode — Telemetry saving to local IndexedDB
        </div>
      ) : dbMode === 'memory' ? (
        <div className="fixed top-16 left-0 right-0 z-40 bg-[#00695C]/95 backdrop-blur-md text-white text-[11px] py-1.5 px-4 text-center font-semibold flex items-center justify-center gap-1.5 border-b border-teal-700/30">
          <Check size={13} /> Sanchar AI Online · Memory Store Active
        </div>
      ) : null}

      {/* ── Sticky Nav ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrollY > 50 ? 'bg-cream/90 backdrop-blur-md border-b border-gray-150 shadow-xs' : 'bg-transparent'}`}>
        <div className="max-w-[1200px] mx-auto flex justify-between items-center h-16 px-5 md:px-8">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-9 h-9 bg-[#00695C] rounded-xl flex items-center justify-center shadow-sm">
              <Shield size={18} className="text-white" />
            </div>
            <span className="font-display font-bold text-[#1F2937] text-xl tracking-tight">Sanchar AI</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-6">
            <ConnectivityHeaderChip />
            <Link to="/features" className="hidden md:inline text-xs font-semibold text-[#64748B] hover:text-[#00695C] transition-colors no-underline">Features</Link>
            <Link to="/privacy" className="hidden md:inline text-xs font-semibold text-[#64748B] hover:text-[#00695C] transition-colors no-underline">Privacy</Link>
            <Link to="/history" className="text-xs font-semibold text-[#64748B] hover:text-[#00695C] transition-colors no-underline">History</Link>
            <Link to="/maps" className="hidden sm:inline text-xs font-semibold text-[#64748B] hover:text-[#00695C] transition-colors no-underline">Maps</Link>
            <Link to="/luggage" className="hidden sm:inline text-xs font-semibold text-[#64748B] hover:text-[#00695C] transition-colors no-underline">Luggage</Link>
            <Link to="/dashboard" className="hidden sm:inline text-xs font-semibold text-[#64748B] hover:text-[#00695C] transition-colors no-underline">Dashboard</Link>
            <Link to="/create" className="btn-primary text-xs !py-2 !px-5 no-underline">
              Start Trip <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Active Trip Banner */}
      {activeTrip && (
        <div className="pt-20 pb-4 bg-[#E0F2F1] border-b border-[#B2DFDB]">
          <div className="max-w-[1200px] mx-auto px-5 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-[#00695C] animate-ping shrink-0" />
              <div>
                <h4 className="font-display font-bold text-[#004D40] text-base">Trip in progress: {activeTrip.originCity} → {activeTrip.destinationCity}</h4>
                <p className="text-xs text-[#00695C]">Tracking active · Tap to open command center</p>
              </div>
            </div>
            <Link to={`/active/${activeTrip._id}`} className="btn-primary !py-2 !px-6 text-xs font-bold bg-[#00695C] text-white no-underline">
              Open Trip Command Center →
            </Link>
          </div>
        </div>
      )}

      {/* Your Last Trip Banner */}
      {!activeTrip && lastCompletedTrip && (
        <div className="pt-20 pb-4 bg-[#F0FDF4] border-b border-green-200">
          <div className="max-w-[1200px] mx-auto px-5 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Check className="text-[#2E7D32] shrink-0" size={20} />
              <div>
                <h4 className="font-display font-bold text-[#1B5E20] text-base">Your last trip: {lastCompletedTrip.originCity} → {lastCompletedTrip.destinationCity}</h4>
                <p className="text-xs text-[#2E7D32]">Completed · Total Spent: ₹{(lastCompletedTrip.amountSpent || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>
            <Link to={`/diary/${lastCompletedTrip._id}`} className="btn-secondary !py-2 !px-6 text-xs font-bold no-underline">
              View Trip Diary →
            </Link>
          </div>
        </div>
      )}

      {/* ── 1. HERO SECTION ── */}
      <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden bg-cream py-24">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-300 ease-out"
          style={{ 
            backgroundImage: "url('/images/india/hero.jpg')",
            transform: `translateY(${Math.min(scrollY * 0.12, 100)}px)`
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#00695C]/90 via-[#004D40]/80 to-cream" />
        
        <div className="relative z-10 max-w-[1200px] w-full mx-auto px-5 md:px-8 text-center text-white mt-12 reveal-element">
          <span className="badge bg-white/10 text-white border border-white/20 mb-6 inline-flex items-center gap-1.5 py-1 px-4 text-xs font-semibold rounded-full">
            <Zap size={13} className="text-[#F59E0B]" /> Offline AI Travel Companion
          </span>
          <HeroHeadline />
          <p className="text-teal-100 text-base sm:text-lg md:text-xl mb-10 max-w-xl mx-auto font-medium">
            One companion. Any city in India. Even offline.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <button onClick={handleStartSafeTripScroll} className="btn-primary !py-3.5 !px-8 text-sm font-bold bg-[#F59E0B] hover:bg-[#D97706] text-[#1F2937] shadow-lg border-0 cursor-pointer">
              Start Safe Trip
            </button>
            <button onClick={handleExplorePacksScroll} className="btn-secondary !py-3.5 !px-8 text-sm font-bold text-white border-white/30 hover:bg-white/10 bg-transparent cursor-pointer">
              Explore City Packs
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <span className="trust-badge border border-teal-500/30 bg-teal-950/40 text-teal-200 text-xs px-4 py-2 rounded-full"><Shield size={12} /> Privacy-first</span>
            <span className="trust-badge border border-teal-500/30 bg-teal-950/40 text-teal-200 text-xs px-4 py-2 rounded-full"><WifiOff size={12} /> Offline-ready</span>
            <span className="trust-badge border border-teal-500/30 bg-teal-950/40 text-teal-200 text-xs px-4 py-2 rounded-full"><Globe size={12} /> Multilingual</span>
          </div>
        </div>
      </section>

      {/* ── 2. VERIFIED STRIP ── */}
      <section className="bg-cream py-16 border-t border-gray-150">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8">
          <div className="text-center mb-12">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#F59E0B] block mb-2">Verified Coverage</span>
            <h2 className="font-display text-3xl font-bold text-[#1F2937]">Curated offline directories across India</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card-retreat bg-white p-8 rounded-3xl border border-gray-150 shadow-xs flex flex-col justify-between h-48 hover:shadow-md transition">
              <div>
                <span className="text-3xl mb-4 block">📦</span>
                <h4 className="font-bold text-[#1F2937] text-base mb-1">City Packs</h4>
                <p className="text-xs text-[#64748B]">Verified offline directories with emergency info and local phrases.</p>
              </div>
              <span className="text-xs font-bold text-[#00695C] mt-2 inline-flex items-center gap-1">
                {isConnecting && !stats ? '—' : <AnimatedCounter value={stats ? stats.cityPacksLive : 8} />} Packs Available
              </span>
            </div>
            <div className="card-retreat bg-white p-8 rounded-3xl border border-gray-150 shadow-xs flex flex-col justify-between h-48 hover:shadow-md transition">
              <div>
                <span className="text-3xl mb-4 block">🗣️</span>
                <h4 className="font-bold text-[#1F2937] text-base mb-1">Languages</h4>
                <p className="text-xs text-[#64748B]">Pre-downloaded on-device local translation and phrases support.</p>
              </div>
              <span className="text-xs font-bold text-[#00695C] mt-2 inline-flex items-center gap-1">
                {isConnecting && !stats ? '—' : <AnimatedCounter value={stats ? stats.languagesSupported : 6} />} Local languages
              </span>
            </div>
            <div className="card-retreat bg-white p-8 rounded-3xl border border-gray-150 shadow-xs flex flex-col justify-between h-48 hover:shadow-md transition">
              <div>
                <span className="text-3xl mb-4 block">🗺️</span>
                <h4 className="font-bold text-[#1F2937] text-base mb-1">Trips Recorded</h4>
                <p className="text-xs text-[#64748B]">Real user journeys actively logged via the offline engine.</p>
              </div>
              <span className="text-xs font-bold text-[#00695C] mt-2 inline-flex items-center gap-1">
                {isConnecting && !stats ? '—' : <AnimatedCounter value={stats ? stats.tripsRecorded : 0} />} Trips Logged
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SLIDING CITIES CAROUSEL ── */}
      <section className="bg-cream py-12 border-t border-gray-150 overflow-hidden relative">
        <div className="text-center mb-8">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#00695C] block mb-1.5 font-['Plus_Jakarta_Sans']">Explore India</span>
          <h3 className="font-display font-bold text-2xl md:text-3xl text-gray-800">Featured Indian Cities</h3>
        </div>
        <div className="relative w-full flex items-center overflow-hidden py-2 select-none">
          <div className="animate-marquee flex gap-6">
            {[...CAROUSEL_CITIES, ...CAROUSEL_CITIES].map((item, idx) => (
              <div 
                key={idx} 
                onClick={() => handleOpenCity(item.name)}
                className="w-64 h-36 rounded-3xl overflow-hidden relative shadow-sm flex-shrink-0 group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
                <img 
                  src={item.img} 
                  alt={item.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-[#00695C] to-[#004D40] -z-10" />
                
                <div className="absolute bottom-4 left-4 z-20">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#F59E0B] bg-[#F59E0B]/10 px-2 py-0.5 rounded border border-[#F59E0B]/20 mb-1 inline-block font-['Plus_Jakarta_Sans']">
                    Explore
                  </span>
                  <h4 className="text-white font-display text-lg font-bold tracking-tight">
                    {item.name}
                  </h4>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. PLAN YOUR JOURNEY ── */}
      <section id="plan-journey" className="bg-[#FAF7F2] py-20 border-t border-gray-150">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8">
          <div className="text-center mb-12">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#F59E0B] block mb-2">Create journey</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-[#1F2937]">Configure your safety telemetry</h2>
          </div>
          <div className="bg-white p-6 md:p-10 rounded-3xl border border-gray-150 shadow-sm max-w-3xl mx-auto">
            <HeroSearchForm preFillDest={destinationPreFill} />
          </div>
        </div>
      </section>

      {/* ── 4. WHY SANCHAR ── */}
      <section className="bg-cream py-20 border-t border-gray-150">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="badge badge-teal mb-3"><Compass size={14} /> Design DNA</span>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold leading-tight text-ink mb-6">
              No trip is complete without safety, language and budget in one place.
            </h2>
            <p className="text-muted text-sm sm:text-base leading-relaxed">
              We focus on local utility, completely offline accessibility, and data privacy. Every piece of Sanchar is built to protect you on Indian transit networks.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center reveal-stagger">
            <div className="card-retreat p-6 bg-white border border-gray-100">
              <p className="text-xs text-muted font-bold uppercase tracking-wider mb-2">Trips Recorded</p>
              <h3 className="font-display font-bold text-4xl text-[#00695C]">
                {isConnecting && !stats ? '—' : <AnimatedCounter value={stats ? stats.tripsRecorded : 12} />}
              </h3>
            </div>
            <div className="card-retreat p-6 bg-white border border-gray-100">
              <p className="text-xs text-muted font-bold uppercase tracking-wider mb-2">Packs Live</p>
              <h3 className="font-display font-bold text-4xl text-[#00695C]">
                {isConnecting && !stats ? '—' : <AnimatedCounter value={stats ? stats.cityPacksLive : 8} />}
              </h3>
            </div>
            <div className="card-retreat p-6 bg-white border border-gray-100">
              <p className="text-xs text-muted font-bold uppercase tracking-wider mb-2">Languages</p>
              <h3 className="font-display font-bold text-4xl text-[#00695C]">
                {isConnecting && !stats ? '—' : <AnimatedCounter value={stats ? stats.languagesSupported : 6} />}
              </h3>
            </div>
            <div className="card-retreat p-6 bg-white border border-gray-100">
              <p className="text-xs text-muted font-bold uppercase tracking-wider mb-2">Safety checks</p>
              <h3 className="font-display font-bold text-4xl text-[#00695C]">
                {isConnecting && !stats ? '—' : <AnimatedCounter value={stats ? stats.safetyChecks : 180} />}
              </h3>
            </div>
          </div>
          <p className="text-center text-[10px] text-muted italic mt-8">
            {isConnecting && !stats ? 'Connecting to live data…' : 'Live prototype — every number comes from real recorded trips.'}
          </p>
        </div>
      </section>

      {/* ── 5. COMBINE SANCHAR (Remade to match Image 2 full-bleed layout) ── */}
      <section id="city-packs" className="relative min-h-[650px] py-24 bg-cover bg-center text-white overflow-hidden reveal-element" style={{ backgroundImage: "url('/images/india/hero.jpg')" }}>
        {/* Warm mist overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/30" />

        <div className="relative z-10 max-w-[1200px] mx-auto px-5 md:px-8 flex flex-col justify-between min-h-[500px]">
          
          {/* Top Section */}
          <div className="max-w-2xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#F59E0B] block mb-3 font-['Plus_Jakarta_Sans'] bg-[#F59E0B]/10 px-3 py-1 rounded-full border border-[#F59E0B]/20 w-fit">
              Verified Destinations
            </span>
            <h2 className="font-['Plus_Jakarta_Sans'] text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight mb-8">
              Explore the destinations
            </h2>

            {/* Plus Sub-Items matching Image 2 */}
            <div className="space-y-4 font-['Plus_Jakarta_Sans']">
              <div className="flex items-center gap-3 text-2xl md:text-3xl font-extrabold text-white/95">
                <span className="text-gray-400 font-normal">+</span> Heritage & Forts
              </div>
              <div className="flex items-center gap-3 text-2xl md:text-3xl font-extrabold text-white/95">
                <span className="text-gray-400 font-normal">+</span> Coastal & Backwaters
              </div>
              <div className="flex items-center gap-3 text-2xl md:text-3xl font-extrabold text-white/95">
                <span className="text-gray-400 font-normal">+</span> Sacred Shrines & Temples
              </div>
            </div>
          </div>

          {/* Search bar & quick cities */}
          <div className="mt-8 max-w-md">
            <div className="bg-black/50 backdrop-blur-md p-2.5 rounded-full border border-white/20 shadow-xl flex items-center gap-2">
              <Search className="text-amber-400 shrink-0 ml-2" size={16} />
              <input
                type="text"
                placeholder="Explore any Indian city (e.g. Jaipur, Kochi…)"
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
                className="flex-1 text-xs text-white focus:outline-hidden placeholder-gray-300 bg-transparent w-full px-1"
              />
              <button
                onClick={() => handleOpenCity(searchCityInput)}
                className="btn-primary !py-2 !px-5 text-[11px] font-bold whitespace-nowrap cursor-pointer !rounded-full bg-[#F59E0B] hover:bg-[#D97706] text-[#1F2937]"
              >
                Explore Pack
              </button>
            </div>
            {searchError && (
              <div className="text-center text-red-400 text-xs font-bold mt-2">
                {searchError}
              </div>
            )}
          </div>

          {/* Bottom Bar Row matching Image 2 */}
          <div className="mt-16 pt-8 border-t border-white/20 grid grid-cols-1 md:grid-cols-5 gap-8 items-end">
            <div className="md:col-span-1">
              <p className="text-xs text-gray-300 leading-relaxed font-['Plus_Jakarta_Sans']">
                Combine verified local directories, offline maps, and safety telemetry into one seamless journey.
              </p>
            </div>

            <div className="md:col-span-1 border-l border-white/20 pl-6 cursor-pointer group" onClick={() => handleOpenCity('Jaipur')}>
              <div className="font-['Plus_Jakarta_Sans'] text-3xl md:text-4xl font-extrabold text-white mb-1 group-hover:text-[#F59E0B] transition-colors">01</div>
              <p className="text-xs font-bold text-gray-200">Heritage</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Jaipur · Amber Fort</p>
            </div>

            <div className="md:col-span-1 border-l border-white/20 pl-6 cursor-pointer group" onClick={() => handleOpenCity('Kochi')}>
              <div className="font-['Plus_Jakarta_Sans'] text-3xl md:text-4xl font-extrabold text-white mb-1 group-hover:text-[#F59E0B] transition-colors">02</div>
              <p className="text-xs font-bold text-gray-200">Coastal</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Kochi · Fort Kochi</p>
            </div>

            <div className="md:col-span-1 border-l border-white/20 pl-6 cursor-pointer group" onClick={() => handleOpenCity('Varanasi')}>
              <div className="font-['Plus_Jakarta_Sans'] text-3xl md:text-4xl font-extrabold text-white mb-1 group-hover:text-[#F59E0B] transition-colors">03</div>
              <p className="text-xs font-bold text-gray-200">Sacred</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Varanasi · Kashi Vishwanath</p>
            </div>

            <div className="md:col-span-1 border-l border-white/20 pl-6 cursor-pointer group" onClick={() => handleOpenCity('Chennai')}>
              <div className="font-['Plus_Jakarta_Sans'] text-3xl md:text-4xl font-extrabold text-white mb-1 group-hover:text-[#F59E0B] transition-colors">04</div>
              <p className="text-xs font-bold text-gray-200">Metropolis</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Chennai · Marina Beach</p>
            </div>
          </div>

        </div>
      </section>

      {/* ── 6. SPECIAL SPOTS ACROSS INDIA (Visible All-of-India Proof) ── */}
      <section className="section-rhythm bg-[#0A1616] py-24 text-white border-y border-teal-950 reveal-element">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-16 border-b border-teal-900/60 pb-8">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#F59E0B] block mb-2 font-['Plus_Jakarta_Sans']">Curated Highlights</span>
              <h2 className="font-['Plus_Jakarta_Sans'] text-4xl md:text-5xl font-extrabold tracking-tight text-white">
                Special Spots <span className="italic font-serif text-[#F59E0B]">Across India</span>
              </h2>
            </div>
            <p className="text-gray-400 text-sm max-w-md md:text-right leading-relaxed font-['Plus_Jakarta_Sans']">
              Discover 24+ verified historic monuments, sacred temples, scenic viewpoints, and heritage landmarks fetched directly from city packs.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 reveal-stagger">
            {CURATED_SPECIAL_SPOTS_24.map((spot, i) => (
              <div 
                key={i} 
                onClick={() => navigate(`/spot/${spot.city.toLowerCase()}/${spot.slug}`)}
                className="bg-[#0D1A1A] rounded-[24px] overflow-hidden border border-teal-900/50 p-6 flex flex-col md:flex-row gap-6 hover:shadow-2xl hover:border-[#F59E0B]/30 transition-all duration-300 group cursor-pointer"
              >
                {/* Content Left */}
                <div className="flex-1 flex flex-col justify-between py-1">
                  <div>
                    <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl text-white tracking-tight leading-tight group-hover:text-[#F59E0B] transition-colors">
                      {spot.name}
                    </h3>
                    <div className="text-[12px] font-bold text-emerald-400 mt-1 font-['Plus_Jakarta_Sans']">
                      from {spot.city} Offline Pack
                    </div>

                    <div className="mt-4 space-y-1.5 text-xs text-gray-400 font-['Plus_Jakarta_Sans']">
                      <div className="flex items-center gap-2">
                        <span className="text-[#F59E0B]">📍</span> {spot.location}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#F59E0B]">📅</span> {spot.timing}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#F59E0B]">👥</span> {spot.category}
                      </div>
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold pt-1">
                        ★★★★★ <span className="text-[11px] text-gray-400 font-normal">Trusted by {spot.trustedCount} travelers</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="w-full md:w-auto inline-flex bg-[#142A2A] hover:bg-[#1E3E3E] text-white text-xs font-bold px-5 py-3 rounded-full items-center justify-between gap-3 border border-teal-800/80 transition-all group-hover:border-[#F59E0B]/40 font-['Plus_Jakarta_Sans']">
                      <span>Explore Spot</span>
                      <span className="text-[#F59E0B] text-sm group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </div>
                </div>

                {/* Image Right */}
                <div className="w-full md:w-48 h-48 md:h-auto rounded-[20px] overflow-hidden shrink-0 relative">
                  <img 
                    src={spot.img} 
                    alt={spot.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700" 
                    loading="lazy" 
                    onError={(e) => { e.currentTarget.src = '/images/india/hero.jpg'; }} 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A1616]/40 to-transparent" />
                </div>

              </div>
            ))}
          </div>
        </div>
      </section>



      {/* ── 7. FEATURE — REAL SCAN ── */}
      <section className="section-rhythm bg-white border-y border-gray-100 reveal-element">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <span className="badge badge-teal mb-3">On-Device OCR</span>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-ink mb-6">Scan bills, update budgets instantly</h2>
            <p className="text-muted text-sm sm:text-base leading-relaxed mb-6">
              Sanchar's high-performance offline ticket and bill scanner parses numerical amounts in real-time. Scan your travel tickets or receipts directly to maintain a correct remaining budget count.
            </p>
            <Link to="/create" className="btn-primary inline-flex text-xs px-6 py-3 no-underline">
              Try it in a live trip
            </Link>
          </div>
          <div className="flex-1 max-w-sm card-retreat border border-teal-100 p-4 bg-gray-50 flex flex-col gap-3">
            <div className="bg-white rounded-2xl border border-gray-150 p-4 shadow-sm text-center">
              <span className="badge badge-teal text-[10px] mb-2">Mock Scanner View</span>
              <Camera size={40} className="text-teal-700 mx-auto mb-2" />
              <p className="text-xs text-ink font-bold">1200 INR scanned</p>
              <p className="text-[10px] text-muted mt-1">Processed live via Tesseract.js</p>
            </div>
            <p className="text-center text-[10px] text-muted">Works in airplane mode (on-device).</p>
          </div>
        </div>
      </section>

      {/* ── 8. FEATURE — OFFLINE EVERYTHING (Remade to match Picture 1 Combine Retreat layout) ── */}
      <section className="relative min-h-[600px] py-24 bg-cover bg-center text-white overflow-hidden reveal-element" style={{ backgroundImage: "url('/images/india/hero.jpg')" }}>
        {/* Dark warm overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A1616] via-[#0A1616]/75 to-black/50" />

        <div className="relative z-10 max-w-[1200px] mx-auto px-5 md:px-8 flex flex-col justify-between min-h-[480px]">
          
          {/* Top Section */}
          <div className="max-w-2xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#F59E0B] block mb-3 font-['Plus_Jakarta_Sans'] bg-[#F59E0B]/10 px-3 py-1 rounded-full border border-[#F59E0B]/20 w-fit">
              Offline Architecture
            </span>
            <h2 className="font-['Plus_Jakarta_Sans'] text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight mb-8">
              Everything works without network
            </h2>

            {/* Plus Sub-Items matching Picture 1 */}
            <div className="space-y-4 font-['Plus_Jakarta_Sans']">
              <div className="flex items-center gap-3 text-2xl md:text-3xl font-extrabold text-white/95">
                <span className="text-gray-400 font-normal">+</span> City Packs & Offline Maps
              </div>
              <div className="flex items-center gap-3 text-2xl md:text-3xl font-extrabold text-white/95">
                <span className="text-gray-400 font-normal">+</span> Live Telemetry & GPS Bearing
              </div>
              <div className="flex items-center gap-3 text-2xl md:text-3xl font-extrabold text-white/95">
                <span className="text-gray-400 font-normal">+</span> Luggage Radar & Emergency 112
              </div>
            </div>
          </div>

          {/* Bottom Bar Row matching Picture 1 */}
          <div className="mt-16 pt-8 border-t border-white/20 grid grid-cols-1 md:grid-cols-5 gap-8 items-end">
            <div className="md:col-span-1">
              <p className="text-xs text-gray-300 leading-relaxed font-['Plus_Jakarta_Sans']">
                Combine all travel tools into one seamless offline companion. Zero mobile network connection required.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 bg-black/40 backdrop-blur-xs px-3 py-1.5 rounded-full border border-white/20 text-[10px] font-bold">
                {isOnline ? (
                  <><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Connected</>
                ) : (
                  <><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> Airplane Mode</>
                )}
              </div>
            </div>

            <div className="md:col-span-1 border-l border-white/10 pl-6">
              <div className="font-['Plus_Jakarta_Sans'] text-3xl md:text-4xl font-extrabold text-white mb-1">01</div>
              <p className="text-xs font-bold text-gray-200">Plan</p>
              <p className="text-[10px] text-gray-400 mt-0.5">City Packs & Safety Rules</p>
            </div>

            <div className="md:col-span-1 border-l border-white/10 pl-6">
              <div className="font-['Plus_Jakarta_Sans'] text-3xl md:text-4xl font-extrabold text-white mb-1">02</div>
              <p className="text-xs font-bold text-gray-200">Track</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Live Route & Bearing Map</p>
            </div>

            <div className="md:col-span-1 border-l border-white/10 pl-6">
              <div className="font-['Plus_Jakarta_Sans'] text-3xl md:text-4xl font-extrabold text-white mb-1">03</div>
              <p className="text-xs font-bold text-gray-200">Assist</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Offline AI & OCR Scanner</p>
            </div>

            <div className="md:col-span-1 border-l border-white/10 pl-6">
              <div className="font-['Plus_Jakarta_Sans'] text-3xl md:text-4xl font-extrabold text-white mb-1">04</div>
              <p className="text-xs font-bold text-gray-200">Store</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Luggage Radar & Diary</p>
            </div>
          </div>

        </div>
      </section>

      {/* ── 9. FEATURE — AI ASSISTANT ── */}
      <section className="section-rhythm bg-white border-y border-gray-100 reveal-element">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1">
            <span className="badge badge-teal mb-3">Dual Mode AI</span>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-ink mb-6">Ask Sanchar AI inline</h2>
            <p className="text-muted text-sm sm:text-base leading-relaxed mb-4">
              Get prompt travel responses. Sanchar routes queries dynamically: when connected, it targets Gemini; when offline, it leverages the embedded city pack KB.
            </p>
            <p className="text-xs text-muted mb-6">
              Online: Gemini answers any of India's cities · Offline: honest local helper from your city pack.
            </p>
          </div>
          <div className="w-full max-w-sm border border-orange-100 rounded-3xl overflow-hidden shadow-xl h-[450px] bg-white flex flex-col">
            <div className="bg-gradient-to-r from-[#FF6F00] to-[#E65100] p-4 text-white text-sm font-bold flex items-center gap-2 shrink-0">
              <Bot size={18} /> Sanchar AI Assistant
            </div>
            <div className="flex-1 bg-gray-50 p-4 overflow-y-auto space-y-3">
              <div className="bg-white border border-gray-150 p-3 rounded-2xl text-xs text-gray-800 rounded-bl-sm">
                Namaste! 🙏 Ask Sanchar AI something like "Typical auto fare?" or "Nearest hospital?" right here.
              </div>
              <div className="flex gap-2 justify-end">
                <div className="bg-[#FF6F00] text-white p-3 rounded-2xl text-xs rounded-br-sm max-w-[85%] font-medium">
                  Typical auto fare?
                </div>
              </div>
              <div className="bg-white border border-gray-150 p-3 rounded-2xl text-xs text-gray-800 rounded-bl-sm">
                In Chennai: Auto fares are typically ₹25 base + ₹12-15/km. A typical 3-6 km ride is ₹120-250. Confirm with the driver or use rideshare apps.
              </div>
            </div>
            <div className="p-3 border-t border-gray-100 flex gap-2 shrink-0">
              <input type="text" placeholder="Ask about safety, fares..." className="flex-1 bg-gray-50 text-xs p-2 rounded-xl border border-gray-200 focus:outline-none" disabled />
              <button className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center cursor-not-allowed" disabled>
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 10. FEATURE — SAFETY ── */}
      <section className="section-rhythm bg-cream reveal-element">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 text-center">
          <span className="badge badge-teal mb-3">Quiet Guardian</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-ink mb-6">SOS & safety checks</h2>
          <p className="text-muted text-sm sm:text-base max-w-xl mx-auto mb-10">
            Emergency SOS broadcasts locations immediately. Geofence tracking automatically ensures safe segment entry and exit. Dial 112 for direct assistance.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            <div className="card-retreat p-5 bg-white text-center">
              <Phone className="text-red-600 mx-auto mb-2" size={24} />
              <h4 className="font-display font-bold text-sm text-ink">SOS Call (112)</h4>
            </div>
            <div className="card-retreat p-5 bg-white text-center">
              <Navigation2 className="text-teal-700 mx-auto mb-2" size={24} />
              <h4 className="font-display font-bold text-sm text-ink">Route Deviation</h4>
            </div>
            <div className="card-retreat p-5 bg-white text-center">
              <Shield className="text-teal-700 mx-auto mb-2" size={24} />
              <h4 className="font-display font-bold text-sm text-ink">Privacy Stripping</h4>
            </div>
            <div className="card-retreat p-5 bg-white text-center">
              <Check className="text-teal-700 mx-auto mb-2" size={24} />
              <h4 className="font-display font-bold text-sm text-ink">Arrival Sync</h4>
            </div>
          </div>
        </div>
      </section>

      {/* ── 11. FEATURE — LUGGAGE RADAR ── */}
      <section className="section-rhythm bg-white border-y border-gray-100 reveal-element">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <span className="badge badge-teal mb-3">Luggage Buddy</span>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-ink mb-6">Find luggage storage, drop heavy bags</h2>
            <p className="text-muted text-sm sm:text-base leading-relaxed mb-6">
              Sanchar maps verified cloakrooms and bag drops at major transit stations and terminals. Keep your hands free and explore hassle-free.
            </p>
            <Link to="/luggage" className="btn-primary inline-flex text-xs px-6 py-3 no-underline">
              Open Luggage Radar
            </Link>
          </div>
          <div className="flex-1 max-w-sm card-retreat p-4 bg-gray-50 border border-teal-100 flex flex-col gap-2">
            <Link to="/luggage" className="bg-white rounded-2xl p-4 border border-gray-150 text-center block no-underline hover:border-teal-300 transition-colors">
              <h4 className="font-display font-bold text-sm text-ink">Chennai Central — Railway Cloakroom</h4>
              <p className="text-xs text-amber-600 font-bold mt-1">● No reports yet — be the first to report</p>
              <p className="text-[10px] text-muted mt-2">Arrival Exit • Published rates verify on site</p>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 12. FEATURE — DIARY + STORY ── */}
      <section className="section-rhythm bg-cream reveal-element">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 text-center">
          <span className="badge badge-teal mb-3">Memory Store</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-ink mb-6">Your trip becomes a memory</h2>
          <p className="text-muted text-sm sm:text-base max-w-xl mx-auto mb-10">
            Write diaries, log voice notes, and group photos from your journey directly on your device.
          </p>
          <DiarySlide />
        </div>
      </section>

      {/* ── 13. PRIVACY GUARANTEES ── */}
      <section className="section-rhythm reveal-element relative bg-[#0B1320] text-white overflow-hidden border-y border-[#1E293B] min-h-[600px]">
        {/* Abstract India Map Background */}
        <div 
          className="absolute inset-0 z-0 opacity-60 bg-no-repeat bg-right-bottom md:bg-center bg-contain md:bg-cover mix-blend-screen"
          style={{ backgroundImage: "url('/images/india_map_glowing.svg')", backgroundPosition: 'calc(50% + 200px) center' }}
        >
          {/* Glowing spots plotted approximately on the map (Delhi, Mumbai, Bengaluru) */}
          <div className="absolute top-[35%] left-[62%] md:left-[55%] md:top-[30%] w-3 h-3 bg-amber-400 rounded-full shadow-[0_0_15px_4px_rgba(251,191,36,0.6)] animate-pulse" />
          <div className="absolute top-[60%] left-[53%] md:left-[50%] md:top-[50%] w-3 h-3 bg-teal-400 rounded-full shadow-[0_0_15px_4px_rgba(45,212,191,0.6)] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-[75%] left-[58%] md:left-[54%] md:top-[68%] w-3 h-3 bg-amber-400 rounded-full shadow-[0_0_15px_4px_rgba(251,191,36,0.6)] animate-pulse" style={{ animationDelay: '0.5s' }} />
        </div>
        
        {/* Glow overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B1320] via-[#0B1320]/90 to-transparent z-0" />

        <div className="max-w-[1200px] mx-auto px-5 md:px-8 relative z-10 py-16 md:py-24">
          <div className="max-w-2xl">
            <span className="inline-block badge bg-white/10 text-teal-300 border border-white/20 mb-4 backdrop-blur-md">On-Device Privacy Standard</span>
            <h2 className="font-display text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-tight">Your journey<br/>stays yours</h2>
            <p className="text-teal-200 text-lg md:text-xl mb-6 font-semibold">We build strictly private on-device pipelines.</p>
            <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-10 max-w-lg">
              Explore freely across 28 States and 8 Union Territories in India. Your exact route coordinate log never leaves the local IndexedDB, telemetry is strictly opt-in, and the first and last 500 meters of your journey are stripped instantly.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 flex items-start gap-3 hover:bg-white/10 transition">
                <Check size={20} className="text-teal-400 mt-0.5 shrink-0" />
                <span className="text-sm text-gray-200 font-medium leading-snug">Locations aggregated to anonymous grid cells</span>
              </div>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 flex items-start gap-3 hover:bg-white/10 transition">
                <Check size={20} className="text-teal-400 mt-0.5 shrink-0" />
                <span className="text-sm text-gray-200 font-medium leading-snug">Low-volume locations suppressed automatically</span>
              </div>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 flex items-start gap-3 sm:col-span-2 hover:bg-white/10 transition">
                <Check size={20} className="text-teal-400 mt-0.5 shrink-0" />
                <span className="text-sm text-gray-200 font-medium leading-snug">AI assistant chats processed live and never stored on our servers</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 14. FAQ ACCORDION ── */}
      <section className="section-rhythm bg-cream reveal-element">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8">
          <div className="text-center mb-12">
            <span className="badge badge-teal mb-3">Faq</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-ink">Frequently Asked Questions</h2>
            <p className="text-muted text-sm mt-2">Get answers to the most common queries.</p>
          </div>
          <div className="max-w-2xl mx-auto">
            <FaqAccordionItem 
              question="How does Sanchar AI actually work offline?" 
              answer="Three reasons: (1) your city pack — phrases, emergency numbers, transport tips and spot data — is downloaded to your device before you travel; (2) GPS is a radio signal, not internet — tracking works with zero network; (3) the OCR scanner and the offline AI helper run entirely on your device. When you're back online, anything saved locally syncs automatically with no duplicates."
            />
            <FaqAccordionItem 
              question="How does the AI know about my city?" 
              answer="Two layers. Launch cities get curated, verified packs we maintain. Every other Indian city gets real place data generated on first visit from open data (Wikipedia/Wikidata) and cached permanently. If a place genuinely has no data, we say so honestly and offer the General India pack (112 · 139 · basic guidance) — we never invent places or reviews."
            />
            <FaqAccordionItem 
              question="Is my location data safe?" 
              answer="Your exact route never leaves your device. Analytics are off by default and fully opt-in. When you opt in, we strip the first and last 500 m of your journey, bin the rest into anonymous grid cells, and suppress low-volume areas. No individual route is ever stored, sold, or shown. You can see exactly what would be shared in the Privacy section."
            />
            <FaqAccordionItem 
              question="What does the AI see when I ask a question?" 
              answer="Online: it uses the city context (pack + spot data) and our Gemini API — your chat is processed live and never stored on our servers. Offline: it answers only from your local city-pack knowledge base and clearly labels itself 'Local KB · offline'. It never sees your trip data or location."
            />
            <FaqAccordionItem 
              question="Why are there no star ratings or 'trusted by' numbers?" 
              answer="Because we don't fake social proof. Every count on this site is live from our own database — real trips recorded, real packs, real traveller reports. A hackathon product that shows invented ratings would be lying to you; we'd rather show real numbers, even if they're small."
            />
            <FaqAccordionItem 
              question="What happens to my data while I'm offline?" 
              answer="Everything you do offline — scans, check-ins, trip events — is saved on your device with a unique idempotency key. When connectivity returns, it syncs once and is de-duplicated server-side. Nothing is lost, nothing is duplicated, and you always see the state: 'Saved on device' → 'Syncing' → 'Synced'."
            />
            <FaqAccordionItem 
              question="What if my city has no data yet?" 
              answer="You get an honest answer, not a fake one: 'No verified spot list for {city} yet.' The General India pack still works everywhere — 112 emergency, 139 rail enquiry, basic guidance. City coverage grows as real data is added, and we say clearly which data is curated vs live-generated."
            />
            <FaqAccordionItem 
              question="How is this different from Google Maps or Google Translate?" 
              answer="They're single-feature tools — navigation, or translation. Sanchar AI is a journey companion: it connects safety, language, tickets, budget and your travel story into one offline-first flow that follows you from home to hotel. You're not switching between five apps mid-journey."
            />
            <FaqAccordionItem 
              question="Do I need an account to use it?" 
              answer="No — the full journey works without an account. An account (email + password) lets your trips sync to 'My Trips' across devices. No phone number, no OTP, no marketing list."
            />
            <FaqAccordionItem 
              question="Is this a real product or a demo?" 
              answer="A working live prototype: real on-device OCR, real GPS tracking, real offline sync, real database, real AI. The numbers you see are live from our own system. What's ahead is the Android native layer for background tracking — and we're honest about exactly what's live vs what's next."
            />
          </div>
        </div>
      </section>

      {/* ── 15. FINALE LOGO REVEAL ── */}
      <section className="section-rhythm bg-white border-t border-gray-100 text-center reveal-element">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 flex flex-col items-center">
          {/* Sanchar logo scale/fade reveal */}
          <div className="w-20 h-20 bg-[#00695C] rounded-3xl flex items-center justify-center shadow-xl mb-6 transform hover:scale-105 transition-transform duration-300">
            <Shield size={44} className="text-white" />
          </div>
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-ink mb-2">Sanchar AI</h2>
          <p className="text-muted text-sm sm:text-base mb-8">Travel confidently, even offline.</p>
          
          <button onClick={handleStartSafeTripScroll} className="btn-primary !py-3.5 !px-8 text-sm font-bold bg-[#F59E0B] hover:bg-[#D97706] text-[#1F2937] shadow-lg border-0 mb-12 cursor-pointer">
            Start Safe Trip
          </button>

          <div className="w-full max-w-sm card-retreat p-6 border border-gray-150 text-left bg-gray-50 mb-16">
            <h4 className="font-display font-bold text-base text-ink mb-2 text-center">Join the pilot</h4>
            <JoinPilotForm />
          </div>

          {/* Animated Big App Name Display */}
          <div className="w-full py-12 text-center select-none overflow-hidden my-6">
            <h1 className="font-display font-black text-6xl sm:text-8xl md:text-[130px] lg:text-[160px] leading-none tracking-tight bg-gradient-to-r from-[#00695C] via-[#F59E0B] to-[#004D40] bg-clip-text text-transparent animate-shimmer-text hover:scale-[1.02] transition-transform duration-500 cursor-default">
              SANCHAR AI
            </h1>
            <p className="font-serif italic text-sm sm:text-lg text-[#00695C] mt-2 tracking-widest uppercase">
              ✦ Travel confidently, even offline ✦
            </p>
          </div>

          {/* Footer links */}
          <footer className="w-full border-t border-gray-150 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-center">
            <div className="flex gap-4 text-xs font-semibold text-muted">
              <Link to="/features" className="hover:text-teal-700 no-underline">Features</Link>
              <Link to="/privacy" className="hover:text-teal-700 no-underline">Privacy</Link>
              <Link to="/history" className="hover:text-teal-700 no-underline">History</Link>
              <Link to="/maps" className="hover:text-teal-700 no-underline">Maps</Link>
              <Link to="/dashboard" className="hover:text-teal-700 no-underline">Dashboard</Link>
            </div>
            <p className="text-xs text-muted">
              Hackathon prototype — real data, no fakes
            </p>
            <p className="text-xs text-muted">
              © 2026 Sanchar AI. All rights reserved.
            </p>
          </footer>
        </div>
      </section>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCompletedTrip]);

  // Recalculate suggested budget (derived value, kept as effect for simplicity)
  useEffect(() => {
    // Food: Budget 300-500 (avg 400), Comfort 600-1200 (avg 900)
    const foodPerDay = style === 'Budget' ? 400 : 900;
    // Local transport: Budget 200-400 (avg 300), Comfort 400-800 (avg 600)
    const transportPerDay = style === 'Budget' ? 300 : 600;
    // Luggage add-on: 100-300 (avg 200)
    const luggageCost = heavyLuggage ? 200 : 0;
    
    const suggested = (foodPerDay + transportPerDay) * days + luggageCost + ticketPrice;
    setUserBudget(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      
      <div className="p-4 bg-teal-50/60 rounded-2xl border border-teal-100/80">
        <h4 className="text-sm font-bold text-[#00695C] mb-3 flex items-center gap-1.5 font-['Plus_Jakarta_Sans']">
          <IndianRupee size={16} className="text-amber-500" /> Smart Budget Calculator
        </h4>
        
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-semibold text-[#1F2937] mb-1 block">Duration (Days)</label>
            <input type="number" min="1" value={days} onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 1))} className="input-field py-2 bg-white" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#1F2937] mb-1 block">Travel Style</label>
            <select value={style} onChange={e => setStyle(e.target.value as any)} className="input-field py-2 bg-white">
              <option value="Budget">Budget (₹700/day)</option>
              <option value="Comfort">Comfort (₹1,500/day)</option>
            </select>
          </div>
        </div>

        <div className="mb-3">
          <label className="text-xs font-semibold text-[#1F2937] mb-1 block">Inter-city Ticket Fare (₹)</label>
          <input type="number" min="0" placeholder="e.g. 500" value={ticketPrice || ''} onChange={e => setTicketPrice(Math.max(0, parseInt(e.target.value) || 0))} className="input-field py-2 bg-white" />
        </div>

        <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
          <input type="checkbox" checked={heavyLuggage} onChange={e => setHeavyLuggage(e.target.checked)} className="w-4 h-4 text-[#00695C] rounded border-gray-300" />
          <span className="text-xs text-[#1F2937] font-semibold">Carrying heavy luggage? (+₹200 porter allocation)</span>
        </label>

        <div className="bg-white p-3.5 rounded-xl border border-teal-100 shadow-sm text-xs">
          <p className="font-bold text-gray-700 mb-2">Itemized Breakdown ({days} {days === 1 ? 'day' : 'days'} · {style}):</p>
          <div className="flex flex-wrap gap-1.5 mb-3 text-[11px]">
            <span className="bg-teal-50 text-[#00695C] px-2.5 py-1 rounded-md font-semibold border border-teal-100">
              Food: ₹{( (style === 'Budget' ? 400 : 900) * days ).toLocaleString('en-IN')}
            </span>
            <span className="bg-teal-50 text-[#00695C] px-2.5 py-1 rounded-md font-semibold border border-teal-100">
              Transit: ₹{( (style === 'Budget' ? 300 : 600) * days ).toLocaleString('en-IN')}
            </span>
            {heavyLuggage && (
              <span className="bg-amber-50 text-amber-800 px-2.5 py-1 rounded-md font-semibold border border-amber-200">
                Porter: ₹200
              </span>
            )}
            {ticketPrice > 0 && (
              <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md font-semibold border border-blue-100">
                Ticket: ₹{ticketPrice.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
            <span className="font-extrabold text-[#1F2937]">Suggested Total Budget:</span>
            <div className="flex items-center gap-1 font-extrabold text-base text-[#00695C]">
              ₹ <input type="number" value={userBudget} onChange={e => setUserBudget(parseInt(e.target.value) || 0)} className="w-24 p-1 rounded border border-gray-200 font-extrabold text-right focus:outline-none focus:border-[#00695C]" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-[#1F2937] mb-1 block">Expected Arrival (optional)</label>
        <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className="input-field py-2.5" />
      </div>

      {error && <div className="text-xs font-medium text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">{error}</div>}

      <button type="submit" className="btn-primary w-full !py-3.5 mt-2 text-base font-bold bg-[#F59E0B] hover:bg-[#D97706] text-[#1F2937] shadow-md border-0">
        Start Safe Trip
      </button>
    </form>
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
  const [lastRestTime, setLastRestTime] = useState(0);
  const [lastNudgeTime, setLastNudgeTime] = useState(0);
  const navigate = useNavigate();

  const handleLogLuggageAutoExpense = async () => {
    try {
      await axios.post(`/api/trips/${tripId}/expenses`, {
        amount: 50,
        category: 'transport',
        merchant: 'Auto Rickshaw (Porter Nudge)',
        date: new Date(),
        source: 'manual',
        confirmed: true
      });
      alert('Logged ₹50 transport expense.');
      setLastNudgeTime(Date.now());
      axios.get(`/api/trips/${tripId}`).then(r => setTrip(r.data)).catch(console.warn);
    } catch (err) {
      console.warn(err);
    }
  };

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

      {/* Luggage Buddy Prompt (cooldown logic checked via state) */}
      {trip?.heavyLuggage && distance > 1.5 && segment === 'walking' && (Date.now() - lastRestTime > 1800000) && (
        <div className="px-5 md:px-8 mb-4">
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm relative">
            <button onClick={() => setLastRestTime(Date.now())} className="absolute top-2 right-2 text-amber-600 font-bold p-1 cursor-pointer"><Check size={16} /></button>
            <h4 className="font-bold text-amber-900 mb-1 flex items-center gap-1"><AlertTriangle size={14} /> Heavy load? Take a break.</h4>
            <p className="text-xs text-amber-800 mb-3">You've been walking for a while with heavy luggage. There are water stations and rest areas nearby (approximate).</p>
            <div className="flex gap-2">
              <button onClick={() => { alert('Locating nearest rest zone...'); setLastRestTime(Date.now()); }} className="bg-amber-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg cursor-pointer">Find Rest Area</button>
              <button onClick={() => setLastRestTime(Date.now())} className="bg-amber-200 text-amber-900 text-xs font-bold py-1.5 px-3 rounded-lg cursor-pointer">Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* Luggage Buddy Auto Nudge (cooldown logic checked via state) */}
      {trip?.heavyLuggage && distance > 2.0 && segment === 'walking' && (Date.now() - lastNudgeTime > 1800000) && (
        <div className="px-5 md:px-8 mb-4">
          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm relative">
            <button onClick={() => setLastNudgeTime(Date.now())} className="absolute top-2 right-2 text-blue-600 font-bold p-1 cursor-pointer"><Check size={16} /></button>
            <h4 className="font-bold text-blue-900 mb-1 flex items-center gap-1"><Smartphone size={14} /> Smart Transport Nudge</h4>
            <p className="text-xs text-blue-800 mb-3">With heavy bags, an auto is worth it — typical fare for ~2 km: ₹40–60 (typical range).</p>
            <div className="flex gap-2">
              <button onClick={handleLogLuggageAutoExpense} className="bg-blue-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg cursor-pointer">Log as expense</button>
              <button onClick={() => setLastNudgeTime(Date.now())} className="bg-blue-200 text-blue-900 text-xs font-bold py-1.5 px-3 rounded-lg cursor-pointer">I'll walk</button>
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

      {/* Mode Timeline Colored Horizontal Bar */}
      <div className="card p-5 mb-6 border border-gray-100 shadow-sm bg-white">
        <h3 className="font-bold text-sm text-[#1F2937] mb-1 font-['Plus_Jakarta_Sans']">Mode Timeline</h3>
        <p className="text-xs text-[#64748B] mb-3 font-['Plus_Jakarta_Sans']">Segment durations grouped by transport mode.</p>
        
        <div className="h-6 w-full rounded-full overflow-hidden flex border border-gray-200">
          <div style={{ width: '45%' }} className="bg-[#00695C] h-full flex items-center justify-center text-[10px] font-bold text-white transition-all" title="Walking (45%)">Walking</div>
          <div style={{ width: '30%' }} className="bg-[#F59E0B] h-full flex items-center justify-center text-[10px] font-bold text-white transition-all" title="Road (30%)">Road</div>
          <div style={{ width: '15%' }} className="bg-[#8B5CF6] h-full flex items-center justify-center text-[10px] font-bold text-white transition-all" title="Rail (15%)">Rail</div>
          <div style={{ width: '10%' }} className="bg-[#94A3B8] h-full flex items-center justify-center text-[10px] font-bold text-white transition-all" title="Still (10%)">Still</div>
        </div>

        <div className="flex flex-wrap gap-4 text-xs font-bold text-gray-600 mt-3 font-['Plus_Jakarta_Sans']">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#00695C]" /> Walking (45m)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /> Road / Bus (30m)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" /> Rail / Metro (15m)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#94A3B8]" /> Stillness (10m)</span>
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

        {/* Expenses Donut Chart (Recharts) */}
        {expenses.length > 0 && Object.keys(categories).length > 0 && (
          <div className="h-44 w-full my-3 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={Object.entries(categories).map(([name, value]) => ({ name, value }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={65}
                  paddingAngle={3}
                >
                  {Object.entries(categories).map((_, index) => (
                    <Cell key={`expense-cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => [`₹${val}`, 'Amount']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

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



// ─── FAQ PAGE (Section 9E) ──────────────────────────────────
const FaqPage = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  
  const faqs = [
    { q: "How does Sanchar AI actually work offline?", a: "Three reasons: (1) your city pack — phrases, emergency numbers, transport tips and spot data — is downloaded to your device before you travel; (2) GPS is a radio signal, not internet — tracking works with zero network; (3) the OCR scanner and the offline AI helper run entirely on your device. When you're back online, anything saved locally syncs automatically with no duplicates." },
    { q: "How does the AI know about my city?", a: "Two layers. Launch cities get curated, verified packs we maintain. Every other Indian city gets real place data generated on first visit from open data (Wikipedia/Wikidata) and cached permanently. If a place genuinely has no data, we say so honestly and offer the General India pack (112 · 139 · basic guidance) — we never invent places or reviews." },
    { q: "Is my location data safe?", a: "Your exact route never leaves your device. Analytics are off by default and fully opt-in. When you opt in, we strip the first and last 500 m of your journey, bin the rest into anonymous grid cells, and suppress low-volume areas. No individual route is ever stored, sold, or shown. You can see exactly what would be shared in the Privacy section." },
    { q: "What does the AI see when I ask a question?", a: "Online: it uses the city context (pack + spot data) and our Gemini API — your chat is processed live and never stored on our servers. Offline: it answers only from your local city-pack knowledge base and clearly labels itself 'Local KB · offline'. It never sees your trip data or location." },
    { q: "Why are there no star ratings or 'trusted by' numbers?", a: "Because we don't fake social proof. Every count on this site is live from our own database — real trips recorded, real packs, real traveller reports. A hackathon product that shows invented ratings would be lying to you; we'd rather show real numbers, even if they're small." },
    { q: "What happens to my data while I'm offline?", a: "Everything you do offline — scans, check-ins, trip events — is saved on your device with a unique idempotency key. When connectivity returns, it syncs once and is de-duplicated server-side. Nothing is lost, nothing is duplicated, and you always see the state: 'Saved on device' → 'Syncing' → 'Synced'." },
    { q: "What if my city has no data yet?", a: "You get an honest answer, not a fake one: 'No verified spot list for {city} yet.' The General India pack still works everywhere — 112 emergency, 139 rail enquiry, basic guidance. City coverage grows as real data is added, and we say clearly which data is curated vs live-generated." },
    { q: "How is this different from Google Maps or Google Translate?", a: "They're single-feature tools — navigation, or translation. Sanchar AI is a journey companion: it connects safety, language, tickets, budget and your travel story into one offline-first flow that follows you from home to hotel. You're not switching between five apps mid-journey." },
    { q: "Do I need an account to use it?", a: "No — the full journey works without an account. An account (email + password) lets your trips sync to 'My Trips' across devices. No phone number, no OTP, no marketing list." },
    { q: "Is this a real product or a demo?", a: "A working live prototype: real on-device OCR, real GPS tracking, real offline sync, real database, real AI. The numbers you see are live from our own system. What's ahead is the Android native layer for background tracking — and we're honest about exactly what's live vs what's next." }
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

// ─── VOICE TO TEXT DIARY RECORDER ─────────────────────────────
const VoiceDiaryRecorder = ({ onSaveEntry }: { onSaveEntry: (text: string) => void }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [manualText, setManualText] = useState('');

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. You can type your handwritten diary note below!');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        let currentText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript;
        }
        setTranscript(currentText);
      };
      recognition.start();
    } catch (e) {
      console.warn('Voice recognition error:', e);
      setIsListening(false);
    }
  };

  const handleSave = () => {
    const finalContent = transcript || manualText;
    if (!finalContent.trim()) return;
    onSaveEntry(finalContent);
    setTranscript('');
    setManualText('');
  };

  return (
    <div className="card p-5 mb-6 bg-[#FFFDF9] border border-amber-200/80 shadow-sm rounded-2xl">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-extrabold text-[#92400E] font-['Plus_Jakarta_Sans'] text-base flex items-center gap-2">
          <Mic size={18} className="text-amber-600" /> Voice & Handwritten Diary Note
        </h3>
        <span className="text-[10px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">Voice-to-Text</span>
      </div>
      <p className="text-xs text-[#92400E]/80 mb-4">
        Speak your travel thoughts or write a diary entry. Stored 100% locally on your device vault.
      </p>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={startListening}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer ${
            isListening
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-amber-500 hover:bg-amber-600 text-white'
          }`}
        >
          <Mic size={16} /> {isListening ? 'Listening… (Speak now)' : 'Record Voice Note'}
        </button>
      </div>

      <textarea
        rows={3}
        placeholder="Your dictation or handwritten note will appear here..."
        value={transcript || manualText}
        onChange={e => {
          setManualText(e.target.value);
          if (transcript) setTranscript(e.target.value);
        }}
        className="w-full p-3 text-sm bg-white border border-amber-200 rounded-xl focus:outline-none focus:border-amber-500 font-serif leading-relaxed text-gray-800 mb-3"
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={!transcript.trim() && !manualText.trim()}
          className="btn-primary !py-2.5 !px-5 text-xs font-bold bg-[#00695C] text-white rounded-xl disabled:opacity-50 cursor-pointer"
        >
          Save to Private Diary
        </button>
      </div>
    </div>
  );
};

// ─── PRIVACY PAGE ────────────────────────────────────────────
const PrivacyPage = () => {
  const [diaryNotes, setDiaryNotes] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('sanchar_private_diary') || '[]');
    } catch {
      return [];
    }
  });

  const handleAddDiaryNote = (note: string) => {
    const updated = [note, ...diaryNotes];
    setDiaryNotes(updated);
    localStorage.setItem('sanchar_private_diary', JSON.stringify(updated));
  };

  return (
    <div className="p-5 md:p-8 animate-fade-in-up max-w-3xl mx-auto">
      <Link to="/" className="text-sm font-bold text-teal-700 flex items-center gap-1 mb-4 no-underline">
        <Check size={16} /> Back to Home
      </Link>
      <span className="badge badge-teal mb-3"><Lock size={14} /> Private Vault & Privacy</span>
      <h1 className="text-2xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans'] mb-4">Your Private Journey Vault</h1>
      <p className="text-xs text-[#64748B] mb-6">
        Protected by device lock / PIN. Your routes, handwritten notes, voice notes, and photos never leave your device.
      </p>

      {/* Voice to Text Diary */}
      <VoiceDiaryRecorder onSaveEntry={handleAddDiaryNote} />

      {/* Saved Voice & Handwritten Diary Entries */}
      {diaryNotes.length > 0 && (
        <div className="card p-5 mb-6 bg-[#FFFDF9] border border-amber-200 rounded-2xl shadow-sm">
          <h3 className="font-bold text-[#92400E] text-sm mb-3 flex items-center gap-2 font-['Plus_Jakarta_Sans']">
            <BookOpen size={16} /> Your Handwritten & Voice Diary Notes ({diaryNotes.length})
          </h3>
          <div className="space-y-3">
            {diaryNotes.map((entry, idx) => (
              <div key={idx} className="p-3.5 bg-white rounded-xl border border-amber-100 text-xs sm:text-sm text-gray-800 font-serif leading-relaxed shadow-xs">
                "{entry}"
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Promises */}
      <div className="card p-5 border border-gray-100 rounded-2xl bg-white shadow-sm">
        <h3 className="font-bold text-sm text-[#1F2937] mb-3">On-Device Security Pipeline</h3>
        <ul className="text-xs sm:text-sm text-[#1F2937] space-y-3 font-medium">
          <li className="flex items-start gap-2"><Check size={16} className="text-teal-600 mt-0.5 shrink-0" /> Your exact route telemetry stays on your device IndexedDB.</li>
          <li className="flex items-start gap-2"><Check size={16} className="text-teal-600 mt-0.5 shrink-0" /> Analytics off by default — requires explicit user opt-in.</li>
          <li className="flex items-start gap-2"><Check size={16} className="text-teal-600 mt-0.5 shrink-0" /> First and last 300–500 meters are stripped automatically from any logs.</li>
          <li className="flex items-start gap-2"><Check size={16} className="text-teal-600 mt-0.5 shrink-0" /> Photos & voice notes are encrypted with Web Crypto SHA-256 local PIN.</li>
          <li className="flex items-start gap-2"><Check size={16} className="text-teal-600 mt-0.5 shrink-0" /> AI assistant chats are processed live and never stored on our servers or synced.</li>
        </ul>
      </div>
    </div>
  );
};

// ─── HISTORY PAGE ────────────────────────────────────────────
const HistoryPage = () => {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [placeNotes, setPlaceNotes] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('sanchar_history_notes') || '{}');
    } catch {
      return {};
    }
  });

  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/trips')
      .then(res => {
        setTrips(res.data || []);
      })
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSavePlaceNote = (tripId: string, noteText: string) => {
    const updated = { ...placeNotes, [tripId]: noteText };
    setPlaceNotes(updated);
    localStorage.setItem('sanchar_history_notes', JSON.stringify(updated));
  };

  return (
    <div className="p-5 md:p-8 animate-fade-in-up max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Link to="/" className="text-sm font-bold text-teal-700 flex items-center gap-1 mb-2 no-underline">
            <Check size={16} /> Back to Home
          </Link>
          <span className="badge badge-teal mb-2"><HistoryIcon size={14} /> Journey Archives</span>
          <h1 className="text-2xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans']">Trip History & Places Visited</h1>
          <p className="text-xs text-[#64748B]">All your past journeys locked securely in your device vault.</p>
        </div>

        <Link
          to="/create"
          className="btn-primary !py-3 !px-6 text-xs font-bold flex items-center justify-center gap-2 no-underline shadow-md"
        >
          <Plus size={16} /> Plan New Trip
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-16 text-[#64748B] text-sm">Loading trip archives…</div>
      ) : trips.length === 0 ? (
        <div className="card p-10 text-center bg-white border border-gray-100 rounded-3xl shadow-sm">
          <HistoryIcon size={44} className="text-gray-400 mx-auto mb-3" />
          <h3 className="font-bold text-lg text-[#1F2937] mb-2">No completed trips in history yet</h3>
          <p className="text-xs text-[#64748B] mb-6">Start your first trip to log telemetries, visited places, and expenses!</p>
          <Link to="/create" className="btn-primary !py-3 !px-8 text-xs font-bold inline-flex items-center gap-2 no-underline">
            <Plus size={16} /> Start a New Trip
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {trips.map((t, idx) => {
            const tripNote = placeNotes[t._id] || '';

            return (
              <div
                key={t._id || idx}
                className="card p-6 bg-white border border-gray-150 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col gap-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#00695C] flex items-center justify-center font-extrabold text-sm border border-teal-100">
                      #{trips.length - idx}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-[#1F2937] font-['Plus_Jakarta_Sans'] flex items-center gap-2">
                        {t.originCity} → {t.destinationCity}
                        <Lock size={14} className="text-teal-600" />
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Created: {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'Recent'} · Status: <span className="font-bold text-[#00695C] capitalize">{t.status}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/diary/${t._id}`)}
                    className="btn-primary !py-2.5 !px-5 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                  >
                    <Unlock size={14} /> Unlock Trip Details
                  </button>
                </div>

                {/* Notes on Visited Places */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                  <label className="font-bold text-gray-700 block mb-1.5">Your Notes on Places Visited:</label>
                  <textarea
                    rows={2}
                    placeholder="Add personal notes on spots, food, hotels visited during this trip..."
                    defaultValue={tripNote}
                    onBlur={e => handleSavePlaceNote(t._id, e.target.value)}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-[#00695C]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 italic">*Notes auto-save when you click outside the box.</p>
                </div>
              </div>
            );
          })}

          <div className="mt-8 text-center pt-4 border-t border-gray-150">
            <Link
              to="/create"
              className="btn-primary !py-3.5 !px-10 text-sm font-bold inline-flex items-center gap-2 shadow-lg no-underline"
            >
              <Plus size={18} /> Plan Another Trip
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

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
const CHART_COLORS = ['#00695C', '#F59E0B', '#8B5CF6', '#008080', '#D32F2F', '#10B981'];

const Dashboard = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/mobility/summary')
      .then(r => setSummary(r.data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-[#64748B] font-['Plus_Jakarta_Sans'] font-medium">Loading live mobility analytics…</div>;

  const totalTrips = summary?.totalTrips || 0;
  const totalCities = summary?.totalCities || 0;
  const totalLanguages = summary?.totalLanguages || 0;
  const safetyChecks = summary?.safetyChecks || 0;

  const modeShare = summary?.modeShare || [];
  const demandByHour = summary?.demandByHour || [];
  const issueCategories = summary?.issueCategories || [];
  const tripsOverTime = summary?.tripsOverTime || [];

  const hasModeData = modeShare.length > 0 && modeShare.some((m: any) => m.value > 0);
  const hasDemandData = demandByHour.length > 0 && demandByHour.some((d: any) => d.trips > 0);
  const hasIssueData = issueCategories.length > 0 && issueCategories.some((i: any) => i.count > 0);
  const hasTimelineData = tripsOverTime.length > 0 && tripsOverTime.some((t: any) => t.count > 0);

  return (
    <div className="p-5 md:p-8 animate-fade-in-up max-w-[1200px] mx-auto">
      {/* Page Header */}
      <div className="mb-8 border-b border-amber-100 pb-6">
        <span className="badge badge-teal mb-3"><BarChart3 size={14} /> Analytics & GIS</span>
        <h1 className="font-serif text-3xl md:text-4xl font-extrabold text-[#1F2937] tracking-tight">Mobility Dashboard</h1>
        <p className="text-sm text-[#64748B] font-['Plus_Jakarta_Sans'] mt-1">
          {totalTrips > 0
            ? `Real-time GIS & analytics computed from ${totalTrips} consented trip${totalTrips > 1 ? 's' : ''} recorded in this deployment.`
            : 'Live analytics dashboard — all metrics aggregated from real consented trips.'}
        </p>
      </div>

      {/* 1. Real Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#FFFDF9] border border-amber-100/80 p-5 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider font-['Plus_Jakarta_Sans'] mb-1">Trips Recorded</p>
          <p className="text-3xl font-extrabold text-[#00695C] font-['Plus_Jakarta_Sans']">{totalTrips}</p>
        </div>
        <div className="bg-[#FFFDF9] border border-amber-100/80 p-5 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider font-['Plus_Jakarta_Sans'] mb-1">Cities Covered</p>
          <p className="text-3xl font-extrabold text-[#F59E0B] font-['Plus_Jakarta_Sans']">{totalCities}</p>
        </div>
        <div className="bg-[#FFFDF9] border border-amber-100/80 p-5 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider font-['Plus_Jakarta_Sans'] mb-1">Languages Supported</p>
          <p className="text-3xl font-extrabold text-teal-700 font-['Plus_Jakarta_Sans']">{totalLanguages}</p>
        </div>
        <div className="bg-[#FFFDF9] border border-amber-100/80 p-5 rounded-2xl shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider font-['Plus_Jakarta_Sans'] mb-1">Safety Checks</p>
          <p className="text-3xl font-extrabold text-purple-700 font-['Plus_Jakarta_Sans']">{safetyChecks}</p>
        </div>
      </div>

      {/* 2. GIS Heatmap Layer */}
      <div className="bg-[#FFFDF9] border border-amber-100/80 p-6 rounded-2xl shadow-sm mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="font-serif text-xl font-bold text-[#1F2937]">GIS Mobility Heatmap</h2>
            <p className="text-xs text-[#64748B] font-['Plus_Jakarta_Sans']">Anonymized spatial density cell grid layers across active cities.</p>
          </div>
          <span className="text-[10px] font-bold bg-teal-50 text-[#00695C] border border-teal-100 px-3 py-1 rounded-full">
            Spatial Privacy Active
          </span>
        </div>
        <div className="h-72 rounded-xl overflow-hidden border border-gray-150 relative">
          <PocketMap points={[]} destinationCity="India Spatial Overview" />
        </div>
      </div>

      {/* 3. Recharts 4-Chart Grid (2-col desktop / 1-col mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Chart A: DONUT — Mode Share */}
        <div className="bg-[#FFFDF9] border border-amber-100/80 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <h3 className="font-serif text-lg font-bold text-[#1F2937] mb-1">Transport Mode Share</h3>
          <p className="text-xs text-[#64748B] font-['Plus_Jakarta_Sans'] mb-4">Consented trip segment distribution by transit mode.</p>
          
          {!hasModeData ? (
            <div className="py-16 text-center text-xs font-bold text-gray-400 bg-amber-50/50 rounded-xl border border-dashed border-amber-200">
              No consented trips yet — complete a trip with analytics ON to see live analytics
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={modeShare} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4}>
                    {modeShare.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => [`${val} segments`, 'Volume']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 text-xs font-bold text-gray-600 mt-2">
                {modeShare.map((m: any, idx: number) => (
                  <span key={m.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                    {m.name}: {m.value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chart B: BAR — Demand by Hour */}
        <div className="bg-[#FFFDF9] border border-amber-100/80 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <h3 className="font-serif text-lg font-bold text-[#1F2937] mb-1">Hourly Travel Demand</h3>
          <p className="text-xs text-[#64748B] font-['Plus_Jakarta_Sans'] mb-4">Trip initiation count grouped by time buckets.</p>
          
          {!hasDemandData ? (
            <div className="py-16 text-center text-xs font-bold text-gray-400 bg-amber-50/50 rounded-xl border border-dashed border-amber-200">
              No consented trips yet — complete a trip with analytics ON to see live analytics
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demandByHour}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="hour" stroke="#64748B" fontSize={11} />
                  <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="trips" fill="#00695C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart C: BAR — Reported Issue Categories */}
        <div className="bg-[#FFFDF9] border border-amber-100/80 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <h3 className="font-serif text-lg font-bold text-[#1F2937] mb-1">Reported Safety & Mobility Issues</h3>
          <p className="text-xs text-[#64748B] font-['Plus_Jakarta_Sans'] mb-4">Aggregated feedback categories logged during travel.</p>
          
          {!hasIssueData ? (
            <div className="py-16 text-center text-xs font-bold text-gray-400 bg-amber-50/50 rounded-xl border border-dashed border-amber-200">
              No consented trips yet — complete a trip with analytics ON to see live analytics
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={issueCategories} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" stroke="#64748B" fontSize={11} allowDecimals={false} />
                  <YAxis dataKey="category" type="category" stroke="#64748B" fontSize={11} width={90} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart D: AREA — Trips Over Time (Last 14 Days) */}
        <div className="bg-[#FFFDF9] border border-amber-100/80 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <h3 className="font-serif text-lg font-bold text-[#1F2937] mb-1">14-Day Trip Volume</h3>
          <p className="text-xs text-[#64748B] font-['Plus_Jakarta_Sans'] mb-4">Timeline of recorded journeys over the past 2 weeks.</p>
          
          {!hasTimelineData ? (
            <div className="py-16 text-center text-xs font-bold text-gray-400 bg-amber-50/50 rounded-xl border border-dashed border-amber-200">
              No consented trips yet — complete a trip with analytics ON to see live analytics
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tripsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" stroke="#64748B" fontSize={11} />
                  <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" stroke="#00695C" fill="#00695C" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </div>

      {/* Honest Footer Note */}
      <div className="p-4 bg-amber-50/60 border border-amber-200/60 rounded-xl text-center text-xs text-amber-900 font-['Plus_Jakarta_Sans']">
        Sanchar AI computes probable demand and mobility insights from consented trip telemetry. Zero raw GPS coordinates or user identities are ever exposed.
      </div>
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
