// profit-analyzer.ts
// Standalone script to analyze SOL-BOT trading profits from pool_transactions.csv
// Run with: npx ts-node profit-analyzer.ts

import * as fs from 'fs';
import * as path from 'path';

interface TradeRecord {
  timestamp: string;
  type: 'trade_execution' | 'profit_return' | 'loss_return' | 'pool_status';
  amount: number;
  poolBefore: number;
  poolAfter: number;
  tradeNumber: number;
  notes: string;
  tokenMint?: string;
  pnl?: number;
  holdTime?: number;
}

interface ProfitAnalysis {
  // Basic Stats
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  
  // Profit/Loss
  grossProfit: number;
  grossLoss: number;
  netProfit: number;
  roi: number;
  
  // Pool Stats
  initialPool: number;
  finalPool: number;
  maxPool: number;
  minPool: number;
  
  // Performance
  bestTrade: number;
  worstTrade: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  
  // Trading Details
  averageHoldTime: number;
  positionSize: number;
  
  // Session Info
  sessionStart: string;
  sessionEnd: string;
  sessionDuration: string;
}

class SOLBotProfitAnalyzer {
  private trades: TradeRecord[] = [];
  private csvPath: string;

  constructor(csvPath: string = './pool_transactions.csv') {
    this.csvPath = csvPath;
    console.log('🤖 SOL-BOT PROFIT ANALYZER');
    console.log('=' .repeat(50));
  }

  // Main analysis function
  async analyzeProfits(): Promise<ProfitAnalysis> {
    console.log(`📁 Loading data from: ${this.csvPath}`);
    
    // Load and parse CSV
    await this.loadCSV();
    
    if (this.trades.length === 0) {
      throw new Error('❌ No trade data found in CSV file');
    }

    console.log(`✅ Loaded ${this.trades.length} transactions\n`);

    // Analyze trades
    const analysis = this.calculateProfitMetrics();
    
    // Display results
    this.displayResults(analysis);
    
    // Export detailed breakdown
    this.exportDetailedBreakdown(analysis);
    
    return analysis;
  }

