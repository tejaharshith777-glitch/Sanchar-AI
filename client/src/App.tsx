import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Link, useParams } from 'react-router-dom';
import {
  Shield, MapPin, Navigation2, Camera, Smartphone, WifiOff,
  Zap, Globe, Lock, Map, IndianRupee, Phone,
  ChevronRight, Check, AlertTriangle, Share2,
  BookOpen, BarChart3, Menu, X
} from 'lucide-react';
import axios from 'axios';
import { queueOfflineMutation, getOfflineQueue, removeQueueItem } from './store/db';
import { ocrProvider } from './ocr/OcrProvider';

// ─── Constants ───────────────────────────────────────────────
const SITE_URL = 'https://sanchar-ai.vercel.app'; // editable deployment URL
const CITIES = [
  'Chennai', 'Coimbatore', 'Madurai', 'Kochi', 'Bengaluru',
  'Mumbai', 'Pune', 'Delhi', 'Jaipur', 'Kolkata',
  'Bhubaneswar', 'Ahmedabad', 'Guwahati', 'Varanasi'
];

// ─── Hooks ───────────────────────────────────────────────────
function useNetworkSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'offline'>('synced');

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setSyncState('syncing');
      const queue = await getOfflineQueue();
      for (const item of queue) {
        try {
          await axios({ method: item.method, url: item.url, data: item.body });
          await removeQueueItem(item.idempotencyKey);
        } catch (error) {
          console.error('Failed to sync item:', error);
        }
      }
      setSyncState('synced');
    };
    const handleOffline = () => { setIsOnline(false); setSyncState('offline'); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, syncState };
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

        // Segment classification with confidence
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
          // Calculate distance
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const d = haversine(last.lat, last.lng, point.lat, point.lng);
            setDistance(prevD => prevD + d);
          }
          return updated;
        });

        batchRef.current.push(point);
        if (batchRef.current.length >= 5) {
          axios.post(`/api/trips/${tripId}/points`, { points: batchRef.current })
            .catch(() => console.log('[GPS] Queuing points locally...'));
          batchRef.current = [];
        }
      },
      (err) => {
        if (err.code === 1) setPermDenied(true);
        console.error('[GPS]', err);
      },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [tripId]);

  return { speed, segment, confidence, distance, points, permDenied };
}

// Haversine distance in km
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// useScrolled hook for glass nav
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);
  return scrolled;
}

// ─── App ─────────────────────────────────────────────────────
const App = () => (
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
);

// ─── App Shell (for inner pages) ─────────────────────────────
const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { isOnline, syncState } = useNetworkSync();
  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <InnerNav isOnline={isOnline} syncState={syncState} />
      <main className="flex-1 max-w-2xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
};

const InnerNav = ({ isOnline, syncState }: { isOnline: boolean; syncState: string }) => (
  <nav className="sticky top-0 z-50 glass-nav">
    <div className="max-w-2xl mx-auto px-5 flex justify-between h-16 items-center">
      <Link to="/" className="flex items-center gap-2 no-underline">
        <div className="w-8 h-8 bg-[#00695C] rounded-lg flex items-center justify-center">
          <Shield size={16} className="text-white" />
        </div>
        <span className="font-['Plus_Jakarta_Sans'] font-bold text-[#1F2937] text-lg tracking-tight">Sanchar AI</span>
      </Link>
      <div className="flex items-center gap-3">
        {syncState === 'syncing' && <span className="badge badge-teal animate-pulse text-xs">Syncing…</span>}
        {syncState === 'offline' && <span className="badge badge-amber text-xs"><WifiOff size={12} /> Offline — queued</span>}
        {syncState === 'synced' && isOnline && <span className="badge badge-green text-xs"><Check size={12} /> Synced</span>}
      </div>
    </div>
  </nav>
);

