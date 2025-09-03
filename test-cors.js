#!/usr/bin/env node

/**
 * CORS Test Script
 * This script tests the CORS configuration by making requests from different origins
 */

const https = require('https');
const http = require('http');

const BACKEND_URL = 'https://call-sheet-backend.onrender.com';
const ENDPOINT = '/api/stripe/plans';

// Test origins
const testOrigins = [
  'https://sjcallsheets-project.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://sjcallsheets-project-git-main-servi.vercel.app'
];

function makeRequest(origin) {
  return new Promise((resolve, reject) => {
    const url = new URL(BACKEND_URL + ENDPOINT);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'GET',
      headers: {
        'Origin': origin,
        'Accept': 'application/json',
        'User-Agent': 'CORS-Test-Script/1.0'
      }
    };

    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          origin,
          status: res.statusCode,
          headers: res.headers,
          data: data ? JSON.parse(data) : null,
          corsHeaders: {
            'access-control-allow-origin': res.headers['access-control-allow-origin'],
            'access-control-allow-methods': res.headers['access-control-allow-methods'],
            'access-control-allow-headers': res.headers['access-control-allow-headers'],
            'access-control-allow-credentials': res.headers['access-control-allow-credentials']
          }
        });
      });
    });

    req.on('error', (error) => {
      reject({ origin, error: error.message });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject({ origin, error: 'Request timeout' });
    });

    req.end();
  });
}

async function testCORS() {
  console.log('🧪 Testing CORS Configuration');
  console.log('Backend URL:', BACKEND_URL);
  console.log('Endpoint:', ENDPOINT);
  console.log('');

  const results = [];

  for (const origin of testOrigins) {
    try {
      console.log(`Testing origin: ${origin}`);
      const result = await makeRequest(origin);
      results.push(result);
      
      console.log(`  Status: ${result.status}`);
      console.log(`  CORS Origin: ${result.corsHeaders['access-control-allow-origin'] || 'Not set'}`);
      console.log(`  CORS Methods: ${result.corsHeaders['access-control-allow-methods'] || 'Not set'}`);
      console.log(`  CORS Credentials: ${result.corsHeaders['access-control-allow-credentials'] || 'Not set'}`);
      
      if (result.data && Array.isArray(result.data)) {
        console.log(`  Plans returned: ${result.data.length}`);
      }
      
      console.log('');
    } catch (error) {
      console.log(`  ❌ Error: ${error.error || error.message}`);
      console.log('');
      results.push({ origin, error: error.error || error.message });
    }
  }

  console.log('📊 Test Summary:');
  results.forEach(result => {
    if (result.error) {
      console.log(`  ❌ ${result.origin}: ${result.error}`);
    } else {
      console.log(`  ✅ ${result.origin}: ${result.status} - CORS Origin: ${result.corsHeaders['access-control-allow-origin'] || 'Not set'}`);
    }
  });
}

// Run the test
testCORS().catch(console.error);