  // Load and parse CSV file
  private async loadCSV(): Promise<void> {
    if (!fs.existsSync(this.csvPath)) {
      throw new Error(`❌ CSV file not found: ${this.csvPath}`);
    }

    const content = fs.readFileSync(this.csvPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Skip header row
    const dataLines = lines.slice(1);
    
    dataLines.forEach(line => {
      const parts = line.split(',');
      if (parts.length >= 6) {
        const record: TradeRecord = {
          timestamp: parts[0],
          type: parts[1] as any,
          amount: parseFloat(parts[2]) || 0,
          poolBefore: parseFloat(parts[3]) || 0,
          poolAfter: parseFloat(parts[4]) || 0,
          tradeNumber: parseInt(parts[5]) || 0,
          notes: parts[6] || ''
        };

        // Extract additional data from notes
        this.parseTradeNotes(record);
        
        this.trades.push(record);
      }
    });
  }

  // Parse additional data from trade notes
  private parseTradeNotes(record: TradeRecord): void {
    if (!record.notes) return;

    // Extract token mint from notes (first 8 chars after execution)
    const tokenMatch = record.notes.match(/([A-Za-z0-9]{8})\.\.\./);
    if (tokenMatch) {
      record.tokenMint = tokenMatch[1];
    }

    // Extract P&L from profit/loss returns
    if (record.type === 'profit_return' || record.type === 'loss_return') {
      const pnlMatch = record.notes.match(/P&L: \$?([+-]?[\d.-]+)/);
      if (pnlMatch) {
        record.pnl = parseFloat(pnlMatch[1]);
      }

      // Extract hold time
      const holdMatch = record.notes.match(/Hold: ([\d.]+)m/);
      if (holdMatch) {
        record.holdTime = parseFloat(holdMatch[1]);
      }
    }
  }

  // Calculate comprehensive profit metrics
  private calculateProfitMetrics(): ProfitAnalysis {
    const trades = this.trades.filter(t => t.type === 'profit_return' || t.type === 'loss_return');
    const executions = this.trades.filter(t => t.type === 'trade_execution');
    
    // Basic counts
    const winningTrades = trades.filter(t => t.pnl && t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl && t.pnl < 0);
    
    // Profit calculations
    const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const netProfit = grossProfit - grossLoss;
    
    // Pool stats
    const poolValues = this.trades.map(t => t.poolAfter).filter(p => p > 0);
    const initialPool = this.trades[0]?.poolBefore || 0;
    const finalPool = poolValues[poolValues.length - 1] || 0;
    const maxPool = Math.max(...poolValues);
    const minPool = Math.min(...poolValues);
    
    // Calculate ROI
    const roi = initialPool > 0 ? ((finalPool - initialPool) / initialPool) * 100 : 0;
    
    // Performance metrics
    const profits = winningTrades.map(t => t.pnl || 0);
    const losses = losingTrades.map(t => Math.abs(t.pnl || 0));
    
    const bestTrade = profits.length > 0 ? Math.max(...profits) : 0;
    const worstTrade = losses.length > 0 ? -Math.max(...losses) : 0;
    const averageWin = profits.length > 0 ? profits.reduce((a, b) => a + b, 0) / profits.length : 0;
    const averageLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    
    // Position size (average execution amount)
    const positionSize = executions.length > 0 
      ? Math.abs(executions.reduce((sum, t) => sum + t.amount, 0)) / executions.length 
      : 0;
    
    // Hold time average
    const holdTimes = trades.filter(t => t.holdTime).map(t => t.holdTime!);
    const averageHoldTime = holdTimes.length > 0 
      ? holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length 
      : 0;
    
    // Session timing
    const sessionStart = this.trades[0]?.timestamp || '';
    const sessionEnd = this.trades[this.trades.length - 1]?.timestamp || '';
    const sessionDuration = this.calculateDuration(sessionStart, sessionEnd);

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      
      grossProfit,
      grossLoss,
      netProfit,
      roi,
      
      initialPool,
      finalPool,
      maxPool,
      minPool,
      
      bestTrade,
      worstTrade,
      averageWin,
      averageLoss,
      profitFactor,
      
      averageHoldTime,
      positionSize,
      
      sessionStart,
      sessionEnd,
      sessionDuration
    };
  }

