// index.ts - Main controller with Pool integration (CORRECTED VERSION)
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
import { LAMPORTS_PER_SOL, Connection, Logs, PublicKey } from "@solana/web3.js";

// Import enhanced Pool features
import { TokenQueueManager } from "./enhanced/token-queue-system";
import { PerformanceLogger } from "./enhanced/performanceLogger";
import { TokenAnalyzer } from "./enhanced/tokenAnalyzer";
import { masterConfig } from "./enhanced/masterConfig";

// Load environment variables
const env = validateEnv();
const RPC_WSS_URI = env.RPC_WSS_URI;
const GRPC_HTTP_URI = env.GRPC_HTTP_URI;
const GRPC_AUTH_TOKEN = env.GRPC_AUTH_TOKEN || "";

// Global Variables
const DATA_STREAM_METHOD = config.data_stream.method || "wss";
const DATA_STREAM_MODE = config.data_stream.mode || "program";
const DATA_STREAM_PROGRAMS = config.data_stream.program;
const DATA_STREAM_PROGRAMS_LOG_DISCRIMINATORS = DATA_STREAM_PROGRAMS.filter((p) => p.enabled).map((p) => p.log_discriminator);
const DATA_STREAM_WALLETS = config.data_stream.wallet;
let activeTransactions = 0;
const MAX_CONCURRENT = config.concurrent_transactions;
const CHECK_MODE = config.checks.mode || "full";
const WALLET_MONITOR_INTERVAL = config.token_sell.wallet_token_balances_monitor_interval || 10000;

// Enhanced Pool management
// Enhanced Pool management
let tokenQueueManager: any = null;  // Single declaration - using 'any' to avoid type errors
let performanceLogger: PerformanceLogger | null = null;
let tokenAnalyzer: TokenAnalyzer | null = null;

// Trading variables
const BUY_PROVIDER = config.token_buy.provider;
const BUY_AMOUNT = config.token_buy.sol_amount;
const SIM_MODE = config.checks.simulation_mode || false;
const PLAY_SOUND = config.token_buy.play_sound || false;
const OPEN_BROWSER = config.token_buy.open_browser || false;
const SKIP_COPY_TRADE_SELL = config.token_sell.jupiter.skip_sell_copy_trade || true;
const WSOL_MINT = config.wsol_pc_mint;
let handledMints: HandledMint[] = [];

// Global shutdown flag
let isShuttingDown = false;
let shutdownTimer: NodeJS.Timeout | null = null;

// Determine actual mode based on environment and config
const IS_TEST_MODE = process.env.TEST_MODE === "true" || process.env.SIMULATION_MODE === "true" || SIM_MODE;

// ====================
// SHUTDOWN FUNCTIONS
// ====================

