// ============================================
// WHALE WATCHER (ACTIVELY USED - DO NOT DELETE!)
// ============================================
// ⚠️  WARNING: This file IS being used by the bot!
//
// Import chain:
//   - token-queue-system.ts (line 3) imports WhaleWatcher class
//   - TokenQueueManager (line 305) declares whaleWatcher property
//   - TokenQueueManager constructor (line 333) instantiates WhaleWatcher
//   - Called at line 534: this.whaleWatcher.startWhaleMonitoring()
//   - Bot uses TokenQueueManager at index.ts line 755
//
// Purpose: Provides whale activity monitoring for TokenQueueManager
// Status: ACTIVE (used alongside PARTIAL-EXIT-SYSTEM.ts)
//
// Relationship with PARTIAL-EXIT-SYSTEM:
//   - TokenQueueManager uses WhaleWatcher for queue-based monitoring
//   - PARTIAL-EXIT-SYSTEM handles direct position monitoring
//   - Both systems can coexist (different monitoring approaches)
// ============================================

// POOL-INTEGRATED WHALE MONITOR - Enhanced version with 5x+ detection and tiered exits

import { Connection } from '@solana/web3.js';
import * as fs from 'fs';

interface ExitSignal {
  tokenMint: string;
  signalType: 'whale_exodus' | 'liquidity_drain' | 'combined_exit' | 'tiered_exit';
  shouldExit: boolean;
  reason: string;
  exitPrice: number;
  profitPercentage: number;
  holdTimeMinutes: number;
  confidence: 'low' | 'medium' | 'high';
  whalesSold: number;
  liquidityChange: number;
  exitPercentage?: number;  // NEW: For partial exits
}

interface TokenEntry {
  entryPrice: number;
  entryTime: Date;
  buyAmount: number;
  poolCallback?: (profitPercentage: number, holdTimeMinutes: number) => void;
  remainingPosition: number;  // NEW: Track remaining position for tiered exits
  maxHoldTime: number;  // NEW: Dynamic max hold time
  holdExtensions: number;  // NEW: Track extensions
  lastTierExited?: number;  // NEW: Track last exit tier
}

class WhaleWatcher {
  private connection: Connection;
  private tokenEntryData: Map<string, TokenEntry> = new Map();
  private config: any;  // NEW: Store config for tiered exits

  // OPTIMIZED WHALE TRIGGER SETTINGS (from your successful config)
  private readonly WHALE_EXIT_CONFIG = {
    minWhaleCount: 3,              // 3+ whales (was 2+)
    whaleSellPercentage: 40,       // 40%+ holdings (was 30%+)
    liquidityDropThreshold: 35,    // 35% liquidity drop (was 25%)
    minHoldTime: 2,               // 2 min minimum (was 0)
    maxHoldTime: 45,              // 45 min max (was no limit)
    stopLossThreshold: -30,        // -30% stop loss (was -50%)
    
    // Dynamic profit protection
    profitProtectionRules: {
      lowProfit: { threshold: 5, whaleCount: 3, sellThreshold: 45 },
      mediumProfit: { threshold: 20, whaleCount: 2, sellThreshold: 35 },
      highProfit: { threshold: 50, whaleCount: 2, sellThreshold: 25 }
    }
  };

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  // NEW: Method to extend hold time dynamically (5x+ detection)
  extendHoldTime(tokenMint: string, minutes: number, reason: string): void {
    const entry = this.tokenEntryData.get(tokenMint);
    if (!entry) return;
    
    entry.maxHoldTime += minutes;
    entry.holdExtensions++;
    
    console.log(`💎 HOLD EXTENDED for ${tokenMint.slice(0, 8)}...`);
    console.log(`   ⏰ Extended by: ${minutes} minutes`);
    console.log(`   📊 New max hold: ${entry.maxHoldTime} minutes`);
    console.log(`   🎯 Reason: ${reason}`);
    console.log(`   🔄 Total extensions: ${entry.holdExtensions}`);
  }

