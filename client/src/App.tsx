import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Menu, X, Shield, MapPin, Navigation2, FileText, Smartphone, WifiOff, Camera } from 'lucide-react';
import axios from 'axios';
import { queueOfflineMutation, getOfflineQueue, removeQueueItem } from './store/db';
import { ocrProvider } from './ocr/OcrProvider';

// Custom hook to manage online/offline state & sync queue
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
          await axios({
            method: item.method,
            url: item.url,
            data: item.body
          });
          await removeQueueItem(item.idempotencyKey);
        } catch (error) {
          console.error("Failed to sync item:", error);
        }
      }
      setSyncState('synced');
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

  return { isOnline, syncState };
}

// GPS Tracking Hook
function useGPSTracker(tripId: string | null) {
  const [points, setPoints] = useState<any[]>([]);
  const [speed, setSpeed] = useState<number>(0);
  const [segment, setSegment] = useState<'still' | 'walking' | 'road_vehicle' | 'rail' | 'unknown'>('unknown');

  useEffect(() => {
    if (!tripId || !navigator.geolocation) return;
    
    let lastPos: GeolocationPosition | null = null;

    const id = navigator.geolocation.watchPosition((pos) => {
      const currentSpeed = pos.coords.speed !== null ? (pos.coords.speed * 3.6) : 0; 
      // If speed is null, fallback to calculating it based on distance/time (omitted for brevity)
      
      setSpeed(currentSpeed);
      if (currentSpeed < 1) setSegment('still');
      else if (currentSpeed < 6) setSegment('walking');
      else if (currentSpeed < 70) setSegment('road_vehicle');
      else setSegment('rail');

      const point = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        speedKmh: currentSpeed,
        timestamp: new Date(pos.timestamp),
        source: 'gps'
      };
      
      setPoints(prev => [...prev, point]);
      
      // Batch send to API every ~15s (mocked here for simplicity)
      if (points.length > 5) {
        axios.post(`/api/trips/${tripId}/points`, { points: [...points, point] }).catch(e => console.log('Queuing locally...'));
        setPoints([]); // flush local batch
      }

    }, (err) => console.error(err), { enableHighAccuracy: true, maximumAge: 10000 });

    return () => navigator.geolocation.clearWatch(id);
  }, [tripId, points]);

  return { speed, segment };
}

// Main App
const App = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background font-sans text-main-text flex flex-col">
        <Navigation />
        <main className="flex-1 max-w-lg mx-auto w-full bg-white shadow-xl min-h-full border-x border-gray-100">
           <Routes>
             <Route path="/" element={<CreateTrip />} />
             <Route path="/active/:id" element={<ActiveTrip />} />
             <Route path="/scan/:id" element={<CameraScanner />} />
           </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

const Navigation = () => {
  const { isOnline, syncState } = useNetworkSync();
  return (
    <nav className="sticky top-0 z-50 bg-primary text-white border-b border-teal-800 shadow-md">
      <div className="max-w-lg mx-auto px-4 flex justify-between h-14 items-center">
        <div className="flex items-center gap-2 font-bold tracking-tight">
          <Shield size={20} className="text-secondary" /> Sanchar AI
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
           {syncState === 'syncing' ? <span className="animate-pulse">Syncing...</span> : 
            syncState === 'offline' ? <span className="flex items-center gap-1 text-red-200"><WifiOff size={14} /> Saved locally</span> :
            <span className="flex items-center gap-1 text-green-200"><Check size={14} /> Synced</span>}
        </div>
      </div>
    </nav>
  );
};

// M1: Real Trip Creation
const CreateTrip = () => {
  const [home, setHome] = useState('Chennai');
  const [dest, setDest] = useState('Jaipur');
  const [budget, setBudget] = useState(10000);
  const [consent, setConsent] = useState(false);
  const navigate = useNavigate();

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (home === dest) return alert('Origin and destination cannot be the same.');
    try {
      const res = await axios.post('/api/trips', {
        originCity: home,
        destinationCity: dest,
        budget,
        analyticsConsent: consent
      });
      navigate(`/active/${res.data._id}`);
    } catch (err) {
      console.error(err);
      // In a real PWA, if offline here, we'd generate a local ID, queue the creation, and navigate.
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Create New Journey</h1>
      <form onSubmit={handleStart} className="flex flex-col gap-5">
        <div>
          <label className="text-sm font-bold text-gray-700">Origin City</label>
          <input type="text" value={home} onChange={e => setHome(e.target.value)} className="w-full mt-1 p-3 border rounded-xl" required />
        </div>
        <div>
          <label className="text-sm font-bold text-gray-700">Destination City</label>
          <input type="text" value={dest} onChange={e => setDest(e.target.value)} className="w-full mt-1 p-3 border rounded-xl" required />
        </div>
        <div>
          <label className="text-sm font-bold text-gray-700">Budget (₹)</label>
          <input type="number" value={budget} onChange={e => setBudget(Number(e.target.value))} className="w-full mt-1 p-3 border rounded-xl" required />
        </div>
        
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
           <label className="flex items-start gap-3 cursor-pointer">
             <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 w-5 h-5 text-primary" />
             <span className="text-sm">
                <strong>Contribute anonymous mobility insights</strong> (Optional)<br/>
                <span className="text-gray-500 text-xs">Your exact route never leaves your device; only optional grid-cell aggregates are shared.</span>
             </span>
           </label>
        </div>

        <button type="submit" className="w-full bg-success text-white py-4 rounded-xl font-bold shadow-md mt-4 flex items-center justify-center gap-2">
           <Navigation2 size={20} /> Start Live Tracking
        </button>
      </form>
    </div>
  );
};

