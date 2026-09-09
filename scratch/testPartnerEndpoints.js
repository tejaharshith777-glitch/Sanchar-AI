const http = require('http');

const request = (options, body = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

async function test() {
  console.log('Testing Partner & Issue Endpoints...');

  // 1. Post partner publish
  const pubRes = await request({
    host: 'localhost',
    port: 3000,
    path: '/api/partner-publish',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    role: 'Travel Agency',
    city: 'Chennai',
    type: 'place_guide',
    name: 'Marina Promenade Walk',
    category: 'Beach',
    area: 'Marina Beach',
    hours: '24 Hours',
    cost: 'Free',
    description: 'Iconic beach walk',
    publisherName: 'TN Tourism Agency'
  });
  console.log('POST /api/partner-publish:', pubRes.status, pubRes.data);

  // 2. Get partner publish
  const getPubRes = await request({
    host: 'localhost',
    port: 3000,
    path: '/api/partner-publish?city=Chennai',
    method: 'GET'
  });
  console.log('GET /api/partner-publish?city=Chennai:', getPubRes.status, getPubRes.data);

  // 3. Post issue report
  const issueRes = await request({
    host: 'localhost',
    port: 3000,
    path: '/api/issue-reports',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    city: 'Chennai',
    category: 'language barrier',
    note: 'Signage in Tamil only near port'
  });
  console.log('POST /api/issue-reports:', issueRes.status, issueRes.data);

  // 4. Get issue reports summary
  const getIssueRes = await request({
    host: 'localhost',
    port: 3000,
    path: '/api/issue-reports/summary?city=Chennai',
    method: 'GET'
  });
  console.log('GET /api/issue-reports/summary?city=Chennai:', getIssueRes.status, getIssueRes.data);
}

test().catch(console.error);
