// test-progression.ts - Test the Trading Progression System
// Run with: npx ts-node test/test-progression.ts

import { TradingProgression } from '../src/trading-progression';
import { EmergencySafetyWrapper } from '../src/emergency-safety-wrapper';
import { z_config } from '../z-new-controls/z-masterConfig';

class ProgressionTester {
  private progression: TradingProgression;
  private safetyWrapper: EmergencySafetyWrapper;

  constructor() {
    console.log("🧪 TRADING PROGRESSION SYSTEM TEST");
    console.log("=".repeat(50));

    this.safetyWrapper = EmergencySafetyWrapper.getInstance();
    this.progression = new TradingProgression();
  }

  /**
   * Run comprehensive tests
   */
  public async runTests(): Promise<void> {
    console.log("🎯 Starting Trading Progression Tests...\n");

    try {
      await this.testConfigurationValidation();
      await this.testSafetyWrapperIntegration();
      await this.testStageProgression();
      await this.testEmergencyStops();
      await this.testScamDetection();

      console.log("\n✅ ALL TESTS PASSED!");
      console.log("🚀 Trading Progression System is ready for use");

    } catch (error) {
      console.error(`\n❌ TEST FAILED: ${error}`);
      process.exit(1);
    }
  }

  /**
   * Test configuration validation
   */
  private async testConfigurationValidation(): Promise<void> {
    console.log("📋 Testing Configuration Validation...");

    // Test z_config is loaded
    if (!z_config || !z_config.z_pool) {
      throw new Error("z_config not properly loaded");
    }

    // Test required values exist
    if (!z_config.z_pool.z_initialPool || z_config.z_pool.z_initialPool <= 0) {
      throw new Error("Invalid initial pool configuration");
    }

    if (!z_config.z_pool.z_positionSize || z_config.z_pool.z_positionSize <= 0) {
      throw new Error("Invalid position size configuration");
    }

    // Test stage configurations
    const currentStage = this.progression.getCurrentStage();
    if (currentStage !== 1) {
      throw new Error(`Expected stage 1, got stage ${currentStage}`);
    }

    const positionSize = this.progression.getCurrentPositionSize();
    if (positionSize !== 0) { // Stage 1 should be paper trading
      throw new Error(`Expected stage 1 position size 0, got ${positionSize}`);
    }

    console.log("✅ Configuration validation passed");
  }

  /**
   * Test safety wrapper integration
   */
  private async testSafetyWrapperIntegration(): Promise<void> {
    console.log("🛡️  Testing Safety Wrapper Integration...");

    // Test scam token blocking
    const scamToken = {
      address: 'test_scam_token',
      name: 'pump_scam_token',
      symbol: 'SCAM',
      liquidity: 1000,
      holders: 5
    };

    const shouldBlock = this.safetyWrapper.shouldBlockToken(scamToken.address, scamToken);
    if (!shouldBlock) {
      throw new Error("Safety wrapper should block scam token");
    }

    // Test good token allowing
    const goodToken = {
      address: 'test_good_token',
      name: 'legitimate_token',
      symbol: 'GOOD',
      liquidity: 50000,
      holders: 200
    };

    const shouldNotBlock = this.safetyWrapper.shouldBlockToken(goodToken.address, goodToken);
    if (shouldNotBlock) {
      throw new Error("Safety wrapper should NOT block good token");
    }

    // Test duplicate detection
    const duplicateCheck1 = this.safetyWrapper.shouldBlockToken('duplicate_test', { name: 'test' });
    if (duplicateCheck1) {
      throw new Error("First time should not be blocked as duplicate");
    }

    const duplicateCheck2 = this.safetyWrapper.shouldBlockToken('duplicate_test', { name: 'test' });
    if (!duplicateCheck2) {
      throw new Error("Second time should be blocked as duplicate");
    }

    console.log("✅ Safety wrapper integration passed");
  }

  /**
   * Test stage progression logic
   */
  private async testStageProgression(): Promise<void> {
    console.log("📈 Testing Stage Progression Logic...");

    // Test initial stage
    if (this.progression.getCurrentStage() !== 1) {
      throw new Error("Should start at stage 1");
    }

    // Test progression state
    if (!this.progression.canTrade()) {
      throw new Error("Should be able to trade in stage 1 (paper trading)");
    }

    // Simulate some successful paper trades
    for (let i = 0; i < 25; i++) {
      this.progression.recordTrade(
        `test_token_${i}`,
        `TestToken${i}`,
        Math.random() > 0.3, // 70% success rate
        Math.random() * 0.01 - 0.005, // Random P&L
        false
      );
    }

    const stats = this.progression.getStageStats();
    const stage1Stats = stats[0];

    if (!stage1Stats || stage1Stats.tradesExecuted !== 25) {
      throw new Error(`Expected 25 trades, got ${stage1Stats?.tradesExecuted || 0}`);
    }

    console.log("✅ Stage progression logic passed");
  }

