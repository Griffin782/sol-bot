// masterConfig.ts - Complete Trading Bot Configuration
// Version: Test 8.7 Enhanced
// Last Updated: August 8, 2025

// ============================================
// CORE BOT SETTINGS
// ============================================
export interface MasterConfig {
  botVersion: string;
  testMode: boolean;
  verboseLogging: boolean;
  saveTradeHistory: boolean;
  
  // ============================================
  // RUNTIME CONTROLS
  // ============================================
  runtime: {
    duration: number;              // Bot run duration in seconds (0 = infinite)
    maxRuntime: number;            // Maximum runtime in minutes before auto-stop
    pauseBetweenScans: number;     // Milliseconds between token scans
    reconnectAttempts: number;     // RPC reconnection attempts
    reconnectDelay: number;        // Delay between reconnect attempts (ms)
    checkInterval: number;         // How often to check positions (ms)
    heartbeatInterval: number;     // Health check interval (ms)
  };

  // ============================================
  // POOL & POSITION MANAGEMENT
  // ============================================
  pool: {
    initialPool: number;           // Starting capital in USD
    targetPool: number;            // Goal amount in USD
    minPoolReserve: number;        // Minimum pool to keep as reserve (%)
    maxPoolRisk: number;           // Max % of pool to risk at once
    compoundProfits: boolean;      // Auto-reinvest profits
    
    // Position Sizing
    positionSize: number;          // SOL per trade
    dynamicSizing: boolean;        // Adjust size based on pool
    minPositionSize: number;       // Minimum SOL per trade
    maxPositionSize: number;       // Maximum SOL per trade
    positionSizePercent: number;   // % of pool per position
    
    // Concurrent Trading
    maxPositions: number;          // Max concurrent positions
    maxPerToken: number;           // Max positions per token
    diversificationRequired: boolean; // Force position diversity
  };

  // ============================================
  // ENTRY CRITERIA & FILTERS
  // ============================================
  entry: {
    // Token Requirements
    minLiquidity: number;          // Minimum liquidity in USD
    maxLiquidity: number;          // Maximum liquidity in USD
    minMarketCap: number;          // Minimum market cap in USD
    maxMarketCap: number;          // Maximum market cap in USD
    minHolders: number;            // Minimum holder count
    maxHolders: number;            // Maximum holder count
    
    // Token Age & Activity
    minAge: number;                // Minimum token age in minutes
    maxAge: number;                // Maximum token age in minutes
    minVolume24h: number;          // Minimum 24h volume
    minTransactions: number;       // Minimum transaction count
    
    // Price Action
    minPriceChange: number;        // Minimum price change % to enter
    maxPriceChange: number;        // Maximum price change % (avoid pumped)
    requiredMomentum: number;      // Required momentum score (0-100)
    
    // Technical Indicators
    useRSI: boolean;               // Use RSI filter
    rsiOversold: number;           // RSI oversold level (default 30)
    rsiOverbought: number;         // RSI overbought level (default 70)
    
    // Whale Activity
    minWhaleCount: number;         // Minimum whales before entry
    minWhaleBuyVolume: number;     // Min whale buy volume in USD
    whaleEntrySignal: boolean;     // Require whale buy for entry
    
    // Safety Checks
    honeypotCheck: boolean;        // Check for honeypot tokens
    rugCheck: boolean;             // Check for rug indicators
    blacklistCheck: boolean;       // Check against blacklist
    maxSlippage: number;           // Maximum allowed slippage %
  };

  // ============================================
  // EXIT STRATEGY & RISK MANAGEMENT
  // ============================================
  exit: {
    // Profit Targets
    takeProfit1: number;           // First TP level (%)
    takeProfit1Size: number;       // % of position to sell at TP1
    takeProfit2: number;           // Second TP level (%)
    takeProfit2Size: number;       // % of position to sell at TP2
    takeProfit3: number;           // Third TP level (%)
    trailingProfit: boolean;       // Use trailing take profit
    trailingDistance: number;      // Trailing distance (%)
    
    // Stop Loss
    stopLoss: number;              // Stop loss percentage
    trailingStop: boolean;         // Use trailing stop loss
    trailingStopActivation: number; // Profit % to activate trailing
    trailingStopDistance: number;  // Trailing stop distance (%)
    
    // Time-Based Exits
    maxHoldTime: number;           // Maximum hold time in minutes
    minHoldTime: number;           // Minimum hold time in minutes
    timeDecay: boolean;            // Reduce position over time
    timeDecayStart: number;        // Minutes before decay starts
    
    // Whale Exit Signals
    whaleSellPercentage: number;   // % of whales selling to trigger exit
    whaleSellVolume: number;       // Whale sell volume to trigger exit
    whaleExitMultiplier: number;   // Urgency multiplier for whale exits
    panicSellThreshold: number;    // Multiple whales selling threshold
    
    // Market Conditions
    volumeDropExit: number;        // Exit if volume drops by %
    liquidityDropExit: number;     // Exit if liquidity drops by %
    holdersDropExit: number;       // Exit if holders drop by %
    
    // Profit Protection
    profitProtection: {
      enabled: boolean;
      activationProfit: number;
      guaranteedProfit: number;
      trailingActivation: number;
      dynamicAdjustment: boolean;
      quickExitOnWhales: boolean;
      tieredProtection: Array<{
        profit: number;
        protection: number;
      }>;
    };

    tieredExit?: {
      enabled: boolean;
      tiers: Array<{ gain: number; sell: number }>;
      moonBag: {
        percentage: number;
        exitConditions: any;
      };
    };
  };