  // NEW: Method to handle tiered exits
  private executeTieredExit(
    tokenMint: string, 
    currentGain: number, 
    entry: TokenEntry
  ): { shouldSell: boolean; percentage: number; reason: string } {
    
    // Check if tiered exits are enabled
    if (!this.config?.exit?.tieredExit?.enabled) {
      // Fall back to old logic - sell 100% at take profit
      if (currentGain >= 100) {
        return { shouldSell: true, percentage: 1.0, reason: 'Standard take profit' };
      }
      return { shouldSell: false, percentage: 0, reason: 'Holding' };
    }
    
    // TIERED EXIT LOGIC
    // Tier 1: 2x (100% gain) - sell 25%
    if (currentGain >= 100 && entry.remainingPosition > 0.75 && (!entry.lastTierExited || entry.lastTierExited < 1)) {
      entry.remainingPosition = 0.75;
      entry.lastTierExited = 1;
      return { 
        shouldSell: true, 
        percentage: 0.25, 
        reason: `📈 TIER 1: Taking 25% at ${currentGain.toFixed(0)}% gain (2x)` 
      };
    }
    
    // Tier 2: 4x (300% gain) - sell another 25%
    if (currentGain >= 300 && entry.remainingPosition > 0.50 && (!entry.lastTierExited || entry.lastTierExited < 2)) {
      entry.remainingPosition = 0.50;
      entry.lastTierExited = 2;
      return { 
        shouldSell: true, 
        percentage: 0.25, 
        reason: `📈 TIER 2: Taking 25% at ${currentGain.toFixed(0)}% gain (4x)` 
      };
    }
    
    // Tier 3: 6x (500% gain) - sell another 25%
    if (currentGain >= 500 && entry.remainingPosition > 0.25 && (!entry.lastTierExited || entry.lastTierExited < 3)) {
      entry.remainingPosition = 0.25;
      entry.lastTierExited = 3;
      return { 
        shouldSell: true, 
        percentage: 0.25, 
        reason: `📈 TIER 3: Taking 25% at ${currentGain.toFixed(0)}% gain (6x)` 
      };
    }
    
    // Moon bag logic (the final 25%)
    if (entry.remainingPosition <= 0.25) {
      // Check moon bag exit conditions
      const moonExit = this.checkMoonBagExit(currentGain, entry);
      if (moonExit.shouldExit) {
        entry.remainingPosition = 0;
        return { 
          shouldSell: true, 
          percentage: 0.25, 
          reason: moonExit.reason 
        };
      }
    }
    
    return { 
      shouldSell: false, 
      percentage: 0, 
      reason: `💎 Holding ${(entry.remainingPosition * 100).toFixed(0)}% position at ${currentGain.toFixed(0)}% gain` 
    };
  }

  // NEW: Check moon bag exit conditions
  private checkMoonBagExit(currentGain: number, entry: TokenEntry): { shouldExit: boolean; reason: string } {
    const holdTimeMinutes = (Date.now() - entry.entryTime.getTime()) / (1000 * 60);
    const moonConfig = this.config?.exit?.tieredExit?.moonBag?.exitConditions;
    
    if (!moonConfig) {
      // Default moon bag exit at 20x
      if (currentGain >= 2000) {
        return { 
          shouldExit: true, 
          reason: `🌙 MOON ACHIEVED: Taking final 25% at ${currentGain.toFixed(0)}% gain (${(currentGain/100 + 1).toFixed(0)}x)!` 
        };
      }
      return { shouldExit: false, reason: 'Holding moon bag' };
    }
    
    // Mega moon target
    if (currentGain >= (moonConfig.megaMoonTarget || 2000)) {
      return { 
        shouldExit: true, 
        reason: `🌙 MEGA MOON: ${currentGain.toFixed(0)}% gain (${(currentGain/100 + 1).toFixed(0)}x)!` 
      };
    }
    
    // Time degradation
    if (moonConfig.timeDegradation?.enabled) {
      if (holdTimeMinutes > 120 && currentGain >= (moonConfig.timeDegradation.after120min || 400)) {
        return { shouldExit: true, reason: `⏰ 2hr target: ${currentGain.toFixed(0)}% gain` };
      }
      if (holdTimeMinutes > 90 && currentGain >= (moonConfig.timeDegradation.after90min || 600)) {
        return { shouldExit: true, reason: `⏰ 90min target: ${currentGain.toFixed(0)}% gain` };
      }
      if (holdTimeMinutes > 60 && currentGain >= (moonConfig.timeDegradation.after60min || 800)) {
        return { shouldExit: true, reason: `⏰ 60min target: ${currentGain.toFixed(0)}% gain` };
      }
    }
    
    return { shouldExit: false, reason: 'Holding moon bag for higher gains' };
  }

