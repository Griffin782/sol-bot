// index.ts - SOL-BOT v5.0 with Pool Integration, Wallet Rotation & Tax Management
// MUST BE FIRST - Config Bridge Import
import * as CFG from './configBridge';
import { botController, getCurrentSessionInfo, getCurrentTradingParams, getActiveConfidenceLevel, shouldPauseTrading, logTradeResult } from './botController';
console.log('📊 Using BotController:', { session: botController.getCurrentSessionIndex() + 1, params: getCurrentTradingParams() });
import { LAMPORTS_PER_SOL, Connection, Keypair, PublicKey } from "@solana/web3.js";
import { heliusLimiter } from './utils/rateLimiter';
import WebSocket from "ws";
import Client, { SubscribeRequest, SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { ClientDuplexStream } from "@grpc/grpc-js";
import { config } from "./config";
import { validateEnv } from "./utils/env-validator";
import { WebSocketManager, ConnectionState } from "./utils/managers/websocketManager";
import { getMintFromSignature } from "./utils/handlers/signatureHandler";
import { getTokenAuthorities, getTokenCreationTime, isTokenSecureAndAllowed, TokenAuthorityStatus } from "./utils/handlers/tokenHandler";
import { buyToken } from "./utils/handlers/sniperooHandler";
import { getRugCheckConfirmed } from "./utils/handlers/rugCheckHandler";
import { createSubscribeRequest, isSubscribeUpdateTransaction, sendSubscribeRequest } from "./utils/managers/grpcManager";
import { openBrowser, playSound } from "./utils/handlers/childProcessHandler";
import { swapToken, unSwapToken } from "./utils/handlers/jupiterHandler";
import { HandledMint, NewPositionRecord } from "./types";
import { logEngine } from "./utils/managers/logManager";
import { deletePositionByWalletAndMint, deletePositionsByWallet, getPositionByMint, selectAllPositions, updatePositionTokenAmount } from "./tracker/db";
import { getWalletTokenBalances, TokenAccountInfo } from "./utils/handlers/walletTokenHandler";
import { getWalletAddress } from "./utils/handlers/walletHandler";
import { shortenAddress } from "./utils/func";
import * as fs from 'fs';
import * as path from 'path';
// Security Integration
import { checkTradingAllowed, logBuy, logSell, logFailedTrade, displaySecurityStatus, getStatusSummary, isEmergencyMode } from './security/securityIntegration';
import { 
  initializeSecurePool, 
  checkForSecureWithdrawal, 
  calculatePositionSizeInSOL,
  displaySecurePoolStatus,
  currentSecureSession,
  setTestMode  // ADD THIS 
} from './secure-pool-system';


// Force check masterConfig file exists
const masterConfigPath = path.join(__dirname, 'enhanced', 'masterConfig.ts');
console.log("🔍 Checking for masterConfig at:", masterConfigPath);
console.log("   File exists:", fs.existsSync(masterConfigPath));

// ============================================
// TAX & WALLET ROTATION CONFIGURATION
// ============================================
// Get dynamic parameters from botController
const tradingParams = getCurrentTradingParams();
const sessionInfo = getCurrentSessionInfo();

// Initialize security system
console.log('🛡️ Initializing security system...');
displaySecurityStatus();
console.log('📊', getStatusSummary());

const TAX_RATE = sessionInfo.taxReservePercent / 100; // From botController session
const FEE_RATE = tradingParams.slippageTolerance / 100; // From botController
const WALLET_ROTATION_ENABLED = true;
const WALLETS_DIR = './wallets';
const WALLET_HISTORY_FILE = './wallets/rotation_history.json';

// Hardware wallet security feature - derived from botController
const HARDWARE_WALLET_THRESHOLD = sessionInfo.targetPool * 0.8;  // 80% of target pool
const HARDWARE_WALLET_TRANSFER = sessionInfo.targetPool * 0.6;   // 60% of target pool  
const KEEP_TRADING_AMOUNT = sessionInfo.initialPool;             // Keep initial pool amount

// Trade limiting with pause - from botController
const MAX_TRADES_PER_BATCH = tradingParams.pauseAfterTrades;     // From botController
const PAUSE_DURATION_MS = 15 * 60 * 1000;                       // 15 minutes from botController fatigue management

let currentBatchTrades = 0;              // Track trades in current batch
let lastPauseTime = 0;                   // Track when last pause occurred

// Wallet Rotation State
let currentWalletIndex = 0;
let walletRotationHistory: any[] = [];
let totalLifetimeProfit = 0;

// ============================================
// STAIR-STEPPING POOL CONFIGURATION (CORRECTED)
// ============================================
interface PoolSession {
  sessionNumber: number;
  initialPool: number;
  netTarget: number;        // What you actually keep
  grossTarget: number;      // What you need to reach
  reinvestmentPercent: number;
  nextSessionPool: number;
}

const POOL_SESSIONS: PoolSession[] = [
  { 
    sessionNumber: 1, 
    initialPool: 1000,     // Start with $1,000
    netTarget: 3000,       // Keep $3,000 
    grossTarget: 4400,     // Must reach this (calculated)
    reinvestmentPercent: 0.70,  // 70% reinvested
    nextSessionPool: 2100  // $2,100 goes to next session
  },
  { 
    sessionNumber: 2, 
    initialPool: 2100,     // Start with $2,100
    netTarget: 8000,       // Keep $8,000
    grossTarget: 11200,    // Must reach this (calculated)
    reinvestmentPercent: 0.50,  // 50% reinvested
    nextSessionPool: 4000  // $4,000 goes to next session
  },
  { 
    sessionNumber: 3, 
    initialPool: 4000,     // Start with $4,000
    netTarget: 16000,      // Keep $16,000
    grossTarget: 22400,    // Must reach this (calculated)
    reinvestmentPercent: 0.50,  // 50% reinvested
    nextSessionPool: 8000  // $8,000 goes to next session
  },
  { 
    sessionNumber: 4, 
    initialPool: 8000,     // Start with $8,000
    netTarget: 80000,      // Keep $80,000
    grossTarget: 112000,   // Must reach this (calculated)
    reinvestmentPercent: 0.10,  // Only 10% reinvested (reduced risk)
    nextSessionPool: 8000  // Stays at $8,000 for repeating
  },
];

// Session management now handled by botController
let currentSession: any = getCurrentSessionInfo();

function getNextSession(): any {
  // Session management now handled by botController
  botController.advanceSession();
  return getCurrentSessionInfo();
}

function calculateGrossTarget(netTarget: number, initialPool: number, reinvestmentRate: number): number {
  // Formula: Gross = Initial + NetProfit + Taxes + NextSession + Fees
  const netProfit = netTarget - initialPool;
  const taxes = netProfit * TAX_RATE;
  const nextSession = netTarget * reinvestmentRate;
  const fees = nextSession * FEE_RATE;
  
  const grossNeeded = initialPool + netProfit + taxes + nextSession + fees;
  
  console.log(`\n📊 Target Calculation:`);
  console.log(`   Initial Pool: $${initialPool.toLocaleString()}`);
  console.log(`   Net Target (keep): $${netTarget.toLocaleString()}`);
  console.log(`   Net Profit: $${netProfit.toLocaleString()}`);
  console.log(`   Taxes (40%): $${taxes.toLocaleString()}`);
  console.log(`   Next Session (${reinvestmentRate*100}%): $${nextSession.toLocaleString()}`);
  console.log(`   Transfer Fees (5%): $${fees.toLocaleString()}`);
  console.log(`   GROSS TARGET NEEDED: $${grossNeeded.toLocaleString()}`);
  
  return grossNeeded;
}

function verifyPoolReached(currentPool: number): boolean {
  // Check if we've reached the GROSS target
  return currentPool >= currentSession.grossTarget;
}

// ============================================
// ENHANCED FEATURES - MODULAR IMPORTS
// ============================================
let TokenQueueManager: any;
let PerformanceLogger: any;
let TokenAnalyzer: any;
let masterConfig: any;

// Try to load enhanced features, but don't fail if they're not available
try {
  // Load masterConfig FIRST
  console.log("📁 Loading masterConfig from ./enhanced/masterConfig");
  const configModule = require("./enhanced/masterConfig");
  masterConfig = configModule.masterConfig || configModule.default || configModule;
  
  // Debug what we got
  console.log("✅ masterConfig loaded:", {
    hasRuntime: !!masterConfig?.runtime,
    duration: masterConfig?.runtime?.duration,
    initialPool: masterConfig?.pool?.initialPool,
    targetPool: masterConfig?.pool?.targetPool
  });
  
  // Now load other modules
  const enhancedModules = require("./enhanced/token-queue-system");
  TokenQueueManager = enhancedModules.TokenQueueManager;
  const perfModule = require("./enhanced/performanceLogger");
  PerformanceLogger = perfModule.PerformanceLogger;
  const analyzerModule = require("./enhanced/tokenAnalyzer");
  TokenAnalyzer = analyzerModule.TokenAnalyzer;
  
  console.log("✅ All enhanced features loaded successfully");
} catch (error) {
  console.log("⚠️ Enhanced features error:", error);
  console.log("Using basic config as fallback");
  masterConfig = config;
}

// ============================================
// ENVIRONMENT & CONFIGURATION
// ============================================
const env = validateEnv();
const RPC_WSS_URI = env.RPC_WSS_URI;
const GRPC_HTTP_URI = env.GRPC_HTTP_URI;
const GRPC_AUTH_TOKEN = env.GRPC_AUTH_TOKEN || "";


// ============================================
// VERIFY CONFIGURATION IS WORKING
// ============================================
console.log('🔧 Configuration Check:');
console.log('  Duration:', masterConfig.runtime.duration, 'seconds');
console.log('  Initial Pool:', masterConfig.pool.initialPool);
console.log('  Test Mode:', masterConfig.testMode);
console.log('  Bot will stop after:', masterConfig.runtime.duration, 'seconds');
console.log('============================================\n');
// Global Variables (from working version)
const DATA_STREAM_METHOD = config.data_stream.method || "wss";
const DATA_STREAM_MODE = config.data_stream.mode || "program";
const DATA_STREAM_PROGRAMS = config.data_stream.program;
const DATA_STREAM_PROGRAMS_LOG_DISCRIMINATORS = DATA_STREAM_PROGRAMS.filter((p) => p.enabled).map((p) => p.log_discriminator);
const DATA_STREAM_WALLETS = config.data_stream.wallet;
let activeTransactions = 0;
const MAX_CONCURRENT = config.concurrent_transactions;
const CHECK_MODE = config.checks.mode || "full";
const WALLET_MONITOR_INTERVAL = config.token_sell.wallet_token_balances_monitor_interval || 10000;

// Trading variables
const BUY_PROVIDER = config.token_buy.provider;
let BUY_AMOUNT = tradingParams.positionSizeSOL; // From botController, updated dynamically
const SIM_MODE = config.checks.simulation_mode || false;
const PLAY_SOUND = config.token_buy.play_sound || false;
const OPEN_BROWSER = config.token_buy.open_browser || false;
const SKIP_COPY_TRADE_SELL = config.token_sell.jupiter.skip_sell_copy_trade || true;
const WSOL_MINT = config.wsol_pc_mint;
let handledMints: { signature: string; timestamp: number }[] = [];

// Enhanced features (only if available)
let queueManager: any = null;  // Make it global
let performanceLogger: any = null;
let tokenAnalyzer: any = null;
let scanningPaused = false; 

// Determine mode
const IS_TEST_MODE = process.env.TEST_MODE === "true" || process.env.SIMULATION_MODE === "true" || SIM_MODE;

// Add this debug line temporarily to verify:
console.log("🔍 TEST_MODE Status:", IS_TEST_MODE ? "ENABLED ✅" : "DISABLED ❌");

// Statistics tracking
const stats = {
  startTime: new Date(),
  tokensDetected: 0,
  tokensBought: 0,
  tokensRejected: 0,
  poolDepleted: 0
};

// Import and initialize tax tracker
import { AdvancedBotManager } from './advanced-features';
import { masterConfig } from './enhanced/masterConfig';

const advancedManager = new AdvancedBotManager({
  runtime: { maxRuntime: CFG.BOT_DURATION },
  pool: { targetPool: CFG.TARGET_POOL }
});

// Duplicate Protection
const recentBuys = new Set<string>();
const BUY_COOLDOWN = Infinity; // Never allow re-buy

// Rate limiting  
let tradesThisMinute = 0;
let currentMinute = new Date().getMinutes();
const MAX_TRADES_PER_MINUTE = 60; // Derived from botController fatigue management (60 trades max per minute)

// ============================================
// TAX & WALLET MANAGEMENT FUNCTIONS
// ============================================
async function initializeWalletRotation(): Promise<void> {
  // Create wallets directory if it doesn't exist
  if (!fs.existsSync(WALLETS_DIR)) {
    fs.mkdirSync(WALLETS_DIR, { recursive: true });
  }
  
  // Load or create rotation history
  if (fs.existsSync(WALLET_HISTORY_FILE)) {
    try {
      const historyData = fs.readFileSync(WALLET_HISTORY_FILE, 'utf8');
      // Check if file has content before parsing
      if (historyData.trim()) {
        walletRotationHistory = JSON.parse(historyData);
        currentWalletIndex = walletRotationHistory.length;
        totalLifetimeProfit = walletRotationHistory.reduce((sum: number, w: any) => sum + (w.profitKept || 0), 0);
      } else {
        // File is empty, initialize with defaults
        walletRotationHistory = [];
        currentWalletIndex = 0;
        totalLifetimeProfit = 0;
        fs.writeFileSync(WALLET_HISTORY_FILE, '[]');
      }
    } catch (error) {
      console.log('⚠️ Wallet history file corrupted, creating new one');
      walletRotationHistory = [];
      currentWalletIndex = 0;
      totalLifetimeProfit = 0;
      fs.writeFileSync(WALLET_HISTORY_FILE, '[]');
    }
  } else {
    walletRotationHistory = [];
    currentWalletIndex = 0;
    totalLifetimeProfit = 0;
    // Create the file with empty array
    fs.writeFileSync(WALLET_HISTORY_FILE, '[]');
  }
  
  console.log(`\n🔄 Wallet Rotation System Initialized`);
  console.log(`   Current Wallet: #${currentWalletIndex + 1}`);
  console.log(`   Lifetime Profit: $${totalLifetimeProfit.toLocaleString()}`);
  console.log(`   Tax Reserve: $${(walletRotationHistory.reduce((sum: number, w: any) => sum + (w.taxReserve || 0), 0)).toLocaleString()}`);
}

// ============================================
// RESET FUNCTIONS FOR TESTING/PRODUCTION
// ============================================
async function resetForLiveTrading(): Promise<void> {
  console.log("🔄 RESETTING FOR LIVE TRADING...");
  
  // Reset session to start from beginning
  botController.resetToSession(0);
  currentSession = getCurrentSessionInfo();
  currentWalletIndex = 0;
  
  // OPTIONAL: Reset lifetime profits if you want completely fresh start
  // Uncomment the next line if you want to reset EVERYTHING:
  totalLifetimeProfit = 0;
  
  // Clear all test data files
  try {
    // Clear wallet history for fresh start
    if (fs.existsSync(WALLET_HISTORY_FILE)) {
      fs.writeFileSync(WALLET_HISTORY_FILE, '[]');
      console.log("   ✅ Wallet history cleared");
    }
    
    // Clear all withdrawals
    if (fs.existsSync('./wallets/withdrawals.jsonl')) {
      fs.unlinkSync('./wallets/withdrawals.jsonl');
      console.log("   ✅ Withdrawals log cleared");
    }
    
    // Clear pool transactions but keep header
    if (fs.existsSync('./data/pool_transactions.csv')) {
      fs.writeFileSync('./data/pool_transactions.csv', 'timestamp,type,amount,poolBefore,poolAfter,tradeNumber,notes\n');
      console.log("   ✅ Pool transactions cleared");
    }
    
    // Clear all test session summaries
    if (fs.existsSync(WALLETS_DIR)) {
      const files = fs.readdirSync(WALLETS_DIR);
      files.forEach(file => {
        if (file.startsWith('session_') || file.endsWith('_summary.txt')) {
          fs.unlinkSync(path.join(WALLETS_DIR, file));
        }
      });
      console.log("   ✅ Session summaries cleared");
    }
    
    // Clear all test trading logs
    const dataFiles = ['pending_tokens.csv', 'trading_log.json', '5x_events.jsonl', 'performance_log.csv'];
    dataFiles.forEach(file => {
      const filePath = `./data/${file}`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`   ✅ ${file} cleared`);
      }
    });
    
    // Reset in-memory statistics
    stats.tokensDetected = 0;
    stats.tokensBought = 0;
    stats.tokensRejected = 0;
    stats.poolDepleted = 0;
    stats.startTime = new Date();
    
    console.log("\n✅ RESET COMPLETE - READY FOR LIVE TRADING!");
    console.log("   Starting with Session 1");
    console.log("   Initial Pool: $600");
    console.log("   First Target: $6,000 net ($10,680 gross)");
    console.log(`   Mode: ${IS_TEST_MODE ? 'TEST' : 'LIVE'} TRADING\n`);
    
  } catch (error) {
    console.error("❌ Error during reset:", error);
  }
}

