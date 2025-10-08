/**
 * CONFIG-BRIDGE.ts - Backward Compatibility Layer
 * Created: 2025-09-22
 * Purpose: Bridge old configuration variable names to UNIFIED-CONTROL
 *
 * This file allows existing code to continue working while transitioning
 * to the unified configuration system. All values come from UNIFIED-CONTROL.
 */

import {
  MASTER_SETTINGS,
  getPositionSizeSOL,
  getPositionSizeUSD,
  getInitialPool,
  getTargetPool,
  getCurrentSession,
  getMaxTrades,
  getStopLoss,
  isQualityFilterEnabled,
  getRateLimitDelay,
  getBuyProvider,
  getCurrentMode,
  TradingMode,
  getConfigurationEnforcer
} from './UNIFIED-CONTROL';

const enforcer = getConfigurationEnforcer();

// ============================================
// LEGACY VARIABLE MAPPINGS
// ============================================

// Most critical variables that existing code expects
export const BUY_AMOUNT = getPositionSizeSOL();              // 0.00089 SOL (YOUR SETTING!)
export const POSITION_SIZE = getPositionSizeSOL();           // Same as BUY_AMOUNT
export const POSITION_SIZE_USD = getPositionSizeUSD();       // 0.21 USD (YOUR SETTING!)

// Pool configuration
export const INITIAL_POOL = getInitialPool();                // 600 or your z_config value
export const TARGET_POOL = getTargetPool();                  // 100000 (YOUR TARGET!)
export const CURRENT_POOL = enforcer.getValue('pool.currentPool', 'CONFIG-BRIDGE');

// Trading limits
export const MAX_TRADES = getMaxTrades();                    // 20 (ABSOLUTE LIMIT)
export const MAX_TRADES_PER_SESSION = enforcer.getValue('limits.maxTradesPerSession', 'CONFIG-BRIDGE');
export const DURATION = enforcer.getValue('limits.duration', 'CONFIG-BRIDGE');
export const MAX_RUNTIME = enforcer.getValue('limits.maxRuntime', 'CONFIG-BRIDGE');

// Safety settings
export const STOP_LOSS = getStopLoss();                      // -15% (YOUR SETTING)
export const TAKE_PROFIT = enforcer.getValue('exit.takeProfit', 'CONFIG-BRIDGE');
export const HONEYPOT_CHECK = enforcer.getValue('entry.honeypotCheck', 'CONFIG-BRIDGE');
export const RUG_CHECK = enforcer.getValue('entry.rugCheck', 'CONFIG-BRIDGE');
export const QUALITY_FILTER_ENABLED = isQualityFilterEnabled();

// Mode settings
export const TEST_MODE = getCurrentMode() === TradingMode.PAPER;
export const SIMULATION_MODE = enforcer.getValue('runtime.mode.simulation', 'CONFIG-BRIDGE');
export const USE_REAL_MONEY = enforcer.getValue('runtime.mode.useRealMoney', 'CONFIG-BRIDGE');

// Provider settings
export const BUY_PROVIDER = getBuyProvider();                // 'jupiter'
export const SELL_PROVIDER = enforcer.getValue('api.sellProvider', 'CONFIG-BRIDGE');

// Rate limiting
export const RATE_LIMIT_DELAY = getRateLimitDelay();         // 5000ms
export const MAX_CONCURRENT_TRADES = enforcer.getValue('limits.maxConcurrentTrades', 'CONFIG-BRIDGE');

// ============================================
// LEGACY OBJECT MAPPINGS
// ============================================

// For code that expects old config.ts structure
export const config = {
  token_buy: {
    provider: BUY_PROVIDER,
    jupiter: {
      sol_amount: BUY_AMOUNT,
      slippage: enforcer.getValue('entry.maxSlippage', 'CONFIG-BRIDGE'),
    },
    sniperoo: {
      enabled: false,  // Not used in unified system
    }
  },
  token_sell: {
    provider: SELL_PROVIDER,
    jupiter: {
      enabled: true,
    }
  },
  checks: {
    honeypotCheck: HONEYPOT_CHECK,
    rugCheck: RUG_CHECK,
    qualityFilter: QUALITY_FILTER_ENABLED,
  },
  simulation_mode: SIMULATION_MODE,
  limits: {
    maxTrades: MAX_TRADES,
    duration: DURATION,
    maxRuntime: MAX_RUNTIME,
  }
};

