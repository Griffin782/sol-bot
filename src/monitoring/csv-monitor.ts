#!/usr/bin/env node
// CSV Performance Monitor - Standalone real-time bot monitoring
// Reads existing CSV files and displays live performance metrics

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

interface PoolTransaction {
  timestamp: string;
  transaction_type: string;
  token_address: string;
  amount_sol: number;
  amount_usd: number;
  pool_before: number;
  pool_after: number;
  profit_loss: number;
  win: boolean;
}

interface PerformanceEntry {
  timestamp: string;
  trades_count: number;
  wins: number;
  losses: number;
  win_rate: number;
  current_pool: number;
  session_profit: number;
  total_profit: number;
  roi: number;
}

interface PendingToken {
  token_address: string;
  entry_time: string;
  entry_price: number;
  amount_sol: number;
  status: string;
}

interface LiveStats {
  timestamp: string;
  metric_name: string;
  value: number;
}

class CSVMonitor {
  private dataPath = path.join(process.cwd(), 'data');
  private startTime = Date.now();
  private initialPool = 600; // Default starting pool

  private poolTransactionsFile = path.join(this.dataPath, 'pool_transactions.csv');
  private performanceLogFile = path.join(this.dataPath, 'performance_log.csv');
  private pendingTokensFile = path.join(this.dataPath, 'pending_tokens.csv');
  private liveStatsFile = path.join(this.dataPath, 'live_stats.csv');

  constructor() {
    console.log(chalk.cyan('🚀 SOL-BOT CSV Performance Monitor Starting...'));
    this.initializeLiveStatsFile();
  }

  private initializeLiveStatsFile(): void {
    if (!fs.existsSync(this.liveStatsFile)) {
      const header = 'timestamp,metric_name,value\n';
      fs.writeFileSync(this.liveStatsFile, header);
    }
  }

