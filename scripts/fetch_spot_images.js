const fs = require('fs');
const path = require('path');
const https = require('https');

const spotsPath = path.join(__dirname, '../server/src/data/generatedSpots.json');
const imgDir = path.join(__dirname, '../client/public/images/spots');

if (!fs.existsSync(imgDir)) {
  fs.mkdirSync(imgDir, { recursive: true });
}

const spotsData = JSON.parse(fs.readFileSync(spotsPath, 'utf8'));
let allSpots = [];
for (const city in spotsData) {
  allSpots.push(...spotsData[city]);
}

async function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Status ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      file.on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    }).on('error', reject);
  });
}

async function fetchWikiImage(title) {
  return new Promise((resolve) => {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=800`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const pages = parsed.query.pages;
          const pageId = Object.keys(pages)[0];
          if (pages[pageId].thumbnail) {
            resolve(pages[pageId].thumbnail.source);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}



async function run() {
  let count = 0;
  for (const spot of allSpots) {
    const slug = spot.slug;
    const dest = path.join(imgDir, `${slug}.jpg`);
    if (fs.existsSync(dest)) continue;
    
    console.log(`Fetching image for ${spot.name}...`);
    let imgUrl = await fetchWikiImage(spot.name);
    
    if (!imgUrl) {
      imgUrl = `https://picsum.photos/seed/${slug}/800/600`;
    }
    
    try {
      await downloadImage(imgUrl, dest);
      console.log(`Saved ${slug}.jpg`);
    } catch (e) {
      console.error(`Failed to download for ${spot.name}`);
    }
    count++;
    
    // Add small delay
    await new Promise(r => setTimeout(r, 200));
  }
  console.log('Finished downloading all images.');
}

run();
