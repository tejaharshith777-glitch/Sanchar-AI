export const curatedCities = [
  {
    city: "Chennai",
    languages: ["Tamil", "English"],
    contentStatus: "curated-sample",
    emergencyNumbers: [{ label: "National Emergency", number: "112" }],
    transportGuidance: "Typical auto fare 3-6 km: ₹120-₹250 - confirm with driver. Metro available for longer routes.",
    phrases: [
      { en: "Please take me to this address.", local: "தயவுசெய்து என்னை இந்த முகவரிக்கு அழைத்துச் செல்லுங்கள்.", localLang: "Tamil" },
      { en: "How much is the fare?", local: "கட்டணம் எவ்வளவு?", localLang: "Tamil" }
    ],
    pois: [
      { name: "Marina Beach", type: "attraction", lat: 13.0500, lng: 80.2824 },
      { name: "Chennai Central Station", type: "station", lat: 13.0827, lng: 80.2707 },
      { name: "Luggage Storage Central", type: "luggageStorage", lat: 13.0830, lng: 80.2710 }
    ]
  },
  {
    city: "Kochi",
    languages: ["Malayalam", "English"],
    contentStatus: "curated-sample",
    emergencyNumbers: [{ label: "National Emergency", number: "112" }],
    transportGuidance: "Ferries are a fast way to cross between Fort Kochi and Ernakulam.",
    phrases: [
      { en: "Please take me to this address.", local: "ദയവായി എന്നെ ഈ വിലാസത്തിൽ എത്തിക്കൂ.", localLang: "Malayalam" }
    ],
    pois: [
      { name: "Fort Kochi", type: "attraction", lat: 9.9658, lng: 76.2421 },
      { name: "Ernakulam Junction", type: "station", lat: 9.9667, lng: 76.2917 }
    ]
  },
  {
    city: "Bengaluru",
    languages: ["Kannada", "English"],
    contentStatus: "curated-sample",
    emergencyNumbers: [{ label: "National Emergency", number: "112" }],
    transportGuidance: "Traffic can be heavy. Use Namma Metro when possible.",
    phrases: [
      { en: "Please take me to this address.", local: "ದಯವಿಟ್ಟು ನನ್ನನ್ನು ಈ ವಿಳಾಸಕ್ಕೆ ಕರೆದೊಯ್ಯಿರಿ.", localLang: "Kannada" }
    ],
    pois: [
      { name: "Cubbon Park", type: "park", lat: 12.9779, lng: 77.5952 },
      { name: "KSR Bengaluru Station", type: "station", lat: 12.9781, lng: 77.5695 },
      { name: "Cloak Room KSR", type: "luggageStorage", lat: 12.9783, lng: 77.5693 }
    ]
  },
  {
    city: "Mumbai",
    languages: ["Marathi", "Hindi", "English"],
    contentStatus: "curated-sample",
    emergencyNumbers: [{ label: "National Emergency", number: "112" }],
    transportGuidance: "Local trains are the lifeline but very crowded during peak hours. Autos run on meter in suburbs.",
    phrases: [
      { en: "Please take me to this address.", local: "कृपया मला या पत्त्यावर घेऊन जा.", localLang: "Marathi" }
    ],
    pois: [
      { name: "Gateway of India", type: "attraction", lat: 18.9220, lng: 72.8347 },
      { name: "CSMT Station", type: "station", lat: 18.9398, lng: 72.8354 }
    ]
  },
  {
    city: "Delhi",
    languages: ["Hindi", "English"],
    contentStatus: "curated-sample",
    emergencyNumbers: [{ label: "National Emergency", number: "112" }],
    transportGuidance: "Delhi Metro connects almost the entire city. Auto rickshaws should use meters.",
    phrases: [
      { en: "Please take me to this address.", local: "कृपया मुझे इस पते पर ले चलें।", localLang: "Hindi" }
    ],
    pois: [
      { name: "Red Fort", type: "attraction", lat: 28.6562, lng: 77.2410 },
      { name: "New Delhi Railway Station", type: "station", lat: 28.6429, lng: 77.2191 }
    ]
  },
  {
    city: "Kolkata",
    languages: ["Bengali", "English"],
    contentStatus: "curated-sample",
    emergencyNumbers: [{ label: "National Emergency", number: "112" }],
    transportGuidance: "Yellow taxis and metro are iconic. Ferries operate on the Hooghly.",
    phrases: [
      { en: "Please take me to this address.", local: "দয়া করে আমাকে এই ঠিকানায় নিয়ে চলুন।", localLang: "Bengali" }
    ],
    pois: [
      { name: "Victoria Memorial", type: "attraction", lat: 22.5448, lng: 88.3426 },
      { name: "Howrah Station", type: "station", lat: 22.5841, lng: 88.3413 }
    ]
  },
  {
    city: "default",
    languages: ["English", "Hindi"],
    contentStatus: "generic-fallback",
    emergencyNumbers: [
      { label: "National Emergency", number: "112" },
      { label: "National Rail Enquiry", number: "139" }
    ],
    transportGuidance: "General India pack - verified city pack for this city not yet available. Always confirm fares before boarding.",
    phrases: [
      { en: "Please take me to this address.", local: "Please take me to this address.", localLang: "English" }
    ],
    pois: []
  }
];
