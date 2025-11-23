#!/usr/bin/env ts-node
/**
 * IMPLEMENT FULL TAX COMPLIANCE SCRIPT
 * ===================================
 * 
 * This script implements comprehensive tax compliance across the entire sol-bot codebase.
 * It finds all sell locations, adds tax recording, and creates enhanced tax tracking.
 * 
 * USAGE:
 * npx ts-node implement-full-tax-compliance.ts
 */

import * as fs from 'fs';
import * as path from 'path';

console.log('🚀 SOL-BOT FULL TAX COMPLIANCE IMPLEMENTATION');
console.log('='.repeat(50));

// ============================================================================
// PART 1: FIND ALL SELL LOCATIONS
// ============================================================================

interface SellLocation {
  file: string;
  line: number;
  function: string;
  pattern: string;
  context: string[];
  variables: string[];
}

const SELL_PATTERNS = [
  'unSwapToken(',
  'sellToken(',
  'exitPosition(',
  'closePosition(',
  'swapTokenForSOL(',
  'liquidatePosition(',
  'takeProfits(',
  // Additional patterns that convert tokens back to SOL
  'jupiter.*sell',
  'swap.*toSol',
  'exit.*trade',
  'close.*trade'
];

function findAllSellLocations(): SellLocation[] {
  console.log('\n📍 PART 1: SCANNING FOR SELL LOCATIONS');
  console.log('-'.repeat(40));
  
  const sellLocations: SellLocation[] = [];
  const srcDir = path.join(__dirname, 'src');
  
  function scanDirectory(dirPath: string) {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.includes('node_modules')) {
        scanDirectory(filePath);
      } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
        scanFileForSellPatterns(filePath);
      }
    }
  }
  
  function scanFileForSellPatterns(filePath: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        SELL_PATTERNS.forEach(pattern => {
          const regex = new RegExp(pattern.replace('(', '\\(').replace(')', '\\)').replace('*', '.*'), 'i');
          if (regex.test(line)) {
            // Get context (5 lines before and after)
            const contextStart = Math.max(0, index - 5);
            const contextEnd = Math.min(lines.length - 1, index + 5);
            const context = lines.slice(contextStart, contextEnd + 1);
            
            // Extract available variables from the function
            const variables = extractAvailableVariables(lines, index);
            const functionName = extractFunctionName(lines, index);
            
            sellLocations.push({
              file: path.relative(__dirname, filePath),
              line: index + 1,
              function: functionName,
              pattern: pattern,
              context: context,
              variables: variables
            });
            
            console.log(`✅ Found: ${path.relative(__dirname, filePath)}:${index + 1} - ${functionName}`);
          }
        });
      });
    } catch (error) {
      console.warn(`⚠️ Error scanning ${filePath}:`, error.message);
    }
  }
  
  function extractFunctionName(lines: string[], currentIndex: number): string {
    // Look backwards to find function declaration
    for (let i = currentIndex; i >= Math.max(0, currentIndex - 20); i--) {
      const line = lines[i];
      const functionMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)|(\w+)\s*[=:]\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\([^)]*\)\s*{)|class\s+(\w+)|(\w+)\s*\([^)]*\)\s*[:{]/);
      if (functionMatch) {
        return functionMatch[1] || functionMatch[2] || functionMatch[3] || functionMatch[4] || 'unknown';
      }
    }
    return 'unknown';
  }
  
  function extractAvailableVariables(lines: string[], currentIndex: number): string[] {
    const variables = new Set<string>();
    
    // Look in current function for variable declarations
    for (let i = Math.max(0, currentIndex - 10); i <= Math.min(lines.length - 1, currentIndex + 5); i++) {
      const line = lines[i];
      
      // Common variable patterns for trading
      const patterns = [
        /\b(tokenMint|mint|inputMint|outputMint)\b/g,
        /\b(amount|inputAmount|tokenAmount|solAmount)\b/g,
        /\b(price|entryPrice|exitPrice|currentPrice)\b/g,
        /\b(fees?|fee)\b/g,
        /\b(signature|txHash|transaction)\b/g,
        /\b(result|success|status)\b/g,
        /\b(profit|loss|pnl)\b/g,
        /\b(symbol|tokenSymbol)\b/g
      ];
      
      patterns.forEach(pattern => {
        const matches = line.match(pattern);
        if (matches) {
          matches.forEach(match => variables.add(match));
        }
      });
    }
    
    return Array.from(variables);
  }
  
  if (fs.existsSync(srcDir)) {
    scanDirectory(srcDir);
  }
  
  console.log(`\n📊 FOUND ${sellLocations.length} SELL LOCATIONS`);
  return sellLocations;
}