// For keeping lifetime stats but resetting current session
async function resetCurrentSessionOnly(): Promise<void> {
  console.log("🔄 RESETTING CURRENT SESSION (keeping lifetime stats)...");
  
  // Reset ONLY current session, keep lifetime profit
  botController.resetToSession(0);
  currentSession = getCurrentSessionInfo();
  
  // Keep totalLifetimeProfit and walletRotationHistory intact!
  console.log(`   📊 Keeping Lifetime NET Profit: $${totalLifetimeProfit.toLocaleString()}`);
  console.log(`   📊 Keeping ${walletRotationHistory.length} previous sessions in history`);
  console.log(`   🔄 Resetting to Session 1 for new run`);
  console.log(`   💰 Starting with: $600 → $6,000 target\n`);
}

// ============================================
// WALLET ROTATION FUNCTION (existing)
// ============================================
async function rotateWallet(poolManager: any): Promise<boolean> {
  if (!WALLET_ROTATION_ENABLED) return false;
  
  try {
    const currentPool = poolManager.currentPool || 0;
    const sessionInfo = getCurrentSessionInfo();
    const profitDistribution = botController.calculateProfitDistribution(sessionInfo.profitRequired);
    const taxesOwed = profitDistribution.taxReserve;
    const nextSessionTransfer = sessionInfo.nextSessionPool;
    const transferFees = nextSessionTransfer * FEE_RATE;
    const actualNetKept = profitDistribution.withdrawn;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 WALLET ROTATION - SESSION ${sessionInfo.sessionNumber} COMPLETE`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📊 Session Results:`);
    console.log(`   Initial Pool: $${sessionInfo.initialPool.toLocaleString()}`);
    console.log(`   Gross Reached: $${currentPool.toLocaleString()}`);
    console.log(`   Target Pool: $${sessionInfo.targetPool.toLocaleString()} ✅`);
    
    console.log(`\n💰 Fund Breakdown:`);
    console.log(`   Gross Pool: $${currentPool.toLocaleString()}`);
    console.log(`   - Initial: $${sessionInfo.initialPool.toLocaleString()}`);
    console.log(`   - Taxes (${sessionInfo.taxReservePercent}%): $${taxesOwed.toLocaleString()}`);
    console.log(`   - Next Session: $${nextSessionTransfer.toLocaleString()}`);
    console.log(`   - Transfer Fees: $${transferFees.toLocaleString()}`);
    console.log(`   = NET KEPT: $${actualNetKept.toLocaleString()} ✅`);
    
    // Verify we're keeping the right amount
    const targetNetProfit = sessionInfo.profitRequired;
    if (Math.abs(actualNetKept - targetNetProfit) > 100) {
      console.log(`\n⚠️ WARNING: Net kept ($${actualNetKept.toFixed(0)}) differs from target ($${targetNetProfit})`);
    }
    
    // Record current wallet history
    const walletRecord = {
      sessionNumber: sessionInfo.sessionNumber,
      walletIndex: currentWalletIndex,
      startTime: stats.startTime,
      endTime: new Date(),
      initialPool: sessionInfo.initialPool,
      targetPool: sessionInfo.targetPool,
      finalPool: currentPool,
      profitRequired: sessionInfo.profitRequired,
      taxReserve: taxesOwed,
      nextSessionPool: nextSessionTransfer,
      profitKept: actualNetKept,
      trades: poolManager.metrics?.totalTrades || 0,
      winRate: poolManager.metrics?.winRate || 0
    };
    
    walletRotationHistory.push(walletRecord);
    totalLifetimeProfit += actualNetKept;  // Track NET profit, not gross
    fs.writeFileSync(WALLET_HISTORY_FILE, JSON.stringify(walletRotationHistory, null, 2));
    
    // Get next session configuration
    const nextSession = getNextSession();
    currentSession = nextSession;
    
    console.log(`\n🎯 NEXT SESSION ${nextSession.sessionNumber} CONFIGURATION:`);
    console.log(`   Initial Pool: $${nextSession.initialPool.toLocaleString()}`);
    console.log(`   Net Target: $${nextSession.netTarget.toLocaleString()} (what you keep)`);
    console.log(`   Gross Target: $${nextSession.grossTarget.toLocaleString()} (must reach)`);
    console.log(`   Growth Needed: ${(nextSession.grossTarget / nextSession.initialPool).toFixed(1)}x`);
    console.log(`   Reinvestment: ${(nextSession.reinvestmentPercent * 100).toFixed(0)}%`);
    
    // Generate new wallet (in test mode, just simulate)
    if (!IS_TEST_MODE) {
      // TODO: Implement actual wallet creation and fund transfer
      // const newWallet = Keypair.generate();
      // const newWalletPath = path.join(WALLETS_DIR, `wallet_${currentWalletIndex + 1}.json`);
      // fs.writeFileSync(newWalletPath, JSON.stringify(Array.from(newWallet.secretKey)));
      // Transfer nextSessionTransfer amount to new wallet
    }
    
    // Update wallet index
    currentWalletIndex++;
    
    // Reset pool manager for new session
    poolManager.currentPool = nextSession.initialPool;
    poolManager.initialPool = nextSession.initialPool;
    poolManager.totalPnL = 0;
    poolManager.target = nextSession.grossTarget;  // Use GROSS target
    poolManager.metrics = {
      totalTrades: 0,
      profitableTrades: 0,
      totalProfit: 0,
      totalLoss: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0
    };
    
    // Update masterConfig for new session
    masterConfig.pool.initialPool = nextSession.initialPool;
    masterConfig.pool.targetPool = nextSession.grossTarget;  // Use GROSS target
    
    console.log(`\n✅ Wallet Rotation Complete - Starting Session ${nextSession.sessionNumber}`);
    console.log(`   New Wallet: #${currentWalletIndex + 1}`);
    console.log(`   Lifetime NET Profit: $${totalLifetimeProfit.toLocaleString()}`);
    console.log(`   Total Tax Reserve: $${(walletRotationHistory.reduce((sum: number, w: any) => sum + (w.taxReserve || 0), 0)).toLocaleString()}`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Save session summary
    const summaryPath = path.join(WALLETS_DIR, `session_${walletRecord.sessionNumber}_summary.txt`);
    const summary = `
SESSION ${walletRecord.sessionNumber} TRADING SUMMARY
=====================================
Wallet #${walletRecord.walletIndex + 1}
Start: ${walletRecord.startTime}
End: ${walletRecord.endTime}

TARGETS:
Initial Pool: $${walletRecord.initialPool.toLocaleString()}
Target Pool: $${walletRecord.targetPool.toLocaleString()}
Profit Required: $${walletRecord.profitRequired.toLocaleString()}

RESULTS:
Final Pool: $${walletRecord.finalPool.toLocaleString()}
Profit Required: $${walletRecord.profitRequired.toLocaleString()}
Growth Achieved: ${(walletRecord.finalPool / walletRecord.initialPool).toFixed(2)}x

ALLOCATIONS:
Tax Reserve: $${walletRecord.taxReserve.toLocaleString()}
Next Session: $${walletRecord.nextSessionPool.toLocaleString()}
NET KEPT: $${walletRecord.profitKept.toLocaleString()}

PERFORMANCE:
Total Trades: ${walletRecord.trades}
Win Rate: ${walletRecord.winRate.toFixed(1)}%
=====================================
    `;
    fs.writeFileSync(summaryPath, summary);
    
    return true;
  } catch (error) {
    console.error(`❌ Wallet rotation failed:`, error);
    return false;
  }
}

