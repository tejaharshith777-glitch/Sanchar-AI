const http = require('http');

console.log('🩺 Sanchar AI System Doctor Diagnostics...');

const checkURL = (options, postData = null) => {
  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (err) => {
      resolve({ error: err });
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
};

async function runDiagnostics() {
  let allPassed = true;

  // 1. Check client server port 5173
  console.log('\n1. Checking client dev server on port 5173...');
  const clientRes = await checkURL({
    host: 'localhost',
    port: 5173,
    path: '/',
    method: 'GET'
  });
  if (clientRes.error) {
    console.error('❌ Client dev server is offline on port 5173.');
    allPassed = false;
  } else {
    console.log('✅ Client dev server is active and responding (Status ' + clientRes.statusCode + ').');
  }

  // 2. Check backend server port 3000
  console.log('\n2. Checking backend Express server on port 3000...');
  const serverRes = await checkURL({
    host: 'localhost',
    port: 3000,
    path: '/api/health',
    method: 'GET'
  });
  if (serverRes.error) {
    console.error('❌ Backend Express server is offline on port 3000.');
    allPassed = false;
  } else {
    console.log('✅ Backend Express server is active on port 3000.');
    try {
      const health = JSON.parse(serverRes.data);
      console.log('   Health status: ' + health.status + ' | DB mode: ' + health.db);
      if (health.status === 'ok') {
        console.log('   ✅ health check endpoint passed.');
      } else {
        console.error('   ❌ health check returned invalid status.');
        allPassed = false;
      }
    } catch (e) {
      console.error('   ❌ Failed to parse health check JSON response.');
      allPassed = false;
    }
  }

  // 3. Test POST /api/trips
  console.log('\n3. Testing trip creation API endpoint...');
  const postData = JSON.stringify({
    originCity: 'Chennai',
    destinationCity: 'Jaipur',
    budget: 10000,
    analyticsConsent: false
  });
  const tripRes = await checkURL({
    host: 'localhost',
    port: 3000,
    path: '/api/trips',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, postData);

  if (tripRes.error) {
    console.error('❌ Failed to connect to POST /api/trips: ' + tripRes.error.message);
    allPassed = false;
  } else if (tripRes.statusCode !== 201) {
    console.error('❌ POST /api/trips failed with status code ' + tripRes.statusCode + ': ' + tripRes.data);
    allPassed = false;
  } else {
    try {
      const trip = JSON.parse(tripRes.data);
      console.log('   Trip Created: ID=' + (trip._id || trip.id) + ' | Route=' + trip.originCity + ' -> ' + trip.destinationCity);
      console.log('   ✅ Trip creation test passed.');
    } catch (e) {
      console.error('   ❌ Failed to parse created trip JSON response.');
      allPassed = false;
    }
  }

  console.log('\n----------------------------------------');
  if (allPassed) {
    console.log('🎉 ALL DIAGNOSTIC CHECKS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('🚨 SOME DIAGNOSTIC CHECKS FAILED. Please review the errors above.');
    process.exit(1);
  }
}

runDiagnostics();
