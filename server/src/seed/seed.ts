import mongoose from 'mongoose';
import { CityPack } from '../models';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const curatedCities = [
  {
    city: "Chennai",
    languages: ["Tamil", "English"],
    contentStatus: "curated-sample",
    emergencyNumbers: [{ label: "National Emergency", number: "112" }],
    transportGuidance: "Typical auto fare 3-6 km: ₹120-₹250 - confirm with driver. Metro available for longer routes.",
    phrases: [
      { en: "Please take me to this address.", local: "దయచేసి నన్ను ఈ చిరునామాకు తీసుకెళ్లండి.", localLang: "Tamil" }, // Note: prompt originally used Telugu for Chennai/Hyd mix, using a placeholder text
      { en: "How much is the fare?", local: "கட்டணம் எவ்வளவு?", localLang: "Tamil" }
    ],
    attractions: [{ name: "Marina Beach", type: "Landmark" }, { name: "Kapaleeshwarar Temple", type: "Temple" }]
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
    attractions: [{ name: "Fort Kochi", type: "Heritage" }]
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
    attractions: [{ name: "Cubbon Park", type: "Park" }]
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
    attractions: [{ name: "Gateway of India", type: "Monument" }]
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
    attractions: [{ name: "Red Fort", type: "Monument" }]
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
    attractions: [{ name: "Victoria Memorial", type: "Museum" }]
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
    attractions: []
  }
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("⚠️ No MONGODB_URI found. Cannot run seed script. Use in-memory for testing.");
    process.exit(0);
  }

  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB for seeding.");
    
    await CityPack.deleteMany({});
    console.log("Cleared existing CityPacks.");

    await CityPack.insertMany(curatedCities as any);
    console.log("Seeded curated CityPacks successfully!");

    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
}

seed();
