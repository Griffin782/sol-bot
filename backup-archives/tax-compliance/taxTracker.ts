
// ============================================================================
// ENHANCED TAX-COMPLIANCE/TAXTRACKER.TS
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

export interface TaxableTransaction {
  timestamp: string;
  type: 'buy' | 'sell';
  tokenMint: string;
  tokenSymbol?: string;
  amount: number;
  priceSOL?: number;
  totalSOL?: number;
  fees?: number;
  signature?: string;
  success: boolean;
  platform?: string;
  notes?: string;
}

export interface CompleteTransaction {
  id: string;
  buyTransaction: TaxableTransaction;
  sellTransaction?: TaxableTransaction;
  buyDate: Date;
  sellDate?: Date;
  buyPriceSOL: number;
  sellPriceSOL?: number;
  buyAmountSOL: number;
  sellAmountSOL?: number;
  buyFees: number;
  sellFees?: number;
  costBasis: number; // Buy amount + buy fees
  proceeds?: number; // Sell amount - sell fees
  gainLoss?: number; // Proceeds - cost basis
  gainLossPercent?: number;
  holdingPeriodDays?: number;
  isShortTerm?: boolean;
  isWashSale?: boolean;
  tokenMint: string;
  tokenSymbol?: string;
  buySignature?: string;
  sellSignature?: string;
}

export interface Form8949Entry {
  description: string; // "100 shares of ABC Token"
  dateAcquired: string; // MM/DD/YYYY
  dateSold: string; // MM/DD/YYYY
  proceeds: number; // Sale price minus fees
  costBasis: number; // Purchase price plus fees
  gainLoss: number; // Proceeds - Cost Basis
  isShortTerm: boolean; // True if held <= 1 year
  washSale: boolean; // True if wash sale rules apply
}

// Cost basis tracking for FIFO calculations
interface CostBasisEntry {
  tokenMint: string;
  buyDate: Date;
  buyPriceSOL: number;
  buyAmountTokens: number;
  buyAmountSOL: number;
  buyFees: number;
  remainingTokens: number;
  signature: string;
}

// Wash sale detection (same token sold at loss, rebought within 30 days)
interface WashSaleEntry {
  tokenMint: string;
  sellDate: Date;
  rebuyDate?: Date;
  lossAmount: number;
  isWashSale: boolean;
}

class CostBasisTracker {
  private costBasisMap = new Map<string, CostBasisEntry[]>();
  private washSaleMap = new Map<string, WashSaleEntry[]>();
  private dataFile = './data/cost_basis.json';
  
  constructor() {
    this.loadFromFile();
  }
  
  private loadFromFile() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
        
        // Restore Maps from JSON
        Object.entries(data.costBasis || {}).forEach(([mint, entries]) => {
          this.costBasisMap.set(mint, (entries as any[]).map(entry => ({
            ...entry,
            buyDate: new Date(entry.buyDate)
          })));
        });
        
