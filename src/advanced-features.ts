// advanced-features.ts - Advanced Bot Management Features

import * as fs from 'fs';
import * as path from 'path';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';

// ============================================
// 1. WALLET POOL MANAGEMENT
// ============================================

interface WalletConfig {
  privateKey: string;
  publicKey: string;
  status: 'active' | 'completed' | 'reserved';
  initialPool: number;
  currentPool: number;
  targetReached: boolean;
  startTime: Date;
  endTime?: Date;
  totalProfit?: number;
}

class WalletPoolManager {
  private walletPool: WalletConfig[] = [];
  private activeWallet: WalletConfig | null = null;
  private walletDir = './wallets';
  private completedDir = './wallets/completed';
  private pendingDir = './wallets/pending';

  constructor() {
    // Create directories if they don't exist
    [this.walletDir, this.completedDir, this.pendingDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    this.loadWalletPool();
  }

  // Load all pending wallets from JSON file
  private loadWalletPool(): void {
    const poolFile = path.join(this.pendingDir, 'wallet-pool.json');
    
    if (fs.existsSync(poolFile)) {
      const data = fs.readFileSync(poolFile, 'utf-8');
      this.walletPool = JSON.parse(data);
      console.log(`📊 Loaded ${this.walletPool.length} wallets from pool`);
    } else {
      console.log('⚠️ No wallet pool found. Creating new pool...');
      this.generateWalletPool(10); // Generate 10 wallets by default
    }
  }

  // Generate new wallets for the pool
  private generateWalletPool(count: number): void {
    const newWallets: WalletConfig[] = [];
    
    for (let i = 0; i < count; i++) {
      const keypair = Keypair.generate();
      const wallet: WalletConfig = {
        privateKey: Buffer.from(keypair.secretKey).toString('base64'),
        publicKey: keypair.publicKey.toBase58(),
        status: 'reserved',
        initialPool: 1000, // Default $1000 per wallet
        currentPool: 1000,
        targetReached: false,
        startTime: new Date()
      };
      newWallets.push(wallet);
    }
    
    this.walletPool = [...this.walletPool, ...newWallets];
    this.saveWalletPool();
    console.log(`✅ Generated ${count} new wallets`);
  }

  // Save wallet pool to file
  private saveWalletPool(): void {
    const poolFile = path.join(this.pendingDir, 'wallet-pool.json');
    fs.writeFileSync(poolFile, JSON.stringify(this.walletPool, null, 2));
  }

  // Get next available wallet
  public getNextWallet(): WalletConfig | null {
    const availableWallet = this.walletPool.find(w => w.status === 'reserved');
    
    if (availableWallet) {
      availableWallet.status = 'active';
      availableWallet.startTime = new Date();
      this.activeWallet = availableWallet;
      this.saveWalletPool();
      
      console.log(`🔄 Switched to new wallet: ${availableWallet.publicKey}`);
      console.log(`💰 Initial Pool: $${availableWallet.initialPool}`);
      
      return availableWallet;
    }
    
    console.log('⚠️ No available wallets in pool!');
    return null;
  }

  // Move completed wallet to completed folder
  public archiveCompletedWallet(wallet: WalletConfig): void {
    wallet.status = 'completed';
    wallet.endTime = new Date();
    wallet.totalProfit = wallet.currentPool - wallet.initialPool;
    
    // Save to completed folder with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `wallet-${wallet.publicKey.slice(0, 8)}-${timestamp}.json`;
    const filepath = path.join(this.completedDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(wallet, null, 2));
    
    // Remove from active pool
    this.walletPool = this.walletPool.filter(w => w.publicKey !== wallet.publicKey);
    this.saveWalletPool();
    
    console.log(`📦 Archived completed wallet to: ${filename}`);
    console.log(`💰 Final Profit: $${wallet.totalProfit?.toFixed(2)}`);
  }

  // Check if target reached and switch wallets
  public checkTargetAndSwitch(currentPool: number, targetPool: number): boolean {
    if (!this.activeWallet) return false;
    
    this.activeWallet.currentPool = currentPool;
    
    if (currentPool >= targetPool) {
      console.log(`🎯 Target reached! Pool: $${currentPool} >= $${targetPool}`);
      this.activeWallet.targetReached = true;
      this.archiveCompletedWallet(this.activeWallet);
      
      // Get next wallet
      const nextWallet = this.getNextWallet();
      if (nextWallet) {
        // Update environment with new wallet
        process.env.PRIVATE_KEY = nextWallet.privateKey;
        return true;
      }
    }
    
    return false;
  }
}

// ============================================
// 2. SMART SHUTDOWN MANAGER
// ============================================

interface Position {
  tokenAddress: string;
  entryPrice: number;
  currentPrice: number;
  size: number;
  unrealizedPnL: number;
  entryTime: Date;
}

class SmartShutdownManager {
  private positions: Map<string, Position> = new Map();
  private shutdownRequested = false;
  private forceShutdownTime: Date | null = null;
  private runtime: number;
  private startTime: Date;