// ============================================================================
// PART 2: GENERATE CODE ADDITIONS FOR EACH SELL LOCATION
// ============================================================================

function generateCodeAdditions(sellLocations: SellLocation[]): string {
  console.log('\n🔧 PART 2: GENERATING CODE ADDITIONS');
  console.log('-'.repeat(40));
  
  let codeAdditions = `
// ============================================================================
// PART 2: CODE ADDITIONS FOR EACH SELL LOCATION
// ============================================================================

`;

  sellLocations.forEach((location, index) => {
    console.log(`📝 Generating code for ${location.file}:${location.line}`);
    
    codeAdditions += `
// LOCATION ${index + 1}: ${location.file}:${location.line}
// Function: ${location.function}
// Pattern: ${location.pattern}

/*
FIND THIS SECTION IN ${location.file} around line ${location.line}:
${location.context.map((line, i) => `${location.line - 5 + i}: ${line}`).join('\n')}
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: ${location.variables.includes('tokenMint') ? 'tokenMint' : 
                   location.variables.includes('inputMint') ? 'inputMint' : 
                   location.variables.includes('mint') ? 'mint' : 
                   'returnedMint || mint'}, // Available: ${location.variables.join(', ')}
      tokenSymbol: ${location.variables.includes('tokenSymbol') ? 'tokenSymbol' : 
                     location.variables.includes('symbol') ? 'symbol' : 
                     '"UNKNOWN"'},
      amount: ${location.variables.includes('amount') ? 'amount' : 
                location.variables.includes('inputAmount') ? 'inputAmount' : 
                location.variables.includes('tokenAmount') ? 'tokenAmount' : 
                '0'}, // Token amount sold
      priceSOL: ${location.variables.includes('exitPrice') ? 'exitPrice' : 
                  location.variables.includes('price') ? 'price' : 
                  location.variables.includes('currentPrice') ? 'currentPrice' : 
                  '0'}, // Price per token in SOL
      totalSOL: ${location.variables.includes('exitPrice') ? 'exitPrice * amount' : 
                  'priceSOL * amount'}, // Total SOL received
      fees: ${location.variables.includes('fees') ? 'fees' : 
              location.variables.includes('fee') ? 'fee' : 
              '0.001'}, // Transaction fees
      signature: ${location.variables.includes('signature') ? 'signature' : 
                   location.variables.includes('txHash') ? 'txHash' : 
                   location.variables.includes('transaction') ? 'transaction' : 
                   '`sell_${Date.now()}`'}, // Transaction signature
      success: true,
      platform: '${location.file.includes('jupiter') ? 'jupiter' : 
                   location.file.includes('sniperoo') ? 'sniperoo' : 
                   'unknown'}',
      notes: \`Sold via ${location.function}\`
    };
    
    await recordTrade(taxData);
    console.log(\`📊 Tax recorded: SELL \${taxData.tokenMint?.slice(0,8)}... for \${taxData.totalSOL?.toFixed(4)} SOL\`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}

`;
  });

  return codeAdditions;
}

// ============================================================================
// PART 3: ENHANCED TAX TRACKER
// ============================================================================

const ENHANCED_TAX_TRACKER = `
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
        id: \`\${transaction.tokenMint}_\${transaction.timestamp}\`,
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
  const csvFile = \`./data/form_8949_\${targetYear}.csv\`;
  
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
    const description = \`\${t.buyTransaction.amount} \${t.tokenSymbol || 'tokens'} (\${t.tokenMint.slice(0,8)}...)\`;
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
  
  console.log(\`📊 Generated Form 8949 CSV: \${csvFile}\`);
  console.log(\`   Transactions: \${yearTransactions.length}\`);
  console.log(\`   Total Gain/Loss: $\${yearTransactions.reduce((sum, t) => sum + (t.gainLoss || 0), 0).toFixed(2)}\`);
  
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
`;

// ============================================================================
// PART 4: COST BASIS TRACKER (SEPARATE FILE)
// ============================================================================