// ============================================
// HELPER FUNCTIONS (from working version)
// ============================================
function getCurrentTime(): string {
  const now = new Date();
  return now.toTimeString().split(" ")[0];
}

// ============================================
// ENHANCED FEATURE INITIALIZATION
// ============================================
async function initializeEnhancements(): Promise<void> {
  if (!TokenQueueManager) {
    console.log("⚠️ Enhanced features not available");
    return;
  }
  
  try {
    console.log("🚀 Initializing enhanced features...");
    
    const connection = new Connection(
      masterConfig?.network?.rpcEndpoints?.[0] || config.network?.rpcEndpoints?.[0] || RPC_WSS_URI.replace('wss', 'https'),
      'confirmed'
    );
    
    // Use current session configuration
    const initialPool = currentSession.initialPool;
    const targetPool = currentSession.grossTarget;  // Use GROSS target
    const positionSize = masterConfig?.pool?.positionSize || config.pool?.positionSize || 0.089;
    
    queueManager = new TokenQueueManager(
      masterConfig?.network?.rpcEndpoints?.[0] || RPC_WSS_URI.replace('wss', 'https'),
      './data/pending_tokens.csv',
      initialPool,
      {
        positionSize: positionSize,
        positionSizeUSD: positionSize * 170,
        maxPositions: masterConfig?.pool?.maxPositions || 10,
        stopLoss: masterConfig?.exit?.stopLoss || -80,
        takeProfit: [
          masterConfig?.exit?.takeProfit1 || 100,
          masterConfig?.exit?.takeProfit2 || 300,
          masterConfig?.exit?.takeProfit3 || 500
        ],
        targetPool: targetPool, // Use session gross target
        sessionNumber: currentSession.sessionNumber,
        compoundProfits: true,
        testMode: IS_TEST_MODE,
        exit: masterConfig?.exit
      }
    );
    
    // Initialize performance tracking if available
    if (PerformanceLogger) {
      performanceLogger = new PerformanceLogger(connection);
    }
    if (TokenAnalyzer && performanceLogger) {
      tokenAnalyzer = new TokenAnalyzer(performanceLogger);
    }
    
    console.log("✅ Enhanced features initialized");
    console.log(`📊 SESSION ${currentSession.sessionNumber} CONFIGURATION:`);
    console.log(`💰 Initial Pool: $${initialPool.toLocaleString()}`);
    console.log(`🎯 Net Target: $${currentSession.netTarget.toLocaleString()} (what you keep)`);
    console.log(`📈 Gross Target: $${targetPool.toLocaleString()} (must reach)`);
    console.log(`📊 Position Size: ${positionSize} SOL ($${(positionSize * 170).toFixed(2)})`);
    
    // Start 5x+ monitoring if available
    if (tokenAnalyzer) {
      monitor5xOpportunities();
    }
    
  } catch (error) {
    console.log("⚠️ Enhanced features initialization failed:", error);
    console.log("Continuing with basic features only");
  }
}

