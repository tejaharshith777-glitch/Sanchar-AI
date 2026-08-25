const fs = require('fs');
const path = require('path');

const CITIES = {
  Chennai: [
    "Marina Beach", "Kapaleeshwarar Temple", "Fort St. George", "San Thome Basilica", "Government Museum, Chennai", "Valluvar Kottam", "Guindy National Park", "Edward Elliot's Beach", "DakshinaChitra", "Arignar Anna Zoological Park", "Mylapore", "Vivekananda House", "Semmozhi Poonga", "Cholamandal Artists' Village", "Ashtalakshmi Temple, Chennai", "Ripon Building", "Madras High Court", "Vadapalani Andavar Temple", "Parthasarathy Temple, Triplicane", "Thousand Lights Mosque", "Breezy Beach", "Marundeeswarar Temple", "Connemara Public Library", "Victory War Memorial", "MGM Dizzee World"
  ],
  Kochi: [
    "Fort Kochi", "Chinese fishing nets", "Mattancherry Palace", "Paradesi Synagogue", "Marine Drive, Kochi", "Willingdon Island", "Bolgatty Palace", "Hill Palace, Tripunithura", "Vypeen", "Cherai Beach", "Santa Cruz Basilica", "St. Francis Church, Kochi", "Mangalavanam Bird Sanctuary", "Kerala Folklore Museum", "Ernakulam Shiva Temple", "Chottanikkara Temple", "Veeranpuzha", "Andhakaranazhi Beach", "Indo-Portuguese Museum", "Kodanad Elephant Training Centre", "Museum of Kerala History", "Kochi-Muziris Biennale", "Vasco da Gama Square", "Thrikkakara Temple", "Marine Walkway"
  ],
  Bengaluru: [
    "Lalbagh Botanical Garden", "Cubbon Park", "Bangalore Palace", "Vidhana Soudha", "Tipu Sultan's Summer Palace", "Bannerghatta National Park", "Nandi Hills, India", "ISKCON Temple Bangalore", "Ulsoor Lake", "Dodda Basavana Gudi", "St. Mary's Basilica, Bangalore", "Visvesvaraya Industrial and Technological Museum", "National Gallery of Modern Art, Bangalore", "HAL Aerospace Museum", "Bangalore Fort", "Sankey tank", "Lumbini Gardens", "Hebbal Lake", "Gavi Gangadhareshwara Temple", "Shiva Temple, Old Airport Road", "Commercial Street, Bangalore", "Brigade Road", "Bugle Rock", "Jawaharlal Nehru Planetarium", "Someshwara Temple, Halasuru"
  ],
  Mumbai: [
    "Gateway of India", "Marine Drive, Mumbai", "Elephanta Caves", "Chhatrapati Shivaji Terminus", "Haji Ali Dargah", "Sanjay Gandhi National Park", "Juhu Beach", "Siddhivinayak Temple, Mumbai", "Bandra–Worli Sea Link", "Chhatrapati Shivaji Maharaj Vastu Sangrahalaya", "Kanheri Caves", "Global Vipassana Pagoda", "Hanging Gardens of Mumbai", "Taraporewala Aquarium", "Mahalaxmi Temple, Mumbai", "Mount Mary Church, Bandra", "Dr. Bhau Daji Lad Museum", "Chor Bazaar", "Colaba Causeway", "Girgaon Chowpatty", "EsselWorld", "Nehru Planetarium", "Kamala Nehru Park, Mumbai", "Mumba Devi Temple", "Mani Bhavan"
  ],
  Delhi: [
    "Red Fort", "India Gate", "Qutb Minar", "Humayun's Tomb", "Lotus Temple", "Akshardham (Delhi)", "Jama Masjid, Delhi", "Jantar Mantar, New Delhi", "Rashtrapati Bhavan", "Lodhi Gardens", "Chandni Chowk", "Raj Ghat and associated memorials", "Gurudwara Bangla Sahib", "Purana Qila", "National Museum, New Delhi", "Safdarjung's Tomb", "Agrasen ki Baoli", "Mehrauli Archaeological Park", "National Zoological Park Delhi", "Tughlaqabad Fort", "Hauz Khas Complex", "Mughal Gardens, Delhi", "Dilli Haat", "National Rail Museum, New Delhi", "ISKCON Temple Delhi"
  ],
  Kolkata: [
    "Victoria Memorial, Kolkata", "Howrah Bridge", "Dakshineswar Kali Temple", "Indian Museum", "Kalighat Kali Temple", "Belur Math", "Science City, Kolkata", "Eco Park, New Town", "Birla Planetarium, Kolkata", "Marble Palace (Kolkata)", "Jorasanko Thakur Bari", "Alipore Zoological Gardens", "St. Paul's Cathedral, Kolkata", "Nicco Park", "Princep Ghat", "Mother House (Missionaries of Charity)", "Nakhoda Mosque", "Shaheed Minar, Kolkata", "Eden Gardens", "Vidyasagar Setu", "Aquatica", "Rabindra Sarobar", "New Market, Kolkata", "Botanical Garden, Howrah", "Town Hall, Kolkata"
  ],
  Hyderabad: [
    "Charminar", "Golconda", "Hussain Sagar", "Salar Jung Museum", "Ramoji Film City", "Chowmahalla Palace", "Birla Mandir, Hyderabad", "Qutb Shahi tombs", "Lumbini Park", "Nehru Zoological Park", "NTR Gardens", "Mecca Masjid, Hyderabad", "Falaknuma Palace", "Snow World", "Chilkur Balaji Temple", "Purani Haveli", "KBR National Park", "Sudha Cars Museum", "Shilparamam", "Durgam Cheruvu", "Paigah Tombs", "Tank Bund Road, Hyderabad", "Laad Bazaar", "Osmania University", "Sanghi Temple"
  ],
  Jaipur: [
    "Amer Fort", "Hawa Mahal", "City Palace, Jaipur", "Jantar Mantar, Jaipur", "Jal Mahal", "Nahargarh Fort", "Jaigarh Fort", "Albert Hall Museum", "Birla Mandir, Jaipur", "Galtaji", "Govind Dev Ji Temple", "Sisodia Rani Bagh", "Chokhi Dhani", "Bapu Bazaar", "Johari Bazaar", "Raj Mandir Cinema", "Anokhi Museum of Hand Printing", "Elefantastic", "Central Park, Jaipur", "Smriti Van", "Kanak Vrindavan", "Chand Baori", "Panna Meena ka Kund", "Garbhaji Falls", "Sanganer"
  ]
};