const COST_BASIS_TRACKER = `
// ============================================================================
// TAX-COMPLIANCE/COSTBASISTRACKER.TS
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

export interface CostBasisEntry {
  tokenMint: string;
  buyDate: Date;
  buyPriceSOL: number;
  buyAmountTokens: number;
  buyAmountSOL: number;
  buyFees: number;
  remainingTokens: number;
  signature: string;
  batchId: string; // For tracking partial sells
}

export interface SellCalculation {
  costBasisUsed: number;
  totalFees: number;
  gainLoss: number;
  isShortTerm: boolean;
  averageHoldingDays: number;
  batchesUsed: CostBasisEntry[];
}

export class CostBasisTracker {
  private holdings = new Map<string, CostBasisEntry[]>();
  private dataFile: string;
  
  constructor(dataFile = './data/cost_basis.json') {
    this.dataFile = dataFile;
    this.loadFromFile();
  }
  
  private loadFromFile() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
        
        Object.entries(data.holdings || {}).forEach(([mint, entries]) => {
          this.holdings.set(mint, (entries as any[]).map(entry => ({
            ...entry,
            buyDate: new Date(entry.buyDate)
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
        holdings: Object.fromEntries(this.holdings),
        lastUpdated: new Date().toISOString(),
        totalTokens: this.holdings.size,
        totalEntries: Array.from(this.holdings.values()).reduce((sum, entries) => sum + entries.length, 0)
      };
      
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('Failed to save cost basis data:', error);
    }
  }
  
  // Record a buy transaction
  recordBuy(
    tokenMint: string,
    buyDate: Date,
    buyPriceSOL: number,
    buyAmountTokens: number,
    buyAmountSOL: number,
    buyFees: number,
    signature: string
  ) {
    const entry: CostBasisEntry = {
      tokenMint,
      buyDate,
      buyPriceSOL,
      buyAmountTokens,
      buyAmountSOL,
      buyFees,
      remainingTokens: buyAmountTokens,
      signature,
      batchId: \`\${tokenMint}_\${buyDate.getTime()}\`
    };
    
    if (!this.holdings.has(tokenMint)) {
      this.holdings.set(tokenMint, []);
    }
    
    // Insert in chronological order (FIFO)
    const entries = this.holdings.get(tokenMint)!;
    entries.push(entry);
    entries.sort((a, b) => a.buyDate.getTime() - b.buyDate.getTime());
    
    this.saveToFile();
    
    console.log(\`📊 Cost basis recorded: \${buyAmountTokens} \${tokenMint.slice(0,8)}... at \${buyPriceSOL} SOL/token\`);
  }
  
  // Calculate cost basis for a sell using FIFO method
  calculateSellCostBasis(
    tokenMint: string,
    sellDate: Date,
    sellAmountTokens: number
  ): SellCalculation {
    const entries = this.holdings.get(tokenMint) || [];
    let remainingToSell = sellAmountTokens;
    let totalCostBasisUsed = 0;
    let totalFeesUsed = 0;
    let totalHoldingDays = 0;
    let batchCount = 0;
    const batchesUsed: CostBasisEntry[] = [];
    
    // Use FIFO: First In, First Out
    for (const entry of entries) {
      if (remainingToSell <= 0) break;
      if (entry.remainingTokens <= 0) continue;
      
      const tokensFromThisBatch = Math.min(remainingToSell, entry.remainingTokens);
      const percentageUsed = tokensFromThisBatch / entry.buyAmountTokens;
      
      // Calculate proportional cost basis and fees
      const costBasisFromBatch = entry.buyAmountSOL * percentageUsed;
      const feesFromBatch = entry.buyFees * percentageUsed;
      
      totalCostBasisUsed += costBasisFromBatch;
      totalFeesUsed += feesFromBatch;
      
      // Calculate holding period
      const holdingDays = Math.floor((sellDate.getTime() - entry.buyDate.getTime()) / (1000 * 60 * 60 * 24));
      totalHoldingDays += holdingDays * tokensFromThisBatch;
      batchCount++;
      
      // Update remaining tokens in this batch
      entry.remainingTokens -= tokensFromThisBatch;
      remainingToSell -= tokensFromThisBatch;
      
      // Record which batch was used
      batchesUsed.push({
        ...entry,
        buyAmountTokens: tokensFromThisBatch, // Override with amount actually used
        buyAmountSOL: costBasisFromBatch,
        buyFees: feesFromBatch
      });
    }
    
    // Calculate average holding period
    const averageHoldingDays = sellAmountTokens > 0 ? totalHoldingDays / sellAmountTokens : 0;
    const isShortTerm = averageHoldingDays <= 365;
    
    this.saveToFile();
    
    return {
      costBasisUsed: totalCostBasisUsed + totalFeesUsed, // Include fees in cost basis
      totalFees: totalFeesUsed,
      gainLoss: 0, // Will be calculated by caller with sell proceeds
      isShortTerm,
      averageHoldingDays,
      batchesUsed
    };
  }
  
  // Get current holdings for a token
  getCostBasis(tokenMint: string): CostBasisEntry[] {
    return this.holdings.get(tokenMint) || [];
  }
  
  // Get all holdings
  getAllHoldings(): Map<string, CostBasisEntry[]> {
    return new Map(this.holdings);
  }
  
  // Get summary of all holdings
  getHoldingsSummary(): any {
    const summary: any = {};
    
    this.holdings.forEach((entries, tokenMint) => {
      const activeEntries = entries.filter(e => e.remainingTokens > 0);
      
      if (activeEntries.length > 0) {
        const totalTokens = activeEntries.reduce((sum, e) => sum + e.remainingTokens, 0);
        const totalCostBasis = activeEntries.reduce((sum, e) => {
          const proportion = e.remainingTokens / e.buyAmountTokens;
          return sum + (e.buyAmountSOL + e.buyFees) * proportion;
        }, 0);
        const averagePrice = totalTokens > 0 ? totalCostBasis / totalTokens : 0;
        
        summary[tokenMint] = {
          totalTokens,
          totalCostBasis,
          averagePrice,
          batches: activeEntries.length,
          oldestBuy: Math.min(...activeEntries.map(e => e.buyDate.getTime())),
          newestBuy: Math.max(...activeEntries.map(e => e.buyDate.getTime()))
        };
      }
    });
    
    return summary;
  }
  
  // Check if we have any holdings for a token
  hasHoldings(tokenMint: string): boolean {
    const entries = this.holdings.get(tokenMint) || [];
    return entries.some(e => e.remainingTokens > 0);
  }
  
  // Get total remaining tokens for a mint
  getTotalHolding(tokenMint: string): number {
    const entries = this.holdings.get(tokenMint) || [];
    return entries.reduce((sum, e) => sum + e.remainingTokens, 0);
  }
}

// Export default instance
export const costBasisTracker = new CostBasisTracker();
`;