  constructor(runtimeMinutes: number) {
    this.runtime = runtimeMinutes * 60 * 1000; // Convert to milliseconds
    this.startTime = new Date();
    
    // Note: SIGINT/SIGTERM handlers are managed by the main bot process
    // to ensure proper coordination of shutdown sequence
  }

  // Add or update a position
  public updatePosition(tokenAddress: string, position: Position): void {
    this.positions.set(tokenAddress, position);
  }

  // Remove a closed position
  public removePosition(tokenAddress: string): void {
    this.positions.delete(tokenAddress);
    console.log(`📊 Position closed: ${tokenAddress}`);
    
    // Check if we can shutdown now
    if (this.shutdownRequested && this.positions.size === 0) {
      this.executeShutdown();
    }
  }

  // Check if runtime exceeded
  public isRuntimeExceeded(): boolean {
    const elapsed = Date.now() - this.startTime.getTime();
    return elapsed >= this.runtime;
  }

  // Request shutdown (but wait for positions to close)
  private requestShutdown(reason: string): void {
    console.log(`\n⚠️ Shutdown requested: ${reason}`);
    this.shutdownRequested = true;
    
    if (this.positions.size === 0) {
      this.executeShutdown();
    } else {
      console.log(`⏳ Waiting for ${this.positions.size} positions to close...`);
      this.displayOpenPositions();
      
      // Set force shutdown after 30 minutes
      this.forceShutdownTime = new Date(Date.now() + 30 * 60 * 1000);
      console.log(`⏰ Force shutdown at: ${this.forceShutdownTime.toLocaleTimeString()}`);
    }
  }

  // Display all open positions
  private displayOpenPositions(): void {
    console.log('\n📈 Open Positions:');
    this.positions.forEach((pos, token) => {
      console.log(`  Token: ${token.slice(0, 8)}...`);
      console.log(`  Size: ${pos.size} | PnL: $${pos.unrealizedPnL.toFixed(2)}`);
      console.log(`  Entry: ${pos.entryTime.toLocaleTimeString()}`);
    });
  }

  // Execute final shutdown
  private executeShutdown(): void {
    console.log('\n✅ All positions closed. Advanced manager shutdown complete.');

    // Save final state
    this.saveFinalState();

    // Generate tax report
    const taxTracker = new TaxComplianceTracker();
    taxTracker.generateDailyReport();

    // Don't call process.exit(0) directly - let the main shutdown handler do this
    // The main bot will handle the full shutdown sequence
    console.log('📊 Advanced manager shutdown complete - deferring to main shutdown handler');
  }

  // Save final trading state
  private saveFinalState(): void {
    const stateFile = './data/final-state.json';
    const state = {
      shutdownTime: new Date(),
      runtime: Date.now() - this.startTime.getTime(),
      finalPositions: Array.from(this.positions.values())
    };
    
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    console.log(`💾 Final state saved to: ${stateFile}`);
  }

  // Check if we should enter new positions
  public shouldEnterNewPositions(): boolean {
    if (this.shutdownRequested) return false;
    if (this.isRuntimeExceeded()) {
      this.requestShutdown('Runtime exceeded');
      return false;
    }
    return true;
  }

  // Public method for main bot to initiate shutdown
  public initiateShutdown(reason: string): void {
    this.requestShutdown(reason);
  }

  // Check if shutdown is complete (all positions closed)
  public isShutdownComplete(): boolean {
    return this.shutdownRequested && this.positions.size === 0;
  }
}

// ============================================
// 3. TAX COMPLIANCE TRACKER
// ============================================

interface TaxTransaction {
  timestamp: Date;
  type: 'BUY' | 'SELL' | 'FEE';
  tokenAddress: string;
  tokenSymbol: string;
  amount: number;
  pricePerToken: number;
  totalValue: number;
  fee: number;
  txHash: string;
  wallet: string;
  realizedGain?: number;
  costBasis?: number;
}

class TaxComplianceTracker {
  private transactions: TaxTransaction[] = [];
  private taxDir = './tax-compliance';
  private currentYear = new Date().getFullYear();