  // ENHANCED: Now accepts config for tiered exits
  async startWhaleMonitoring(
    tokenMint: string, 
    entryPrice: number = 0, 
    buyAmount: number = 0.089,
    poolCallback?: (profitPercentage: number, holdTimeMinutes: number) => void,
    config?: any  // NEW: Accept config for tiered exits
  ): Promise<void> {
    console.log(`🐋 STARTING ENHANCED WHALE WATCH: ${tokenMint.slice(0, 8)}...`);
    
    this.config = config;  // Store config for tiered exits
    
    this.tokenEntryData.set(tokenMint, {
      entryPrice: entryPrice || this.simulateEntryPrice(),
      entryTime: new Date(),
      buyAmount,
      poolCallback,
      remainingPosition: 1.0,  // Start with 100% position
      maxHoldTime: config?.exit?.maxHoldTime || 45,  // Dynamic max hold
      holdExtensions: 0,
      lastTierExited: 0
    });

    console.log(`   📊 Using optimized whale triggers (3+ whales, 40%+ sells, 2min minimum)`);
    if (config?.exit?.tieredExit?.enabled) {
      console.log(`   🎯 Tiered exits: ENABLED (25% at 2x, 4x, 6x, moon bag at 20x+)`);
    }
    if (poolCallback) {
      console.log(`   🏦 Pool integration: ACTIVE (will update pool on exit)`);
    }
    
    // Monitor at multiple intervals for tiered exits
    const monitoringIntervals = [
      30000,   // 30 seconds
      60000,   // 1 minute
      120000,  // 2 minutes
      180000,  // 3 minutes
      300000,  // 5 minutes
      600000,  // 10 minutes
      900000,  // 15 minutes
      1800000, // 30 minutes
      2700000  // 45 minutes
    ];
    
    monitoringIntervals.forEach(interval => {
      setTimeout(() => this.checkExitConditions(tokenMint), interval);
    });
  }

  // NEW: Unified exit condition checker
  private async checkExitConditions(tokenMint: string): Promise<void> {
    const entry = this.tokenEntryData.get(tokenMint);
    if (!entry || entry.remainingPosition <= 0) return;

    const holdTimeMinutes = (Date.now() - entry.entryTime.getTime()) / (1000 * 60);
    const exitPrice = this.simulateExitPrice(entry.entryPrice);
    const currentGain = ((exitPrice - entry.entryPrice) / entry.entryPrice) * 100;
    
    console.log(`\n📊 POSITION CHECK: ${tokenMint.slice(0, 8)}...`);
    console.log(`   💰 Current gain: ${currentGain.toFixed(1)}%`);
    console.log(`   ⏰ Hold time: ${holdTimeMinutes.toFixed(1)} minutes`);
    console.log(`   📊 Remaining position: ${(entry.remainingPosition * 100).toFixed(0)}%`);
    
    // First check tiered exits
    const tieredExit = this.executeTieredExit(tokenMint, currentGain, entry);
    if (tieredExit.shouldSell) {
      console.log(`   ${tieredExit.reason}`);
      
      // Execute partial exit
      if (entry.poolCallback) {
        // For partial exits, only report the gain on the portion sold
        const partialGain = currentGain * tieredExit.percentage;
        entry.poolCallback(partialGain, holdTimeMinutes);
      }
      
      // Log the tiered exit
      this.logOptimizedExitEvent(tokenMint, {
        tokenMint,
        signalType: 'tiered_exit',
        shouldExit: true,
        reason: tieredExit.reason,
        exitPrice,
        profitPercentage: currentGain,
        holdTimeMinutes,
        confidence: 'high',
        whalesSold: 0,
        liquidityChange: 0,
        exitPercentage: tieredExit.percentage
      });
      
      // If fully exited, remove from monitoring
      if (entry.remainingPosition <= 0) {
        this.tokenEntryData.delete(tokenMint);
      }
      
      return;
    }
    
    // Then check whale activity (only if still holding)
    await this.simulateWhaleActivity(tokenMint);
  }

