/**
 * Test API Key Generation and Usage
 * 
 * Generates an API key and tests it with the frontend
 */

const apiKeyService = require('./services/apiKeyMonetizationService');

async function testAPIKeyGeneration() {
  console.log('🔑 Testing API Key Generation...\n');

  try {
    // Create a test user ID (you can use your actual user ID)
    const testUserId = 'ad694f25-e576-4846-93b8-ae5f63d862dd'; // From your logs
    
    console.log('👤 Using test user ID:', testUserId);
    
    // Generate a new API key
    console.log('🔑 Generating new API key...');
    const apiKey = await apiKeyService.createAPIKey(
      testUserId,
      'FREE',
      'Frontend Test Key'
    );
    
    console.log('✅ API Key generated successfully!');
    console.log('📋 Key Details:');
    console.log('   ID:', apiKey.id);
    console.log('   Name:', apiKey.name);
    console.log('   Key:', apiKey.key);
    console.log('   Tier:', apiKey.tier);
    console.log('   Created:', apiKey.createdAt);
    
    // Test the API key
    console.log('\n🧪 Testing API key validation...');
    const isValid = await apiKeyService.validateAPIKey(apiKey.key);
    console.log('✅ API key is valid:', isValid);
    
    if (isValid) {
      const keyInfo = await apiKeyService.getAPIKeyInfo(apiKey.key);
      console.log('📊 Key info:', {
        userId: keyInfo.userId,
        tier: keyInfo.tier,
        isActive: keyInfo.isActive
      });
    }
    
    console.log('\n🎉 API key generation test completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Copy this API key:', apiKey.key);
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
