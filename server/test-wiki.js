const https = require('https');

https.get('https://en.wikipedia.org/w/api.php?action=parse&page=Vijayawada&prop=wikitext&format=json&redirects=1', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const wikitext = json.parse.wikitext['*'];
    const lines = wikitext.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/==/)) {
         console.log('HEADER:', trimmed);
      }
    }
  });
});
