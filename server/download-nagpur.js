const https = require('https');
const fs = require('fs');

https.get('https://en.wikipedia.org/w/api.php?action=parse&page=Nagpur&prop=wikitext&format=json&redirects=1', {
  headers: { 'User-Agent': 'SancharAI/1.0' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    fs.writeFileSync('nagpur.txt', json.parse.wikitext['*']);
  });
});
