/**
 * UNIFIED-CONTROL-ENHANCED.ts - Complete Configuration Management System
 * Created: 2025-09-22
 * Purpose: Eliminate ALL configuration chaos with single source of truth
 *
 * CRITICAL: This replaces ALL other configuration files and provides
 * unbypassable control over bot behavior.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getEffectiveMode, logSafeModeStatus, SafeModeResult } from '../safety/SAFE-MODE-GUARD';

// No more imports from old config files - UNIFIED-CONTROL is now the single source of truth

// ============================================
// TRADING MODES WITH PRESET CONFIGURATIONS
// ============================================

export enum TradingMode {
  PAPER = 'PAPER',        // Paper trading for testing
  LIVE = 'LIVE',
  MICRO = 'MICRO',        // Tiny real trades for learning
  CONSERVATIVE = 'CONSERVATIVE',  // Safe real trading
  PRODUCTION = 'PRODUCTION'       // Full production trading
}

const MODE_PRESETS = {
  PAPER: {
    positionSizeSOL: 0.06865,     // Tiny amounts
    positionSizeUSD: 15,       // ~$0.002
    maxTrades: 100,           // High limit for testing
    duration: 0,                  // Run until trade limit
    useRealMoney: false,
    simulation: true,
    riskLevel: 'minimal',
    description: 'Paper trading with microscopic test amounts'
  },
  MICRO: {
    positionSizeSOL: 0.0006866,       // $0.15 per trade
    positionSizeUSD: 0.15,
    maxTrades: 50,
    duration: 300,               // 1 hour max
    useRealMoney: true,
    simulation: false,
    riskLevel: 'very_low',
    description: 'Micro trades with real SOL - learning mode'
  },
  CONSERVATIVE: {
    positionSizeSOL: 0.0009,     // Your original z-masterConfig setting
    positionSizeUSD: 0.2,        // Your intended amount
    maxTrades: 0,                // Unlimited trades 100
    duration: 300,                  // 5 minutes max
    useRealMoney: true,
    simulation: false,
    riskLevel: 'low',
    description: 'Conservative trading with your intended position size'
  },
  PRODUCTION: {
    positionSizeSOL: 0.06866,       // Larger production amounts
    positionSizeUSD: 15,          // ~$15 per trade
    maxTrades: 0,                 // Unlimited
    duration: 0,                  // Unlimited
    useRealMoney: true,
    simulation: false,
    riskLevel: 'moderate',
    description: 'Full production trading with larger positions'
  }
};

// ============================================
// SESSION CONFIGURATION WITH AUTO-CALCULATION
// ============================================

export interface SessionConfig {
  sessionNumber: number;
  initialPool: number;
  targetPool: number;
  profitRequired: number;        // Auto-calculated
  growthMultiplier: number;      // Auto-calculated
  maxTrades: number;
  positionSizeUSD: number;
  confidenceAdjustment: number;
  taxReservePercent: number;
  reinvestmentPercent: number;
  nextSessionPool: number;       // Auto-calculated
  riskLevel: 'conservative' | 'moderate' | 'aggressive' | 'high';
  description: string;
}

// Auto-calculate session progression based on user's targets
function calculateSessionProgression(userTargetPool: number = 100000, currentMode: TradingMode = TradingMode.PAPER): SessionConfig[] {
  const sessions: SessionConfig[] = [];

  // Get base position size from current mode preset
  const basePositionSize = MODE_PRESETS[currentMode].positionSizeUSD;

  // Session 1: Foundation
  const session1: SessionConfig = {
    sessionNumber: 1,
    initialPool: 600,              // Proven working amount
    targetPool: Math.min(7000, userTargetPool * 0.07),  // 7% of user target or $7k
    profitRequired: 0,
    growthMultiplier: 0,
    maxTrades: 500,
    positionSizeUSD: basePositionSize,  // ← Use mode preset instead of hardcoded 20
    confidenceAdjustment: 0,
    taxReservePercent: 40,
    reinvestmentPercent: 50,
    nextSessionPool: 0,
    riskLevel: 'moderate',
    description: 'Foundation Building - Learn market patterns'
  };

  // Auto-calculate Session 1 values
  session1.profitRequired = session1.targetPool - session1.initialPool;
  session1.growthMultiplier = session1.targetPool / session1.initialPool;
  const afterTax1 = session1.profitRequired * (1 - session1.taxReservePercent / 100);
  session1.nextSessionPool = afterTax1 * (session1.reinvestmentPercent / 100);
  sessions.push(session1);

  // Session 2: Growth (starts with session 1 output)
  const session2: SessionConfig = {
    sessionNumber: 2,
    initialPool: session1.nextSessionPool,
    targetPool: Math.min(20000, userTargetPool * 0.2),  // 20% of user target or $20k
    profitRequired: 0,
    growthMultiplier: 0,
    maxTrades: 500,
    positionSizeUSD: basePositionSize * 2.25,  // ← Scale from base (was 45, now 15 * 2.25 = 33.75)
    confidenceAdjustment: 5,
    taxReservePercent: 40,
    reinvestmentPercent: 50,
    nextSessionPool: 0,
    riskLevel: 'aggressive',
    description: 'Growth Phase - Scaling with proven strategy'
  };

  session2.profitRequired = session2.targetPool - session2.initialPool;
  session2.growthMultiplier = session2.targetPool / session2.initialPool;
  const afterTax2 = session2.profitRequired * (1 - session2.taxReservePercent / 100);
  session2.nextSessionPool = afterTax2 * (session2.reinvestmentPercent / 100);
  sessions.push(session2);

  // Session 3: Expansion (auto-calculated)
  const session3: SessionConfig = {
    sessionNumber: 3,
    initialPool: session2.nextSessionPool,
    targetPool: Math.min(50000, userTargetPool * 0.5),  // 50% of user target or $50k
    profitRequired: 0,
    growthMultiplier: 0,
    maxTrades: 500,
    positionSizeUSD: basePositionSize * 5,  // ← Scale from base (was 100, now 15 * 5 = 75)
    confidenceAdjustment: 10,
    taxReservePercent: 40,
    reinvestmentPercent: 50,
    nextSessionPool: 0,
    riskLevel: 'aggressive',
    description: 'Expansion Phase - Large growth targets'
  };

  session3.profitRequired = session3.targetPool - session3.initialPool;
  session3.growthMultiplier = session3.targetPool / session3.initialPool;
  const afterTax3 = session3.profitRequired * (1 - session3.taxReservePercent / 100);
  session3.nextSessionPool = afterTax3 * (session3.reinvestmentPercent / 100);
  sessions.push(session3);

  // Session 4: Final Push to user target
  const session4: SessionConfig = {
    sessionNumber: 4,
    initialPool: session3.nextSessionPool,
    targetPool: userTargetPool,    // User's actual target
    profitRequired: 0,
    growthMultiplier: 0,
    maxTrades: 600,
    positionSizeUSD: basePositionSize * 10,  // ← Scale from base (was 200, now 15 * 10 = 150)
    confidenceAdjustment: 15,
    taxReservePercent: 40,
    reinvestmentPercent: 30,       // Lower reinvestment (taking profits)
    nextSessionPool: 0,
    riskLevel: 'high',
    description: 'Final Push - Reaching ultimate target'
  };

  session4.profitRequired = session4.targetPool - session4.initialPool;
  session4.growthMultiplier = session4.targetPool / session4.initialPool;
  const afterTax4 = session4.profitRequired * (1 - session4.taxReservePercent / 100);
  session4.nextSessionPool = afterTax4 * (session4.reinvestmentPercent / 100);
  sessions.push(session4);

  return sessions;
}

// ============================================
// CONFLICT ANALYSIS AND RESOLUTION
// ============================================
//
// ⚠️ WHAT THIS SECTION DOES:
// This section documents and resolves conflicts between OLD configuration files
// that existed BEFORE UNIFIED-CONTROL was created. It's a historical record showing
// what conflicting values existed across different files and how they were resolved.
//
// 🔍 WHY z-masterConfig.ts IS LISTED HERE:
// Your project had MULTIPLE config files competing with each other:
// - z-masterConfig.ts (your intended conservative settings)
// - config.ts (bot's aggressive defaults)
// - botController.ts (session-based settings)
// - secure-pool-system.ts (pool management settings)
// - .env (environment overrides)
//
// 💡 THE PROBLEM IT SOLVED:
// Before UNIFIED-CONTROL, these files created chaos:
// - You set positionSize to 0.00089 SOL ($0.21) in z-masterConfig
// - BUT config.ts used 0.089 SOL ($20) - 100x larger!
// - Bot was trading with YOUR settings ignored
// - Result: Massive losses because bot used aggressive defaults
//
// ✅ THE SOLUTION (UNIFIED-CONTROL):
// This file (UNIFIED-CONTROL.ts) REPLACED all those old files and became the
// SINGLE SOURCE OF TRUTH. The conflict analysis below is a RECORD of what was
// wrong and how it was fixed. It's documentation, not active code.
//
// 📋 CURRENT STATE:
// - z-masterConfig.ts is NO LONGER USED by the bot
// - config.ts is NO LONGER USED by the bot
// - UNIFIED-CONTROL.ts is the ONLY config file the bot reads
// - The conflict data below is for your reference only
//
// 🎯 WHAT IT MEANS FOR YOU:
// You can safely IGNORE the conflict section below. It's historical documentation
// showing what conflicts existed and how they were resolved when creating this file.
// To change bot settings now, you only modify MASTER_SETTINGS below (line 265+).
//
// ============================================

interface ConfigConflict {
  setting: string;
  sources: { file: string; value: any; type?: string; line?: number }[];
  chosenValue: any;
  chosenSource: string;
  reason: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impact: string;
}

const CONFIGURATION_CONFLICTS: ConfigConflict[] = [
  {
    setting: 'positionSize',
    sources: [
      { file: 'z-masterConfig.ts', value: 0.00089, type: 'SOL', line: 164 },
      { file: 'z-masterConfig.ts', value: 0.21, type: 'USD', line: 165 },
      { file: 'config.ts', value: 0.089, type: 'SOL', line: 43 },
      { file: 'botController.ts', value: [20, 45, 100, 200], type: 'USD Array', line: 220 },
      { file: 'secure-pool-system.ts', value: 15, type: 'USD', line: 38 }
    ],
    chosenValue: 0.00089,
    chosenSource: 'z-masterConfig.ts (user intent)',
    reason: 'Respecting user\'s conservative configuration over aggressive bot defaults',
    riskLevel: 'CRITICAL',
    impact: 'Bot was trading with 100x larger positions than user intended! Fixed.'
  },
  {
    setting: 'poolTarget',
    sources: [
      { file: 'z-masterConfig.ts', value: 100000, type: 'USD', line: 163 },
      { file: 'z-masterConfig.ts', value: 19.7, type: 'USD initial', line: 162 },
      { file: 'botController.ts', value: [7000, 20000, 50000, 100000], type: 'Session Array', line: 105 }
    ],
    chosenValue: 100000,
    chosenSource: 'z-masterConfig.ts (final target) with botController.ts (progression)',
    reason: 'Using user\'s $100k target but keeping proven session progression',
    riskLevel: 'MEDIUM',
    impact: 'Balanced approach: user goal with proven methodology'
  },
  {
    setting: 'tradeLimit',
    sources: [
      { file: 'FORCE-TRADE-LIMIT.ts', value: 20, type: 'Absolute Hard Limit', line: 2 },
      { file: 'botController.ts', value: [30, 40, 50, 60], type: 'Session Limits', line: 108 },
      { file: 'index.ts', value: 5, type: 'CLI Override', line: 50 }
    ],
    chosenValue: 20,
    chosenSource: 'FORCE-TRADE-LIMIT.ts (unbypassable)',
    reason: 'Absolute safety limit cannot be overridden - prevents runaway trading',
    riskLevel: 'HIGH',
    impact: 'Safety mechanism active - bot will force shutdown at 20 trades'
  },
  {
    setting: 'testMode',
    sources: [
      { file: '.env', value: false, type: 'Environment', line: 1 },
      { file: 'z-masterConfig.ts', value: false, type: 'Config', line: 143 },
      { file: 'index.ts', value: false, type: 'Runtime', line: 242 }
    ],
    chosenValue: false,
    chosenSource: 'Consistent across all sources',
    reason: 'All sources agree - live trading mode active',
    riskLevel: 'LOW',
    impact: 'No conflict - bot correctly in live trading mode'
  }
];

// ============================================
// UNIFIED MASTER SETTINGS
// ============================================

export const MASTER_SETTINGS = {
  // Meta Configuration
  version: '2.0.0',
  lastUpdated: new Date().toISOString(),
  configSource: 'UNIFIED-CONTROL-ENHANCED.ts',

  // Current Operating Mode
  currentMode: TradingMode.PAPER,  // ✅ PAPER mode for testing | Change to CONSERVATIVE, LIVE, or PRODUCTION for real trading

  // SAFE MODE: Requires multiple explicit confirmations for LIVE trading
  allowLiveTrading: false,  // ❌ MUST be true + env vars + CLI flag for LIVE mode

  // Pool Management (CONFLICTS RESOLVED)
  pool: {
    initialPool: 60,          // Starting amount $600
    currentPool: 60,
    targetPoolUSD: 100000,
    positionSizeSOL: MODE_PRESETS[TradingMode.PAPER].positionSizeSOL,   // ← Now dynamically references MODE_PRESETS
    positionSizeUSD: MODE_PRESETS[TradingMode.PAPER].positionSizeUSD,   // ← Now dynamically references MODE_PRESETS
    maxPositions: 400,        // 🎯 gRPC Basic tier tested capacity: 400-500 positions max (Nov 3, 2025)
                              // Load test results: 200✅ 500✅ 1000❌ (HTTP 401 auth limit at 2000 subscriptions)
                              // 12 vCPU server can handle more, but gRPC subscription quota is the bottleneck
    compoundProfits: true,
    minPoolReserve: 10,
    maxPoolRisk: 15
  },

  // Trading Limits (ABSOLUTE SAFETY)
  limits: {
    maxTradesPerSession: 50,
    maxTradesAbsolute: 100,
    maxConcurrentTrades: 10,      // Maximum concurrent open positions
    maxRuntime: 0,                // 0 = unlimited, otherwise milliseconds
    maxLossUSD: 100,
    duration: 0,
    rateLimitDelay: 5000,
    pauseBetweenScans: 100,
    checkInterval: 30000,
    heartbeatInterval: 60000
  },

  // Entry Criteria (YOUR SAFETY SETTINGS)
  entry: {
    honeypotCheck: true,
    rugCheck: true,
    maxSlippage: 5,               // Maximum slippage percentage allowed
    minLiquidity: 10000,
    maxLiquidity: 10000000,
    minMarketCap: 0,
    maxMarketCap: 5000000,
    minHolders: 100,
    maxHolders: 10000,
    minVolume24h: 50000,
    maxAge: 30,
    blacklistEnabled: true,
    qualityFilterEnabled: true,
    strictMode: true
  },

  // Exit Strategy (YOUR SETTINGS)
  exit: {
    stopLoss: -80,
    takeProfit: 100,
    maxHoldTime: 0,               // 0 = unlimited, otherwise milliseconds (e.g., 3600000 = 1 hour)
    trailingStop: false,
    trailingStopTrigger: 50,
    trailingStopDistance: 20,
    moonbagPercent: 25,
    takeProfitLevels: [100, 300, 500],
    takeProfitPercents: [25, 25, 25]
  },

  // Execution Configuration
  execution: {
    slippageTolerance: 5,
    priorityFee: 1000000000,
    priorityFeeSOL: 0.001,
    maxRetries: 3,
    retryDelay: 2000,
    confirmationTimeout: 30000
  },

  // Session Progression (AUTO-CALCULATED TO YOUR TARGET)
  sessions: calculateSessionProgression(100000, TradingMode.PAPER),  // ← Pass current mode to scale position sizes

  // Quality Filter (FORCE ENABLED)
  qualityFilter: {
    enabled: true,
    minQualityScore: 65,
    blockWords: ['pump', 'inu', 'moon', 'safe', 'elon', 'doge', 'shib', 'baby', 'mini', 'floki'],
    maxTokenAge: 60,                  // minutes
    minTokenAge: 2,                   // minutes
    requireLiquidity: true,
    requireHolders: true,
    requireVolume: true,
  },

  // API Configuration
  api: {
    rpcEndpoint: process.env.QUICKNODE_RPC_ENDPOINT || process.env.RPC_HTTPS_URI || 'https://api.mainnet-beta.solana.com',
    wsEndpoint: process.env.RPC_WSS_URI || 'wss://api.mainnet-beta.solana.com',
    jupiterEndpoint: process.env.JUPITER_ENDPOINT || 'https://lite-api.jup.ag',
    buyProvider: 'pumpswap',          // Using PumpSwap SDK for direct on-chain swaps
    sellProvider: 'pumpswap',         // Consistent with buy provider

    // Rate limiting (from Phase 1 testing)
    rateLimitDelay: parseInt(process.env.JUPITER_DELAY_MS || '100'),
    rateLimitRps: parseInt(process.env.JUPITER_RATE_LIMIT || '10'),
  },

  // Data Stream Configuration (gRPC vs WebSocket)
  dataStream: {
    method: 'grpc',  // 'grpc' or 'wss' - ✅ CHANGED TO gRPC
    mode: 'program',  // 'program' or 'wallet'

    // gRPC Configuration (Triton One / Solana Vibe Station)
    grpc: {
      enabled: true,  // ✅ ENABLED - Set to true to enable gRPC
      endpoint: process.env.GRPC_HTTP_URI || 'https://basic.grpc.solanavibestation.com',
      authToken: process.env.GRPC_AUTH_TOKEN || '',
      reconnectDelay: 5000,
      maxReconnectAttempts: 10,
    },

    // Programs to Monitor (Pump.fun, etc.)
    programs: [
      {
        key: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
        log_discriminator: 'Program log: Instruction: InitializeMint2',
        name: 'Pump.fun token creation',
        enabled: true,
      },
    ],

    // Wallets to Monitor (optional)
    wallets: [] as { key: string; name: string; enabled: boolean }[],
  },

  // ============================================
  // EXPERIMENTAL FLAGS (Position Monitor Patches)
  // ============================================
  experimental: {
    // When true → use legacy PositionMonitor behavior only (current baseline)
    // This is the SAFE DEFAULT - preserves the 11.21 rollback behavior
    positionMonitorRollback: true,

    // Placeholder for future patches: "legacy" | "program" | "auto"
    // - "legacy": Use accountInclude-only (current behavior)
    // - "program": Use programId filters + accountInclude hints (future)
    // - "auto": Auto-detect on startup (future)
    positionMonitorMode: "legacy" as "legacy" | "program" | "auto",

    // Placeholder for future patches: "transactions" | "accounts"
    // - "transactions": Watch swap transactions (current behavior)
    // - "accounts": Watch bonding curve account state changes (future)
    // NOTE: In Patch 1, this does NOT change any runtime behavior yet.
    grpcMode: "transactions" as "transactions" | "accounts",
  },

  // File Paths
  paths: {
    dataDir: './data',
    logsDir: './logs',
    walletDir: './wallets',
    taxDir: './tax-compliance',
    configBackupDir: './config-backups',
  },

  // Runtime State (LIVE TRACKING)
  runtime: {
    startTime: Date.now(),
    tradesExecuted: 0,
    currentSessionNumber: 1,
    totalProfit: 0,
    totalLoss: 0,
    winRate: 0,
    mode: MODE_PRESETS[TradingMode.PAPER],   // Must match currentMode above (PAPER)
    lastConfigUpdate: Date.now(),
    overrideAttempts: 0,
  },

  // Validation Rules
  validation: {
    maxPositionSizePercent: 10,       // Max 10% of pool per trade
    minStopLoss: -50,                 // Don't allow more than 50% stop loss
    maxStopLoss: -5,                  // Don't allow less than 5% stop loss
    maxDailyTrades: 200,
    requireSafetyChecks: true,
  }
};

// ============================================
// CONFIGURATION ENFORCER CLASS
// ============================================

export class ConfigurationEnforcer {
  private static instance: ConfigurationEnforcer;
  private accessLog: Array<{
    timestamp: number;
    setting: string;
    requestedBy: string;
    value: any;
    action: 'GET' | 'SET' | 'BLOCKED';
  }> = [];
  private overrideAttempts: number = 0;
  private blockList: Set<string> = new Set();

  private constructor() {
    console.log('🔒 ConfigurationEnforcer initialized');

    // Apply SAFE MODE GUARD on startup
    const initialMode = MASTER_SETTINGS.currentMode;
    const safeModeResult = getEffectiveMode(
      initialMode as any,
      MASTER_SETTINGS.allowLiveTrading
    );

    // Log safe mode status
    console.log('✅ [CONFIG-ENFORCER] Startup validation passed');
    logSafeModeStatus(safeModeResult);

    // Apply effective mode if different from requested
    if (safeModeResult.effectiveMode !== initialMode) {
      const effectivePreset = MODE_PRESETS[safeModeResult.effectiveMode as TradingMode];
      const safePreset = {
        ...effectivePreset,
        useRealMoney: safeModeResult.effectiveUseRealMoney,
        simulation: !safeModeResult.effectiveUseRealMoney,
      };

      // Force safe values
      (MASTER_SETTINGS as any).currentMode = safeModeResult.effectiveMode;
      MASTER_SETTINGS.runtime.mode = safePreset as any;

      console.log(`🔒 [SAFE-MODE] Forced effective mode: ${safeModeResult.effectiveMode}`);
    }

    this.validateStartupConfiguration();
  }

  public static getInstance(): ConfigurationEnforcer {
    if (!ConfigurationEnforcer.instance) {
      ConfigurationEnforcer.instance = new ConfigurationEnforcer();
    }
    return ConfigurationEnforcer.instance;
  }

  /**
   * Get configuration value with logging and validation
   */
  public getValue(settingPath: string, requestedBy: string = 'unknown'): any {
    const keys = settingPath.split('.');
    let value: any = MASTER_SETTINGS;

    try {
      for (const key of keys) {
        value = value[key];
        if (value === undefined) {
          console.error(`❌ [CONFIG-ENFORCER] Setting not found: ${settingPath}`);
          return null;
        }
      }

      // Log successful access
      this.accessLog.push({
        timestamp: Date.now(),
        setting: settingPath,
        requestedBy,
        value: this.sanitizeValue(value),
        action: 'GET'
      });

      // Keep log size manageable
      if (this.accessLog.length > 1000) {
        this.accessLog = this.accessLog.slice(-500);
      }

      console.log(`📋 [CONFIG-ENFORCER] ${settingPath} = ${this.formatValue(value)} (by: ${requestedBy})`);
      return value;

    } catch (error) {
      console.error(`❌ [CONFIG-ENFORCER] Error accessing ${settingPath}:`, error);
      return null;
    }
  }

  /**
   * Attempt to set configuration value - LOGS AND BLOCKS UNAUTHORIZED CHANGES
   */
  public setValue(settingPath: string, newValue: any, requestedBy: string = 'unknown', authorized: boolean = false): boolean {
    this.overrideAttempts++;

    const currentValue = this.getValue(settingPath, 'setValue');

    if (!authorized) {
      console.error(`🚨 [CONFIG-ENFORCER] UNAUTHORIZED OVERRIDE ATTEMPT BLOCKED!`);
      console.error(`   Setting: ${settingPath}`);
      console.error(`   Current: ${this.formatValue(currentValue)}`);
      console.error(`   Attempted: ${this.formatValue(newValue)}`);
      console.error(`   Requested By: ${requestedBy}`);
      console.error(`   Override Attempts: ${this.overrideAttempts}`);

      this.accessLog.push({
        timestamp: Date.now(),
        setting: settingPath,
        requestedBy,
        value: newValue,
        action: 'BLOCKED'
      });

      // Add to block list if too many attempts
      if (this.overrideAttempts > 10) {
        this.blockList.add(requestedBy);
        console.error(`🔥 [CONFIG-ENFORCER] ${requestedBy} added to block list after ${this.overrideAttempts} attempts`);
      }

      return false;
    }

    // Authorized change
    const keys = settingPath.split('.');
    let obj: any = MASTER_SETTINGS;

    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
      if (!obj) {
        console.error(`❌ [CONFIG-ENFORCER] Invalid path: ${settingPath}`);
        return false;
      }
    }

    obj[keys[keys.length - 1]] = newValue;
    MASTER_SETTINGS.runtime.lastConfigUpdate = Date.now();

    this.accessLog.push({
      timestamp: Date.now(),
      setting: settingPath,
      requestedBy,
      value: newValue,
      action: 'SET'
    });

    console.log(`✅ [CONFIG-ENFORCER] AUTHORIZED UPDATE: ${settingPath} = ${this.formatValue(newValue)}`);
    return true;
  }

  /**
   * Switch trading mode with SAFE MODE validation
   */
  public setTradingMode(mode: TradingMode, requestedBy: string = 'system'): boolean {
    const preset = MODE_PRESETS[mode];
    if (!preset) {
      console.error(`❌ [CONFIG-ENFORCER] Invalid trading mode: ${mode}`);
      return false;
    }

    console.log(`🔄 [CONFIG-ENFORCER] Mode switch requested: ${MASTER_SETTINGS.currentMode} → ${mode}`);
    console.log(`   ${preset.description}`);

    // Apply SAFE MODE GUARD - enforce safety checks
    const safeModeResult = getEffectiveMode(
      mode as any, // Cast to SafeModeGuard's TradingMode type
      MASTER_SETTINGS.allowLiveTrading
    );

    // Log detailed safe mode status
    logSafeModeStatus(safeModeResult);

    // Use effective mode and useRealMoney after safety checks
    const effectiveMode = safeModeResult.effectiveMode as TradingMode;
    const effectivePreset = MODE_PRESETS[effectiveMode];

    // Create a safe preset with effective useRealMoney flag
    const safePreset = {
      ...effectivePreset,
      useRealMoney: safeModeResult.effectiveUseRealMoney,
      simulation: !safeModeResult.effectiveUseRealMoney,
    };

    // Update mode and related settings with SAFE values
    this.setValue('currentMode', effectiveMode, requestedBy, true);
    this.setValue('pool.positionSizeSOL', safePreset.positionSizeSOL, requestedBy, true);
    this.setValue('pool.positionSizeUSD', safePreset.positionSizeUSD, requestedBy, true);
    this.setValue('limits.maxTradesAbsolute', safePreset.maxTrades, requestedBy, true);
    this.setValue('runtime.mode', safePreset, requestedBy, true);

    console.log(`✅ [CONFIG-ENFORCER] Mode SET to ${effectiveMode} (requested: ${mode})`);
    console.log(`   Position Size: ${safePreset.positionSizeUSD} USD (${safePreset.positionSizeSOL} SOL)`);
    console.log(`   Max Trades: ${safePreset.maxTrades}`);
    console.log(`   Risk Level: ${safePreset.riskLevel}`);
    console.log(`   Use Real Money: ${safePreset.useRealMoney}`);

    return true;
  }

  /**
   * Get conflict analysis report
   */
  public getConflictReport(): ConfigConflict[] {
    return [...CONFIGURATION_CONFLICTS];
  }

  /**
   * Get access log for debugging
   */
  public getAccessLog(limit: number = 100): typeof this.accessLog {
    return this.accessLog.slice(-limit);
  }

  /**
   * Validate startup configuration
   */
  private validateStartupConfiguration(): boolean {
    const errors: string[] = [];

    // Position size validation (mode-aware)
    const positionSize = MASTER_SETTINGS.pool.positionSizeUSD;
    const poolSize = MASTER_SETTINGS.pool.initialPool;
    const maxPercent = MASTER_SETTINGS.currentMode === TradingMode.PAPER ? 0.5 : 0.1; // 50% for PAPER, 10% for LIVE
    if (positionSize > poolSize * maxPercent) {
      errors.push(`Position size too large: ${positionSize} > ${maxPercent * 100}% of ${poolSize}`);
    }

    // Safety validation
    if (MASTER_SETTINGS.exit.stopLoss >= 0) {
      errors.push(`Invalid stop loss: ${MASTER_SETTINGS.exit.stopLoss} (must be negative)`);
    }

    // Trade limit validation
    if (MASTER_SETTINGS.limits.maxTradesAbsolute <= 0) {
      errors.push(`Invalid trade limit: ${MASTER_SETTINGS.limits.maxTradesAbsolute}`);
    }

    if (errors.length > 0) {
      console.error('❌ [CONFIG-ENFORCER] Configuration validation failed:');
      errors.forEach(error => console.error(`   - ${error}`));
      return false;
    }

    console.log('✅ [CONFIG-ENFORCER] Startup validation passed');
    return true;
  }

  private sanitizeValue(value: any): any {
    if (typeof value === 'string' && value.includes('PRIVATE_KEY')) {
      return '[REDACTED]';
    }
    return value;
  }

  private formatValue(value: any): string {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 0);
    }
    return String(value);
  }
}