// For code that expects old enhanced/masterConfig.ts structure
export const masterConfig = {
  pool: {
    initialPool: INITIAL_POOL,
    targetPool: TARGET_POOL,
    currentPool: CURRENT_POOL,
    positionSize: POSITION_SIZE,
    maxPositions: enforcer.getValue('pool.maxPositions', 'CONFIG-BRIDGE'),
  },
  entry: {
    minLiquidity: enforcer.getValue('entry.minLiquidity', 'CONFIG-BRIDGE'),
    maxLiquidity: enforcer.getValue('entry.maxLiquidity', 'CONFIG-BRIDGE'),
    minMarketCap: enforcer.getValue('entry.minMarketCap', 'CONFIG-BRIDGE'),
    maxMarketCap: enforcer.getValue('entry.maxMarketCap', 'CONFIG-BRIDGE'),
    minHolders: enforcer.getValue('entry.minHolders', 'CONFIG-BRIDGE'),
    maxHolders: enforcer.getValue('entry.maxHolders', 'CONFIG-BRIDGE'),
    honeypotCheck: HONEYPOT_CHECK,
    rugCheck: RUG_CHECK,
  },
  exit: {
    stopLoss: STOP_LOSS,
    takeProfit: TAKE_PROFIT,
    maxHoldTime: enforcer.getValue('exit.maxHoldTime', 'CONFIG-BRIDGE'),
    trailingStop: enforcer.getValue('exit.trailingStop', 'CONFIG-BRIDGE'),
  },
  runtime: {
    duration: DURATION,
    maxRuntime: MAX_RUNTIME,
    pauseBetweenScans: enforcer.getValue('limits.pauseBetweenScans', 'CONFIG-BRIDGE'),
  },
  // Include computed properties that old code might expect
  hasRuntime: true,
  isInitialized: true,
};

// For code that expects z-masterConfig.ts structure
export const z_config = {
  z_pool: {
    z_initialPool: INITIAL_POOL,
    z_targetPool: TARGET_POOL,
    z_positionSize: POSITION_SIZE,
    z_positionSizeUSD: POSITION_SIZE_USD,
    z_maxPositions: enforcer.getValue('pool.maxPositions', 'CONFIG-BRIDGE'),
  },
  z_runtime: {
    z_duration: DURATION,
    z_maxRuntime: MAX_RUNTIME,
    z_testMode: TEST_MODE,
  },
  z_safety: {
    z_stopLoss: STOP_LOSS,
    z_takeProfitLevels: TAKE_PROFIT,
    z_honeypotCheck: HONEYPOT_CHECK,
    z_rugCheckEnabled: RUG_CHECK,
  },
  z_limits: {
    z_maxPositions: enforcer.getValue('pool.maxPositions', 'CONFIG-BRIDGE'),
    z_maxTrades: MAX_TRADES,
  },
  z_filters: {
    z_minLiquidity: enforcer.getValue('entry.minLiquidity', 'CONFIG-BRIDGE'),
    z_maxLiquidity: enforcer.getValue('entry.maxLiquidity', 'CONFIG-BRIDGE'),
    z_minMarketCap: enforcer.getValue('entry.minMarketCap', 'CONFIG-BRIDGE'),
    z_maxMarketCap: enforcer.getValue('entry.maxMarketCap', 'CONFIG-BRIDGE'),
    z_minHolders: enforcer.getValue('entry.minHolders', 'CONFIG-BRIDGE'),
    z_maxHolders: enforcer.getValue('entry.maxHolders', 'CONFIG-BRIDGE'),
    z_minVolume24h: enforcer.getValue('entry.minVolume24h', 'CONFIG-BRIDGE'),
  },
  // Version and metadata
  z_version: MASTER_SETTINGS.version,
  z_configSource: 'UNIFIED-CONTROL-ENHANCED via CONFIG-BRIDGE',
  z_lastUpdated: MASTER_SETTINGS.lastUpdated,
};

// For code that expects botController.ts session structure
export const DEFAULT_SESSION_PROGRESSION = MASTER_SETTINGS.sessions;

// Helper function to get current session config
export function getCurrentSessionConfig() {
  const currentSessionNumber = getCurrentSession();
  return MASTER_SETTINGS.sessions[currentSessionNumber - 1] || MASTER_SETTINGS.sessions[0];
}

// ============================================
// DYNAMIC VALUE FUNCTIONS
// ============================================

// For code that needs to calculate values dynamically
export function calculatePositionSizeInSOL(): number {
  // This was the old function that caused overrides
  // Now it safely returns the unified control value
  const size = getPositionSizeSOL();
  console.log(`📋 [CONFIG-BRIDGE] calculatePositionSizeInSOL() → ${size} SOL (from UNIFIED-CONTROL)`);
  return size;
}

export function calculatePositionSizeInUSD(): number {
  const size = getPositionSizeUSD();
  console.log(`📋 [CONFIG-BRIDGE] calculatePositionSizeInUSD() → $${size} (from UNIFIED-CONTROL)`);
  return size;
}

export function getSessionPositionSize(sessionNumber: number): number {
  const session = MASTER_SETTINGS.sessions[sessionNumber - 1];
  if (!session) {
    console.warn(`⚠️ [CONFIG-BRIDGE] Invalid session number: ${sessionNumber}, using default`);
    return getPositionSizeUSD();
  }

  // Override session position size with unified control for consistency
  console.log(`📋 [CONFIG-BRIDGE] Session ${sessionNumber} position: ${getPositionSizeUSD()} USD (unified override)`);
  return getPositionSizeUSD();
}