async function fetchWikiData(title) {
  try {
    const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts|coordinates&exintro=1&explaintext=1&format=json&titles=${encodeURIComponent(title)}&redirects=1`);
    const data = await res.json();
    if (!data.query || !data.query.pages) return null;
    const pageId = Object.keys(data.query.pages)[0];
    const page = data.query.pages[pageId];
    if (pageId === '-1') return null;
    
    return {
      title: page.title,
      extract: page.extract || '',
      coords: page.coordinates ? page.coordinates[0] : null
    };
  } catch (err) {
    return null;
  }
}

async function generate() {
  const result = {};
  for (const [city, spots] of Object.entries(CITIES)) {
    console.log(`Processing ${city}...`);
    result[city] = [];
    for (const spotName of spots) {
      const data = await fetchWikiData(spotName);
      if (data) {
        let blurb = data.extract.split('. ')[0] + '.';
        if (blurb.length > 200) blurb = blurb.substring(0, 197) + '...';
        
        result[city].push({
          name: data.title,
          slug: data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          category: spotName.toLowerCase().includes('temple') ? 'temple' : 
                    spotName.toLowerCase().includes('fort') ? 'fort' : 
                    spotName.toLowerCase().includes('beach') ? 'beach' : 
                    spotName.toLowerCase().includes('museum') ? 'museum' : 'heritage',
          blurb: blurb,
          bestThing: `Exploring the historic beauty of ${data.title}.`,
          bestTime: '9:00 AM - 5:00 PM',
          timeToSpend: '2 Hours',
          entryCost: '₹50 (verify locally)',
          nearTransport: 'Central Station',
          tips: ['Carry water.', 'Wear comfortable shoes.', 'Photography may be restricted.'],
          lat: data.coords ? data.coords.lat : 0,
          lng: data.coords ? data.coords.lon : 0,
          image: `/images/spots/${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}.jpg`
        });
      }
    }
  }
  
  fs.writeFileSync(path.join(__dirname, '../server/src/data/generatedSpots.json'), JSON.stringify(result, null, 2));
  console.log('Done generating spots.');
}

generate();
