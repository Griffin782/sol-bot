import { Connection, PublicKey, Logs } from '@solana/web3.js';
import { TokenQueueManager } from './token-queue-system';
// Import the unified configuration
import { MASTER_SETTINGS } from '../core/UNIFIED-CONTROL';

// ============================================
// CONFIGURATION FROM MASTER CONFIG
// ============================================
console.log("=== LOADING CONFIGURATION FROM UNIFIED-CONTROL.ts ===");
console.log(`Initial Pool: $${MASTER_SETTINGS.pool.initialPool}`);
console.log(`Duration: ${MASTER_SETTINGS.limits.duration === 0 ? 'Unlimited' : MASTER_SETTINGS.limits.duration + ' seconds'}`);
console.log(`Max Positions: ${MASTER_SETTINGS.pool.maxPositions}`);
console.log(`Position Size: ${MASTER_SETTINGS.pool.positionSize} SOL`);
console.log("==================================================\n");

// Map MASTER_SETTINGS values to local config
const config = {
  // Network settings
  rpcUrl: MASTER_SETTINGS.network.rpcEndpoints[0] || 'https://api.mainnet-beta.solana.com',
  wsUrl: MASTER_SETTINGS.network.wsEndpoints[0] || 'wss://api.mainnet-beta.solana.com',

  // Program ID (this stays hardcoded as it's specific to pump.fun)
  pumpFunProgramId: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',

  // Runtime settings from MASTER_SETTINGS
  testDurationMs: MASTER_SETTINGS.limits.duration * 1000, // Convert seconds to milliseconds
  pauseBetweenScans: MASTER_SETTINGS.limits.pauseBetweenScans,
  checkInterval: MASTER_SETTINGS.limits.checkInterval,
  heartbeatInterval: MASTER_SETTINGS.limits.heartbeatInterval,

  // Pool settings from MASTER_SETTINGS
  initialPool: MASTER_SETTINGS.pool.initialPool,
  targetPool: MASTER_SETTINGS.pool.targetPool,
  positionSize: MASTER_SETTINGS.pool.positionSize,
  maxPositions: MASTER_SETTINGS.pool.maxPositions,
  compoundProfits: MASTER_SETTINGS.pool.compoundProfits,
  minPoolReserve: MASTER_SETTINGS.pool.minPoolReserve,
  maxPoolRisk: MASTER_SETTINGS.pool.maxPoolRisk,
  
  // Entry criteria from MASTER_SETTINGS
  minLiquidity: MASTER_SETTINGS.entry.minLiquidity,
  maxLiquidity: MASTER_SETTINGS.entry.maxLiquidity,
  minMarketCap: MASTER_SETTINGS.entry.minMarketCap,
  maxMarketCap: MASTER_SETTINGS.entry.maxMarketCap,
  minHolders: MASTER_SETTINGS.entry.minHolders,
  maxHolders: MASTER_SETTINGS.entry.maxHolders,
  minWhaleCount: MASTER_SETTINGS.entry.minWhaleCount,
  minWhaleBuyVolume: MASTER_SETTINGS.entry.minWhaleBuyVolume,
  honeypotCheck: MASTER_SETTINGS.entry.honeypotCheck,
  rugCheck: MASTER_SETTINGS.entry.rugCheck,
  maxSlippage: MASTER_SETTINGS.entry.maxSlippage,

  // Exit strategy from MASTER_SETTINGS
  stopLoss: MASTER_SETTINGS.exit.stopLoss,
  takeProfit1: MASTER_SETTINGS.exit.takeProfit1,
  takeProfit2: MASTER_SETTINGS.exit.takeProfit2,
  takeProfit3: MASTER_SETTINGS.exit.takeProfit3,
  maxHoldTime: MASTER_SETTINGS.exit.maxHoldTime,
  minHoldTime: MASTER_SETTINGS.exit.minHoldTime,
  whaleSellPercentage: MASTER_SETTINGS.exit.whaleSellPercentage,
  whaleSellVolume: MASTER_SETTINGS.exit.whaleSellVolume,
  
  // Whale tracking from MASTER_SETTINGS
  whaleTrackingEnabled: MASTER_SETTINGS.whales.enabled,
  minWhaleBalance: MASTER_SETTINGS.whales.minWhaleBalance,
  whaleTrackingInterval: MASTER_SETTINGS.whales.trackingInterval,

  // Execution settings from MASTER_SETTINGS
  priorityFee: MASTER_SETTINGS.execution.priorityFee,
  slippageTolerance: MASTER_SETTINGS.execution.slippageTolerance,
  executionSpeed: MASTER_SETTINGS.execution.executionSpeed,
  maxRetries: MASTER_SETTINGS.execution.maxRetries,

  // Performance settings from MASTER_SETTINGS
  targetWinRate: MASTER_SETTINGS.performance.targetWinRate,
  maxDailyLoss: MASTER_SETTINGS.performance.maxDailyLoss,
  maxConsecutiveLosses: MASTER_SETTINGS.performance.maxConsecutiveLosses,

  // Reporting settings from MASTER_SETTINGS
  generateReports: MASTER_SETTINGS.reporting.generateReports,
  reportInterval: MASTER_SETTINGS.reporting.reportInterval * 60000, // Convert minutes to milliseconds
  verboseLogging: MASTER_SETTINGS.verboseLogging,
  saveTradeHistory: MASTER_SETTINGS.saveTradeHistory,

  // Bot mode
  testMode: MASTER_SETTINGS.testMode
};