        Object.entries(data.washSales || {}).forEach(([mint, entries]) => {
          this.washSaleMap.set(mint, (entries as any[]).map(entry => ({
            ...entry,
            sellDate: new Date(entry.sellDate),
            rebuyDate: entry.rebuyDate ? new Date(entry.rebuyDate) : undefined
          })));
        });
      }
    } catch (error) {
      console.warn('Failed to load cost basis data:', error);
    }
  }
  
  private saveToFile() {
    try {
      const dataDir = path.dirname(this.dataFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const data = {
        costBasis: Object.fromEntries(this.costBasisMap),
        washSales: Object.fromEntries(this.washSaleMap),
        lastUpdated: new Date().toISOString()
      };
      
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('Failed to save cost basis data:', error);
    }
  }
  
  recordBuy(transaction: TaxableTransaction) {
    if (!transaction.tokenMint) return;
    
    const entry: CostBasisEntry = {
      tokenMint: transaction.tokenMint,
      buyDate: new Date(transaction.timestamp),
      buyPriceSOL: transaction.priceSOL || 0,
      buyAmountTokens: transaction.amount,
      buyAmountSOL: transaction.totalSOL || 0,
      buyFees: transaction.fees || 0,
      remainingTokens: transaction.amount,
      signature: transaction.signature || ''
    };
    
    if (!this.costBasisMap.has(transaction.tokenMint)) {
      this.costBasisMap.set(transaction.tokenMint, []);
    }
    
    this.costBasisMap.get(transaction.tokenMint)!.push(entry);
    this.saveToFile();
  }
  
  // FIFO method: First In, First Out
  recordSell(transaction: TaxableTransaction): { costBasis: number; gainLoss: number; isWashSale: boolean } {
    if (!transaction.tokenMint) return { costBasis: 0, gainLoss: 0, isWashSale: false };
    
    const entries = this.costBasisMap.get(transaction.tokenMint) || [];
    let remainingSellTokens = transaction.amount;
    let totalCostBasis = 0;
    let totalBuyFees = 0;
    
    // Use FIFO to calculate cost basis
    for (const entry of entries) {
      if (remainingSellTokens <= 0) break;
      if (entry.remainingTokens <= 0) continue;
      
      const tokensToSell = Math.min(remainingSellTokens, entry.remainingTokens);
      const proportionSold = tokensToSell / entry.buyAmountTokens;
      
      totalCostBasis += entry.buyAmountSOL * proportionSold;
      totalBuyFees += entry.buyFees * proportionSold;
      
      entry.remainingTokens -= tokensToSell;
      remainingSellTokens -= tokensToSell;
    }
    
    const proceeds = (transaction.totalSOL || 0) - (transaction.fees || 0);
    const costBasisWithFees = totalCostBasis + totalBuyFees;
    const gainLoss = proceeds - costBasisWithFees;
    
    // Check for wash sale (sold at loss, rebought within 30 days)
    const isWashSale = this.checkWashSale(transaction.tokenMint, new Date(transaction.timestamp), gainLoss);
    
    this.saveToFile();
    return { costBasis: costBasisWithFees, gainLoss, isWashSale };
  }
  
  private checkWashSale(tokenMint: string, sellDate: Date, gainLoss: number): boolean {
    if (gainLoss >= 0) return false; // Only losses can be wash sales
    
    const washSales = this.washSaleMap.get(tokenMint) || [];
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    
    // Check if we rebought this token within 30 days of any loss sale
    const wasRebought = washSales.some(ws => {
      const timeDiff = Math.abs(sellDate.getTime() - ws.sellDate.getTime());
      return timeDiff <= thirtyDaysMs;
    });
    
    // Record this potential wash sale
    const washSaleEntry: WashSaleEntry = {
      tokenMint,
      sellDate,
      lossAmount: Math.abs(gainLoss),
      isWashSale: wasRebought
    };
    
    if (!this.washSaleMap.has(tokenMint)) {
      this.washSaleMap.set(tokenMint, []);
    }
    this.washSaleMap.get(tokenMint)!.push(washSaleEntry);
    
    return wasRebought;
  }
  
  getCostBasis(tokenMint: string): CostBasisEntry[] {
    return this.costBasisMap.get(tokenMint) || [];
  }
}

// Global cost basis tracker
const costBasisTracker = new CostBasisTracker();

// Store all transactions for IRS reporting
let transactions: CompleteTransaction[] = [];
const TRANSACTIONS_FILE = './data/complete_transactions.json';

// Load existing transactions
function loadTransactions() {
  try {
    if (fs.existsSync(TRANSACTIONS_FILE)) {
      const data = fs.readFileSync(TRANSACTIONS_FILE, 'utf8');
      transactions = JSON.parse(data).map((t: any) => ({
        ...t,
        buyDate: new Date(t.buyDate),
        sellDate: t.sellDate ? new Date(t.sellDate) : undefined
      }));
    }
  } catch (error) {
    console.warn('Failed to load transactions:', error);
    transactions = [];
  }
}