// ============================================
// 5x+ MONITORING (if available)
// ============================================
async function monitor5xOpportunities(): Promise<void> {
  if (!queueManager || !tokenAnalyzer) return;
  
  setInterval(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      const positions = queueManager.getActivePositions?.() || [];
      
      positions.forEach((position: any) => {
        const decision = tokenAnalyzer.analyzeToken(
          position.tokenMint,
          position.currentPrice,
          position.volume || 0,
          position.holdTime,
          position.currentGain
        );
        
        if (decision.confidence > (CFG.ENABLE_5X_DETECTION ? 0.7 : 0.9) && decision.shouldHold) {
          console.log(`💎 5x+ Signal: Extending hold for ${position.tokenMint.slice(0,8)}...`);
          queueManager.extendHold?.(position.tokenMint, decision.extendMinutes);
        }
      });
    } catch (error) {
      // Silently fail if methods don't exist
    }
  }, 30000);
}

// ============================================
// POSITION VERIFICATION (from working version)
// ============================================
async function verifyPositions(): Promise<boolean> {
  console.log('⏳ Rate limiting: 2 second delay added');
  try {
    const walletAddress: string | null = "6L2kWgLnHZ55Fq4w2k1Gv14ja8JFtKiDGh6HWzhdUbzc";
    console.log('Using hardcoded wallet:', walletAddress);
    if (!walletAddress) {
      const currentTime = getCurrentTime();
      console.log('DEBUG: Checking wallet...');
      console.log('PRIVATE_KEY exists:', !!process.env.PRIVATE_KEY);
      console.log('WALLET_ADDRESS:', process.env.WALLET_ADDRESS);
      console.log('Provider:', BUY_PROVIDER);
      logEngine.writeLog(`${currentTime}`, `Invalid or missing wallet address while using ${BUY_PROVIDER} as provider.`, "red");
      
      if (IS_TEST_MODE) {
        logEngine.writeLog(`${currentTime}`, `TEST MODE - Continuing without wallet`, "yellow");
        return true;

      }
      
      logEngine.writeLog(`${currentTime}`, `Press ESC to close this application ...`, "red");
      return false;
    }

    const tokenBalances: TokenAccountInfo[] = await getWalletTokenBalances(walletAddress);
    if (tokenBalances.length === 0) {
      const currentTime = getCurrentTime();
      const deleteConfirmation = await deletePositionsByWallet(walletAddress);
      if (deleteConfirmation) {
        logEngine.writeLog(`📜 Database`, `No tokens in wallet! Removed all positions`, "yellow");
        logEngine.writeLog(`🔎 ${currentTime}`, `Looking for tokens...`, "white");
        return true;
      }
      logEngine.writeLog(`${currentTime}`, `Cannot remove tracked positions. Manually remove database.`, "red");
      logEngine.writeLog(`${currentTime}`, `Press ESC to close this application ...`, "red");
      return false;
    }

    const storedPositions: NewPositionRecord[] = await selectAllPositions();
    if (storedPositions.length === 0) {
      return true;
    }

    for (const position of storedPositions) {
      const matchingToken = tokenBalances.find((balance) => balance.mint === position.mint);

      if (!matchingToken || Number(matchingToken.amount) === 0) {
        await deletePositionByWalletAndMint(walletAddress, position.mint);
        logEngine.writeLog(`📜 Database`, `Token ${shortenAddress(position.mint)} no longer found in wallet. Removed from database`, "yellow");
      } else {
        const currentDecimal = matchingToken.decimals;
        let initialTokens = position.init_tokens;
        const currentTokens = Number(matchingToken.amount);

        if (initialTokens !== currentTokens) {
          const factor = 10 ** currentDecimal;
          if (initialTokens % 1 !== 0) {
            initialTokens = Math.round(initialTokens * factor);
          }
          const storedSol = position.init_sol;
          const pricePerToken = storedSol / initialTokens;
          const newSolMount = pricePerToken * currentTokens;

          await updatePositionTokenAmount(walletAddress, position.mint, currentTokens, newSolMount, BUY_PROVIDER);
          logEngine.writeLog(`📜 Database`, `Token ${shortenAddress(position.mint)} amount updated successfully to: ${currentTokens}`, "yellow");
          logEngine.writeLog(
            `${getCurrentTime()}`,
            `Note: SOL amount update to: ${(newSolMount / LAMPORTS_PER_SOL).toFixed(3)} SOL (Avg. Buy-in price).`,
            "yellow"
          );
        } else {
          logEngine.writeLog(`🟢 ${getCurrentTime()}`, `Token ${shortenAddress(position.mint)} verified successfully`, "green");
        }
      }
    }

    return true;
  } catch (err) {
    if (IS_TEST_MODE) {
      logEngine.writeLog(`${getCurrentTime()}`, `TEST MODE - Skipping verification: ${err}`, "yellow");
      return true;
    }
    logEngine.writeLog(`${getCurrentTime()}`, `Verification issue: ${err}`, "red");
    return false;
  }
}