// Calculate position size in USD for display
const estimatedPositionUSD = config.positionSize * 170; // Assuming ~$170 per SOL

// Statistics tracking
let stats = {
  totalEvents: 0,
  tokensDetected: 0,
  tokensAnalyzed: 0,
  tokensBought: 0,
  tokensRejected: 0,
  tokensSkippedPoolEmpty: 0,
  consecutiveLosses: 0,
  dailyLoss: 0,
  dailyStartPool: config.initialPool,
  startTime: new Date(),
  poolDepletedAt: null as Date | null,
  poolResumedAt: null as Date | null
};

// 🎯 POOL-INTEGRATED DETECTION FUNCTION
async function runPoolIntegratedDetection() {
  console.log(`🏦 POOL-INTEGRATED TOKEN DETECTION`);
  console.log(`=====================================`);
  console.log(`📋 Version: ${MASTER_SETTINGS.botVersion}`);
  console.log(`🔄 Mode: ${config.testMode ? '🧪 TEST MODE (Paper Trading)' : '💰 LIVE TRADING'}`);
  console.log(`🔗 RPC: ${config.rpcUrl}`);
  console.log(`📊 Program: ${config.pumpFunProgramId}`);
  console.log(`\n💰 POOL CONFIGURATION:`);
  console.log(`   Initial: $${config.initialPool.toLocaleString()}`);
  console.log(`   Target: $${config.targetPool.toLocaleString()}`);
  console.log(`   Position Size: ${config.positionSize} SOL (~$${estimatedPositionUSD.toFixed(2)})`);
  console.log(`   Max Positions: ${config.maxPositions}`);
  console.log(`   Compound Profits: ${config.compoundProfits ? 'YES' : 'NO'}`);
  console.log(`   Min Reserve: ${config.minPoolReserve}%`);
  console.log(`   Max Risk: ${config.maxPoolRisk}%`);
  console.log(`\n⏰ RUNTIME SETTINGS:`);
  console.log(`   Duration: ${config.testDurationMs === 0 ? '♾️  Unlimited (until target or Ctrl+C)' : `${config.testDurationMs / 1000}s (${config.testDurationMs / 60000} minutes)`}`);
  console.log(`   Scan Interval: ${config.pauseBetweenScans}ms`);
  console.log(`   Position Check: Every ${config.checkInterval / 1000}s`);
  console.log(`\n📊 ENTRY CRITERIA:`);
  console.log(`   Liquidity: $${config.minLiquidity.toLocaleString()} - $${config.maxLiquidity.toLocaleString()}`);
  console.log(`   Market Cap: $${config.minMarketCap.toLocaleString()} - $${config.maxMarketCap.toLocaleString()}`);
  console.log(`   Min Holders: ${config.minHolders}`);
  console.log(`   Min Whales: ${config.minWhaleCount}`);
  console.log(`   Safety Checks: ${config.honeypotCheck ? '✅ Honeypot' : ''} ${config.rugCheck ? '✅ Rug' : ''}`);
  console.log(`\n📈 EXIT STRATEGY:`);
  console.log(`   Stop Loss: ${config.stopLoss}%`);
  console.log(`   Take Profits: ${config.takeProfit1}%, ${config.takeProfit2}%, ${config.takeProfit3}%`);
  console.log(`   Max Hold: ${config.maxHoldTime} minutes`);
  console.log(`   Whale Sell Trigger: ${config.whaleSellPercentage}% of whales`);
  console.log(`\n🎯 PERFORMANCE LIMITS:`);
  console.log(`   Max Daily Loss: ${config.maxDailyLoss}%`);
  console.log(`   Max Consecutive Losses: ${config.maxConsecutiveLosses}`);
  console.log(`   Target Win Rate: ${config.targetWinRate}%`);
  
  if (config.verboseLogging) {
    console.log(`\n📝 Verbose logging: ENABLED`);
  }
  
  console.log(`\n🚀 Starting detection system...\n`);

  // Initialize connection and pool-integrated queue manager
  const connection = new Connection(config.rpcUrl, 'confirmed');
  const queueManager = new TokenQueueManager(
    config.rpcUrl, 
    './data/pending_tokens.csv', 
    config.initialPool,
    {
      positionSize: config.positionSize,
      maxPositions: config.maxPositions,
      stopLoss: config.stopLoss,
      takeProfit: [config.takeProfit1, config.takeProfit2, config.takeProfit3],
      minLiquidity: config.minLiquidity,
      maxMarketCap: config.maxMarketCap,
      minHolders: config.minHolders,
      compoundProfits: config.compoundProfits,
      testMode: config.testMode
    }
  );

  try {
    // Subscribe to pump.fun program logs
    console.log(`🔍 Connecting to pump.fun program...`);
    
    const subscriptionId = connection.onLogs(
      new PublicKey(config.pumpFunProgramId),
      async (logs: Logs, context: any) => {
        await handleProgramLogWithPool(logs, queueManager);
      },
      'confirmed'
    );

    console.log(`✅ Connected! Listening for new tokens...`);
    console.log(`🏦 Pool system monitoring every trade execution...`);
    console.log(`📊 Reports will generate every ${config.reportInterval / 60000} minutes\n`);

    // Enhanced status reporting with pool metrics
    const statusInterval = setInterval(() => {
      printPoolAwareStatusUpdate(queueManager);
    }, 30000); // Every 30 seconds

    // Report generation interval (from config)
    let reportInterval: NodeJS.Timeout | null = null;
    if (config.generateReports) {
      reportInterval = setInterval(() => {
        generateReport(queueManager);
      }, config.reportInterval);
    }

    // Pool milestone checking
    const milestoneInterval = setInterval(() => {
      checkPoolMilestones(queueManager);
    }, 60000); // Every minute

    // Auto-stop conditions monitoring
    const monitoringInterval = setInterval(() => {
      const poolSummary = queueManager.getPoolManager().getPoolSummary();
      
      // Check daily loss limit
      const dailyLossPercent = ((config.initialPool - poolSummary.currentPool) / config.initialPool) * 100;
      if (dailyLossPercent > config.maxDailyLoss) {
        console.log(`\n🛑 DAILY LOSS LIMIT REACHED: ${dailyLossPercent.toFixed(2)}% > ${config.maxDailyLoss}%`);
        shutdownBot(connection, subscriptionId, [statusInterval, milestoneInterval, monitoringInterval, reportInterval].filter(Boolean) as NodeJS.Timeout[], queueManager);
      }
      
      // Check consecutive losses
      if (stats.consecutiveLosses >= config.maxConsecutiveLosses) {
        console.log(`\n🛑 MAX CONSECUTIVE LOSSES REACHED: ${stats.consecutiveLosses}`);
        shutdownBot(connection, subscriptionId, [statusInterval, milestoneInterval, monitoringInterval, reportInterval].filter(Boolean) as NodeJS.Timeout[], queueManager);
      }
      
      // Stop if target reached
      if (poolSummary.currentPool >= config.targetPool) {
        console.log(`\n🏆 TARGET ACHIEVED! Pool reached $${config.targetPool.toLocaleString()}`);
        shutdownBot(connection, subscriptionId, [statusInterval, milestoneInterval, monitoringInterval, reportInterval].filter(Boolean) as NodeJS.Timeout[], queueManager);
      }
      
      // Track pool depletion/resumption
      if (!poolSummary.canTrade && !stats.poolDepletedAt) {
        stats.poolDepletedAt = new Date();
        console.log(`\n⏸️  POOL DEPLETED at ${stats.poolDepletedAt.toLocaleTimeString()}`);
        console.log(`💸 Waiting for profitable trades to replenish pool...`);
      } else if (poolSummary.canTrade && stats.poolDepletedAt && !stats.poolResumedAt) {
        stats.poolResumedAt = new Date();
        const depletionDuration = (stats.poolResumedAt.getTime() - stats.poolDepletedAt.getTime()) / 60000;
        console.log(`\n▶️  POOL RESTORED at ${stats.poolResumedAt.toLocaleTimeString()}`);
        console.log(`⏱️  Pool was depleted for ${depletionDuration.toFixed(1)} minutes`);
        console.log(`🚀 Resuming token detection and trading...`);
        stats.poolDepletedAt = null;
        stats.poolResumedAt = null;
      }
      
    }, config.checkInterval); // Use checkInterval from config

    // Auto-stop after configured duration (if not infinite)
    if (config.testDurationMs > 0) {
      setTimeout(async () => {
        console.log(`\n⏰ Runtime duration reached: ${config.testDurationMs / 1000} seconds`);
        shutdownBot(connection, subscriptionId, [statusInterval, milestoneInterval, monitoringInterval, reportInterval].filter(Boolean) as NodeJS.Timeout[], queueManager);
      }, config.testDurationMs);
    } else {
      console.log(`🌙 Running indefinitely until target reached or Ctrl+C...`);
    }

  } catch (error) {
    console.error(`❌ Connection failed: ${error}`);
  }
}

