const fs = require('fs');
const isInvalidSpot = (name) => {
  const n = name.toLowerCase();
  if (/\((actor|singer|chess player|politician|writer|director|producer|musician|cricketer|athlete|scientist)\)/i.test(n) || n.includes('born in')) return true;
  if (n.includes('municipal corporation') || n.includes('city corporation') || n.includes('region') || n.includes('district') || n.includes('urban agglomeration') || n.includes('mandal') || n.includes('panchayat')) return true;
  if (/\b(fm|radio|am station|television|tv channel|newspaper|magazine|bus depot|airport terminal|airport|railway station)\b/i.test(n)) return true;
  const validKeywords = ['park', 'temple', 'fort', 'beach', 'lake', 'museum', 'monument', 'market', 'ghat', 'garden', 'square', 'road', 'bridge', 'zoo', 'stadium', 'palace', 'church', 'mosque', 'stepwell', 'island', 'hill', 'dam', 'bazaar', 'viewpoint', 'food street', 'walk', 'sanctuary', 'falls', 'waterfalls', 'cave', 'caves', 'stupa', 'ashram', 'tomb', 'mahal', 'memorial', 'shrine', 'basilica', 'synagogue', 'cathedral', 'river'];
  return !validKeywords.some(kw => n.includes(kw));
};

const processNagpur = async () => {
  const wikitext = fs.readFileSync('nagpur.txt', 'utf8');
  let inTourism = false;
  const spots = [];
  const lines = wikitext.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (/==\s*(Tourist attractions|Places of interest|Sights|Tourism)\s*==/i.test(trimmed)) {
      inTourism = true;
    } else if (inTourism && /^==[^=]/m.test(trimmed)) {
      inTourism = false;
    }
    
    if (inTourism) {
      const match = trimmed.match(/^\*\s*\[\[(.*?)\]\](.*)/) || trimmed.match(/^\*\s*\{\{.*?\}\}\s*\[\[(.*?)\]\](.*)/);
      if (match) {
        const parts = match[1].split('|');
        const name = parts[0].split('#')[0].trim();
        if (!isInvalidSpot(name)) spots.push(name);
      }
      const inlineMatches = trimmed.matchAll(/\[\[(.*?)\]\]/g);
      for (const m of inlineMatches) {
        const parts = m[1].split('|');
        const name = parts[0].split('#')[0].trim();
        if (!isInvalidSpot(name)) spots.push(name);
      }
    }
  }
  console.log('SPOTS FOUND:', spots);
};
processNagpur();
