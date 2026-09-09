"""Round 2 client fixes applier (TrainMode + App Diary/GPS/marquee/typo). Asserted replacements."""
import re

TM = 'client/src/pages/TrainModePage.tsx'
tm = open(TM, encoding='utf-8').read()

def rept(name, old, new, count=1):
    global tm
    found = tm.count(old)
    assert found == count, f'{name}: expected {count}, found {found}'
    tm = tm.replace(old, new)
    print(f'OK  {name}')

# T1: latch + error + wakelock state
rept('T1 state',
     "  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);",
     "  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);\n  const [gpsError, setGpsError] = useState<string | null>(null);")
rept('T1 refs',
     "  const watchIdRef = useRef<number | null>(null);",
     "  const watchIdRef = useRef<number | null>(null);\n  const alarmFiredRef = useRef(false);\n  const wakeLockRef = useRef<any>(null);")

# T2: arm resets latch/error + requests screen wake lock
rept('T2 arm',
     """    if (isAlarmActive && navigator.geolocation) {
      setAlarmTriggered(false);
      watchIdRef.current = navigator.geolocation.watchPosition(""",
     """    if (isAlarmActive && navigator.geolocation) {
      setAlarmTriggered(false);
      alarmFiredRef.current = false;
      setGpsError(null);
      // Keep the screen on while armed: browsers throttle GPS in background
      // tabs, which would otherwise silence the alarm. Best-effort.
      try {
        const navAny = navigator as any;
        if (navAny.wakeLock && navAny.wakeLock.request) {
          navAny.wakeLock.request('screen').then((lock: any) => { wakeLockRef.current = lock; }).catch(() => {});
        }
      } catch { /* ignore */ }
      watchIdRef.current = navigator.geolocation.watchPosition(""")

# T3: clear error on good fix
rept('T3 fix',
     """          const uLat = pos.coords.latitude;
          const uLng = pos.coords.longitude;
          setUserPos({ lat: uLat, lng: uLng });""",
     """          const uLat = pos.coords.latitude;
          const uLng = pos.coords.longitude;
          setUserPos({ lat: uLat, lng: uLng });
          setGpsError(null);""")

# T4: latched alarm (fire once per arming) + cancel queued speech
rept('T4 latch',
     """          if (dist <= alarmRadiusKm) {
            setAlarmTriggered(true);
            if ('vibrate' in navigator) {
              navigator.vibrate([1000, 500, 1000, 500, 1000]);
            }
            if ('speechSynthesis' in window) {
              const msg = new SpeechSynthesisUtterance(`Attention passenger! Approaching ${selectedStation.name}. Please prepare your luggage.`);
              window.speechSynthesis.speak(msg);
            }
          }""",
     """          // Latched: fire once per arming. Without the latch, every GPS fix
          // inside the radius re-fires vibration + speech (Dismiss is futile).
          if (dist <= alarmRadiusKm && !alarmFiredRef.current) {
            alarmFiredRef.current = true;
            setAlarmTriggered(true);
            if ('vibrate' in navigator) {
              navigator.vibrate([1000, 500, 1000, 500, 1000]);
            }
            if ('speechSynthesis' in window) {
              window.speechSynthesis.cancel();
              const msg = new SpeechSynthesisUtterance(`Attention passenger! Approaching ${selectedStation.name}. Please prepare your luggage.`);
              window.speechSynthesis.speak(msg);
            }
          }""")

# T5: visible GPS errors (a silent watchPosition failure = slept-through station)
rept('T5 gposerr',
     "        (err) => console.warn('[Train Alarm GPS Error]', err),",
     """        (err) => {
          console.warn('[Train Alarm GPS Error]', err);
          setGpsError(err.code === 1
            ? 'Location permission denied — enable location for this site or the alarm cannot work.'
            : err.code === 2
              ? 'GPS position unavailable (tunnels / indoors block signals) — the alarm resumes when signal returns.'
              : 'GPS timed out — keep this screen open with a clear view of the sky.');
        },""")

# T6: release wake lock on disarm/unmount
rept('T6 disarm',
     """    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };""",
     """    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (wakeLockRef.current) {
        try { wakeLockRef.current.release?.().catch(() => {}); } catch { /* ignore */ }
        wakeLockRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (wakeLockRef.current) {
        try { wakeLockRef.current.release?.().catch(() => {}); } catch { /* ignore */ }
        wakeLockRef.current = null;
      }
    };""")