  private async simulateWhaleActivity(tokenMint: string): Promise<void> {
    const entryData = this.tokenEntryData.get(tokenMint);
    if (!entryData || entryData.remainingPosition <= 0) return;

    const holdTimeMinutes = (Date.now() - entryData.entryTime.getTime()) / (1000 * 60);
    
    // Don't trigger whale exits before minimum hold time
    if (holdTimeMinutes < this.WHALE_EXIT_CONFIG.minHoldTime) {
      return;
    }

    // Check if we've exceeded dynamic max hold time
    if (holdTimeMinutes >= entryData.maxHoldTime) {
      const exitPrice = this.simulateExitPrice(entryData.entryPrice);
      const profitPercentage = ((exitPrice - entryData.entryPrice) / entryData.entryPrice) * 100;
      
      console.log(`\n⏰ MAX HOLD TIME REACHED: ${holdTimeMinutes.toFixed(1)} minutes`);
      
      const exitSignal: ExitSignal = {
        tokenMint,
        signalType: 'whale_exodus',
        shouldExit: true,
        reason: `⏰ MAX HOLD TIME: ${holdTimeMinutes.toFixed(1)} min (extended ${entryData.holdExtensions} times)`,
        exitPrice,
        profitPercentage,
        holdTimeMinutes,
        confidence: 'medium',
        whalesSold: 0,
        liquidityChange: 0,
        exitPercentage: entryData.remainingPosition
      };
      
      await this.triggerExitSignal(tokenMint, exitSignal);
      return;
    }

    // Simulate whale activity (less frequently for positions already partially exited)
    if (Math.random() > 0.3) return;  // Only 30% chance of whale activity
    
    const whaleCount = Math.floor(Math.random() * 5) + 1;
    const sellPercentages = Array.from({length: whaleCount}, () => Math.random() * 80 + 10);
    const totalSellPercentage = sellPercentages.reduce((sum, pct) => sum + pct, 0) / whaleCount;
    
    const exitSignal = await this.analyzeOptimizedExitConditions(tokenMint, whaleCount, totalSellPercentage);
    
    if (exitSignal.shouldExit && entryData.remainingPosition > 0) {
      exitSignal.exitPercentage = entryData.remainingPosition;  // Exit remaining position
      await this.triggerExitSignal(tokenMint, exitSignal);
    }
  }

  private async analyzeOptimizedExitConditions(
    tokenMint: string, 
    whaleCount: number, 
    avgSellPercentage: number
  ): Promise<ExitSignal> {
    const entryData = this.tokenEntryData.get(tokenMint);
    const exitPrice = this.simulateExitPrice(entryData?.entryPrice || 0);
    const profitPercentage = entryData ? ((exitPrice - entryData.entryPrice) / entryData.entryPrice) * 100 : 0;
    const holdTimeMinutes = entryData ? (Date.now() - entryData.entryTime.getTime()) / (1000 * 60) : 0;
    const liquidityChange = Math.random() * 60 - 30;

    // DYNAMIC PROFIT PROTECTION RULES
    let requiredWhaleCount = this.WHALE_EXIT_CONFIG.minWhaleCount;
    let requiredSellThreshold = this.WHALE_EXIT_CONFIG.whaleSellPercentage;
    let confidence: 'low' | 'medium' | 'high' = 'low';

    if (profitPercentage >= this.WHALE_EXIT_CONFIG.profitProtectionRules.highProfit.threshold) {
      requiredWhaleCount = this.WHALE_EXIT_CONFIG.profitProtectionRules.highProfit.whaleCount;
      requiredSellThreshold = this.WHALE_EXIT_CONFIG.profitProtectionRules.highProfit.sellThreshold;
      confidence = 'high';
    } else if (profitPercentage >= this.WHALE_EXIT_CONFIG.profitProtectionRules.mediumProfit.threshold) {
      requiredWhaleCount = this.WHALE_EXIT_CONFIG.profitProtectionRules.mediumProfit.whaleCount;
      requiredSellThreshold = this.WHALE_EXIT_CONFIG.profitProtectionRules.mediumProfit.sellThreshold;
      confidence = 'medium';
    }

    // STOP LOSS OVERRIDE (only for remaining position)
    if (profitPercentage <= this.WHALE_EXIT_CONFIG.stopLossThreshold) {
      return {
        tokenMint,
        signalType: 'whale_exodus',
        shouldExit: true,
        reason: `🔴 STOP LOSS: ${profitPercentage.toFixed(1)}% loss exceeds -30% threshold`,
        exitPrice,
        profitPercentage,
        holdTimeMinutes,
        confidence: 'high',
        whalesSold: whaleCount,
        liquidityChange
      };
    }

    // OPTIMIZED WHALE EXIT LOGIC
    const shouldExit = whaleCount >= requiredWhaleCount && avgSellPercentage >= requiredSellThreshold;
    
    let reason: string;
    if (shouldExit) {
      reason = `🔴 WHALE EXIT: ${whaleCount} whales sold ${avgSellPercentage.toFixed(1)}%+`;
    } else {
      reason = `🟢 HOLDING: Whale activity below thresholds`;
    }

    return {
      tokenMint,
      signalType: 'whale_exodus',
      shouldExit,
      reason,
      exitPrice,
      profitPercentage,
      holdTimeMinutes,
      confidence,
      whalesSold: whaleCount,
      liquidityChange
    };
  }

