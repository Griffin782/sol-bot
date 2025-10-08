import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import { WhaleWatcher } from './automated-reporter';

interface PendingToken {
  signature: string;
  tokenMint: string;
  detectedAt: Date;
  initialLiquidity?: number;
  scoringAttempts: number;
  lastScoredAt?: Date;
  stage1Passed?: boolean;
  stage2Score?: number;
  status: 'pending' | 'analyzing' | 'ready_to_buy' | 'bought' | 'rejected' | 'expired' | 'pool_depleted';
  errors: string[];
  // Add fields for 5x+ tracking
  entryPrice?: number;
  currentPrice?: number;
  exitPrice?: number;
  tokenSymbol?: string;
  maxHoldTime?: number;
  volume24h?: number;
  entryTime?: number;
}

// Interface for active positions (5x+ tracking)
interface ActivePosition {
  tokenMint: string;
  tokenSymbol?: string;
  entryPrice: number;
  currentPrice: number;
  volume?: number;
  holdTime: number; // in minutes
  currentGain: number; // percentage
  entryTime: number;
  maxHoldTime?: number;
}

interface PoolTransaction {
  timestamp: string;
  type: 'trade_execution' | 'profit_return' | 'loss_return' | 'pool_status';
  amount: number;
  poolBefore: number;
  poolAfter: number;
  tokenMint?: string;
  tradeNumber?: number;
  notes?: string;
}

class PoolManager {
  private initialPool: number;
  private currentPool: number;
  private positionSize: number; // USD per trade
  private positionSizeSOL: number; // SOL equivalent
  private totalTrades: number = 0;
  private profitableTrades: number = 0;
  private totalPnL: number = 0;
  private maxPool: number;
  private minPool: number;
  private poolTransactions: PoolTransaction[] = [];
  private target: number = 7000; // $7K target
  
  constructor(initialPool: number, positionSizeUSD: number,) {
    console.log(`🔍 DEBUG: PoolManager created with initialPool: $${initialPool}, positionSize: $${positionSizeUSD}`);
    this.initialPool = initialPool;
    this.currentPool = initialPool;
    this.positionSize = positionSizeUSD;
    this.positionSizeSOL = positionSizeUSD / 170; // Using ~$170 per SOL
    this.maxPool = initialPool;
    this.minPool = initialPool;
    this.totalPnL = 0;
    
    this.logPoolTransaction('pool_status', 0, `Pool initialized with $${initialPool} and $${positionSizeUSD} positions`);
    this.printPoolStatus();
  }

  canExecuteTrade(): boolean {
    return this.currentPool >= this.positionSize;
  }

  executeTradeDeduction(tokenMint: string): boolean {
    if (!this.canExecuteTrade()) {
      console.log(`🚫 POOL DEPLETED! Cannot execute trade for ${tokenMint.slice(0, 8)}...`);
      console.log(`💸 Current pool: $${this.currentPool.toFixed(2)} | Need: $${this.positionSize}`);
      return false;
    }

    const poolBefore = this.currentPool;
    this.currentPool -= this.positionSize;
    this.totalTrades++;

    this.minPool = Math.min(this.minPool, this.currentPool);

    this.logPoolTransaction('trade_execution', -this.positionSize, 
      `Trade #${this.totalTrades} executed: ${tokenMint.slice(0, 8)}...`);

    console.log(`💰 TRADE #${this.totalTrades} EXECUTED | Pool: $${poolBefore.toFixed(2)} → $${this.currentPool.toFixed(2)}`);
    
    // Show pool status every 10 trades
    if (this.totalTrades % 10 === 0) {
      this.printPoolStatus();
    }

    return true;
  }

