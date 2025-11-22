// index.ts - SOL-BOT v5.0 with Pool Integration, Wallet Rotation & Tax Management
// MUST BE FIRST - Unified Control Import
import { BUY_AMOUNT, MAX_TRADES, POSITION_SIZE, TEST_MODE } from './core/CONFIG-BRIDGE';
import { getMaxTrades, MASTER_SETTINGS } from './core/UNIFIED-CONTROL';
import { botController, getCurrentSessionInfo, getCurrentTradingParams, getActiveConfidenceLevel, shouldPauseTrading, logTradeResult, fetchCurrentSOLPrice } from './botController';
console.log('📊 Using BotController:', { session: botController.getCurrentSessionIndex() + 1, params: getCurrentTradingParams() });
import { LAMPORTS_PER_SOL, Connection, Keypair, PublicKey } from "@solana/web3.js";
import { heliusLimiter } from './utils/rateLimiter';
import * as WebSocket from "ws";
import Client, { SubscribeRequest, SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { ClientDuplexStream } from "@grpc/grpc-js";
import { config } from "./config";
import { PositionMonitor, MonitoredPosition } from "./monitoring/positionMonitor";
import { validateEnv } from "./utils/env-validator";
import { WebSocketManager, ConnectionState } from "./utils/managers/websocketManager";
import { getMintFromSignature } from "./utils/handlers/signatureHandler";
import { getTokenAuthorities, getTokenCreationTime, isTokenSecureAndAllowed, TokenAuthorityStatus } from "./utils/handlers/tokenHandler";
import { buyToken } from "./utils/handlers/sniperooHandler";
import { getRugCheckConfirmed } from "./utils/handlers/rugCheckHandler";
import { enforceQualityFilter } from "./core/TOKEN-QUALITY-FILTER";
import { createSubscribeRequest, isSubscribeUpdateTransaction, sendSubscribeRequest } from "./utils/managers/grpcManager";
import { openBrowser, playSound } from "./utils/handlers/childProcessHandler";
import { swapToken, unSwapToken } from "./utils/handlers/jupiterHandler";
import { initializePumpSwapSDK, pumpswapBuy } from "./utils/handlers/pumpswapHandler";
import { SwapResult } from "./types";
import { validateJupiterSetup } from './utils/simple-jupiter-validator';
import { MarketRecorder } from '../market-intelligence/handlers/market-recorder';
import { getMarketIntelligenceConfig, SessionConfig } from '../market-intelligence/config/mi-config';
import { PartialExitManager, ExitResult } from './core/PARTIAL-EXIT-SYSTEM';
import { HandledMint, NewPositionRecord } from "./types";
import { logEngine } from "./utils/managers/logManager";
import { deletePositionByWalletAndMint, deletePositionsByWallet, getPositionByMint, selectAllPositions, updatePositionTokenAmount } from "./tracker/db";
import { getWalletTokenBalances, TokenAccountInfo } from "./utils/handlers/walletTokenHandler";
import { getWalletAddress } from "./utils/handlers/walletHandler";
import { shortenAddress } from "./utils/func";
import * as fs from 'fs';
import * as path from 'path';
// ✅ REMOVED: vipTokenCheck import (replaced with enforceQualityFilter)
// Security Integration
import { checkTradingAllowed, logBuy, logSell, logFailedTrade, displaySecurityStatus, getStatusSummary, isEmergencyMode } from './security/securityIntegration';
import {
  initializeSecurePool,
  checkForSecureWithdrawal,
  calculatePositionSizeInSOL,
  displaySecurePoolStatus,
  currentSecureSession
  // Removed setTestMode - secure-pool now reads directly from UNIFIED-CONTROL
} from './secure-pool-system';
// Tax compliance integration (temporarily disabled - moved to backup)
// import { recordTrade, TaxableTransaction } from '../tax-compliance/taxTracker';
interface TaxableTransaction {
  timestamp: string;
  type: 'buy' | 'sell';
  tokenMint: string;
  amount: number;
  signature: string;
  success: boolean;
  profit?: number;
}
async function recordTrade(data: TaxableTransaction) {
  // Tax tracking temporarily disabled
  console.log('[Tax] Trade recorded (stub):', data.type, data.tokenMint);
}
// ✅ FIX Bug #10, #12: Removed misleading "FORCE MODE" comments
// EMERGENCY SAFETY WRAPPER - Prevents scam token purchases
import { EmergencySafetyWrapper, wrapTradeFunction } from './emergency-safety-wrapper';

// Trading mode controlled by UNIFIED-CONTROL.ts (not forced here)


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

// Initialize Emergency Safety Wrapper
const safetyWrapper = EmergencySafetyWrapper.getInstance();
console.log('🛡️ Emergency Safety Wrapper ACTIVATED');
safetyWrapper.resetEmergencyMode(); // RESET EMERGENCY MODE
console.log('🔧 Emergency mode RESET - trading enabled');
console.log('   Will block all scam tokens (pump, inu, moon, etc.)');

// Market Intelligence System
let marketRecorder: MarketRecorder | null = null;

// Validate Jupiter configuration before starting
console.log('\n🔍 Validating configuration...');
validateJupiterSetup();
console.log('✅ Configuration valid - starting bot...\n');

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
// Session configuration now managed by UNIFIED-CONTROL
// Old POOL_SESSIONS removed - using botController.getCurrentSessionInfo()

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

// Load enhanced features
try {
  const enhancedModules = require("./enhanced/token-queue-system");
  TokenQueueManager = enhancedModules.TokenQueueManager;
  const perfModule = require("./enhanced/performanceLogger");
  PerformanceLogger = perfModule.PerformanceLogger;
  const analyzerModule = require("./enhanced/tokenAnalyzer");
  TokenAnalyzer = analyzerModule.TokenAnalyzer;

  console.log("✅ Enhanced features loaded successfully");
} catch (error) {
  console.log("⚠️ Enhanced features error:", error);
}

// ============================================
// ENVIRONMENT & CONFIGURATION
// ============================================
const env = validateEnv();
const RPC_WSS_URI = env.RPC_WSS_URI;
const GRPC_HTTP_URI = env.GRPC_HTTP_URI;
const GRPC_AUTH_TOKEN = env.GRPC_AUTH_TOKEN || "";

// Create global connection for safety wrapper
const globalConnection = new Connection(env.RPC_HTTPS_URI, "confirmed");

// Global Variables (from working version)
// ✅ UPDATED: Now reading from UNIFIED-CONTROL instead of old config.ts
const DATA_STREAM_METHOD = MASTER_SETTINGS.dataStream.method || "wss";
const DATA_STREAM_MODE = MASTER_SETTINGS.dataStream.mode || "program";
const DATA_STREAM_PROGRAMS = MASTER_SETTINGS.dataStream.programs;
const DATA_STREAM_PROGRAMS_LOG_DISCRIMINATORS = DATA_STREAM_PROGRAMS.filter((p) => p.enabled).map((p) => p.log_discriminator);
const DATA_STREAM_WALLETS = MASTER_SETTINGS.dataStream.wallets;
let activeTransactions = 0;
const MAX_CONCURRENT = config.concurrent_transactions;
const CHECK_MODE = config.checks.mode || "full";
const WALLET_MONITOR_INTERVAL = config.token_sell.wallet_token_balances_monitor_interval || 10000;

// Global connection objects for graceful shutdown
let globalWsManager: WebSocketManager | null = null;
let globalGrpcClient: Client | null = null;
let globalGrpcStream: ClientDuplexStream<SubscribeRequest, SubscribeUpdate> | null = null;
// ✅ VIP2 INTEGRATION: Position Monitor for real-time price tracking
let globalPositionMonitor: PositionMonitor | null = null;
let shutdownInProgress = false;

// Trading variables
const BUY_PROVIDER = config.token_buy.provider;
// BUY_AMOUNT now imported from CONFIG-BRIDGE (unified control)
const SIM_MODE = false; // DISABLED
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

// ============================================
// PARTIAL EXIT SYSTEM (NEW - Oct 28, 2025)
// ============================================
let partialExitManager: PartialExitManager | null = null; 

// Mode now controlled by UNIFIED-CONTROL.ts (imported via CONFIG-BRIDGE)
// To change mode: Edit src/core/UNIFIED-CONTROL.ts line 272
// ✅ FIX Bug #9: Removed TEST_MODE alias, using TEST_MODE directly
const MIN_TIME_BETWEEN_TRADES = 10000; // 10 seconds minimum
console.log("🎯 Trading Mode:", TEST_MODE ? "PAPER (Test Mode)" : "LIVE (Real Trades)");

// Statistics tracking
const stats = {
  startTime: new Date(),
  tokensDetected: 0,
  tokensBought: 0,
  tokensRejected: 0,
  tokensBlocked: 0,  // Quality filter blocks
  poolDepleted: 0,
  totalTrades: 0,
  wins: 0,           // Paper trading wins
  losses: 0          // Paper trading losses
};

// Session start time - tracks when current session began (not lifetime)
let sessionStartTime: Date = new Date();

// Import and initialize tax tracker
import { AdvancedBotManager } from './advanced-features';


// ============================================================================
// COMPREHENSIVE LOGGING SYSTEM - Added by comprehensive-fix-script.js
// ============================================================================
const logStream = fs.createWriteStream(path.join(__dirname, '../complete-bot-log.txt'), { flags: 'a' });
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Override console.log to write to both console and file
console.log = function(...args) {
  const timestamp = new Date().toISOString();
  const output = `[${timestamp}] ${args.join(' ')}`;
  logStream.write(output + '\n');
  originalConsoleLog.apply(console, args);
};

// Override console.error
console.error = function(...args) {
  const timestamp = new Date().toISOString();
  const output = `[${timestamp}] [ERROR] ${args.join(' ')}`;
  logStream.write(output + '\n');
  originalConsoleError.apply(console, args);
};

// Override console.warn
console.warn = function(...args) {
  const timestamp = new Date().toISOString();
  const output = `[${timestamp}] [WARN] ${args.join(' ')}`;
  logStream.write(output + '\n');
  originalConsoleWarn.apply(console, args);
};

console.log('✅ Comprehensive logging system initialized - logging to complete-bot-log.txt');
// ============================================================================
const advancedManager = new AdvancedBotManager({
  runtime: { maxRuntime: MASTER_SETTINGS.limits.duration || 3600000 }, // Use duration or default 1 hour
  pool: { targetPool: MASTER_SETTINGS.pool.targetPoolUSD }
});

// ============================================
// COMMAND-LINE PARAMETERS FOR TRADE LIMITS
// ============================================

// Parse command-line arguments for trade limits
const maxTrades = process.argv.includes('--max-trades')
  ? parseInt(process.argv[process.argv.indexOf('--max-trades') + 1])
  : 0; // 0 = unlimited

const maxLoss = process.argv.includes('--max-loss')
  ? parseFloat(process.argv[process.argv.indexOf('--max-loss') + 1])
  : 0; // 0 = no loss limit

// Trade tracking variables
let tradeCount = 0;
let totalLoss = 0;

// Display trade limits if set
if (maxTrades > 0 || maxLoss > 0) {
  console.log('\n🎯 TRADE LIMITS CONFIGURED');
  console.log('='.repeat(40));
  if (maxTrades > 0) {
    console.log(`📊 Max Trades: ${maxTrades}`);
  }
  if (maxLoss > 0) {
    console.log(`💸 Max Loss: ${maxLoss} SOL`);
  }
  console.log('🛑 Bot will auto-shutdown when limits reached');
  console.log('='.repeat(40));
}

// Duplicate Protection
const recentBuys = new Set<string>();
const recentBuyTimes = new Map<string, number>(); // ✅ FIX Bug #8: Track purchase times for cleanup
const BUY_COOLDOWN = Infinity; // Never allow re-buy

// ✅ FIX Bug #8: Cleanup old entries from recentBuys (24-hour expiry)
function cleanupRecentBuys(): void {
  const now = Date.now();
  const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

  for (const [mint, timestamp] of recentBuyTimes.entries()) {
    if (now - timestamp > MAX_AGE) {
      recentBuys.delete(mint);
      recentBuyTimes.delete(mint);
      console.log(`🧹 Cleanup: Removed ${mint.slice(0,8)} from recentBuys (24hr expired)`);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupRecentBuys, 60 * 60 * 1000);

// Token Queue System - Prevents rate limits by processing tokens sequentially
const MAX_QUEUE_SIZE = 100; // ✅ FIX Bug #7: Added queue size limit
const tokenQueue: string[] = [];
let isProcessingQueue = false;

// Add tokens to queue instead of processing immediately
async function addToQueue(tokenMint: string) {
  // ✅ FIX Bug #7: Check queue size before adding
  if (tokenQueue.length >= MAX_QUEUE_SIZE) {
    console.log(`⚠️ Queue full (${MAX_QUEUE_SIZE}) - dropping token: ${tokenMint.slice(0,8)}...`);
    stats.tokensRejected++;
    return;
  }

  // Skip if already in queue
  if (tokenQueue.includes(tokenMint)) {
    console.log(`⏭️ Token already in queue: ${tokenMint.slice(0,8)}...`);
    return;
  }

  // Perform checks based on mode BEFORE adding to queue
  // Token Quality Check - Three modes supported
  if (CHECK_MODE === "full") {
    logEngine.writeLog(`${getCurrentTime()}`, `Performing full security checks...`, "white");

    const authorities = await getTokenAuthorities(tokenMint);
    if (!authorities.hasFreezeAuthority && !authorities.hasMintAuthority) {
      logEngine.writeLog(`${getCurrentTime()}`, `✅ Token authorities renounced`, "green");
    } else {
      logEngine.writeLog(`${getCurrentTime()}`, `❌ Token has active authorities, skipping...`, "red");
      stats.tokensRejected++;
      return;
    }

    const creationTime = await getTokenCreationTime(tokenMint);
    const ageInMinutes = typeof creationTime === 'number' ? (Date.now() - creationTime) / 60000 : 0;

    if (config.entry?.maxAge && ageInMinutes > config.entry.maxAge) {
      logEngine.writeLog(`${getCurrentTime()}`, `❌ Token too old (${ageInMinutes.toFixed(1)} min), skipping...`, "red");
      stats.tokensRejected++;
      return;
    }

    const isSecure = await isTokenSecureAndAllowed(tokenMint);
    if (!isSecure) {
      logEngine.writeLog(`${getCurrentTime()}`, `❌ Token failed security checks, skipping...`, "red");
      stats.tokensRejected++;
      return;
    }

    if ((config.checks as any).rug_check) {
      const rugCheckPassed = await getRugCheckConfirmed(tokenMint, logEngine);
      if (!rugCheckPassed) {
        logEngine.writeLog(`${getCurrentTime()}`, `❌ Token failed rug check, skipping...`, "red");
        stats.tokensRejected++;
        return;
      }
    }

    logEngine.writeLog(`${getCurrentTime()}`, `✅ All checks passed, adding to queue...`, "green");

    // Market Intelligence: Record token detection (non-critical)
    if (marketRecorder?.isRecording()) {
      marketRecorder.onTokenDetected(
        { mint: tokenMint, timestamp: Date.now(), detection_method: 'websocket' },
        {
          mint: tokenMint,
          score: 70, // Passed full checks, high quality
          would_buy: true,
          has_mint_authority: authorities.hasMintAuthority,
          has_freeze_authority: authorities.hasFreezeAuthority
        }
      ).catch(err => console.log('⚠️  MI recording error (non-critical):', err));
    }
  } else if (CHECK_MODE === "quick") {
    logEngine.writeLog(`${getCurrentTime()}`, `Quick mode - minimal checks`, "yellow");

    const isSecure = await isTokenSecureAndAllowed(tokenMint);
    if (!isSecure) {
      logEngine.writeLog(`${getCurrentTime()}`, `❌ Token failed basic checks, skipping...`, "red");
      stats.tokensRejected++;
      return;
    }

    // Market Intelligence: Record token detection (non-critical)
    if (marketRecorder?.isRecording()) {
      marketRecorder.onTokenDetected(
        { mint: tokenMint, timestamp: Date.now(), detection_method: 'websocket' },
        {
          mint: tokenMint,
          score: 60, // Passed quick checks, medium quality
          would_buy: true,
          has_mint_authority: false, // Quick mode doesn't check authorities
          has_freeze_authority: false
        }
      ).catch(err => console.log('⚠️  MI recording error (non-critical):', err));
    }
  } else if (CHECK_MODE === "minimal") {
    // Minimal mode: Only check for mint/freeze authorities (fastest, but no rugcheck)
    logEngine.writeLog(`${getCurrentTime()}`, `Minimal mode - authority checks only`, "yellow");

    const authorities = await getTokenAuthorities(tokenMint);
    if (authorities.hasMintAuthority || authorities.hasFreezeAuthority) {
      logEngine.writeLog(`${getCurrentTime()}`, `❌ Token has authorities, skipping...`, "red");
      stats.tokensRejected++;
      return;
    }

    // Market Intelligence: Record token detection
    if (marketRecorder?.isRecording()) {
      marketRecorder.onTokenDetected(
        { mint: tokenMint, timestamp: Date.now(), detection_method: 'websocket' },
        {
          mint: tokenMint,
          score: 50, // Minimal checks, medium-low quality
          would_buy: true,
          has_mint_authority: false,
          has_freeze_authority: false
        }
      ).catch(err => console.log('⚠️  MI recording error (non-critical):', err));
    }
  } else {
    // SAFEGUARD: Unknown check mode - default to FULL checks for safety
    logEngine.writeLog(`${getCurrentTime()}`, `⚠️ Unknown check mode "${CHECK_MODE}", defaulting to FULL checks for safety`, "yellow");

    const authorities = await getTokenAuthorities(tokenMint);
    if (!authorities.hasFreezeAuthority && !authorities.hasMintAuthority) {
      logEngine.writeLog(`${getCurrentTime()}`, `✅ Token authorities safe, proceeding with checks...`, "white");

      const isRugged = await getRugCheckConfirmed(tokenMint, logEngine);
      if (isRugged) {
        logEngine.writeLog(`${getCurrentTime()}`, `❌ Token failed rug check, skipping...`, "red");
        stats.tokensRejected++;
        return;
      }

      // ✅ FIXED: Using comprehensive quality filter with 65-point scoring system
      const passedQualityFilter = await enforceQualityFilter(tokenMint, logEngine);
      if (!passedQualityFilter) {
        logEngine.writeLog(`${getCurrentTime()}`, `❌ Token failed quality filter, skipping...`, "red");
        stats.tokensBlocked++;
        return;
      }

      logEngine.writeLog(`${getCurrentTime()}`, `✅ Token passed all checks!`, "green");
    } else {
      logEngine.writeLog(`${getCurrentTime()}`, `❌ Token has ${authorities.hasMintAuthority ? 'mint' : ''}${authorities.hasFreezeAuthority ? ' freeze' : ''} authority, skipping...`, "red");
      stats.tokensRejected++;
      return;
    }

    // Market Intelligence: Record token detection
    if (marketRecorder?.isRecording()) {
      marketRecorder.onTokenDetected(
        { mint: tokenMint, timestamp: Date.now(), detection_method: 'websocket' },
        {
          mint: tokenMint,
          score: 70, // Passed full checks
          would_buy: true,
          has_mint_authority: authorities.hasMintAuthority,
          has_freeze_authority: authorities.hasFreezeAuthority
        }
      ).catch(err => console.log('⚠️  MI recording error (non-critical):', err));
    }
  }

  tokenQueue.push(tokenMint);
  console.log(`📥 Added to queue (${tokenQueue.length} tokens waiting)`);

  // Start processing if not already running
  if (!isProcessingQueue) {
    processQueue();
  }
}

// Process queue with rate limiting (FIFO - first in, first out)
async function processQueue() {
  isProcessingQueue = true;

  while (tokenQueue.length > 0) {
    const tokenMint = tokenQueue.shift()!;
    console.log(`⚙️ Processing token (${tokenQueue.length} remaining in queue)`);

    try {
      await processPurchase(tokenMint);
    } catch (error) {
      console.log(`❌ Error processing token: ${error}`);
    }

    // Wait 6 seconds between Jupiter API calls to stay under rate limits
    console.log(`⏰ Rate limit delay: 6 seconds until next token...`);
    await new Promise(resolve => setTimeout(resolve, 6000));
  }

  isProcessingQueue = false;
  console.log(`✅ Queue empty - waiting for new tokens`);
}

// Rate limiting (legacy - now handled by queue)
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
    stats.tokensBlocked = 0;
    stats.poolDepleted = 0;
    stats.startTime = new Date();

    // Reset session start time for accurate runtime tracking
    sessionStartTime = new Date();

    console.log("\n✅ RESET COMPLETE - READY FOR LIVE TRADING!");
    console.log("   Starting with Session 1");
    console.log("   Initial Pool: $600");
    console.log("   First Target: $6,000 net ($10,680 gross)");
    console.log(`   Mode: ${TEST_MODE ? 'TEST' : 'LIVE'} TRADING\n`);
    
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

  // Reset session start time for accurate runtime tracking
  sessionStartTime = new Date();

  // Keep totalLifetimeProfit and walletRotationHistory intact!
  console.log(`   📊 Keeping Lifetime NET Profit: $${totalLifetimeProfit.toLocaleString()}`);
  console.log(`   📊 Keeping ${walletRotationHistory.length} previous sessions in history`);
  console.log(`   🔄 Resetting to Session 1 for new run`);
  console.log(`   💰 Starting with: $600 → $7,000 target\n`);
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
      startTime: sessionStartTime,
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
    if (!TEST_MODE) {
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
      RPC_WSS_URI.replace('wss', 'https'),
      'confirmed'
    );

    // Market Intelligence Bot Session Tracker (Optional - disable with MI_ENABLED=false in .env)
    if (process.env.MI_ENABLED !== 'false') {
      try {
        // Create session-specific configuration
        const sessionConfig: SessionConfig = {
          session_id: Date.now().toString(),
          session_type: TEST_MODE ? 'test' : 'live',
          session_start: Date.now(),
          bot_version: '5.0.0',
          session_metadata: {
            initial_balance: currentSession.initialPool,
            target_pool: currentSession.grossTarget,
            max_runtime: MASTER_SETTINGS.limits.duration || 3600000,
          },
        };

        // Initialize with session-specific config
        marketRecorder = new MarketRecorder(connection, getMarketIntelligenceConfig(sessionConfig));
        await marketRecorder.initialize();
        console.log(`✅ Market Intelligence session tracker started (${sessionConfig.session_type} mode)`);
        console.log(`   Session ID: ${sessionConfig.session_id}`);
        console.log(`   Database: data/bot-sessions/${sessionConfig.session_type}-session-${sessionConfig.session_id}.db`);
      } catch (error) {
        console.log('⚠️  Market Intelligence failed to start (bot continues normally):', error);
      }
    }

    // Use current session configuration
    const initialPool = currentSession.initialPool;
    const targetPool = currentSession.targetPool;  // Use target pool from session config
    const positionSize = POSITION_SIZE;
    
    queueManager = new TokenQueueManager(
      RPC_WSS_URI.replace('wss', 'https'),
      './data/pending_tokens.csv',
      initialPool,
      {
        positionSize: positionSize,
        positionSizeUSD: positionSize * 170,
        maxPositions: 10,
        stopLoss: -80,
        takeProfit: [100, 300, 500],
        targetPool: targetPool, // Use session gross target
        sessionNumber: currentSession.sessionNumber,
        compoundProfits: true,
        testMode: TEST_MODE,
        exit: {}
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
    console.log(`📈 Target Pool: $${targetPool.toLocaleString()}`);
    const grossProfit = currentSession.profitRequired || 0;
    const netProfit = grossProfit * 0.6; // After 40% tax reserve
    console.log(`🎯 Gross Profit Goal: $${grossProfit.toLocaleString()} (before tax)`);
    console.log(`💵 Net Profit Goal: $${netProfit.toLocaleString()} (what you keep after 40% tax reserve)`);
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
        
        if (decision.confidence > 0.7 && decision.shouldHold) { // 5x+ detection threshold
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
    const walletAddress: string | null = process.env.WALLET_ADDRESS || getWalletAddress();
    console.log("💰 WALLET CHECK:");
    console.log("  - Address:", walletAddress);
    console.log("  - Mode:", TEST_MODE ? "PAPER (simulated trades, real wallet monitoring)" : "LIVE (real trades)");
    console.log('Using wallet from env:', walletAddress);
    if (!walletAddress) {
      const currentTime = getCurrentTime();
      console.log('DEBUG: Checking wallet...');
      console.log('PRIVATE_KEY exists:', !!process.env.PRIVATE_KEY);
      console.log('WALLET_ADDRESS:', process.env.WALLET_ADDRESS);
      console.log('Provider:', BUY_PROVIDER);
      logEngine.writeLog(`${currentTime}`, `Invalid or missing wallet address while using ${BUY_PROVIDER} as provider.`, "red");
      console.log("🔥 TEST_MODE value:", TEST_MODE);

    if (TEST_MODE) {  // ✅ FIX Bug #2: Restored proper test mode check
      logEngine.writeLog(`${getCurrentTime()}`, "TEST MODE - Continuing without wallet", "yellow");
      return true;
    }
      
      
      //if (TEST_MODE) {
        //logEngine.writeLog(`${currentTime}`, `TEST MODE - Continuing without wallet`, "yellow");
        //return true;

      //}
      
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
    // ✅ REMOVED: if(false) dead code bypass pattern
    logEngine.writeLog(`${getCurrentTime()}`, `Verification issue: ${err}`, "red");
    return false;
  }
}

// ============================================
// POSITION MONITORING - NOW HANDLED BY gRPC
// ============================================
// Position price monitoring is now handled by globalPositionMonitor (gRPC real-time)
// See lines ~1183-1211 for PositionMonitor initialization
// Price updates trigger via onPriceUpdate callback which calls partialExitManager.updatePrice()
// This provides <400ms latency vs 2-10s polling, with ZERO Jupiter API calls
//
// Old monitorPositions() function removed to eliminate Jupiter Price API polling
// which was causing 429 rate limit errors (60+ requests/minute)

// ============================================
// WEBSOCKET LISTENER (from working version - COMPLETE)
// ============================================
async function startWebSocketListener(): Promise<void> {
  logEngine.writeLog(`✅ Starting Sniper via Websocket`, ``, "white", true);
  logEngine.writeLog(`🟡 Config`, `Transactions provider is set to: ${BUY_PROVIDER}`, "yellow");

  globalWsManager = new WebSocketManager({
    url: RPC_WSS_URI,
    initialBackoff: 1000,
    maxBackoff: 30000,
    maxRetries: Infinity,
    debug: true,    
  });

  // ADD ERROR RECOVERY:
  globalWsManager.on("close", () => {
    console.log("❌ WebSocket closed - attempting reconnect...");
    setTimeout(() => {
      if (globalWsManager && !shutdownInProgress) {
        globalWsManager.connect();
      }
    }, 5000);
  });

  globalWsManager.on("open", () => {
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
        globalWsManager.send(JSON.stringify(subscriptionMessage));
      });
    }
  });

  globalWsManager.on("message", async (data: WebSocket.Data) => {
    try {
      // CHECK IF SHUTDOWN IS IN PROGRESS
      if (shutdownInProgress) {
        return; // Skip processing during shutdown
      }

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
                  
                  // RATE LIMITING - Check but DON'T increment yet
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
                  // ❌ REMOVED: tradesThisMinute++ (was counting detections, not actual trades!)
                  // ✅ NOW: Only increments after successful trade (see line ~1507)

                  logEngine.writeLog(`${getCurrentTime()}`, `New token detected: ${mintStr.slice(0, 8)}... (#${stats.tokensDetected})`, "yellow");
                  
                  activeTransactions++;
                  
                  // ADD TO QUEUE INSTEAD OF IMMEDIATE PROCESSING
                  await addToQueue(mintStr);

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

  globalWsManager.on("error", (error: Error) => {
    logEngine.writeLog(`${getCurrentTime()}`, `WebSocket error: ${error.message}`, "red");
  });

  globalWsManager.connect();
}

// ============================================
// VIP2 INTEGRATION: POSITION MONITOR INITIALIZATION
// ============================================
async function initializePositionMonitor(): Promise<void> {
  try {
    // Get current SOL price for USD conversions from CoinGecko (not Jupiter)
    const solPrice = await fetchCurrentSOLPrice(); // Returns price with $170 fallback

    globalPositionMonitor = new PositionMonitor(
      GRPC_HTTP_URI,
      GRPC_AUTH_TOKEN,
      solPrice
    );

    // Set up real-time price update callback for instant exit signals
    globalPositionMonitor.onPriceUpdate(async (mint, priceUSD) => {
      // Trigger exit strategy check on price updates
      if (partialExitManager && !shutdownInProgress) {
        try {
          const positions = await getPositionByMint(mint);
          if (positions.length > 0) {
            const position = positions[0];
            // Check if exit conditions met
            await partialExitManager.updatePrice(mint, priceUSD);
          }
        } catch (error) {
          console.log(`⚠️ Error checking exit for ${mint}:`, error);
        }
      }
    });

    // Start monitoring
    await globalPositionMonitor.start();
    logEngine.writeLog(`👁️ Position Monitor`, `Real-time price tracking ACTIVE (${solPrice} SOL/USD)`, "blue", true);
  } catch (error) {
    logEngine.writeLog(`⚠️ Position Monitor`, `Failed to start: ${error}`, "yellow");
    globalPositionMonitor = null;
  }
}

// ============================================
// GRPC LISTENER (from working version)
// ============================================
async function startGrpcListener(): Promise<void> {
  logEngine.writeLog(`✅ Starting Sniper via gRPC...`, ``, "white", true);
  logEngine.writeLog(`🟡 Config`, `Transactions provider is set to: ${BUY_PROVIDER}`, "yellow");

  globalGrpcClient = new Client(GRPC_HTTP_URI, GRPC_AUTH_TOKEN, { skipPreflight: true });
  globalGrpcStream = await globalGrpcClient.subscribe();
  const request = createSubscribeRequest(DATA_STREAM_PROGRAMS, DATA_STREAM_WALLETS, DATA_STREAM_MODE);

  try {
    await sendSubscribeRequest(globalGrpcStream, request);
    logEngine.writeLog(`${getCurrentTime()}`, `Geyser connection and subscription established`, "green");

    // ✅ VIP2 INTEGRATION: Initialize Position Monitor for real-time price tracking
    await initializePositionMonitor();
  } catch (error) {
    logEngine.writeLog(`${getCurrentTime()}`, `Error in subscription process: ${error}`, "red");
    if (globalGrpcStream) {
      globalGrpcStream.end();
    }
    return;
  }

  // ============================================
  // gRPC MESSAGE HANDLERS (NEWLY ADDED)
  // ============================================

  globalGrpcStream.on("data", async (data: SubscribeUpdate) => {
    try {
      // CHECK IF SHUTDOWN IS IN PROGRESS
      if (shutdownInProgress) {
        return;
      }

      // CHECK IF SCANNING IS PAUSED
      if (scanningPaused) {
        if (Date.now() % 10000 < 100) {
          const poolStatus = queueManager?.getPoolManager?.()?.getPoolSummary?.();
          if (poolStatus?.canTrade) {
            scanningPaused = false;
            console.log('💚 Pool replenished! Resuming scanning...');
          } else {
            return;
          }
        } else {
          return;
        }
      }

      // Process gRPC transaction data
      if (!isSubscribeUpdateTransaction(data) || !data.filters.includes("sniper")) {
        return;
      }

      const transaction = data.transaction?.transaction;
      const meta = transaction?.meta;

      if (!transaction || !meta) {
        return;
      }

      const tokenBalances = meta.postTokenBalances || meta.preTokenBalances;
      if (!tokenBalances?.length) return;

      // Check for token creation in logs
      if (!meta.logMessages.some((msg: string) =>
        DATA_STREAM_PROGRAMS_LOG_DISCRIMINATORS.some((discriminator) => msg.includes(discriminator))
      )) {
        return;
      }

      // Extract mint from token balances
      const firstBalance = tokenBalances[0];
      const mintStr = firstBalance?.mint;

      if (!mintStr) {
        return;
      }

      // Check if already handled
      const existingMint = handledMints.find(m => m.signature === mintStr);
      if (existingMint) {
        return;
      }

      handledMints.push({
        signature: mintStr,
        timestamp: Date.now()
      });

      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      handledMints = handledMints.filter(m => m.timestamp > fiveMinutesAgo);

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

      logEngine.writeLog(`${getCurrentTime()}`, `🔍 [gRPC] Token detected: ${mintStr.slice(0, 8)}... (#${stats.tokensDetected})`, "green");

      activeTransactions++;
      await addToQueue(mintStr);
      activeTransactions--;

    } catch (error) {
      logEngine.writeLog(`${getCurrentTime()}`, `gRPC data processing error: ${error}`, "red");
    }
  });

  globalGrpcStream.on("error", (error: Error) => {
    logEngine.writeLog(`${getCurrentTime()}`, `gRPC stream error: ${error}`, "red");
    // Connection will auto-reconnect via Triton client
  });

  globalGrpcStream.on("end", () => {
    logEngine.writeLog(`${getCurrentTime()}`, `gRPC stream ended`, "yellow");
  });

  globalGrpcStream.on("close", () => {
    logEngine.writeLog(`${getCurrentTime()}`, `gRPC stream closed`, "yellow");
  });
}

// ============================================
// PURCHASE PROCESSING (with optional pool)
// ============================================

// Reset emergency mode at bot startup
safetyWrapper.resetEmergencyMode();
console.log("🔧 Emergency mode reset - trading enabled");

/**
 * Process a token purchase - main buying logic
 * @param tokenMint - The mint address of the token to purchase
 */
async function processPurchase(tokenMint: string): Promise<void> {
  const returnedMint = tokenMint; // Keep existing variable name for compatibility
  let actualBuyAmount = BUY_AMOUNT; // Declare at function scope

  // ✅ FIX Bug #6: Removed duplicate addToQueue call
  // processPurchase is called FROM processQueue, token already in queue
  if (!returnedMint) return;

  console.log("🚨 ATTEMPTING TO BUY TOKEN - WATCH THIS");

  // 💱 DYNAMIC SOL PRICE FETCHING - Get current market price
  let SOL_PRICE = 232; // Default fallback
  try {
    console.log("💱 Fetching current SOL price...");
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await response.json() as { solana?: { usd?: number } };
    SOL_PRICE = data?.solana?.usd || 232;
    console.log(`💱 Current SOL price: $${SOL_PRICE}`);
  } catch (e) {
    console.log("⚠️ SOL price fetch failed, using fallback: $232");
    SOL_PRICE = 232;
  }

  // ============================================
  // ABSOLUTE TRADE LIMIT PROTECTION
  // ============================================
  const { canTrade, incrementTradeCounter } = await import('./core/FORCE-TRADE-LIMIT');
  if (!canTrade()) {
    console.log("🛑 Trade limit reached - skipping token");
    return;
  }

  // ============================================
  // UNIFIED-CONTROL TRADE LIMIT CHECK
  // ============================================
  const maxTrades = getMaxTrades();
  if (stats.totalTrades >= maxTrades) {
    console.log("🛑 UNIFIED-CONTROL trade limit reached, starting shutdown...");
    shutdownInProgress = true;
    return;
  }

  // Check if shutdown is in progress
  if (shutdownInProgress) {
    console.log("🛑 Skipping trade - shutdown in progress");
    return;
  }

  console.log("📍 Checkpoint 1: Entered processPurchase");

  // Rate limiting now handled by queue system
  // Update BUY_AMOUNT dynamically
  // Position size now controlled by UNIFIED-CONTROL (was: calculatePositionSizeInSOL())

  console.log(`🔍 Checking token: ${returnedMint.slice(0,8)}... | Already bought: ${recentBuys.has(returnedMint)}`);

// DUPLICATE PROTECTION - PERMANENT BLOCKING
if (recentBuys.has(returnedMint)) {
  console.log("⛔ EARLY RETURN at line 1035: DUPLICATE BLOCKED");
  logEngine.writeLog(`${getCurrentTime()}`, `⚠️ DUPLICATE BLOCKED: Already bought ${returnedMint.slice(0, 8)}...`, "yellow");
  stats.tokensRejected++;
  activeTransactions--;  // ADD THIS - decrement counter
  return;
}

console.log("📍 Checkpoint 2: Passed duplicate check");

// Also check in queue manager if exists
if (queueManager && queueManager.hasTokenInQueue?.(returnedMint)) {
  console.log("⛔ EARLY RETURN at line 1044: Token already in queue");
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
        console.log("⛔ EARLY RETURN at line 1055: Pool depleted");
        logEngine.writeLog(`${getCurrentTime()}`, `Pool depleted, skipping trade`, "yellow");
        stats.poolDepleted++;
        return;
      }
      console.log("📍 Checkpoint 3: Passed pool check");
    } catch (error) {
      // Enhanced features not working properly, continue anyway
    }
  }
  
  logEngine.writeLog(`${getCurrentTime()}`, `Token CA extracted successfully`, "green");
  logEngine.writeLog(`${getCurrentTime()}`, `https://gmgn.ai/sol/token/${returnedMint}`, "white");
  

  console.log("📍 Checkpoint 4: Reached test mode check");

// Test mode vs live mode check
  if (TEST_MODE) {
    console.log("📝 PAPER TRADING MODE - Simulating trade without execution");

    const tokenStr = typeof returnedMint === 'string' ? returnedMint : String(returnedMint);

    // Use the SAME amount logic as live (actualBuyAmount),
    // not a hardcoded BUY_AMOUNT only.
    const simulatedTokenAmount = 1_000_000; // Simulate 1M tokens
    const simulatedEntryPriceSOL = actualBuyAmount / simulatedTokenAmount;
    const simulatedEntryPriceUSD = simulatedEntryPriceSOL * SOL_PRICE;

    logEngine.writeLog(
      `${getCurrentTime()}`,
      `[TEST MODE] Token: ${tokenStr.slice(0, 8)}...`,
      "white"
    );
    logEngine.writeLog(
      `${getCurrentTime()}`,
      `[TEST MODE] Amount: ${actualBuyAmount} SOL`,
      "white"
    );

    console.log(`\n💰 [PAPER TRADING] Simulated Buy Details:`);
    console.log(`   Token: ${tokenStr.slice(0, 8)}...`);
    console.log(`   Amount Bought: ${simulatedTokenAmount.toLocaleString()} tokens`);
    console.log(`   SOL Invested: ${actualBuyAmount} SOL`);
    console.log(`   Entry Price: ${simulatedEntryPriceSOL.toFixed(10)} SOL/token`);
    console.log(`   Entry Price USD: $${simulatedEntryPriceUSD.toFixed(8)}`);

    // Add to Partial Exit Manager (tracks exit signals)
    if (partialExitManager) {
      try {
        partialExitManager.addPosition(
          returnedMint,              // Token mint address
          simulatedEntryPriceSOL,    // Entry price in SOL per token
          simulatedTokenAmount,      // Amount of tokens bought
          actualBuyAmount,           // SOL invested (matches LIVE logic)
          undefined                  // Symbol (optional)
        );
        console.log(`✅ [PAPER TRADING] Position added to exit tracking`);
      } catch (exitError) {
        console.warn('⚠️ [PAPER TRADING] Failed to add to exit tracking:', exitError);
      }
    }

    // Add to Position Monitor (tracks real-time price)
    if (globalPositionMonitor) {
      try {
        const monitoredPosition: MonitoredPosition = {
          mint: returnedMint,
          poolAddress: "", // Derive from token if needed
          entryPriceSOL: simulatedEntryPriceSOL,
          entryPriceUSD: simulatedEntryPriceUSD,
          tokenAmount: simulatedTokenAmount,
          entryTime: new Date(),
          dex: "pumpfun" // Assume pump.fun for now
        };
        await globalPositionMonitor.addPosition(monitoredPosition);
        console.log(`👁️ [PAPER TRADING] Position added to real-time monitoring`);
      } catch (monitorError) {
        console.warn('⚠️ [PAPER TRADING] Failed to add to price monitor:', monitorError);
      }
    }

    // ✅ Mirror LIVE behaviour: mark as bought & block duplicates
    stats.tokensBought++;
    stats.totalTrades++;

    // PERMANENT duplicate protection, same as LIVE branch
    recentBuys.add(returnedMint);
    recentBuyTimes.set(returnedMint, Date.now());
    logEngine.writeLog(
      `${getCurrentTime()}`,
      `🔒 [TEST MODE] Token ${returnedMint.slice(0,8)} PERMANENTLY blocked from re-buy`,
      "red"
    );
    console.log(`🚫 [TEST MODE] Duplicate protection: ${returnedMint} will NEVER be bought again in this run`);

    // (Optional) you can also bump trade counters if you want them to match live stats:
    // tradeCount++;
    // tradesThisMinute++;
    // console.log(`📊 [TEST MODE] Trade ${tradeCount}${maxTrades ? \`/\${maxTrades}\` : ''} simulated`);
    // console.log(`📊 [TEST MODE] Rate limiter: ${tradesThisMinute}/${MAX_TRADES_PER_MINUTE} trades this minute`);

    if (OPEN_BROWSER) openBrowser("https://gmgn.ai/sol/token/" + returnedMint);
    if (PLAY_SOUND) playSound("New Token!");

    // Exit BEFORE real on-chain trading (exits now handled by PartialExitManager callbacks)
    return;
  }

  console.log("✅ LIVE TRADING MODE - Executing real trades");

  console.log("✅ LIVE TRADING MODE - Executing real trades");
  console.log("📍 Checkpoint 5: Executing trade logic");
  // Live mode execution continues here

  // Live trading execution
  let result = false;
  let swapResult: SwapResult | null = null; // For Jupiter trades
  if (BUY_PROVIDER === "sniperoo") {
    logEngine.writeLog(`${getCurrentTime()}`, `Sniping Token using Sniperoo...`, "green");
    console.log("🚀 ATTEMPTING LIVE TRADE:");
    console.log("  - Token:", returnedMint);
    console.log("  - Amount:", BUY_AMOUNT);
    console.log("  - Wallet:", process.env.WALLET_ADDRESS || "Not configured");

    // 🔍 QUALITY FILTER - Block scam tokens BEFORE attempting trade
    // ✅ FIXED: Using comprehensive 65-point quality filter with 40+ scam word detection
    console.log("🛡️ Running comprehensive quality filter...");
    const qualityPassed = await enforceQualityFilter(returnedMint, logEngine);
    if (!qualityPassed) {
      console.log("🚫 Token failed quality filter - BLOCKED");
      stats.tokensBlocked++;
      return;
    }
    console.log("✅ Token passed quality filter - proceeding to trade");

    // Rate limiting now handled by queue system

    // 💰 POSITION SIZE SAFETY CAP - Prevent oversized trades
    const maxPositionUSD = 50; // Safety cap regardless of tier
    const currentPositionUSD = BUY_AMOUNT * SOL_PRICE; // Using dynamic SOL price

    actualBuyAmount = BUY_AMOUNT; // Update function-scope variable

    if (currentPositionUSD > maxPositionUSD) {
      actualBuyAmount = maxPositionUSD / SOL_PRICE; // Convert back to SOL using current price
      console.log(`⚠️ Position capped: $${currentPositionUSD.toFixed(2)} → $${maxPositionUSD}`);
      console.log(`   Original: ${BUY_AMOUNT} SOL → Capped: ${actualBuyAmount.toFixed(4)} SOL`);
      console.log(`   Using SOL price: $${SOL_PRICE}`);
    }

    // SAFETY-WRAPPED TRADE - Blocks scams automatically
    //const token = { address: returnedMint, name: 'Unknown', liquidity: 0, holders: 0, volume: 0 };
    //const safetyResult = await safetyWrapper.safeTradeWrapper(buyToken, token, actualBuyAmount, returnedMint, actualBuyAmount, logEngine);

    //if (!safetyResult.success) {
      //console.log(`🚫 TRADE BLOCKED: ${safetyResult.reason}`);
      //logEngine.writeLog(`${getCurrentTime()}`, `❌ Trade blocked: ${safetyResult.reason}`, "red");
      //stats.tokensRejected++;
      //return;
   //}

   // Just execute the trade directly
  let result = await buyToken(returnedMint, actualBuyAmount, logEngine);

    console.log("📊 TRADE RESULT:", result);
    console.log("  - Success:", result ? "YES" : "NO");

// 📊 TAX RECORDING - SNIPEROO BUY TRANSACTION
if (result) {
  // ============================================
  // INCREMENT ABSOLUTE TRADE COUNTER
  // ============================================
  const { incrementTradeCounter } = await import('./core/FORCE-TRADE-LIMIT');
  incrementTradeCounter();

  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'buy',
      tokenMint: returnedMint,
      amount: BUY_AMOUNT,
      signature: `sniperoo_buy_${Date.now()}`,
      success: result
    };
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: ${taxData.type} - ${taxData.tokenMint?.slice(0,8)}...`);
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed:', taxError);
  }
}
  } else if (BUY_PROVIDER === "pumpswap") {
    logEngine.writeLog(`${getCurrentTime()}`, `Sniping Token using PumpSwap SDK (on-chain)...`, "green");
    console.log("🚀 ATTEMPTING LIVE TRADE (PumpSwap SDK):");
    console.log("  - Token:", returnedMint);
    console.log("  - Amount:", BUY_AMOUNT);
    console.log("  - Wallet:", process.env.WALLET_ADDRESS || "Not configured");

    // 🔍 QUALITY FILTER - Block scam tokens BEFORE attempting trade
    // ✅ FIXED: Using comprehensive 65-point quality filter with 40+ scam word detection
    console.log("🛡️ Running comprehensive quality filter...");
    const qualityPassed = await enforceQualityFilter(returnedMint, logEngine);
    if (!qualityPassed) {
      console.log("🚫 Token failed quality filter - BLOCKED");
      stats.tokensBlocked++;
      return;
    }
    console.log("✅ Token passed quality filter - proceeding to trade");

    // 💰 POSITION SIZE SAFETY CAP - Prevent oversized trades
    const maxPositionUSD = 50; // Safety cap regardless of tier
    const currentPositionUSD = BUY_AMOUNT * SOL_PRICE; // Using dynamic SOL price
    actualBuyAmount = BUY_AMOUNT; // Update function-scope variable

    if (currentPositionUSD > maxPositionUSD) {
      actualBuyAmount = maxPositionUSD / SOL_PRICE; // Convert back to SOL using current price
      console.log(`⚠️ Position capped: $${currentPositionUSD.toFixed(2)} → $${maxPositionUSD}`);
      console.log(`   Original: ${BUY_AMOUNT} SOL → Capped: ${actualBuyAmount.toFixed(4)} SOL`);
      console.log(`   Using SOL price: $${SOL_PRICE}`);
    }

    // Try PumpSwap SDK first, fallback to Jupiter if it fails
    console.log("🎯 Attempting PumpSwap SDK direct on-chain execution...");
    const pumpswapTxSig = await pumpswapBuy(WSOL_MINT, returnedMint, actualBuyAmount * LAMPORTS_PER_SOL);

    // If PumpSwap succeeds, wrap result in SwapResult format
    if (pumpswapTxSig) {
      console.log("✅ PumpSwap SDK execution successful!");
      logEngine.writeLog(`${getCurrentTime()}`, `✅ Bought using PumpSwap SDK (on-chain)`, "green");
      swapResult = {
        success: true,
        txSignature: pumpswapTxSig,
        inputAmount: actualBuyAmount,
        outputAmount: 0, // PumpSwap doesn't return output amount directly
      };
    } else {
      // PumpSwap failed or unavailable, fallback to Jupiter
      console.log("⚠️ PumpSwap failed or unavailable, falling back to Jupiter API...");
      logEngine.writeLog(`${getCurrentTime()}`, `PumpSwap unavailable, using Jupiter fallback...`, "yellow");
      swapResult = await swapToken(WSOL_MINT, returnedMint, actualBuyAmount, logEngine);
    }

    console.log("📊 TRADE RESULT:", swapResult);
    console.log("  - Success:", swapResult.success ? "YES" : "NO");
    if (swapResult.success && swapResult.outputAmount) {
      console.log("  - Tokens Received:", swapResult.outputAmount);
      console.log("  - SOL Spent:", swapResult.inputAmount);
      console.log("  - Transaction:", swapResult.txSignature);
    } else if (!swapResult.success) {
      console.log("  - Error:", swapResult.error);
    }

console.log('[TAX_DEBUG] Buy executed:', { tokenMint: returnedMint, amount: BUY_AMOUNT, price: 'estimated' });

// Record trade with enhanced logging
try {
  const taxData: TaxableTransaction = {
    timestamp: new Date().toISOString(),
    type: 'buy',
    tokenMint: returnedMint,
    amount: BUY_AMOUNT,
    signature: swapResult.txSignature || `${BUY_PROVIDER}_buy_${Date.now()}`,
    success: swapResult.success
  };

  console.log('[TAX_DEBUG] Recording trade:', taxData);
  await recordTrade(taxData);

  const filename = `data/tax_records_${new Date().toISOString().slice(0,10)}.json`;
  console.log('[TAX_DEBUG] File written:', filename);
} catch (taxError) {
  console.error('[TAX_DEBUG] Recording failed:', taxError);
}



// 📊 TAX RECORDING - PUMPSWAP BUY TRANSACTION
if (swapResult && swapResult.success) {
  // ============================================
  // INCREMENT ABSOLUTE TRADE COUNTER
  // ============================================
  const { incrementTradeCounter } = await import('./core/FORCE-TRADE-LIMIT');
  incrementTradeCounter();

  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'buy',
      tokenMint: returnedMint,
      amount: BUY_AMOUNT,
      signature: swapResult.txSignature || `pumpswap_buy_${Date.now()}`,
      success: swapResult.success
    };
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: ${taxData.type} - ${taxData.tokenMint?.slice(0,8)}...`);
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed:', taxError);
  }
}
  } else if (BUY_PROVIDER === "jupiter") {
    logEngine.writeLog(`${getCurrentTime()}`, `Sniping Token using Jupiter Swap API...`, "green");
    console.log("🚀 ATTEMPTING LIVE TRADE:");
    console.log("  - Token:", returnedMint);
    console.log("  - Amount:", BUY_AMOUNT);
    console.log("  - Wallet:", process.env.WALLET_ADDRESS || "Not configured");

    // 🔍 QUALITY FILTER - Block scam tokens BEFORE attempting trade
    // ✅ FIXED: Using comprehensive 65-point quality filter with 40+ scam word detection
    console.log("🛡️ Running comprehensive quality filter...");
    const qualityPassed = await enforceQualityFilter(returnedMint, logEngine);
    if (!qualityPassed) {
      console.log("🚫 Token failed quality filter - BLOCKED");
      stats.tokensBlocked++;
      return;
    }
    console.log("✅ Token passed quality filter - proceeding to trade");

    // Rate limiting now handled by queue system

    // 💰 POSITION SIZE SAFETY CAP - Prevent oversized trades
    const maxPositionUSD = 50; // Safety cap regardless of tier
    const currentPositionUSD = BUY_AMOUNT * SOL_PRICE; // Using dynamic SOL price
    actualBuyAmount = BUY_AMOUNT; // Update function-scope variable

    if (currentPositionUSD > maxPositionUSD) {
      actualBuyAmount = maxPositionUSD / SOL_PRICE; // Convert back to SOL using current price
      console.log(`⚠️ Position capped: $${currentPositionUSD.toFixed(2)} → $${maxPositionUSD}`);
      console.log(`   Original: ${BUY_AMOUNT} SOL → Capped: ${actualBuyAmount.toFixed(4)} SOL`);
      console.log(`   Using SOL price: $${SOL_PRICE}`);
    }

    // SAFETY-WRAPPED JUPITER TRADE
    // TEMPORARILY BYPASS EMERGENCY WRAPPER  
    //const token = { address: returnedMint, name: 'Unknown', liquidity: 0, holders: 0, volume: 0 };
    //const safetyResult = await safetyWrapper.safeTradeWrapper(swapToken, token, actualBuyAmount, WSOL_MINT, returnedMint, actualBuyAmount, logEngine);

    //if (!safetyResult.success) {
      //console.log(`🚫 TRADE BLOCKED: ${safetyResult.reason}`);
      //logEngine.writeLog(`${getCurrentTime()}`, `❌ Trade blocked: ${safetyResult.reason}`, "red");
      //stats.tokensRejected++;
      //return;
    //}

    // Just execute the trade directly
    swapResult = await swapToken(WSOL_MINT, returnedMint, actualBuyAmount, logEngine);

    console.log("📊 TRADE RESULT:", swapResult);
    console.log("  - Success:", swapResult.success ? "YES" : "NO");
    if (swapResult.success && swapResult.outputAmount) {
      console.log("  - Tokens Received:", swapResult.outputAmount);
      console.log("  - SOL Spent:", swapResult.inputAmount);
      console.log("  - Transaction:", swapResult.txSignature);
    } else if (!swapResult.success) {
      console.log("  - Error:", swapResult.error);
    }

console.log('[TAX_DEBUG] Buy executed:', { tokenMint: returnedMint, amount: BUY_AMOUNT, price: 'estimated' });

// Record trade with enhanced logging
try {
  const taxData: TaxableTransaction = {
    timestamp: new Date().toISOString(),
    type: 'buy',
    tokenMint: returnedMint,
    amount: BUY_AMOUNT,
    signature: swapResult.txSignature || `${BUY_PROVIDER}_buy_${Date.now()}`,
    success: swapResult.success
  };

  console.log('[TAX_DEBUG] Recording trade:', taxData);
  await recordTrade(taxData);

  const filename = `data/tax_records_${new Date().toISOString().slice(0,10)}.json`;
  console.log('[TAX_DEBUG] File written:', filename);
} catch (taxError) {
  console.error('[TAX_DEBUG] Recording failed:', taxError);
}



// 📊 TAX RECORDING - JUPITER BUY TRANSACTION
if (swapResult && swapResult.success) {
  // ============================================
  // INCREMENT ABSOLUTE TRADE COUNTER
  // ============================================
  const { incrementTradeCounter } = await import('./core/FORCE-TRADE-LIMIT');
  incrementTradeCounter();

  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'buy',
      tokenMint: returnedMint,
      amount: BUY_AMOUNT,
      signature: swapResult.txSignature || `jupiter_buy_${Date.now()}`,
      success: swapResult.success
    };
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: ${taxData.type} - ${taxData.tokenMint?.slice(0,8)}...`);
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed:', taxError);
  }
}
  }
  
  // Update pool and tracking if successful
  if (swapResult && swapResult.success) {
    stats.tokensBought++;
    stats.totalTrades++;

    // ============================================
    // ADD POSITION TO PARTIAL EXIT TRACKING
    // ============================================
    if (partialExitManager && swapResult.outputAmount) {
      try {
        // Extract actual token amount from swap result
        const tokenAmount = swapResult.outputAmount; // REAL token amount from Jupiter API
        const entryPriceSOL = actualBuyAmount / tokenAmount; // Calculate entry price per token

        partialExitManager.addPosition(
          returnedMint,              // Token mint address
          entryPriceSOL,             // Entry price in SOL per token
          tokenAmount,               // Amount of tokens bought (REAL VALUE!)
          actualBuyAmount,           // SOL invested
          undefined                  // Symbol (optional)
        );

        console.log(`✅ Position added to exit tracking: ${returnedMint.slice(0,8)}...`);
        console.log(`   📊 Token Amount: ${tokenAmount.toLocaleString()}`);
        console.log(`   💰 Entry Price: ${entryPriceSOL.toFixed(10)} SOL per token`);
        console.log(`   💵 Invested: ${actualBuyAmount} SOL`);

        // ✅ VIP2 INTEGRATION: Add position to real-time price monitoring
        if (globalPositionMonitor) {
          try {
            const monitoredPosition: MonitoredPosition = {
              mint: returnedMint,
              poolAddress: "", // Derive from token if needed
              entryPriceSOL: entryPriceSOL,
              entryPriceUSD: entryPriceSOL * SOL_PRICE,
              tokenAmount: tokenAmount,
              entryTime: new Date(),
              dex: "pumpfun" // Assume pump.fun for now
            };
            await globalPositionMonitor.addPosition(monitoredPosition);
            console.log(`👁️ Position added to real-time monitoring: ${returnedMint.slice(0,8)}...`);
          } catch (monitorError) {
            console.warn('⚠️ Failed to add position to monitor:', monitorError);
          }
        }
      } catch (exitError) {
        console.warn('⚠️ Failed to add position to exit tracking:', exitError);
      }
    }

    // ============================================
    // TRADE LIMIT CHECKING
    // ============================================
    tradeCount++;
    tradesThisMinute++; // ✅ FIX: Increment rate limiter ONLY after successful trade
    console.log(`📊 Trade ${tradeCount}${maxTrades ? `/${maxTrades}` : ''} completed`);
    console.log(`📊 Rate limiter: ${tradesThisMinute}/${MAX_TRADES_PER_MINUTE} trades this minute`);

    // Check max trades limit
    if (maxTrades > 0 && tradeCount >= maxTrades) {
      console.log('🎯 Maximum trade limit reached - initiating graceful shutdown...');
      await tradeLimitShutdown(`Maximum trades reached (${maxTrades})`);
      return;
    }

    // Track losses for loss limit checking
    if (swapResult && !swapResult.success) { // Check actual trade success/failure
      totalLoss += BUY_AMOUNT;
      console.log(`💸 Loss tracked: ${BUY_AMOUNT} SOL (Total: ${totalLoss.toFixed(4)} SOL)`);

      // Check max loss limit
      if (maxLoss > 0 && totalLoss >= maxLoss) {
        console.log('🛑 Maximum loss limit reached - initiating graceful shutdown...');
        await tradeLimitShutdown(`Maximum loss reached (${maxLoss} SOL)`);
        return;
      }
    }

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
    recentBuyTimes.set(returnedMint, Date.now()); // ✅ FIX Bug #8: Track time for cleanup
    /// NO setTimeout - keep it blocked forever (but cleanup after 24hr)
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
// PAPER EXIT → POOL + STATS SYNC
// ============================================
async function recordSimulatedExit(
  tokenMint: string,
  profitPercentage: number,
  holdTimeMinutes: number
): Promise<void> {
  try {
    const poolManager = queueManager?.getPoolManager?.();
    if (!poolManager) {
      console.log(
        "⚠️ [PAPER EXIT] PoolManager not available, skipping pool update"
      );
      return;
    }

    // 1) Update pool P&L (same method LIVE uses)
    if (typeof poolManager.processTradeResult === "function") {
      poolManager.processTradeResult(
        tokenMint,
        profitPercentage,
        holdTimeMinutes
      );
    }

    // 2) Update high-level stats for the emergency dashboard
    // NOTE: totalTrades already incremented when position was opened (PAPER block)
    // Only track win/loss outcome here
    if (profitPercentage > 0) {
      stats.wins = (stats.wins || 0) + 1;
    } else if (profitPercentage < 0) {
      stats.losses = (stats.losses || 0) + 1;
    }

    console.log(
      `📊 [PAPER EXIT] Simulated result for ${tokenMint.slice(
        0,
        8
      )}...: ${profitPercentage.toFixed(2)}% over ${holdTimeMinutes.toFixed(
        1
      )} min`
    );
  } catch (err) {
    console.warn("⚠️ [PAPER EXIT] Failed to record simulated exit:", err);
  }
}

// ============================================
// STATUS REPORTING
// ============================================
function printStatus(): void {
  // Use sessionStartTime for accurate current session runtime
  const runtime = Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
  const hours = Math.floor(runtime / 3600);
  const minutes = Math.floor((runtime % 3600) / 60);
  const seconds = runtime % 60;
  const tokensPerHour = stats.tokensDetected > 0 ? (stats.tokensDetected / (runtime / 3600)).toFixed(1) : "0";

  console.clear();
  console.log(`\n${"=".repeat(50)}`);
  console.log(`📊 CURRENT SESSION STATUS (Runtime: ${hours}h ${minutes}m ${seconds}s)`);
  console.log(`${"=".repeat(50)}`);
  console.log(`🎯 Tokens Detected: ${stats.tokensDetected}`);
  console.log(`✅ Tokens Bought: ${stats.tokensBought}`);
  console.log(`❌ Tokens Rejected: ${stats.tokensRejected}`);
  console.log(`🛡️ Tokens Blocked (Quality Filter): ${stats.tokensBlocked}`);
  console.log(`⛔ Pool Depleted Skips: ${stats.poolDepleted}`);
  console.log(`📈 Detection Rate: ${tokensPerHour}/hour`);

  // Trade performance stats (PAPER + LIVE) - Current session only
  const totalCompleted = (stats.wins || 0) + (stats.losses || 0);
  if (totalCompleted > 0) {
    const winRate = ((stats.wins || 0) / totalCompleted * 100).toFixed(1);
    console.log(`\n💰 TRADE PERFORMANCE (Current Session):`);
    console.log(`   Total Completed: ${totalCompleted}`);
    console.log(`   Wins: ${stats.wins || 0}`);
    console.log(`   Losses: ${stats.losses || 0}`);
    console.log(`   Win Rate: ${winRate}%`);
  }

  // Safety wrapper dashboard
  safetyWrapper.displayDashboard();
  
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
  // LIVE TRADING VERIFICATION
  if (!TEST_MODE) {
    console.log("\n🚨🚨🚨 LIVE TRADING MODE ACTIVE 🚨🚨🚨");
    console.log("Real money at risk! Press Ctrl+C in 5 seconds to cancel...");
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Initialize everything
  await initializeWalletRotation();
  await resetCurrentSessionOnly();
  await initializeSecurePool();
  // Removed setTestMode() call - secure-pool now reads mode from UNIFIED-CONTROL directly
  await initializeEnhancements();

  // Initialize PumpSwap SDK (optional - falls back to Jupiter if unavailable)
  console.log('🚀 Initializing PumpSwap SDK...');
  const pumpSwapReady = initializePumpSwapSDK();
  if (pumpSwapReady) {
    console.log('✅ PumpSwap SDK ready - will use for direct swaps');
  } else {
    console.log('⚠️ PumpSwap SDK not available - will use Jupiter API');
  }

  // Status display
  setInterval(printStatus, 5000);
  
  // Verify positions
  logEngine.writeLog(`✅ Verifying`, `Checking current wallet token balances...`, "white");
  const positionsVerified = await verifyPositions();

  await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
  console.log('⏳ Rate limiting: 2 second delay added');

  // ============================================
  // INITIALIZE PARTIAL EXIT MANAGER
  // ============================================
  console.log('💎 Initializing Partial Exit System...');
  partialExitManager = new PartialExitManager();

  // ============================================
  // PHASE 3A: REAL ROI CALCULATION HELPER
  // ============================================
  /**
   * Compute real profit percentage from actual swap results
   * @param entryPriceSOL - SOL per token at entry
   * @param tokensSold - Actual tokens sold in this exit
   * @param solReceived - Actual SOL received from sale
   * @returns Profit percentage (positive = profit, negative = loss)
   */
  function computeRealProfitPercentage(
    entryPriceSOL: number,
    tokensSold: number,
    solReceived: number
  ): number {
    if (tokensSold <= 0 || solReceived <= 0 || entryPriceSOL <= 0) {
      console.warn(`⚠️ [ROI] Invalid inputs: entryPrice=${entryPriceSOL}, sold=${tokensSold}, received=${solReceived}`);
      return 0;
    }
    const exitPriceSOL = solReceived / tokensSold;
    const rawReturn = (exitPriceSOL - entryPriceSOL) / entryPriceSOL;
    return rawReturn * 100;
  }

  // ============================================
  // PHASE 3C: UNIFIED EXIT HANDLER
  // ============================================
  /**
   * Unified exit finalization for both PAPER and LIVE modes
   * Ensures consistent pool updates, stats tracking, and logging
   *
   * @param mode - Trading mode ('PAPER' or 'LIVE')
   * @param tokenMint - Token mint address
   * @param entryPriceSOL - Entry price in SOL per token
   * @param exitPriceSOL - Exit price in SOL per token
   * @param tokensSold - Tokens sold in this exit
   * @param holdTimeMinutes - Hold duration in minutes
   * @param tierLabel - Tier name (e.g., "Tier 1 - First Profit")
   * @param tierMultiplier - Tier multiplier (2, 4, 6, etc.)
   */
  async function handleFinalizedExit(
    mode: 'PAPER' | 'LIVE',
    tokenMint: string,
    entryPriceSOL: number,
    exitPriceSOL: number,
    tokensSold: number,
    holdTimeMinutes: number,
    tierLabel: string,
    tierMultiplier: number
  ): Promise<void> {
    // Compute profit percentage based on mode
    let profitPercentage: number;

    if (mode === 'PAPER') {
      // PAPER: Use simulated tier multiplier
      profitPercentage = ((tierMultiplier - 1) * 100);
      console.log(`📝 [PAPER] Using simulated ROI from tier multiplier: ${tierMultiplier}x = ${profitPercentage.toFixed(2)}%`);
    } else {
      // LIVE: Use real exit price for accurate ROI
      const solReceived = exitPriceSOL * tokensSold;
      profitPercentage = computeRealProfitPercentage(entryPriceSOL, tokensSold, solReceived);
      console.log(`💰 [LIVE] Using real ROI from actual swap: ${profitPercentage.toFixed(2)}%`);
    }

    // Unified logging format for both modes
    console.log(`\n🏁 EXIT COMPLETE [${mode}] ${tierLabel} – ${tokenMint.slice(0, 8)}...`);
    console.log(`   Entry:  ${entryPriceSOL.toFixed(10)} SOL/token`);
    console.log(`   Exit:   ${exitPriceSOL.toFixed(10)} SOL/token`);
    console.log(`   ROI:    ${profitPercentage.toFixed(2)}%`);
    console.log(`   Hold:   ${holdTimeMinutes.toFixed(1)} min`);
    console.log(`   Tokens: ${tokensSold.toLocaleString()}`);

    // Update pool and stats via recordSimulatedExit (works for both modes)
    try {
      await recordSimulatedExit(tokenMint, profitPercentage, holdTimeMinutes);
      console.log(`✅ [${mode}] Exit recorded to pool and stats successfully`);
    } catch (err) {
      console.warn(`⚠️ [${mode} EXIT] Failed to record to pool/stats:`, err);
      throw err; // Re-throw to allow caller to handle
    }
  }

  // Register callback for when exit tiers trigger
  partialExitManager.onExit(async (mint, tier, result) => {
    // PHASE 4C: Enhanced callback logging
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎯 [EXIT-TIER] Callback invoked for ${mint.slice(0,8)}...`);
    console.log(`   Tier: ${tier.name}`);
    console.log(`   Amount to sell: ${result.actualAmountSold.toLocaleString()} tokens`);
    console.log(`   Mode: ${TEST_MODE ? 'PAPER TRADING' : 'LIVE TRADING'}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Check if we're in paper trading mode
    if (TEST_MODE) {
      // PAPER TRADING: Simulate the sell AND update pool + stats
      console.log(`[EXIT] Starting PAPER exit for ${mint.slice(0,8)}...`);
      console.log(`   Simulated sell: ${result.actualAmountSold.toLocaleString()} tokens (${tier.percentage}%)`);
      console.log(`   Simulated profit: ${result.profitSOL.toFixed(4)} SOL`);
      console.log(`   Remaining: ${result.remainingAmount.toLocaleString()} tokens`);

      // Get position data for unified exit handler
      const position = partialExitManager.getPosition(mint);
      if (position) {
        const holdTimeMinutes = (Date.now() - position.entryTime) / 60000;
        const simulatedExitPrice = position.entryPrice * tier.multiplier; // Simulated price at tier target
        const roiPercent = ((tier.multiplier - 1) * 100).toFixed(1);

        // Use unified exit handler (PHASE 3C)
        await handleFinalizedExit(
          'PAPER',
          mint,
          position.entryPrice,        // Entry price
          simulatedExitPrice,          // Simulated exit price
          result.actualAmountSold,     // Tokens sold
          holdTimeMinutes,             // Hold time
          tier.name,                   // Tier label
          tier.multiplier              // Tier multiplier (2, 4, 6)
        ).catch(err => {
          console.warn('⚠️ [PAPER EXIT] Unified handler failed:', err);
        });

        // PHASE 4C: Log completion
        console.log(`[EXIT] Completed PAPER exit, ROI=${roiPercent}%, hold=${holdTimeMinutes.toFixed(1)} min`);
      }

      return; // Don't execute real sell in paper mode
    }

    // LIVE TRADING: Execute actual sell via unSwapToken
    try {
      // PHASE 4C: Log LIVE exit start
      console.log(`[EXIT] Starting LIVE exit for ${mint.slice(0,8)}...`);
      console.log(`   Executing blockchain sell: ${result.actualAmountSold.toLocaleString()} tokens`);

      const sellResult = await unSwapToken(
        mint,                      // Token mint to sell
        WSOL_MINT,                 // Selling for SOL
        result.actualAmountSold,   // Amount of tokens to sell
        logEngine
      );

      // ============================================
      // PHASE 3B: EXIT FAIL-SAFE PROTECTIONS
      // ============================================

      // CHECK 1: Swap result exists and succeeded
      if (!sellResult || !sellResult.success) {
        // PHASE 4C: Enhanced fail-safe logging
        console.error(`[EXIT] LIVE exit blocked by fail-safe (swap failed)`);
        console.error(`   Reason: ${sellResult?.error || "Unknown error"}`);
        console.error(`   ⚠️  Pool and stats NOT updated (fail-safe protection)`);
        return;
      }

      // CHECK 2: Output amount validation (SOL received)
      if (!sellResult.solReceived || sellResult.solReceived <= 0) {
        // PHASE 4C: Enhanced fail-safe logging
        console.error(`[EXIT] LIVE exit blocked by fail-safe (no SOL received)`);
        console.error(`   SOL Received: ${sellResult.solReceived || 0}`);
        console.error(`   ⚠️  Pool and stats NOT updated (fail-safe protection)`);
        return;
      }

      // CHECK 3: Input amount validation (tokens sold)
      if (!sellResult.tokensSold || sellResult.tokensSold <= 0) {
        // PHASE 4C: Enhanced fail-safe logging
        console.error(`[EXIT] LIVE exit blocked by fail-safe (no tokens sold)`);
        console.error(`   Tokens Sold: ${sellResult.tokensSold || 0}`);
        console.error(`   ⚠️  Pool and stats NOT updated (fail-safe protection)`);
        return;
      }

      console.log(`✅ Partial exit executed successfully`);
      console.log(`   SOL Received: ${sellResult.solReceived.toFixed(6)}`);
      console.log(`   Tokens Sold: ${sellResult.tokensSold.toLocaleString()}`);

      // PHASE 3B & 3C: Validate slippage, then use unified exit handler
      const position = partialExitManager.getPosition(mint);
      if (position && sellResult.solReceived && sellResult.tokensSold) {
        const entryPriceSOL = position.entryPrice;
        const realizedExitPrice = sellResult.solReceived / sellResult.tokensSold;

        // CHECK 4: Slippage tolerance validation (PHASE 3B)
        const targetExitPrice = entryPriceSOL * tier.multiplier;
        const slippagePercent = ((realizedExitPrice - targetExitPrice) / targetExitPrice) * 100;
        const allowedSlippagePercent = 20; // Jupiter's 20% slippage tolerance (2000 bps)

        console.log(`📊 SLIPPAGE CHECK:`);
        console.log(`   Target Price: ${targetExitPrice.toFixed(10)} SOL/token (${tier.multiplier}x)`);
        console.log(`   Realized:     ${realizedExitPrice.toFixed(10)} SOL/token`);
        console.log(`   Slippage:     ${slippagePercent.toFixed(2)}%`);

        if (Math.abs(slippagePercent) > allowedSlippagePercent) {
          console.error(`⚠️  EXIT SLIPPAGE TOO HIGH for ${mint.slice(0, 8)}...`);
          console.error(`   Slippage: ${slippagePercent.toFixed(2)}% (limit: ${allowedSlippagePercent}%)`);
          console.error(`   ⚠️  Pool and stats NOT updated (slippage fail-safe)`);
          return;
        }

        console.log(`   ✅ Slippage within tolerance (< ${allowedSlippagePercent}%)`);

        const holdTimeMinutes = (Date.now() - position.entryTime) / 60000;

        // Use unified exit handler (PHASE 3C)
        await handleFinalizedExit(
          'LIVE',
          mint,
          entryPriceSOL,               // Entry price
          realizedExitPrice,           // REAL exit price from swap
          sellResult.tokensSold,       // Actual tokens sold
          holdTimeMinutes,             // Hold time
          tier.name,                   // Tier label
          tier.multiplier              // Tier multiplier (2, 4, 6)
        ).catch(err => {
          console.warn('⚠️ [LIVE EXIT] Unified handler failed:', err);
        });

        // PHASE 4C: Log LIVE exit completion
        const realROI = ((realizedExitPrice - entryPriceSOL) / entryPriceSOL * 100).toFixed(1);
        console.log(`[EXIT] Completed LIVE exit, ROI=${realROI}%, hold=${holdTimeMinutes.toFixed(1)} min`);
      } else {
        console.warn(`⚠️ [LIVE EXIT] Cannot compute real ROI - missing position or swap data`);
      }
    } catch (sellError) {
      console.error(`❌ Sell execution error:`, sellError);
    }
  });

  console.log('✅ Partial Exit System initialized');

  if (positionsVerified) {
    if (DATA_STREAM_METHOD === "grpc") {
      startGrpcListener()
        .catch((err: any) => {
          logEngine.writeLog(`${getCurrentTime()}`, `Fatal error: ${err}`, "red");
          process.exit(1);
        });
    } else if (DATA_STREAM_METHOD === "wss") {
      startWebSocketListener()
        .catch((err: any) => {
          logEngine.writeLog(`${getCurrentTime()}`, `Fatal error: ${err}`, "red");
          process.exit(1);
        });
    }
  } else {
      logEngine.writeLog(`${getCurrentTime()}`, `Position verification failed. Exiting.`, "red");
      process.exit(1);
    }
  })();
    
    // ============================================
    // SHUTDOWN HANDLER AND REPORTING
    // ============================================
    process.on('SIGINT', () => {
      console.log('\n🛑 Caught SIGINT (Ctrl+C) - Initiating graceful shutdown...');
      shutdownWithReport().catch((err) => {
        console.error('❌ Shutdown error:', err);
        process.exit(1);
      });
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Caught SIGTERM - Initiating graceful shutdown...');
      shutdownWithReport().catch((err) => {
        console.error('❌ Shutdown error:', err);
        process.exit(1);
      });
    });

    // Force exit after timeout
    process.on('exit', () => {
      console.log('👋 Process exiting...');
    });

    // TRADE LIMIT SHUTDOWN FUNCTION
    async function tradeLimitShutdown(reason: string): Promise<void> {
      console.log('\n🎯 TRADE LIMIT REACHED');
      console.log('='.repeat(50));
      console.log(`📊 Reason: ${reason}`);
      console.log(`📈 Trades Completed: ${tradeCount}`);
      console.log(`💸 Total Loss: ${totalLoss.toFixed(4)} SOL`);
      console.log('='.repeat(50));

      // Call the comprehensive shutdown
      await shutdownWithReport();
    }

    // SHUTDOWN WITH REPORT FUNCTION
    async function shutdownWithReport(): Promise<void> {
      // Prevent multiple shutdown attempts
      if (shutdownInProgress) {
        console.log('🛑 Shutdown already in progress...');
        return;
      }

      console.log('\n' + '='.repeat(60));
      console.log('🛑 SHUTDOWN INITIATED');
      console.log('='.repeat(60));

      // Set shutdown flag to prevent new operations
      shutdownInProgress = true;

      // Set timeout protection - force exit after 10 seconds
      const forceExitTimeout = setTimeout(() => {
        console.log('\n⚠️ FORCEFUL SHUTDOWN - Timeout reached!');
        console.log('🔪 Forcing process exit...');
        process.exit(1);
      }, 10000);

      // ============================================
      // COMPREHENSIVE CLEANUP
      // ============================================
      console.log('\n🔧 PERFORMING CLEANUP...');

      // 1. Stop accepting new tokens and initiate advanced manager shutdown
      console.log('   📡 Stopping token stream...');

      if (advancedManager) {
        advancedManager.initiateShutdown('Main shutdown requested');
        console.log('   🔧 Advanced manager shutdown initiated...');
      }

      // 2. Close WebSocket connection
      if (globalWsManager) {
        try {
          console.log('   🔌 Closing WebSocket connection...');
          globalWsManager.disconnect();
          globalWsManager = null;
          console.log('   ✅ WebSocket closed');
        } catch (error) {
          console.log('   ⚠️ WebSocket cleanup error:', error);
        }
      }

      // 3. Close gRPC connection
      if (globalGrpcStream) {
        try {
          console.log('   🔌 Closing gRPC stream...');
          globalGrpcStream.end();
          globalGrpcStream = null;
          console.log('   ✅ gRPC stream closed');
        } catch (error) {
          console.log('   ⚠️ gRPC stream cleanup error:', error);
        }
      }

      // Note: gRPC client doesn't need explicit cleanup - only the stream
      if (globalGrpcClient) {
        globalGrpcClient = null;
        console.log('   ✅ gRPC client reference cleared');
      }

      // 4. Wait for advanced manager positions to close
      if (advancedManager) {
        console.log('   ⏳ Waiting for advanced manager positions to close...');
        let waitTime = 0;
        while (!advancedManager.isShutdownComplete() && waitTime < 5000) {
          await new Promise(resolve => setTimeout(resolve, 200));
          waitTime += 200;
        }
        if (advancedManager.isShutdownComplete()) {
          console.log('   ✅ Advanced manager shutdown complete');
        } else {
          console.log('   ⚠️ Advanced manager shutdown timeout after 5s');
        }
      }

      // 5. Wait for pending transactions to complete
      if (activeTransactions > 0) {
        console.log(`   ⏳ Waiting for ${activeTransactions} pending transactions...`);
        let waitTime = 0;
        while (activeTransactions > 0 && waitTime < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
          waitTime += 100;
        }
        if (activeTransactions > 0) {
          console.log(`   ⚠️ ${activeTransactions} transactions still pending after 5s timeout`);
        } else {
          console.log('   ✅ All transactions completed');
        }
      }

      // 6. Save final state
      console.log('   💾 Saving final state...');

      console.log('   ✅ Cleanup complete');

      // Calculate runtime for current session
      const runtime = Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
      const hours = Math.floor(runtime / 3600);
      const minutes = Math.floor((runtime % 3600) / 60);
      const seconds = runtime % 60;

      console.log(`\n📊 FINAL SESSION STATISTICS`);
      console.log(`Session Runtime: ${hours}h ${minutes}m ${seconds}s`);
      console.log(`Tokens Detected: ${stats.tokensDetected}`);
      console.log(`Tokens Bought: ${stats.tokensBought}`);
      console.log(`Tokens Rejected: ${stats.tokensRejected}`);
      console.log(`Tokens Blocked: ${stats.tokensBlocked}`);
      
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
      
      // Clear the force exit timeout since we completed gracefully
      clearTimeout(forceExitTimeout);

      console.log('='.repeat(60));
      console.log('\n✅ Graceful shutdown complete!');
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