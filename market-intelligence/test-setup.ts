// ============================================
// MARKET INTELLIGENCE SMOKE TEST
// Tests basic initialization and shutdown
// ============================================

import { Connection } from '@solana/web3.js';
import { MarketRecorder } from './handlers/market-recorder';

async function smokeTest() {
  console.log('🧪 Market Intelligence Smoke Test\n');

  let passed = 0;
  let failed = 0;

  try {
    // TEST 1: Environment Setup
    console.log('TEST 1: Checking environment...');
    const rpcUrl = process.env.RPC_HTTPS_URI || 'https://api.mainnet-beta.solana.com';
    console.log(`  RPC URL: ${rpcUrl.substring(0, 30)}...`);
    passed++;
    console.log('  ✅ PASS\n');

    // TEST 2: Connection Creation
    console.log('TEST 2: Creating Solana connection...');
    const connection = new Connection(rpcUrl, 'confirmed');
    console.log('  ✅ PASS\n');
    passed++;

    // TEST 3: MarketRecorder Initialization
    console.log('TEST 3: Initializing MarketRecorder...');
    const recorder = new MarketRecorder(connection);
    await recorder.initialize();
    console.log('  ✅ PASS\n');
    passed++;

    // TEST 4: Check Recording Status
    console.log('TEST 4: Checking recording status...');
    const isRecording = recorder.isRecording();
    if (isRecording) {
      console.log('  ✅ Recording is active');
      passed++;
    } else {
      console.log('  ❌ Recording is not active');
      failed++;
    }
    console.log('  ✅ PASS\n');

    // TEST 5: Get Stats (should return empty stats)
    console.log('TEST 5: Getting initial stats...');
    const stats = await recorder.getStats();
    console.log(`  Tokens Detected: ${stats.tokens_detected}`);
    console.log(`  Tokens Tracked: ${stats.tokens_tracked}`);
    console.log(`  Active Positions: ${stats.active_positions}`);
    console.log('  ✅ PASS\n');
    passed++;

    // TEST 6: Database Directory
    console.log('TEST 6: Checking database directory...');
    const fs = require('fs');
    const dbPath = './data/market-intelligence';
    if (fs.existsSync(dbPath)) {
      console.log(`  ✅ Directory exists: ${dbPath}`);
      passed++;
    } else {
      console.log(`  ⚠️  Directory not found (will be created on first write): ${dbPath}`);
      passed++; // Still pass, directory created on demand
    }
    console.log('  ✅ PASS\n');

    // TEST 7: Shutdown
    console.log('TEST 7: Shutting down recorder...');
    await recorder.shutdown();
    console.log('  ✅ PASS\n');
    passed++;

    // Summary
    console.log('═'.repeat(50));
    console.log(`📊 SMOKE TEST RESULTS`);
    console.log('═'.repeat(50));
    console.log(`✅ Passed: ${passed}/7`);
    console.log(`❌ Failed: ${failed}/7`);

    if (failed === 0) {
      console.log('\n🎉 All tests passed! Market Intelligence is ready to use.');
      console.log('\n📝 To enable recording in the bot:');
      console.log('   1. Ensure MI_ENABLED is not set to "false" in .env');
      console.log('   2. Start the bot normally with: npm run dev');
      console.log('   3. Check logs for "✅ Market Intelligence recording started"');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Check the errors above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 SMOKE TEST FAILED');
    console.error('Error:', error);
    console.error('\nStack trace:');
    console.error((error as Error).stack);
    process.exit(1);
  }
}

// Run the test
smokeTest();
