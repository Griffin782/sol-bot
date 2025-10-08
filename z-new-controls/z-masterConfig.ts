// z-masterConfig.ts - CLEAN CONFIGURATION WITH z_ PREFIX
// All variables prefixed with z_ to ensure no collision with old config
// NO COMPLEX FUNCTIONS - JUST SIMPLE VALUES

export interface Z_MasterConfig {
  // METADATA
  z_botVersion: string;
  z_configVersion: string;
  z_testMode: boolean;
  z_resetSessionOnStart: boolean;  // Reset session tracking on each run
  
  // RUNTIME CONTROLS
  z_runtime: {
    z_duration: number;              // 0 = unlimited, otherwise seconds
    z_pauseBetweenScans: number;
    z_checkInterval: number;
    z_heartbeatInterval: number;
    z_maxRuntime: number;
    z_stopOnProfit: boolean;
    z_stopOnLoss: boolean;
    z_stopProfitAmount: number;
    z_stopLossAmount: number;
  };
  
  // POOL MANAGEMENT
  z_pool: {
    z_initialPool: number;
    z_targetPool: number;
    z_positionSize: number;          // SOL amount (legacy)
    z_positionSizeUSD: number;       // NEW: USD amount per trade
    z_positionSizePercent: number;   // % of pool
    z_maxPositions: number;
    z_compoundProfits: boolean;
    z_minPoolReserve: number;        // % to keep as reserve
    z_maxPoolRisk: number;           // % max risk exposure
  };
  
  // ENTRY CRITERIA
  z_entry: {
    z_minLiquidity: number;
    z_maxLiquidity: number;
    z_minHolders: number;
    z_maxMarketCap: number;
    z_maxAge: number;                // minutes
    z_minVolume24h: number;
    z_minPriceChangePercent: number;
    z_maxPriceImpact: number;
    z_minScore: number;
    z_allowMintAuthority: boolean;
    z_allowFreezeAuthority: boolean;
    z_rugCheckEnabled: boolean;
    z_honeypotCheck: boolean;
  };
  
  // EXIT STRATEGY
  z_exit: {
    z_stopLoss: number;              // negative percentage
    z_takeProfitLevels: number[];    // [200, 400, 600] = 2x, 4x, 6x
    z_takeProfitAmounts: number[];   // [25, 25, 25] = % to sell
    z_moonbagPercent: number;
    z_maxHoldTime: number;           // minutes
    z_emergencyExitTime: number;     // minutes
    z_trailingStop: boolean;
    z_trailingStopPercent: number;
    z_whaleSellThreshold: number;
    z_volumeDeathThreshold: number;
    z_enable5xDetection: boolean;
  };
  
  // WHALE TRACKING
  z_whale: {
    z_enabled: boolean;
    z_minWhaleSize: number;          // USD value
    z_trackBuys: boolean;
    z_trackSells: boolean;
    z_followWhales: boolean;
    z_exitOnWhaleSell: boolean;
    z_whaleSellPercent: number;
    z_alertThreshold: number;
  };
  
  // EXECUTION
  z_execution: {
    z_slippageTolerance: number;
    z_priorityFee: number;           // lamports
    z_maxGasPrice: number;
    z_retryAttempts: number;
    z_retryDelay: number;
    z_confirmationStrategy: string;
    z_skipPreflight: boolean;
    z_simulateFirst: boolean;
  };
  
  // TAX & SECURE POOL
  z_tax: {
    z_enabled: boolean;
    z_reservePercent: number;        // 40% for taxes
    z_withdrawalThreshold: number;   // USD amount
    z_keepInWallet: number;          // USD to keep trading
    z_autoWithdraw: boolean;
    z_hardwareWallet: string;
  };
  
  // PERFORMANCE
  z_performance: {
    z_targetWinRate: number;
    z_minWinRate: number;
    z_targetProfit: number;
    z_maxDrawdown: number;
    z_maxConsecutiveLosses: number;
    z_pauseOnDrawdown: boolean;
    z_adjustOnPerformance: boolean;
  };
  
  // DATA & REPORTING
  z_data: {
    z_logTrades: boolean;
    z_logPath: string;
    z_saveInterval: number;
    z_detailedReports: boolean;
    z_saveRawData: boolean;
    z_dataRetentionDays: number;
  };
  
  // NETWORK
  z_network: {
    z_rpcEndpoints: string[];
    z_wsEndpoints: string[];
    z_maxRpcRequests: number;
    z_requestsPerSecond: number;
    z_batchRequests: boolean;
  };
}

// ============================================
// CLEAN CONFIGURATION OBJECT - NO FUNCTIONS
// ============================================