// ============================================
// OVERRIDE DETECTION AND LOGGING
// ============================================

let overrideWarningsShown: Set<string> = new Set();

// Function to warn about attempted overrides
function warnAboutOverride(variableName: string, attemptedValue: any, callerInfo: string = '') {
  const warningKey = `${variableName}-${callerInfo}`;

  if (!overrideWarningsShown.has(warningKey)) {
    console.warn(`⚠️ [CONFIG-BRIDGE] Override attempt detected:`);
    console.warn(`   Variable: ${variableName}`);
    console.warn(`   Attempted Value: ${attemptedValue}`);
    console.warn(`   Current Value: ${(global as any)[variableName] || 'undefined'}`);
    console.warn(`   Caller: ${callerInfo}`);
    console.warn(`   Note: All values now controlled by UNIFIED-CONTROL`);

    overrideWarningsShown.add(warningKey);
  }
}

// Proxy to detect assignment attempts to key variables
const protectedVariables = {
  BUY_AMOUNT,
  POSITION_SIZE,
  MAX_TRADES,
  INITIAL_POOL,
  TARGET_POOL,
  STOP_LOSS
};

// Create getters that log access
Object.keys(protectedVariables).forEach(varName => {
  let accessCount = 0;

  Object.defineProperty(global, varName, {
    get() {
      accessCount++;
      const value = (protectedVariables as any)[varName];

      if (accessCount <= 3) { // Only log first few accesses to avoid spam
        console.log(`📋 [CONFIG-BRIDGE] ${varName} accessed → ${value} (access #${accessCount})`);
      }

      return value;
    },
    set(newValue) {
      warnAboutOverride(varName, newValue, new Error().stack?.split('\n')[2] || 'unknown');
      // Don't actually set the value - it's controlled by UNIFIED-CONTROL
    },
    configurable: true,
    enumerable: true
  });
});

// ============================================
// CONFIGURATION ACCESS FUNCTIONS
// ============================================

// Safe functions for getting any configuration value
export function getConfigValue(path: string): any {
  return enforcer.getValue(path, `getConfigValue-${path}`);
}

// Function to update configuration (requires authorization)
export function updateConfigValue(path: string, value: any, authorized: boolean = false): boolean {
  if (!authorized) {
    console.warn(`⚠️ [CONFIG-BRIDGE] Unauthorized config update attempt: ${path} = ${value}`);
    return false;
  }
  return enforcer.setValue(path, value, 'updateConfigValue', true);
}

// Function to get current configuration summary
export function getConfigSummary(): object {
  return {
    mode: getCurrentMode(),
    positionSize: {
      SOL: getPositionSizeSOL(),
      USD: getPositionSizeUSD()
    },
    pool: {
      initial: getInitialPool(),
      target: getTargetPool(),
      current: getConfigValue('pool.currentPool')
    },
    limits: {
      maxTrades: getMaxTrades(),
      duration: getConfigValue('limits.duration'),
      rateLimitDelay: getRateLimitDelay()
    },
    safety: {
      stopLoss: getStopLoss(),
      honeypotCheck: getConfigValue('entry.honeypotCheck'),
      rugCheck: getConfigValue('entry.rugCheck'),
      qualityFilter: isQualityFilterEnabled()
    },
    provider: {
      buy: getBuyProvider(),
      sell: getConfigValue('api.sellProvider')
    }
  };
}

// ============================================
// STARTUP NOTIFICATION
// ============================================

console.log('🌉 [CONFIG-BRIDGE] Backward compatibility layer loaded');
console.log(`   BUY_AMOUNT: ${BUY_AMOUNT} SOL (${POSITION_SIZE_USD} USD)`);
console.log(`   MAX_TRADES: ${MAX_TRADES} (absolute limit)`);
console.log(`   TARGET_POOL: $${TARGET_POOL}`);
console.log(`   MODE: ${getCurrentMode()}`);
console.log(`   All values controlled by UNIFIED-CONTROL-ENHANCED.ts`);

// Export everything for backward compatibility
export default {
  // Legacy variables
  BUY_AMOUNT,
  POSITION_SIZE,
  POSITION_SIZE_USD,
  INITIAL_POOL,
  TARGET_POOL,
  MAX_TRADES,
  STOP_LOSS,
  TEST_MODE,
  SIMULATION_MODE,
  BUY_PROVIDER,
  SELL_PROVIDER,

  // Legacy objects
  config,
  masterConfig,
  z_config,
  DEFAULT_SESSION_PROGRESSION,

  // Functions
  calculatePositionSizeInSOL,
  calculatePositionSizeInUSD,
  getSessionPositionSize,
  getCurrentSessionConfig,
  getConfigValue,
  updateConfigValue,
  getConfigSummary,

  // Advanced
  getConfigurationEnforcer,
  MASTER_SETTINGS
};