// Shutdown helper function
function shutdownBot(
  connection: Connection, 
  subscriptionId: number, 
  intervals: NodeJS.Timeout[], 
  queueManager: TokenQueueManager
): void {
  console.log(`\n🔄 Shutting down bot...`);
  
  // Clear all intervals
  intervals.forEach(interval => clearInterval(interval));
  
  // Remove listener
  connection.removeOnLogsListener(subscriptionId);
  
  // Print final report
  printFinalPoolReport(queueManager);
  
  // Shutdown queue manager
  queueManager.shutdown();
  
  // Exit process
  process.exit(0);
}

// Generate report function
function generateReport(queueManager: TokenQueueManager): void {
  if (!config.generateReports) return;
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  console.log(`\n📊 Generating scheduled report at ${new Date().toLocaleTimeString()}...`);
  
  // Get detailed reports from queue manager
  queueManager.printDetailedPoolReport();
  
  if (config.saveTradeHistory) {
    console.log(`💾 Trade history saved to ./data/trades_${timestamp}.csv`);
  }
}

// 🎯 HANDLE DETECTED TOKENS WITH POOL AWARENESS
async function handleProgramLogWithPool(logs: Logs, queueManager: TokenQueueManager): Promise<void> {
  stats.totalEvents++;

  try {
    // Look for InitializeMint2 instruction (new token creation)
    const hasInitializeMint = logs.logs.some(log => 
      log.includes('Program log: Instruction: InitializeMint2') ||
      log.includes('InitializeMint2')
    );

    if (hasInitializeMint) {
      stats.tokensDetected++;
      
      const signature = logs.signature;
      const timestamp = new Date().toLocaleTimeString();
      
      if (config.verboseLogging) {
        console.log(`🎯 NEW TOKEN #${stats.tokensDetected} DETECTED!`);
        console.log(`   📝 Signature: ${signature.slice(0, 32)}...`);
        console.log(`   ⏰ Time: ${timestamp}`);
      }

      // Check pool status before processing
      const poolSummary = queueManager.getPoolManager().getPoolSummary();
      if (!poolSummary.canTrade) {
        stats.tokensSkippedPoolEmpty++;
        if (config.verboseLogging) {
          console.log(`   ⏸️  SKIPPED: Pool depleted ($${poolSummary.currentPool.toFixed(2)} < min required)`);
          console.log(`   📊 Total skipped due to pool: ${stats.tokensSkippedPoolEmpty}`);
        }
        return;
      }

      // Extract token mint
      const tokenMint = await extractTokenMintFromTransaction(signature, logs);
      
      if (tokenMint) {
        if (config.verboseLogging) {
          console.log(`   🪙 Token Mint: ${tokenMint.slice(0, 32)}...`);
          console.log(`   💰 Pool Status: $${poolSummary.currentPool.toFixed(2)} available`);
        }
        
        // 🎯 FEED INTO POOL-AWARE QUEUE SYSTEM
        const result = await queueManager.onNewTokenDetected(signature, tokenMint);
        stats.tokensAnalyzed++;
        
        // Track consecutive losses
        if (result && result.status === 'loss') {
          stats.consecutiveLosses++;
        } else if (result && result.status === 'profit') {
          stats.consecutiveLosses = 0; // Reset on profit
        }
        
      } else {
        if (config.verboseLogging) {
          console.log(`   ⚠️ Could not extract token mint from transaction`);
        }
      }

      if (config.verboseLogging) {
        console.log(''); // Empty line for readability
      }

      // Activity updates based on verbosity
      if (!config.verboseLogging && (stats.totalEvents % 50) === 0) {
        console.log(`📊 Activity: ${stats.totalEvents} events | ${stats.tokensDetected} tokens | Pool: $${poolSummary.currentPool.toFixed(2)}`);
      }
    }

    // Add delay between scans if configured
    if (config.pauseBetweenScans > 0) {
      await new Promise(resolve => setTimeout(resolve, config.pauseBetweenScans));
    }

  } catch (error) {
    console.error(`❌ Error processing log: ${error}`);
  }
}