  // Display comprehensive results
  private displayResults(analysis: ProfitAnalysis): void {
    console.log('📊 PROFIT & LOSS ANALYSIS');
    console.log('=' .repeat(50));
    
    // Session Overview
    console.log(`🕐 SESSION: ${analysis.sessionStart.split('T')[0]} (${analysis.sessionDuration})`);
    console.log(`💰 POOL: $${analysis.initialPool.toFixed(2)} → $${analysis.finalPool.toFixed(2)}`);
    console.log('');
    
    // Key Metrics
    console.log('🎯 KEY METRICS:');
    console.log(`   Net Profit: $${analysis.netProfit >= 0 ? '+' : ''}${analysis.netProfit.toFixed(2)}`);
    console.log(`   ROI: ${analysis.roi >= 0 ? '+' : ''}${analysis.roi.toFixed(2)}%`);
    console.log(`   Win Rate: ${analysis.winRate.toFixed(1)}% (${analysis.winningTrades}/${analysis.totalTrades})`);
    console.log(`   Profit Factor: ${analysis.profitFactor === Infinity ? '∞' : analysis.profitFactor.toFixed(2)}`);
    console.log('');
    
    // Profit Breakdown
    console.log('💵 PROFIT BREAKDOWN:');
    console.log(`   Gross Profit: +$${analysis.grossProfit.toFixed(2)}`);
    console.log(`   Gross Loss: -$${analysis.grossLoss.toFixed(2)}`);
    console.log(`   Net Result: ${analysis.netProfit >= 0 ? '+' : ''}$${analysis.netProfit.toFixed(2)}`);
    console.log('');
    
    // Trade Performance
    console.log('📈 TRADE PERFORMANCE:');
    console.log(`   Best Trade: +$${analysis.bestTrade.toFixed(2)}`);
    console.log(`   Worst Trade: $${analysis.worstTrade.toFixed(2)}`);
    console.log(`   Avg Win: +$${analysis.averageWin.toFixed(2)}`);
    console.log(`   Avg Loss: -$${analysis.averageLoss.toFixed(2)}`);
    console.log('');
    
    // Pool Statistics
    console.log('🏦 POOL STATISTICS:');
    console.log(`   Peak Pool: $${analysis.maxPool.toFixed(2)}`);
    console.log(`   Lowest Pool: $${analysis.minPool.toFixed(2)}`);
    console.log(`   Drawdown: ${((analysis.maxPool - analysis.minPool) / analysis.maxPool * 100).toFixed(1)}%`);
    console.log('');
    
    // Trading Stats
    console.log('⚡ TRADING STATS:');
    console.log(`   Total Trades: ${analysis.totalTrades}`);
    console.log(`   Position Size: $${analysis.positionSize.toFixed(2)}`);
    console.log(`   Avg Hold Time: ${analysis.averageHoldTime.toFixed(1)} minutes`);
    console.log('');
    
    // Performance Rating
    this.displayPerformanceRating(analysis);
  }

  // Display performance rating
  private displayPerformanceRating(analysis: ProfitAnalysis): void {
    let rating = '⭐';
    let message = 'Needs Improvement';
    
    if (analysis.roi > 50 && analysis.winRate > 70) {
      rating = '⭐⭐⭐⭐⭐';
      message = 'EXCELLENT Performance!';
    } else if (analysis.roi > 20 && analysis.winRate > 60) {
      rating = '⭐⭐⭐⭐';
      message = 'Very Good Performance';
    } else if (analysis.roi > 5 && analysis.winRate > 50) {
      rating = '⭐⭐⭐';
      message = 'Good Performance';
    } else if (analysis.roi > 0 && analysis.winRate > 40) {
      rating = '⭐⭐';
      message = 'Fair Performance';
    }
    
    console.log(`🏆 OVERALL RATING: ${rating}`);
    console.log(`   ${message}`);
    console.log('=' .repeat(50));
  }

  // Export detailed breakdown
  private exportDetailedBreakdown(analysis: ProfitAnalysis): void {
    const report = {
      summary: analysis,
      detailedTrades: this.trades.filter(t => t.type === 'profit_return' || t.type === 'loss_return')
        .map(t => ({
          timestamp: t.timestamp,
          token: t.tokenMint,
          pnl: t.pnl,
          holdTime: t.holdTime,
          poolAfter: t.poolAfter
        }))
    };
    
    const reportPath = './profit_analysis_report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report exported to: ${reportPath}`);
  }

  // Calculate duration between timestamps
  private calculateDuration(start: string, end: string): string {
    const startTime = new Date(start);
    const endTime = new Date(end);
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
}

// Main execution
async function main() {
  const analyzer = new SOLBotProfitAnalyzer();
  
  try {
    await analyzer.analyzeProfits();
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    console.log('\n💡 USAGE:');
    console.log('   1. Place your pool_transactions.csv in the same folder');
    console.log('   2. Run: npx ts-node profit-analyzer.ts');
    console.log('   3. Or specify path: npx ts-node profit-analyzer.ts /path/to/your.csv');
  }
}

// Run if called directly
if (require.main === module) {
  const csvPath = process.argv[2] || './pool_transactions.csv';
  new SOLBotProfitAnalyzer(csvPath).analyzeProfits().catch(console.error);
}