  // ============================================
  // WHALE TRACKING & ANALYSIS
  // ============================================
  whales: {
    enabled: boolean;              // Enable whale tracking
    minWhaleBalance: number;       // Min balance to be considered whale
    whalePercentOfSupply: number;  // % of supply to be whale
    trackingInterval: number;      // How often to check whales (ms)
    
    // Whale Behavior Scoring
    buySignalStrength: number;     // Multiplier for whale buys
    sellSignalStrength: number;    // Multiplier for whale sells
    followWhales: boolean;         // Copy whale trades
    inverseWhales: boolean;        // Trade against whales
    
    // Alerts
    alertOnWhaleBuy: boolean;      // Alert when whale buys
    alertOnWhaleSell: boolean;     // Alert when whale sells
    alertThreshold: number;        // Min USD value for alerts
    
    // Whale Exit Config
    baseThreshold: number;         // Base percentage threshold
    volumeThreshold: number;       // Volume threshold in USD
    panicSellMultiplier: number;   // Multiplier for panic conditions
    timeDecayFactor: number;       // Time decay factor
    confidenceRequirement: number; // Minimum confidence required
  };

  // ============================================
  // TRADING EXECUTION
  // ============================================
  execution: {
    // Transaction Settings
    priorityFee: number;           // Priority fee in lamports
    maxRetries: number;            // Max transaction retries
    confirmationTimeout: number;   // Transaction timeout (ms)
    simulateFirst: boolean;        // Simulate transactions first
    
    // Slippage & MEV Protection
    slippageTolerance: number;     // Slippage tolerance %
    mevProtection: boolean;        // Enable MEV protection
    privateTransaction: boolean;   // Use private mempool
    
    // Order Types
    useMarketOrders: boolean;      // Use market orders
    useLimitOrders: boolean;       // Use limit orders
    limitOrderOffset: number;      // Limit order price offset %
    
    // Speed vs Cost
    executionSpeed: 'slow' | 'normal' | 'fast' | 'ultra';
    maxGasPrice: number;           // Maximum gas price willing to pay
  };

  // ============================================
  // PERFORMANCE & OPTIMIZATION
  // ============================================
  performance: {
    // Win Rate Targets
    targetWinRate: number;         // Target win rate %
    minAcceptableWinRate: number;  // Stop if below this %
    
    // Profit Targets
    dailyProfitTarget: number;     // Daily profit target %
    weeklyProfitTarget: number;    // Weekly profit target %
    stopOnDailyTarget: boolean;    // Stop when daily target hit
    
    // Risk Limits
    maxDailyLoss: number;          // Max daily loss % (when above initial pool)
    maxInitialPoolLoss: number;    // Max loss % when below initial pool
    maxWeeklyLoss: number;         // Max weekly loss %
    maxConsecutiveLosses: number;  // Stop after X losses
    
    // Smart Trading Modes
    aggressiveMode: boolean;       // Enable aggressive initial trading
    profitProtectionLevel: number; // % of profits to protect
    
    // Dynamic Loss Limits
    dynamicLossLimits: {
      enabled: boolean;
      breakEvenProtection: boolean;
      tiers: Array<{
        poolLevel: number;
        maxLoss: number;
      }>;
    };
    
    // Auto-Optimization
    autoOptimize: boolean;         // Enable auto-optimization
    optimizationInterval: number;  // Hours between optimizations
    backtestBeforeApply: boolean;  // Backtest changes first
  };

