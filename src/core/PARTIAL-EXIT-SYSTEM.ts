/**
 * ============================================
 * PARTIAL EXIT SYSTEM
 * ============================================
 *
 * Manages tiered profit-taking for positions:
 * - 25% at 2x (entry price doubles)
 * - 25% at 4x (entry price 4x)
 * - 25% at 6x (entry price 6x)
 * - 25% moonbag (never sells)
 *
 * Created: October 28, 2025
 * Purpose: Enable incremental profit-taking instead of all-or-nothing exits
 */

import { PublicKey } from '@solana/web3.js';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface ExitTier {
  name: string;
  multiplier: number;      // Price multiplier (2x, 4x, 6x)
  percentage: number;      // Percentage of ORIGINAL position to sell
  triggerPrice: number;    // Calculated trigger price
  executed: boolean;       // Has this tier been executed?
  executedAt?: number;     // Timestamp of execution
  soldAmount?: number;     // Amount of tokens sold
  profitSOL?: number;      // SOL profit from this tier
}

export interface PositionWithExits {
  mint: string;
  symbol?: string;
  entryPrice: number;          // SOL per token at entry
  entryTime: number;           // Timestamp of entry
  initialAmount: number;       // Original token amount purchased
  remainingAmount: number;     // Current token amount held
  investedSOL: number;         // Total SOL invested
  exitTiers: ExitTier[];       // Exit tier configuration
  lastChecked: number;         // Last price check timestamp
  currentPrice?: number;       // Latest price update
  currentValue?: number;       // Current position value in SOL
  totalProfitTaken?: number;   // Cumulative profit from executed tiers
  isComplete: boolean;         // All non-moonbag tiers executed
}

export interface ExitResult {
  success: boolean;
  tier: ExitTier;
  actualAmountSold: number;
  profitSOL: number;
  remainingAmount: number;
  transactionSignature?: string;
  error?: string;
}

// ============================================
// DEFAULT EXIT TIER CONFIGURATION
// ============================================
// ⚠️ TEMPORARY TEST VALUES - Lower multipliers for quick exit testing
// Revert to production values (2x, 4x, 6x) after verification!

export const DEFAULT_EXIT_TIERS = [
  {
    name: "Tier 1 - First Profit (TEST)",
    multiplier: 1.05,        // 5% gain - TEMPORARY for testing
    percentage: 25,          // Sell 25% of original
    triggerPrice: 0,         // Calculated at runtime
    executed: false
  },
  {
    name: "Tier 2 - Strong Gain (TEST)",
    multiplier: 1.10,        // 10% gain - TEMPORARY for testing
    percentage: 25,          // Sell 25% of original
    triggerPrice: 0,         // Calculated at runtime
    executed: false
  },
  {
    name: "Tier 3 - Major Win (TEST)",
    multiplier: 1.20,        // 20% gain - TEMPORARY for testing
    percentage: 25,          // Sell 25% of original
    triggerPrice: 0,         // Calculated at runtime
    executed: false
  },
  {
    name: "Tier 4 - Moonbag",
    multiplier: Infinity,    // Never sells
    percentage: 25,          // Final 25%
    triggerPrice: Infinity,  // Never triggers
    executed: false
  }
];

// ============================================
// PRODUCTION EXIT TIER CONFIGURATION (COMMENTED OUT)
// ============================================
// Uncomment these and comment out TEST values above for production:
/*
export const DEFAULT_EXIT_TIERS = [
  { name: "Tier 1 - First Profit", multiplier: 2, percentage: 25, triggerPrice: 0, executed: false },
  { name: "Tier 2 - Strong Gain", multiplier: 4, percentage: 25, triggerPrice: 0, executed: false },
  { name: "Tier 3 - Major Win", multiplier: 6, percentage: 25, triggerPrice: 0, executed: false },
  { name: "Tier 4 - Moonbag", multiplier: Infinity, percentage: 25, triggerPrice: Infinity, executed: false }
];
*/

// ============================================
// PARTIAL EXIT MANAGER CLASS
// ============================================

