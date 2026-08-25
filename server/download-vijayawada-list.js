const https = require('https');
const fs = require('fs');

https.get('https://en.wikipedia.org/w/api.php?action=parse&page=List_of_tourist_attractions_in_Vijayawada&prop=wikitext&format=json&redirects=1', {
  headers: { 'User-Agent': 'SancharAI/1.0' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    fs.writeFileSync('vijayawada-list.txt', json.parse.wikitext['*']);
  });
});