// ============================================
// POSITION MONITORING (from working version)
// ============================================
async function monitorPositions(): Promise<void> {
  if (activeTransactions === 0) {
    const positions: NewPositionRecord[] = await selectAllPositions();
    if (positions.length !== 0) {
      logEngine.writeLog(`✅ Verifying`, `Checking token balances for outside changes...`, "white");
      verifyPositions();

      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      console.log('⏳ Rate limiting: 2 second delay added');
    }
  }
  setTimeout(monitorPositions, WALLET_MONITOR_INTERVAL);
}

// ============================================
// WEBSOCKET LISTENER (from working version - COMPLETE)
// ============================================
async function startWebSocketListener(): Promise<void> {
  logEngine.writeLog(`✅ Starting Sniper via Websocket`, ``, "white", true);
  logEngine.writeLog(`🟡 Config`, `Transactions provider is set to: ${BUY_PROVIDER}`, "yellow");

  const wsManager = new WebSocketManager({
    url: RPC_WSS_URI,
    initialBackoff: 1000,
    maxBackoff: 30000,
    maxRetries: Infinity,
    debug: true,    
  });

  // ADD ERROR RECOVERY:
  wsManager.on("close", () => {
    console.log("❌ WebSocket closed - attempting reconnect...");
    setTimeout(() => {
      wsManager.connect();
    }, 5000);
  });

  wsManager.on("open", () => {
    if (DATA_STREAM_MODE === "program" && DATA_STREAM_PROGRAMS.length > 0) {
      DATA_STREAM_PROGRAMS.filter((pool) => pool.enabled).forEach((pool) => {
        const subscriptionMessage = {
          jsonrpc: "2.0",
          id: pool.key,
          method: "logsSubscribe",
          params: [
            {
              mentions: [pool.key],
            },
            {
              commitment: "processed",
            },
          ],
        };
        wsManager.send(JSON.stringify(subscriptionMessage));
      });
    }
  });

  wsManager.on("message", async (data: WebSocket.Data) => {
    try {
      // CHECK IF SCANNING IS PAUSED
      if (scanningPaused) {
        // Check pool every 10 seconds
        if (Date.now() % 10000 < 100) {
          const poolStatus = queueManager?.getPoolManager?.()?.getPoolSummary?.();
          if (poolStatus?.canTrade) {
            scanningPaused = false;
            console.log('💚 Pool replenished! Resuming scanning...');
          } else {
            return;  // Skip processing, save credits
          }
        } else {
          return;  // Skip while paused
        }
      }
    
      const messageStr = data.toString();
      const messageObj = JSON.parse(messageStr);
      
      if (messageObj.method === "logsNotification") {
        const logs = messageObj.params?.result?.value?.logs;
        
        if (logs && logs.length > 0) {
          for (const log of logs) {
            if (log.includes("initialize") || log.includes("InitializeAccount") || 
                log.includes("MintTo") || log.includes("swap")) {
              
              const signature = messageObj.params?.result?.value?.signature;
              
              if (signature) {
                const existingMint = handledMints.find(m => m.signature === signature);
                if (existingMint) {
                  return;
                }
                
                handledMints.push({
                  signature,
                  timestamp: Date.now()
                });
                
                const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
                handledMints = handledMints.filter(m => m.timestamp > fiveMinutesAgo);
                
                console.log('DEBUG - Signature type:', typeof signature);
                console.log('DEBUG - Signature value:', JSON.stringify(signature).slice(0, 200));

                const mint = await getMintFromSignature(signature, false);

                console.log('DEBUG - Mint type:', typeof mint);
                console.log('DEBUG - Mint value:', mint);

                const mintStr = typeof mint === 'string' 
                  ? mint 
                  : (mint?.tokenMint || mint?.toString() || '');
                  
                if (mintStr) {
                  stats.tokensDetected++;
                  
                  // RATE LIMITING
                  const now = new Date().getMinutes();
                  if (now !== currentMinute) {
                    tradesThisMinute = 0;
                    currentMinute = now;
                  }
                  
                  if (tradesThisMinute >= MAX_TRADES_PER_MINUTE) {
                    logEngine.writeLog(`${getCurrentTime()}`, `⏸️ Rate limit: Skipping token (${tradesThisMinute} trades this minute)`, "yellow");
                    stats.tokensRejected++;
                    return;
                  }
                  tradesThisMinute++;
                  
                  logEngine.writeLog(`${getCurrentTime()}`, `New token detected: ${mintStr.slice(0, 8)}... (#${stats.tokensDetected})`, "yellow");
                  
                  activeTransactions++;
                  
                  // Connect to trading system
                  if (queueManager) {
                    try {
                      const result = await queueManager.onNewTokenDetected(signature, mintStr);
                      
                      // Log the result
                      if (result.status === 'profit') {
                        stats.tokensBought++;
                        console.log(`✅ TRADE PROFIT: ${result.tokenSymbol || mintStr.slice(0,8)} | +$${(result.exitPrice - result.entryPrice).toFixed(2)}`);
                      } else if (result.status === 'loss') {
                        stats.tokensBought++;
                        console.log(`❌ TRADE LOSS: ${result.tokenSymbol || mintStr.slice(0,8)} | -$${(result.entryPrice - result.exitPrice).toFixed(2)}`);
                      } else if (result.status === 'rejected') {
                        stats.tokensRejected++;
                        console.log(`🚫 Token rejected: ${mintStr.slice(0,8)}`);
                      } else if (result.status === 'pool_depleted') {
                        stats.poolDepleted++;
                        console.log(`💸 Pool depleted, PAUSING SCANNER to save credits`);
                        scanningPaused = true;
                      }
                    } catch (error) {
                      console.error(`Error processing token:`, error);
                    }
                  } else {
                    console.warn('⚠️ Queue manager not initialized yet');
                  }
                  
                  activeTransactions--;
                  
                  // Perform checks based on mode
                  if (CHECK_MODE === "full") {
                    logEngine.writeLog(`${getCurrentTime()}`, `Performing full security checks...`, "white");
                    
                    const authorities = await getTokenAuthorities(mintStr);
                    if (!authorities.hasFreezeAuthority && !authorities.hasMintAuthority) {
                      logEngine.writeLog(`${getCurrentTime()}`, `✅ Token authorities renounced`, "green");
                    } else {
                      logEngine.writeLog(`${getCurrentTime()}`, `❌ Token has active authorities, skipping...`, "red");
                      stats.tokensRejected++;
                      activeTransactions--;
                      return;
                    }
                    
                    const creationTime = await getTokenCreationTime(mintStr);
                    const ageInMinutes = typeof creationTime === 'number' ? (Date.now() - creationTime) / 60000 : 0;
                    
                    if (config.entry?.maxAge && ageInMinutes > config.entry.maxAge) {
                      logEngine.writeLog(`${getCurrentTime()}`, `❌ Token too old (${ageInMinutes.toFixed(1)} min), skipping...`, "red");
                      stats.tokensRejected++;
                      activeTransactions--;
                      return;
                    }
                    
                    const isSecure = await isTokenSecureAndAllowed(mintStr);
                    if (!isSecure) {
                      logEngine.writeLog(`${getCurrentTime()}`, `❌ Token failed security checks, skipping...`, "red");
                      stats.tokensRejected++;
                      activeTransactions--;
                      return;
                    }
                    
                    if ((config.checks as any).rug_check) {
                      const rugCheckPassed = await getRugCheckConfirmed(mintStr, logEngine);
                      if (!rugCheckPassed) {
                        logEngine.writeLog(`${getCurrentTime()}`, `❌ Token failed rug check, skipping...`, "red");
                        stats.tokensRejected++;
                        activeTransactions--;
                        return;
                      }
                    }
                    
                    logEngine.writeLog(`${getCurrentTime()}`, `✅ All checks passed, processing purchase...`, "green");
                  } else if (CHECK_MODE === "quick") {
                    logEngine.writeLog(`${getCurrentTime()}`, `Quick mode - minimal checks`, "yellow");
                    
                    const isSecure = await isTokenSecureAndAllowed(mintStr);
                    if (!isSecure) {
                      logEngine.writeLog(`${getCurrentTime()}`, `❌ Token failed basic checks, skipping...`, "red");
                      stats.tokensRejected++;
                      activeTransactions--;
                      return;
                    }
                  } else {
                    logEngine.writeLog(`${getCurrentTime()}`, `⚠️ YOLO mode - no checks performed!`, "yellow");
                  }
                  
                  await processPurchase(mintStr);
                  
                  activeTransactions--;
                }
              }
            }
          }        }
      }
      
      // THIS MUST BE INSIDE THE TRY:
      if (messageObj.result && typeof messageObj.result === "number") {
        logEngine.writeLog(`${getCurrentTime()}`, `Subscription confirmed: ${messageObj.result}`, "green");
      }
      
    } catch (error) {
      if (error instanceof Error && !error.message.includes("JSON")) {
        logEngine.writeLog(`${getCurrentTime()}`, `WebSocket error: ${error.message}`, "red");
      }
    }
  });

  wsManager.on("error", (error: Error) => {
    logEngine.writeLog(`${getCurrentTime()}`, `WebSocket error: ${error.message}`, "red");
  });

  wsManager.connect();
}