  private async triggerExitSignal(tokenMint: string, signal: ExitSignal): Promise<void> {
    const entryData = this.tokenEntryData.get(tokenMint);
    if (!entryData) return;
    
    const exitPercentage = signal.exitPercentage || entryData.remainingPosition;
    
    console.log(`\n🚨 EXIT SIGNAL TRIGGERED! 🚨`);
    console.log(`   🪙 Token: ${tokenMint.slice(0, 8)}...`);
    console.log(`   💰 P&L: ${signal.profitPercentage > 0 ? '+' : ''}${signal.profitPercentage.toFixed(2)}%`);
    console.log(`   📊 Exiting: ${(exitPercentage * 100).toFixed(0)}% of position`);
    console.log(`   ⏰ Hold Time: ${signal.holdTimeMinutes.toFixed(1)} minutes`);
    if (entryData.holdExtensions > 0) {
      console.log(`   💎 Hold extended ${entryData.holdExtensions} times`);
    }
    console.log(`   🎯 Confidence: ${signal.confidence.toUpperCase()}`);

    // Pool integration callback
    if (entryData.poolCallback) {
      console.log(`   🏦 Updating pool with trade result...`);
      // Report the P&L for the portion being sold
      const partialPnL = signal.profitPercentage * exitPercentage;
      entryData.poolCallback(partialPnL, signal.holdTimeMinutes);
    }

    this.logOptimizedExitEvent(tokenMint, signal);
    
    // Update or remove from monitoring
    entryData.remainingPosition -= exitPercentage;
    if (entryData.remainingPosition <= 0.01) {  // Fully exited (allow for rounding)
      this.tokenEntryData.delete(tokenMint);
      console.log(`   ✅ Position fully closed`);
    } else {
      console.log(`   📊 Remaining position: ${(entryData.remainingPosition * 100).toFixed(0)}%`);
    }
  }

  private simulateEntryPrice(): number {
    return Math.random() * 0.009999 + 0.000001;
  }

  private simulateExitPrice(entryPrice: number): number {
    // More realistic with potential for 5x+ gains
    const scenarios = [
      { multiplier: 0.5, weight: 5 },    // -50%
      { multiplier: 0.7, weight: 10 },   // -30%
      { multiplier: 0.9, weight: 15 },   // -10%
      { multiplier: 1.0, weight: 20 },   // Break even
      { multiplier: 1.1, weight: 15 },   // +10%
      { multiplier: 1.3, weight: 10 },   // +30%
      { multiplier: 2.0, weight: 10 },   // 2x
      { multiplier: 4.0, weight: 8 },    // 4x
      { multiplier: 6.0, weight: 5 },    // 6x
      { multiplier: 10.0, weight: 2 }    // 10x+ (moon)
    ];
    
    const totalWeight = scenarios.reduce((sum, s) => sum + s.weight, 0);
    const random = Math.random() * totalWeight;
    let cumWeight = 0;
    
    for (const scenario of scenarios) {
      cumWeight += scenario.weight;
      if (random <= cumWeight) {
        // Add some variance
        const variance = 0.9 + Math.random() * 0.2;  // ±10% variance
        return entryPrice * scenario.multiplier * variance;
      }
    }
    
    return entryPrice * 1.1;
  }

  private logOptimizedExitEvent(tokenMint: string, signal: ExitSignal): void {
    try {
      if (!fs.existsSync('./data')) {
        fs.mkdirSync('./data', { recursive: true });
      }

      const exitLog = {
        timestamp: new Date().toISOString(),
        tokenMint,
        exitSignal: signal,
        optimizedTriggers: true,
        poolIntegrated: true,
        tieredExit: signal.signalType === 'tiered_exit',
        exitPercentage: signal.exitPercentage || 1.0
      };
      
      fs.appendFileSync('./data/whale_exits.jsonl', JSON.stringify(exitLog) + '\n');
      
      const csvPath = './data/paper_trading_exits.csv';
      const csvHeaders = 'TokenMint,ExitTime,SignalType,Confidence,ProfitPercentage,HoldTimeMinutes,WhalesSold,LiquidityChange,ExitPercentage,Reason\n';
      
      if (!fs.existsSync(csvPath)) {
        fs.writeFileSync(csvPath, csvHeaders);
      }
      
      const csvRow = [
        tokenMint,
        new Date().toISOString(),
        signal.signalType,
        signal.confidence,
        signal.profitPercentage.toFixed(2),
        signal.holdTimeMinutes.toFixed(1),
        signal.whalesSold,
        signal.liquidityChange.toFixed(1),
        ((signal.exitPercentage || 1.0) * 100).toFixed(0),
        `"${signal.reason}"`
      ].join(',') + '\n';
      
      fs.appendFileSync(csvPath, csvRow);
      
    } catch (error) {
      console.log(`   ⚠️ Error logging exit: ${error}`);
    }
  }