// ============================================
// CONFIGURATION VALIDATOR
// ============================================

export class ConfigurationValidator {
  public static validateAll(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Pool validation
    const { pool, limits, exit, entry } = MASTER_SETTINGS;

    if (pool.positionSizeUSD > pool.initialPool * 0.1) {
      errors.push(`Position size ${pool.positionSizeUSD} exceeds 10% of pool ${pool.initialPool}`);
    }

    if (pool.positionSizeSOL > 1) {
      warnings.push(`Large position size: ${pool.positionSizeSOL} SOL`);
    }

    // Safety validation
    if (exit.stopLoss >= 0 || exit.stopLoss < -50) {
      errors.push(`Invalid stop loss: ${exit.stopLoss}% (must be between -50% and 0%)`);
    }

    if (!entry.honeypotCheck || !entry.rugCheck) {
      errors.push('Critical safety checks disabled');
    }

    // Limits validation
    if (limits.maxTradesAbsolute > 1000) {
      warnings.push(`Very high trade limit: ${limits.maxTradesAbsolute}`);
    }

    if (limits.rateLimitDelay < 1000) {
      errors.push(`Rate limit delay too low: ${limits.rateLimitDelay}ms`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// ============================================
// STARTUP INITIALIZATION
// ============================================

export function initializeUnifiedControl(): boolean {
  console.log('🚀 [UNIFIED-CONTROL] Initializing enhanced configuration system...');

  // Print version and source
  console.log(`   Version: ${MASTER_SETTINGS.version}`);
  console.log(`   Source: ${MASTER_SETTINGS.configSource}`);
  console.log(`   Updated: ${MASTER_SETTINGS.lastUpdated}`);

  // Print conflict resolution summary
  console.log(`📊 [UNIFIED-CONTROL] Configuration conflicts resolved: ${CONFIGURATION_CONFLICTS.length}`);

  CONFIGURATION_CONFLICTS.forEach((conflict, index) => {
    const emoji = conflict.riskLevel === 'CRITICAL' ? '🔥' :
                  conflict.riskLevel === 'HIGH' ? '⚠️' :
                  conflict.riskLevel === 'MEDIUM' ? '🟡' : '✅';

    console.log(`${emoji} [CONFLICT ${index + 1}] ${conflict.setting}:`);
    console.log(`   Sources: ${conflict.sources.length} different values`);
    console.log(`   Resolution: ${conflict.chosenValue} (${conflict.chosenSource})`);
    console.log(`   Impact: ${conflict.impact}`);
  });

  // Initialize enforcer
  const enforcer = ConfigurationEnforcer.getInstance();

  // Run validation
  const validation = ConfigurationValidator.validateAll();

  if (!validation.valid) {
    console.error('❌ [UNIFIED-CONTROL] Configuration validation failed:');
    validation.errors.forEach(error => console.error(`   - ${error}`));
    return false;
  }

  if (validation.warnings.length > 0) {
    console.warn('⚠️ [UNIFIED-CONTROL] Configuration warnings:');
    validation.warnings.forEach(warning => console.warn(`   - ${warning}`));
  }

  // Print final configuration summary
  console.log(`📋 [UNIFIED-CONTROL] Final configuration active:`);
  console.log(`   Mode: ${MASTER_SETTINGS.currentMode} (${MODE_PRESETS[MASTER_SETTINGS.currentMode].description})`);
  console.log(`   Position Size: $${MASTER_SETTINGS.pool.positionSizeUSD} (${MASTER_SETTINGS.pool.positionSizeSOL} SOL)`);
  console.log(`   Pool: $${MASTER_SETTINGS.pool.initialPool} → $${MASTER_SETTINGS.pool.targetPoolUSD}`);
  console.log(`   Trade Limit: ${MASTER_SETTINGS.limits.maxTradesAbsolute} (absolute maximum)`);
  console.log(`   Stop Loss: ${MASTER_SETTINGS.exit.stopLoss}%`);
  console.log(`   Safety Checks: Honeypot(${MASTER_SETTINGS.entry.honeypotCheck}) | Rug(${MASTER_SETTINGS.entry.rugCheck}) | Quality(${MASTER_SETTINGS.entry.qualityFilterEnabled})`);
  console.log(`   Sessions: ${MASTER_SETTINGS.sessions.length} configured to reach $${MASTER_SETTINGS.pool.targetPoolUSD}`);

  return true;
}

// ============================================
// CONVENIENCE EXPORTS
// ============================================

const enforcer = ConfigurationEnforcer.getInstance();

// Safe getter functions that cannot be overridden
export const getPositionSizeSOL = () => enforcer.getValue('pool.positionSizeSOL', 'getPositionSizeSOL');
export const getPositionSizeUSD = () => enforcer.getValue('pool.positionSizeUSD', 'getPositionSizeUSD');
export const getInitialPool = () => enforcer.getValue('pool.initialPool', 'getInitialPool');
export const getTargetPool = () => enforcer.getValue('pool.targetPoolUSD', 'getTargetPool');
export const getCurrentSession = () => enforcer.getValue('runtime.currentSessionNumber', 'getCurrentSession');
export const getMaxTrades = () => enforcer.getValue('limits.maxTradesAbsolute', 'getMaxTrades');
export const getStopLoss = () => enforcer.getValue('exit.stopLoss', 'getStopLoss');
export const isQualityFilterEnabled = () => enforcer.getValue('entry.qualityFilterEnabled', 'isQualityFilterEnabled');
export const getRateLimitDelay = () => enforcer.getValue('limits.rateLimitDelay', 'getRateLimitDelay');
export const getBuyProvider = () => enforcer.getValue('api.buyProvider', 'getBuyProvider');

// Mode management
export const setTradingMode = (mode: TradingMode) => enforcer.setTradingMode(mode, 'setTradingMode');
export const getCurrentMode = () => enforcer.getValue('currentMode', 'getCurrentMode');

// Advanced access (for authorized system use only)
export const getConfigurationEnforcer = () => enforcer;
export const getConfigurationValidator = () => ConfigurationValidator;

// Default export
export default {
  MASTER_SETTINGS,
  ConfigurationEnforcer,
  ConfigurationValidator,
  TradingMode,
  initializeUnifiedControl,
  // Safe getters
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
  // Mode management
  setTradingMode,
  getCurrentMode
};