// Save transactions to file
function saveTransactions() {
  try {
    const dataDir = path.dirname(TRANSACTIONS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
  } catch (error) {
    console.warn('Failed to save transactions:', error);
  }
}

// Initialize
loadTransactions();

export async function recordTrade(transaction: TaxableTransaction): Promise<void> {
  try {
    // Create data directory if it doesn't exist
    const dataDir = './data';
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Record in cost basis tracker
    if (transaction.type === 'buy') {
      costBasisTracker.recordBuy(transaction);
      
      // Create new complete transaction record
      const completeTransaction: CompleteTransaction = {
        id: `${transaction.tokenMint}_${transaction.timestamp}`,
        buyTransaction: transaction,
        buyDate: new Date(transaction.timestamp),
        buyPriceSOL: transaction.priceSOL || 0,
        buyAmountSOL: transaction.totalSOL || 0,
        buyFees: transaction.fees || 0,
        costBasis: (transaction.totalSOL || 0) + (transaction.fees || 0),
        tokenMint: transaction.tokenMint,
        tokenSymbol: transaction.tokenSymbol,
        buySignature: transaction.signature
      };
      
      transactions.push(completeTransaction);
      
    } else if (transaction.type === 'sell') {
      // Find matching buy transaction
      const matchingBuy = transactions.find(t => 
        t.tokenMint === transaction.tokenMint && 
        !t.sellTransaction
      );
      
      if (matchingBuy) {
        // Calculate cost basis using FIFO
        const { costBasis, gainLoss, isWashSale } = costBasisTracker.recordSell(transaction);
        
        // Complete the transaction record
        matchingBuy.sellTransaction = transaction;
        matchingBuy.sellDate = new Date(transaction.timestamp);
        matchingBuy.sellPriceSOL = transaction.priceSOL || 0;
        matchingBuy.sellAmountSOL = transaction.totalSOL || 0;
        matchingBuy.sellFees = transaction.fees || 0;
        matchingBuy.proceeds = (transaction.totalSOL || 0) - (transaction.fees || 0);
        matchingBuy.gainLoss = gainLoss;
        matchingBuy.gainLossPercent = matchingBuy.costBasis > 0 ? (gainLoss / matchingBuy.costBasis) * 100 : 0;
        matchingBuy.holdingPeriodDays = Math.floor(
          (matchingBuy.sellDate.getTime() - matchingBuy.buyDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        matchingBuy.isShortTerm = matchingBuy.holdingPeriodDays <= 365;
        matchingBuy.isWashSale = isWashSale;
        matchingBuy.sellSignature = transaction.signature;
        
        // Update cost basis from FIFO calculation
        matchingBuy.costBasis = costBasis;
      }
    }
    
    // Save to file
    saveTransactions();
    
    // Append to simple log for backup
    const logFile = './data/tax_log.jsonl';
    const logEntry = JSON.stringify({ 
      ...transaction, 
      recordedAt: new Date().toISOString() 
    }) + '\n';

    fs.appendFileSync(logFile, logEntry);
    
  } catch (error) {
    console.error('Error recording trade for taxes:', error);
    throw error; // Re-throw to be caught by calling code
  }
}

// Generate Form 8949 compatible CSV
export function generateForm8949CSV(year?: number): string {
  const targetYear = year || new Date().getFullYear();
  const csvFile = `./data/form_8949_${targetYear}.csv`;
  
  // Filter transactions for the target year
  const yearTransactions = transactions.filter(t => 
    t.sellDate && t.sellDate.getFullYear() === targetYear
  );
  
  // Generate CSV header
  const header = [
    'Description',
    'Date Acquired',
    'Date Sold', 
    'Proceeds',
    'Cost Basis',
    'Gain/Loss',
    'Short/Long Term',
    'Wash Sale'
  ].join(',');
  
  // Generate CSV rows
  const rows = yearTransactions.map(t => {
    const description = `${t.buyTransaction.amount} ${t.tokenSymbol || 'tokens'} (${t.tokenMint.slice(0,8)}...)`;
    const dateAcquired = t.buyDate.toLocaleDateString('en-US');
    const dateSold = t.sellDate!.toLocaleDateString('en-US');
    const proceeds = t.proceeds?.toFixed(2) || '0.00';
    const costBasis = t.costBasis.toFixed(2);
    const gainLoss = t.gainLoss?.toFixed(2) || '0.00';
    const term = t.isShortTerm ? 'Short' : 'Long';
    const washSale = t.isWashSale ? 'W' : '';
    
    return [description, dateAcquired, dateSold, proceeds, costBasis, gainLoss, term, washSale].join(',');
  });
  
  const csvContent = [header, ...rows].join('\n');
  
  // Save to file
  fs.writeFileSync(csvFile, csvContent);
  
  console.log(`📊 Generated Form 8949 CSV: ${csvFile}`);
  console.log(`   Transactions: ${yearTransactions.length}`);
  console.log(`   Total Gain/Loss: $${yearTransactions.reduce((sum, t) => sum + (t.gainLoss || 0), 0).toFixed(2)}`);
  
  return csvFile;
}

// Get tax summary for a year
export function getTaxSummary(year?: number): any {
  const targetYear = year || new Date().getFullYear();
  
  const yearTransactions = transactions.filter(t => 
    t.sellDate && t.sellDate.getFullYear() === targetYear
  );
  
  const shortTermGains = yearTransactions
    .filter(t => t.isShortTerm && (t.gainLoss || 0) > 0)
    .reduce((sum, t) => sum + (t.gainLoss || 0), 0);
    
  const shortTermLosses = yearTransactions
    .filter(t => t.isShortTerm && (t.gainLoss || 0) < 0)
    .reduce((sum, t) => sum + Math.abs(t.gainLoss || 0), 0);
    
  const longTermGains = yearTransactions
    .filter(t => !t.isShortTerm && (t.gainLoss || 0) > 0)
    .reduce((sum, t) => sum + (t.gainLoss || 0), 0);
    
  const longTermLosses = yearTransactions
    .filter(t => !t.isShortTerm && (t.gainLoss || 0) < 0)
    .reduce((sum, t) => sum + Math.abs(t.gainLoss || 0), 0);
  
  const netShortTerm = shortTermGains - shortTermLosses;
  const netLongTerm = longTermGains - longTermLosses;
  const netGainLoss = netShortTerm + netLongTerm;
  
  return {
    year: targetYear,
    totalTransactions: yearTransactions.length,
    shortTermGains,
    shortTermLosses,
    longTermGains,
    longTermLosses,
    netShortTerm,
    netLongTerm,
    netGainLoss,
    washSales: yearTransactions.filter(t => t.isWashSale).length
  };
}

// Export all complete transactions
export function getCompleteTransactions(): CompleteTransaction[] {
  return transactions;
}

// Export cost basis tracker
export function getCostBasisTracker() {
  return costBasisTracker;
}
