require('dotenv').config();
const fetch = require('node-fetch');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

async function testRateLimits() {
  console.log('🔍 Testing OpenAI Rate Limits...');
  
  if (!OPENAI_API_KEY) {
    console.log('❌ No API key found');
    return;
  }

  console.log('📊 Key format:', OPENAI_API_KEY.substring(0, 10) + '...');

  // Test 1: Simple request
  console.log('\n🧪 Test 1: Simple request');
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Hello, this is a test message.'
          }
        ],
        max_tokens: 10
      })
    });

    console.log('📊 Status:', response.status);
    console.log('📊 Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.status === 429) {
      const errorData = await response.json();
      console.log('🚫 Rate limit error:', JSON.stringify(errorData, null, 2));
    } else if (response.ok) {
      const data = await response.json();
      console.log('✅ Success:', data.usage);
    } else {
      const errorData = await response.json();
      console.log('❌ Error:', JSON.stringify(errorData, null, 2));
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }

  // Test 2: Check usage limits
  console.log('\n🧪 Test 2: Check usage limits');
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/usage`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Status:', response.status);
    if (response.ok) {
      const data = await response.json();
      console.log('📊 Usage data:', JSON.stringify(data, null, 2));
    } else {
      const errorData = await response.json();
      console.log('❌ Usage error:', JSON.stringify(errorData, null, 2));
    }
  } catch (error) {
    console.error('❌ Usage request failed:', error.message);
  }
}

testRateLimits();
