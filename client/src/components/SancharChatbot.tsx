import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, WifiOff, Wifi, RotateCcw, Trash2 } from 'lucide-react';
import axios from 'axios';
import { saveAiChat, getAiChats, clearAiChats, getCachedCityPack } from '../store/db';

// ─── TYPES ───
interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  mode: 'online' | 'offline';
  timestamp: number;
}

interface TripContext {
  originCity?: string;
  destinationCity?: string;
  dayNumber?: number;
  budgetTotal?: number;
  budgetRemaining?: number;
  currentMode?: string;
  topAttractions?: string[];
  keyPhrases?: string[];
  typicalFares?: string;
}

interface SancharChatbotProps {
  activeTrip?: any;
}

// ─── QUICK-START CHIPS ───
const QUICK_CHIPS = [
  { label: '🚗 Typical auto fare?', text: 'Typical auto fare?' },
  { label: '🗣️ 3 key phrases', text: '3 key phrases in this city' },
  { label: '🏥 Nearest hospital', text: 'Where is the nearest hospital?' },
  { label: '🍛 What to eat?', text: 'What to eat in this city?' },
  { label: '🛡️ Safety tips here', text: 'Safety tips for this city' }
];

// ─── GENERAL INDIA FALLBACK KB ───
const GENERAL_INDIA_KB = [
  { matchPatterns: ['emergency', 'help', 'sos', 'accident', 'danger'], answer: "India Emergency: 112 (all services) · Ambulance: 108 · Police: 100 · Fire: 101 · Railway: 139 · Women: 1091. Dial 112 from any phone." },
  { matchPatterns: ['hospital', 'doctor', 'medical', 'sick', 'injury'], answer: "Dial 108 for ambulance anywhere in India. Government hospitals provide free emergency care. Carry basic first-aid supplies." },
  { matchPatterns: ['police', 'theft', 'stolen', 'crime'], answer: "Police: 100 or 112. Railway Police: 139. Women helpline: 1091 / 181. File FIR at nearest police station." },
  { matchPatterns: ['fare', 'auto', 'cab', 'taxi', 'cost', 'price'], answer: "General India: Auto ₹25-35 base + ₹10-15/km. Bus: ₹5-30. Train sleeper: ₹200-600 (500km). Confirm fare before boarding." },
  { matchPatterns: ['phrase', 'say', 'speak', 'language', 'word'], answer: "Hindi: 'Namaste' = Hello · 'Kitna?' = How much? · 'Dhanyavaad' = Thank you." },
  { matchPatterns: ['food', 'eat', 'restaurant', 'dish', 'hungry'], answer: "Prefer freshly cooked hot food. Drink bottled water only. Busy stalls = fresher food. Carry ORS for stomach issues." },
  { matchPatterns: ['safe', 'safety', 'secure', 'night'], answer: "Emergency 112 works everywhere. Share live location. Use official pre-paid transport at stations. Carry ID copies." },
  { matchPatterns: ['place', 'visit', 'see', 'attraction', 'tourist'], answer: "India is incredibly diverse! Popular: Rajasthan forts, Kerala backwaters, Tamil Nadu temples, Himachal mountains, Goa beaches." }
];

// ─── OFFLINE KB MATCHING ───
function matchOfflineKB(query: string, kb: { matchPatterns: string[]; answer: string }[]): string | null {
  const q = query.toLowerCase();
  let bestScore = 0;
  let bestAnswer: string | null = null;

  for (const entry of kb) {
    let score = 0;
    for (const pattern of entry.matchPatterns) {
      if (q.includes(pattern.toLowerCase())) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestAnswer = entry.answer;
    }
  }
  return bestAnswer;
}