// Graceful shutdown function
async function gracefulShutdown(reason: string): Promise<void> {
  if (isShuttingDown) return;
  
  isShuttingDown = true;
  console.log(`\n${"=".repeat(50)}`);
  console.log(`📊 INITIATING GRACEFUL SHUTDOWN: ${reason}`);
  console.log(`${"=".repeat(50)}`);
  
  // Check for open positions
  const positions = await selectAllPositions();
  
  if (positions.length > 0) {
    console.log(`⏳ Waiting for ${positions.length} positions to close...`);
    console.log(`⚠️  Positions will be closed at market price in 30 seconds if still open`);
    
    let waitTime = 0;
    const maxWaitTime = 30000;
    
    while (waitTime < maxWaitTime) {
      const currentPositions = await selectAllPositions();
      if (currentPositions.length === 0) {
        console.log(`✅ All positions closed naturally`);
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      waitTime += 5000;
      
      console.log(`⏳ Still waiting... ${currentPositions.length} positions open`);
    }
  }
  
  // Generate final reports
  console.log(`\n📊 Generating final reports...`);
  
  if (tokenQueueManager) {
    const stats = tokenQueueManager.getPoolManager().getPoolSummary();
    
    // FIX: Calculate P&L correctly
    const actualPnL = stats.currentPool - masterConfig.pool.initialPool;
    const growthPercent = ((stats.currentPool / masterConfig.pool.initialPool - 1) * 100);
    
    console.log(`\n${"=".repeat(70)}`);
    console.log(`📈 FINAL TRADING SUMMARY`);
    console.log(`${"=".repeat(70)}`);
    console.log(`⏱️  Runtime: ${masterConfig.runtime.duration} seconds (${(masterConfig.runtime.duration / 60).toFixed(1)} minutes)`);
    console.log(`💰 Initial Pool: $${masterConfig.pool.initialPool.toFixed(2)}`);
    console.log(`💵 Final Pool: $${stats.currentPool.toFixed(2)}`);
    console.log(`📈 Total Growth: ${growthPercent.toFixed(2)}%`);
    console.log(`💸 Total P&L: $${actualPnL.toFixed(2)}`); // FIXED P&L calculation
    console.log(`🎯 Target Pool: $${masterConfig.pool.targetPool.toFixed(2)}`); // Use actual target from config
    console.log(`📊 Target Progress: ${((stats.currentPool / masterConfig.pool.targetPool) * 100).toFixed(2)}%`);
    console.log(`\n📊 TRADING STATISTICS:`);
    console.log(`  Total Trades: ${stats.totalTrades}`);
    console.log(`  Win Rate: ${stats.winRate.toFixed(1)}%`);
    console.log(`  Profitable Trades: ${stats.profitableTrades}`);
    console.log(`  ROI: ${stats.roi.toFixed(2)}%`);
    console.log(`${"=".repeat(70)}`);
    
    // Save final state to file
    const finalReport = {
      timestamp: new Date().toISOString(),
      runtime: masterConfig.runtime.duration,
      initialPool: masterConfig.pool.initialPool,
      finalPool: stats.currentPool,
      totalGrowth: growthPercent,
      totalPnL: actualPnL, // FIXED
      targetPool: masterConfig.pool.targetPool,
      targetProgress: (stats.currentPool / masterConfig.pool.targetPool) * 100,
      totalTrades: stats.totalTrades,
      winRate: stats.winRate,
      roi: stats.roi,
      reason: reason
    };
    
    // Save to file
    const fs = require('fs');
    const path = require('path');
    
    // Ensure data directory exists
    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data', { recursive: true });
    }
    
    const reportPath = `./data/session-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
    console.log(`\n💾 Session report saved to: ${reportPath}`);
    
    // GENERATE PERFORMANCE LOG CSV
    const performanceLogPath = './data/performance_log.csv';
    const csvHeader = 'Timestamp,InitialPool,FinalPool,TotalPnL,GrowthPercent,TotalTrades,WinRate,Runtime\n';
    const csvRow = `${new Date().toISOString()},${masterConfig.pool.initialPool},${stats.currentPool.toFixed(2)},${actualPnL.toFixed(2)},${growthPercent.toFixed(2)},${stats.totalTrades},${stats.winRate.toFixed(1)},${masterConfig.runtime.duration}\n`;
    
    if (!fs.existsSync(performanceLogPath)) {
      fs.writeFileSync(performanceLogPath, csvHeader + csvRow);
    } else {
      fs.appendFileSync(performanceLogPath, csvRow);
    }
    console.log(`📊 Performance log updated: ${performanceLogPath}`);
  }
  
  console.log(`\n✅ Shutdown complete. Exiting...`);
  process.exit(0);
}

// Check target pool
async function checkTargetPool(): Promise<void> {
  if (!tokenQueueManager) return;
  
  const stats = tokenQueueManager.getPoolManager().getPoolSummary();
  
  // Use masterConfig.pool.targetPool instead of hardcoded value
  if (stats.currentPool >= masterConfig.pool.targetPool) {
    console.log(`\n🎯 TARGET POOL REACHED! $${stats.currentPool.toFixed(2)} >= $${masterConfig.pool.targetPool}`);
    await gracefulShutdown('Target pool reached');
  }
}

// Setup runtime timer
function setupRuntimeTimer(): void {
  const duration = masterConfig.runtime.duration;
  
  if (duration && duration > 0) {
    console.log(`⏰ Bot will run for ${duration} seconds (${(duration / 60).toFixed(1)} minutes)`);
    
    shutdownTimer = setTimeout(() => {
      gracefulShutdown('Runtime limit reached');
    }, duration * 1000);
    
    let elapsed = 0;
    const countdownInterval = setInterval(() => {
      elapsed += 60;
      const remaining = duration - elapsed;
      
      if (remaining > 0) {
        console.log(`⏰ Time remaining: ${(remaining / 60).toFixed(1)} minutes`);
      } else {
        clearInterval(countdownInterval);
      }
    }, 60000);
  } else {
    console.log(`⏰ Bot will run indefinitely (duration = 0)`);
  }
}

// Handle manual shutdown signals
process.on('SIGINT', () => {
  console.log('\n⚠️  Received SIGINT (Ctrl+C)');
  gracefulShutdown('Manual shutdown (Ctrl+C)');
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Received SIGTERM');
  gracefulShutdown('System shutdown signal');
});

// ====================
// HELPER FUNCTIONS
// ====================

// Helper Functions
function getCurrentTime(): string {
  const now = new Date();
  return now.toTimeString().split(" ")[0]; // returns "HH:MM:SS"
}

// Initialize enhanced features
async function initializeEnhancements(): Promise<void> {
  console.log('🚀 Initializing sol-bot enhanced features...');
  
  // Create connection for other components
  const connection = new Connection(masterConfig.network.rpcEndpoints[0], 'confirmed');
  
  // Initialize the token queue manager (ONLY ONCE!)
  tokenQueueManager = new TokenQueueManager(
    masterConfig.network.rpcEndpoints[0],  // RPC URL
    './data/pending_tokens.csv',           // CSV path
    masterConfig.pool.initialPool,         // Initial pool amount
    {
      positionSize: masterConfig.pool.positionSize,
      positionSizeUSD: masterConfig.pool.positionSize * 170,
      maxPositions: masterConfig.pool.maxPositions,
      stopLoss: masterConfig.exit.stopLoss,
      takeProfit: [masterConfig.exit.takeProfit1, masterConfig.exit.takeProfit2, masterConfig.exit.takeProfit3],
      minLiquidity: masterConfig.entry.minLiquidity,
      maxMarketCap: masterConfig.entry.maxMarketCap,
      minHolders: masterConfig.entry.minHolders,
      compoundProfits: masterConfig.pool.compoundProfits,
      testMode: IS_TEST_MODE,
      exit: masterConfig.exit,
      maxHoldTime: masterConfig.exit.maxHoldTime,
      saveTradeHistory: masterConfig.saveTradeHistory
    }
  );
  
  console.log('✅ TokenQueueManager initialized');
  
  // Initialize performance tracking
  performanceLogger = new PerformanceLogger(connection);
  tokenAnalyzer = new TokenAnalyzer(performanceLogger);
  
  console.log("✅ Enhanced features initialized");
  console.log(`💰 Initial Pool: $${masterConfig.pool.initialPool}`);
  console.log(`📊 Position Size: ${masterConfig.pool.positionSize} SOL`);
  console.log(`🎯 5x+ Detection: ENABLED`);
  console.log(`💎 Tiered Exits: ENABLED`);
}

async function monitor5xOpportunities(): Promise<void> {
  if (!tokenQueueManager || !tokenAnalyzer) return;
  
  setInterval(() => {
    if (isShuttingDown) return; // Don't process if shutting down
    
    const positions = tokenQueueManager?.getActivePositions() || [];
    
    positions.forEach((position: any) => {
      const decision = tokenAnalyzer!.analyzeToken(
        position.tokenMint,
        position.currentPrice,
        position.volume || 0,
        position.holdTime,
        position.currentGain
      );
      
      if (decision.confidence > 0.7 && decision.shouldHold) {
        console.log(`💎 5x+ Signal: Extending hold for ${position.tokenMint.slice(0,8)}...`);
        tokenQueueManager?.extendHold(position.tokenMint, decision.extendMinutes);
      }
    });
  }, 30000); // Check every 30 seconds
}

// Verify positions function
async function verifyPositions(): Promise<boolean> {
  try {
    // Get current wallet using the wallet handler
    const walletAddress: string | null = getWalletAddress();
    if (!walletAddress) {
      const currentTime = getCurrentTime();
      logEngine.writeLog(`${currentTime}`, `Invalid or missing wallet address while using ${BUY_PROVIDER} as provider.`, "red");
      if (BUY_PROVIDER === "sniperoo")
        logEngine.writeLog(`${currentTime}`, `Cannot verify positions. Please make sure to add a valid SNIPEROO_API_KEY and PUBKEY.`, "red");
      if (BUY_PROVIDER === "jupiter") 
        logEngine.writeLog(`${currentTime}`, `Cannot verify positions. Please make sure to add a valid PRIVATE_KEY.`, "red");
      logEngine.writeLog(`${currentTime}`, `Press ESC to close this application ...`, "red");
      return false;
    }

    // Get all token accounts
    const tokenBalances: TokenAccountInfo[] = await getWalletTokenBalances(walletAddress);
    if (tokenBalances.length === 0) {
      const currentTime = getCurrentTime();

      // Remove all tokens from db for this wallet
      const deleteConfirmation = await deletePositionsByWallet(walletAddress);
      if (deleteConfirmation) {
        logEngine.writeLog(`📜 Database`, `No tokens in wallet! Removed all positions`, "yellow");
        logEngine.writeLog(`🔎 ${currentTime}`, `Looking for tokens...`, "white");
        return true;
      }

      // Return false if not true
      logEngine.writeLog(`${currentTime}`, `Cannot remove tracked positions. Manually remove database.`, "red");
      logEngine.writeLog(`${currentTime}`, `Press ESC to close this application ...`, "red");
      return false;
    }

    // Get all stored positions
    const storedPositions: NewPositionRecord[] = await selectAllPositions();
    if (storedPositions.length === 0) {
      return true;
    }

    // Check if each stored position is still present in the token balances
    for (const position of storedPositions) {
      // Check if the position's mint exists in token balances
      const matchingToken = tokenBalances.find((balance) => balance.mint === position.mint);

      if (!matchingToken || Number(matchingToken.amount) === 0) {
        await deletePositionByWalletAndMint(walletAddress, position.mint);
        logEngine.writeLog(`📜 Database`, `Token ${shortenAddress(position.mint)} no longer found in wallet. Removed from database`, "yellow");
      } else {
        // Check if the amount matches
        const currentDecimal = matchingToken.decimals;
        let initialTokens = position.init_tokens;
        const currentTokens = Number(matchingToken.amount);

        if (initialTokens !== currentTokens) {
          const factor = 10 ** currentDecimal;
          if (initialTokens % 1 !== 0) {
            initialTokens = Math.round(initialTokens * factor);
          }
          const storedSol = position.init_sol;

          // Get new sol amount
          const pricePerToken = storedSol / initialTokens;
          const newSolMount = pricePerToken * currentTokens;

          // Amount has changed
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
    logEngine.writeLog(`${getCurrentTime()}`, `Verification issue: ${err}`, "red");
    return false;
  }
}

// Monitor positions
async function monitorPositions(): Promise<void> {
  if (activeTransactions === 0) {
    const positions: NewPositionRecord[] = await selectAllPositions();
    if (positions.length !== 0) {
      logEngine.writeLog(`✅ Verifying`, `Checking token balances for outside changes...`, "white");
      verifyPositions();
    }
  }
  setTimeout(monitorPositions, WALLET_MONITOR_INTERVAL);
}

// WebSocket Listener - INTEGRATED IMPLEMENTATION
async function startWebSocketListener(): Promise<void> {
  logEngine.writeLog(`✅ Starting Sniper via Websocket`, ``, "white", true);
  
  try {
    const connection = new Connection(masterConfig.network.rpcEndpoints[0], 'confirmed');
    
    // Program IDs to monitor
    const PUMP_FUN_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
    const RAYDIUM_PROGRAM = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
    
    let tokenCount = 0;
    
    console.log(`🔍 Connecting to token programs...`);
    console.log(`   📍 Pump.fun: ${PUMP_FUN_PROGRAM.slice(0, 8)}...`);
    console.log(`   📍 Raydium: ${RAYDIUM_PROGRAM.slice(0, 8)}...`);
    
    // Subscribe to Pump.fun logs
    const pumpSubscriptionId = connection.onLogs(
      new PublicKey(PUMP_FUN_PROGRAM),
      async (logs: Logs, context: any) => {
        // Debug: Show we're receiving data
        if (tokenCount % 100 === 0) {
          console.log(`📡 Activity: ${tokenCount} events processed`);
        }
        tokenCount++;
        
        // Look for new token creation
        const hasInitializeMint = logs.logs.some((log: string) => 
          log.includes('InitializeMint2') ||
          log.includes('InitializeMint') ||
          log.includes('initialize2')
        );

        if (hasInitializeMint && tokenQueueManager) {
          const signature = logs.signature;
          const timestamp = new Date().toLocaleTimeString();
          
          console.log(`\n🎯 NEW PUMP.FUN TOKEN DETECTED!`);
          console.log(`   📝 Signature: ${signature.slice(0, 32)}...`);
          console.log(`   ⏰ Time: ${timestamp}`);
          
          // Extract token mint
          let tokenMint: string | null = null;
          
          // Try to extract mint from logs
          for (const log of logs.logs) {
            // Look for mint addresses in logs (44 character base58 strings)
            const matches = log.match(/[1-9A-HJ-NP-Za-km-z]{44}/g);
            if (matches && matches.length > 0) {
              tokenMint = matches[0];
              break;
            }
          }
          
          // If no mint found, try using existing function
          if (!tokenMint && typeof getMintFromSignature === 'function') {
            const mintData = await getMintFromSignature(signature, false);
            tokenMint = mintData ? mintData.toString() : null;
          }
          
          // Fallback: generate test mint for testing
          if (!tokenMint) {
            tokenMint = `TEST${Date.now()}${Math.random().toString(36).substring(7)}`;
            console.log(`   ⚠️ Using test mint (extraction failed)`);
          }
          
          if (tokenMint) {
            console.log(`   🪙 Token Mint: ${tokenMint.slice(0, 32)}...`);
            
            // Feed into your queue system
            const result = await tokenQueueManager.onNewTokenDetected(signature, tokenMint);
            console.log(`   📊 Queue Status: ${result.status}`);
          }
        }
      },
      'confirmed'
    );

    // Subscribe to Raydium logs
    const raydiumSubscriptionId = connection.onLogs(
      new PublicKey(RAYDIUM_PROGRAM),
      async (logs: Logs, context: any) => {
        tokenCount++;
        
        // Look for pool initialization
        const hasPoolInit = logs.logs.some((log: string) => 
          log.includes('initialize2') ||
          log.includes('init_pc_amount')
        );

        if (hasPoolInit && tokenQueueManager) {
          const signature = logs.signature;
          const timestamp = new Date().toLocaleTimeString();
          
          console.log(`\n🎯 NEW RAYDIUM POOL DETECTED!`);
          console.log(`   📝 Signature: ${signature.slice(0, 32)}...`);
          console.log(`   ⏰ Time: ${timestamp}`);
          
          // Extract token mint
          let tokenMint: string | null = null;
          
          for (const log of logs.logs) {
            const matches = log.match(/[1-9A-HJ-NP-Za-km-z]{44}/g);
            if (matches && matches.length > 0) {
              tokenMint = matches[0];
              break;
            }
          }
          
          if (tokenMint) {
            console.log(`   🪙 Token Mint: ${tokenMint.slice(0, 32)}...`);
            await tokenQueueManager.onNewTokenDetected(signature, tokenMint);
          }
        }
      },
      'confirmed'
    );

    console.log(`\n✅ WebSocket Connected Successfully!`);
    console.log(`📡 Monitoring pump.fun and Raydium for new tokens...`);
    console.log(`🏦 Pool system active - will manage trades automatically\n`);
    
    // Store subscription IDs for cleanup if needed
    (global as any).wsSubscriptions = {
      pump: pumpSubscriptionId,
      raydium: raydiumSubscriptionId,
      connection: connection
    };
    
  } catch (error) {
    console.error(`❌ WebSocket connection failed: ${error}`);
    console.log(`🔄 Retrying connection in 5 seconds...`);
    
    // Retry connection
    setTimeout(() => startWebSocketListener(), 5000);
  }
}

// gRPC Listener - Placeholder (not implemented)
async function startGrpcListener(): Promise<void> {
  logEngine.writeLog(`✅ Starting Sniper via gRPC...`, ``, "white", true);
  console.log(`❌ gRPC mode not implemented yet`);
  console.log(`🔄 Switching to WebSocket mode...`);
  
  // Fallback to WebSocket
  await startWebSocketListener();
}

// Process purchase with Pool integration (this is the next function)
async function processPurchase(returnedMint: string): Promise<void> {
  if (!returnedMint) return;
  
  // Check pool availability
  if (tokenQueueManager && !tokenQueueManager.getPoolManager().canExecuteTrade()) {
    logEngine.writeLog(`${getCurrentTime()}`, `Pool depleted, skipping trade`, "yellow");
    return;
  }
  
  // ... rest of the function code ...
  
  return;
}  // <-- MAKE SURE THIS CLOSING BRACKET EXISTS!

// ====================
// MAIN STARTUP
// ====================
(async () => {
  logEngine.writeLog(`\n====== sol-bot initiated ======`, ``, "white", true, true);
  console.clear();
  
  // Display startup information with correct mode
  logEngine.writeLog(`🚀 Starting`, `sol-bot v5.0.0 with Pool Integration`, "blue", true);
  logEngine.writeLog(`💰 Initial Pool`, `$${masterConfig.pool.initialPool}`, "white");
  logEngine.writeLog(`📊 Position Size`, `${masterConfig.pool.positionSize} SOL`, "white");
  logEngine.writeLog(`🎯 Target Pool`, `$${masterConfig.pool.targetPool}`, "white");
  
  // Display correct mode based on all test flags
  if (IS_TEST_MODE) {
    logEngine.writeLog(`🎯 Mode`, `TEST/SIMULATION MODE`, "yellow");
    logEngine.writeLog(`⚠️ Note`, `Trading is simulated - no real transactions`, "yellow");
  } else {
    logEngine.writeLog(`🎯 Mode`, `LIVE TRADING`, "green");
    logEngine.writeLog(`⚠️ Warning`, `Real money at risk!`, "red");
  }
  
  // Initialize enhanced features
  await initializeEnhancements();

  // Setup shutdown timer
  setupRuntimeTimer();

  // Check target pool periodically
  setInterval(() => {
    checkTargetPool();
  }, 30000);
  
  // Start monitoring
  await monitor5xOpportunities();
  
  // Verify positions
  logEngine.writeLog(`✅ Verifying`, `Checking current wallet token balances...`, "white");
  const positionsVerified = await verifyPositions();
  
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


// Test token injection after 10 seconds
setTimeout(() => {
  console.log('🧪 FORCING TEST TOKEN...');
  if (tokenQueueManager) {
    // Call with correct parameters: signature and tokenMint
    tokenQueueManager.onNewTokenDetected(
      'TestTx' + Date.now(),                    // Unique signature
      'So11111111111111111111111111111111111112' // Valid-looking Solana address
    );
    console.log('✅ Test token injection complete!');
  } else {
    console.log('❌ TokenQueueManager not initialized!');
  }
}, 10000);
})();  // <-- This closes the main async function