  processTradeResult(tokenMint: string, profitPercentage: number, holdTimeMinutes: number): void {
    const dollarPnL = (this.positionSize * profitPercentage) / 100;
    const poolBefore = this.currentPool;
    
    // Return the position size plus/minus the P&L
    this.currentPool += this.positionSize + dollarPnL;
    this.totalPnL = this.currentPool - this.initialPool;   // CORRECT
    
    // Track extremes
    this.maxPool = Math.max(this.maxPool, this.currentPool);
    this.minPool = Math.min(this.minPool, this.currentPool);
    
    if (dollarPnL > 0) {
      this.profitableTrades++;
    }

    const transactionType = dollarPnL > 0 ? 'profit_return' : 'loss_return';
    this.logPoolTransaction(transactionType, this.positionSize + dollarPnL, 
      `${tokenMint.slice(0, 8)}... | P&L: ${dollarPnL > 0 ? '+' : ''}$${dollarPnL.toFixed(2)} | Hold: ${holdTimeMinutes.toFixed(1)}m`);

    const icon = dollarPnL > 0 ? '✅' : '❌';
    console.log(`${icon} TRADE RESULT: ${dollarPnL > 0 ? '+' : ''}$${dollarPnL.toFixed(2)} | Pool: $${poolBefore.toFixed(2)} → $${this.currentPool.toFixed(2)}`);

    // Check for milestones
    this.checkMilestones();
  }

  private checkMilestones(): void {
    const milestones = [1000, 2000, 5000, 10000, 15000, 20000, 25000];
    
    for (const milestone of milestones) {
      if (this.currentPool >= milestone && (this.currentPool - this.positionSize - (this.totalPnL / Math.max(this.totalTrades, 1))) < milestone) {
        console.log(`\n🎉 MILESTONE REACHED: $${milestone.toLocaleString()}!`);
        console.log(`📊 Trades to reach: ${this.totalTrades} | ROI: ${this.getROI().toFixed(2)}%`);
        this.printPoolStatus();
        break;
      }
    }

    // Check target progress
    if (this.currentPool >= this.target) {
      console.log(`\n🏆 TARGET ACHIEVED! $${this.target.toLocaleString()} REACHED!`);
      console.log(`🎯 Total trades needed: ${this.totalTrades}`);
      this.printFinalSummary();
    }
  }