export default function SancharChatbot({ activeTrip }: SancharChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadedFromDB, setLoadedFromDB] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // ─── ONLINE/OFFLINE DETECTION ───
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ─── LOAD CHATS FROM IndexedDB (LOCAL ONLY) ───
  useEffect(() => {
    getAiChats().then(chats => {
      if (chats.length > 0) {
        setMessages(chats.map(c => ({
          id: c.id,
          sender: c.sender,
          text: c.text,
          mode: c.mode,
          timestamp: c.timestamp
        })));
      }
      setLoadedFromDB(true);
    }).catch(() => setLoadedFromDB(true));
  }, []);

  // ─── AUTO-SCROLL ───
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // ─── BUILD TRIP CONTEXT FOR API ───
  const buildTripContext = (): TripContext | undefined => {
    if (!activeTrip) return undefined;
    const startDate = new Date(activeTrip.startedAt || activeTrip.createdAt);
    const dayNumber = Math.max(1, Math.ceil((Date.now() - startDate.getTime()) / 86400000));
    return {
      originCity: activeTrip.originCity,
      destinationCity: activeTrip.destinationCity,
      dayNumber,
      budgetTotal: activeTrip.budgetAmount,
      budgetRemaining: activeTrip.budgetAmount ? activeTrip.budgetAmount - (activeTrip.amountSpent || 0) : undefined,
      currentMode: activeTrip.transportMode || 'transit',
    };
  };

  // ─── HANDLE SEND ───
  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query) return;

    // Save user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: query,
      mode: isOnline ? 'online' : 'offline',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    // Persist user message to IndexedDB (LOCAL ONLY — never synced)
    await saveAiChat({ id: userMsg.id, sender: 'user', text: query, mode: userMsg.mode, timestamp: userMsg.timestamp }).catch(() => {});

    let aiText = '';
    let aiMode: 'online' | 'offline' = 'offline';

    // ─── TRY ONLINE FIRST ───
    if (isOnline) {
      try {
        const tripContext = buildTripContext();
        const res = await axios.post('/api/ai/chat', { message: query, tripContext }, { timeout: 15000 });
        if (res.data?.reply) {
          aiText = res.data.reply;
          aiMode = 'online';
        }
      } catch (err: any) {
        // Structured error from server
        if (err?.response?.data?.error) {
          aiText = err.response.data.error;
          aiMode = 'online';
        }
        // else: fall through to offline
      }
    }

    // ─── OFFLINE FALLBACK: LOCAL KB ───
    if (!aiText) {
      aiMode = 'offline';
      // Try to get city pack KB first
      const destCity = activeTrip?.destinationCity;
      let cityKB: { matchPatterns: string[]; answer: string }[] | null = null;

      if (destCity) {
        try {
          const pack = await getCachedCityPack(destCity);
          if (pack?.kb && Array.isArray(pack.kb) && pack.kb.length > 0) {
            cityKB = pack.kb;
          }
        } catch { /* no cached pack */ }
      }

      // Try matching against city KB
      if (cityKB) {
        const match = matchOfflineKB(query, cityKB);
        if (match) {
          aiText = match;
        }
      }

      // Try general India fallback KB
      if (!aiText) {
        const generalMatch = matchOfflineKB(query, GENERAL_INDIA_KB);
        if (generalMatch) {
          aiText = generalMatch;
        }
      }

      // Absolute fallback: honest "I don't have offline data"
      if (!aiText) {
        aiText = "I don't have offline data for that question. General India: 112 emergency · 139 rail enquiry · 108 ambulance. Try asking about emergency, fares, food, safety, phrases, or attractions.";
      }
    }

    const aiMsg: Message = {
      id: crypto.randomUUID(),
      sender: 'ai',
      text: aiText,
      mode: aiMode,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);

    // Persist AI response to IndexedDB (LOCAL ONLY — never synced)
    await saveAiChat({ id: aiMsg.id, sender: 'ai', text: aiText, mode: aiMode, timestamp: aiMsg.timestamp }).catch(() => {});
  };

  // ─── HANDLE RETRY ───
  const handleRetry = () => {
    const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user');
    if (lastUserMsg) {
      handleSend(lastUserMsg.text);
    }
  };

  // ─── HANDLE CLEAR CHATS ───
  const handleClearChats = async () => {
    setMessages([]);
    await clearAiChats().catch(() => {});
  };

  // ─── FORMAT TIME ───
  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ─── MODE CHIP ───
  const modeChip = isOnline
    ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"><Wifi size={10} /> Online — full AI (Gemini)</span>
    : <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200"><WifiOff size={10} /> Offline — local helper</span>;

  // ─── TRIP CONTEXT CHIP ───
  const tripChip = activeTrip ? (() => {
    const startDate = new Date(activeTrip.startedAt || activeTrip.createdAt);
    const dayNumber = Math.max(1, Math.ceil((Date.now() - startDate.getTime()) / 86400000));
    const remaining = activeTrip.budgetAmount ? activeTrip.budgetAmount - (activeTrip.amountSpent || 0) : null;
    return (
      <span className="text-[10px] font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200 truncate max-w-[200px]">
        {activeTrip.originCity} → {activeTrip.destinationCity} · Day {dayNumber}{remaining !== null ? ` · ₹${remaining} left` : ''}
      </span>
    );
  })() : null;

  if (!loadedFromDB) return null;

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 bg-gradient-to-r from-[#FF6F00] to-[#E65100] text-white p-4 rounded-full shadow-2xl hover:scale-105 transition-all duration-300 flex items-center gap-2 group border-2 border-orange-300/30 ${
          isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
        }`}
        style={{ minWidth: '48px', minHeight: '48px' }}
        title="Ask Sanchar AI"
      >
        <div className="relative">
          <Bot size={26} className="text-orange-100 group-hover:rotate-12 transition-transform" />
          <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[#FF6F00] animate-pulse ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        </div>
        <span className="font-bold text-sm hidden sm:inline pr-1">🤖 Ask Sanchar AI</span>
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[390px] h-[100dvh] sm:h-[580px] sm:max-h-[82vh] bg-white sm:rounded-3xl shadow-2xl border-0 sm:border border-orange-100 flex flex-col overflow-hidden animate-fade-in-up">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#FF6F00] to-[#E65100] text-white p-4 flex flex-col gap-2 shadow-md shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <Bot size={22} className="text-amber-200" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base font-['Plus_Jakarta_Sans'] leading-tight flex items-center gap-1.5">
                    Sanchar AI Assistant
                    <Sparkles size={14} className="text-amber-300" />
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearChats}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                  title="Clear chat history"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {modeChip}
              {tripChip}
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#FAFAF7]">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot size={40} className="text-orange-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-[#1F2937] mb-1">Namaste! 🙏</p>
                <p className="text-xs text-[#64748B]">I'm your Sanchar AI travel companion. Ask me anything about Indian travel!</p>
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-[#FF6F00] text-white rounded-br-sm font-medium'
                      : 'bg-white text-gray-800 border border-gray-150 rounded-bl-sm'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>
                </div>
                <div className="flex items-center gap-2 mt-1 px-1">
                  <span className="text-[10px] text-gray-400">{formatTime(msg.timestamp)}</span>
                  {msg.sender === 'ai' && (
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                      msg.mode === 'online'
                        ? 'text-emerald-600 bg-emerald-50'
                        : 'text-amber-600 bg-amber-50'
                    }`}>
                      {msg.mode === 'online' ? 'AI answer — verify important details' : 'Offline Helper — local data only'}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 bg-white border border-gray-150 p-3 rounded-2xl rounded-bl-sm max-w-[140px] shadow-sm">
                <Bot size={14} className="text-[#FF6F00]" />
                <span className="text-xs text-gray-500 font-medium animate-pulse">Thinking…</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick-Start Chips */}
          {messages.length < 3 && (
            <div className="px-3 py-2 bg-white border-t border-gray-100 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
              {QUICK_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(chip.text)}
                  className="whitespace-nowrap text-[11px] font-semibold bg-orange-50 text-[#E65100] hover:bg-[#FF6F00] hover:text-white px-3 py-1.5 rounded-full transition-colors border border-orange-100/80 shrink-0 cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Retry button when last message was offline fallback */}
          {!isTyping && messages.length > 0 && messages[messages.length - 1].sender === 'ai' && messages[messages.length - 1].mode === 'offline' && isOnline && (
            <div className="px-3 py-1.5 bg-emerald-50 border-t border-emerald-100 flex items-center justify-center shrink-0">
              <button
                onClick={handleRetry}
                className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5 hover:underline cursor-pointer"
              >
                <RotateCcw size={12} /> You're back online — Retry with Gemini AI?
              </button>
            </div>
          )}

          {/* Input Box */}
          <div className="p-3 bg-white border-t border-gray-100 flex flex-col gap-1 shrink-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ask about travel, safety, fares..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                className="flex-1 bg-gray-50 text-xs sm:text-sm text-gray-800 p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-[#FF6F00]"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                className="w-9 h-9 rounded-xl bg-[#FF6F00] hover:bg-[#E65100] text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[9px] text-[#94A3B8] text-center">Chats stay on your device · Never synced or uploaded</p>
          </div>
        </div>
      )}
    </>
  );
}
