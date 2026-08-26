const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WIKI_ARTICLES = {
  'cities/varanasi.jpg': 'Varanasi',
  'cities/guntur.jpg': 'Guntur',
  'cities/indore.jpg': 'Indore',
  'cities/nashik.jpg': 'Nashik',
  'cities/madurai.jpg': 'Madurai',
  'cities/nagpur.jpg': 'Nagpur',
  'cities/bhubaneswar.jpg': 'Bhubaneswar',
  'cities/guwahati.jpg': 'Guwahati'
};

const MANIFEST_FILE = path.join(__dirname, 'public', 'images', 'MANIFEST.md');
const USER_AGENT = "SancharAI-SIH-Hackathon/1.0 (contact: tejaharshith3281@gmail.com)";

const verifyImage = (filePath) => {
  if (!fs.existsSync(filePath)) return false;
  const stats = fs.statSync(filePath);
  if (stats.size < 15360) return false; // Must be >15KB
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(4);
  fs.readSync(fd, buffer, 0, 4, 0);
  fs.closeSync(fd);
  
  const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
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
  const destDir = path.join(__dirname, 'public', 'images', 'cities');
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  let manifestAdditions = '';
  const entries = Object.entries(WIKI_ARTICLES);
  
  console.log("Downloading remaining 8 cities...");
  
  for (const [relPath, article] of entries) {
    let dest = path.join(__dirname, 'public', 'images', relPath);
    let success = false;
    let fallbackUsed = false;
    let targetArticle = article;
    
    try {
      let summary = await fetchWikiSummary(targetArticle);
      await delay(1500);
      
      if (!summary || !summary.thumbnail || !summary.thumbnail.source) {
        if (targetArticle === 'Varanasi') {
          console.log('Varanasi has no thumb, falling back to Kashi_Vishwanath_Temple');
          targetArticle = 'Kashi_Vishwanath_Temple';
          summary = await fetchWikiSummary(targetArticle);
          await delay(1500);
          fallbackUsed = true;
        }
      }
      
      if (summary && summary.thumbnail && summary.thumbnail.source) {
        let sourceUrl = summary.thumbnail.source;
        console.log(`Downloading ${targetArticle} from ${sourceUrl}...`);
        
        try {
          execSync(`curl.exe -s -L -A "${USER_AGENT}" -o "${dest}" "${sourceUrl}"`);
        } catch (curlErr) {
          console.error(`Curl failed for ${targetArticle}`);
        }
        
        if (verifyImage(dest)) {
          manifestAdditions += `| ${relPath} | ${targetArticle} | ${sourceUrl} | ${summary.license ? summary.license.url || 'Public Domain' : 'Unknown'} | PASS |\n`;
          console.log(`[PASS] ${relPath}`);
          success = true;
        } else {
          console.log(`[FAIL-VERIFY] ${relPath} - Bad Magic or <15KB`);
        }
      } else {
        console.log(`[FAIL-NO-THUMB] ${targetArticle}`);
      }
    } catch (err) {
      console.error(`[FAIL-ERR] ${relPath}: ${err.message}`);
    }
    
    if (!success) {
      manifestAdditions += `| ${relPath} | ${targetArticle} | None | None | city-landmark substitute - no standalone photo found |\n`;
      console.log(`[SUBSTITUTE] ${relPath} marked as substitute in MANIFEST`);
    }
    
    await delay(1500);
  }
  
  if (fs.existsSync(MANIFEST_FILE)) {
    fs.appendFileSync(MANIFEST_FILE, manifestAdditions);
  } else {
    fs.writeFileSync(MANIFEST_FILE, '# Image Manifest\n\n| Filename | Wikipedia Article | Image URL | License | Status |\n|----------|-------------------|-----------|---------|--------|\n' + manifestAdditions);
  }
  console.log('Manifest updated');
}

main().catch(console.error);