# T7: demo speech cancels queue first
rept('T7 demo',
     """    if ('speechSynthesis' in window) {
      const msg = new SpeechSynthesisUtterance(`Station Alert! Approaching ${selectedStation.name}. Get ready.`);
      window.speechSynthesis.speak(msg);
    }""",
     """    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance(`Station Alert! Approaching ${selectedStation.name}. Get ready.`);
      window.speechSynthesis.speak(msg);
    }""")

# T8/T9: honest copy (airplane-mode limitation disclosed)
rept('T8 badge', "<Zap size={12} /> Airplane-Mode Geofence", "<Zap size={12} /> Offline GPS Geofence")
rept('T8 para',
     "Sleep peacefully on Indian trains. Set an offline GPS station wake-up alarm that vibrates & rings before your station, working 100% offline in airplane mode.",
     "Sleep peacefully on Indian trains. Set an offline GPS station wake-up alarm that vibrates & speaks before your station — uses your phone's GPS (works in airplane mode) while this screen stays open.")
rept('T9 ready', "<CheckCircle size={10} /> Airplane Mode GPS Ready", "<CheckCircle size={10} /> GPS-Based · No Network Needed")

# T10: dismiss also silences speech
rept('T10 dismiss', "onClick={() => setAlarmTriggered(false)}",
     "onClick={() => { try { (window as any).speechSynthesis?.cancel(); } catch {} setAlarmTriggered(false); }}")

# T11: coverage note + gps error box + empty state
rept('T11 label',
     '<label className="block text-xs font-bold text-gray-700">Search Railway Stations in India</label>',
     '<label className="block text-xs font-bold text-gray-700">Search Stations (12-station demo list)</label>')
rept('T11 list',
     """            <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-2xl">
              {filteredStations.map((station) => (""",
     """            <p className="text-[11px] text-gray-500 font-medium">Demo coverage: 12 major junctions (full 8,500+ station directory coming soon). The alarm needs GPS signal + this screen open — browsers may throttle GPS in background tabs.</p>
            {gpsError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 font-bold">{gpsError}</div>
            )}
            <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-2xl">
              {filteredStations.length === 0 && (
                <div className="p-4 text-center text-[11px] text-gray-500 font-medium">No station in the demo list matches &ldquo;{searchQuery}&rdquo;. Try MAS, NDLS, Howrah&hellip;</div>
              )}
              {filteredStations.map((station) => (""")

# T12: night guidance discloses screen-on requirement
rept('T12 night',
     "<p>Keep your station alarm armed at 3 km radius so you never miss your destination at night.</p>",
     "<p>Keep your station alarm armed at 3 km radius — and this screen on, since browsers may pause GPS in the background.</p>")

open(TM, 'w', encoding='utf-8').write(tm)
print('TRAINMODE DONE')

# ================= APP.TSX =================
AP = 'client/src/App.tsx'
ap = open(AP, encoding='utf-8').read()

def repa(name, old, new, count=1):
    global ap
    found = ap.count(old)
    assert found == count, f'{name}: expected {count}, found {found}'
    ap = ap.replace(old, new)
    print(f'OK  {name}')

# A1: R1 GPS tracker re-apply on merged tree
repa('A1 ref', "  const batchRef = useRef<any[]>([]);",
     "  const batchRef = useRef<any[]>([]);\n  const lastPointRef = useRef<any | null>(null);")
repa('A1 accuracy',
     """      (pos) => {
        const rawSpeed = pos.coords.speed !== null ? pos.coords.speed * 3.6 : 0;""",
     """      (pos) => {
        // Drop low-accuracy fixes (>50m): indoor drift otherwise inflates distance.
        if (pos.coords.accuracy != null && pos.coords.accuracy > 50) return;
        const rawSpeed = pos.coords.speed !== null ? pos.coords.speed * 3.6 : 0;""")
repa('A1 pure',
     """        setPoints(prev => {
          const updated = [...prev, point];
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const d = haversine(last.lat, last.lng, point.lat, point.lng);
            setDistance(prevD => prevD + d);
          }
          return updated;
        });""",
     """        // Distance is computed OUTSIDE the updater (updaters must be pure —
        // side effects inside them double-fire under StrictMode/concurrent mode).
        const lastPt = lastPointRef.current;
        if (lastPt) {
          const d = haversine(lastPt.lat, lastPt.lng, point.lat, point.lng);
          if (Number.isFinite(d)) setDistance(prevD => prevD + d);
        }
        lastPointRef.current = point;

        // Cap in-memory points: batches are already sent/queued, so keeping the
        // full history in React state only causes O(n^2) re-renders on long trips.
        setPoints(prev => [...prev.slice(-499), point]);""")

