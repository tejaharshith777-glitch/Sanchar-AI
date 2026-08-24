const fs = require('fs');
const path = require('path');
const https = require('https');

const IMAGES_DIR = path.join(__dirname, 'public', 'images', 'india');

// Ensure directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// 22 free, high-quality public domain/Unsplash image URLs of India
const IMAGES = {
  'hero.jpg': 'https://images.unsplash.com/photo-1561361513-2d000a50f0db?auto=format&fit=crop&w=1600&q=80', // Varanasi
  
  // 8 Cities
  'chennai.jpg': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=600&q=80',
  'kochi.jpg': 'https://images.unsplash.com/photo-1602643163983-ed0babc39797?auto=format&fit=crop&w=600&q=80',
  'bengaluru.jpg': 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=600&q=80',
  'mumbai.jpg': 'https://images.unsplash.com/photo-1562979314-bee7453e911c?auto=format&fit=crop&w=600&q=80',
  'delhi.jpg': 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=600&q=80',
  'kolkata.jpg': 'https://images.unsplash.com/photo-1558431382-27e393116d25?auto=format&fit=crop&w=600&q=80',
  'hyderabad.jpg': 'https://images.unsplash.com/photo-1608976328321-df6ff04bd7c1?auto=format&fit=crop&w=600&q=80',
  'jaipur.jpg': 'https://images.unsplash.com/photo-1477584322813-ac0c2ca5cdbb?auto=format&fit=crop&w=600&q=80',
  
  // 8 Attractions (special spots)
  'marina_beach.jpg': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=600&q=80',
  'charminar.jpg': 'https://images.unsplash.com/photo-1572445271230-a78b5944a659?auto=format&fit=crop&w=600&q=80',
  'hawa_mahal.jpg': 'https://images.unsplash.com/photo-1603262110263-fb0112e7cc33?auto=format&fit=crop&w=600&q=80',
  'gateway_of_india.jpg': 'https://images.unsplash.com/photo-1562979314-bee7453e911c?auto=format&fit=crop&w=600&q=80',
  'howrah_bridge.jpg': 'https://images.unsplash.com/photo-1558431382-27e393116d25?auto=format&fit=crop&w=600&q=80',
  'kashi_vishwanath.jpg': 'https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80',
  'kochi_nets.jpg': 'https://images.unsplash.com/photo-1590001155093-a3c66ab0c3ff?auto=format&fit=crop&w=600&q=80',
  'guwahati_river.jpg': 'https://images.unsplash.com/photo-1618213837799-25d5552822a3?auto=format&fit=crop&w=600&q=80',
  
  // 3 Stats
  'stat_train.jpg': 'https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?auto=format&fit=crop&w=600&q=80',
  'stat_temple.jpg': 'https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80',
  'stat_food.jpg': 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=600&q=80',

  // 2 Backgrounds
  'bg_section1.jpg': 'https://images.unsplash.com/photo-1561361513-2d000a50f0db?auto=format&fit=crop&w=800&q=80',
  'bg_section2.jpg': 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=800&q=80'
};

function downloadImage(filename, url) {
  return new Promise((resolve, reject) => {
    const destPath = path.join(IMAGES_DIR, filename);

    // If file exists and is >10KB, skip
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 10 * 1024) {
      console.log(`[SKIPPED] ${filename} (already exists and verified)`);
      return resolve();
    }

    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${filename}: HTTP ${res.statusCode}`));
      }

      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        const sizeKB = Math.round(fs.statSync(destPath).size / 1024);
        if (sizeKB < 10) {
          fs.unlinkSync(destPath); // delete too small file
          return reject(new Error(`Failed ${filename}: downloaded size too small (${sizeKB}KB)`));
        }
        console.log(`[DOWNLOADED] ${filename} - ${sizeKB}KB`);
        resolve();
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function run() {
  console.log('Starting image downloads...');
  for (const [filename, url] of Object.entries(IMAGES)) {
    let success = false;
    let attempts = 0;
    while (!success && attempts < 3) {
      attempts++;
      try {
        await downloadImage(filename, url);
        success = true;
      } catch (err) {
        console.warn(`Attempt ${attempts} failed for ${filename}: ${err.message}`);
        if (attempts >= 3) {
          console.error(`Failed to download ${filename} after 3 attempts. Using fallback placeholder.`);
          // Create dummy placeholder to prevent crash
          fs.writeFileSync(path.join(IMAGES_DIR, filename), '');
        } else {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  }
  console.log('All image downloads complete!');
}

run();
