// z-configBridge.ts - CLEAN CONFIG BRIDGE WITH NO FALLBACKS
// All exports use z_ prefix and have NO fallback values
// If config is missing, it FAILS FAST with clear errors

import { z_config } from './z-masterConfig';

// ============================================
// VALIDATION FIRST - FAIL FAST IF BROKEN
// ============================================

if (!z_config) {
  console.error("❌ CRITICAL: z_config not loaded!");
  process.exit(1);
}

if (!z_config.z_pool) {
  console.error("❌ CRITICAL: z_pool configuration missing!");
  process.exit(1);
}

if (!z_config.z_runtime) {
  console.error("❌ CRITICAL: z_runtime configuration missing!");
  process.exit(1);
}

// ============================================
// POOL SETTINGS - NO FALLBACKS
// ============================================

export const z_INITIAL_POOL = z_config.z_pool.z_initialPool;
export const z_TARGET_POOL = z_config.z_pool.z_targetPool;
export const z_POSITION_SIZE = z_config.z_pool.z_positionSize;
export const z_POSITION_SIZE_USD = z_config.z_pool.z_positionSizeUSD;
export const z_POSITION_SIZE_PERCENT = z_config.z_pool.z_positionSizePercent;
export const z_MAX_POSITIONS = z_config.z_pool.z_maxPositions;
export const z_COMPOUND_PROFITS = z_config.z_pool.z_compoundProfits;
export const z_MIN_POOL_RESERVE = z_config.z_pool.z_minPoolReserve;
export const z_MAX_POOL_RISK = z_config.z_pool.z_maxPoolRisk;

// ============================================
// RUNTIME CONTROLS - NO FALLBACKS
// ============================================

export const z_DURATION = z_config.z_runtime.z_duration;
export const z_PAUSE_BETWEEN_SCANS = z_config.z_runtime.z_pauseBetweenScans;
export const z_CHECK_INTERVAL = z_config.z_runtime.z_checkInterval;
export const z_HEARTBEAT_INTERVAL = z_config.z_runtime.z_heartbeatInterval;
export const z_MAX_RUNTIME = z_config.z_runtime.z_maxRuntime;
export const z_STOP_ON_PROFIT = z_config.z_runtime.z_stopOnProfit;
export const z_STOP_ON_LOSS = z_config.z_runtime.z_stopOnLoss;
export const z_STOP_PROFIT_AMOUNT = z_config.z_runtime.z_stopProfitAmount;
export const z_STOP_LOSS_AMOUNT = z_config.z_runtime.z_stopLossAmount;

// ============================================
// ENTRY CRITERIA - NO FALLBACKS
// ============================================

export const z_MIN_LIQUIDITY = z_config.z_entry.z_minLiquidity;
export const z_MAX_LIQUIDITY = z_config.z_entry.z_maxLiquidity;
export const z_MIN_HOLDERS = z_config.z_entry.z_minHolders;
export const z_MAX_MARKET_CAP = z_config.z_entry.z_maxMarketCap;
export const z_MAX_AGE = z_config.z_entry.z_maxAge;
export const z_MIN_VOLUME_24H = z_config.z_entry.z_minVolume24h;
export const z_MIN_PRICE_CHANGE = z_config.z_entry.z_minPriceChangePercent;
export const z_MAX_PRICE_IMPACT = z_config.z_entry.z_maxPriceImpact;
export const z_MIN_SCORE = z_config.z_entry.z_minScore;
export const z_ALLOW_MINT_AUTHORITY = z_config.z_entry.z_allowMintAuthority;
export const z_ALLOW_FREEZE_AUTHORITY = z_config.z_entry.z_allowFreezeAuthority;
export const z_RUG_CHECK_ENABLED = z_config.z_entry.z_rugCheckEnabled;
export const z_HONEYPOT_CHECK = z_config.z_entry.z_honeypotCheck;

// ============================================
// EXIT STRATEGY - NO FALLBACKS
// ============================================

export const z_STOP_LOSS = z_config.z_exit.z_stopLoss;
export const z_TAKE_PROFIT_LEVELS = z_config.z_exit.z_takeProfitLevels;
export const z_TAKE_PROFIT_AMOUNTS = z_config.z_exit.z_takeProfitAmounts;
export const z_MOONBAG_PERCENT = z_config.z_exit.z_moonbagPercent;
export const z_MAX_HOLD_TIME = z_config.z_exit.z_maxHoldTime;
export const z_EMERGENCY_EXIT_TIME = z_config.z_exit.z_emergencyExitTime;
export const z_TRAILING_STOP = z_config.z_exit.z_trailingStop;
export const z_TRAILING_STOP_PERCENT = z_config.z_exit.z_trailingStopPercent;
export const z_WHALE_SELL_THRESHOLD = z_config.z_exit.z_whaleSellThreshold;
export const z_VOLUME_DEATH_THRESHOLD = z_config.z_exit.z_volumeDeathThreshold;
export const z_ENABLE_5X_DETECTION = z_config.z_exit.z_enable5xDetection;

// ============================================
// WHALE TRACKING - NO FALLBACKS
// ============================================

export const z_WHALE_ENABLED = z_config.z_whale.z_enabled;
export const z_MIN_WHALE_SIZE = z_config.z_whale.z_minWhaleSize;
export const z_TRACK_WHALE_BUYS = z_config.z_whale.z_trackBuys;
export const z_TRACK_WHALE_SELLS = z_config.z_whale.z_trackSells;
export const z_FOLLOW_WHALES = z_config.z_whale.z_followWhales;
export const z_EXIT_ON_WHALE_SELL = z_config.z_whale.z_exitOnWhaleSell;
export const z_WHALE_SELL_PERCENT = z_config.z_whale.z_whaleSellPercent;
export const z_WHALE_ALERT_THRESHOLD = z_config.z_whale.z_alertThreshold;