export const z_config: Z_MasterConfig = {
  // METADATA
  z_botVersion: "5.0.0",
  z_configVersion: "z_1.0.0",
  z_testMode: false,  // SET THIS TO false FOR LIVE TRADING
    z_resetSessionOnStart: true,  // Reset session tracking on each run
  
  // RUNTIME CONTROLS

  z_runtime: {
    z_duration: 60,              // Run indefinitely for live trading
    z_pauseBetweenScans: 100,
    z_checkInterval: 5000,
    z_heartbeatInterval: 30000,
    z_maxRuntime: 86400,          // 24 hours max
    z_stopOnProfit: false,
    z_stopOnLoss: false,
    z_stopProfitAmount: 1000,
    z_stopLossAmount: 500,
  },
  
  // POOL MANAGEMENT
  z_pool: {
    z_initialPool: 19.7,            // Your starting amount 300
    z_targetPool: 100000,          // Ultimate target 100k
    z_positionSize: 0.00089,         // SOL amount (legacy) 0.089
    z_positionSizeUSD: 0.21,         // NEW: Base USD position size 20 
    z_positionSizePercent: 3,      // Updated for new sizing
    z_maxPositions: 20,
    z_compoundProfits: true,
    z_minPoolReserve: 10,
    z_maxPoolRisk: 15,
  },
  
  // ENTRY CRITERIA
  z_entry: {
    z_minLiquidity: 3000,
    z_maxLiquidity: 500000,
    z_minHolders: 50,
    z_maxMarketCap: 10000000,
    z_maxAge: 60,
    z_minVolume24h: 1000,
    z_minPriceChangePercent: 10,
    z_maxPriceImpact: 5,
    z_minScore: 60,
    z_allowMintAuthority: false,
    z_allowFreezeAuthority: false,
    z_rugCheckEnabled: true,
    z_honeypotCheck: true,
  },
  
  // EXIT STRATEGY
  z_exit: {
    z_stopLoss: -15,
    z_takeProfitLevels: [200, 400, 600],  // 2x, 4x, 6x
    z_takeProfitAmounts: [25, 25, 25],    // 25% each
    z_moonbagPercent: 25,
    z_maxHoldTime: 240,
    z_emergencyExitTime: 480,
    z_trailingStop: true,
    z_trailingStopPercent: 10,
    z_whaleSellThreshold: 30,
    z_volumeDeathThreshold: -80,
    z_enable5xDetection: true,
  },
  
  // WHALE TRACKING
  z_whale: {
    z_enabled: true,
    z_minWhaleSize: 10000,
    z_trackBuys: true,
    z_trackSells: true,
    z_followWhales: true,
    z_exitOnWhaleSell: true,
    z_whaleSellPercent: 30,
    z_alertThreshold: 5000,
  },
  
  // EXECUTION
  z_execution: {
    z_slippageTolerance: 15,
    z_priorityFee: 50000,
    z_maxGasPrice: 100000,
    z_retryAttempts: 3,
    z_retryDelay: 1000,
    z_confirmationStrategy: 'confirmed',
    z_skipPreflight: false,
    z_simulateFirst: true,
  },
  
  // TAX & SECURE POOL
  z_tax: {
    z_enabled: true,
    z_reservePercent: 40,
    z_withdrawalThreshold: 10000,
    z_keepInWallet: 1000,
    z_autoWithdraw: false,
    z_hardwareWallet: '',
  },
  
  // PERFORMANCE
  z_performance: {
    z_targetWinRate: 70,
    z_minWinRate: 50,
    z_targetProfit: 100,
    z_maxDrawdown: 30,
    z_maxConsecutiveLosses: 5,
    z_pauseOnDrawdown: true,
    z_adjustOnPerformance: true,
  },
  
  // DATA & REPORTING
  z_data: {
    z_logTrades: true,
    z_logPath: './data',
    z_saveInterval: 60000,
    z_detailedReports: true,
    z_saveRawData: true,
    z_dataRetentionDays: 30,
  },
  
  // NETWORK
  z_network: {
    z_rpcEndpoints: [
      "https://api.mainnet-beta.solana.com",
    ],
    z_wsEndpoints: [
      "wss://api.mainnet-beta.solana.com",
    ],
    z_maxRpcRequests: 1000,
    z_requestsPerSecond: 10,
    z_batchRequests: true,
  },
};

// ============================================
// SIMPLE VALIDATION - NO COMPLEX LOGIC
// ============================================

function validateZConfig(): boolean {
  const errors: string[] = [];
  
  // Check critical values exist
  if (!z_config.z_pool.z_initialPool || z_config.z_pool.z_initialPool <= 0) {
    errors.push("❌ z_initialPool must be greater than 0");
  }
  
  if (!z_config.z_pool.z_targetPool || z_config.z_pool.z_targetPool <= z_config.z_pool.z_initialPool) {
    errors.push("❌ z_targetPool must be greater than z_initialPool");
  }
  
  if (!z_config.z_pool.z_positionSize || z_config.z_pool.z_positionSize <= 0) {
    errors.push("❌ z_positionSize must be greater than 0");
  }
  
  if (z_config.z_exit.z_stopLoss >= 0) {
    errors.push("❌ z_stopLoss must be negative");
  }
  
  // Log results
  if (errors.length > 0) {
    console.log("\n🚨 Z-CONFIG VALIDATION ERRORS:");
    errors.forEach(e => console.log(e));
    return false;
  }
  
  console.log("✅ Z-CONFIG VALIDATION PASSED");
  return true;
}

// ============================================
// INITIALIZATION LOG
// ============================================

console.log("=" .repeat(50));
console.log("Z-MASTERCONFIG LOADED");
console.log("=" .repeat(50));
console.log(`Version: ${z_config.z_configVersion}`);
console.log(`Test Mode: ${z_config.z_testMode}`);
console.log(`Initial Pool: $${z_config.z_pool.z_initialPool}`);
console.log(`Target Pool: $${z_config.z_pool.z_targetPool}`);
console.log(`Position Size: ${z_config.z_pool.z_positionSize} SOL`);
console.log(`Duration: ${z_config.z_runtime.z_duration === 0 ? 'Unlimited' : z_config.z_runtime.z_duration + ' seconds'}`);
console.log("=" .repeat(50));

// Run validation
const isValid = validateZConfig();
if (!isValid) {
  throw new Error("Z-CONFIG VALIDATION FAILED - FIX ERRORS ABOVE");
}

// ============================================
// EXPORTS
// ============================================

export default z_config;
export { validateZConfig };