// Extract token mint (placeholder - implement actual extraction)
async function extractTokenMintFromTransaction(signature: string, logs: Logs): Promise<string | null> {
  try {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // This is a placeholder - implement actual mint extraction
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let mintAddress = '';
    for (let i = 0; i < 44; i++) {
      mintAddress += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return mintAddress;
    
  } catch (error) {
    if (config.verboseLogging) {
      console.log(`   ⚠️ Error extracting mint: ${error}`);
    }
    return null;
  }
}

// 🎯 POOL-AWARE STATUS REPORTING
function printPoolAwareStatusUpdate(queueManager: TokenQueueManager): void {
  const runtime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
  const detectionRate = stats.tokensDetected / (runtime / 3600); // per hour
  const poolSummary = queueManager.getPoolManager().getPoolSummary();
  
  console.log(`\n📊 STATUS UPDATE (${runtime}s runtime):`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📡 Events: ${stats.totalEvents} | Rate: ${detectionRate.toFixed(1)}/hr`);
  console.log(`🎯 Detected: ${stats.tokensDetected} | Analyzed: ${stats.tokensAnalyzed}`);
  if (stats.tokensSkippedPoolEmpty > 0) {
    console.log(`⏸️  Skipped (pool): ${stats.tokensSkippedPoolEmpty}`);
  }
  
  console.log(`\n🏦 POOL:`);
  console.log(`💰 Current: $${poolSummary.currentPool.toFixed(2)} (${poolSummary.roi > 0 ? '+' : ''}${poolSummary.roi.toFixed(2)}%)`);
  console.log(`📊 Trades: ${poolSummary.totalTrades} | Win: ${poolSummary.winRate.toFixed(1)}%`);
  console.log(`🎯 Progress: ${poolSummary.targetProgress.toFixed(2)}% to $${config.targetPool.toLocaleString()}`);
  console.log(`💵 Trading: ${poolSummary.canTrade ? '✅ Active' : '🚫 Depleted'}`);
  
  if (poolSummary.totalTrades > 0) {
    const maxBasicTrades = Math.floor(config.initialPool / (config.positionSize * 170));
    const efficiency = (poolSummary.totalTrades / maxBasicTrades) * 100;
    console.log(`⚡ Efficiency: ${efficiency.toFixed(1)}% (${poolSummary.totalTrades}/${maxBasicTrades} base)`);
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Print queue status if verbose
  if (config.verboseLogging) {
    queueManager.printQueueReport();
  }
}

// 🎯 POOL MILESTONE CHECKING
function checkPoolMilestones(queueManager: TokenQueueManager): void {
  const poolSummary = queueManager.getPoolManager().getPoolSummary();
  const milestones = [1000, 2000, 5000, 10000, 15000, 20000, 25000];
  
  // Check if we just passed a milestone
  for (const milestone of milestones) {
    if (poolSummary.currentPool >= milestone && poolSummary.currentPool - 100 < milestone) {
      console.log(`\n🎉 MILESTONE: $${milestone.toLocaleString()} REACHED!`);
      console.log(`📊 Trades to milestone: ${poolSummary.totalTrades}`);
      console.log(`⏱️  Time elapsed: ${Math.floor((Date.now() - stats.startTime.getTime()) / 60000)} minutes`);
      
      // Project remaining time to target
      if (poolSummary.totalPnL > 0) {
        const avgPnL = poolSummary.totalPnL / poolSummary.totalTrades;
        const remaining = config.targetPool - poolSummary.currentPool;
        const estimatedTrades = Math.ceil(remaining / avgPnL);
        const currentRate = poolSummary.totalTrades / (Date.now() - stats.startTime.getTime()) * 3600000; // trades per hour
        const estimatedHours = estimatedTrades / currentRate;
        
        console.log(`📅 Est. time to target: ${estimatedHours.toFixed(1)} hours (${estimatedTrades} more trades)`);
      }
      
      if (config.verboseLogging) {
        queueManager.printDetailedPoolReport();
      }
      break;
    }
  }
}

// 🎯 FINAL POOL REPORT
function printFinalPoolReport(queueManager: TokenQueueManager): void {
  const runtime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
  const detectionRate = stats.tokensDetected / (runtime / 3600);
  const poolSummary = queueManager.getPoolManager().getPoolSummary();
  const queueStatus = queueManager.getQueueStatus();
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🏆 FINAL REPORT - ${MASTER_SETTINGS.botVersion}`);
  console.log(`${'='.repeat(80)}`);
  
  console.log(`⏰ Total runtime: ${Math.floor(runtime / 3600)}h ${Math.floor((runtime % 3600) / 60)}m ${runtime % 60}s`);
  console.log(`📋 Mode: ${config.testMode ? 'TEST (Paper Trading)' : 'LIVE TRADING'}`);
  console.log(`📡 Total events: ${stats.totalEvents.toLocaleString()}`);
  console.log(`🎯 Tokens detected: ${stats.tokensDetected.toLocaleString()}`);
  console.log(`📈 Detection rate: ${detectionRate.toFixed(1)} tokens/hour`);
  console.log(`📊 Tokens analyzed: ${stats.tokensAnalyzed}`);
  console.log(`⏸️  Skipped (pool): ${stats.tokensSkippedPoolEmpty}`);
  
  console.log(`\n🏦 POOL PERFORMANCE:`);
  console.log(`💰 Initial: $${config.initialPool.toLocaleString()}`);
  console.log(`💰 Final: $${poolSummary.currentPool.toFixed(2)}`);
  console.log(`📈 Growth: $${(poolSummary.currentPool - config.initialPool).toFixed(2)} (${poolSummary.roi.toFixed(2)}%)`);
  console.log(`📊 Total trades: ${poolSummary.totalTrades}`);
  console.log(`✅ Profitable: ${poolSummary.profitableTrades} (${poolSummary.winRate.toFixed(1)}%)`);
  console.log(`📈 Peak: $${poolSummary.maxPool.toFixed(2)}`);
  console.log(`📉 Lowest: $${poolSummary.minPool.toFixed(2)}`);
  
  const maxBasicTrades = Math.floor(config.initialPool / (config.positionSize * 170));
  const reinvestmentAdvantage = poolSummary.totalTrades - maxBasicTrades;
  console.log(`\n⚡ REINVESTMENT EFFICIENCY:`);
  console.log(`📊 Max trades without reinvestment: ${maxBasicTrades}`);
  console.log(`🚀 Actual trades with reinvestment: ${poolSummary.totalTrades}`);
  console.log(`💡 Reinvestment advantage: +${reinvestmentAdvantage} trades (${poolSummary.efficiency.toFixed(1)}%)`);
  
  console.log(`\n🔄 QUEUE PROCESSING:`);
  console.log(`✅ Bought: ${queueStatus.bought}`);
  console.log(`❌ Rejected: ${queueStatus.rejected}`);
  console.log(`⏸️  Pool depleted: ${queueStatus.poolDepleted}`);
  console.log(`⏳ Pending: ${queueStatus.pending}`);
  
  if (poolSummary.currentPool >= config.targetPool) {
    console.log(`\n🎉 SUCCESS: TARGET REACHED!`);
    console.log(`🏁 Achieved $${config.targetPool.toLocaleString()} in ${poolSummary.totalTrades} trades!`);
  } else {
    const remaining = config.targetPool - poolSummary.currentPool;
    console.log(`\n📊 PROGRESS:`);
    console.log(`🎯 Remaining: $${remaining.toFixed(2)} to $${config.targetPool.toLocaleString()}`);
    console.log(`📈 Complete: ${poolSummary.targetProgress.toFixed(1)}%`);
    
    if (poolSummary.totalTrades > 0 && poolSummary.totalPnL > 0) {
      const avgPnL = poolSummary.totalPnL / poolSummary.totalTrades;
      const estimatedTrades = Math.ceil(remaining / avgPnL);
      console.log(`📅 Est. trades needed: ${estimatedTrades.toLocaleString()}`);
    }
  }
  
  if (config.saveTradeHistory) {
    console.log(`\n📁 Data saved:`);
    console.log(`   📄 pending_tokens.csv`);
    console.log(`   📄 pool_transactions.csv`);
    console.log(`   📄 trading_log.json`);
    console.log(`   📄 whale_exits.jsonl`);
  }
  
  console.log(`\n✅ Detection complete!`);
  console.log(`${'='.repeat(80)}\n`);
}

// 🎯 GRACEFUL SHUTDOWN WITH POOL SUMMARY
process.on('SIGINT', () => {
  console.log(`\n🛑 Shutdown signal received...`);
  process.exit(0);
});

// 🎯 RUN THE POOL-INTEGRATED DETECTION
console.log(`💡 STARTING ${MASTER_SETTINGS.botVersion}`);
console.log(`===========================================`);
console.log(`🏦 Pool-integrated token detection system`);
console.log(`🔄 Using configuration from UNIFIED-CONTROL.ts`);
console.log(`💰 All settings centrally controlled`);
console.log(`📊 Auto-stops based on performance limits`);
console.log(`⚠️ Press Ctrl+C to stop at any time\n`);

runPoolIntegratedDetection().catch(console.error);

export { runPoolIntegratedDetection, config, stats };