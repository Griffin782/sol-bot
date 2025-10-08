
/**
 * COST BASIS TRACKER FOR SOL-BOT v5.0
 * ====================================
 * 
 * Integrates with existing SOL-BOT architecture:
 * - Uses NewPositionRecord from src/tracker/db.ts
 * - Compatible with TaxableTransaction from taxTracker.ts  
 * - Integrates with token-queue-system position tracking
 * - Supports pending_tokens.csv and pool_transactions.csv formats
 * 
 * Features:
 * - FIFO (First In, First Out) cost basis calculations
 * - Integration with existing position tracking
 * - Automatic save/load from data/cost_basis.json
 * - Wash sale detection (30-day rule)
 * - Partial sell support with proper cost basis allocation
 */

import * as fs from 'fs';
import * as path from 'path';
import { NewPositionRecord } from '../types';
import { TaxableTransaction } from './taxTracker';

// ============================================================================
// INTERFACES - Compatible with SOL-BOT v5.0 Architecture
// ============================================================================

export interface CostBasisEntry {
  // Core identification
  tokenMint: string;
  batchId: string;
  
  // Purchase details (from NewPositionRecord)
  purchaseDate: Date;
  purchaseTimestamp: number; // time from NewPositionRecord
  purchasePriceSOL: number;
  purchaseAmountTokens: number;
  purchaseAmountSOL: number; // init_sol from NewPositionRecord
  purchaseFees: number;
  
  // Tracking details
  remainingTokens: number;
  signature: string; // init_tx from NewPositionRecord
  provider: string; // provider from NewPositionRecord (jupiter, sniperoo)
  walletSigner?: string; // signer from NewPositionRecord
  
  // Additional metadata
  stage?: number; // from pending_tokens.csv
  status?: 'pending' | 'bought' | 'sold' | 'partial';
  notes?: string;
}

export interface SellCalculationResult {
  // Cost basis used (including fees)
  totalCostBasisUsed: number;
  totalPurchaseFees: number;
  
  // FIFO batch details
  batchesUsed: CostBasisEntry[];
  remainingAfterSell: CostBasisEntry[];
  
  // Tax calculations
  grossProceeds: number;
  netProceeds: number; // After sell fees
  realizedGainLoss: number;
  realizedGainLossPercent: number;
  
  // Holding period analysis
  averageHoldingDays: number;
  isShortTerm: boolean; // <= 365 days
  
  // Wash sale detection
  isWashSale: boolean;
  washSaleAmount?: number;
}

export interface WashSaleRecord {
  tokenMint: string;
  sellDate: Date;
  sellTimestamp: number;
  lossAmount: number;
  sellSignature: string;
  rebuyDetected?: boolean;
  rebuyDate?: Date;
  rebuySignature?: string;
}

export interface HoldingsSnapshot {
  tokenMint: string;
  totalTokens: number;
  totalCostBasisSOL: number;
  averageCostPerToken: number;
  oldestPurchaseDate: Date;
  newestPurchaseDate: Date;
  batchCount: number;
  unrealizedGainLoss?: number; // If current price provided
  unrealizedPercent?: number;
}

// ============================================================================
// MAIN COST BASIS TRACKER CLASS
// ============================================================================

export class CostBasisTracker {
  private holdings = new Map<string, CostBasisEntry[]>();
  private washSales = new Map<string, WashSaleRecord[]>();
  private dataFile: string;
  private washSaleFile: string;
  private isLoaded = false;
  
  constructor(dataFile = './data/cost_basis.json') {
    this.dataFile = dataFile;
    this.washSaleFile = this.dataFile.replace('.json', '_wash_sales.json');
    this.loadFromFile();
  }
  
  // ========================================================================
  // FILE I/O OPERATIONS
  // ========================================================================
  
