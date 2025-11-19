/**
 * Quick test to verify Jupiter environment is set up correctly
 * Run this BEFORE proceeding to Phase 2
 */

import { validateJupiterEnv } from '../src/utils/jupiter-env-validator';

console.log("🧪 Testing Jupiter API Environment Setup...\n");
console.log("=".repeat(60));

try {
  const config = validateJupiterEnv();

  console.log("\n✅ ALL CHECKS PASSED!\n");
  console.log("Environment Summary:");
  console.log("-------------------");
  console.log(`API Key: ${config.apiKey.substring(0, 10)}...${config.apiKey.substring(config.apiKey.length - 5)} (${config.apiKey.length} chars)`);
  console.log(`Endpoint: ${config.endpoint}`);
  console.log(`Tier: ${config.tier.toUpperCase()}`);
  console.log(`Rate Limit: ${config.maxRps} requests/second`);
  console.log(`Monthly Credits: ${config.monthlyCredits.toLocaleString()}`);
  console.log(`Alert at: ${config.alertThreshold}% usage`);
  console.log(`Logging: ${config.logRequests ? 'Enabled' : 'Disabled'}`);

  console.log("\n" + "=".repeat(60));
  console.log("✅ Ready for Phase 2: Configuration Update");
  console.log("=".repeat(60));

} catch (error) {
  console.error("\n❌ Environment setup incomplete!");
  console.error("Fix the errors above and run this test again.\n");
  process.exit(1);
}
