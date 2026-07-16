const http = require('http');

const testPort = (port) => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/api/resumes',
      method: 'GET',
      headers: {
        // We test with no token first to see if we get 401 or if the server is responsive
        'Content-Type': 'application/json'
      }
    };

    console.log(`Testing http://localhost:${port}/api/resumes...`);
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`Port ${port} Response Code: ${res.statusCode}`);
        console.log(`Port ${port} Body: ${data}\n`);
        resolve(true);
      });
    });

    req.on('error', (err) => {
      console.log(`Port ${port} Error: ${err.message}\n`);
      resolve(false);
    });

    req.end();
  });
};

const run = async () => {
  await testPort(3000);
  await testPort(3001);
};

run();
