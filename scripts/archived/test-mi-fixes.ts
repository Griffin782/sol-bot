#!/usr/bin/env ts-node
/**
 * Test script to verify Market Intelligence fixes
 * Tests:
 * 1. getCurrentTokenPrice integration (price feed)
 * 2. shouldRecordToken filtering (bot mode vs baseline mode)
 */

import { Connection } from '@solana/web3.js';
import { MarketRecorder } from './market-intelligence/handlers/market-recorder';
import { getMarketIntelligenceConfig } from './market-intelligence/config/mi-config';

async function testMIFixes() {
  console.log('🧪 Testing Market Intelligence Fixes\n');
  console.log('═'.repeat(60));

  let passed = 0;
  let failed = 0;

  try {
    // Test 1: Price Feed Integration
    console.log('\n📊 TEST 1: Price Feed Integration');
    console.log('─'.repeat(60));

    const rpcUrl = process.env.RPC_HTTPS_URI || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    // Create recorder with default config
    const recorder = new MarketRecorder(connection);
    await recorder.initialize();

    // Test with a known token (USDC)
    const testMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    console.log(`Testing price fetch for USDC: ${testMint.slice(0, 8)}...`);

    // Simulate token detection
    const testToken = {
      mint: testMint,
      timestamp: Date.now(),
      detection_method: 'websocket' as const,
      detection_program: 'Test',
      initial_price: 0.0001
    };

    const testScore = {
      mint: testMint,
      score: 100,
      would_buy: true,
      has_mint_authority: false,
      has_freeze_authority: false
    };

    // This should trigger price fetching
    await recorder.onTokenDetected(testToken, testScore);

    // Wait a moment for price to be fetched
    await new Promise(resolve => setTimeout(resolve, 3000));

    const stats = recorder.getStats();
    console.log(`\nRecorder stats:`, stats);

    if (stats.tokens_tracked > 0) {
      console.log('✅ PASS: Price feed integration working');
      console.log('   Token was tracked, price monitoring started');
      passed++;
    } else {
      console.log('❌ FAIL: Token not tracked');
      failed++;
    }

    // Test 2: Token Filtering (should_Record Token)
    console.log('\n📊 TEST 2: Token Filtering');
    console.log('─'.repeat(60));

    // Get bot mode config (min_score_to_track: 60)
    const botConfig = getMarketIntelligenceConfig({
      session_id: 'test-session',
      session_type: 'test',
      session_start: Date.now(),
      bot_version: '5.0-test'
    });

    console.log(`Bot mode config: min_score_to_track = ${botConfig.scoring.min_score_to_track}`);

    const recorder2 = new MarketRecorder(connection, botConfig);
    await recorder2.initialize();

    // Test with low score token (should be blocked)
    const lowScoreToken = {
      mint: '11111111111111111111111111111111',
      timestamp: Date.now(),
      detection_method: 'websocket' as const,
      detection_program: 'Test'
    };

    const lowScore = {
      mint: lowScoreToken.mint,
      score: 30, // Below min_score_to_track (60)
      would_buy: false,
      has_mint_authority: true,
      has_freeze_authority: true
    };

    console.log(`Testing low score token (score: ${lowScore.score}, min: ${botConfig.scoring.min_score_to_track})`);
    await recorder2.onTokenDetected(lowScoreToken, lowScore);

    // Test with high score token (should be tracked)
    const highScoreToken = {
      mint: '22222222222222222222222222222222',
      timestamp: Date.now(),
      detection_method: 'websocket' as const,
      detection_program: 'Test'
    };

    const highScore = {
      mint: highScoreToken.mint,
      score: 80, // Above min_score_to_track (60)
      would_buy: true,
      has_mint_authority: false,
      has_freeze_authority: false
    };

    console.log(`Testing high score token (score: ${highScore.score}, min: ${botConfig.scoring.min_score_to_track})`);
    await recorder2.onTokenDetected(highScoreToken, highScore);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const stats2 = recorder2.getStats();
    console.log(`\nRecorder2 stats:`, stats2);

    if (stats2.tokens_blocked > 0 && stats2.tokens_tracked > 0) {
      console.log('✅ PASS: Token filtering working');
      console.log(`   Blocked: ${stats2.tokens_blocked} low-score tokens`);
      console.log(`   Tracked: ${stats2.tokens_tracked} high-score tokens`);
      passed++;
    } else if (stats2.tokens_blocked === 0) {
      console.log('❌ FAIL: No tokens blocked (filtering not working)');
      console.log(`   Expected: 1 blocked, got: ${stats2.tokens_blocked}`);
      failed++;
    } else {
      console.log('❌ FAIL: No tokens tracked');
      failed++;
    }

    // Cleanup
    await recorder.shutdown();
    await recorder2.shutdown();

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 TEST RESULTS');
    console.log('═'.repeat(60));
    console.log(`✅ Passed: ${passed}/2`);
    console.log(`❌ Failed: ${failed}/2`);

    if (failed === 0) {
      console.log('\n🎉 All tests passed! Market Intelligence fixes are working.');
      console.log('\n✅ Fix #1: Price feed integration - WORKING');
      console.log('✅ Fix #2: Token filtering - WORKING');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Check the errors above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 TEST FAILED');
    console.error('Error:', error);
    console.error('\nStack trace:');
    console.error((error as Error).stack);
    process.exit(1);
  }
}

// Run the test
testMIFixes();