export class PartialExitManager {
  private positions: Map<string, PositionWithExits>;
  private onExitCallback?: (mint: string, tier: ExitTier, result: ExitResult) => Promise<void>;

  constructor() {
    this.positions = new Map();
  }

  /**
   * Register a callback function to execute when an exit tier is triggered
   */
  public onExit(callback: (mint: string, tier: ExitTier, result: ExitResult) => Promise<void>): void {
    this.onExitCallback = callback;
  }

  /**
   * Add a new position to track for partial exits
   */
  public addPosition(
    mint: string,
    entryPrice: number,
    tokenAmount: number,
    investedSOL: number,
    symbol?: string
  ): PositionWithExits {
    // Create exit tiers with calculated trigger prices
    const exitTiers: ExitTier[] = DEFAULT_EXIT_TIERS.map(tier => ({
      ...tier,
      triggerPrice: entryPrice * tier.multiplier
    }));

    const position: PositionWithExits = {
      mint,
      symbol,
      entryPrice,
      entryTime: Date.now(),
      initialAmount: tokenAmount,
      remainingAmount: tokenAmount,
      investedSOL,
      exitTiers,
      lastChecked: Date.now(),
      currentPrice: entryPrice,
      currentValue: investedSOL,
      totalProfitTaken: 0,
      isComplete: false
    };

    this.positions.set(mint, position);

    console.log(`\n📊 POSITION TRACKING STARTED`);
    console.log(`   Token: ${mint.slice(0, 8)}... ${symbol || ''}`);
    console.log(`   Entry Price: ${entryPrice.toFixed(9)} SOL`);
    console.log(`   Amount: ${tokenAmount.toLocaleString()} tokens`);
    console.log(`   Invested: ${investedSOL.toFixed(4)} SOL`);
    console.log(`\n🎯 EXIT TIERS:`);
    exitTiers.forEach((tier, idx) => {
      if (tier.multiplier !== Infinity) {
        console.log(`   ${idx + 1}. ${tier.name}`);
        console.log(`      Trigger: ${tier.triggerPrice.toFixed(9)} SOL (${tier.multiplier}x)`);
        console.log(`      Sell: ${tier.percentage}% of position (${(tokenAmount * tier.percentage / 100).toLocaleString()} tokens)`);
      } else {
        console.log(`   ${idx + 1}. ${tier.name}: HOLD FOREVER 💎`);
      }
    });

    return position;
  }

