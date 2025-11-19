/**
 * Enhanced Buy-Sell Transaction Logger with USD Tracking
 * OPTIONAL replacement for buySellLogger with USD values
 *
 * STANDALONE MODULE - Does not modify existing bot
 * Use this INSTEAD of buySellLogger.ts when you want USD tracking
 */

import fs from 'fs';
import path from 'path';
// Stub for missing priceTracker
const getPriceTracker = () => ({
  getCurrentPrice: (mint: string) => null,
  getCurrentSOLPrice: () => 0,
  capturePriceSnapshot: (mint: string) => ({})
});
// import { getPriceTracker } from './priceTracker';

export interface EnhancedTradeLog {
  timestamp: Date;
  type: 'buy' | 'sell';
  tokenMint: string;
  solAmount: number;

  // NEW: USD tracking
  solPriceUSD: number;        // SOL price at THIS trade
  usdValue: number;           // Exact USD value
  priceSource: string;        // Where we got the price

  runtimeMinutes: number;
}

export interface EnhancedTradingStats {
  totalBuys: number;
  totalSells: number;
  runtimeMinutes: number;
  sellsPerHour: number;
  averageSellTime: number;

  // NEW: USD stats
  totalBuyValueUSD: number;
  totalSellValueUSD: number;
  netProfitUSD: number;
  totalFeesUSD: number;
}

class EnhancedBuySellLogger {
  private trades: EnhancedTradeLog[] = [];
  private startTime: Date;
  private logFilePath: string;
  private priceTracker = getPriceTracker();

  constructor() {
    this.startTime = new Date();

    // Use separate log file to not interfere with existing bot
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.logFilePath = path.join(logsDir, 'enhanced-buy-sell-transactions.log');
    this.initializeLogFile();
  }

  /**
   * Initialize log file
   */
  private initializeLogFile(): void {
    const header = `\n${'='.repeat(100)}\nEnhanced Buy-Sell Transaction Log (with USD tracking) - Started: ${this.startTime.toISOString()}\n${'='.repeat(100)}\n`;

    if (!fs.existsSync(this.logFilePath)) {
      fs.writeFileSync(this.logFilePath, header);
    } else {
      fs.appendFileSync(this.logFilePath, header);
    }
  }

  /**
   * Log a buy transaction with live SOL price
   */
  public async logBuy(tokenMint: string, solAmount: number): Promise<void> {
    const runtimeMinutes = this.getRuntimeMinutes();
    const timestamp = new Date();

    // Capture live SOL price
    const priceData = await this.priceTracker.getCurrentSOLPrice() as any;
    const solPriceUSD = priceData?.price || priceData || 0;
    const priceSource = priceData?.source || 'stub';

    // Calculate USD value
    const usdValue = solAmount * solPriceUSD;

    // Capture price snapshot for historical record
    await this.priceTracker.capturePriceSnapshot(timestamp.toISOString());

    const trade: EnhancedTradeLog = {
      timestamp,
      type: 'buy',
      tokenMint,
      solAmount,
      solPriceUSD,
      usdValue,
      priceSource,
      runtimeMinutes
    };

    this.trades.push(trade);
    this.writeToFile(trade);

    console.log(`✅ [ENHANCED] BUY: ${tokenMint.slice(0, 8)}... | ${solAmount.toFixed(4)} SOL | $${usdValue.toFixed(2)} USD`);
  }

  /**
   * Log a sell transaction with live SOL price
   */
  public async logSell(tokenMint: string, solAmount: number): Promise<void> {
    const runtimeMinutes = this.getRuntimeMinutes();
    const timestamp = new Date();

    // Capture live SOL price
    const priceData = await this.priceTracker.getCurrentSOLPrice() as any;
    const solPriceUSD = priceData?.price || priceData || 0;
    const priceSource = priceData?.source || 'stub';

    // Calculate USD value
    const usdValue = solAmount * solPriceUSD;

    // Capture price snapshot for historical record
    await this.priceTracker.capturePriceSnapshot(timestamp.toISOString());

    const trade: EnhancedTradeLog = {
      timestamp,
      type: 'sell',
      tokenMint,
      solAmount,
      solPriceUSD,
      usdValue,
      priceSource,
      runtimeMinutes
    };

    this.trades.push(trade);
    this.writeToFile(trade);

    const sellCount = this.getSellCount();

    console.log(`✅ [ENHANCED] SELL: ${tokenMint.slice(0, 8)}... | ${solAmount.toFixed(4)} SOL | $${usdValue.toFixed(2)} USD [Total: ${sellCount}]`);
  }

  /**
   * Write trade to log file (enhanced format with USD)
   */
  private writeToFile(trade: EnhancedTradeLog): void {
    const logLine = `[${trade.timestamp.toISOString()}] ${trade.type.toUpperCase()} | ${trade.tokenMint} | ${trade.solAmount.toFixed(4)} SOL | $${trade.usdValue.toFixed(2)} USD | SOL=$${trade.solPriceUSD.toFixed(2)} | Source: ${trade.priceSource} | Runtime: ${trade.runtimeMinutes} min\n`;
    fs.appendFileSync(this.logFilePath, logLine);
  }

