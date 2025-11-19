/**
 * Simple Jupiter Setup Validator
 * Verifies QuickNode + Jupiter configuration
 */

export interface JupiterConfig {
  jupiterEndpoint: string;
  quicknodeRpc: string;
  rateLimit: number;
  delayMs: number;
  isValid: boolean;
}

export function validateJupiterSetup(): JupiterConfig {
  console.log("\n🔍 Validating Trading Configuration...");
  console.log("=".repeat(60));

  const config: JupiterConfig = {
    jupiterEndpoint: process.env.JUPITER_ENDPOINT || '',
    quicknodeRpc: process.env.QUICKNODE_RPC_ENDPOINT || process.env.RPC_HTTPS_URI || '',
    rateLimit: parseInt(process.env.JUPITER_RATE_LIMIT || '10'),
    delayMs: parseInt(process.env.JUPITER_DELAY_MS || '100'),
    isValid: false
  };

  // Validate Jupiter endpoint
  if (!config.jupiterEndpoint) {
    console.error("❌ JUPITER_ENDPOINT missing from .env");
    return config;
  }

  if (!config.jupiterEndpoint.includes('jup.ag')) {
    console.error("❌ JUPITER_ENDPOINT invalid:", config.jupiterEndpoint);
    console.error("   Should be: https://quote-api.jup.ag");
    return config;
  }

  console.log("✅ Jupiter endpoint:", config.jupiterEndpoint);

  // Validate QuickNode RPC
  if (!config.quicknodeRpc) {
    console.error("❌ QUICKNODE_RPC_ENDPOINT missing from .env");
    return config;
  }

  if (!config.quicknodeRpc.includes('quiknode.pro')) {
    console.warn("⚠️  RPC doesn't look like QuickNode");
    console.warn("   Using:", config.quicknodeRpc);
  } else {
    console.log("✅ QuickNode RPC:", config.quicknodeRpc.substring(0, 60) + "...");
  }

  // Show configuration summary
  console.log("\n📊 Configuration Summary:");
  console.log("   Provider: QuickNode + PumpSwap SDK");
  console.log("   Swap Method: Direct on-chain (PumpSwap SDK)");
  console.log("   Fallback: Jupiter API (if PumpSwap unavailable)");
  console.log("   Rate Limit:", config.rateLimit, "requests/second");
  console.log("   Request Delay:", config.delayMs, "ms");
  console.log("   Monthly Cost: $49 (QuickNode only)");

  config.isValid = true;
  console.log("\n" + "=".repeat(60));
  console.log("✅ Configuration valid!\n");

  return config;
}

// Export singleton config
export const jupiterConfig = validateJupiterSetup();
