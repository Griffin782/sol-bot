// SAFETY WRAPPER VERIFICATION TEST
// Run this to prove the safety wrapper blocks scams and allows good tokens

import { EmergencySafetyWrapper, wrapTradeFunction } from './src/emergency-safety-wrapper';

// Mock trade function (simulates your actual trade functions)
function mockTrade(tokenAddress: string, amount: number): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`[MOCK TRADE] ${tokenAddress} for ${amount} SOL`);
    // Simulate random success/failure for testing
    const success = Math.random() > 0.3; // 70% success rate
    setTimeout(() => resolve(success), 100);
  });
}

// Test tokens - mix of scams and legitimate tokens
const testTokens = [
  // These should be BLOCKED (scams like you bought)
  {
    address: "TEST_PUMP_TOKEN_123",
    name: "SafeMoonPump",
    symbol: "PUMP",
    liquidity: 5000,
    holders: 25,
    volume: 1000
  },
  {
    address: "TEST_SCAM_TOKEN_456",
    name: "ElonDogeCoin",
    symbol: "ELON",
    liquidity: 15000,
    holders: 100,
    volume: 8000
  },
  {
    address: "TEST_LOW_LIQ_789",
    name: "LegitCoin",
    symbol: "LEGIT",
    liquidity: 2000, // Too low
    holders: 200,
    volume: 5000
  },
  {
    address: "TEST_HONEYPOT_101",
    name: "SafeToken",
    symbol: "SAFE", // Scam pattern
    liquidity: 20000,
    holders: 30, // Too few holders
    volume: 10000
  },

  // These should be ALLOWED (good tokens)
  {
    address: "TEST_GOOD_TOKEN_111",
    name: "ValidProject",
    symbol: "VALID",
    liquidity: 50000,
    holders: 500,
    volume: 25000
  },
  {
    address: "TEST_GOOD_TOKEN_222",
    name: "LegitToken",
    symbol: "LEGIT",
    liquidity: 75000,
    holders: 1000,
    volume: 50000
  }
];

async function runSafetyTest() {
  console.clear();
  console.log("🛡️ SAFETY WRAPPER VERIFICATION TEST");
  console.log("=====================================\n");

  const wrapper = EmergencySafetyWrapper.getInstance();
  const safeTrade = wrapTradeFunction(mockTrade);

  let tokensBlocked = 0;
  let tokensAllowed = 0;
  let scamsBlocked = 0;
  let goodTokensAllowed = 0;

  console.log("🧪 Testing tokens...\n");

  for (const token of testTokens) {
    console.log(`\n--- Testing: ${token.name} (${token.symbol}) ---`);
    console.log(`Liquidity: $${token.liquidity}, Holders: ${token.holders}, Volume: $${token.volume}`);

    try {
      // Test with safety wrapper
      const result = await wrapper.safeTradeWrapper(
        mockTrade,
        token,
        0.01, // Small test amount
        token
      );

      if (result.success) {
        console.log(`✅ ALLOWED: ${result.reason}`);
        tokensAllowed++;

        // Check if this is a scam that got through (BAD!)
        const isScam = ['pump', 'elon', 'safe'].some(pattern =>
          token.name.toLowerCase().includes(pattern) ||
          token.symbol.toLowerCase().includes(pattern)
        );

        if (isScam || token.liquidity < 10000 || token.holders < 50) {
          console.log(`🚨 ERROR: Scam token was allowed! This should not happen!`);
        } else {
          goodTokensAllowed++;
        }
      } else {
        console.log(`🚫 BLOCKED: ${result.reason}`);
        tokensBlocked++;

        // Check if this is a scam that got blocked (GOOD!)
        const isScam = ['pump', 'elon', 'safe'].some(pattern =>
          token.name.toLowerCase().includes(pattern) ||
          token.symbol.toLowerCase().includes(pattern)
        );

        if (isScam || token.liquidity < 10000 || token.holders < 50) {
          scamsBlocked++;
        }
      }
    } catch (error) {
      console.log(`💥 ERROR: ${error}`);
    }
  }

  // Display test results
  console.log("\n" + "=".repeat(50));
  console.log("📊 TEST RESULTS");
  console.log("=".repeat(50));

  console.log(`Total Tokens Tested: ${testTokens.length}`);
  console.log(`Tokens Blocked: ${tokensBlocked}`);
  console.log(`Tokens Allowed: ${tokensAllowed}`);
  console.log(`Scams Blocked: ${scamsBlocked} / 4 expected`);
  console.log(`Good Tokens Allowed: ${goodTokensAllowed} / 2 expected`);

  // Calculate success rate
  const expectedScamsBlocked = 4; // First 4 tokens should be blocked
  const expectedGoodAllowed = 2; // Last 2 tokens should be allowed

  const scamBlockRate = scamsBlocked / expectedScamsBlocked;
  const goodAllowRate = goodTokensAllowed / expectedGoodAllowed;

  console.log(`\nScam Block Rate: ${(scamBlockRate * 100).toFixed(1)}%`);
  console.log(`Good Token Allow Rate: ${(goodAllowRate * 100).toFixed(1)}%`);

  // Overall assessment
  if (scamBlockRate >= 1.0 && goodAllowRate >= 1.0) {
    console.log("\n✅✅✅ PERFECT! Safety wrapper is working correctly!");
    console.log("🎯 This would have prevented your $599 loss!");
    console.log("🚀 Safe to implement in your bot!");
  } else if (scamBlockRate >= 0.75) {
    console.log("\n✅ GOOD! Safety wrapper is mostly working");
    console.log("⚠️ Minor adjustments may be needed");
  } else {
    console.log("\n❌ FAILED! Safety wrapper needs fixes");
    console.log("🚨 Do NOT use until fixed!");
  }

  // Show wrapper stats
  console.log("\n📈 Wrapper Statistics:");
  wrapper.displayDashboard();

  // Test emergency mode
  console.log("🧪 Testing Emergency Mode...");

  // Simulate 5 consecutive losses to trigger emergency mode
  for (let i = 0; i < 5; i++) {
    await wrapper.safeTradeWrapper(
      () => Promise.resolve(false), // Always fails
      testTokens[5], // Good token
      0.01
    );
  }

  console.log("Emergency mode should be active now:");
  wrapper.displayDashboard();

  // Try to trade in emergency mode (should be blocked)
  const emergencyResult = await wrapper.safeTradeWrapper(
    mockTrade,
    testTokens[5], // Good token
    0.01
  );

  if (!emergencyResult.success && emergencyResult.reason.includes('Emergency')) {
    console.log("✅ Emergency mode working correctly!");
  } else {
    console.log("❌ Emergency mode failed!");
  }

  console.log("\n🏁 Test complete!");
}

// Run the test
if (require.main === module) {
  runSafetyTest().catch(console.error);
}

export { runSafetyTest };