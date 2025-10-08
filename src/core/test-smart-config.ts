// Simple test script to verify SMART-CONFIG-SYSTEM works
import { smartConfigSystem } from './SMART-CONFIG-SYSTEM';

async function testSmartConfig() {
  console.log('🧪 Testing SMART-CONFIG-SYSTEM...');

  try {
    // Test a simple preset configuration
    const result = await smartConfigSystem.quickSetupConservative(600);

    if (result.success) {
      console.log('✅ Smart config system works!');
      console.log('Session ID:', result.sessionId);
    } else {
      console.log('❌ Smart config failed:', result.issues);
    }
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testSmartConfig().catch(console.error);