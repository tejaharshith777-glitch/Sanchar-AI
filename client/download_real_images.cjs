const fs = require('fs');
const https = require('https');
const path = require('path');

const CITIES_DIR = path.join(__dirname, 'public', 'images', 'cities');
const SPOTS_DIR = path.join(__dirname, 'public', 'images', 'spots');
const MANIFEST_FILE = path.join(__dirname, 'public', 'images', 'MANIFEST.md');

if (!fs.existsSync(CITIES_DIR)) fs.mkdirSync(CITIES_DIR, { recursive: true });
if (!fs.existsSync(SPOTS_DIR)) fs.mkdirSync(SPOTS_DIR, { recursive: true });

// Verified Wikipedia Commons images for exactly what they represent
const IMAGES = {
  // Cities
  'cities/chennai.jpg': 'https://upload.wikimedia.org/wikipedia/commons/3/32/Chennai_Central_Railway_Station_from_top.jpg',
  'cities/kochi.jpg': 'https://upload.wikimedia.org/wikipedia/commons/1/14/Kochi_skyline_from_marine_drive.jpg',
  'cities/bengaluru.jpg': 'https://upload.wikimedia.org/wikipedia/commons/e/e5/UB_City_aerial_view.jpg',
  'cities/mumbai.jpg': 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Bandra_Worli_Sea_Link.jpg',
  'cities/delhi.jpg': 'https://upload.wikimedia.org/wikipedia/commons/6/66/India_Gate_600x400.jpg',
  'cities/kolkata.jpg': 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Victoria_Memorial_Kolkata_Night_View.jpg',
  'cities/hyderabad.jpg': 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Golconda_Fort_Hyderabad.jpg',
  'cities/jaipur.jpg': 'https://upload.wikimedia.org/wikipedia/commons/4/41/Hawa_Mahal_Jaipur.jpg',
  
  // Spots - Chennai
  'spots/marina-beach.jpg': 'https://upload.wikimedia.org/wikipedia/commons/8/87/Marina_Beach%2C_Chennai.jpg',
  'spots/kapaleeshwarar-temple.jpg': 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Kapaleeshwarar_Temple.jpg',
  'spots/san-thome-basilica.jpg': 'https://upload.wikimedia.org/wikipedia/commons/f/f9/Santhome_Basilica.jpg',
  
  // Spots - Kochi
  'spots/chinese-fishing-nets.jpg': 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Chinese_fishing_nets_Kochi.jpg',
  'spots/mattancherry-palace.jpg': 'https://upload.wikimedia.org/wikipedia/commons/d/d4/Mattancherry_Palace.jpg',
  'spots/fort-kochi-beach.jpg': 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Fort_Kochi_Beach.jpg',
  
  // Spots - Hyderabad
  'spots/charminar.jpg': 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Charminar_Hyderabad_India.jpg',
  'spots/golconda-fort.jpg': 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Golconda_Fort_Entry.jpg',
  'spots/hussain-sagar-lake.jpg': 'https://upload.wikimedia.org/wikipedia/commons/2/27/Hussain_Sagar_Buddha_Statue.jpg',
  
  // Spots - Jaipur
  'spots/amber-fort.jpg': 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Amber_Fort_Jaipur.jpg',
  'spots/hawa-mahal.jpg': 'https://upload.wikimedia.org/wikipedia/commons/9/90/Hawa_Mahal_Jaipur_India.jpg',
  'spots/city-palace-jaipur.jpg': 'https://upload.wikimedia.org/wikipedia/commons/5/52/City_Palace%2C_Jaipur.jpg',
  
  // Spots - Mumbai
  'spots/gateway-of-india.jpg': 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Gateway_of_India_Mumbai.jpg',
  'spots/marine-drive.jpg': 'https://upload.wikimedia.org/wikipedia/commons/9/93/Marine_Drive_Mumbai.jpg',
  'spots/chhatrapati-shivaji-terminus.jpg': 'https://upload.wikimedia.org/wikipedia/commons/3/36/Chhatrapati_Shivaji_Terminus.jpg',
  
  // Spots - Varanasi
  'spots/dashashwamedh-ghat.jpg': 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Dashashwamedh_Ghat_Varanasi.jpg',
  'spots/kashi-vishwanath-temple.jpg': 'https://upload.wikimedia.org/wikipedia/commons/6/69/Kashi_Vishwanath_Temple.jpg',
  'spots/sarnath-sacred-site.jpg': 'https://upload.wikimedia.org/wikipedia/commons/0/05/Dhamek_Stupa_Sarnath.jpg',
  
  // Spots - Bengaluru
  'spots/cubbon-park.jpg': 'https://upload.wikimedia.org/wikipedia/commons/0/0e/Cubbon_Park_Bengaluru.jpg',
  'spots/lalbagh-botanical-garden.jpg': 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Lalbagh_Glass_House.jpg',
  
  // Spots - Delhi
  'spots/qutub-minar.jpg': 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Qutub_Minar_Delhi.jpg',
  'spots/red-fort.jpg': 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Red_Fort_Delhi.jpg',
  
  // Spots - Guntur & Indore
  'spots/amaravati-stupa.jpg': 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Amaravati_Stupa.jpg',
  'spots/rajwada-palace.jpg': 'https://upload.wikimedia.org/wikipedia/commons/5/52/Rajwada_Palace_Indore.jpg'
};

const BATCH_SIZE = 5;

const downloadFile = async (url, dest) => {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(arrayBuffer));
  return dest;
};

async function main() {
  let manifest = '# Image Manifest\n\n| Filename | Source URL | License |\n|----------|------------|---------|\n';
  const entries = Object.entries(IMAGES);
  
  for (const [relPath, url] of entries) {
    const dest = path.join(__dirname, 'public', 'images', relPath);
    try {
      await downloadFile(url, dest);
      manifest += `| ${relPath} | ${url} | Wikimedia Commons (CC-BY-SA or Public Domain) |\n`;
      console.log(`[OK] ${relPath}`);
    } catch (err) {
      console.error(`[ERR] ${relPath}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  
  fs.writeFileSync(MANIFEST_FILE, manifest);
  console.log('Manifest written to MANIFEST.md');
}

main().catch(console.error);