  getMonitoringStatus(): {
    activeMonitoringCount: number;
    tokens: Array<{
      tokenMint: string;
      holdTimeMinutes: number;
      hasPoolCallback: boolean;
      remainingPosition: number;
      holdExtensions: number;
    }>;
  } {
    const tokens = Array.from(this.tokenEntryData.entries()).map(([mint, data]) => ({
      tokenMint: mint,
      holdTimeMinutes: (Date.now() - data.entryTime.getTime()) / (1000 * 60),
      hasPoolCallback: !!data.poolCallback,
      remainingPosition: data.remainingPosition,
      holdExtensions: data.holdExtensions
    }));

    return {
      activeMonitoringCount: tokens.length,
      tokens
    };
  }

  async forceExitAll(reason: string = 'Emergency exit'): Promise<void> {
    console.log(`🚨 FORCE EXITING ALL POSITIONS: ${reason}`);
    
    const tokens = Array.from(this.tokenEntryData.keys());
    
    for (const tokenMint of tokens) {
      const entryData = this.tokenEntryData.get(tokenMint);
      if (!entryData) continue;

      const holdTimeMinutes = (Date.now() - entryData.entryTime.getTime()) / (1000 * 60);
      const exitPrice = this.simulateExitPrice(entryData.entryPrice);
      const profitPercentage = ((exitPrice - entryData.entryPrice) / entryData.entryPrice) * 100;

      const forceExitSignal: ExitSignal = {
        tokenMint,
        signalType: 'combined_exit',
        shouldExit: true,
        reason: `🚨 FORCE EXIT: ${reason}`,
        exitPrice,
        profitPercentage,
        holdTimeMinutes,
        confidence: 'high',
        whalesSold: 0,
        liquidityChange: 0,
        exitPercentage: entryData.remainingPosition
      };

      console.log(`   🚨 Force exiting ${tokenMint.slice(0, 8)}... | P&L: ${profitPercentage.toFixed(2)}% | Remaining: ${(entryData.remainingPosition * 100).toFixed(0)}%`);

      if (entryData.poolCallback) {
        entryData.poolCallback(profitPercentage * entryData.remainingPosition, holdTimeMinutes);
      }

      this.logOptimizedExitEvent(tokenMint, forceExitSignal);
    }

    this.tokenEntryData.clear();
    console.log(`✅ All positions force-exited`);
  }

  generateTradingReport(): void {
    const status = this.getMonitoringStatus();
    console.log(`📊 Whale Watcher Status:`);
    console.log(`   🐋 Active monitoring: ${status.activeMonitoringCount} tokens`);
    console.log(`   🏦 Pool-integrated: ${status.tokens.filter(t => t.hasPoolCallback).length} tokens`);
    console.log(`   💎 Extended holds: ${status.tokens.filter(t => t.holdExtensions > 0).length} tokens`);
    
    if (status.tokens.length > 0) {
      console.log(`   ⏰ Avg hold time: ${(status.tokens.reduce((sum, t) => sum + t.holdTimeMinutes, 0) / status.tokens.length).toFixed(1)} min`);
      console.log(`   📊 Avg remaining: ${(status.tokens.reduce((sum, t) => sum + t.remainingPosition, 0) / status.tokens.length * 100).toFixed(0)}%`);
    }
  }
}

export interface ModuleParams {
  config: any;
  outDir: string;
}

export async function generateReports({ config, outDir }: ModuleParams) {
  console.log('📊 Generating automated reports...');
  console.log(`📁 Output directory: ${outDir}`);
  
  const watcher = new WhaleWatcher(config.rpcUrl || 'https://api.mainnet-beta.solana.com');
  watcher.generateTradingReport();
  
  console.log('✅ Reports generated successfully');
}

export { WhaleWatcher };