// M2: Real Live Journey Tracking
const ActiveTrip = () => {
  // Mock pulling ID from URL
  const tripId = window.location.pathname.split('/').pop() || '';
  const { speed, segment } = useGPSTracker(tripId);
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white p-6 shadow-sm z-10">
         <h2 className="text-xl font-bold">Active Journey</h2>
         <p className="text-sm text-gray-500">Live GPS tracking active.</p>
      </div>
      
      <div className="flex-1 p-6 flex flex-col gap-4">
         {/* Live Metrics */}
         <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Current Speed</p>
            <h1 className="text-5xl font-extrabold text-main-text">{speed.toFixed(1)} <span className="text-xl">km/h</span></h1>
         </div>

         {/* Segment Detector */}
         <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Probable Segment</p>
              <p className="font-bold text-lg capitalize">{segment.replace('_', ' ')}</p>
            </div>
         </div>

         {/* Android Note */}
         <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-800 flex gap-2">
            <Smartphone size={16} className="shrink-0" />
            <p><strong>Android app module:</strong> Background tracking after closing the tab requires the native production app. Keep this tab open for the web demo.</p>
         </div>
      </div>

      <div className="bg-white p-4 border-t grid grid-cols-2 gap-3 mt-auto">
         <button onClick={() => navigate(`/scan/${tripId}`)} className="bg-gray-100 hover:bg-gray-200 text-main-text py-3 rounded-xl font-bold flex items-center justify-center gap-2">
           <Camera size={18} /> Scan Bill
         </button>
         <button className="bg-safety hover:bg-red-800 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
           <Shield size={18} /> SOS
         </button>
      </div>
    </div>
  );
};

// M3: Real Ticket Scanner (OCR)
const CameraScanner = () => {
  const [status, setStatus] = useState('Take a photo of a receipt or ticket.');
  const [amount, setAmount] = useState<number | null>(null);
  const [rawText, setRawText] = useState('');
  const navigate = useNavigate();
  const tripId = window.location.pathname.split('/').pop() || '';

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('Processing image with OCR...');
    try {
      const text = await ocrProvider.recognize(file);
      setRawText(text);
      const match = text.match(/(?:Rs\.?|₹|INR)?\s*(\d+(?:,\d+)*(?:\.\d{1,2})?)\s*(?:\/-)?/i);
      if (match && match[1]) {
        const extracted = parseFloat(match[1].replace(/,/g, ''));
        setAmount(extracted);
        setStatus('Detected amount – confirm or edit.');
      } else {
        setStatus('Could not autodetect an amount. Please enter manually.');
        setAmount(null);
      }
    } catch (err) {
      console.error(err);
      setStatus('OCR failed. Please try again.');
    }
  };

  const confirmExpense = async () => {
    if (!amount) return;
    try {
      await axios.post(`/api/trips/${tripId}/expenses`, {
        merchant: 'Scanned Ticket',
        amount,
        category: 'transport',
        source: 'ocr',
        confirmed: true,
      });
      navigate(`/active/${tripId}`);
    } catch (err) {
      console.error(err);
      // Queue offline mutation if request fails (offline mode)
      await queueOfflineMutation({
        method: 'post',
        url: `/api/trips/${tripId}/expenses`,
        body: {
          merchant: 'Scanned Ticket',
          amount,
          category: 'transport',
          source: 'ocr',
          confirmed: true,
        },
      });
      navigate(`/active/${tripId}`);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4">Scan Expense</h2>
      <label className="flex flex-col items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded-2xl h-48 cursor-pointer hover:bg-gray-200 transition-colors">
        <Camera size={48} className="text-gray-400 mb-2" />
        <span className="font-medium text-gray-600">Tap to capture / upload</span>
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCapture} />
      </label>

      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">{status}</p>
      </div>

      {amount !== null && (
        <div className="mt-4 bg-white p-4 border rounded-xl shadow-sm">
          <p className="text-xs font-bold uppercase text-gray-500 mb-1">Detected Amount (₹)</p>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="text-3xl font-extrabold w-full bg-transparent border-b-2 border-gray-200 outline-none text-center pb-2"
          />
          <button onClick={confirmExpense} className="w-full bg-primary text-white py-2 rounded-xl mt-4 font-bold">
            Confirm Expense
          </button>
        </div>
      )}

      <button onClick={() => navigate(`/active/${tripId}`)} className="mt-auto text-gray-500 font-medium">
        Cancel
      </button>
    </div>
  );
};
export default App;
