import generatedSpots from './generatedSpots.json';

// Tier 1 - Curated Rich Spots Data for 8 Showcase Cities
export const curatedSpotsData: Record<string, any[]> = generatedSpots;

// Seed Cloakrooms/Luggage Spots for 8 Curated Cities
export const seedLuggageSpots = [
  {
    _id: "luggage-chennai-central",
    city: "Chennai",
    name: "Chennai Central Cloakroom",
    type: "railway_cloakroom",
    lat: 13.0829,
    lng: 80.2705,
    hours: "24 Hours (Closed 23:00 - 00:00)",
    pricingPerBagHour: "₹15 for first 24 hours, ₹20/day after",
    requiredDocs: "Original Train Ticket & ID Proof",
    rules: "Bags must be locked securely. Luggage scanners must verify all items.",
    verified: true
  },
  {
    _id: "luggage-chennai-egmore",
    city: "Chennai",
    name: "Egmore Station Cloakroom",
    type: "railway_cloakroom",
    lat: 13.0734,
    lng: 80.2605,
    hours: "24 Hours",
    pricingPerBagHour: "₹15 for first 24 hours",
    requiredDocs: "Train Ticket & Valid ID",
    rules: "Only securely locked bags accepted.",
    verified: true
  },
  {
    _id: "luggage-kochi-ernakulam",
    city: "Kochi",
    name: "Ernakulam Junction Cloakroom",
    type: "railway_cloakroom",
    lat: 9.9669,
    lng: 76.2915,
    hours: "24 Hours",
    pricingPerBagHour: "₹15/bag/day",
    requiredDocs: "Train Ticket & Govt ID Card",
    rules: "Bags must be locked.",
    verified: true
  },
  {
    _id: "luggage-bengaluru-ksr",
    city: "Bengaluru",
    name: "KSR Bengaluru Cloakroom",
    type: "railway_cloakroom",
    lat: 12.9782,
    lng: 77.5694,
    hours: "24 Hours (Closed 00:00 - 01:00)",
    pricingPerBagHour: "₹15/day for first 24 hours",
    requiredDocs: "Confirmed Train ticket & Photo ID",
    rules: "Locked suitcases or duffel bags only.",
    verified: true
  },
  {
    _id: "luggage-mumbai-csmt",
    city: "Mumbai",
    name: "CSMT Cloakroom",
    type: "railway_cloakroom",
    lat: 18.9399,
    lng: 72.8353,
    hours: "24 Hours",
    pricingPerBagHour: "₹15 for first 24 hours",
    requiredDocs: "Confirmed Train Ticket & ID Card",
    rules: "Bags must have a lock. No loose plastic bags.",
    verified: true
  },
  {
    _id: "luggage-delhi-newdelhi",
    city: "Delhi",
    name: "New Delhi Railway Cloakroom",
    type: "railway_cloakroom",
    lat: 28.6430,
    lng: 77.2190,
    hours: "24 Hours",
    pricingPerBagHour: "₹15/day for first 24 hours",
    requiredDocs: "Valid ID Proof & Journey Ticket",
    rules: "Metal chains or locking locks required.",
    verified: true
  },
  {
    _id: "luggage-kolkata-howrah",
    city: "Kolkata",
    name: "Howrah Station Cloakroom",
    type: "railway_cloakroom",
    lat: 22.5842,
    lng: 88.3415,
    hours: "24 Hours",
    pricingPerBagHour: "₹15/day",
    requiredDocs: "Train Ticket & Valid ID Card",
    rules: "All baggage must be properly locked.",
    verified: true
  },
  {
    _id: "luggage-hyderabad-secunderabad",
    city: "Hyderabad",
    name: "Secunderabad Cloakroom",
    type: "railway_cloakroom",
    lat: 17.4338,
    lng: 78.5016,
    hours: "24 Hours",
    pricingPerBagHour: "₹15/day",
    requiredDocs: "Confirmed Train Ticket & ID Card",
    rules: "Bags must have locks.",
    verified: true
  },
  {
    _id: "luggage-jaipur-junction",
    city: "Jaipur",
    name: "Jaipur Junction Cloakroom",
    type: "railway_cloakroom",
    lat: 26.9197,
    lng: 75.7879,
    hours: "24 Hours",
    pricingPerBagHour: "₹15/day",
    requiredDocs: "Confirmed Ticket & ID",
    rules: "Lockable bags only.",
    verified: true
  },
  {
    _id: "luggage-pune-junction",
    city: "Pune",
    name: "Pune Junction Cloakroom",
    type: "railway_cloakroom",
    lat: 18.5284,
    lng: 73.8739,
    hours: "24 Hours",
    pricingPerBagHour: "₹15/day",
    requiredDocs: "Confirmed Ticket & ID",
    rules: "Bags must be locked securely.",
    verified: true
  }
];
