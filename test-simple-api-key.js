/**
 * Simple API Key Generation Test
 * 
 * Generates an API key without database dependencies
 */

const crypto = require('crypto');

function generateAPIKey() {
  const prefix = 'sk_';
  const randomBytes = crypto.randomBytes(32);
  const key = prefix + randomBytes.toString('hex');
  return key;
}

function testAPIKeyGeneration() {
  console.log('🔑 Testing Simple API Key Generation...\n');

  try {
    // Generate a new API key
    console.log('🔑 Generating new API key...');
    const apiKey = generateAPIKey();
    
    console.log('✅ API Key generated successfully!');
    console.log('📋 Key Details:');
    console.log('   Key:', apiKey);
    console.log('   Length:', apiKey.length);
    console.log('   Prefix:', apiKey.startsWith('sk_'));
    
    console.log('\n🎉 API key generation test completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Copy this API key:', apiKey);
    console.log('2. Update your frontend to use API key authentication');
    console.log('3. Test the extraction with the API key');
    
    return apiKey;
    
  } catch (error) {
    console.error('❌ API key generation failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testAPIKeyGeneration();