  // ============================================
  // DATA & REPORTING
  // ============================================
  reporting: {
    // Report Generation
    generateReports: boolean;      // Auto-generate reports
    reportInterval: number;        // Minutes between reports
    detailedReports: boolean;      // Include detailed analysis
    
    // Data Storage
    saveRawData: boolean;          // Save all raw data
    dataRetentionDays: number;     // Days to keep data
    compressOldData: boolean;      // Compress old data
    
    // Notifications
    enableNotifications: boolean;  // Enable notifications
    discordWebhook: string;        // Discord webhook URL
    telegramBotToken: string;      // Telegram bot token
    telegramChatId: string;        // Telegram chat ID
    
    // Alert Conditions
    alertOnProfit: number;         // Alert when profit > X%
    alertOnLoss: number;           // Alert when loss > X%
    alertOnWhaleActivity: boolean; // Alert on whale moves
    alertOnError: boolean;         // Alert on errors
  };

  // ============================================
  // RPC & NETWORK SETTINGS
  // ============================================
  network: {
    rpcEndpoints: string[];        // RPC endpoints (will rotate)
    wsEndpoints: string[];         // WebSocket endpoints
    rpcRotation: boolean;          // Enable RPC rotation
    maxRpcRequests: number;        // Max requests per RPC
    rpcCooldown: number;           // Cooldown between rotations
    
    // Rate Limiting
    requestsPerSecond: number;     // Max RPC requests/second
    batchRequests: boolean;        // Batch RPC requests
    maxBatchSize: number;          // Max batch size
  };

  // ============================================
  // ADVANCED FEATURES
  // ============================================
  advanced: {
    // Machine Learning
    useML: boolean;                // Enable ML predictions
    mlConfidenceThreshold: number; // Min ML confidence to trade
    
    // Arbitrage
    arbitrageEnabled: boolean;     // Enable arbitrage detection
    minArbProfit: number;          // Min arbitrage profit %
    
    // Market Making
    marketMakingEnabled: boolean;  // Enable market making
    spreadTarget: number;          // Target spread %
    
    // Social Signals
    twitterTracking: boolean;      // Track Twitter mentions
    discordTracking: boolean;      // Track Discord activity
    socialScoreWeight: number;     // Weight of social signals
  };