// ============================================
// GRPC LISTENER (from working version)
// ============================================
async function startGrpcListener(): Promise<void> {
  logEngine.writeLog(`✅ Starting Sniper via gRPC...`, ``, "white", true);
  logEngine.writeLog(`🟡 Config`, `Transactions provider is set to: ${BUY_PROVIDER}`, "yellow");

  const gClient = new Client(GRPC_HTTP_URI, GRPC_AUTH_TOKEN, { skipPreflight: true });
  const gStream = await gClient.subscribe();
  const request = createSubscribeRequest(DATA_STREAM_PROGRAMS, DATA_STREAM_WALLETS, DATA_STREAM_MODE);

  try {
    await sendSubscribeRequest(gStream, request);
    logEngine.writeLog(`${getCurrentTime()}`, `Geyser connection and subscription established`, "green");
  } catch (error) {
    logEngine.writeLog(`${getCurrentTime()}`, `Error in subscription process: ${error}`, "red");
    gStream.end();
  }
}

// ============================================
// PURCHASE PROCESSING (with optional pool)
// ============================================
async function processPurchase(returnedMint: string): Promise<void> {
  if (!returnedMint) return;

  // Update BUY_AMOUNT dynamically
  BUY_AMOUNT = calculatePositionSizeInSOL();

  console.log(`🔍 Checking token: ${returnedMint.slice(0,8)}... | Already bought: ${recentBuys.has(returnedMint)}`);

// DUPLICATE PROTECTION - PERMANENT BLOCKING
if (recentBuys.has(returnedMint)) {
  logEngine.writeLog(`${getCurrentTime()}`, `⚠️ DUPLICATE BLOCKED: Already bought ${returnedMint.slice(0, 8)}...`, "yellow");
  stats.tokensRejected++;
  activeTransactions--;  // ADD THIS - decrement counter
  return;
}

// Also check in queue manager if exists
if (queueManager && queueManager.hasTokenInQueue?.(returnedMint)) {
  logEngine.writeLog(`${getCurrentTime()}`, `⚠️ DUPLICATE: Token already in queue`, "yellow");
  stats.tokensRejected++;
  activeTransactions--;  // ADD THIS
  return;
}
  
  // Check pool availability if enhanced features are enabled
  if (queueManager) {
    try {
      const poolManager = queueManager.getPoolManager?.();
      if (poolManager && !poolManager.canExecuteTrade?.()) {
        logEngine.writeLog(`${getCurrentTime()}`, `Pool depleted, skipping trade`, "yellow");
        stats.poolDepleted++;
        return;
      }
    } catch (error) {
      // Enhanced features not working properly, continue anyway
    }
  }
  
  logEngine.writeLog(`${getCurrentTime()}`, `Token CA extracted successfully`, "green");
  logEngine.writeLog(`${getCurrentTime()}`, `https://gmgn.ai/sol/token/${returnedMint}`, "white");
  
  if (IS_TEST_MODE) {
    logEngine.writeLog(`${getCurrentTime()}`, `🧪 TEST MODE - Simulating token purchase`, "yellow");
    
    // Mark as bought PERMANENTLY
    recentBuys.add(returnedMint);
    console.log(`🔒 Token ${returnedMint.slice(0,8)} permanently blocked from re-buy`);

    // ADD THESE 5 LINES HERE (lines 1020-1024)
    console.log(`\n${'='.repeat(50)}`);
    console.log(`💰 TRADE EXECUTED (TEST MODE)`);
    console.log(`   Token: ${returnedMint.slice(0,8)}...`);
    console.log(`   Position: ${BUY_AMOUNT} SOL ($${(BUY_AMOUNT * 170).toFixed(2)})`);
    console.log(`${'='.repeat(50)}\n`);

    // Track batch trades and apply pause limit
    currentBatchTrades++;
    console.log(`📊 Batch Progress: ${currentBatchTrades}/${MAX_TRADES_PER_BATCH} trades`);

    // Check if we need to pause after 25 trades
    if (currentBatchTrades >= MAX_TRADES_PER_BATCH) {
      console.log(`\n⏸️  TRADE LIMIT REACHED (${MAX_TRADES_PER_BATCH} trades)`);
      console.log(`   Pausing for 1 minute to prevent overtrading...`);
      
      lastPauseTime = Date.now();
      currentBatchTrades = 0;  // Reset counter
      
      await new Promise(resolve => setTimeout(resolve, PAUSE_DURATION_MS));
      
      console.log(`✅ Pause complete - resuming trading\n`);
    }

    // Initialize and update pool for test trades
    if (queueManager) {
      try {
        const poolManager = queueManager.getPoolManager?.();
        if (poolManager) {
          // Initialize if needed
          if (!poolManager.currentPool) {
            poolManager.currentPool = currentSession.initialPool;
            poolManager.initialPool = poolManager.currentPool;
            poolManager.totalPnL = 0;
            poolManager.metrics = {
              totalTrades: 0,
              profitableTrades: 0,
              totalProfit: 0,
              totalLoss: 0,
              winRate: 0,
              avgWin: 0,
              avgLoss: 0
            };
          }
          
          // Simulate a trade with random outcome
          const profitPercent = (Math.random() * 200) - 50; // -50% to +150%
          const tradeAmount = CFG.POSITION_SIZE * 170; // Position size in USD (SOL price ~$170); // Position size in USD
          const profit = (tradeAmount * profitPercent) / 100;
          
          // Update pool
          poolManager.currentPool += profit;
          poolManager.totalPnL = poolManager.currentPool - poolManager.initialPool;
          
          // Update metrics
          poolManager.metrics.totalTrades++;
          if (profit > 0) {
            poolManager.metrics.profitableTrades++;
            poolManager.metrics.totalProfit += profit;
          } else {
            poolManager.metrics.totalLoss += Math.abs(profit);
          }
          poolManager.metrics.winRate = (poolManager.metrics.profitableTrades / poolManager.metrics.totalTrades) * 100;
          
          // Log result
          logEngine.writeLog(`${getCurrentTime()}`, 
            `📊 Trade Result: ${profit > 0 ? '🟢 +' : '🔴 '}$${Math.abs(profit).toFixed(2)} | Pool: $${poolManager.currentPool.toFixed(2)}`, 
            profit > 0 ? "green" : "red"
          );
          
          // Check for security withdrawal first
          const withdrawalMade = await checkForSecureWithdrawal(poolManager);
          
          // Only check wallet rotation if no withdrawal was made
          if (!withdrawalMade && verifyPoolReached(poolManager.currentPool)) {
            console.log(`\n🎯 TARGET REACHED! Pool: $${poolManager.currentPool.toFixed(2)} >= Target: $${currentSession.grossTarget.toFixed(2)}`);
            await rotateWallet(poolManager);
          }
        }
      } catch (error) {
        logEngine.writeLog(`${getCurrentTime()}`, `⚠️ Pool tracking error: ${error}`, "yellow");
      }
    }
    
    const tokenStr = typeof returnedMint === 'string' ? returnedMint : String(returnedMint);
    logEngine.writeLog(`${getCurrentTime()}`, `Token: ${tokenStr.slice(0, 8)}...`, "white");
    logEngine.writeLog(`${getCurrentTime()}`, `Amount: ${BUY_AMOUNT} SOL`, "white");
    stats.tokensBought++;
    
    if (OPEN_BROWSER) openBrowser("https://gmgn.ai/sol/token/" + returnedMint);
    if (PLAY_SOUND) playSound("New Token!");
    return;
  }
  
  // Live trading execution
  let result = false;
  if (BUY_PROVIDER === "sniperoo") {
    logEngine.writeLog(`${getCurrentTime()}`, `Sniping Token using Sniperoo...`, "green");
    result = await buyToken(returnedMint, BUY_AMOUNT, logEngine);
  } else if (BUY_PROVIDER === "jupiter") {
    logEngine.writeLog(`${getCurrentTime()}`, `Sniping Token using Jupiter Swap API...`, "green");
    result = await swapToken(WSOL_MINT, returnedMint, BUY_AMOUNT, logEngine);
  }
  
  // Update pool and tracking if successful
  if (result) {
    stats.tokensBought++;

    // Track batch trades and apply pause limit (LIVE MODE)
    currentBatchTrades++;
    console.log(`📊 Batch Progress: ${currentBatchTrades}/${MAX_TRADES_PER_BATCH} trades`);

    // Check if we need to pause after 25 trades
    if (currentBatchTrades >= MAX_TRADES_PER_BATCH) {
      console.log(`\n⏸️  TRADE LIMIT REACHED (${MAX_TRADES_PER_BATCH} trades)`);
      console.log(`   Pausing for 1 minute to prevent overtrading...`);
      
      lastPauseTime = Date.now();
      currentBatchTrades = 0;  // Reset counter
      
      await new Promise(resolve => setTimeout(resolve, PAUSE_DURATION_MS));
      
      console.log(`✅ Pause complete - resuming trading\n`);
    }

    // ⬇️ ADD THE PERMANENT BLOCKING HERE ⬇️
    // Mark as recently bought to prevent duplicates
    recentBuys.add(returnedMint);
    /// NO setTimeout - keep it blocked forever!
    logEngine.writeLog(`${getCurrentTime()}`, `🔒 Token ${returnedMint.slice(0,8)} PERMANENTLY blocked from re-buy`, "red");
    console.log(`🚫 Duplicate protection: ${returnedMint} will NEVER be bought again`);

         
    // Feed to queue manager if available
// Feed to queue manager if available
if (queueManager) {
  try {
    const signature = `tx_${Date.now()}`;
    const result = await queueManager.onNewTokenDetected(signature, returnedMint);
    
    // NOW use the REAL data from queueManager for taxes
    if (result.status === 'profit' || result.status === 'loss') {
      // Record the BUY transaction
      try {
        // Tax tracking (if available)
        console.log(`📊 Recording tax transaction for ${returnedMint.slice(0,8)}...`);
      } catch (error) {
        // Tax tracking failed, continue anyway
      }
      
      // If it's already completed (profit/loss), also record the SELL
      if (result.exitPrice) {
        try {
          // Tax tracking (if available)  
          console.log(`📊 Recording tax transaction for ${returnedMint.slice(0,8)}...`);
        } catch (error) {
          // Tax tracking failed, continue anyway
        }
      }
    }
  } catch (error) {
    // Enhanced features failed, but trade succeeded
  }
}
    
    // Start 5x+ tracking if available
    if (performanceLogger) {
      try {
        const entryPrice = 0.001; // TODO: Get from actual position tracking
        performanceLogger.startTracking(returnedMint, 'TOKEN', entryPrice);
        console.log(`📊 Started 5x+ tracking for ${returnedMint.slice(0, 8)}...`);
      } catch (error) {
        // Performance tracking failed, continue anyway
      }
    }
  } else {
    stats.tokensRejected++;
  }
  
  return;
}