  printPoolStatus(): void {
    const roi = this.getROI();
    const winRate = this.getWinRate();
    const efficiency = this.getPoolEfficiency();
    const targetProgress = (this.currentPool / this.target) * 100;
    const maxPossibleTrades = Math.floor(this.initialPool / this.positionSize);

    console.log(`\n🏦 POOL STATUS UPDATE`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`💰 Current Pool: $${this.currentPool.toFixed(2)} (${roi > 0 ? '+' : ''}${roi.toFixed(2)}% ROI)`);
    console.log(`📊 Trades Executed: ${this.totalTrades} (${efficiency.toFixed(1)}% pool efficiency)`);
    console.log(`✅ Win Rate: ${winRate.toFixed(1)}% (${this.profitableTrades}/${this.totalTrades})`);
    console.log(`💵 Next Trade: ${this.canExecuteTrade() ? '✅ AVAILABLE' : '🚫 POOL DEPLETED'}`);
    console.log(`📈 Peak Pool: $${this.maxPool.toFixed(2)} | Low: $${this.minPool.toFixed(2)}`);
    console.log(`🎯 Target Progress: ${targetProgress.toFixed(2)}% to $${this.target.toLocaleString()}`);
    console.log(`💸 Position Size: $${this.positionSize} (${this.positionSizeSOL.toFixed(4)} SOL)`);
    
    if (this.totalTrades > 0) {
      const avgPnL = this.totalPnL / this.totalTrades;
      console.log(`💡 Avg P&L/Trade: $${avgPnL.toFixed(2)} | Total P&L: $${this.totalPnL.toFixed(2)}`);
      
      // Project to target
      if (avgPnL > 0) {
        const remaining = this.target - this.currentPool;
        const estimatedTrades = Math.ceil(remaining / avgPnL);
        console.log(`📅 Est. trades to target: ${estimatedTrades.toLocaleString()} more`);
      }
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━\n`);
  }

  printFinalSummary(): void {
    const roi = this.getROI();
    const winRate = this.getWinRate();
    const efficiency = this.getPoolEfficiency();
    const growthMultiplier = this.currentPool / this.initialPool;
    const reportPath = require('path').resolve('./data');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏆 POOL REINVESTMENT FINAL SUMMARY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`💰 Initial Pool: $${this.initialPool.toFixed(2)}`);
    console.log(`💰 Final Pool: $${this.currentPool.toFixed(2)}`);
    console.log(`📈 Total Growth: $${(this.currentPool - this.initialPool).toFixed(2)} (${roi.toFixed(2)}%)`);
    console.log(`📊 Growth Multiplier: ${growthMultiplier.toFixed(2)}x`);
    console.log(`📈 Peak Pool: $${this.maxPool.toFixed(2)}`);
    console.log(`📉 Lowest Pool: $${this.minPool.toFixed(2)}`);
    console.log(`\n📊 Trading Performance:`);
    console.log(`📈 Total Trades: ${this.totalTrades}`);
    console.log(`✅ Profitable Trades: ${this.profitableTrades}`);
    console.log(`📊 Win Rate: ${winRate.toFixed(1)}%`);
    console.log(`💰 Total P&L: $${this.totalPnL.toFixed(2)}`);
    console.log(`💡 Avg P&L per Trade: $${(this.totalPnL / Math.max(this.totalTrades, 1)).toFixed(2)}`);
    console.log(`💸 Position Size Used: $${this.positionSize}`);
    console.log(`\n🎯 Pool Efficiency:`);
    console.log(`📊 Pool Efficiency: ${efficiency.toFixed(1)}%`);
    console.log(`📈 Max Trades w/o Reinvestment: ${Math.floor(this.initialPool / this.positionSize)}`);
    console.log(`🚀 Actual Trades w/ Reinvestment: ${this.totalTrades}`);
    console.log(`💡 Reinvestment Advantage: ${(this.totalTrades - Math.floor(this.initialPool / this.positionSize))} extra trades`);
    
    console.log(`\n📁 SESSION REPORTS SAVED TO:`);
    console.log(`   📂 ${reportPath}/`);
    console.log(`   ├── 📄 pool_transactions.csv - All pool movements`);
    console.log(`   ├── 📄 pending_tokens.csv - All detected tokens`);
    console.log(`   ├── 📄 trading_log.json - Detailed trade logs`);
    console.log(`   ├── 📄 5x_events.jsonl - Hold extension events`);
    console.log(`   └── 📄 performance_log.csv - 5x+ analysis data`);
    
    console.log(`${'='.repeat(60)}\n`);
  }

  private getROI(): number {
    return ((this.currentPool - this.initialPool) / this.initialPool) * 100;
  }

  private getWinRate(): number {
    return this.totalTrades > 0 ? (this.profitableTrades / this.totalTrades) * 100 : 0;
  }

  private getPoolEfficiency(): number {
    const maxTrades = Math.floor(this.initialPool / this.positionSize);
    return this.totalTrades > 0 ? (this.totalTrades / maxTrades) * 100 : 0;
  }

  private logPoolTransaction(type: string, amount: number, notes: string): void {
    const transaction: PoolTransaction = {
      timestamp: new Date().toISOString(),
      type: type as any,
      amount,
      poolBefore: type === 'trade_execution' ? this.currentPool + this.positionSize : this.currentPool - amount,
      poolAfter: this.currentPool,
      tradeNumber: this.totalTrades,
      notes
    };

    this.poolTransactions.push(transaction);

    // Save to file
    try {
      fs.appendFileSync('./data/pool_transactions.csv', 
        `${transaction.timestamp},${transaction.type},${transaction.amount},${transaction.poolBefore},${transaction.poolAfter},${transaction.tradeNumber || ''},${transaction.notes || ''}\n`);
    } catch (error) {
      console.log(`⚠️ Could not save pool transaction: ${error}`);
    }
  }

  getPoolSummary() {
    return {
      currentPool: this.currentPool,
      initialPool: this.initialPool,
      totalTrades: this.totalTrades,
      profitableTrades: this.profitableTrades,
      totalPnL: this.totalPnL,
      roi: this.getROI(),
      winRate: this.getWinRate(),
      efficiency: this.getPoolEfficiency(),
      canTrade: this.canExecuteTrade(),
      maxPool: this.maxPool,
      minPool: this.minPool,
      targetProgress: (this.currentPool / this.target) * 100
    };
  }

  // Emergency pool management
  addEmergencyFunds(amount: number, reason: string): void {
    const poolBefore = this.currentPool;
    this.currentPool += amount;
    this.logPoolTransaction('pool_status', amount, `Emergency funds added: ${reason}`);
    console.log(`🚨 EMERGENCY FUNDS: +$${amount} | Pool: $${poolBefore.toFixed(2)} → $${this.currentPool.toFixed(2)}`);
  }

  pauseTrading(reason: string): void {
    console.log(`⏸️  TRADING PAUSED: ${reason}`);
    this.logPoolTransaction('pool_status', 0, `Trading paused: ${reason}`);
  }

  resumeTrading(): void {
    if (this.canExecuteTrade()) {
      console.log(`▶️  TRADING RESUMED: Pool sufficient ($${this.currentPool.toFixed(2)})`);
      this.logPoolTransaction('pool_status', 0, 'Trading resumed - pool sufficient');
    } else {
      console.log(`❌ CANNOT RESUME: Pool still insufficient ($${this.currentPool.toFixed(2)})`);
    }
  }
}

class TokenQueueManager {
  private connection: Connection;
  private pendingTokens: Map<string, PendingToken> = new Map();
  private processedTokens = new Set<string>(); // ADD THIS LINE
  private csvPath: string;
  private whaleWatcher: WhaleWatcher;
  private backgroundScorer: NodeJS.Timeout | null = null;
  private poolManager: PoolManager;
  // Track active positions for 5x+ detection
  private activePositions: Map<string, PendingToken> = new Map();
  private eventLog: any[] = [];
  private config: any;
  
  private stage1Thresholds = {
    minLiquidityETH: 3.0,
    minConfidenceScore: 0.47,
    maxMintAuthority: false,
    maxFreezeAuthority: false,
    blacklistCheck: true,
    maxProcessingTimeMs: 3000
  };

  constructor(
    rpcUrl: string, 
    csvPath: string = './data/pending_tokens.csv', 
    initialPool: number,  // NO DEFAULT VALUE
    config?: any
  ) {
    console.log(`🔍 DEBUG: TokenQueueManager received initialPool: $${initialPool}`);
    console.log(`🔍 DEBUG: TokenQueueManager received config:`, config?.positionSizeUSD || 'not set');
    
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.csvPath = csvPath;
    this.whaleWatcher = new WhaleWatcher(rpcUrl);
    this.config = config || {};
    
    // Use position size from config if provided, otherwise default to $15
    const positionSizeUSD = config?.positionSizeUSD || (config?.positionSize ? config.positionSize * 170 : 15);
    console.log(`🔍 DEBUG: Creating PoolManager with initialPool: $${initialPool}, positionSize: $${positionSizeUSD}`);
    
    this.poolManager = new PoolManager(initialPool, positionSizeUSD);
    
    this.ensureDataDirectory();
    this.initializePoolCSV();
    this.startBackgroundScorer();
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data', { recursive: true });
    }
  }

  private initializePoolCSV(): void {
    const poolCsvPath = './data/pool_transactions.csv';
    if (!fs.existsSync(poolCsvPath)) {
      const headers = 'timestamp,type,amount,poolBefore,poolAfter,tradeNumber,notes\n';
      fs.writeFileSync(poolCsvPath, headers);
    }
  }

  // Return more data for performance tracking
async onNewTokenDetected(signature: string, tokenMint: string): Promise<{
  status: 'profit' | 'loss' | 'pending' | 'rejected' | 'pool_depleted';
  entryPrice?: number;
  exitPrice?: number;
  tokenSymbol?: string;
}> {
  console.log(`🔍 NEW TOKEN DETECTED: ${tokenMint.slice(0, 8)}...`);
  
  // CHECK 1: Already processed?
  if (this.processedTokens.has(tokenMint)) {
    console.log(`⚠️ DUPLICATE BLOCKED in Queue: ${tokenMint.slice(0, 8)}...`);
    return { status: 'rejected' };
  }
  
  // CHECK 2: Already pending?
  if (this.pendingTokens.has(tokenMint)) {
    console.log(`⚠️ Already in pending queue: ${tokenMint.slice(0, 8)}...`);
    return { status: 'rejected' };
  }
  
  // ALL CHECKS PASSED - Now mark as processed
  this.processedTokens.add(tokenMint);
  console.log(`✅ Token ${tokenMint.slice(0, 8)} added to processed set`);

  // Debug pool status
  console.log('📊 Pool can trade?', this.poolManager.canExecuteTrade());
  
  // Pool check (uncomment these lines if you commented them before)
  if (!this.poolManager.canExecuteTrade()) {
    console.log(`⏸️ SKIPPING ANALYSIS - Pool depleted ($${this.poolManager.getPoolSummary().currentPool.toFixed(2)})`);
    
    const token: PendingToken = {
      signature,
      tokenMint,
      detectedAt: new Date(),
      scoringAttempts: 0,
      status: 'pool_depleted',
      errors: ['Pool insufficient for trading']
    };
    
    this.pendingTokens.set(tokenMint, token);
    this.saveToCsv(token);
    
    return { status: 'pool_depleted' };
  }
  
  // Create the token object for processing
  const token: PendingToken = {
    signature,
    tokenMint,
    detectedAt: new Date(),
    scoringAttempts: 0,
    status: 'pending',
    errors: [],
    entryTime: Date.now() // Track entry time
  };

  this.pendingTokens.set(tokenMint, token);
  this.saveToCsv(token);
  
  // Attempt scoring and return result
  await this.attemptStage1Scoring(token);
  
  return {
    status: token.status === 'bought' ? 'pending' : token.status as any,
    entryPrice: token.entryPrice,
    tokenSymbol: token.tokenSymbol
  };
}  // <-- FUNCTION CLOSES HERE

private async attemptStage1Scoring(token: PendingToken): Promise<void> {
  // Double-check pool before starting analysis
  if (!this.poolManager.canExecuteTrade()) {
    token.status = 'pool_depleted';
    token.errors.push('Pool depleted during analysis');
    this.saveToCsv(token);
    return;
  }

    const startTime = Date.now();
    token.status = 'analyzing';
    token.scoringAttempts++;
    token.lastScoredAt = new Date();

    try {
      console.log(`⚡ Stage 1 analysis: ${token.tokenMint.slice(0, 8)}...`);

      const liquidity = await this.getLiquidityETH(token.tokenMint);
      token.initialLiquidity = liquidity;

      if (liquidity < this.stage1Thresholds.minLiquidityETH) {
        token.status = 'rejected';
        token.errors.push(`Low liquidity: ${liquidity.toFixed(2)} ETH`);
        console.log(`   ❌ REJECTED: Low liquidity (${liquidity.toFixed(2)} ETH)`);
        return;
      }

      const authorities = await this.checkAuthorities(token.tokenMint);
      if (authorities.mintAuthority || authorities.freezeAuthority) {
        token.status = 'rejected';
        token.errors.push('Mint/Freeze authorities not renounced');
        console.log(`   ❌ REJECTED: Authorities not renounced`);
        return;
      }

      const processingTime = Date.now() - startTime;
      if (processingTime > this.stage1Thresholds.maxProcessingTimeMs) {
        token.status = 'rejected';
        token.errors.push(`Too slow: ${processingTime}ms`);
        console.log(`   ❌ REJECTED: Too slow (${processingTime}ms)`);
        return;
      }

      // Final pool check before execution
      if (!this.poolManager.canExecuteTrade()) {
        token.status = 'pool_depleted';
        token.errors.push('Pool depleted before execution');
        console.log(`   ⏸️  ANALYSIS PASSED but POOL DEPLETED - Cannot execute`);
        return;
      }

      token.stage1Passed = true;
      token.status = 'ready_to_buy';
      
      console.log(`   ✅ STAGE 1 PASSED! Ready for immediate buy`);
      console.log(`   💰 Liquidity: ${liquidity.toFixed(2)} ETH | Time: ${processingTime}ms`);

      await this.executeImmediateBuy(token);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      token.errors.push(`Stage 1 error: ${errorMsg}`);
      token.status = 'pending';
      console.log(`   ⚠️ Stage 1 failed: ${errorMsg}`);
    } finally {
      this.saveToCsv(token);
    }
  }

  private async executeImmediateBuy(token: PendingToken): Promise<void> {
    const poolSummary = this.poolManager.getPoolSummary();
    console.log(`🚀 EXECUTING IMMEDIATE BUY: ${token.tokenMint.slice(0, 8)}...`);
    console.log(`   💰 Using position size: $${this.config?.positionSizeUSD || 15}`);
    
    try {
      // Pool integration: Deduct from pool first
      const success = this.poolManager.executeTradeDeduction(token.tokenMint);
      
      if (!success) {
        token.status = 'pool_depleted';
        token.errors.push('Pool depleted during buy execution');
        console.log(`   ❌ BUY FAILED: Pool depleted`);
        return;
      }

      const entryPrice = this.simulateEntryPrice();
      
      // Set entry data for 5x+ tracking
      token.status = 'bought';
      token.entryPrice = entryPrice;
      token.currentPrice = entryPrice;
      token.tokenSymbol = 'TOKEN'; // Get actual symbol if available
      token.entryTime = Date.now();
      token.maxHoldTime = this.config.maxHoldTime || 30; // Default 30 minutes
      
      // Add to active positions for monitoring
      this.activePositions.set(token.tokenMint, token);
      
      console.log(`   ✅ BOUGHT: $${this.config?.positionSizeUSD || 15} position @ $${entryPrice.toFixed(6)}`);
      console.log(`   🐋 Starting enhanced whale monitoring with tiered exits...`);
      
      // Start whale monitoring with pool result callback and config
      await this.whaleWatcher.startWhaleMonitoring(
        token.tokenMint, 
        entryPrice, 
        poolSummary.currentPool / 100,
        (profitPercentage: number, holdTimeMinutes: number) => {
          // When trade exits, update pool
          this.poolManager.processTradeResult(token.tokenMint, profitPercentage, holdTimeMinutes);
          
          // Update token exit data for performance tracking
          token.exitPrice = entryPrice * (1 + profitPercentage / 100);
          token.status = profitPercentage > 0 ? 'profit' : 'loss' as any;
          
          // Remove from active positions
          this.activePositions.delete(token.tokenMint);
          
          // Log event for analysis
          this.logEvent('trade_exit', {
            tokenMint: token.tokenMint,
            entryPrice,
            exitPrice: token.exitPrice,
            profitPercentage,
            holdTimeMinutes
          });
        },
        this.config  // Pass the config with tiered exit settings
      );
      
      this.logTradingAction(token, 'immediate_buy', this.config?.positionSizeUSD || 15, entryPrice);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      token.errors.push(`Buy failed: ${errorMsg}`);
      console.log(`   ❌ BUY FAILED: ${errorMsg}`);
    }
  }

  // Get all currently active positions for 5x+ monitoring
  getActivePositions(): ActivePosition[] {
    const positions: ActivePosition[] = [];
    
    for (const [tokenMint, token] of this.activePositions.entries()) {
      if (token.status === 'bought' && token.entryPrice) {
        positions.push({
          tokenMint: tokenMint,
          tokenSymbol: token.tokenSymbol || 'Unknown',
          entryPrice: token.entryPrice,
          currentPrice: token.currentPrice || token.entryPrice,
          volume: token.volume24h || 0,
          holdTime: Math.floor((Date.now() - (token.entryTime || Date.now())) / 60000),
          currentGain: ((token.currentPrice || token.entryPrice) - token.entryPrice) / token.entryPrice * 100,
          entryTime: token.entryTime || Date.now(),
          maxHoldTime: token.maxHoldTime
        });
      }
    }
    
    return positions;
  }

  // Extend hold time for a specific token based on 5x+ signals
  extendHold(tokenMint: string, additionalMinutes: number): void {
    const token = this.activePositions.get(tokenMint);
    
    if (token && token.status === 'bought') {
      // Extend the max hold time
      token.maxHoldTime = (token.maxHoldTime || 30) + additionalMinutes;
      
      console.log(`💎 Hold extended for ${tokenMint.slice(0, 8)}... by ${additionalMinutes} minutes`);
      console.log(`   New max hold: ${token.maxHoldTime} minutes`);
      
      // Log this extension event
      this.logEvent('hold_extended', {
        tokenMint,
        extensionMinutes: additionalMinutes,
        newMaxHold: token.maxHoldTime,
        reason: '5x+ signals detected'
      });
      
      // Notify whale watcher if it has a method to extend holds
      (this.whaleWatcher as any).extendHoldTime?.(tokenMint, additionalMinutes, '5x+ signals detected');
    }
  }

  // Update current price for a token (called by performance tracking)
  async updateTokenPrice(tokenMint: string, currentPrice: number, volume?: number): Promise<void> {
    const token = this.activePositions.get(tokenMint);
    
    if (token) {
      token.currentPrice = currentPrice;
      if (volume) {
        token.volume24h = volume;
      }
    }
  }

  // Get current price of a token
  async getCurrentPrice(tokenMint: string): Promise<number | null> {
    try {
      // This is a simulation - replace with actual price fetching
      const token = this.activePositions.get(tokenMint);
      if (token && token.currentPrice) {
        // Simulate price movement
        const volatility = 0.05; // 5% volatility
        const change = (Math.random() - 0.5) * volatility;
        return token.currentPrice * (1 + change);
      }
      return null;
    } catch (error) {
      console.error(`Error fetching price for ${tokenMint}:`, error);
      return null;
    }
  }

  // Log events for later analysis
  private logEvent(eventType: string, data: any): void {
    const event = {
      timestamp: Date.now(),
      type: eventType,
      ...data
    };
    
    // Append to event log
    this.eventLog.push(event);
    
    // Optionally write to file
    if (this.config.saveTradeHistory) {
      try {
        fs.appendFileSync('./data/5x_events.jsonl', JSON.stringify(event) + '\n');
      } catch (error) {
        console.log(`⚠️ Could not save event: ${error}`);
      }
    }
  }

  // Simulation methods
  private async getLiquidityETH(tokenMint: string): Promise<number> {
    if (Math.random() > 0.9) {
      throw new Error('Liquidity data not yet available');
    }
    return Math.random() * 9.5 + 0.5;
  }

  private async checkAuthorities(tokenMint: string): Promise<{mintAuthority: boolean, freezeAuthority: boolean}> {
    return {
      mintAuthority: Math.random() > 0.7,
      freezeAuthority: Math.random() > 0.8
    };
  }

  private simulateEntryPrice(): number {
    return Math.random() * 0.009999 + 0.000001;
  }

  private startBackgroundScorer(): void {
    this.backgroundScorer = setInterval(async () => {
      const pendingTokens = Array.from(this.pendingTokens.values())
        .filter(token => 
          token.status === 'pending' && 
          token.scoringAttempts < 5 &&
          (Date.now() - token.detectedAt.getTime()) > 30000
        );

      if (pendingTokens.length > 0 && this.poolManager.canExecuteTrade()) {
        console.log(`🔄 Background scoring ${pendingTokens.length} pending tokens...`);
        for (const token of pendingTokens) {
          if (this.poolManager.canExecuteTrade()) {
            await this.attemptStage1Scoring(token);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            console.log(`⏸️  Background scoring paused - pool depleted`);
            break;
          }
        }
      }
      
      // Update prices for active positions
      for (const [tokenMint, token] of this.activePositions.entries()) {
        const newPrice = await this.getCurrentPrice(tokenMint);
        if (newPrice) {
          await this.updateTokenPrice(tokenMint, newPrice);
        }
      }
    }, 30000);
  }

  private saveToCsv(token: PendingToken): void {
    try {
      const csvData = [
        token.tokenMint,
        token.signature,
        token.detectedAt.toISOString(),
        token.status,
        token.scoringAttempts,
        token.initialLiquidity || '',
        token.stage1Passed || '',
        token.stage2Score || '',
        token.lastScoredAt?.toISOString() || '',
        token.errors.join(';')
      ].join(',');

      fs.appendFileSync(this.csvPath, csvData + '\n');
    } catch (error) {
      console.log(`⚠️ Could not save to CSV: ${error}`);
    }
  }

  private logTradingAction(token: PendingToken, action: string, amount?: number, entryPrice?: number): void {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        action,
        tokenMint: token.tokenMint,
        amount,
        entryPrice,
        stage1Passed: token.stage1Passed,
        liquidityETH: token.initialLiquidity,
        poolStatus: this.poolManager.getPoolSummary()
      };
      
      fs.appendFileSync('./data/trading_log.json', JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.log(`⚠️ Could not save to trading log: ${error}`);
    }
  }

  getQueueStatus(): {pending: number, analyzing: number, bought: number, rejected: number, poolDepleted: number} {
    const tokens = Array.from(this.pendingTokens.values());
    return {
      pending: tokens.filter(t => t.status === 'pending').length,
      analyzing: tokens.filter(t => t.status === 'analyzing').length,
      bought: tokens.filter(t => t.status === 'bought').length,
      rejected: tokens.filter(t => t.status === 'rejected').length,
      poolDepleted: tokens.filter(t => t.status === 'pool_depleted').length
    };
  }

  printQueueReport(): void {
    const status = this.getQueueStatus();
    const poolSummary = this.poolManager.getPoolSummary();
    
    console.log(`\n📊 TOKEN QUEUE STATUS:`);
    console.log(`   ⏳ Pending: ${status.pending}`);
    console.log(`   🔍 Analyzing: ${status.analyzing}`);
    console.log(`   ✅ Bought: ${status.bought}`);
    console.log(`   ❌ Rejected: ${status.rejected}`);
    console.log(`   ⏸️  Pool Depleted: ${status.poolDepleted}`);
    console.log(`\n🏦 POOL STATUS:`);
    console.log(`   💰 Balance: $${poolSummary.currentPool.toFixed(2)}`);
    console.log(`   📊 ROI: ${poolSummary.roi.toFixed(2)}%`);
    console.log(`   🎯 Can Trade: ${poolSummary.canTrade ? '✅' : '🚫'}`);
    
    // Show active positions
    const activeCount = this.activePositions.size;
    if (activeCount > 0) {
      console.log(`\n💎 ACTIVE POSITIONS: ${activeCount}`);
      for (const position of this.getActivePositions()) {
        console.log(`   ${position.tokenMint.slice(0, 8)}... | Gain: ${position.currentGain.toFixed(2)}% | Hold: ${position.holdTime}m`);
      }
    }
  }

  // Pool management methods
  getPoolManager(): PoolManager {
    return this.poolManager;
  }

  printDetailedPoolReport(): void {
    this.poolManager.printPoolStatus();
  }

  shutdown(): void {
    if (this.backgroundScorer) {
      clearInterval(this.backgroundScorer);
    }
    this.poolManager.printFinalSummary();
    
    // Log final stats for active positions
    if (this.activePositions.size > 0) {
      console.log(`\n⚠️ WARNING: ${this.activePositions.size} positions still active at shutdown`);
    }
    
    console.log(`🛑 Token queue manager shutdown`);
  }
}

export { TokenQueueManager, PoolManager };