  // ============================================
  // BLACKLIST & WHITELIST
  // ============================================
  filters: {
    blacklistedTokens: string[];   // Token addresses to avoid
    whitelistedTokens: string[];   // Token addresses to prioritize
    blacklistedDexes: string[];    // DEXes to avoid
    preferredDexes: string[];      // Preferred DEXes
    
    // Developer/Deployer Filters
    blacklistedDevs: string[];     // Deployer addresses to avoid
    trustedDevs: string[];         // Trusted deployer addresses
  };
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================
const config: MasterConfig = {
  // Core Settings
  botVersion: "Test 8.20",
  testMode: true,               // Set to false for live trading
  verboseLogging: true,
  saveTradeHistory: true,

  // Runtime Controls
  runtime: {
    duration: 300,              // 5m =300 1h =3600 6h =21600 0 = run indefinitely
    maxRuntime: 1440,             // 24 hours max
    pauseBetweenScans: 1000,      // 1 second between scans
    reconnectAttempts: 5,
    reconnectDelay: 5000,
    checkInterval: 5000,           // Check positions every 5 seconds
    heartbeatInterval: 30000,      // Health check every 30 seconds
  },

  // Pool Management
  pool: {
    initialPool: 600,
    targetPool: 700,
    minPoolReserve: 5,             // Reduced to 5% for aggressive mode
    maxPoolRisk: 80,               // Increased to 80% for full utilization
    compoundProfits: true,
    
    positionSize: 0.2,           // ~$40 at current SOL price
    dynamicSizing: true,           // Enable dynamic sizing
    minPositionSize: 0.05,
    maxPositionSize: 0.5,
    positionSizePercent: 5,        // 5% of pool per position
    
    maxPositions: 20,
    maxPerToken: 1,
    diversificationRequired: false, // Disabled for aggressive mode
  },

  // Entry Criteria
  entry: {
    minLiquidity: 9000,
    maxLiquidity: 500000,
    minMarketCap: 10000,
    maxMarketCap: 50000,
    minHolders: 20,
    maxHolders: 1000,
    
    minAge: 0,                     // Can trade new tokens
    maxAge: 60,                    // Max 1 hour old
    minVolume24h: 10000,
    minTransactions: 50,
    
    minPriceChange: -10,           // Can buy dips
    maxPriceChange: 50,            // Avoid pumped tokens
    requiredMomentum: 30,
    
    useRSI: false,
    rsiOversold: 30,
    rsiOverbought: 70,
    
    minWhaleCount: 3,
    minWhaleBuyVolume: 5000,
    whaleEntrySignal: false,
    
    honeypotCheck: true,
    rugCheck: true,
    blacklistCheck: true,
    maxSlippage: 5,
  },

  // Exit Strategy
  exit: {
    // Core profit/loss properties
    profitProtection: {
      enabled: true,
      activationProfit: 50,
      guaranteedProfit: 25,
      trailingActivation: 100,
      dynamicAdjustment: true,
      quickExitOnWhales: true,
      tieredProtection: []
    },
    stopLoss: -80,                 // Your existing value
    takeProfit1: 100,              // Your existing value
    takeProfit2: 300,              // Your existing value
    takeProfit3: 500,              // Your existing value
    
    // Size properties
    takeProfit1Size: 25,           // % of position to sell at TP1
    takeProfit2Size: 25,           // % of position to sell at TP2
    
    // Trailing properties
    trailingProfit: false,         // Use trailing take profit
    trailingDistance: 10,          // Trailing distance (%)
    trailingStop: false,           // Use trailing stop loss
    trailingStopActivation: 50,    // Profit % to activate trailing
    trailingStopDistance: 10,      // Trailing stop distance (%)
    
    // Time-based exits
    maxHoldTime: 45,               // Your existing value
    minHoldTime: 1,              // Your existing value
    timeDecay: false,              // Reduce position over time
    timeDecayStart: 30,            // Minutes before decay starts
    
    // Whale activity exits
    whaleSellPercentage: 30,      // Your existing value
    whaleSellVolume: 10000,       // Your existing value
    whaleExitMultiplier: 2,       // Urgency multiplier for whale exits
    panicSellThreshold: 5,         // Multiple whales selling threshold
    
    // Market condition exits
    volumeDropExit: 50,            // Exit if volume drops by %
    liquidityDropExit: 40,         // Exit if liquidity drops by %
    holdersDropExit: 30,           // Exit if holders drop by %
    
    // Tiered Exit
    tieredExit: {
      enabled: true,
      tiers: [
        { gain: 100, sell: 0.25 },   // Take 25% at 2x
        { gain: 300, sell: 0.25 },   // Take 25% at 4x
        { gain: 500, sell: 0.25 },   // Take 25% at 6x
      ],
      
      moonBag: {
        percentage: 0.25,             // Keep 25% for moon
        
        exitConditions: {
          megaMoonTarget: 2000,       // Exit at 20x
          
          trailingStop: {
            enabled: true,
            activateAt: 1000,         // Activate after 10x
            trailPercent: 25,         // Trail by 25% from peak
          },
          
          breakdown: {
            enabled: true,
            fromPeak: -50,            // Exit if drops 50% from peak
            minGainRequired: 500      // Only after 5x achieved
          },
          
          timeDegradation: {
            enabled: true,
            after60min: 800,          // After 60 min, exit at 8x
            after90min: 600,          // After 90 min, exit at 6x
            after120min: 400,         // After 2 hours, exit at 4x
          },
          
          volumeDeath: {
            enabled: true,
            threshold: -90,           // Exit if volume drops 90%
            minGainRequired: 300      // Only check after 3x
          }
        }
      }
    }
  },

  // Whale Tracking
  whales: {
    enabled: true,
    minWhaleBalance: 10000,        // $10k minimum
    whalePercentOfSupply: 1,
    trackingInterval: 10000,
    buySignalStrength: 1.5,
    sellSignalStrength: 2.0,
    followWhales: false,
    inverseWhales: false,
    alertOnWhaleBuy: true,
    alertOnWhaleSell: true,
    alertThreshold: 5000,
    baseThreshold: 30,
    volumeThreshold: 10000,
    panicSellMultiplier: 1.5,
    timeDecayFactor: 0.9,
    confidenceRequirement: 0.7
  },

  // Execution Settings
  execution: {
    priorityFee: 100000,           // 0.0001 SOL
    maxRetries: 3,
    confirmationTimeout: 30000,
    simulateFirst: true,
    
    slippageTolerance: 5,
    mevProtection: true,
    privateTransaction: false,
    
    useMarketOrders: true,
    useLimitOrders: false,
    limitOrderOffset: 0.5,
    
    executionSpeed: 'fast',
    maxGasPrice: 0.01,             // 0.01 SOL max
  },

  // Performance Targets
  performance: {
    targetWinRate: 50,
    minAcceptableWinRate: 40,
    
    dailyProfitTarget: 20,
    weeklyProfitTarget: 100,
    stopOnDailyTarget: false,
    
    // Smart Risk Limits
    maxDailyLoss: 15,              // Only applies when profitable
    maxInitialPoolLoss: 90,        // Can lose 90% when learning
    maxWeeklyLoss: 30,
    maxConsecutiveLosses: 15,      // Increased for learning phase
    
    // Smart Trading Modes
    aggressiveMode: true,          // Enable aggressive mode
    profitProtectionLevel: 50,     // Protect 50% of profits
    
    // Dynamic Loss Limits
    dynamicLossLimits: {
      enabled: true,
      breakEvenProtection: true,
      tiers: [
        { poolLevel: 80, maxLoss: 80 },
        { poolLevel: 90, maxLoss: 70 },
        { poolLevel: 100, maxLoss: 30 },
        { poolLevel: 110, maxLoss: 20 },
        { poolLevel: 125, maxLoss: 15 },
        { poolLevel: 150, maxLoss: 12 },
        { poolLevel: 200, maxLoss: 10 }
      ]
    },
    
    autoOptimize: false,
    optimizationInterval: 24,
    backtestBeforeApply: true,
  },

  // Reporting
  reporting: {
    generateReports: true,
    reportInterval: 60,            // Every hour
    detailedReports: true,
    
    saveRawData: true,
    dataRetentionDays: 30,
    compressOldData: true,
    
    enableNotifications: false,
    discordWebhook: "",
    telegramBotToken: "",
    telegramChatId: "",
    
    alertOnProfit: 100,
    alertOnLoss: 50,
    alertOnWhaleActivity: true,
    alertOnError: true,
  },

  // Network Settings
  network: {
    rpcEndpoints: [
      "https://api.mainnet-beta.solana.com",
      // Add backup endpoints here
    ],
    wsEndpoints: [
      "wss://api.mainnet-beta.solana.com",
    ],
    rpcRotation: true,
    maxRpcRequests: 1000,
    rpcCooldown: 60000,
    
    requestsPerSecond: 10,
    batchRequests: true,
    maxBatchSize: 10,
  },

  // Advanced Features
  advanced: {
    useML: false,
    mlConfidenceThreshold: 70,
    
    arbitrageEnabled: false,
    minArbProfit: 2,
    
    marketMakingEnabled: false,
    spreadTarget: 1,
    
    twitterTracking: false,
    discordTracking: false,
    socialScoreWeight: 0.1,
  },

  // Filters
  filters: {
    blacklistedTokens: [],
    whitelistedTokens: [],
    blacklistedDexes: [],
    preferredDexes: ["Raydium", "Orca"],
    blacklistedDevs: [],
    trustedDevs: [],
  }
};

// ============================================
// CONFIGURATION VALIDATION
// ============================================
function validateConfig(cfg: MasterConfig): boolean {
  const errors: string[] = [];

  // Validate pool settings
  if (cfg.pool.initialPool <= 0) {
    errors.push("Initial pool must be greater than 0");
  }
  
  if (cfg.pool.positionSizePercent > cfg.pool.maxPoolRisk) {
    errors.push("Position size % cannot exceed max pool risk %");
  }

  // Validate exit settings
  if (cfg.exit.stopLoss >= 0) {
    errors.push("Stop loss must be negative");
  }

  // Validate entry criteria
  if (cfg.entry.minLiquidity >= cfg.entry.maxLiquidity) {
    errors.push("Min liquidity must be less than max liquidity");
  }

  // Print errors if any
  if (errors.length > 0) {
    console.error("Configuration Errors:");
    errors.forEach(e => console.error(`  - ${e}`));
    return false;
  }

  return true;
}

// ============================================
// EXPORT CONFIGURATION
// ============================================
if (!validateConfig(config)) {
  throw new Error("Invalid configuration. Please fix errors above.");
}

export default config;

// Export for module usage
export const masterConfig = config;

// Helper function to get config
export function getConfig(): MasterConfig {
  return config;
}

// Helper function to update config (for runtime adjustments)
export function updateConfig(updates: Partial<MasterConfig>): void {
  Object.assign(config, updates);
  if (!validateConfig(config)) {
    throw new Error("Invalid configuration after update");
  }
}

// Log configuration summary
console.log("=".repeat(50));
console.log("TRADING BOT CONFIGURATION LOADED");
console.log("=".repeat(50));
console.log(`Version: ${config.botVersion}`);
console.log(`Mode: ${config.testMode ? 'TEST' : 'LIVE'}`);
console.log(`Initial Pool: $${config.pool.initialPool}`);
console.log(`Target Pool: $${config.pool.targetPool}`);
console.log(`Max Positions: ${config.pool.maxPositions}`);
console.log(`Stop Loss: ${config.exit.stopLoss}%`);
console.log(`Runtime: ${config.runtime.duration === 0 ? 'Unlimited' : config.runtime.duration + ' seconds'}`);
console.log("=".repeat(50));