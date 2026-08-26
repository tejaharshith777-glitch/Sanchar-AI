const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WIKI_ARTICLES = {
  // Cities
  'cities/delhi.jpg': 'Delhi',
  'cities/mumbai.jpg': 'Mumbai',
  'cities/bengaluru.jpg': 'Bangalore',
  'cities/kolkata.jpg': 'Kolkata',
  'cities/chennai.jpg': 'Chennai',
  'cities/hyderabad.jpg': 'Hyderabad',
  'cities/jaipur.jpg': 'Jaipur',
  'cities/kochi.jpg': 'Kochi',

  // Spots
  'spots/marina-beach.jpg': 'Marina_Beach',
  'spots/kapaleeshwarar-temple.jpg': 'Kapaleeshwarar_Temple',
  'spots/san-thome-basilica.jpg': 'San_Thome_Basilica',
  'spots/fort-kochi-beach.jpg': 'Fort_Kochi',
  'spots/chinese-fishing-nets.jpg': 'Chinese_fishing_nets',
  'spots/mattancherry-palace.jpg': 'Mattancherry_Palace',
  'spots/charminar.jpg': 'Charminar',
  'spots/golconda-fort.jpg': 'Golconda_Fort',
  'spots/hussain-sagar-lake.jpg': 'Hussain_Sagar',
  'spots/amber-fort.jpg': 'Amer_Fort',
  'spots/hawa-mahal.jpg': 'Hawa_Mahal',
  'spots/city-palace-jaipur.jpg': 'City_Palace,_Jaipur',
  'spots/gateway-of-india.jpg': 'Gateway_of_India',
  'spots/marine-drive.jpg': 'Marine_Drive,_Mumbai',
  'spots/chhatrapati-shivaji-terminus.jpg': 'Chhatrapati_Shivaji_Terminus',
  'spots/dashashwamedh-ghat.jpg': 'Dashashwamedh_Ghat',
  'spots/kashi-vishwanath-temple.jpg': 'Kashi_Vishwanath_Temple',
  'spots/sarnath-sacred-site.jpg': 'Sarnath',
  'spots/cubbon-park.jpg': 'Cubbon_Park',
  'spots/lalbagh-botanical-garden.jpg': 'Lal_Bagh',
  'spots/red-fort.jpg': 'Red_Fort',
  'spots/qutub-minar.jpg': 'Qutb_Minar',
  'spots/rajwada-palace.jpg': 'Rajwada',
  'spots/amaravati-stupa.jpg': 'Amaravati_Stupa'
};

const MANIFEST_FILE = path.join(__dirname, 'public', 'images', 'MANIFEST.md');
const USER_AGENT = "SancharAI-SIH-Hackathon/1.0 (contact: tejaharshith3281@gmail.com)";

const verifyImage = (filePath) => {
  if (!fs.existsSync(filePath)) return false;
  const stats = fs.statSync(filePath);
  if (stats.size < 20480) return false; // Must be >20KB
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(4);
  fs.readSync(fd, buffer, 0, 4, 0);
  fs.closeSync(fd);
  
  // Check JPEG magic bytes: FF D8 FF
  const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  // Check PNG magic bytes: 89 50 4E 47
  const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  
  return isJPEG || isPNG;
};

const delay = ms => new Promise(res => setTimeout(res, ms));

async function fetchWikiSummary(article) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article)}`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) return null;
  return await response.json();
}

async function main() {
  const dirs = [
    path.join(__dirname, 'public', 'images', 'cities'),
    path.join(__dirname, 'public', 'images', 'spots')
  ];
  dirs.forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

  let manifest = '# Image Manifest\n\n| Filename | Wikipedia Article | Image URL | License | Status |\n|----------|-------------------|-----------|---------|--------|\n';
  const entries = Object.entries(WIKI_ARTICLES);
  
  console.log("Starting Wiki REST API downloads with 1.5s delay and verification...");
  
  for (const [relPath, article] of entries) {
    const dest = path.join(__dirname, 'public', 'images', relPath);
    let success = false;
    
    try {
      const summary = await fetchWikiSummary(article);
      await delay(1500); // 1.5s wait between API calls
      
      if (summary && summary.thumbnail && summary.thumbnail.source) {
        // Change from thumbnail to original if possible by replacing thumb path
        let sourceUrl = summary.thumbnail.source;
        // Wikipedia thumbnail URLs look like: https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Red_Fort_Delhi.jpg/320px-Red_Fort_Delhi.jpg
        // Let's just use the thumbnail size as is, because Wikipedia REST API usually gives a 320px or higher res thumbnail which is >20KB
        // Or we can try to extract the original URL by removing the /thumb and the /px part.
        // The instructions said "The JSON thumbnail.source field is a direct upload.wikimedia.org image URL. Download each thumbnail.source with curl.exe"
        
        console.log(`Downloading ${article} from ${sourceUrl}...`);
        
        // Execute curl.exe synchronously to avoid spawning issues
        try {
          execSync(`curl.exe -s -L -A "${USER_AGENT}" -o "${dest}" "${sourceUrl}"`);
        } catch (curlErr) {
          console.error(`Curl failed for ${article}`);
        }
        
        if (verifyImage(dest)) {
          manifest += `| ${relPath} | ${article} | ${sourceUrl} | ${summary.license ? summary.license.url || 'Public Domain' : 'Unknown'} | PASS |\n`;
          console.log(`[PASS] ${relPath}`);
          success = true;
        } else {
          console.log(`[FAIL-VERIFY] ${relPath} - Bad Magic or <20KB`);
        }
      } else {
        console.log(`[FAIL-NO-THUMB] ${article}`);
      }
    } catch (err) {
      console.error(`[FAIL-ERR] ${relPath}: ${err.message}`);
    }
    
    if (!success) {
      manifest += `| ${relPath} | ${article} | None | None | city-landmark substitute - no standalone photo found |\n`;
      console.log(`[SUBSTITUTE] ${relPath} marked as substitute in MANIFEST`);
    }
    
    await delay(1500); // Another 1.5s delay before the next item just to be safe
  }
  
  fs.writeFileSync(MANIFEST_FILE, manifest);
  console.log('Manifest written to MANIFEST.md');
}

main().catch(console.error);