  constructor() {
    // Create tax directory structure
    const dirs = [
      this.taxDir,
      `${this.taxDir}/${this.currentYear}`,
      `${this.taxDir}/${this.currentYear}/transactions`,
      `${this.taxDir}/${this.currentYear}/reports`,
      `${this.taxDir}/${this.currentYear}/form8949`
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    this.loadTransactions();
  }

  // Load existing transactions
  private loadTransactions(): void {
    const txFile = `${this.taxDir}/${this.currentYear}/transactions/all-transactions.json`;
    
    if (fs.existsSync(txFile)) {
      const data = fs.readFileSync(txFile, 'utf-8');
      this.transactions = JSON.parse(data);
      console.log(`📊 Loaded ${this.transactions.length} transactions for tax tracking`);
    }
  }

  // Record a new transaction
  public recordTransaction(tx: TaxTransaction): void {
    // Calculate realized gains for sells
    if (tx.type === 'SELL') {
      tx.realizedGain = this.calculateRealizedGain(tx);
    }
    
    this.transactions.push(tx);
    this.saveTransactions();
    
    // Log for real-time tracking
    console.log(`📝 Tax Record: ${tx.type} ${tx.amount} ${tx.tokenSymbol} @ $${tx.pricePerToken}`);
    if (tx.realizedGain !== undefined) {
      console.log(`   💰 Realized Gain/Loss: $${tx.realizedGain.toFixed(2)}`);
    }
  }

  // Calculate realized gains using FIFO
  private calculateRealizedGain(sellTx: TaxTransaction): number {
    const buys = this.transactions.filter(
      t => t.type === 'BUY' && 
      t.tokenAddress === sellTx.tokenAddress &&
      t.timestamp < sellTx.timestamp
    ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    let remainingToSell = sellTx.amount;
    let totalCostBasis = 0;
    
    for (const buy of buys) {
      if (remainingToSell <= 0) break;
      
      const sellAmount = Math.min(remainingToSell, buy.amount);
      totalCostBasis += (buy.pricePerToken * sellAmount);
      remainingToSell -= sellAmount;
    }
    
    const saleProceeds = sellTx.totalValue;
    return saleProceeds - totalCostBasis - sellTx.fee;
  }

  // Save all transactions
  private saveTransactions(): void {
    const txFile = `${this.taxDir}/${this.currentYear}/transactions/all-transactions.json`;
    fs.writeFileSync(txFile, JSON.stringify(this.transactions, null, 2));
  }

  // Generate Form 8949 compatible report
  public generateForm8949Report(): void {
    const sells = this.transactions.filter(t => t.type === 'SELL');
    const report: any[] = [];
    
    sells.forEach(sell => {
      report.push({
        description: `${sell.amount} ${sell.tokenSymbol}`,
        dateAcquired: 'VARIOUS', // For FIFO
        dateSold: sell.timestamp,
        proceeds: sell.totalValue,
        costBasis: sell.costBasis || 0,
        gain: sell.realizedGain || 0,
        shortTerm: true // Assuming all crypto trades are short-term
      });
    });
    
    const reportFile = `${this.taxDir}/${this.currentYear}/form8949/form8949-data.csv`;
    const csv = this.convertToCSV(report);
    fs.writeFileSync(reportFile, csv);
    
    console.log(`📋 Form 8949 data saved to: ${reportFile}`);
  }

  // Generate daily summary report
  public generateDailyReport(): void {
    const today = new Date().toISOString().split('T')[0];
    const todayTx = this.transactions.filter(
      t => t.timestamp.toISOString().split('T')[0] === today
    );
    
    const summary = {
      date: today,
      totalTransactions: todayTx.length,
      buys: todayTx.filter(t => t.type === 'BUY').length,
      sells: todayTx.filter(t => t.type === 'SELL').length,
      totalVolume: todayTx.reduce((sum, t) => sum + t.totalValue, 0),
      totalFees: todayTx.reduce((sum, t) => sum + t.fee, 0),
      realizedGains: todayTx
        .filter(t => t.realizedGain !== undefined)
        .reduce((sum, t) => sum + (t.realizedGain || 0), 0),
      transactions: todayTx
    };
    
    const reportFile = `${this.taxDir}/${this.currentYear}/reports/daily-${today}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(summary, null, 2));
    
    console.log(`\n📊 Daily Tax Summary for ${today}:`);
    console.log(`  Transactions: ${summary.totalTransactions}`);
    console.log(`  Volume: $${summary.totalVolume.toFixed(2)}`);
    console.log(`  Fees: $${summary.totalFees.toFixed(2)}`);
    console.log(`  Realized P&L: $${summary.realizedGains.toFixed(2)}`);
    console.log(`  Report saved to: ${reportFile}`);
  }

  // Convert to CSV for tax software
  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' ? `"${value}"` : value;
        }).join(',')
      )
    ].join('\n');
    
    return csv;
  }

  // Generate year-end tax package
  public generateYearEndTaxPackage(): void {
    const packageDir = `${this.taxDir}/${this.currentYear}/year-end-package`;
    
    if (!fs.existsSync(packageDir)) {
      fs.mkdirSync(packageDir, { recursive: true });
    }
    
    // Generate Form 8949 data
    this.generateForm8949Report();
    
    // Calculate totals
    const totals = {
      totalBuys: this.transactions.filter(t => t.type === 'BUY').length,
      totalSells: this.transactions.filter(t => t.type === 'SELL').length,
      totalVolume: this.transactions.reduce((sum, t) => sum + t.totalValue, 0),
      totalFees: this.transactions.reduce((sum, t) => sum + t.fee, 0),
      totalRealizedGains: this.transactions
        .filter(t => t.realizedGain !== undefined)
        .reduce((sum, t) => sum + (t.realizedGain || 0), 0),
      shortTermGains: 0, // Calculate based on holding period
      longTermGains: 0
    };
    
    // Save summary
    const summaryFile = `${packageDir}/tax-summary-${this.currentYear}.json`;
    fs.writeFileSync(summaryFile, JSON.stringify(totals, null, 2));
    
    // Create instructions file
    const instructions = `
TAX FILING INSTRUCTIONS FOR ${this.currentYear}
================================================

1. FORM 8949 - Sales and Other Dispositions of Capital Assets
   - Import the CSV file: form8949/form8949-data.csv
   - All cryptocurrency trades are reported here
   - Check "Box C" for short-term transactions not reported on 1099-B

2. SCHEDULE D - Capital Gains and Losses
   - Transfer totals from Form 8949
   - Short-term gains/losses: $${totals.totalRealizedGains.toFixed(2)}
   - Long-term gains/losses: $0.00 (if all trades < 1 year)

3. TRANSACTION FEES
   - Total deductible fees: $${totals.totalFees.toFixed(2)}
   - Can be included in cost basis or separately itemized

4. IMPORTANT NOTES:
   - Method used: FIFO (First In, First Out)
   - All amounts in USD
   - Exchange rate source: Real-time market prices
   - Keep all transaction records for 7 years

5. REQUIRED DOCUMENTS:
   - All transaction JSONs in /transactions folder
   - Daily reports in /reports folder
   - Form 8949 CSV data
   - This summary file

6. TAX SOFTWARE IMPORT:
   - TurboTax: Import > Cryptocurrency > CSV Upload
   - H&R Block: Investment Income > Import Transactions
   - FreeTaxUSA: Manual entry using form8949-data.csv

7. QUARTERLY ESTIMATED TAXES:
   - If gains > $1,000, consider quarterly payments
   - Use Form 1040-ES for calculations

Generated on: ${new Date().toISOString()}
Total Transactions: ${this.transactions.length}
    `;
    
    const instructionsFile = `${packageDir}/TAX-INSTRUCTIONS-README.txt`;
    fs.writeFileSync(instructionsFile, instructions);
    
    console.log(`\n📦 Year-end tax package generated:`);
    console.log(`  Location: ${packageDir}`);
    console.log(`  Total Gains/Losses: $${totals.totalRealizedGains.toFixed(2)}`);
    console.log(`  Read instructions in: TAX-INSTRUCTIONS-README.txt`);
  }
}

// ============================================
// 4. INTEGRATION WITH MAIN BOT
// ============================================

export class AdvancedBotManager {
  private walletManager: WalletPoolManager;
  private shutdownManager: SmartShutdownManager;
  private taxTracker: TaxComplianceTracker;
  private config: any;

  constructor(config: any) {
    this.config = config;
    this.walletManager = new WalletPoolManager();
    this.shutdownManager = new SmartShutdownManager(config.runtime.maxRuntime);
    this.taxTracker = new TaxComplianceTracker();
  }

  // Initialize and get first wallet
  public initialize(): string {
    const wallet = this.walletManager.getNextWallet();
    if (!wallet) {
      throw new Error('No wallets available in pool!');
    }
    return wallet.privateKey;
  }

  // Check if should continue trading
  public shouldContinueTrading(): boolean {
    return this.shutdownManager.shouldEnterNewPositions();
  }

  // Update position
  public updatePosition(tokenAddress: string, position: Position): void {
    this.shutdownManager.updatePosition(tokenAddress, position);
  }

  // Close position and record for taxes
  public closePosition(
    tokenAddress: string,
    tokenSymbol: string,
    entryPrice: number,
    exitPrice: number,
    amount: number,
    fees: number,
    txHash: string
  ): void {
    // Remove from shutdown manager
    this.shutdownManager.removePosition(tokenAddress);
    
    // Record sale for taxes
    this.taxTracker.recordTransaction({
      timestamp: new Date(),
      type: 'SELL',
      tokenAddress,
      tokenSymbol,
      amount,
      pricePerToken: exitPrice,
      totalValue: exitPrice * amount,
      fee: fees,
      txHash,
      wallet: process.env.PRIVATE_KEY?.slice(0, 8) || 'unknown'
    });
  }

  // Check pool target and switch wallets if needed
  public checkPoolTarget(currentPool: number): void {
    const targetReached = this.walletManager.checkTargetAndSwitch(
      currentPool,
      this.config.pool.targetPool
    );
    
    if (targetReached) {
      console.log('🔄 Switched to new wallet from pool');
      // Bot will automatically use new PRIVATE_KEY from environment
    }
  }

  // Generate all reports
  public generateReports(): void {
    this.taxTracker.generateDailyReport();

    // Generate year-end package if December 31
    const today = new Date();
    if (today.getMonth() === 11 && today.getDate() === 31) {
      this.taxTracker.generateYearEndTaxPackage();
    }
  }

  // Proxy methods for shutdown manager integration
  public initiateShutdown(reason: string): void {
    this.shutdownManager.initiateShutdown(reason);
  }

  public isShutdownComplete(): boolean {
    return this.shutdownManager.isShutdownComplete();
  }
}

// ============================================
// 5. TRANSACTION FEE CALCULATOR
// ============================================

export class TransactionFeeCalculator {
  private readonly LAMPORTS_PER_SOL = 1_000_000_000;
  private readonly BASE_FEE = 5000; // 5000 lamports base fee
  
  // Calculate estimated transaction fee
  public calculateEstimatedFee(priorityFee: number = 0): number {
    const totalLamports = this.BASE_FEE + priorityFee;
    return totalLamports / this.LAMPORTS_PER_SOL;
  }
  
  // Calculate fee impact on position
  public calculateFeeImpact(
    positionSize: number,
    solPrice: number,
    priorityFee: number = 0
  ): {
    feeInSol: number;
    feeInUsd: number;
    feePercentage: number;
  } {
    const feeInSol = this.calculateEstimatedFee(priorityFee);
    const feeInUsd = feeInSol * solPrice;
    const positionInUsd = positionSize * solPrice;
    const feePercentage = (feeInUsd / positionInUsd) * 100;
    
    return {
      feeInSol,
      feeInUsd,
      feePercentage
    };
  }
  
  // Log fee analysis
  public logFeeAnalysis(positionSize: number, solPrice: number): void {
    const analysis = this.calculateFeeImpact(positionSize, solPrice, 100000);
    
    console.log('\n💸 Transaction Fee Analysis:');
    console.log(`  Base Fee: ${this.BASE_FEE / this.LAMPORTS_PER_SOL} SOL`);
    console.log(`  Priority Fee: ${100000 / this.LAMPORTS_PER_SOL} SOL`);
    console.log(`  Total Fee: ${analysis.feeInSol.toFixed(6)} SOL ($${analysis.feeInUsd.toFixed(4)})`);
    console.log(`  Fee Impact: ${analysis.feePercentage.toFixed(3)}% of position`);
    
    // In test mode with $1000 initial pool
    const tradesPerPool = 1000 / (positionSize * solPrice);
    const totalFeesForPool = analysis.feeInUsd * tradesPerPool;
    console.log(`  Estimated fees for $1000 pool: $${totalFeesForPool.toFixed(2)}`);
  }
}
