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
  'hero.jpg': 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=80', // Taj Mahal
  
  // 8 Cities
  'chennai.jpg': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=600&q=80',
  'kochi.jpg': 'https://images.unsplash.com/photo-1602643163983-ed0babc39797?auto=format&fit=crop&w=600&q=80',
  'bengaluru.jpg': 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=600&q=80',
  'mumbai.jpg': 'https://images.unsplash.com/photo-1562979314-bee7453e911c?auto=format&fit=crop&w=600&q=80',
  'delhi.jpg': 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=600&q=80',
  'kolkata.jpg': 'https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?auto=format&fit=crop&w=600&q=80', // Victoria Memorial
  'hyderabad.jpg': 'https://images.unsplash.com/photo-1572445271230-a78b5944a659?auto=format&fit=crop&w=600&q=80', // Charminar
  'jaipur.jpg': 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=600&q=80', // Hawa Mahal
  
  // 8 Attractions (special spots)
  'marina_beach.jpg': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=600&q=80',
  'charminar.jpg': 'https://images.unsplash.com/photo-1572445271230-a78b5944a659?auto=format&fit=crop&w=600&q=80',
  'hawa_mahal.jpg': 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=600&q=80',
  'gateway_of_india.jpg': 'https://images.unsplash.com/photo-1562979314-bee7453e911c?auto=format&fit=crop&w=600&q=80',
  'howrah_bridge.jpg': 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&w=600&q=80', // River/Bridge
  'kashi_vishwanath.jpg': 'https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80',
  'kochi_nets.jpg': 'https://images.unsplash.com/photo-1590001155093-a3c66ab0c3ff?auto=format&fit=crop&w=600&q=80',
  'guwahati_river.jpg': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=600&q=80', // Verified working Unsplash URL
  
  // 3 Stats
  'stat_train.jpg': 'https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?auto=format&fit=crop&w=600&q=80',
  'stat_temple.jpg': 'https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80',
  'stat_food.jpg': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80', // Samosa/Indian Food

  // 2 Backgrounds
  'bg_section1.jpg': 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=800&q=80',
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
          try { fs.unlinkSync(destPath); } catch {}
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