  /**
   * Update the current price for a position and check if any exit tiers should trigger
   */
  public async updatePrice(mint: string, currentPrice: number): Promise<ExitResult[]> {
    const position = this.positions.get(mint);
    if (!position) {
      console.warn(`⚠️ Position not found for mint: ${mint}`);
      return [];
    }

    // Update position data
    position.currentPrice = currentPrice;
    position.currentValue = position.remainingAmount * currentPrice;
    position.lastChecked = Date.now();

    const results: ExitResult[] = [];

    // Check each tier
    for (const tier of position.exitTiers) {
      // Skip if already executed or is moonbag
      if (tier.executed || tier.multiplier === Infinity) {
        continue;
      }

      // Check if price has reached this tier's trigger
      if (currentPrice >= tier.triggerPrice) {
        // PHASE 4C: Enhanced tier trigger logging
        const currentMultiple = (currentPrice / position.entryPrice).toFixed(2);
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🎯 [EXIT-TIER] ${tier.name} TRIGGERED for ${mint.slice(0, 8)}...`);
        console.log(`   Entry Price: ${position.entryPrice.toFixed(9)} SOL`);
        console.log(`   Trigger Price: ${tier.triggerPrice.toFixed(9)} SOL (${tier.multiplier}x target)`);
        console.log(`   Current Price: ${currentPrice.toFixed(9)} SOL (${currentMultiple}x actual)`);
        console.log(`   Sell Amount: ${tier.percentage}% of original position`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        // Calculate amount to sell (percentage of ORIGINAL position)
        const amountToSell = Math.floor(position.initialAmount * tier.percentage / 100);

        // PHASE 4C: Log before execution
        console.log(`[EXIT-TIER] Executing partial exit: ${amountToSell.toLocaleString()} tokens (${tier.percentage}%)`);

        // Execute the exit
        const result = await this.executeExit(mint, tier, amountToSell, currentPrice);
        results.push(result);

        // Call registered callback if exists
        if (this.onExitCallback && result.success) {
          await this.onExitCallback(mint, tier, result);
        }
      }
    }

    // Check if position is complete (all non-moonbag tiers executed)
    const nonMoonbagTiers = position.exitTiers.filter(t => t.multiplier !== Infinity);
    const allExecuted = nonMoonbagTiers.every(t => t.executed);
    if (allExecuted && !position.isComplete) {
      position.isComplete = true;
      console.log(`\n✅ POSITION COMPLETE: All exit tiers executed`);
      console.log(`   Moonbag remaining: ${position.remainingAmount.toLocaleString()} tokens`);
      console.log(`   Total profit taken: ${(position.totalProfitTaken || 0).toFixed(4)} SOL`);
    }

    return results;
  }

  /**
   * Execute a partial exit for a specific tier
   */
  private async executeExit(
    mint: string,
    tier: ExitTier,
    amountToSell: number,
    currentPrice: number
  ): Promise<ExitResult> {
    const position = this.positions.get(mint);
    if (!position) {
      return {
        success: false,
        tier,
        actualAmountSold: 0,
        profitSOL: 0,
        remainingAmount: 0,
        error: 'Position not found'
      };
    }

    // Validate we have enough tokens to sell
    if (amountToSell > position.remainingAmount) {
      console.warn(`⚠️ Attempted to sell more than remaining: ${amountToSell} > ${position.remainingAmount}`);
      amountToSell = position.remainingAmount;
    }

    // Calculate profit
    const costBasis = (amountToSell / position.initialAmount) * position.investedSOL;
    const saleValue = amountToSell * currentPrice;
    const profitSOL = saleValue - costBasis;

    console.log(`\n💰 EXECUTING PARTIAL EXIT`);
    console.log(`   Selling: ${amountToSell.toLocaleString()} tokens`);
    console.log(`   Cost Basis: ${costBasis.toFixed(4)} SOL`);
    console.log(`   Sale Value: ${saleValue.toFixed(4)} SOL`);
    console.log(`   Profit: ${profitSOL.toFixed(4)} SOL (${((profitSOL/costBasis)*100).toFixed(1)}%)`);

    // Mark tier as executed
    tier.executed = true;
    tier.executedAt = Date.now();
    tier.soldAmount = amountToSell;
    tier.profitSOL = profitSOL;

    // Update position
    position.remainingAmount -= amountToSell;
    position.totalProfitTaken = (position.totalProfitTaken || 0) + profitSOL;

    console.log(`   Remaining: ${position.remainingAmount.toLocaleString()} tokens`);

    return {
      success: true,
      tier,
      actualAmountSold: amountToSell,
      profitSOL,
      remainingAmount: position.remainingAmount,
      transactionSignature: undefined // Will be set by actual sell execution
    };
  }

  /**
   * Get position details
   */
  public getPosition(mint: string): PositionWithExits | undefined {
    return this.positions.get(mint);
  }

  /**
   * Get all tracked positions
   */
  public getAllPositions(): PositionWithExits[] {
    return Array.from(this.positions.values());
  }

  /**
   * Remove a position from tracking
   */
  public removePosition(mint: string): boolean {
    return this.positions.delete(mint);
  }

  /**
   * Get summary of all positions
   */
  public getSummary(): {
    totalPositions: number;
    activePositions: number;
    completedPositions: number;
    totalInvested: number;
    totalProfitTaken: number;
    totalCurrentValue: number;
  } {
    const positions = Array.from(this.positions.values());

    return {
      totalPositions: positions.length,
      activePositions: positions.filter(p => !p.isComplete).length,
      completedPositions: positions.filter(p => p.isComplete).length,
      totalInvested: positions.reduce((sum, p) => sum + p.investedSOL, 0),
      totalProfitTaken: positions.reduce((sum, p) => sum + (p.totalProfitTaken || 0), 0),
      totalCurrentValue: positions.reduce((sum, p) => sum + (p.currentValue || 0), 0)
    };
  }

  /**
   * Check if a position should sell based on stop-loss
   * This is separate from tiered exits and sells the entire remaining position
   */
  public checkStopLoss(mint: string, stopLossPercentage: number = -50): {
    shouldSell: boolean;
    currentLoss?: number;
    reason?: string;
  } {
    const position = this.positions.get(mint);
    if (!position || !position.currentPrice) {
      return { shouldSell: false };
    }

    const currentValue = position.remainingAmount * position.currentPrice;
    const originalInvestment = position.investedSOL;
    const currentLossPercentage = ((currentValue - originalInvestment) / originalInvestment) * 100;

    if (currentLossPercentage <= stopLossPercentage) {
      return {
        shouldSell: true,
        currentLoss: currentLossPercentage,
        reason: `Stop-loss triggered: ${currentLossPercentage.toFixed(1)}% loss (limit: ${stopLossPercentage}%)`
      };
    }

    return { shouldSell: false };
  }

  /**
   * Display status of a position
   */
  public displayPositionStatus(mint: string): void {
    const position = this.positions.get(mint);
    if (!position) {
      console.log(`⚠️ Position not found: ${mint}`);
      return;
    }

    const currentROI = position.currentValue && position.investedSOL
      ? ((position.currentValue - position.investedSOL) / position.investedSOL * 100)
      : 0;

    console.log(`\n📊 POSITION STATUS: ${mint.slice(0, 8)}...`);
    console.log(`   Symbol: ${position.symbol || 'Unknown'}`);
    console.log(`   Entry: ${position.entryPrice.toFixed(9)} SOL`);
    console.log(`   Current: ${(position.currentPrice || 0).toFixed(9)} SOL`);
    console.log(`   ROI: ${currentROI.toFixed(2)}%`);
    console.log(`   Remaining: ${position.remainingAmount.toLocaleString()} tokens`);
    console.log(`   Value: ${(position.currentValue || 0).toFixed(4)} SOL`);
    console.log(`   Profit Taken: ${(position.totalProfitTaken || 0).toFixed(4)} SOL`);
    console.log(`\n   Exit Tiers:`);
    position.exitTiers.forEach((tier, idx) => {
      const status = tier.executed ? '✅ EXECUTED' :
                     tier.multiplier === Infinity ? '💎 MOONBAG' : '⏳ PENDING';
      console.log(`   ${idx + 1}. ${tier.name}: ${status}`);
      if (tier.executed && tier.profitSOL) {
        console.log(`      Sold: ${tier.soldAmount?.toLocaleString()} tokens`);
        console.log(`      Profit: ${tier.profitSOL.toFixed(4)} SOL`);
      }
    });
  }
}

// ============================================
// SINGLETON INSTANCE (Optional)
// ============================================

let globalPartialExitManager: PartialExitManager | null = null;

export function getPartialExitManager(): PartialExitManager {
  if (!globalPartialExitManager) {
    globalPartialExitManager = new PartialExitManager();
  }
  return globalPartialExitManager;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate the amount to sell for a specific tier
 */
export function calculateTierAmount(
  originalAmount: number,
  tierPercentage: number
): number {
  return Math.floor(originalAmount * tierPercentage / 100);
}

/**
 * Calculate profit/loss for a partial exit
 */
export function calculatePartialProfit(
  amountSold: number,
  originalAmount: number,
  investedSOL: number,
  salePrice: number
): {
  costBasis: number;
  saleValue: number;
  profit: number;
  profitPercentage: number;
} {
  const costBasis = (amountSold / originalAmount) * investedSOL;
  const saleValue = amountSold * salePrice;
  const profit = saleValue - costBasis;
  const profitPercentage = (profit / costBasis) * 100;

  return {
    costBasis,
    saleValue,
    profit,
    profitPercentage
  };
}

export default PartialExitManager;
