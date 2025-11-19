/**
 * Jupiter API Environment Validator
 * Ensures all required environment variables are set correctly
 */

export interface JupiterEnvConfig {
  apiKey: string;
  endpoint: string;
  tier: string;
  maxRps: number;
  monthlyCredits: number;
  alertThreshold: number;
  logRequests: boolean;
}

export function validateJupiterEnv(): JupiterEnvConfig {
  const errors: string[] = [];

  // Check required variables
  if (!process.env.JUPITER_API_KEY) {
    errors.push("❌ JUPITER_API_KEY is missing");
  } else if (process.env.JUPITER_API_KEY === 'YOUR_KEY_HERE_AFTER_SIGNUP') {
    errors.push("❌ JUPITER_API_KEY not updated (still has placeholder)");
  }

  if (!process.env.JUPITER_ENDPOINT) {
    errors.push("❌ JUPITER_ENDPOINT is missing");
  } else if (!process.env.JUPITER_ENDPOINT.includes('jup.ag')) {
    errors.push("❌ JUPITER_ENDPOINT appears invalid");
  }

  if (!process.env.JUPITER_TIER) {
    errors.push("❌ JUPITER_TIER is missing");
  }

  // Throw if any errors
  if (errors.length > 0) {
    console.error("\n🚨 JUPITER API CONFIGURATION ERRORS:\n");
    errors.forEach(err => console.error(err));
    console.error("\n💡 Fix these in your .env file before continuing\n");
    throw new Error("Jupiter API environment validation failed");
  }

  // Return validated config
  const config: JupiterEnvConfig = {
    apiKey: process.env.JUPITER_API_KEY!,
    endpoint: process.env.JUPITER_ENDPOINT!,
    tier: process.env.JUPITER_TIER!,
    maxRps: parseInt(process.env.JUPITER_MAX_RPS || '50'),
    monthlyCredits: parseInt(process.env.JUPITER_MONTHLY_CREDITS || '75000000'),
    alertThreshold: parseInt(process.env.JUPITER_ALERT_THRESHOLD || '80'),
    logRequests: process.env.JUPITER_LOG_REQUESTS === 'true'
  };

  console.log("✅ Jupiter API environment validated successfully");
  console.log(`   Tier: ${config.tier}`);
  console.log(`   Endpoint: ${config.endpoint}`);
  console.log(`   Max RPS: ${config.maxRps}`);

  return config;
}

// Export a singleton instance
export const jupiterEnv = validateJupiterEnv();
