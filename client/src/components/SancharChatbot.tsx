import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

const QUICK_PROMPTS = [
  '🎒 Luggage packing tips?',
  '🛡️ Emergency contacts & SOS?',
  '🍛 Best food spots in India?',
  '📶 How does offline GPS work?',
  '🚌 Inter-city transport guidance'
];

export default function SancharChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: 'Namaste! 🙏 I am your Sanchar AI Assistant. Ask me anything about Indian travel, offline GPS tracking, heavy luggage advice, or safety tips!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const generateAIResponse = (userQuery: string): string => {
    const q = userQuery.toLowerCase();

    if (q.includes('luggage') || q.includes('pack') || q.includes('heavy') || q.includes('bag')) {
      return '🎒 Luggage Buddy Advice:\n• Enable "Heavy Luggage" in the Budget Calculator to auto-allocate porter/cart fees (~₹200).\n• Keep essentials (power bank, ID cards, medicines) in your front daypack.\n• In Indian railway stations, look for authorized Coolies in red shirts with numbered brass armbands.';
    }
    if (q.includes('offline') || q.includes('gps') || q.includes('internet') || q.includes('no network')) {
      return '📶 Offline AI Guidance:\n• Sanchar AI records your GPS telemetry directly to IndexedDB on your device.\n• Offline maps provide Haversine straight-line bearing and ETA to saved POIs.\n• Your exact route never leaves your device — complete privacy built-in!';
    }
    if (q.includes('sos') || q.includes('emergency') || q.includes('help') || q.includes('police') || q.includes('safe')) {
      return '🛡️ India Emergency Quick Links:\n• All Emergency Services: Dial 112\n• Railway Police (RPF): Dial 139\n• Women Helpline: Dial 1091\n• Tap the SOS button in your Active Trip for one-tap location sharing even offline!';
    }
    if (q.includes('food') || q.includes('eat') || q.includes('dish') || q.includes('restaur')) {
      return '🍛 Local Food Guide:\n• South India: Filter Coffee, Masala Dosa, Appam & Stew, Chettinad Biryani.\n• West/North: Vada Pav in Mumbai, Dal Baati in Jaipur, Chole Bhature in Delhi.\n• Pro tip: Always prefer bottled water & freshly cooked hot street food!';
    }
    if (q.includes('chennai') || q.includes('kochi') || q.includes('mumbai') || q.includes('delhi') || q.includes('bengaluru') || q.includes('jaipur')) {
      return '📍 City Spotlight Pack:\n• You can explore 25+ verified POIs, local emergency numbers, and key transit hubs directly under our City Packs section!';
    }
    if (q.includes('budget') || q.includes('cost') || q.includes('fare') || q.includes('money') || q.includes('rupee')) {
      return '₹ Smart Budget Tips:\n• Budget Travel: ~₹400/day food + ₹300/day local transit.\n• Comfort Travel: ~₹900/day food + ₹600/day local transit.\n• Log receipts using our offline OCR Ticket Scanner!';
    }

    return `✨ I'm here to assist your travel! You can ask about:\n• Offline GPS tracking & Pocket Map\n• Heavy luggage buddy allocations\n• Local food & emergency numbers (112 / 139)\n• Budget calculations & OCR scanning`;
  };

  const handleSend = (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const aiReplyText = generateAIResponse(query);
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: aiReplyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 400);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 bg-gradient-to-r from-[#00695C] to-[#004D40] text-white p-4 rounded-full shadow-2xl hover:scale-105 transition-all duration-300 flex items-center gap-2 group border-2 border-teal-300/30 ${
          isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
        }`}
        title="Open Sanchar AI Travel Assistant"
      >
        <div className="relative">
          <Bot size={26} className="text-teal-100 group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-[#00695C] animate-pulse" />
        </div>
        <span className="font-bold text-sm hidden sm:inline pr-1">Ask Sanchar AI</span>
      </button>

      {/* Chat Drawer / Popup */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[90vw] max-w-[400px] h-[540px] max-h-[82vh] bg-white rounded-3xl shadow-2xl border border-teal-100 flex flex-col overflow-hidden animate-fade-in-up">
          {/* Drawer Header */}
          <div className="bg-gradient-to-r from-[#00695C] to-[#004D40] text-white p-4 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                <Bot size={22} className="text-amber-300" />
              </div>
              <div>
                <h3 className="font-extrabold text-base font-['Plus_Jakarta_Sans'] leading-tight flex items-center gap-1.5">
                  Sanchar AI Assistant
                  <Sparkles size={14} className="text-amber-400" />
                </h3>
                <p className="text-[11px] text-teal-100 font-medium">Offline Travel Companion</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#FAFAF7]">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-[#00695C] text-white rounded-br-xs font-medium'
                      : 'bg-white text-gray-800 border border-gray-150 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>
                </div>
                <span className="text-[10px] text-gray-400 mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 bg-white border border-gray-150 p-3 rounded-2xl rounded-bl-xs max-w-[120px] shadow-sm">
                <Bot size={14} className="text-[#00695C]" />
                <span className="text-xs text-gray-500 font-medium animate-pulse">Thinking…</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-white border-t border-gray-100 flex gap-2 overflow-x-auto no-scrollbar">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                className="whitespace-nowrap text-[11px] font-semibold bg-teal-50 text-[#00695C] hover:bg-[#00695C] hover:text-white px-3 py-1.5 rounded-full transition-colors border border-teal-100/80 shrink-0 cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-3 bg-white border-t border-gray-100 flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask about travel, luggage, safety..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-gray-50 text-xs sm:text-sm text-gray-800 p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-[#00695C]"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="w-9 h-9 rounded-xl bg-[#00695C] hover:bg-[#004D40] text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