// ============================================
// EXECUTION SETTINGS - NO FALLBACKS
// ============================================

export const z_SLIPPAGE_TOLERANCE = z_config.z_execution.z_slippageTolerance;
export const z_PRIORITY_FEE = z_config.z_execution.z_priorityFee;
export const z_MAX_GAS_PRICE = z_config.z_execution.z_maxGasPrice;
export const z_RETRY_ATTEMPTS = z_config.z_execution.z_retryAttempts;
export const z_RETRY_DELAY = z_config.z_execution.z_retryDelay;
export const z_CONFIRMATION_STRATEGY = z_config.z_execution.z_confirmationStrategy;
export const z_SKIP_PREFLIGHT = z_config.z_execution.z_skipPreflight;
export const z_SIMULATE_FIRST = z_config.z_execution.z_simulateFirst;

// ============================================
// TAX & SECURE POOL - NO FALLBACKS
// ============================================

export const z_TAX_ENABLED = z_config.z_tax.z_enabled;
export const z_TAX_RESERVE_PERCENT = z_config.z_tax.z_reservePercent;
export const z_WITHDRAWAL_THRESHOLD = z_config.z_tax.z_withdrawalThreshold;
export const z_KEEP_IN_WALLET = z_config.z_tax.z_keepInWallet;
export const z_AUTO_WITHDRAW = z_config.z_tax.z_autoWithdraw;
export const z_HARDWARE_WALLET = z_config.z_tax.z_hardwareWallet;

// ============================================
// PERFORMANCE TARGETS - NO FALLBACKS
// ============================================

export const z_TARGET_WIN_RATE = z_config.z_performance.z_targetWinRate;
export const z_MIN_WIN_RATE = z_config.z_performance.z_minWinRate;
export const z_TARGET_PROFIT = z_config.z_performance.z_targetProfit;
export const z_MAX_DRAWDOWN = z_config.z_performance.z_maxDrawdown;
export const z_MAX_CONSECUTIVE_LOSSES = z_config.z_performance.z_maxConsecutiveLosses;
export const z_PAUSE_ON_DRAWDOWN = z_config.z_performance.z_pauseOnDrawdown;
export const z_ADJUST_ON_PERFORMANCE = z_config.z_performance.z_adjustOnPerformance;

// ============================================
// DATA & REPORTING - NO FALLBACKS
// ============================================

export const z_LOG_TRADES = z_config.z_data.z_logTrades;
export const z_LOG_PATH = z_config.z_data.z_logPath;
export const z_SAVE_INTERVAL = z_config.z_data.z_saveInterval;
export const z_DETAILED_REPORTS = z_config.z_data.z_detailedReports;
export const z_SAVE_RAW_DATA = z_config.z_data.z_saveRawData;
export const z_DATA_RETENTION_DAYS = z_config.z_data.z_dataRetentionDays;

// ============================================
// NETWORK SETTINGS - NO FALLBACKS
// ============================================

export const z_RPC_ENDPOINTS = z_config.z_network.z_rpcEndpoints;
export const z_WS_ENDPOINTS = z_config.z_network.z_wsEndpoints;
export const z_MAX_RPC_REQUESTS = z_config.z_network.z_maxRpcRequests;
export const z_REQUESTS_PER_SECOND = z_config.z_network.z_requestsPerSecond;
export const z_BATCH_REQUESTS = z_config.z_network.z_batchRequests;

// ============================================
// METADATA - NO FALLBACKS
// ============================================

export const z_BOT_VERSION = z_config.z_botVersion;
export const z_CONFIG_VERSION = z_config.z_configVersion;
export const z_TEST_MODE = z_config.z_testMode;

// ============================================
// EXPORT FULL CONFIG OBJECT
// ============================================

export const z_CONFIG = z_config;

// ============================================
// VALIDATION LOG
// ============================================

console.log('🔧 Z-CONFIG BRIDGE INITIALIZED:');
console.log(`  ✅ Initial Pool: $${z_INITIAL_POOL}`);
console.log(`  ✅ Target Pool: $${z_TARGET_POOL}`);
console.log(`  ✅ Position Size: ${z_POSITION_SIZE} SOL`);
console.log(`  ✅ Position Size USD: $${z_POSITION_SIZE_USD}`);
console.log(`  ✅ Test Mode: ${z_TEST_MODE}`);
console.log(`  ✅ Duration: ${z_DURATION === 0 ? 'Unlimited' : z_DURATION + ' seconds'}`);
console.log(`  ✅ Tax Reserve: ${z_TAX_RESERVE_PERCENT}%`);
console.log(`  ✅ Max Positions: ${z_MAX_POSITIONS}`);
console.log(`  ✅ Stop Loss: ${z_STOP_LOSS}%`);

// ============================================
// CRITICAL VALIDATION
// ============================================

// Verify all critical values are loaded
const criticalValues = {
  'z_INITIAL_POOL': z_INITIAL_POOL,
  'z_TARGET_POOL': z_TARGET_POOL,
  'z_POSITION_SIZE': z_POSITION_SIZE,
  'z_POSITION_SIZE_USD': z_POSITION_SIZE_USD,
  'z_DURATION': z_DURATION,
  'z_MAX_POSITIONS': z_MAX_POSITIONS,
};

for (const [name, value] of Object.entries(criticalValues)) {
  if (value === undefined || value === null) {
    console.error(`❌ CRITICAL: ${name} is undefined!`);
    console.error('Check z-masterConfig.ts for missing values');
    process.exit(1);
  }
}

console.log('✅ All critical z_ values validated successfully\n');

export default z_CONFIG;