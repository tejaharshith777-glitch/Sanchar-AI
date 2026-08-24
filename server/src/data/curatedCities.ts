export const curatedCities = [
  {
    city: "Chennai",
    languages: ["Tamil", "English"],
    contentStatus: "curated-sample",
    emergencyNumbers: [{ label: "National Emergency", number: "112" }, { label: "Ambulance", number: "108" }, { label: "Police", number: "100" }],
    transportGuidance: "Typical auto fare 3-6 km: ₹120-₹250 - confirm with driver. Metro available for longer routes.",
    phrases: [
      { en: "Please take me to this address.", local: "தயவுசெய்து என்னை இந்த முகவரிக்கு அழைத்துச் செல்லுங்கள்.", localLang: "Tamil" },
      { en: "How much is the fare?", local: "கட்டணம் எவ்வளவு?", localLang: "Tamil" },
      { en: "Where is the nearest hospital?", local: "அருகிலுள்ள மருத்துவமனை எங்கே?", localLang: "Tamil" }
    ],
    pois: [
      { name: "Marina Beach", type: "attraction", lat: 13.0500, lng: 80.2824 },
      { name: "Kapaleeshwarar Temple", type: "temple", lat: 13.0339, lng: 80.2694 },
      { name: "Government General Hospital", type: "hospital", lat: 13.0792, lng: 80.2752 },
      { name: "Royapettah GH", type: "hospital", lat: 13.0527, lng: 80.2639 },
      { name: "Chennai Central Station", type: "station", lat: 13.0827, lng: 80.2707 },
      { name: "Egmore Station", type: "station", lat: 13.0732, lng: 80.2609 },
      { name: "Commissioner Office", type: "police", lat: 13.0860, lng: 80.2700 },
      { name: "Luggage Storage Central", type: "luggageStorage", lat: 13.0830, lng: 80.2710 },
      { name: "Ripon Building Water ATM", type: "water", lat: 13.0812, lng: 80.2730 }
    ],
    kb: [
      { matchPatterns: ["emergency", "help", "sos", "accident", "danger"], answer: "Emergency: Dial 112 (all services) · Ambulance: 108 · Police: 100 · Fire: 101. Nearest major hospitals: Government General Hospital (Parry's), Royapettah GH, Apollo Hospital (Greams Rd)." },
      { matchPatterns: ["hospital", "doctor", "medical", "sick", "injury"], answer: "Major hospitals in Chennai: Government General Hospital (Park Town), Royapettah Government Hospital, Apollo Hospital (Greams Rd), MIOT Hospital (Manapakkam). Dial 108 for ambulance." },
      { matchPatterns: ["police", "theft", "stolen", "crime", "report"], answer: "Police: Dial 100 or 112. Chennai Police Commissioner Office near Central Station. Railway Police (RPF): Dial 139. Women helpline: 1091." },
      { matchPatterns: ["fare", "auto", "cab", "taxi", "rickshaw", "cost", "price", "charge"], answer: "Chennai auto fares: ₹25 base + ₹12-15/km (meter). Typical 3-6 km ride: ₹120-250. Ola/Uber available. Metro: ₹10-60 per trip. Local bus: ₹5-25. Always confirm fare before boarding autos." },
      { matchPatterns: ["place", "visit", "see", "attraction", "sight", "tourist", "temple"], answer: "Top 5 Chennai: 1) Marina Beach — world's second longest urban beach. 2) Kapaleeshwarar Temple — stunning Dravidian architecture. 3) San Thome Cathedral — built over tomb of St. Thomas. 4) Fort St. George — first English fortress in India. 5) Government Museum — one of India's oldest." },
      { matchPatterns: ["phrase", "say", "speak", "language", "tamil", "word", "translate"], answer: "Key Tamil phrases: 1) 'Vanakkam' (வணக்கம்) = Hello. 2) 'Evvalavu?' (எவ்வளவு?) = How much? 3) 'Nandri' (நன்றி) = Thank you." },
      { matchPatterns: ["food", "eat", "restaurant", "dish", "cuisine", "hungry"], answer: "Chennai food staples: Filter Coffee, Masala Dosa & Sambar, Idli-Vada, Chettinad Chicken, Kothu Parotta, Jigarthanda. Try Saravana Bhavan for pure veg, Murugan Idli Shop for breakfast. Street food at Mylapore & Besant Nagar." },
      { matchPatterns: ["safe", "safety", "secure", "night", "danger", "precaution"], answer: "Chennai safety tips: Generally safe city. Avoid isolated beach areas after dark. Use meter autos or ride apps. Keep valuables secure in crowded markets (T. Nagar, Parry's). Carry printed hotel address in Tamil. Emergency: 112." }
    ]
  },
  {
    city: "Kochi",
    languages: ["Malayalam", "English"],
    contentStatus: "curated-sample",
    emergencyNumbers: [{ label: "National Emergency", number: "112" }, { label: "Ambulance", number: "108" }, { label: "Police", number: "100" }],
    transportGuidance: "Ferries are a fast way to cross between Fort Kochi and Ernakulam. Auto fare: ₹30 base + ₹15/km.",
    phrases: [
      { en: "Please take me to this address.", local: "ദയവായി എന്നെ ഈ വിലാസത്തിൽ എത്തിക്കൂ.", localLang: "Malayalam" },
      { en: "How much is the fare?", local: "കൂലി എത്രയാണ്?", localLang: "Malayalam" },
      { en: "Where is the nearest hospital?", local: "ഏറ്റവും അടുത്തുള്ള ആശുപത്രി എവിടെയാണ്?", localLang: "Malayalam" }
    ],
    pois: [
      { name: "Fort Kochi", type: "attraction", lat: 9.9658, lng: 76.2421 },
      { name: "Chinese Fishing Nets", type: "attraction", lat: 9.9676, lng: 76.2284 },
      { name: "Mattancherry Palace", type: "attraction", lat: 9.9583, lng: 76.2597 },
      { name: "Ernakulam Junction", type: "station", lat: 9.9667, lng: 76.2917 },
      { name: "Ernakulam General Hospital", type: "hospital", lat: 9.9800, lng: 76.2890 },
      { name: "Lakeshore Hospital", type: "hospital", lat: 9.9715, lng: 76.3070 },
      { name: "Fort Kochi Police Station", type: "police", lat: 9.9650, lng: 76.2430 }
    ],
    kb: [
      { matchPatterns: ["emergency", "help", "sos", "accident", "danger"], answer: "Emergency: Dial 112 (all services) · Ambulance: 108 · Police: 100. Nearest hospitals: Ernakulam General Hospital, Lakeshore Hospital, Medical Trust Hospital." },
      { matchPatterns: ["hospital", "doctor", "medical", "sick", "injury"], answer: "Hospitals in Kochi: Ernakulam General Hospital, Lakeshore Hospital (Maradu), Medical Trust Hospital (MG Road), Amrita Hospital (Edappally). Ambulance: 108." },
      { matchPatterns: ["police", "theft", "stolen", "crime"], answer: "Police: Dial 100 or 112. Fort Kochi Police Station near the beach area. Tourist police available in Fort Kochi. Women helpline: 1091." },
      { matchPatterns: ["fare", "auto", "cab", "taxi", "rickshaw", "cost", "price", "ferry", "boat"], answer: "Kochi transport: Auto ₹30 base + ₹15/km. Ferry Fort Kochi↔Ernakulam: ₹5-6. Kochi Metro: ₹10-60. Ola/Uber available. Ferry is fastest across backwaters." },
      { matchPatterns: ["place", "visit", "see", "attraction", "sight", "tourist"], answer: "Top 5 Kochi: 1) Chinese Fishing Nets — iconic Fort Kochi landmark. 2) Mattancherry Palace — Portuguese-built Dutch Palace with murals. 3) Paradesi Synagogue — oldest active synagogue in India. 4) Marine Drive — scenic waterfront promenade. 5) Bolgatty Island — heritage palace on island." },
      { matchPatterns: ["phrase", "say", "speak", "language", "malayalam", "word"], answer: "Key Malayalam phrases: 1) 'Namaskaram' (നമസ്കാരം) = Hello. 2) 'Ethra?' (എത്ര?) = How much? 3) 'Nanni' (നന്ദി) = Thank you." },
      { matchPatterns: ["food", "eat", "restaurant", "dish", "hungry"], answer: "Kochi food staples: Appam & Stew, Kerala Fish Curry, Puttu & Kadala, Malabar Biryani, Banana Chips, Karimeen (Pearl Spot fish). Try Fort Kochi seafood stalls and Kayees Biryani." },
      { matchPatterns: ["safe", "safety", "secure", "night"], answer: "Kochi safety tips: Generally very safe. Fort Kochi area is tourist-friendly. Use ferries for backwater crossings. Avoid swimming at beaches (strong currents). Keep valuables secure. Emergency: 112." }
    ]
  },
  {
    city: "Bengaluru",
    languages: ["Kannada", "English"],
    contentStatus: "curated-sample",
    emergencyNumbers: [{ label: "National Emergency", number: "112" }, { label: "Ambulance", number: "108" }, { label: "Police", number: "100" }],
    transportGuidance: "Traffic can be heavy. Use Namma Metro when possible. Auto fare: ₹30 base + ₹15/km.",
    phrases: [
      { en: "Please take me to this address.", local: "ದಯವಿಟ್ಟು ನನ್ನನ್ನು ಈ ವಿಳಾಸಕ್ಕೆ ಕರೆದೊಯ್ಯಿರಿ.", localLang: "Kannada" },
      { en: "How much is the fare?", local: "ಬಾಡಿಗೆ ಎಷ್ಟು?", localLang: "Kannada" },
      { en: "Where is the nearest hospital?", local: "ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆ ಎಲ್ಲಿದೆ?", localLang: "Kannada" }
    ],
    pois: [
      { name: "Cubbon Park", type: "attraction", lat: 12.9779, lng: 77.5952 },
      { name: "Lalbagh Botanical Garden", type: "attraction", lat: 12.9507, lng: 77.5848 },
      { name: "KSR Bengaluru Station", type: "station", lat: 12.9781, lng: 77.5695 },
      { name: "Victoria Hospital", type: "hospital", lat: 12.9570, lng: 77.5745 },
      { name: "St. John's Hospital", type: "hospital", lat: 12.9283, lng: 77.6208 },
      { name: "Cubbon Park Police Station", type: "police", lat: 12.9780, lng: 77.5955 },
      { name: "Cloak Room KSR", type: "luggageStorage", lat: 12.9783, lng: 77.5693 }
    ],
    kb: [
      { matchPatterns: ["emergency", "help", "sos", "accident"], answer: "Emergency: Dial 112 · Ambulance: 108 · Police: 100. Major hospitals: Victoria Hospital, St. John's Medical College Hospital, Manipal Hospital (HAL Road)." },
      { matchPatterns: ["hospital", "doctor", "medical", "sick"], answer: "Bengaluru hospitals: Victoria Hospital (KR Market), St. John's Hospital (Koramangala), Manipal Hospital (HAL), Narayana Health (Bommasandra). Ambulance: 108." },
      { matchPatterns: ["police", "theft", "stolen", "crime"], answer: "Police: Dial 100 or 112. Cubbon Park Police Station central. Railway Police: 139. Women helpline: 1091. Bengaluru Police app: 'Suraksha'." },
      { matchPatterns: ["fare", "auto", "cab", "taxi", "cost", "price", "metro"], answer: "Bengaluru: Auto ₹30 base + ₹15/km (meter mandatory). Namma Metro: ₹10-60. BMTC bus: ₹5-30. Ola/Uber/Rapido widely available. Traffic heavy 8-11am & 5-9pm — use Metro!" },
      { matchPatterns: ["place", "visit", "see", "attraction", "sight", "tourist"], answer: "Top 5 Bengaluru: 1) Cubbon Park — 300-acre green oasis in city center. 2) Lalbagh Botanical Garden — 240-year-old garden with glasshouse. 3) Bangalore Palace — Tudor-style architecture. 4) Tipu Sultan's Summer Palace — beautiful teak structure. 5) ISKCON Temple — largest in Karnataka." },
      { matchPatterns: ["phrase", "say", "speak", "language", "kannada", "word"], answer: "Key Kannada phrases: 1) 'Namaskara' (ನಮಸ್ಕಾರ) = Hello. 2) 'Eshtu?' (ಎಷ್ಟು?) = How much? 3) 'Dhanyavadagalu' (ಧನ್ಯವಾದಗಳು) = Thank you." },
      { matchPatterns: ["food", "eat", "restaurant", "dish", "hungry"], answer: "Bengaluru food staples: Masala Dosa at CTR/Vidyarthi Bhavan, Bisi Bele Bath, Ragi Mudde, Filter Coffee, Mangalore Buns. Try VV Puram Food Street and MTR for traditional Karnataka fare." },
      { matchPatterns: ["safe", "safety", "secure", "night"], answer: "Bengaluru safety: Generally safe. Areas like Indiranagar, Koramangala well-lit. Avoid isolated areas late night. Use ride-sharing apps. Traffic is the main hazard — always use crossings. Emergency: 112." }
    ]
  },
  {
    city: "Mumbai",
    languages: ["Marathi", "Hindi", "English"],
    contentStatus: "curated-sample",
    emergencyNumbers: [{ label: "National Emergency", number: "112" }, { label: "Ambulance", number: "108" }, { label: "Police", number: "100" }],
    transportGuidance: "Local trains are the lifeline but very crowded during peak hours. Autos run on meter in suburbs.",
    phrases: [
      { en: "Please take me to this address.", local: "कृपया मला या पत्त्यावर घेऊन जा.", localLang: "Marathi" },
      { en: "How much is the fare?", local: "भाडे किती आहे?", localLang: "Marathi" },
      { en: "Where is the nearest hospital?", local: "सर्वात जवळचे रुग्णालय कुठे आहे?", localLang: "Marathi" }
    ],
    pois: [
      { name: "Gateway of India", type: "attraction", lat: 18.9220, lng: 72.8347 },
      { name: "Marine Drive", type: "attraction", lat: 18.9440, lng: 72.8236 },
      { name: "CSMT Station", type: "station", lat: 18.9398, lng: 72.8354 },
      { name: "Mumbai Central Station", type: "station", lat: 18.9690, lng: 72.8190 },
      { name: "JJ Hospital", type: "hospital", lat: 18.9627, lng: 72.8327 },
      { name: "KEM Hospital", type: "hospital", lat: 19.0002, lng: 72.8416 },
      { name: "Colaba Police Station", type: "police", lat: 18.9215, lng: 72.8335 }
    ],
    kb: [
      { matchPatterns: ["emergency", "help", "sos", "accident"], answer: "Emergency: Dial 112 · Ambulance: 108 · Police: 100. Major hospitals: JJ Hospital (Byculla), KEM Hospital (Parel), Breach Candy Hospital, Lilavati Hospital (Bandra)." },
      { matchPatterns: ["hospital", "doctor", "medical", "sick"], answer: "Mumbai hospitals: JJ Hospital (Byculla), KEM Hospital (Parel), Breach Candy Hospital (Bhulabhai Desai Rd), Lilavati Hospital (Bandra), Hinduja Hospital (Mahim). Ambulance: 108." },
      { matchPatterns: ["police", "theft", "stolen", "crime"], answer: "Police: Dial 100 or 112. Colaba Police Station near Gateway. Railway Police: 139. Women helpline: 1091. Mumbai Police app: available on Play Store." },
      { matchPatterns: ["fare", "auto", "cab", "taxi", "cost", "price", "train", "local"], answer: "Mumbai: Local train ₹5-15 (cheapest!). Auto (suburbs): ₹21 base + ₹14/km. Kaali-peeli taxi: ₹25 base + ₹16/km. Ola/Uber available. BEST bus: ₹5-20. Avoid autos in peak hours — take trains." },
      { matchPatterns: ["place", "visit", "see", "attraction", "sight", "tourist"], answer: "Top 5 Mumbai: 1) Gateway of India — iconic waterfront arch. 2) Marine Drive — 'Queen's Necklace' seafront. 3) Elephanta Caves — UNESCO heritage caves. 4) Chhatrapati Shivaji Terminus — stunning Victorian Gothic station. 5) Haji Ali Dargah — mosque on an islet." },
      { matchPatterns: ["phrase", "say", "speak", "language", "marathi", "hindi", "word"], answer: "Key Marathi/Hindi phrases: 1) 'Namaskar' (नमस्कार) = Hello. 2) 'Kitna?' (कितना?) = How much? 3) 'Dhanyavaad' (धन्यवाद) = Thank you." },
      { matchPatterns: ["food", "eat", "restaurant", "dish", "hungry"], answer: "Mumbai food staples: Vada Pav (₹15-30), Pav Bhaji, Bhel Puri at Chowpatty, Bombay Sandwich, Misal Pav, Keema Pav. Try Juhu Beach stalls, Leopold Café, and Bademiya for kebabs." },
      { matchPatterns: ["safe", "safety", "secure", "night"], answer: "Mumbai safety: Generally safe even late. Avoid deserted areas and beaches after midnight. Local trains very crowded 8-11am & 5-9pm. Keep phone secure in crowds. Use first-class ladies' compartment if female. Emergency: 112." }
    ]
  },
  {
    city: "Delhi",
    languages: ["Hindi", "English"],
    contentStatus: "curated-sample",
    emergencyNumbers: [{ label: "National Emergency", number: "112" }, { label: "Ambulance", number: "108" }, { label: "Police", number: "100" }],
    transportGuidance: "Delhi Metro connects almost the entire city. Auto rickshaws should use meters.",
    phrases: [
      { en: "Please take me to this address.", local: "कृपया मुझे इस पते पर ले चलें।", localLang: "Hindi" },
      { en: "How much is the fare?", local: "किराया कितना है?", localLang: "Hindi" },
      { en: "Where is the nearest hospital?", local: "सबसे नजदीकी अस्पताल कहाँ है?", localLang: "Hindi" }
    ],
    pois: [
      { name: "Red Fort", type: "attraction", lat: 28.6562, lng: 77.2410 },
      { name: "India Gate", type: "attraction", lat: 28.6129, lng: 77.2295 },
      { name: "Qutub Minar", type: "attraction", lat: 28.5245, lng: 77.1855 },
      { name: "New Delhi Railway Station", type: "station", lat: 28.6429, lng: 77.2191 },
      { name: "AIIMS Hospital", type: "hospital", lat: 28.5671, lng: 77.2100 },
      { name: "Safdarjung Hospital", type: "hospital", lat: 28.5681, lng: 77.2065 },
      { name: "Parliament Street PS", type: "police", lat: 28.6200, lng: 77.2150 }
    ],
    kb: [
      { matchPatterns: ["emergency", "help", "sos", "accident"], answer: "Emergency: Dial 112 · Ambulance: 108 · Police: 100. Major hospitals: AIIMS (Ring Road), Safdarjung Hospital, RML Hospital, GTB Hospital." },
      { matchPatterns: ["hospital", "doctor", "medical", "sick"], answer: "Delhi hospitals: AIIMS (premier), Safdarjung Hospital, Ram Manohar Lohia Hospital, GTB Hospital (Dilshad Garden). Ambulance: 108. CATS ambulance: 102." },
      { matchPatterns: ["police", "theft", "stolen", "crime"], answer: "Police: Dial 100 or 112. Tourist police at major monuments. Railway Police: 139. Women helpline: 1091 / 181. Delhi Police WhatsApp: available." },
      { matchPatterns: ["fare", "auto", "cab", "taxi", "cost", "price", "metro"], answer: "Delhi: Metro ₹10-60 (best for distances). Auto: ₹25 base + ₹9.50/km (insist on meter!). Ola/Uber available. DTC/Cluster bus: ₹5-15. Pre-paid auto booths at stations — use them!" },
      { matchPatterns: ["place", "visit", "see", "attraction", "sight", "tourist"], answer: "Top 5 Delhi: 1) Red Fort — Mughal emperor's residence, UNESCO site. 2) India Gate — war memorial with eternal flame. 3) Qutub Minar — tallest brick minaret, UNESCO site. 4) Humayun's Tomb — precursor to Taj Mahal. 5) Lotus Temple — stunning Bahá'í House of Worship." },
      { matchPatterns: ["phrase", "say", "speak", "language", "hindi", "word"], answer: "Key Hindi phrases: 1) 'Namaste' (नमस्ते) = Hello. 2) 'Kitna?' (कितना?) = How much? 3) 'Dhanyavaad' (धन्यवाद) = Thank you." },
      { matchPatterns: ["food", "eat", "restaurant", "dish", "hungry"], answer: "Delhi food staples: Chole Bhature, Butter Chicken, Paranthe Wali Gali parathas, Dahi Bhalla, Kebabs at Jama Masjid, Chaat at Chandni Chowk. Don't miss Old Delhi food walk!" },
      { matchPatterns: ["safe", "safety", "secure", "night"], answer: "Delhi safety tips: Use Metro for safe travel. Avoid isolated areas after dark. Pre-paid autos from stations. Women: use ladies' coach in Metro. Keep valuables secure in markets. Share live location. Emergency: 112." }
    ]
  },
  {
    city: "Kolkata",
    languages: ["Bengali", "English"],
    contentStatus: "curated-sample",
    emergencyNumbers: [{ label: "National Emergency", number: "112" }, { label: "Ambulance", number: "108" }, { label: "Police", number: "100" }],
    transportGuidance: "Yellow taxis and metro are iconic. Ferries operate on the Hooghly.",
    phrases: [
      { en: "Please take me to this address.", local: "দয়া করে আমাকে এই ঠিকানায় নিয়ে চলুন।", localLang: "Bengali" },
      { en: "How much is the fare?", local: "ভাড়া কত?", localLang: "Bengali" },
      { en: "Where is the nearest hospital?", local: "নিকটতম হাসপাতাল কোথায়?", localLang: "Bengali" }
    ],
    pois: [
      { name: "Victoria Memorial", type: "attraction", lat: 22.5448, lng: 88.3426 },
      { name: "Howrah Bridge", type: "attraction", lat: 22.5851, lng: 88.3468 },
      { name: "Howrah Station", type: "station", lat: 22.5841, lng: 88.3413 },
      { name: "Sealdah Station", type: "station", lat: 22.5656, lng: 88.3700 },
      { name: "SSKM Hospital", type: "hospital", lat: 22.5350, lng: 88.3440 },
      { name: "Medical College Hospital", type: "hospital", lat: 22.5495, lng: 88.3601 },
      { name: "Lalbazar Police HQ", type: "police", lat: 22.5711, lng: 88.3535 }
    ],
    kb: [
      { matchPatterns: ["emergency", "help", "sos", "accident"], answer: "Emergency: Dial 112 · Ambulance: 108 · Police: 100. Major hospitals: SSKM Hospital, Medical College Hospital, RN Tagore Hospital, Fortis Hospital." },
      { matchPatterns: ["hospital", "doctor", "medical", "sick"], answer: "Kolkata hospitals: SSKM Hospital (Bhowanipore), Medical College Hospital (College St), RN Tagore Hospital, Apollo Gleneagles. Ambulance: 108." },
      { matchPatterns: ["police", "theft", "stolen", "crime"], answer: "Police: Dial 100 or 112. Lalbazar Police HQ central. Railway Police: 139. Women helpline: 1091. Kolkata Police is known as responsive." },
      { matchPatterns: ["fare", "auto", "cab", "taxi", "cost", "price"], answer: "Kolkata: Yellow taxi ₹25 base + ₹12/km (cheapest metros). Metro: ₹5-25. Auto: ₹10 minimum. Tram: ₹6-8. Ola/Uber available. Hand-pulled rickshaws in old areas." },
      { matchPatterns: ["place", "visit", "see", "attraction", "sight", "tourist"], answer: "Top 5 Kolkata: 1) Victoria Memorial — white marble museum of Raj era. 2) Howrah Bridge — iconic cantilever bridge. 3) Indian Museum — largest & oldest in India. 4) Dakshineswar Temple — Goddess Kali temple on the Hooghly. 5) Park Street — food & nightlife hub." },
      { matchPatterns: ["phrase", "say", "speak", "language", "bengali", "bangla", "word"], answer: "Key Bengali phrases: 1) 'Nomoshkar' (নমস্কার) = Hello. 2) 'Koto?' (কত?) = How much? 3) 'Dhonnobad' (ধন্যবাদ) = Thank you." },
      { matchPatterns: ["food", "eat", "restaurant", "dish", "hungry"], answer: "Kolkata food staples: Rosogolla, Mishti Doi, Kathi Rolls (Nizam's), Kosha Mangsho, Phuchka (pani puri), Fish Curry & Rice. Visit Flurys for breakfast, Peter Cat for Chelo Kebab." },
      { matchPatterns: ["safe", "safety", "secure", "night"], answer: "Kolkata safety: One of India's safest metros. Park Street and central areas well-lit. Use Metro or yellow taxis. Carry small change for autos. Emergency: 112." }
    ]
  },
  {
    city: "Hyderabad",
    languages: ["Telugu", "Urdu", "Hindi", "English"],
    contentStatus: "curated-sample",
    emergencyNumbers: [{ label: "National Emergency", number: "112" }, { label: "Ambulance", number: "108" }, { label: "Police", number: "100" }],
    transportGuidance: "MMTS local trains connect key areas. Hyderabad Metro runs key corridors. Auto fare: ₹25 base + ₹12/km.",
    phrases: [
      { en: "Please take me to this address.", local: "దయచేసి నన్ను ఈ చిరునామాకు తీసుకెళ్ళండి.", localLang: "Telugu" },
      { en: "How much is the fare?", local: "చార్జ్ ఎంత?", localLang: "Telugu" },
      { en: "Where is the nearest hospital?", local: "సమీపంలోని ఆసుపత్రి ఎక్కడ ఉంది?", localLang: "Telugu" }
    ],
    pois: [
      { name: "Charminar", type: "attraction", lat: 17.3616, lng: 78.4747 },
      { name: "Golconda Fort", type: "attraction", lat: 17.3833, lng: 78.4011 },
      { name: "Secunderabad Station", type: "station", lat: 17.4339, lng: 78.5022 },
      { name: "Nampally Station", type: "station", lat: 17.3900, lng: 78.4750 },
      { name: "Gandhi Hospital", type: "hospital", lat: 17.3985, lng: 78.4810 },
      { name: "Osmania General Hospital", type: "hospital", lat: 17.3782, lng: 78.4844 },
      { name: "Hyderabad Police Commissioner", type: "police", lat: 17.3880, lng: 78.4760 }
    ],
    kb: [
      { matchPatterns: ["emergency", "help", "sos", "accident"], answer: "Emergency: Dial 112 · Ambulance: 108 · Police: 100. Major hospitals: Gandhi Hospital, Osmania General Hospital, NIMS, Apollo Hospital (Jubilee Hills)." },
      { matchPatterns: ["hospital", "doctor", "medical", "sick"], answer: "Hyderabad hospitals: Gandhi Hospital, Osmania General Hospital, NIMS (Punjagutta), Apollo Hospital (Jubilee Hills), Yashoda Hospital. Ambulance: 108." },
      { matchPatterns: ["police", "theft", "stolen", "crime"], answer: "Police: Dial 100 or 112. Hyderabad Police known for 'She Teams' for women's safety. Railway Police: 139. Women helpline: 1091." },
      { matchPatterns: ["fare", "auto", "cab", "taxi", "cost", "price", "metro"], answer: "Hyderabad: Auto ₹25 base + ₹12/km. Metro: ₹10-60 (3 lines). MMTS train: ₹5-15. TSRTC bus: ₹5-30. Ola/Uber widely available. Shared auto to Old City: ₹10-15." },
      { matchPatterns: ["place", "visit", "see", "attraction", "sight", "tourist"], answer: "Top 5 Hyderabad: 1) Charminar — 400-year-old monument & market. 2) Golconda Fort — acoustic marvel fortress. 3) Hussain Sagar Lake — giant Buddha statue. 4) Ramoji Film City — world's largest film city. 5) Salar Jung Museum — one of India's largest." },
      { matchPatterns: ["phrase", "say", "speak", "language", "telugu", "word"], answer: "Key Telugu phrases: 1) 'Namaskaram' (నమస్కారం) = Hello. 2) 'Entha?' (ఎంత?) = How much? 3) 'Dhanyavaadalu' (ధన్యవాదాలు) = Thank you." },
      { matchPatterns: ["food", "eat", "restaurant", "dish", "hungry"], answer: "Hyderabad food staples: Hyderabadi Biryani (Bawarchi/Paradise), Haleem, Irani Chai with Osmania biscuit, Double Ka Meetha, Lukhmi. Must-visit: Hotel Shadab, Shah Ghouse." },
      { matchPatterns: ["safe", "safety", "secure", "night"], answer: "Hyderabad safety: Generally safe. Old City area gets crowded — secure valuables. Use Metro or ride apps for night travel. Well-policed tourist areas. Emergency: 112." }
    ]
  },
  {
    city: "Jaipur",
    languages: ["Hindi", "Rajasthani", "English"],
    contentStatus: "curated-sample",
    emergencyNumbers: [{ label: "National Emergency", number: "112" }, { label: "Ambulance", number: "108" }, { label: "Police", number: "100" }],
    transportGuidance: "Auto rickshaws and cycle rickshaws are common in the old city. Always negotiate or insist on meter.",
    phrases: [
      { en: "Please take me to this address.", local: "कृपया मुझे इस पते पर ले चलें।", localLang: "Hindi" },
      { en: "How much is the fare?", local: "किराया कितना है?", localLang: "Hindi" },
      { en: "Where is the nearest hospital?", local: "सबसे नजदीकी अस्पताल कहाँ है?", localLang: "Hindi" }
    ],
    pois: [
      { name: "Amber Fort", type: "attraction", lat: 26.9855, lng: 75.8513 },
      { name: "Hawa Mahal", type: "attraction", lat: 26.9239, lng: 75.8267 },
      { name: "City Palace", type: "attraction", lat: 26.9258, lng: 75.8237 },
      { name: "Jaipur Junction Station", type: "station", lat: 26.9196, lng: 75.7875 },
      { name: "SMS Hospital", type: "hospital", lat: 26.9070, lng: 75.8050 },
      { name: "Kotwali Police Station", type: "police", lat: 26.9250, lng: 75.8230 }
    ],
    kb: [
      { matchPatterns: ["emergency", "help", "sos", "accident"], answer: "Emergency: Dial 112 · Ambulance: 108 · Police: 100. Major hospitals: SMS Hospital (Sawai Man Singh), Fortis Escorts Hospital, Manipal Hospital." },
      { matchPatterns: ["hospital", "doctor", "medical"], answer: "Jaipur hospitals: SMS Hospital (JLN Marg), Fortis Escorts, Manipal Hospital (Mansarovar), Narayana Multi-specialty. Ambulance: 108." },
      { matchPatterns: ["police", "theft", "stolen", "crime"], answer: "Police: Dial 100 or 112. Tourist Police present at major monuments. Railway Police: 139. Women helpline: 1091." },
      { matchPatterns: ["fare", "auto", "cab", "taxi", "cost", "price"], answer: "Jaipur: Auto ₹25 base + ₹10/km. Cycle rickshaw old city: ₹30-80. Ola/Uber available. City bus: ₹5-15. Full-day auto hire: ₹800-1200. Always agree fare beforehand!" },
      { matchPatterns: ["place", "visit", "see", "attraction", "sight", "tourist"], answer: "Top 5 Jaipur: 1) Amber Fort — stunning hilltop fort with mirror palace. 2) Hawa Mahal — Palace of Winds, iconic pink facade. 3) City Palace — royal residence with museum. 4) Jantar Mantar — UNESCO astronomical instruments. 5) Nahargarh Fort — panoramic city views." },
      { matchPatterns: ["phrase", "say", "speak", "language", "hindi", "rajasthani", "word"], answer: "Key Hindi/Rajasthani phrases: 1) 'Khamma Ghani' (खम्मा घणी) = Hello (Rajasthani). 2) 'Kitna?' (कितना?) = How much? 3) 'Dhanyavaad' (धन्यवाद) = Thank you." },
      { matchPatterns: ["food", "eat", "restaurant", "dish", "hungry"], answer: "Jaipur food staples: Dal Baati Churma, Laal Maas, Pyaaz Kachori (Rawat Mishthan), Ghewar, Lassi (Lassiwala since 1944). Visit Johari Bazaar for street food." },
      { matchPatterns: ["safe", "safety", "secure", "night"], answer: "Jaipur safety: Tourist-friendly city. Bargain at bazaars (prices inflated for tourists). Avoid touts near monuments. Drink bottled water. Central areas well-lit. Emergency: 112." }
    ]
  },
  {
    city: "default",
    languages: ["English", "Hindi"],
    contentStatus: "generic-fallback",
    emergencyNumbers: [
      { label: "National Emergency", number: "112" },
      { label: "National Rail Enquiry", number: "139" },
      { label: "Ambulance", number: "108" },
      { label: "Police", number: "100" }
    ],
    transportGuidance: "General India pack - verified city pack for this city not yet available. Always confirm fares before boarding.",
    phrases: [
      { en: "Please take me to this address.", local: "Please take me to this address.", localLang: "English" },
      { en: "How much is the fare?", local: "Kitna? / How much?", localLang: "Hindi/English" },
      { en: "Where is the nearest hospital?", local: "Nearest hospital kahan hai?", localLang: "Hindi/English" }
    ],
    pois: [],
    kb: [
      { matchPatterns: ["emergency", "help", "sos", "accident", "danger"], answer: "India Emergency Numbers: 112 (all services) · Ambulance: 108 · Police: 100 · Fire: 101 · Railway: 139 · Women: 1091. Dial 112 from any phone, even without SIM." },
      { matchPatterns: ["hospital", "doctor", "medical", "sick", "injury"], answer: "Dial 108 for ambulance anywhere in India. Government hospitals in every district HQ provide free emergency care. Ask locals for nearest hospital. Carry basic first-aid." },
      { matchPatterns: ["police", "theft", "stolen", "crime"], answer: "Police: Dial 100 or 112 anywhere in India. Railway Police: 139. Women helpline: 1091 / 181. File FIR at nearest police station for theft/loss." },
      { matchPatterns: ["fare", "auto", "cab", "taxi", "cost", "price"], answer: "General India fares: Auto ₹25-35 base + ₹10-15/km. Budget bus: ₹5-30. Train sleeper: ₹200-600 (500 km). Always confirm fare before boarding. Use government pre-paid counters at stations." },
      { matchPatterns: ["phrase", "say", "speak", "language", "word"], answer: "Universal Hindi phrases: 1) 'Namaste' (नमस्ते) = Hello. 2) 'Kitna?' (कितना?) = How much? 3) 'Dhanyavaad' (धन्यवाद) = Thank you." },
      { matchPatterns: ["food", "eat", "restaurant", "dish", "hungry"], answer: "General India food tips: Prefer freshly cooked hot food. Drink bottled/filtered water only. Street food is best from busy stalls (high turnover = fresh). Carry ORS packets for stomach upsets." },
      { matchPatterns: ["safe", "safety", "secure", "night"], answer: "India safety basics: Emergency 112 works everywhere. Share live location with family. Use official pre-paid transport at airports/stations. Carry photocopies of ID. Bottled water only. Emergency: 112." },
      { matchPatterns: ["place", "visit", "see", "attraction", "sight", "tourist"], answer: "India has incredible diversity! Check our City Spotlight pages for verified POIs and attractions. Popular regions: Rajasthan (forts), Kerala (backwaters), Tamil Nadu (temples), Himachal (mountains), Goa (beaches)." }
    ]
  }
];