# A2: R1 marquee a11y re-apply (regex: whitespace-tolerant)
m = re.search(r"key=\{idx\}\s*\n(\s*)onClick=\{\(\) => handleOpenCity\(item\.name\)\}", ap)
assert m, 'A2 marquee anchor missing'
indent = m.group(1)
ap = ap[:m.start()] + f"key={{idx}}\n{indent}onClick={{() => handleOpenCity(item.name)}}\n{indent}// The marquee renders the list twice for a seamless loop —\n{indent}// hide the duplicate half from screen readers & keyboard.\n{indent}aria-hidden={{idx >= CAROUSEL_CITIES.length}}\n{indent}tabIndex={{idx >= CAROUSEL_CITIES.length ? -1 : undefined}}" + ap[m.end():]
print('OK  A2 marquee')

# A3: Bhubaneswar typo (3 occurrences + image file renamed separately)
assert ap.count('Bhubaneswar') == 3, f"A3 typo count {ap.count('Bhubaneswar')}"
assert ap.count('bhubaneswar.jpg') == 1
ap = ap.replace('Bhubaneswar', 'Bhubaneswar').replace('bhubaneswar.jpg', 'bhubaneswar.jpg')
print('OK  A3 typo')

# A4: Diary proof — seal-once + real verify wiring
repa('A4 state',
     "  const [proofResult, setProofResult] = useState<{ signature: string; valid: boolean; recordCount: number } | null>(null);",
     """  const [proofSeal, setProofSeal] = useState<{ signature: string; chain: string[]; sealedAt: string; recordCount: number } | null>(null);
  const [proofCheck, setProofCheck] = useState<{ valid: boolean; brokenIndex: number; checkedAt: string; recordCount: number } | null>(null);
  const [proofBusy, setProofBusy] = useState(false);""")

m = re.search(r"  useEffect\(\(\) => \{\n    if \(!tripId\) return;\n    import\('\./store/tripProof'\)\.then\(\(\{ generateTripProofHashChain \}\) => \{.*?  \}, \[tripId, trip, points, expenses\]\);\n", ap, re.DOTALL)
assert m, 'A4 effect anchor missing'
new_effect = """  // Load any previously sealed snapshot for this trip. Sealing is explicit and
  // user-driven: auto-sealing on every render would re-baseline after each
  // diary edit and could never detect tampering.
  useEffect(() => {
    if (!tripId) return;
    try {
      const raw = localStorage.getItem(`tripProofSeal_${tripId}`);
      if (raw) { setProofSeal(JSON.parse(raw)); }
      else { setProofSeal(null); setProofCheck(null); }
    } catch { setProofSeal(null); }
  }, [tripId]);

  const buildProofRecords = () => {
    const FALLBACK_TS = '1970-01-01T00:00:00.000Z'; // deterministic: same records => same hash
    return [
      { id: `trip_${tripId}`, timestamp: trip?.createdAt || FALLBACK_TS, type: 'created', payload: { origin: trip?.originCity, destination: trip?.destinationCity } },
      ...points.map((p: any, i: number) => ({ id: p.id || `pt_${i}`, timestamp: p.timestamp || FALLBACK_TS, type: 'gps_point', payload: { lat: p.lat, lng: p.lng } })),
      ...expenses.map((e: any, i: number) => ({ id: e.id || `exp_${i}`, timestamp: e.date || FALLBACK_TS, type: 'expense', payload: { amount: e.amount, category: e.category } }))
    ] as any[];
  };

  const handleSealJourney = async () => {
    if (!tripId || proofBusy) return;
    setProofBusy(true);
    try {
      const { generateTripProofHashChain } = await import('./store/tripProof');
      const records = buildProofRecords();
      const gen = await generateTripProofHashChain(tripId, records);
      const seal = { signature: gen.proofSignature, chain: gen.chain, sealedAt: new Date().toISOString(), recordCount: records.length };
      try { localStorage.setItem(`tripProofSeal_${tripId}`, JSON.stringify(seal)); } catch { /* ignore */ }
      setProofSeal(seal);
      setProofCheck({ valid: true, brokenIndex: -1, checkedAt: seal.sealedAt, recordCount: records.length });
    } catch {
      setProofCheck({ valid: false, brokenIndex: -2, checkedAt: new Date().toISOString(), recordCount: buildProofRecords().length });
    } finally { setProofBusy(false); }
  };

  const handleVerifyJourney = async () => {
    if (!tripId || !proofSeal || proofBusy) return;
    setProofBusy(true);
    try {
      const { verifyTripProofHashChain } = await import('./store/tripProof');
      const records = buildProofRecords();
      const res = await verifyTripProofHashChain(tripId, records, proofSeal.signature, proofSeal.chain);
      setProofCheck({ valid: res.valid, brokenIndex: res.brokenIndex, checkedAt: new Date().toISOString(), recordCount: records.length });
    } catch {
      setProofCheck({ valid: false, brokenIndex: -2, checkedAt: new Date().toISOString(), recordCount: buildProofRecords().length });
    } finally { setProofBusy(false); }
  };
"""
ap = ap[:m.start()] + new_effect + ap[m.end():]
print('OK  A4 effect')