  private parseCSV<T>(filePath: string, parser: (row: string[]) => T): T[] {
    try {
      if (!fs.existsSync(filePath)) {
        return [];
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');

      if (lines.length <= 1) return []; // No data rows

      return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        return parser(values);
      }).filter(item => item !== null);
    } catch (error) {
      console.error(chalk.red(`Error reading ${filePath}:`, error));
      return [];
    }
  }

  private parsePoolTransactions(): PoolTransaction[] {
    return this.parseCSV(this.poolTransactionsFile, (values) => {
      if (values.length < 9) return null;
      return {
        timestamp: values[0],
        transaction_type: values[1],
        token_address: values[2],
        amount_sol: parseFloat(values[3]) || 0,
        amount_usd: parseFloat(values[4]) || 0,
        pool_before: parseFloat(values[5]) || 0,
        pool_after: parseFloat(values[6]) || 0,
        profit_loss: parseFloat(values[7]) || 0,
        win: values[8].toLowerCase() === 'true'
      };
    });
  }

  private parsePerformanceLog(): PerformanceEntry[] {
    return this.parseCSV(this.performanceLogFile, (values) => {
      if (values.length < 9) return null;
      return {
        timestamp: values[0],
        trades_count: parseInt(values[1]) || 0,
        wins: parseInt(values[2]) || 0,
        losses: parseInt(values[3]) || 0,
        win_rate: parseFloat(values[4]) || 0,
        current_pool: parseFloat(values[5]) || 0,
        session_profit: parseFloat(values[6]) || 0,
        total_profit: parseFloat(values[7]) || 0,
        roi: parseFloat(values[8]) || 0
      };
    });
  }

  private parsePendingTokens(): PendingToken[] {
    return this.parseCSV(this.pendingTokensFile, (values) => {
      if (values.length < 5) return null;
      return {
        token_address: values[0],
        entry_time: values[1],
        entry_price: parseFloat(values[2]) || 0,
        amount_sol: parseFloat(values[3]) || 0,
        status: values[4]
      };
    });
  }

  private updateLiveStats(metricName: string, value: number): void {
    const timestamp = new Date().toISOString();
    const entry = `${timestamp},${metricName},${value}\n`;
    fs.appendFileSync(this.liveStatsFile, entry);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private calculateMetrics() {
    const transactions = this.parsePoolTransactions();
    const performance = this.parsePerformanceLog();
    const pending = this.parsePendingTokens();

    // Get latest performance data
    const latest = performance[performance.length - 1];

    // Calculate from transactions if performance log is missing
    const trades = transactions.filter(t => t.transaction_type === 'BUY' || t.transaction_type === 'SELL');
    const wins = trades.filter(t => t.win).length;
    const totalTrades = Math.max(trades.length, latest?.trades_count || 0);
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    // Current pool calculation
    const currentPool = latest?.current_pool ||
                       (transactions.length > 0 ? transactions[transactions.length - 1].pool_after : this.initialPool);

    // Session metrics
    const sessionGross = currentPool - this.initialPool;
    const totalGross = latest?.total_profit || sessionGross;

    // Estimate fees (rough calculation: 0.1% per trade)
    const estimatedFees = totalTrades * 0.25; // ~$0.25 per trade in fees
    const totalNet = totalGross - estimatedFees;
    const netROI = this.initialPool > 0 ? (totalNet / this.initialPool) * 100 : 0;

    // Active trades
    const activeTrades = pending.filter(p => p.status === 'ACTIVE' || p.status === 'PENDING').length;

    return {
      totalTrades,
      activeTrades,
      wins,
      winRate,
      currentPool,
      sessionGross,
      totalGross,
      totalNet,
      netROI,
      estimatedFees,
      startTime: this.startTime,
      runtime: Date.now() - this.startTime
    };
  }

  private displayMetrics(): void {
    console.clear();

    const metrics = this.calculateMetrics();
    const sessionStarted = new Date(metrics.startTime).toLocaleTimeString();
    const runtime = this.formatDuration(metrics.runtime);
    const lastUpdate = new Date().toLocaleTimeString();

    // Update live stats CSV
    this.updateLiveStats('total_trades', metrics.totalTrades);
    this.updateLiveStats('win_rate', metrics.winRate);
    this.updateLiveStats('current_pool', metrics.currentPool);
    this.updateLiveStats('net_roi', metrics.netROI);

    console.log('================================');
    console.log(chalk.bold.cyan('   SOL-BOT PERFORMANCE MONITOR'));
    console.log('================================');
    console.log(`Session Started: ${chalk.yellow(sessionStarted)}`);
    console.log(`Runtime: ${chalk.blue(runtime)}\n`);

    console.log(chalk.bold('TRADING METRICS:'));
    console.log(`Trades: ${chalk.white(metrics.totalTrades)} | Active: ${chalk.cyan(metrics.activeTrades)} | Win Rate: ${this.colorWinRate(metrics.winRate)}%\n`);

    console.log(chalk.bold('FINANCIAL STATUS:'));
    console.log(`Pool: ${chalk.green(`$${this.initialPool.toFixed(2)}`)} → ${chalk.green(`$${metrics.currentPool.toFixed(2)}`)}`);
    console.log(`Session Gross: ${this.colorProfit(metrics.sessionGross)}`);
    console.log(`Total Net: ${this.colorProfit(metrics.totalNet)} (after fees)`);
    console.log(`ROI: ${this.colorROI(metrics.netROI)}%\n`);

    // Milestone alerts
    if (metrics.netROI > 25) {
      console.log(chalk.green.bold('🎯 SESSION GOAL REACHED!'));
    }
    if (metrics.currentPool < this.initialPool * 0.9) {
      console.log(chalk.red.bold('⚠️ DRAWDOWN ALERT'));
    }
    if (metrics.winRate < 50 && metrics.totalTrades > 5) {
      console.log(chalk.red.bold('📉 LOW WIN RATE WARNING'));
    }

    console.log(`\nLast Update: ${chalk.gray(lastUpdate)}`);
    console.log('================================');
  }

  private colorWinRate(winRate: number): string {
    if (winRate > 70) return chalk.green(winRate.toFixed(1));
    if (winRate > 50) return chalk.yellow(winRate.toFixed(1));
    return chalk.red(winRate.toFixed(1));
  }

  private colorProfit(amount: number): string {
    const formatted = `$${Math.abs(amount).toFixed(2)}`;
    if (amount > 0) return chalk.green(`+${formatted}`);
    if (amount < 0) return chalk.red(`-${formatted}`);
    return chalk.white(formatted);
  }

  private colorROI(roi: number): string {
    if (roi > 20) return chalk.green.bold(roi.toFixed(1));
    if (roi > 10) return chalk.green(roi.toFixed(1));
    if (roi > 0) return chalk.yellow(roi.toFixed(1));
    return chalk.red(roi.toFixed(1));
  }

  public start(): void {
    console.log(chalk.green('📊 CSV Monitor started - updating every 5 seconds...\n'));

    // Initial display
    this.displayMetrics();

    // Update every 5 seconds
    setInterval(() => {
      this.displayMetrics();
    }, 5000);
  }

  public static main(): void {
    const monitor = new CSVMonitor();
    monitor.start();

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n🛑 CSV Monitor stopped'));
      process.exit(0);
    });
  }
}

// Run if called directly
if (require.main === module) {
  CSVMonitor.main();
}

export { CSVMonitor };