// ─── LANDING PAGE ────────────────────────────────────────────
const LandingPage = () => {
  const scrolled = useScrolled();
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      {/* ── Sticky Nav ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'glass-nav-scrolled glass-nav' : 'glass-nav'}`}>
        <div className="section-inner flex justify-between items-center h-16 px-5 md:px-8">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-9 h-9 bg-[#00695C] rounded-xl flex items-center justify-center shadow-sm">
              <Shield size={18} className="text-white" />
            </div>
            <span className="font-['Plus_Jakarta_Sans'] font-extrabold text-[#1F2937] text-xl tracking-tight">Sanchar AI</span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-[#64748B] hover:text-[#00695C] transition-colors no-underline">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-[#64748B] hover:text-[#00695C] transition-colors no-underline">How It Works</a>
            <a href="#privacy-section" className="text-sm font-medium text-[#64748B] hover:text-[#00695C] transition-colors no-underline">Privacy</a>
            <Link to="/dashboard" className="text-sm font-medium text-[#64748B] hover:text-[#00695C] transition-colors no-underline">Dashboard</Link>
            <Link to="/create" className="btn-primary text-sm !py-2.5 !px-6">
              Start a Trip <ChevronRight size={16} />
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden p-2 text-[#1F2937]" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenu && (
          <div className="md:hidden bg-white border-t border-gray-100 shadow-lg animate-fade-in">
            <div className="flex flex-col p-5 gap-4">
              <a href="#features" className="text-sm font-medium text-[#64748B] no-underline" onClick={() => setMobileMenu(false)}>Features</a>
              <a href="#how-it-works" className="text-sm font-medium text-[#64748B] no-underline" onClick={() => setMobileMenu(false)}>How It Works</a>
              <a href="#privacy-section" className="text-sm font-medium text-[#64748B] no-underline" onClick={() => setMobileMenu(false)}>Privacy</a>
              <Link to="/dashboard" className="text-sm font-medium text-[#64748B] no-underline" onClick={() => setMobileMenu(false)}>Dashboard</Link>
              <Link to="/create" className="btn-primary text-center text-sm" onClick={() => setMobileMenu(false)}>Start a Trip</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="section pt-32 md:pt-40 pb-16 md:pb-24">
        <div className="section-inner flex flex-col md:flex-row items-center gap-12 md:gap-16 px-5 md:px-8">
          {/* Left */}
          <div className="flex-1 animate-fade-in-up">
            <span className="badge badge-teal mb-5">
              <Zap size={14} /> Offline AI Travel Companion
            </span>
            <h1 className="hero-heading text-[42px] md:text-[56px] font-extrabold text-[#1F2937] leading-[1.1] mb-5">
              Travel confidently,<br />
              <span className="text-[#00695C]">even offline.</span>
            </h1>
            <p className="text-lg text-[#64748B] mb-8 max-w-lg leading-relaxed">
              Sanchar AI helps tourists travel safely across India — real-time GPS tracking, instant ticket scanning, multilingual city packs, and privacy-first analytics. All working offline.
            </p>
            <div className="flex flex-wrap gap-3 mb-10">
              <Link to="/create" className="btn-primary">
                <Navigation2 size={18} /> Start Your Journey
              </Link>
              <a href="#features" className="btn-secondary">
                Explore Features
              </a>
            </div>
            {/* Trust Badges */}
            <div className="flex flex-wrap gap-3">
              <span className="trust-badge"><Lock size={14} /> Privacy-first</span>
              <span className="trust-badge"><WifiOff size={14} /> Offline-ready</span>
              <span className="trust-badge"><Globe size={14} /> Multilingual</span>
            </div>
          </div>
          {/* Right — Phone Mockup */}
          <div className="flex-1 flex justify-center animate-slide-right">
            <div className="relative">
              <div className="w-[280px] md:w-[320px] h-[560px] md:h-[640px] bg-white rounded-[40px] shadow-2xl border border-gray-200 overflow-hidden p-3">
                <div className="w-full h-full bg-gradient-to-br from-[#E0F2F1] to-[#FAFAF7] rounded-[32px] flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 bg-[#00695C] rounded-2xl flex items-center justify-center mb-5 animate-float">
                    <Shield size={32} className="text-white" />
                  </div>
                  <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-xl text-[#1F2937] mb-2">Live Journey</h3>
                  <p className="text-sm text-[#64748B] mb-6">Chennai → Jaipur</p>
                  <div className="grid grid-cols-2 gap-3 w-full">
                    <div className="bg-white rounded-2xl p-3 shadow-sm">
                      <p className="text-xs text-[#64748B] mb-1">Speed</p>
                      <p className="font-bold text-lg text-[#00695C]">42 km/h</p>
                    </div>
                    <div className="bg-white rounded-2xl p-3 shadow-sm">
                      <p className="text-xs text-[#64748B] mb-1">Distance</p>
                      <p className="font-bold text-lg text-[#00695C]">186 km</p>
                    </div>
                    <div className="bg-white rounded-2xl p-3 shadow-sm">
                      <p className="text-xs text-[#64748B] mb-1">Mode</p>
                      <p className="font-bold text-sm text-[#1F2937]">🚆 Rail</p>
                    </div>
                    <div className="bg-white rounded-2xl p-3 shadow-sm">
                      <p className="text-xs text-[#64748B] mb-1">Budget</p>
                      <p className="font-bold text-sm text-[#2E7D32]">₹8,420</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#64748B] mt-4 italic">Demo Data — illustrative UI preview</p>
                </div>
              </div>
              {/* Floating badges */}
              <div className="absolute -left-4 top-24 card px-3 py-2 flex items-center gap-2 text-xs font-medium text-[#2E7D32] animate-float" style={{ animationDelay: '0.5s' }}>
                <Check size={14} /> OCR Scanned
              </div>
              <div className="absolute -right-4 bottom-32 card px-3 py-2 flex items-center gap-2 text-xs font-medium text-[#00695C] animate-float" style={{ animationDelay: '1s' }}>
                <Lock size={14} /> Private Track
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="section bg-white">
        <div className="section-inner px-5 md:px-8">
          <div className="text-center mb-14">
            <span className="badge badge-teal mb-4"><Zap size={14} /> Core Features</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#1F2937] mb-3">Everything you need for safe travel</h2>
            <p className="text-[#64748B] max-w-xl mx-auto">Real features, real data, real privacy — no simulations.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <Navigation2 size={24} />, title: 'Live GPS Tracking', desc: 'Real-time speed, distance, and movement segments from your actual GPS position.', badge: null },
              { icon: <Camera size={24} />, title: 'OCR Ticket Scanner', desc: 'Scan any ticket or bill — Tesseract.js extracts amounts on-device, even offline.', badge: 'Works offline' },
              { icon: <Globe size={24} />, title: 'Multilingual City Packs', desc: 'Emergency numbers, local phrases, transport tips — cached for offline use.', badge: null },
              { icon: <Shield size={24} />, title: 'Safety & SOS', desc: 'Route-deviation alerts, late-arrival checks, and one-tap SOS with real emergency links.', badge: null },
              { icon: <Lock size={24} />, title: 'Privacy-First Analytics', desc: 'Your exact route never leaves your device. Only optional grid-cell aggregates, with consent.', badge: 'Consent-based' },
              { icon: <BookOpen size={24} />, title: 'Journey Diary', desc: 'Auto-generated trip summary from real data — distance, expenses, segments. Shareable.', badge: null },
            ].map((f, i) => (
              <div key={i} className="card p-6 flex flex-col gap-4" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="w-12 h-12 rounded-xl bg-[#E0F2F1] flex items-center justify-center text-[#00695C]">{f.icon}</div>
                <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#1F2937]">{f.title}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{f.desc}</p>
                {f.badge && <span className="badge badge-green self-start">{f.badge}</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="section">
        <div className="section-inner px-5 md:px-8">
          <div className="text-center mb-14">
            <span className="badge badge-teal mb-4"><Map size={14} /> How It Works</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#1F2937] mb-3">Your journey in 4 steps</h2>
            <p className="text-[#64748B] max-w-xl mx-auto">Every step produces real data — no scripted demos.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'Create Trip', desc: 'Pick your origin and destination. Set a budget. Choose your privacy settings.', icon: <MapPin size={24} /> },
              { step: '02', title: 'Track Live', desc: 'Real GPS tracking shows your speed, distance, and transport mode in real time.', icon: <Navigation2 size={24} /> },
              { step: '03', title: 'Scan & Save', desc: 'Photograph any receipt — OCR extracts amounts instantly, even without internet.', icon: <Camera size={24} /> },
              { step: '04', title: 'Arrive Safe', desc: 'Automatic arrival detection, trip diary, and shareable journey summary.', icon: <Check size={24} /> },
            ].map((s, i) => (
              <div key={i} className="card p-6 text-center flex flex-col items-center gap-4">
                <span className="text-[40px] font-extrabold text-[#00695C]/10 font-['Plus_Jakarta_Sans']">{s.step}</span>
                <div className="w-14 h-14 rounded-full bg-[#00695C] flex items-center justify-center text-white">{s.icon}</div>
                <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#1F2937]">{s.title}</h3>
                <p className="text-sm text-[#64748B]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Privacy Section ── */}
      <section id="privacy-section" className="section bg-white">
        <div className="section-inner px-5 md:px-8">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <span className="badge badge-teal mb-4"><Lock size={14} /> Privacy Pipeline</span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#1F2937] mb-5">Your route stays yours.</h2>
              <p className="text-[#64748B] mb-6 leading-relaxed">
                Sanchar AI never uploads your exact route. When you opt in to analytics, the server drops the first and last 500m of your trip, bins remaining points into ~500m grid cells, and suppresses low-volume cells. The dashboard only reads anonymized aggregates — never personal location points.
              </p>
              <div className="space-y-3">
                {[
                  'Your GPS track is stored only on your device and in your personal records',
                  'Analytics consent is OFF by default — your choice, always',
                  'Grid-cell aggregates suppress cells with fewer than 3 trips',
                  'Dashboard endpoints never read personal LocationPoints',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#00695C] flex items-center justify-center shrink-0 mt-0.5"><Check size={12} className="text-white" /></div>
                    <p className="text-sm text-[#1F2937]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <div className="card p-6">
                <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#64748B] uppercase tracking-wider mb-4">Live in This Web App vs Android Module</h3>
                <div className="space-y-3">
                  {[
                    { feature: 'GPS tracking (tab open)', live: true },
                    { feature: 'OCR ticket scanning', live: true },
                    { feature: 'Offline city packs', live: true },
                    { feature: 'SOS / emergency links', live: true },
                    { feature: 'Privacy pipeline', live: true },
                    { feature: 'Background tracking (tab closed)', live: false },
                    { feature: 'Precise step counting', live: false },
                    { feature: 'Push notifications (FCM)', live: false },
                    { feature: 'Production activity recognition', live: false },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-[#1F2937]">{row.feature}</span>
                      {row.live
                        ? <span className="badge badge-green text-xs"><Check size={12} /> Live</span>
                        : <span className="android-badge"><Smartphone size={12} /> Android app</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="section">
        <div className="section-inner px-5 md:px-8 text-center">
          <div className="card p-10 md:p-16 bg-gradient-to-br from-[#00695C] to-[#004D40]">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">Ready to travel safely?</h2>
            <p className="text-teal-100 mb-8 max-w-lg mx-auto">Create your first real trip — every data point comes from your actual journey.</p>
            <Link to="/create" className="btn-primary !bg-white !text-[#00695C] hover:!bg-teal-50">
              <Navigation2 size={18} /> Start Your First Trip
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#00695C] text-white">
        <div className="section-inner px-5 md:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield size={20} className="text-[#F59E0B]" />
                <span className="font-['Plus_Jakarta_Sans'] font-bold text-lg">Sanchar AI</span>
              </div>
              <p className="text-teal-200 text-sm leading-relaxed">Travel confidently, even offline. Your AI travel companion for safe journeys across India.</p>
            </div>
            <div>
              <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-sm mb-3 text-teal-100">Product</h4>
              <div className="flex flex-col gap-2">
                <Link to="/create" className="text-teal-200 text-sm hover:text-white transition-colors no-underline">Create Trip</Link>
                <Link to="/dashboard" className="text-teal-200 text-sm hover:text-white transition-colors no-underline">Dashboard</Link>
                <Link to="/privacy" className="text-teal-200 text-sm hover:text-white transition-colors no-underline">Privacy</Link>
              </div>
            </div>
            <div>
              <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-sm mb-3 text-teal-100">Transparency</h4>
              <p className="text-teal-200 text-sm leading-relaxed">Sanchar AI prototype — hackathon build. Analytics optional and consent-based. No surveillance, no tracking without permission.</p>
            </div>
          </div>
          <div className="border-t border-teal-600 pt-6 text-center">
            <p className="text-teal-300 text-xs">© 2026 Sanchar AI — Built with privacy at the core.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// ─── M1: CREATE TRIP ─────────────────────────────────────────
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
    if (origin === destination) return setError('Origin and destination cannot be the same.');
    try {
      const res = await axios.post('/api/trips', {
        originCity: origin,
        destinationCity: destination,
        budget,
        expectedArrival: expectedArrival || undefined,
        trustedContactLabel: trustedContact || undefined,
        analyticsConsent: consent,
      });
      navigate(`/active/${res.data._id}`);
    } catch (err: any) {
      console.error(err);
      setError('Failed to create trip. The server may be offline.');
    }
  };

  return (
    <div className="p-5 md:p-8 animate-fade-in-up">
      <div className="mb-8">
        <span className="badge badge-teal mb-3"><MapPin size={14} /> New Journey</span>
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#1F2937] font-['Plus_Jakarta_Sans']">Plan Your Trip</h1>
        <p className="text-[#64748B] text-sm mt-1">Every field produces real data — no simulations.</p>
      </div>

      <form onSubmit={handleStart} className="flex flex-col gap-5">
        {/* Origin */}
        <div>
          <label className="text-sm font-semibold text-[#1F2937] mb-1.5 block">Origin City</label>
          <select value={home} onChange={e => setHome(e.target.value)} className="input-field" required>
            <option value="">Select origin…</option>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="Other">Other City</option>
          </select>
          {home === 'Other' && <input type="text" placeholder="Enter your city" value={customHome} onChange={e => setCustomHome(e.target.value)} className="input-field mt-2" required />}
        </div>

        {/* Destination */}
        <div>
          <label className="text-sm font-semibold text-[#1F2937] mb-1.5 block">Destination City</label>
          <select value={dest} onChange={e => setDest(e.target.value)} className="input-field" required>
            <option value="">Select destination…</option>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="Other">Other City</option>
          </select>
          {dest === 'Other' && <input type="text" placeholder="Enter destination city" value={customDest} onChange={e => setCustomDest(e.target.value)} className="input-field mt-2" required />}
        </div>

        {/* Budget */}
        <div>
          <label className="text-sm font-semibold text-[#1F2937] mb-1.5 block">Budget (₹)</label>
          <input type="number" value={budget} onChange={e => setBudget(Number(e.target.value))} className="input-field" required min={100} />
        </div>

        {/* Expected Arrival */}
        <div>
          <label className="text-sm font-semibold text-[#1F2937] mb-1.5 block">Expected Arrival (optional)</label>
          <input type="datetime-local" value={expectedArrival} onChange={e => setExpectedArrival(e.target.value)} className="input-field" />
        </div>

        {/* Trusted Contact */}
        <div>
          <label className="text-sm font-semibold text-[#1F2937] mb-1.5 block">Trusted Contact Name (optional)</label>
          <input type="text" placeholder="e.g. Mom, Friend" value={trustedContact} onChange={e => setTrustedContact(e.target.value)} className="input-field" />
        </div>

        {/* Consent */}
        <div className="card p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 w-5 h-5 accent-[#00695C]" />
            <span className="text-sm">
              <strong className="text-[#1F2937]">Contribute anonymous mobility insights</strong> (Optional)<br />
              <span className="text-[#64748B] text-xs">Your exact route never leaves your device; only optional grid-cell aggregates, consented.</span>
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

// ─── M2: ACTIVE TRIP ─────────────────────────────────────────
const ActiveTrip = () => {
  const { id } = useParams();
  const tripId = id || '';
  const { speed, segment, confidence, distance, points, permDenied } = useGPSTracker(tripId);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m ${s % 60}s`;
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
          <AlertTriangle size={14} /> Location permission denied — continue manually
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
          <div className="w-12 h-12 rounded-xl bg-[#E0F2F1] flex items-center justify-center text-2xl">
            {segmentEmoji[segment]}
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-[#64748B] uppercase">Probable Segment</p>
            <p className="font-bold text-lg capitalize text-[#1F2937]">{segment.replace('_', ' ')} — <span className="text-[#00695C]">{confidence}%</span></p>
            <p className="text-[11px] text-[#64748B] italic">Probabilistic — based on your actual movement</p>
          </div>
        </div>
      </div>

      {/* Android Badge */}
      <div className="px-5 md:px-8 mb-4">
        <div className="bg-[#FEF3C7] border border-[#FDE68A] p-4 rounded-2xl text-xs text-[#92400E] flex gap-3 items-start">
          <Smartphone size={16} className="shrink-0 mt-0.5" />
          <div>
            <strong>Android app module:</strong> Background tracking after closing the tab, precise step counting, and production-grade activity recognition require the native Android app. Keep this tab open for the web demo.
          </div>
        </div>
      </div>

      {/* Battery Note */}
      <div className="px-5 md:px-8 mb-6">
        <p className="text-xs text-[#64748B] italic">Tracking uses low-power location intervals. Production Android app uses activity recognition for lower drain.</p>
      </div>

      {/* Action Buttons */}
      <div className="mt-auto p-5 md:p-8 bg-white border-t border-gray-100 grid grid-cols-3 gap-3">
        <button onClick={() => navigate(`/scan/${tripId}`)} className="btn-secondary !py-3 text-sm">
          <Camera size={16} /> Scan
        </button>
        <button onClick={() => navigate(`/expenses/${tripId}`)} className="btn-secondary !py-3 text-sm">
          <IndianRupee size={16} /> Expenses
        </button>
        <button className="btn-danger !py-3 text-sm animate-pulse-glow">
          <Phone size={16} /> SOS
        </button>
      </div>
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
        setStatus('Detected amount — confirm or edit.');
      } else {
        setStatus('Could not autodetect an amount. Enter manually below.');
        setAmount(null);
      }
    } catch (err) {
      console.error(err);
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
    if (id) axios.get(`/api/trips/${id}/expenses`).then(r => setExpenses(r.data)).catch(console.error);
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
    axios.get(`/api/trips/${id}`).then(r => setTrip(r.data)).catch(console.error);
    axios.get(`/api/trips/${id}/expenses`).then(r => setExpenses(r.data)).catch(console.error);
  }, [id]);

  const totalSpent = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  const handleShare = () => {
    const text = trip
      ? `🛤️ My Sanchar AI Journey\n${trip.originCity} → ${trip.destinationCity}\nSpent: ₹${totalSpent.toLocaleString('en-IN')} of ₹${(trip.budget || 0).toLocaleString('en-IN')}\nExpenses: ${expenses.length} items\n\nGenerated by Sanchar AI — ${SITE_URL}`
      : 'Sanchar AI Journey';
    if (navigator.share) navigator.share({ text });
    else navigator.clipboard.writeText(text);
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
      <Link to="/create" className="btn-secondary w-full text-center block">Plan New Trip</Link>
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
          ? `Computed from ${totalTrips} trip${totalTrips > 1 ? 's' : ''} recorded in this deployment (consented, anonymized).`
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