# A5: Diary cert UI honesty
repa('A5 chip',
     '<ShieldCheck size={14} className="text-emerald-400" /> Tamper-Evident SHA-256 Verified',
     """{!proofSeal ? (<><ShieldCheck size={14} className="text-amber-400" /> SHA-256 Trip Proof — Not Sealed</>)
            : proofCheck && !proofCheck.valid ? (<><ShieldCheck size={14} className="text-red-400" /> Changed Since Seal</>)
            : proofCheck?.valid ? (<><ShieldCheck size={14} className="text-emerald-400" /> Chain Intact — Verified</>)
            : (<><ShieldCheck size={14} className="text-teal-300" /> Sealed — Tap Verify</>)}""")
repa('A5 copy',
     "Every GPS coordinate, station ping, and expense entry in this diary is hash-chained with SHA-256 cryptographic signatures to guarantee un-altered travel proof for official reimbursement & corporate claims.",
     "Seal a SHA-256 hash-chained snapshot of this diary's GPS points and expense entries. Re-verify anytime: any edit after sealing is detected and reported. Device-local check — server-anchored audit coming soon.")
repa('A5 box',
     """        {proofResult && (
          <div className="bg-[#050A18] p-3 rounded-lg border border-slate-800 font-mono text-[11px] mb-4 space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>Sealed Records:</span>
              <span className="text-slate-100 font-bold">{proofResult.recordCount} immutable logs</span>
            </div>
            <div className="flex justify-between text-slate-400 truncate">
              <span>SHA-256 Root Hash:</span>
              <span className="text-emerald-400 font-bold ml-2 truncate">{proofResult.signature}</span>
            </div>
          </div>
        )}""",
     """        {proofSeal && (
          <div className="bg-[#050A18] p-3 rounded-lg border border-slate-800 font-mono text-[11px] mb-4 space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>Sealed Records:</span>
              <span className="text-slate-100 font-bold">{proofSeal.recordCount} hash-linked logs</span>
            </div>
            <div className="flex justify-between text-slate-400 truncate">
              <span>SHA-256 Root Hash:</span>
              <span className="text-emerald-400 font-bold ml-2 truncate">{proofSeal.signature}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Sealed At:</span>
              <span className="text-slate-100 font-bold">{new Date(proofSeal.sealedAt).toLocaleString()}</span>
            </div>
            {proofCheck && (
              <div className="flex justify-between text-slate-400">
                <span>Last Check:</span>
                <span className={`font-bold ${proofCheck.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                  {proofCheck.valid ? `Intact (${proofCheck.recordCount} records)` : proofCheck.brokenIndex >= 0 ? `Record #${proofCheck.brokenIndex + 1} differs` : 'Signature mismatch'}
                </span>
              </div>
            )}
          </div>
        )}""")
repa('A5 buttons',
     """        <button
          onClick={() => window.print()}
          className="w-full bg-[#00695C] hover:bg-teal-700 text-white py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
        >
          <Printer size={14} /> Download / Print Verified Journey Certificate
        </button>""",
     """        <div className="grid grid-cols-2 gap-2">
          {!proofSeal ? (
            <button
              onClick={handleSealJourney}
              disabled={proofBusy}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
            >
              <ShieldCheck size={14} /> {proofBusy ? 'Sealing…' : 'Seal Journey Snapshot'}
            </button>
          ) : (
            <button
              onClick={handleVerifyJourney}
              disabled={proofBusy}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
            >
              <ShieldCheck size={14} /> {proofBusy ? 'Checking…' : 'Verify Integrity Now'}
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="bg-[#00695C] hover:bg-teal-700 text-white py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
          >
            <Printer size={14} /> Print Certificate
          </button>
        </div>""")

open(AP, 'w', encoding='utf-8').write(ap)
print('APP DONE')