  /**
   * Test emergency stop functionality
   */
  private async testEmergencyStops(): Promise<void> {
    console.log("🚨 Testing Emergency Stop Functionality...");

    // Test emergency mode activation
    this.safetyWrapper.activateEmergencyMode("Test emergency stop");

    if (!this.safetyWrapper.getProgressionStats().emergencyMode) {
      throw new Error("Emergency mode should be active");
    }

    // Test that emergency mode blocks all trading
    const tokenShouldBeBlocked = this.safetyWrapper.shouldBlockToken('any_token', { name: 'any' });
    if (!tokenShouldBeBlocked) {
      throw new Error("Emergency mode should block all tokens");
    }

    // Reset emergency mode for further tests
    this.safetyWrapper.resetEmergencyMode();

    if (this.safetyWrapper.getProgressionStats().emergencyMode) {
      throw new Error("Emergency mode should be reset");
    }

    console.log("✅ Emergency stop functionality passed");
  }

  /**
   * Test scam detection patterns
   */
  private async testScamDetection(): Promise<void> {
    console.log("🔍 Testing Scam Detection Patterns...");

    const scamPatterns = [
      { name: 'pump_token', symbol: 'PUMP' },
      { name: 'moon_rocket', symbol: 'MOON' },
      { name: 'elon_inu', symbol: 'ELON' },
      { name: 'doge_baby', symbol: 'DOGE' },
      { name: 'safe_token', symbol: 'SAFE' }
    ];

    for (const scamToken of scamPatterns) {
      const blocked = this.safetyWrapper.shouldBlockToken(
        `scam_${scamToken.name}`,
        {
          name: scamToken.name,
          symbol: scamToken.symbol,
          liquidity: 1000,
          holders: 10
        }
      );

      if (!blocked) {
        throw new Error(`Scam token with pattern ${scamToken.name} should be blocked`);
      }
    }

    // Test legitimate tokens are not blocked
    const legitimateTokens = [
      { name: 'solana_token', symbol: 'SOL' },
      { name: 'bitcoin_bridge', symbol: 'BTC' },
      { name: 'ethereum_wrap', symbol: 'ETH' }
    ];

    for (const goodToken of legitimateTokens) {
      const blocked = this.safetyWrapper.shouldBlockToken(
        `good_${goodToken.name}`,
        {
          name: goodToken.name,
          symbol: goodToken.symbol,
          liquidity: 50000,
          holders: 500
        }
      );

      if (blocked) {
        throw new Error(`Legitimate token ${goodToken.name} should NOT be blocked`);
      }
    }

    console.log("✅ Scam detection patterns passed");
  }

  /**
   * Display test summary
   */
  private displayTestSummary(): void {
    const safetyStats = this.safetyWrapper.getProgressionStats();
    const progressionStats = this.progression.getStageStats();

    console.log("\n📊 TEST SUMMARY:");
    console.log("=".repeat(40));
    console.log(`🛡️  Tokens Blocked: ${safetyStats.tokensBlocked}`);
    console.log(`🚫 Scams Detected: ${safetyStats.scamTokensDetected}`);
    console.log(`🔄 Current Stage: ${this.progression.getCurrentStage()}`);
    console.log(`📈 Test Trades: ${progressionStats[0]?.tradesExecuted || 0}`);
    console.log(`💹 Test Win Rate: ${progressionStats[0]?.winRate.toFixed(1) || 0}%`);
    console.log("=".repeat(40));
  }
}

// Test configuration compatibility
function testConfigCompatibility(): void {
  console.log("🔧 Testing Configuration Compatibility...");

  // Test that we can access z_config
  if (!z_config) {
    throw new Error("Cannot access z_config");
  }

  console.log(`   ✅ Config Version: ${z_config.z_configVersion}`);
  console.log(`   ✅ Bot Version: ${z_config.z_botVersion}`);
  console.log(`   ✅ Test Mode: ${z_config.z_testMode}`);
  console.log(`   ✅ Initial Pool: $${z_config.z_pool.z_initialPool}`);
  console.log(`   ✅ Position Size: ${z_config.z_pool.z_positionSize} SOL`);

  // Test critical values
  if (z_config.z_pool.z_initialPool <= 0) {
    throw new Error("Invalid initial pool value");
  }

  if (z_config.z_pool.z_positionSize <= 0) {
    throw new Error("Invalid position size value");
  }

  console.log("✅ Configuration compatibility passed");
}

// Main test execution
async function main() {
  console.log("🧪 STARTING TRADING PROGRESSION SYSTEM TESTS");
  console.log("=" .repeat(60));

  try {
    // Test configuration first
    testConfigCompatibility();

    // Run progression tests
    const tester = new ProgressionTester();
    await tester.runTests();

    console.log("\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!");
    console.log("✅ Trading Progression System is validated and ready");
    console.log("🚀 You can now run: npm run progressive-trade");

  } catch (error) {
    console.error(`\n💥 CRITICAL TEST FAILURE: ${error}`);
    console.error("🚨 Do NOT use trading progression until issues are resolved");
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { ProgressionTester };