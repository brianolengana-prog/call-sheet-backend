/**
 * Test OpenAI API Key
 * Simple test to verify API key works
 */

const fetch = require('node-fetch');

async function testOpenAIKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  console.log('🔍 Testing OpenAI API Key...');
  console.log('📊 Key format:', apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET');
  console.log('📊 Key type:', apiKey ? (apiKey.startsWith('sk-proj-') ? 'Organization Key' : 'Personal Key') : 'Unknown');
  
  if (!apiKey) {
    console.error('❌ No API key found');
    return;
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API key works! Available models:', data.data.length);
      console.log('📋 First few models:', data.data.slice(0, 3).map(m => m.id));
    } else {
      const error = await response.text();
      console.error('❌ API key test failed:', error);
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

// Run the test
testOpenAIKey();
