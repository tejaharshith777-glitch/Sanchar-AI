const fs = require('fs');
const isInvalidSpot = (name) => {
  const n = name.toLowerCase();
  if (/\((actor|singer|chess player|politician|writer|director|producer|musician|cricketer|athlete|scientist)\)/i.test(n) || n.includes('born in')) return true;
  if (n.includes('municipal corporation') || n.includes('city corporation') || n.includes('region') || n.includes('district') || n.includes('urban agglomeration') || n.includes('mandal') || n.includes('panchayat')) return true;
  if (/\b(fm|radio|am station|television|tv channel|newspaper|magazine|bus depot|airport terminal|airport|railway station)\b/i.test(n)) return true;
  const validKeywords = ['park', 'temple', 'fort', 'beach', 'lake', 'museum', 'monument', 'market', 'ghat', 'garden', 'square', 'road', 'bridge', 'zoo', 'stadium', 'palace', 'church', 'mosque', 'stepwell', 'island', 'hill', 'dam', 'bazaar', 'viewpoint', 'food street', 'walk', 'sanctuary', 'falls', 'waterfalls', 'cave', 'caves', 'stupa', 'ashram', 'tomb', 'mahal', 'memorial', 'shrine', 'basilica', 'synagogue', 'cathedral', 'river'];
  return !validKeywords.some(kw => n.includes(kw));
};

const processVijay = () => {
  const wikitext = fs.readFileSync('vijayawada-list.json', 'utf8');
  const spots = [];
  const lines = wikitext.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^\*\s*\[\[(.*?)\]\](.*)/) || trimmed.match(/^\*\s*\{\{.*?\}\}\s*\[\[(.*?)\]\](.*)/) || trimmed.match(/^#\s*\[\[(.*?)\]\](.*)/);
    if (match) {
        const parts = match[1].split('|');
        const name = parts[0].split('#')[0].trim();
        if (!isInvalidSpot(name)) spots.push(name);
    } else {
        // Look at the text:
        // * '''[[Akkanna Madanna Caves]]''': Akkanna Madanna Caves are located...
        // Ah! It starts with `* '''[[`
        const match2 = trimmed.match(/^\*\s*'''\[\[(.*?)\]\]'''(.*)/);
        if (match2) {
           const parts = match2[1].split('|');
           const name = parts[0].split('#')[0].trim();
           if (!isInvalidSpot(name)) spots.push(name);
        }
    }
  }
  console.log('SPOTS FOUND:', spots);
};
processVijay();