// ============================================
// STATUS REPORTING
// ============================================
function printStatus(): void {
  const runtime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
  const hours = Math.floor(runtime / 3600);
  const minutes = Math.floor((runtime % 3600) / 60);
  const seconds = runtime % 60;
  const tokensPerHour = stats.tokensDetected > 0 ? (stats.tokensDetected / (runtime / 3600)).toFixed(1) : "0";
  
  console.clear();
  console.log(`\n${"=".repeat(50)}`);
  console.log(`📊 BOT STATUS (Runtime: ${hours}h ${minutes}m ${seconds}s)`);
  console.log(`${"=".repeat(50)}`);
  console.log(`🎯 Tokens Detected: ${stats.tokensDetected}`);
  console.log(`✅ Tokens Bought: ${stats.tokensBought}`);
  console.log(`❌ Tokens Rejected: ${stats.tokensRejected}`);
  console.log(`⛔ Pool Depleted Skips: ${stats.poolDepleted}`);
  console.log(`📈 Detection Rate: ${tokensPerHour}/hour`);
  
  // Show pool status if available
  if (queueManager) {
    try {
      const poolManager = queueManager.getPoolManager?.();
      if (poolManager) {
        // Initialize pool values if not set
        if (!poolManager.currentPool) {
          poolManager.currentPool = currentSession.initialPool;
        }
        if (!poolManager.totalPnL) {
          poolManager.totalPnL = 0;
        }
        if (!poolManager.metrics) {
          poolManager.metrics = {
            totalTrades: 0,
            profitableTrades: 0,
            totalProfit: 0,
            totalLoss: 0,
            winRate: 0,
            avgWin: 0,
            avgLoss: 0
          };
        }
        
        // Display pool summary
        const currentPool = poolManager.currentPool || currentSession.initialPool;
        const pnl = poolManager.totalPnL || 0;
        const progress = ((currentPool / currentSession.grossTarget) * 100).toFixed(1);
        
        console.log(`\n💰 POOL STATUS (Session ${currentSession.sessionNumber}):`);
        console.log(`   Initial: $${currentSession.initialPool.toLocaleString()}`);
        console.log(`   Current: $${currentPool.toFixed(2)}`);
        console.log(`   Net Target: $${currentSession.netTarget.toLocaleString()} (what you keep)`);
        console.log(`   Gross Target: $${currentSession.grossTarget.toLocaleString()} (must reach)`);
        console.log(`   Progress: ${progress}%`);
        console.log(`   P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
        
        if (poolManager.metrics && poolManager.metrics.totalTrades > 0) {
          console.log(`   Trades: ${poolManager.metrics.totalTrades}`);
          console.log(`   Win Rate: ${poolManager.metrics.winRate.toFixed(1)}%`);
          console.log(`   Avg Win: $${poolManager.metrics.totalProfit > 0 ? (poolManager.metrics.totalProfit / poolManager.metrics.profitableTrades).toFixed(2) : '0.00'}`);
          console.log(`   Avg Loss: $${poolManager.metrics.totalLoss > 0 ? (poolManager.metrics.totalLoss / (poolManager.metrics.totalTrades - poolManager.metrics.profitableTrades)).toFixed(2) : '0.00'}`);
        }
        
        // Show next session preview if close to target
        if (parseFloat(progress) > 75) {
          const nextSession = botController.getNextSession();
          console.log(`\n🎯 NEXT SESSION PREVIEW:`);
          if (nextSession) {
            console.log(`   Session ${nextSession.sessionNumber}: $${nextSession.initialPool.toLocaleString()} → $${nextSession.targetPool.toLocaleString()} target`);
          }
        }
        
        // Show wallet rotation info
        console.log(`\n🔄 WALLET ROTATION:`);
        console.log(`   Current Session: #${currentSession.sessionNumber}`);
        console.log(`   Current Wallet: #${currentWalletIndex + 1}`);
        console.log(`   Lifetime NET Profit: $${totalLifetimeProfit.toLocaleString()}`);
        console.log(`   Total Tax Reserve: $${(walletRotationHistory.reduce((sum: number, w: any) => sum + (w.taxReserve || 0), 0)).toLocaleString()}`);
      }
    } catch (error) {
      // Pool features not working - show basic stats only
      console.log(`\n💰 POOL STATUS: Using fallback display`);
      console.log(`   Tokens Bought: ${stats.tokensBought}`);
      console.log(`   Est. Value: $${(stats.tokensBought * 15.1295).toFixed(2)}`);
    }
  }

  // Show secure trading status
  displaySecurePoolStatus();
  
  console.log(`\n📁 Data saved to:`);
  console.log(`   • data/pool_transactions.csv`);
  console.log(`   • data/performance_log.csv`);
  console.log(`   • wallets/rotation_history.json`);
  console.log(`${"=".repeat(50)}\n`);
}


// ============================================
// MAIN EXECUTION
// ============================================
(async () => {
  // Initialize everything
  await initializeWalletRotation();
  await resetCurrentSessionOnly();
  await initializeSecurePool();
  setTestMode(IS_TEST_MODE);
  await initializeEnhancements();
  
  // Status display
  setInterval(printStatus, 5000);
  
  // Verify positions
  logEngine.writeLog(`✅ Verifying`, `Checking current wallet token balances...`, "white");
  const positionsVerified = await verifyPositions();

  await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
  console.log('⏳ Rate limiting: 2 second delay added');
  
  if (positionsVerified) {
    if (DATA_STREAM_METHOD === "grpc") {
      startGrpcListener()
        .catch((err: any) => {
          logEngine.writeLog(`${getCurrentTime()}`, `Fatal error: ${err}`, "red");
          process.exit(1);
        })
        .then(monitorPositions);
    } else if (DATA_STREAM_METHOD === "wss") {
      startWebSocketListener()
        .catch((err: any) => {
          logEngine.writeLog(`${getCurrentTime()}`, `Fatal error: ${err}`, "red");
          process.exit(1);
        })
        .then(monitorPositions);
    }
  } else {
      logEngine.writeLog(`${getCurrentTime()}`, `Position verification failed. Exiting.`, "red");
      process.exit(1);
    }
  })();
    
    // ============================================
    // SHUTDOWN HANDLER AND REPORTING
    // ============================================
    process.on('SIGINT', async () => {
      await shutdownWithReport();
    });

    // SHUTDOWN WITH REPORT FUNCTION
    async function shutdownWithReport(): Promise<void> {
      console.log('\n' + '='.repeat(60));
      console.log('🛑 SHUTDOWN INITIATED');
      console.log('='.repeat(60));
      
      // Calculate runtime
      const runtime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
      const hours = Math.floor(runtime / 3600);
      const minutes = Math.floor((runtime % 3600) / 60);
      const seconds = runtime % 60;
      
      console.log(`\n📊 FINAL BOT STATISTICS`);
      console.log(`Runtime: ${hours}h ${minutes}m ${seconds}s`);
      console.log(`Tokens Detected: ${stats.tokensDetected}`);
      console.log(`Tokens Bought: ${stats.tokensBought}`);
      console.log(`Tokens Rejected: ${stats.tokensRejected}`);
      
      // Current session pool status
      if (queueManager) {
        const poolManager = queueManager.getPoolManager?.();
        if (poolManager && poolManager.currentPool) {
          console.log(`\n💰 CURRENT SESSION POOL STATUS:`);
          console.log(`   Session: ${currentSession.sessionNumber}`);
          console.log(`   Initial: $${currentSession.initialPool.toFixed(2)}`);
          console.log(`   Current: $${poolManager.currentPool.toFixed(2)}`);
          console.log(`   P&L: ${poolManager.totalPnL >= 0 ? '🟢 +' : '🔴 '}$${Math.abs(poolManager.totalPnL).toFixed(2)}`);
          
          if (poolManager.metrics && poolManager.metrics.totalTrades > 0) {
            console.log(`   Total Trades: ${poolManager.metrics.totalTrades}`);
            console.log(`   Win Rate: ${poolManager.metrics.winRate.toFixed(1)}%`);
          }
        }
      }
      
      // ALL SESSIONS CUMULATIVE SUMMARY
      console.log('\n' + '='.repeat(60));
      console.log('📊 ALL SESSIONS CUMULATIVE SUMMARY');
      console.log('='.repeat(60));
      
      let grandTotalInitial = 0;
      let grandTotalFinal = 0;
      let grandTotalTrades = 0;
      let grandTotalTaxReserved = 0;
      
      // Read all session history
      if (fs.existsSync('./wallets/rotation_history.json')) {
        try {
          const history = JSON.parse(fs.readFileSync('./wallets/rotation_history.json', 'utf8'));
          
          history.forEach((session: any) => {
            grandTotalInitial += session.initialPool || 0;
            grandTotalFinal += session.finalPool || 0;
            grandTotalTrades += session.trades || 0;
            grandTotalTaxReserved += session.taxReserve || 0;
          });
          
          // Add current session
          if (queueManager) {
            const poolManager = queueManager.getPoolManager?.();
            if (poolManager) {
              grandTotalFinal += poolManager.currentPool || 0;
              grandTotalInitial += currentSession.initialPool || 0;
              grandTotalTrades += poolManager.metrics?.totalTrades || 0;
            }
          }
          
          const grandTotalPnL = grandTotalFinal - grandTotalInitial;
          const totalROI = grandTotalInitial > 0 ? ((grandTotalPnL / grandTotalInitial) * 100) : 0;
          const netAfterTax = grandTotalPnL - grandTotalTaxReserved;
          
          console.log(`   💰 LIFETIME TOTALS:`);
          console.log(`   ├─ Starting Capital: $${grandTotalInitial.toFixed(2)}`);
          console.log(`   ├─ Final Balance: $${grandTotalFinal.toFixed(2)}`);
          console.log(`   ├─ GROSS PROFIT: ${grandTotalPnL >= 0 ? '🟢' : '🔴'} $${Math.abs(grandTotalPnL).toFixed(2)}`);
          console.log(`   ├─ Total ROI: ${totalROI.toFixed(2)}%`);
          console.log(`   ├─ Total Trades: ${grandTotalTrades}`);
          console.log(`   │`);
          console.log(`   ├─ 📋 TAX COMPLIANCE:`);
          console.log(`   ├─ Tax Reserved (40%): $${grandTotalTaxReserved.toFixed(2)}`);
          console.log(`   ├─ NET PROFIT (After Tax): $${netAfterTax.toFixed(2)}`);
          console.log(`   └─ NET ROI: ${((netAfterTax / grandTotalInitial) * 100).toFixed(2)}%`);
          
        } catch (e) {
          console.log('   (No session history yet - first session)');
        }
      }
      
      // Generate tax summary
      generateTaxSummary();
      
      console.log('='.repeat(60));
      console.log('\n✅ Shutdown complete!');
      process.exit(0);
    }
    
    // TAX SUMMARY FUNCTION
    function generateTaxSummary(): void {
      console.log('\n📋 GENERATING TAX SUMMARY...');
      
      if (!fs.existsSync('data/tax_records.json')) {
        console.log('No tax records found yet.');
        return;
      }
      
      try {
        const records = JSON.parse(fs.readFileSync('data/tax_records.json', 'utf8'));
        
        let totalProfit = 0;
        let totalTaxOwed = 0;
        let totalNetProfit = 0;
        let tradeCount = 0;
        
        records.forEach((record: any) => {
          totalProfit += record.profit || 0;
          totalTaxOwed += record.taxOwed || 0;
          totalNetProfit += record.netProfit || 0;
          tradeCount++;
        });
        
        const summary = {
          generatedAt: new Date().toISOString(),
          totalProfitableTrades: tradeCount,
          grossProfit: totalProfit,
          taxOwed: totalTaxOwed,
          netProfit: totalNetProfit,
          taxRate: '40%',
          note: 'Set aside for quarterly estimated taxes'
        };
        
        // Save summary
        fs.writeFileSync('data/tax_summary.json', JSON.stringify(summary, null, 2));
        
        console.log('📊 TAX SUMMARY:');
        console.log(`├─ Profitable Trades: ${tradeCount}`);
        console.log(`├─ Gross Profit: $${totalProfit.toFixed(2)}`);
        console.log(`├─ Tax Owed (40%): $${totalTaxOwed.toFixed(2)}`);
        console.log(`├─ Net Profit: $${totalNetProfit.toFixed(2)}`);
        console.log(`└─ Summary saved to: data/tax_summary.json`);
        
      } catch (error) {
        console.error('Error generating tax summary:', error);
      }
      // Generate daily tax report before shutdown
      try {
        advancedManager.generateReports();
      } catch (error) {
        console.log("Tax reporting failed:", error);
      }
    }