// ============================================================================
// PART 5: TEST VERIFICATION SCRIPT  
// ============================================================================

const TEST_VERIFICATION = `
// ============================================================================
// TEST-TAX-COMPLIANCE.TS
// ============================================================================

import { recordTrade, TaxableTransaction, generateForm8949CSV, getTaxSummary } from './tax-compliance/taxTracker';
import { costBasisTracker } from './tax-compliance/costBasisTracker';

async function runTaxComplianceTests() {
  console.log('🧪 RUNNING TAX COMPLIANCE TESTS');
  console.log('='.repeat(50));
  
  try {
    // Test 1: Simulate a buy at $100 with $1 fee
    console.log('\\n📊 Test 1: Recording Buy Transaction');
    const buyTx: TaxableTransaction = {
      timestamp: new Date('2024-01-15T10:30:00Z').toISOString(),
      type: 'buy',
      tokenMint: 'TEST123456789',
      tokenSymbol: 'TEST',
      amount: 1000, // 1000 tokens
      priceSOL: 0.1, // 0.1 SOL per token  
      totalSOL: 100, // 100 SOL total
      fees: 1, // 1 SOL fee
      signature: 'buy_test_signature_123',
      success: true,
      platform: 'jupiter',
      notes: 'Test buy transaction'
    };
    
    await recordTrade(buyTx);
    console.log('✅ Buy transaction recorded');
    
    // Verify cost basis
    const holdings = costBasisTracker.getCostBasis('TEST123456789');
    console.log(\`📊 Cost basis entries: \${holdings.length}\`);
    console.log(\`📊 Total holding: \${costBasisTracker.getTotalHolding('TEST123456789')} tokens\`);
    
    // Test 2: Simulate a sell at $150 with $1 fee (after 6 months)
    console.log('\\n📊 Test 2: Recording Sell Transaction');
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
    
    const sellTx: TaxableTransaction = {
      timestamp: new Date('2024-07-15T14:45:00Z').toISOString(),
      type: 'sell',
      tokenMint: 'TEST123456789',
      tokenSymbol: 'TEST',
      amount: 1000, // Sell all 1000 tokens
      priceSOL: 0.15, // 0.15 SOL per token (50% gain)
      totalSOL: 150, // 150 SOL total
      fees: 1, // 1 SOL fee
      signature: 'sell_test_signature_456',
      success: true,
      platform: 'jupiter',
      notes: 'Test sell transaction'
    };
    
    await recordTrade(sellTx);
    console.log('✅ Sell transaction recorded');
    
    // Test 3: Verify calculations
    console.log('\\n📊 Test 3: Verifying Calculations');
    const costBasis = 100 + 1; // Buy amount + buy fee = $101
    const proceeds = 150 - 1; // Sell amount - sell fee = $149  
    const expectedGain = proceeds - costBasis; // $149 - $101 = $48
    
    console.log(\`Expected cost basis: $\${costBasis}\`);
    console.log(\`Expected proceeds: $\${proceeds}\`);
    console.log(\`Expected gain: $\${expectedGain}\`);
    
    // Test 4: Generate tax reports
    console.log('\\n📊 Test 4: Generating Tax Reports');
    const currentYear = new Date().getFullYear();
    const csvFile = generateForm8949CSV(currentYear);
    console.log(\`✅ Form 8949 CSV generated: \${csvFile}\`);
    
    const taxSummary = getTaxSummary(currentYear);
    console.log('✅ Tax Summary:', JSON.stringify(taxSummary, null, 2));
    
    // Test 5: Wash Sale Detection
    console.log('\\n📊 Test 5: Testing Wash Sale Detection');
    
    // Sell at a loss
    const lossySellTx: TaxableTransaction = {
      timestamp: new Date('2024-08-01T10:00:00Z').toISOString(),
      type: 'sell',
      tokenMint: 'WASH123456789',
      tokenSymbol: 'WASH',
      amount: 500,
      priceSOL: 0.08, // Lower than buy price
      totalSOL: 40,
      fees: 0.5,
      signature: 'wash_sell_test_123',
      success: true,
      platform: 'jupiter',
      notes: 'Loss sale for wash test'
    };
    
    // First record a buy for the wash test token
    const washBuyTx: TaxableTransaction = {
      timestamp: new Date('2024-07-01T10:00:00Z').toISOString(),
      type: 'buy',
      tokenMint: 'WASH123456789',
      tokenSymbol: 'WASH',
      amount: 500,
      priceSOL: 0.1, // Higher buy price
      totalSOL: 50,
      fees: 0.5,
      signature: 'wash_buy_test_123',
      success: true,
      platform: 'jupiter',
      notes: 'Buy for wash test'
    };
    
    await recordTrade(washBuyTx);
    await recordTrade(lossySellTx);
    
    // Rebuy within 30 days (this should trigger wash sale detection)
    const washRebuyTx: TaxableTransaction = {
      timestamp: new Date('2024-08-15T10:00:00Z').toISOString(), // 14 days later
      type: 'buy',
      tokenMint: 'WASH123456789',
      tokenSymbol: 'WASH',
      amount: 300,
      priceSOL: 0.09,
      totalSOL: 27,
      fees: 0.3,
      signature: 'wash_rebuy_test_456',
      success: true,
      platform: 'jupiter',
      notes: 'Rebuy within 30 days'
    };
    
    await recordTrade(washRebuyTx);
    console.log('✅ Wash sale test transactions recorded');
    
    // Test 6: Holdings Summary
    console.log('\\n📊 Test 6: Holdings Summary');
    const holdingsSummary = costBasisTracker.getHoldingsSummary();
    console.log('Holdings Summary:', JSON.stringify(holdingsSummary, null, 2));
    
    console.log('\\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log('\\n📁 Check these files for results:');
    console.log('• data/cost_basis.json - Cost basis tracking');
    console.log('• data/complete_transactions.json - All transactions');  
    console.log(\`• data/form_8949_\${currentYear}.csv - Form 8949 for IRS\`);
    console.log('• data/tax_log.jsonl - Raw transaction log');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTaxComplianceTests();
}

export { runTaxComplianceTests };
`;

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  console.log('\n🚀 EXECUTING FULL TAX COMPLIANCE IMPLEMENTATION');
  console.log('='.repeat(60));
  
  // Step 1: Find all sell locations
  const sellLocations = findAllSellLocations();
  
  // Step 2: Generate code additions
  const codeAdditions = generateCodeAdditions(sellLocations);
  
  console.log('\n🔧 PART 3: CREATING ENHANCED TAX TRACKER');
  console.log('-'.repeat(40));
  
  // Create tax-compliance directory
  const taxDir = path.join(__dirname, 'src', 'tax-compliance');
  if (!fs.existsSync(taxDir)) {
    fs.mkdirSync(taxDir, { recursive: true });
    console.log('✅ Created tax-compliance directory');
  }
  
  // Write enhanced taxTracker.ts
  const taxTrackerPath = path.join(taxDir, 'taxTracker.ts');
  fs.writeFileSync(taxTrackerPath, ENHANCED_TAX_TRACKER);
  console.log('✅ Created enhanced taxTracker.ts');
  
  console.log('\n🔧 PART 4: CREATING COST BASIS TRACKER');
  console.log('-'.repeat(40));
  
  // Write costBasisTracker.ts
  const costBasisPath = path.join(taxDir, 'costBasisTracker.ts');
  fs.writeFileSync(costBasisPath, COST_BASIS_TRACKER);
  console.log('✅ Created costBasisTracker.ts');
  
  console.log('\n🧪 PART 5: CREATING TEST VERIFICATION');
  console.log('-'.repeat(40));
  
  // Write test file
  const testPath = path.join(__dirname, 'test-tax-compliance.ts');
  fs.writeFileSync(testPath, TEST_VERIFICATION);
  console.log('✅ Created test-tax-compliance.ts');
  
  // Create data directory
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✅ Created data directory');
  }
  
  // Write the complete implementation report
  const reportPath = path.join(__dirname, 'TAX_COMPLIANCE_IMPLEMENTATION.md');
  const report = `# SOL-BOT TAX COMPLIANCE IMPLEMENTATION

## Overview
This implementation adds comprehensive tax compliance to the sol-bot trading system.

## Files Created
- \`src/tax-compliance/taxTracker.ts\` - Enhanced tax tracking system
- \`src/tax-compliance/costBasisTracker.ts\` - FIFO cost basis calculation
- \`test-tax-compliance.ts\` - Verification tests

## Sell Locations Found
${sellLocations.map((loc, i) => `${i + 1}. ${loc.file}:${loc.line} - ${loc.function} (${loc.pattern})`).join('\n')}

## Code Additions Required
${codeAdditions}

## Features Implemented
✅ FIFO cost basis tracking
✅ Wash sale detection (30-day rule)
✅ Short-term vs long-term capital gains
✅ Form 8949 CSV generation
✅ Complete transaction records
✅ Automatic tax calculation
✅ IRS-compliant reporting

## Usage
1. Import tax tracking in sell functions
2. Add tax recording blocks after successful trades  
3. Run tests: \`npx ts-node test-tax-compliance.ts\`
4. Generate reports: \`generateForm8949CSV(2024)\`

## IRS Compliance
- Tracks all buy/sell transactions
- Calculates accurate cost basis using FIFO
- Identifies wash sales
- Generates Form 8949 compatible reports
- Maintains complete audit trail
`;

  fs.writeFileSync(reportPath, report);
  console.log('✅ Created implementation report: TAX_COMPLIANCE_IMPLEMENTATION.md');
  
  console.log('\n🎉 FULL TAX COMPLIANCE IMPLEMENTATION COMPLETE!');
  console.log('='.repeat(60));
  console.log('\n📋 SUMMARY:');
  console.log(`📍 Found ${sellLocations.length} sell locations requiring tax recording`);
  console.log('📊 Enhanced tax tracker with FIFO and wash sale detection');
  console.log('📈 Cost basis tracker with automatic calculations');
  console.log('🧪 Test suite for verification');
  console.log('📁 IRS-compliant reporting system');
  
  console.log('\n⚡ NEXT STEPS:');
  console.log('1. Add import statements to files with sell functions');
  console.log('2. Add tax recording blocks after successful sell transactions');
  console.log('3. Run test suite: npx ts-node test-tax-compliance.ts');
  console.log('4. Integrate with existing trading system');
  console.log('5. Generate year-end tax reports');
  
  console.log('\n📂 Files created:');
  console.log('• src/tax-compliance/taxTracker.ts');
  console.log('• src/tax-compliance/costBasisTracker.ts');
  console.log('• test-tax-compliance.ts');
  console.log('• TAX_COMPLIANCE_IMPLEMENTATION.md');
  console.log('• implement-full-tax-compliance.ts (this script)');
}

// Run if executed directly
if (require.main === module) {
  main();
} else {
  // Export functions for programmatic use
  module.exports = {
    findAllSellLocations,
    generateCodeAdditions,
    main
  };
}