  /**
   * Get current runtime in minutes
   */
  private getRuntimeMinutes(): number {
    const now = new Date();
    const diffMs = now.getTime() - this.startTime.getTime();
    return Math.floor(diffMs / 60000);
  }

  /**
   * Get total sell count
   */
  private getSellCount(): number {
    return this.trades.filter(t => t.type === 'sell').length;
  }

  /**
   * Get total buy count
   */
  private getBuyCount(): number {
    return this.trades.filter(t => t.type === 'buy').length;
  }

  /**
   * Get comprehensive trading statistics (with USD)
   */
  public getStats(): EnhancedTradingStats {
    const runtimeMinutes = this.getRuntimeMinutes();
    const totalSells = this.getSellCount();
    const totalBuys = this.getBuyCount();

    const runtimeHours = runtimeMinutes / 60;
    const sellsPerHour = runtimeHours > 0 ? totalSells / runtimeHours : 0;

    const sellTimes = this.trades
      .filter(t => t.type === 'sell')
      .map(t => t.runtimeMinutes);

    const averageSellTime = sellTimes.length > 0
      ? sellTimes.reduce((a, b) => a + b, 0) / sellTimes.length
      : 0;

    // Calculate USD values
    const totalBuyValueUSD = this.trades
      .filter(t => t.type === 'buy')
      .reduce((sum, t) => sum + t.usdValue, 0);

    const totalSellValueUSD = this.trades
      .filter(t => t.type === 'sell')
      .reduce((sum, t) => sum + t.usdValue, 0);

    // Estimate fees (0.005 SOL per transaction × 2 for buy+sell)
    const totalTransactions = totalBuys + totalSells;
    const averageSOLPrice = this.trades.length > 0
      ? this.trades.reduce((sum, t) => sum + t.solPriceUSD, 0) / this.trades.length
      : 0;
    const totalFeesUSD = totalTransactions * 0.005 * averageSOLPrice;

    const netProfitUSD = totalSellValueUSD - totalBuyValueUSD - totalFeesUSD;

    return {
      totalBuys,
      totalSells,
      runtimeMinutes,
      sellsPerHour,
      averageSellTime,
      totalBuyValueUSD,
      totalSellValueUSD,
      netProfitUSD,
      totalFeesUSD
    };
  }

  /**
   * Get all trades
   */
  public getTrades(): EnhancedTradeLog[] {
    return [...this.trades];
  }

  /**
   * Get trades by type
   */
  public getTradesByType(type: 'buy' | 'sell'): EnhancedTradeLog[] {
    return this.trades.filter(t => t.type === type);
  }

  /**
   * Export trades to JSON (enhanced with USD)
   */
  public exportToJSON(): string {
    const exportData = {
      startTime: this.startTime.toISOString(),
      currentTime: new Date().toISOString(),
      runtimeMinutes: this.getRuntimeMinutes(),
      stats: this.getStats(),
      trades: this.trades
    };

    const exportPath = path.join(process.cwd(), 'logs', `enhanced-trades-${Date.now()}.json`);
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

    console.log(`✅ Enhanced trades exported to: ${exportPath}`);

    return exportPath;
  }

  /**
   * Display current stats with USD
   */
  public displayStats(): void {
    const stats = this.getStats();

    console.log('\n' + '─'.repeat(70));
    console.log('📊 ENHANCED TRADING STATISTICS (with USD)');
    console.log('─'.repeat(70));
    console.log(`Runtime:          ${stats.runtimeMinutes} minutes`);
    console.log(`Total Buys:       ${stats.totalBuys}`);
    console.log(`Total Sells:      ${stats.totalSells}`);
    console.log(`Sells/Hour:       ${stats.sellsPerHour.toFixed(2)}`);
    console.log(`Avg Sell Time:    ${stats.averageSellTime.toFixed(2)} min`);
    console.log('─'.repeat(70));
    console.log(`Buy Value:        $${stats.totalBuyValueUSD.toFixed(2)} USD`);
    console.log(`Sell Value:       $${stats.totalSellValueUSD.toFixed(2)} USD`);
    console.log(`Estimated Fees:   $${stats.totalFeesUSD.toFixed(2)} USD`);
    console.log(`Net Profit:       $${stats.netProfitUSD.toFixed(2)} USD`);
    console.log('─'.repeat(70) + '\n');
  }

  /**
   * Reset logger
   */
  public reset(): void {
    this.trades = [];
    this.startTime = new Date();
    this.initializeLogFile();

    console.log('🔄 Enhanced Buy-Sell logger reset');
  }
}

// Export singleton instance
export const enhancedBuySellLogger = new EnhancedBuySellLogger();

// Export class for testing
export { EnhancedBuySellLogger };

// Standalone test
if (require.main === module) {
  (async () => {
    console.log('🧪 Testing Enhanced Buy-Sell Logger\n');

    // Test logging
    await enhancedBuySellLogger.logBuy('TestToken123', 0.1);
    await enhancedBuySellLogger.logSell('TestToken123', 0.15);

    // Display stats
    enhancedBuySellLogger.displayStats();

    // Export
    enhancedBuySellLogger.exportToJSON();

    console.log('\n✅ All tests passed!');
  })();
}