  private loadFromFile(): void {
    try {
      // Load cost basis data
      if (fs.existsSync(this.dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
        
        Object.entries(data.holdings || {}).forEach(([mint, entries]) => {
          this.holdings.set(mint, (entries as any[]).map(entry => ({
            ...entry,
            purchaseDate: new Date(entry.purchaseDate),
            purchaseTimestamp: entry.purchaseTimestamp || entry.time || Date.now()
          })));
        });
        
        console.log(`📊 Loaded ${this.holdings.size} token holdings from ${this.dataFile}`);
      }
      
      // Load wash sale data
      if (fs.existsSync(this.washSaleFile)) {
        const washData = JSON.parse(fs.readFileSync(this.washSaleFile, 'utf8'));
        
        Object.entries(washData.washSales || {}).forEach(([mint, records]) => {
          this.washSales.set(mint, (records as any[]).map(record => ({
            ...record,
            sellDate: new Date(record.sellDate),
            rebuyDate: record.rebuyDate ? new Date(record.rebuyDate) : undefined
          })));
        });
      }
      
      this.isLoaded = true;
    } catch (error) {
      console.warn('⚠️ Failed to load cost basis data:', error);
      this.isLoaded = true; // Continue with empty state
    }
  }
  
  saveToFile(): void {
    try {
      const dataDir = path.dirname(this.dataFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Save cost basis holdings
      const holdingsData = {
        holdings: Object.fromEntries(this.holdings),
        metadata: {
          lastUpdated: new Date().toISOString(),
          totalTokenTypes: this.holdings.size,
          totalBatches: Array.from(this.holdings.values()).reduce((sum, batches) => sum + batches.length, 0),
          version: '5.0'
        }
      };
      
      fs.writeFileSync(this.dataFile, JSON.stringify(holdingsData, null, 2));
      
      // Save wash sale records
      const washSaleData = {
        washSales: Object.fromEntries(this.washSales),
        metadata: {
          lastUpdated: new Date().toISOString(),
          totalTokensWithWashSales: this.washSales.size
        }
      };
      
      fs.writeFileSync(this.washSaleFile, JSON.stringify(washSaleData, null, 2));
      
      console.log(`💾 Cost basis data saved to ${this.dataFile}`);
    } catch (error) {
      console.warn('⚠️ Failed to save cost basis data:', error);
    }
  }
  
  // ========================================================================
  // INTEGRATION WITH EXISTING SOL-BOT POSITION TRACKING
  // ========================================================================
  
  /**
   * Add purchase from existing NewPositionRecord (src/tracker/db.ts integration)
   */
  addPurchaseFromPosition(position: NewPositionRecord, purchaseFees = 0.001): void {
    if (!position.mint || !position.init_sol || !position.init_tokens) {
      console.warn('⚠️ Invalid position record for cost basis tracking');
      return;
    }
    
    const entry: CostBasisEntry = {
      tokenMint: position.mint,
      batchId: `${position.mint}_${position.time}`,
      purchaseDate: new Date(position.time),
      purchaseTimestamp: position.time,
      purchasePriceSOL: position.init_sol / position.init_tokens,
      purchaseAmountTokens: position.init_tokens,
      purchaseAmountSOL: position.init_sol,
      purchaseFees,
      remainingTokens: position.init_tokens,
      signature: position.init_tx,
      provider: position.provider,
      walletSigner: position.signer,
      status: 'bought',
      notes: `Imported from NewPositionRecord via ${position.provider}`
    };
    
    this.addCostBasisEntry(entry);
  }
  
  /**
   * Add purchase manually (direct method)
   */
  addPurchase(
    tokenMint: string,
    amount: number,
    priceSOL: number,
    fee: number,
    signature: string,
    timestamp?: number,
    provider = 'jupiter'
  ): void {
    const now = timestamp || Date.now();
    const totalCost = amount * priceSOL;
    
    const entry: CostBasisEntry = {
      tokenMint,
      batchId: `${tokenMint}_${now}`,
      purchaseDate: new Date(now),
      purchaseTimestamp: now,
      purchasePriceSOL: priceSOL,
      purchaseAmountTokens: amount,
      purchaseAmountSOL: totalCost,
      purchaseFees: fee,
      remainingTokens: amount,
      signature,
      provider,
      status: 'bought',
      notes: 'Direct purchase entry'
    };
    
    this.addCostBasisEntry(entry);
  }
  
  private addCostBasisEntry(entry: CostBasisEntry): void {
    if (!this.holdings.has(entry.tokenMint)) {
      this.holdings.set(entry.tokenMint, []);
    }
    
    const entries = this.holdings.get(entry.tokenMint)!;
    
    // Insert in chronological order (FIFO requirement)
    entries.push(entry);
    entries.sort((a, b) => a.purchaseTimestamp - b.purchaseTimestamp);
    
    this.saveToFile();
    
    console.log(`📊 Cost basis recorded: ${entry.purchaseAmountTokens} ${entry.tokenMint.slice(0,8)}... at ${entry.purchasePriceSOL.toFixed(6)} SOL/token (Total: ${entry.purchaseAmountSOL.toFixed(4)} SOL)`);
  }
  
  // ========================================================================
  // FIFO COST BASIS CALCULATIONS  
  // ========================================================================
  
  /**
   * Calculate cost basis for a sell using FIFO method
   * Compatible with TaxableTransaction interface
   */
  calculateGainLoss(
    tokenMint: string,
    sellAmount: number,
    sellPriceSOL: number,
    sellFee: number,
    sellTimestamp?: number
  ): SellCalculationResult {
    const entries = this.holdings.get(tokenMint) || [];
    const sellDate = new Date(sellTimestamp || Date.now());
    
    let remainingSellTokens = sellAmount;
    let totalCostBasisUsed = 0;
    let totalPurchaseFees = 0;
    let totalWeightedHoldingDays = 0;
    let totalTokensFromBatches = 0;
    
    const batchesUsed: CostBasisEntry[] = [];
    const remainingAfterSell: CostBasisEntry[] = [];
    
    // FIFO: Process oldest purchases first
    for (const entry of entries) {
      if (remainingSellTokens <= 0) {
        // This batch wasn't touched by the sell
        remainingAfterSell.push({ ...entry });
        continue;
      }
      
      if (entry.remainingTokens <= 0) {
        // Skip already depleted batches
        continue;
      }
      
      // Calculate how many tokens to use from this batch
      const tokensFromThisBatch = Math.min(remainingSellTokens, entry.remainingTokens);
      const proportionUsed = tokensFromThisBatch / entry.purchaseAmountTokens;
      
      // Calculate proportional costs
      const costFromBatch = entry.purchaseAmountSOL * proportionUsed;
      const feesFromBatch = entry.purchaseFees * proportionUsed;
      
      totalCostBasisUsed += costFromBatch;
      totalPurchaseFees += feesFromBatch;
      
      // Calculate holding period for this batch
      const holdingDays = Math.floor(
        (sellDate.getTime() - entry.purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      totalWeightedHoldingDays += holdingDays * tokensFromThisBatch;
      totalTokensFromBatches += tokensFromThisBatch;
      
      // Record this batch as used
      batchesUsed.push({
        ...entry,
        purchaseAmountTokens: tokensFromThisBatch, // Override with amount actually used
        purchaseAmountSOL: costFromBatch,
        purchaseFees: feesFromBatch
      });
      
      // Update remaining tokens in original entry
      entry.remainingTokens -= tokensFromThisBatch;
      remainingSellTokens -= tokensFromThisBatch;
      
      // If this batch still has tokens remaining, add to remaining list
      if (entry.remainingTokens > 0) {
        remainingAfterSell.push({ ...entry });
      }
    }
    
    // Calculate proceeds and gain/loss
    const grossProceeds = sellAmount * sellPriceSOL;
    const netProceeds = grossProceeds - sellFee;
    const totalCostBasisWithFees = totalCostBasisUsed + totalPurchaseFees;
    const realizedGainLoss = netProceeds - totalCostBasisWithFees;
    const realizedGainLossPercent = totalCostBasisWithFees > 0 ? 
      (realizedGainLoss / totalCostBasisWithFees) * 100 : 0;
    
    // Calculate average holding period
    const averageHoldingDays = totalTokensFromBatches > 0 ? 
      totalWeightedHoldingDays / totalTokensFromBatches : 0;
    const isShortTerm = averageHoldingDays <= 365;
    
    // Wash sale detection
    const isWashSale = this.detectWashSale(tokenMint, sellDate, realizedGainLoss);
    
    const result: SellCalculationResult = {
      totalCostBasisUsed: totalCostBasisWithFees,
      totalPurchaseFees,
      batchesUsed,
      remainingAfterSell,
      grossProceeds,
      netProceeds,
      realizedGainLoss,
      realizedGainLossPercent,
      averageHoldingDays,
      isShortTerm,
      isWashSale,
      washSaleAmount: isWashSale ? Math.abs(realizedGainLoss) : undefined
    };
    
    this.saveToFile();
    
    console.log(`📊 SELL CALCULATION for ${tokenMint.slice(0,8)}...`);
    console.log(`   Tokens Sold: ${sellAmount}`);
    console.log(`   Cost Basis: ${totalCostBasisWithFees.toFixed(4)} SOL`);
    console.log(`   Proceeds: ${netProceeds.toFixed(4)} SOL`);
    console.log(`   Gain/Loss: ${realizedGainLoss >= 0 ? '+' : ''}${realizedGainLoss.toFixed(4)} SOL (${realizedGainLossPercent.toFixed(1)}%)`);
    console.log(`   Holding Period: ${averageHoldingDays.toFixed(0)} days (${isShortTerm ? 'SHORT' : 'LONG'} term)`);
    
    return result;
  }
  
  // ========================================================================
  // WASH SALE DETECTION (30-DAY RULE)
  // ========================================================================
  
  private detectWashSale(tokenMint: string, sellDate: Date, gainLoss: number): boolean {
    // Only losses can trigger wash sales
    if (gainLoss >= 0) return false;
    
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const washSaleWindow = thirtyDaysMs;
    
    // Check if we have any purchases of this token within 30 days before or after this sell
    const entries = this.holdings.get(tokenMint) || [];
    const hasNearbyPurchase = entries.some(entry => {
      const timeDiff = Math.abs(sellDate.getTime() - entry.purchaseDate.getTime());
      return timeDiff <= washSaleWindow && entry.purchaseDate.getTime() !== sellDate.getTime();
    });
    
    if (hasNearbyPurchase) {
      // Record this wash sale
      const washSaleRecord: WashSaleRecord = {
        tokenMint,
        sellDate,
        sellTimestamp: sellDate.getTime(),
        lossAmount: Math.abs(gainLoss),
        sellSignature: `wash_sale_${Date.now()}`,
        rebuyDetected: true
      };
      
      if (!this.washSales.has(tokenMint)) {
        this.washSales.set(tokenMint, []);
      }
      
      this.washSales.get(tokenMint)!.push(washSaleRecord);
      
      console.log(`🚨 WASH SALE DETECTED: ${tokenMint.slice(0,8)}... loss of ${Math.abs(gainLoss).toFixed(4)} SOL within 30-day window`);
      
      return true;
    }
    
    return false;
  }
  
  // ========================================================================
  // QUERY AND ANALYSIS METHODS
  // ========================================================================
  
  getCostBasis(tokenMint: string): CostBasisEntry[] {
    return this.holdings.get(tokenMint)?.filter(entry => entry.remainingTokens > 0) || [];
  }
  
  getHoldings(tokenMint: string): HoldingsSnapshot | null {
    const entries = this.getCostBasis(tokenMint);
    if (entries.length === 0) return null;
    
    const totalTokens = entries.reduce((sum, entry) => sum + entry.remainingTokens, 0);
    const totalCostBasisSOL = entries.reduce((sum, entry) => {
      const proportion = entry.remainingTokens / entry.purchaseAmountTokens;
      return sum + (entry.purchaseAmountSOL + entry.purchaseFees) * proportion;
    }, 0);
    
    const averageCostPerToken = totalTokens > 0 ? totalCostBasisSOL / totalTokens : 0;
    
    const purchaseDates = entries.map(e => e.purchaseDate);
    const oldestPurchaseDate = new Date(Math.min(...purchaseDates.map(d => d.getTime())));
    const newestPurchaseDate = new Date(Math.max(...purchaseDates.map(d => d.getTime())));
    
    return {
      tokenMint,
      totalTokens,
      totalCostBasisSOL,
      averageCostPerToken,
      oldestPurchaseDate,
      newestPurchaseDate,
      batchCount: entries.length
    };
  }
  
  getAllHoldings(): HoldingsSnapshot[] {
    const allHoldings: HoldingsSnapshot[] = [];
    
    for (const tokenMint of this.holdings.keys()) {
      const holding = this.getHoldings(tokenMint);
      if (holding && holding.totalTokens > 0) {
        allHoldings.push(holding);
      }
    }
    
    return allHoldings;
  }
  
  hasHoldings(tokenMint: string): boolean {
    const entries = this.holdings.get(tokenMint) || [];
    return entries.some(entry => entry.remainingTokens > 0);
  }
  
  getTotalHolding(tokenMint: string): number {
    const entries = this.holdings.get(tokenMint) || [];
    return entries.reduce((sum, entry) => sum + entry.remainingTokens, 0);
  }
  
  getWashSales(tokenMint?: string): WashSaleRecord[] {
    if (tokenMint) {
      return this.washSales.get(tokenMint) || [];
    }
    
    const allWashSales: WashSaleRecord[] = [];
    for (const records of this.washSales.values()) {
      allWashSales.push(...records);
    }
    
    return allWashSales;
  }
  
  // ========================================================================
  // INTEGRATION WITH TAXTRACKER
  // ========================================================================
  
  /**
   * Process TaxableTransaction and update cost basis
   */
  processTaxableTransaction(transaction: TaxableTransaction): SellCalculationResult | null {
    if (!transaction.tokenMint) return null;
    
    if (transaction.type === 'buy') {
      this.addPurchase(
        transaction.tokenMint,
        transaction.amount || 0,
        transaction.entryPrice || 0,
        0.001, // Default fee
        transaction.signature || '',
        new Date(transaction.timestamp).getTime()
      );
      return null;
    }
    
    if (transaction.type === 'sell') {
      return this.calculateGainLoss(
        transaction.tokenMint,
        transaction.amount || 0,
        transaction.exitPrice || 0,
        0.001, // Default fee
        new Date(transaction.timestamp).getTime()
      );
    }
    
    return null;
  }
  
  // ========================================================================
  // UTILITY AND TESTING METHODS
  // ========================================================================
  
  /**
   * Reset all data (for testing)
   */
  reset(): void {
    this.holdings.clear();
    this.washSales.clear();
    
    // Remove data files
    if (fs.existsSync(this.dataFile)) {
      fs.unlinkSync(this.dataFile);
    }
    if (fs.existsSync(this.washSaleFile)) {
      fs.unlinkSync(this.washSaleFile);
    }
    
    console.log('🔄 Cost basis tracker reset - all data cleared');
  }
  
  /**
   * Generate summary report
   */
  generateSummaryReport(): any {
    const holdings = this.getAllHoldings();
    const allWashSales = this.getWashSales();
    
    const totalValue = holdings.reduce((sum, h) => sum + h.totalCostBasisSOL, 0);
    const totalTokenTypes = holdings.length;
    const totalBatches = holdings.reduce((sum, h) => sum + h.batchCount, 0);
    
    return {
      generatedAt: new Date().toISOString(),
      holdings: {
        totalTokenTypes,
        totalBatches,
        totalCostBasisSOL: totalValue,
        averagePositionSize: totalTokenTypes > 0 ? totalValue / totalTokenTypes : 0
      },
      washSales: {
        totalWashSales: allWashSales.length,
        totalWashSaleAmount: allWashSales.reduce((sum, ws) => sum + ws.lossAmount, 0),
        affectedTokens: this.washSales.size
      },
      integration: {
        isLoaded: this.isLoaded,
        dataFile: this.dataFile,
        lastSaved: new Date().toISOString()
      }
    };
  }
  
  /**
   * Export data for external systems
   */
  exportForTaxReporting(): any {
    const holdings = this.getAllHoldings();
    const washSales = this.getWashSales();
    
    return {
      currentHoldings: holdings.map(h => ({
        tokenMint: h.tokenMint,
        totalTokens: h.totalTokens,
        totalCostBasis: h.totalCostBasisSOL,
        averageCost: h.averageCostPerToken,
        purchaseDate: h.oldestPurchaseDate.toISOString(),
        holdingPeriodDays: Math.floor((Date.now() - h.oldestPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
      })),
      washSalesThisYear: washSales
        .filter(ws => ws.sellDate.getFullYear() === new Date().getFullYear())
        .map(ws => ({
          tokenMint: ws.tokenMint,
          sellDate: ws.sellDate.toISOString(),
          lossAmount: ws.lossAmount,
          washSaleApplies: ws.rebuyDetected
        }))
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE FOR GLOBAL USE
// ============================================================================

export const costBasisTracker = new CostBasisTracker();

// ============================================================================
// UTILITY FUNCTIONS FOR INTEGRATION
// ============================================================================

/**
 * Import existing positions from database
 */
export async function importFromDatabase(): Promise<void> {
  try {
    // This would integrate with your existing database
    const { selectAllPositions } = await import('../tracker/db');
    const positions = await selectAllPositions();
    
    console.log(`📊 Importing ${positions.length} positions from database...`);
    
    positions.forEach(position => {
      costBasisTracker.addPurchaseFromPosition(position);
    });
    
    console.log('✅ Database import complete');
  } catch (error) {
    console.warn('⚠️ Failed to import from database:', error);
  }
}

/**
 * Sync with token queue system
 */
export function syncWithTokenQueue(pendingTokens: any[]): void {
  console.log(`🔄 Syncing with ${pendingTokens.length} pending tokens...`);
  
  pendingTokens
    .filter(token => token.status === 'bought')
    .forEach(token => {
      if (token.tokenMint && token.entryPrice && token.amount) {
        costBasisTracker.addPurchase(
          token.tokenMint,
          token.amount,
          token.entryPrice,
          0.001,
          token.signature || '',
          new Date(token.detectedAt).getTime()
        );
      }
    });
    
  console.log('✅ Token queue sync complete');
}

export default costBasisTracker;
