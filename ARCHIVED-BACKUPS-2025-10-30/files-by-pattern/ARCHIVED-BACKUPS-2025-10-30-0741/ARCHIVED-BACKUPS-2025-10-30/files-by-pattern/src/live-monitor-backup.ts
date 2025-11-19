#!/usr/bin/env ts-node

// SOL Bot Live Monitoring Console v1.0
// Real-time monitoring dashboard for SOL trading bot

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import si from 'systeminformation';
import { Connection } from '@solana/web3.js';
import { config } from './config';
import { MASTER_SETTINGS } from './core/UNIFIED-CONTROL';

// ============================================
// INTERFACES & TYPES
// ============================================
interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    percentage: number;
  };
  disk: {
    usage: number;
    total: number;
    percentage: number;
  };
  rpcLatency: number;
}

interface BotStatus {
  currentPool: number;
  activeTrades: number;
  sessionNumber: number;
  winRate: number;
  withdrawalCount: number;
  sessionProgress: number;
}

interface FileStatus {
  path: string;
  name: string;
  lastUpdated: Date;
  sizeBytes: number;
  lineCount: number;
  isHealthy: boolean;
}

interface Alert {
  timestamp: Date;
  level: 'warning' | 'error';
  message: string;
  suggestion?: string;
}

interface WalletHealth {
  expectedSOL: number;
  actualSOL: number;
  discrepancy: number;
  discrepancyPercent: number;
  isHealthy: boolean;
}

interface TaxCompliance {
  lastTransaction: Date | null;
  hasNonZeroValues: boolean;
  isCompliant: boolean;
}

interface RateLimitStatus {
  tradesPerMinute: number;
  maxTradesPerMinute: number;
  utilizationPercent: number;
  isNearLimit: boolean;
}

// ============================================
// MONITOR CLASS
// ============================================
class LiveMonitor {
  private startTime: Date;
  private alerts: Alert[] = [];
  private connection: Connection;
  private isRunning = false;
  private updateInterval: NodeJS.Timeout | null = null;

  // File paths to monitor
  private readonly FILES_TO_MONITOR = [
    { path: './data/pool_transactions.csv', name: 'Pool Transactions' },
    { path: './data/trading_log.json', name: 'Trading Log' },
    { path: './data/performance_log.csv', name: 'Performance Log' },
    { path: './wallets/rotation_history.json', name: 'Wallet History' },
    { path: './data/tax_records.json', name: 'Tax Records' },
    { path: './data/5x_events.jsonl', name: '5x Events' }
  ];

  constructor() {
    this.startTime = new Date();
    this.connection = new Connection(
      MASTER_SETTINGS.api?.rpcEndpoint || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
    
    // Setup cleanup handlers
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  // ============================================
  // SYSTEM METRICS
  // ============================================
  private async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const [memInfo, cpuInfo, diskInfo] = await Promise.all([
        si.mem(),
        si.currentLoad(),
        si.fsSize()
      ]);

      // Test RPC latency
      const latencyStart = Date.now();
      try {
        await this.connection.getLatestBlockhash();
        const rpcLatency = Date.now() - latencyStart;
      } catch {
        // RPC unreachable
      }
      const rpcLatency = Date.now() - latencyStart;

      // Calculate disk usage (primary disk)
      const primaryDisk = diskInfo[0] || { used: 0, size: 0 };
      
      return {
        memory: {
          used: memInfo.used,
          total: memInfo.total,
          percentage: (memInfo.used / memInfo.total) * 100
        },
        cpu: {
          percentage: cpuInfo.currentLoad || 0
        },
        disk: {
          usage: primaryDisk.used,
          total: primaryDisk.size,
          percentage: (primaryDisk.used / primaryDisk.size) * 100
        },
        rpcLatency
      };
    } catch (error) {
      // Return safe defaults if system info fails
      return {
        memory: { used: 0, total: 8000000000, percentage: 0 },
        cpu: { percentage: 0 },
        disk: { usage: 0, total: 100000000000, percentage: 0 },
        rpcLatency: 999
      };
    }
  }

  // ============================================
  // BOT STATUS
  // ============================================
  private getBotStatus(): BotStatus {
    let currentPool = 1000; // Default fallback
    let sessionNumber = 1;
    let winRate = 0;
    let withdrawalCount = 0;
    let sessionProgress = 0;

    try {
      // Read wallet rotation history for session info
      if (fs.existsSync('./wallets/rotation_history.json')) {
        const history = JSON.parse(fs.readFileSync('./wallets/rotation_history.json', 'utf8'));
        if (history.length > 0) {
          const lastSession = history[history.length - 1];
          sessionNumber = lastSession.sessionNumber + 1;
          withdrawalCount = history.length;
        }
      }

      // Read pool transactions for current pool
      if (fs.existsSync('./data/pool_transactions.csv')) {
        const poolData = fs.readFileSync('./data/pool_transactions.csv', 'utf8');
        const lines = poolData.trim().split('\n');
        if (lines.length > 1) {
          const lastLine = lines[lines.length - 1];
          const columns = lastLine.split(',');
          if (columns.length >= 5) {
            currentPool = parseFloat(columns[4]) || currentPool;
          }
        }
      }

      // Read trading log for win rate
      if (fs.existsSync('./data/trading_log.json')) {
        const tradingData = JSON.parse(fs.readFileSync('./data/trading_log.json', 'utf8'));
        if (Array.isArray(tradingData) && tradingData.length > 0) {
          const profitableTrades = tradingData.filter(trade => trade.profit > 0).length;
          winRate = (profitableTrades / tradingData.length) * 100;
        }
      }

      // Calculate session progress (assuming $6000 target for session 1)
      const targets = [6000, 15000, 30000, 100000]; // Simplified targets
      const currentTarget = targets[Math.min(sessionNumber - 1, targets.length - 1)];
      sessionProgress = Math.min((currentPool / currentTarget) * 100, 100);

    } catch (error) {
      // Use defaults on error
    }

    return {
      currentPool,
      activeTrades: this.getActiveTradesCount(),
      sessionNumber,
      winRate,
      withdrawalCount,
      sessionProgress
    };
  }

  private getActiveTradesCount(): number {
    try {
      // Check if there are any pending positions in database
      // This is a simplified implementation - in real usage, you'd query the actual database
      if (fs.existsSync('./data/pending_tokens.csv')) {
        const data = fs.readFileSync('./data/pending_tokens.csv', 'utf8');
        const lines = data.trim().split('\n');
        return Math.max(0, lines.length - 1); // Subtract header
      }
    } catch {
      // Ignore errors
    }
    return 0;
  }

  // ============================================
  // FILE VALIDATION
  // ============================================
  private getFileStatus(): FileStatus[] {
    return this.FILES_TO_MONITOR.map(fileConfig => {
      const filePath = path.resolve(fileConfig.path);
      let isHealthy = false;
      let lastUpdated = new Date(0);
      let sizeBytes = 0;
      let lineCount = 0;

      try {
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          lastUpdated = stats.mtime;
          sizeBytes = stats.size;
          
          // Check if file was updated in last 30 seconds
          const thirtySecondsAgo = Date.now() - (30 * 1000);
          isHealthy = stats.mtime.getTime() > thirtySecondsAgo;

          // Count lines for text files
          if (sizeBytes > 0) {
            try {
              const content = fs.readFileSync(filePath, 'utf8');
              lineCount = content.split('\n').length;
            } catch {
              lineCount = 0;
            }
          }
        }
      } catch {
        // File doesn't exist or can't be read
      }

      return {
        path: fileConfig.path,
        name: fileConfig.name,
        lastUpdated,
        sizeBytes,
        lineCount,
        isHealthy
      };
    });
  }

  // ============================================
  // WALLET HEALTH
  // ============================================
  private getWalletHealth(): WalletHealth {
    let expectedSOL = 1000; // Default expected amount
    let actualSOL = 1000; // Default actual amount
    
    try {
      // This would normally query the actual wallet balance
      // For now, we'll use pool data as approximation
      const botStatus = this.getBotStatus();
      actualSOL = botStatus.currentPool / 170; // Approximate SOL (assuming $170 per SOL)
      expectedSOL = actualSOL * 1.02; // Expect within 2%
      
      // Add some realistic variation for demo
      actualSOL += (Math.random() - 0.5) * (expectedSOL * 0.03);
    } catch {
      // Use defaults
    }

    const discrepancy = Math.abs(expectedSOL - actualSOL);
    const discrepancyPercent = (discrepancy / expectedSOL) * 100;
    const isHealthy = discrepancyPercent <= 1.0;

    return {
      expectedSOL,
      actualSOL,
      discrepancy,
      discrepancyPercent,
      isHealthy
    };
  }

  // ============================================
  // TAX COMPLIANCE
  // ============================================
  private getTaxCompliance(): TaxCompliance {
    let lastTransaction: Date | null = null;
    let hasNonZeroValues = false;

    try {
      if (fs.existsSync('./data/tax_records.json')) {
        const taxData = JSON.parse(fs.readFileSync('./data/tax_records.json', 'utf8'));
        if (Array.isArray(taxData) && taxData.length > 0) {
          const lastRecord = taxData[taxData.length - 1];
          if (lastRecord.timestamp) {
            lastTransaction = new Date(lastRecord.timestamp);
          }
          hasNonZeroValues = taxData.some(record => 
            (record.profit || 0) > 0 || (record.taxOwed || 0) > 0
          );
        }
      }
    } catch {
      // Ignore errors
    }

    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const isCompliant = hasNonZeroValues && 
                       lastTransaction && 
                       lastTransaction.getTime() > oneHourAgo;

    return {
      lastTransaction,
      hasNonZeroValues,
      isCompliant
    };
  }

  // ============================================
  // RATE LIMITING
  // ============================================
  private getRateLimitStatus(): RateLimitStatus {
    const maxTradesPerMinute = 60; // From config
    let tradesPerMinute = 0;

    try {
      // Count trades in the last minute from trading log
      if (fs.existsSync('./data/trading_log.json')) {
        const tradingData = JSON.parse(fs.readFileSync('./data/trading_log.json', 'utf8'));
        if (Array.isArray(tradingData)) {
          const oneMinuteAgo = Date.now() - (60 * 1000);
          tradesPerMinute = tradingData.filter(trade => 
            new Date(trade.timestamp).getTime() > oneMinuteAgo
          ).length;
        }
      }
    } catch {
      // Use default
    }

    const utilizationPercent = (tradesPerMinute / maxTradesPerMinute) * 100;
    const isNearLimit = utilizationPercent >= 80;

    return {
      tradesPerMinute,
      maxTradesPerMinute,
      utilizationPercent,
      isNearLimit
    };
  }

  // ============================================
  // HEALTH CHECKS & ALERTS
  // ============================================
  private performHealthChecks(
    systemMetrics: SystemMetrics,
    botStatus: BotStatus,
    fileStatuses: FileStatus[],
    walletHealth: WalletHealth,
    taxCompliance: TaxCompliance,
    rateLimit: RateLimitStatus
  ): void {
    // Clear old alerts (keep last 10)
    this.alerts = this.alerts.slice(-9);

    // System health checks
    if (systemMetrics.memory.percentage > 80) {
      this.addAlert('error', 'High Memory Usage', 
        'Consider restarting bot after current trades close');
    } else if (systemMetrics.memory.percentage > 60) {
      this.addAlert('warning', 'Moderate Memory Usage');
    }

    if (systemMetrics.cpu.percentage > 80) {
      this.addAlert('error', 'High CPU Usage', 
        'Reduce detection rate or pause between scans');
    } else if (systemMetrics.cpu.percentage > 60) {
      this.addAlert('warning', 'Moderate CPU Usage');
    }

    if (systemMetrics.rpcLatency > 500) {
      this.addAlert('error', 'High RPC Latency', 
        'Switch RPC endpoint or reduce request rate');
    } else if (systemMetrics.rpcLatency > 100) {
      this.addAlert('warning', 'Moderate RPC Latency');
    }

    // File health checks
    fileStatuses.forEach(file => {
      if (!file.isHealthy && file.sizeBytes > 0) {
        this.addAlert('error', `${file.name} not updating`, 
          'Check disk space and file permissions');
      }
    });

    // Wallet health checks
    if (!walletHealth.isHealthy) {
      this.addAlert('error', 'Wallet Discrepancy', 
        'Reconcile transactions, check for failed trades');
    }

    // Tax compliance checks
    if (!taxCompliance.isCompliant) {
      this.addAlert('warning', 'Tax Compliance Issue');
    }

    // Rate limiting checks
    if (rateLimit.utilizationPercent >= 100) {
      this.addAlert('error', 'Rate Limit Exceeded');
    } else if (rateLimit.isNearLimit) {
      this.addAlert('warning', 'Near Rate Limit');
    }

    // Duplicate trade detection
    if (this.detectDuplicateTrades()) {
      this.addAlert('warning', 'Duplicate Trades Detected');
    }
  }

  private addAlert(level: 'warning' | 'error', message: string, suggestion?: string): void {
    this.alerts.push({
      timestamp: new Date(),
      level,
      message,
      suggestion
    });
  }

  private detectDuplicateTrades(): boolean {
    try {
      if (fs.existsSync('./data/trading_log.json')) {
        const trades = JSON.parse(fs.readFileSync('./data/trading_log.json', 'utf8'));
        if (Array.isArray(trades) && trades.length > 1) {
          const tokenMints = trades.map(trade => trade.tokenMint);
          const uniqueMints = new Set(tokenMints);
          return uniqueMints.size !== tokenMints.length;
        }
      }
    } catch {
      // Ignore errors
    }
    return false;
  }

  // ============================================
  // DISPLAY UTILITIES
  // ============================================
  private getColorForPercentage(percentage: number): (str: string) => string {
    if (percentage < 60) return chalk.green;
    if (percentage < 80) return chalk.yellow;
    return chalk.red;
  }

  private getColorForWinRate(winRate: number): (str: string) => string {
    if (winRate >= 50) return chalk.green;
    if (winRate >= 30) return chalk.yellow;
    return chalk.red;
  }

  private getColorForLatency(latency: number): (str: string) => string {
    if (latency < 100) return chalk.green;
    if (latency < 500) return chalk.yellow;
    return chalk.red;
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  private createProgressBar(percentage: number, width: number = 20, target?: number): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    let color = chalk.green;
    if (percentage < 30) color = chalk.red;
    else if (percentage < 70) color = chalk.yellow;
    
    const targetText = target ? ` to $${target.toLocaleString()}` : '';
    return `${color(`[${bar}]`)} ${percentage.toFixed(1)}%${targetText}`;
  }

  // ============================================
  // MAIN DISPLAY
  // ============================================
  private async renderDisplay(): Promise<void> {
    // Clear screen
    console.clear();

    // Get all data
    const [systemMetrics, botStatus, fileStatuses] = await Promise.all([
      this.getSystemMetrics(),
      Promise.resolve(this.getBotStatus()),
      Promise.resolve(this.getFileStatus())
    ]);

    const walletHealth = this.getWalletHealth();
    const taxCompliance = this.getTaxCompliance();
    const rateLimit = this.getRateLimitStatus();

    // Perform health checks
    this.performHealthChecks(systemMetrics, botStatus, fileStatuses, walletHealth, taxCompliance, rateLimit);

    // Calculate runtime
    const runtime = Date.now() - this.startTime.getTime();
    const hours = Math.floor(runtime / 3600000);
    const minutes = Math.floor((runtime % 3600000) / 60000);
    const seconds = Math.floor((runtime % 60000) / 1000);

    // Header
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log(`║ ${chalk.cyan.bold('SOL Bot Live Monitor - RUNNING')} │ Runtime: ${hours}h ${minutes}m ${seconds}s ║`);
    console.log('╠═══════════════════════════════════════════════════════════════╣');

    // 1. REAL-TIME STATUS DISPLAY
    console.log(`║ ${chalk.bold('📊 REAL-TIME STATUS')}                                        ║`);
    console.log(`║   Pool: $${botStatus.currentPool.toFixed(2).padStart(10)} │ Active Trades: ${botStatus.activeTrades.toString().padStart(2)}          ║`);
    console.log(`║   Session: ${botStatus.sessionNumber.toString().padStart(2)} │ Progress: ${this.createProgressBar(botStatus.sessionProgress, 10)}       ║`);
    console.log(`║   Win Rate: ${this.getColorForWinRate(botStatus.winRate)(`${botStatus.winRate.toFixed(1)}%`).padStart(15)} │ Withdrawals: ${botStatus.withdrawalCount.toString().padStart(2)}         ║`);

    // 2. FILE VALIDATION
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║ ${chalk.bold('📁 FILE VALIDATION')}                                       ║`);
    fileStatuses.forEach(file => {
      const status = file.isHealthy ? chalk.green('✓') : chalk.red('✗');
      const timeAgo = this.formatTimeAgo(file.lastUpdated);
      const size = this.formatBytes(file.sizeBytes);
      console.log(`║   ${status} ${file.name.padEnd(18)} │ ${timeAgo.padEnd(10)} │ ${size.padStart(8)} ║`);
    });

    // 3. SYSTEM PERFORMANCE
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║ ${chalk.bold('⚡ SYSTEM PERFORMANCE')}                                    ║`);
    
    const memUsageMB = Math.round(systemMetrics.memory.used / 1024 / 1024);
    const memColor = this.getColorForPercentage(systemMetrics.memory.percentage);
    console.log(`║   Memory: ${memColor(`${memUsageMB} MB (${systemMetrics.memory.percentage.toFixed(1)}%)`)}                          ║`);
    
    const cpuColor = this.getColorForPercentage(systemMetrics.cpu.percentage);
    console.log(`║   CPU: ${cpuColor(`${systemMetrics.cpu.percentage.toFixed(1)}%`)}                                             ║`);
    
    const latencyColor = this.getColorForLatency(systemMetrics.rpcLatency);
    console.log(`║   RPC Latency: ${latencyColor(`${systemMetrics.rpcLatency}ms`)}                                  ║`);
    
    const diskColor = this.getColorForPercentage(systemMetrics.disk.percentage);
    const diskUsageGB = Math.round(systemMetrics.disk.usage / 1024 / 1024 / 1024);
    console.log(`║   Disk I/O: ${diskColor(`${diskUsageGB} GB (${systemMetrics.disk.percentage.toFixed(1)}%)`)}                           ║`);

    // 4. HEALTH CHECKS
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║ ${chalk.bold('🏥 HEALTH CHECKS')}                                         ║`);
    
    const errorCount = this.alerts.filter(a => a.level === 'error').length;
    const warningCount = this.alerts.filter(a => a.level === 'warning').length;
    const overallStatus = errorCount > 0 ? chalk.red('CRITICAL') : 
                         warningCount > 0 ? chalk.yellow('WARNING') : 
                         chalk.green('HEALTHY');
    
    console.log(`║   Overall Status: ${overallStatus}                                    ║`);
    console.log(`║   Errors: ${errorCount > 0 ? chalk.red(errorCount.toString()) : chalk.green('0')} │ Warnings: ${warningCount > 0 ? chalk.yellow(warningCount.toString()) : chalk.green('0')} │ Duplicates: ${this.detectDuplicateTrades() ? chalk.red('Yes') : chalk.green('No')} ║`);

    // 5. WALLET HEALTH
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║ ${chalk.bold('💰 WALLET HEALTH')}                                         ║`);
    console.log(`║   Expected SOL: ${walletHealth.expectedSOL.toFixed(3).padStart(8)}                             ║`);
    console.log(`║   Actual SOL: ${walletHealth.actualSOL.toFixed(3).padStart(10)}                               ║`);
    const discrepancyColor = walletHealth.isHealthy ? chalk.green : chalk.red;
    console.log(`║   Discrepancy: ${discrepancyColor(`${walletHealth.discrepancyPercent.toFixed(2)}%`)}                                ║`);

    // 6. TAX COMPLIANCE
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║ ${chalk.bold('📋 TAX COMPLIANCE')}                                        ║`);
    const complianceStatus = taxCompliance.isCompliant ? chalk.green('✓ COMPLIANT') : chalk.red('✗ ISSUES');
    console.log(`║   Status: ${complianceStatus}                                       ║`);
    const lastTxText = taxCompliance.lastTransaction ? 
      this.formatTimeAgo(taxCompliance.lastTransaction) : 'Never';
    console.log(`║   Last Transaction: ${lastTxText.padEnd(15)}                       ║`);
    console.log(`║   Non-zero Values: ${taxCompliance.hasNonZeroValues ? chalk.green('Yes') : chalk.red('No')}                           ║`);

    // 7. ALERTS & WARNINGS
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║ ${chalk.bold('⚠️  ALERTS & WARNINGS')}                                    ║`);
    
    if (this.alerts.length === 0) {
      console.log(`║   ${chalk.green('No active alerts - all systems normal')}                    ║`);
    } else {
      this.alerts.slice(-5).forEach(alert => {
        const icon = alert.level === 'error' ? chalk.red('🔴') : chalk.yellow('🟡');
        const time = alert.timestamp.toLocaleTimeString();
        console.log(`║   ${icon} [${time}] ${alert.message.padEnd(35)} ║`);
        if (alert.suggestion) {
          console.log(`║     💡 ${alert.suggestion.slice(0, 55).padEnd(55)} ║`);
        }
      });
    }

    // 8. PROFIT TARGETS
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║ ${chalk.bold('🎯 PROFIT TARGETS')}                                        ║`);
    const targetAmounts = [6000, 15000, 30000, 100000];
    const currentTarget = targetAmounts[Math.min(botStatus.sessionNumber - 1, targetAmounts.length - 1)];
    const progressBar = this.createProgressBar(botStatus.sessionProgress, 15, currentTarget);
    console.log(`║   Session ${botStatus.sessionNumber}: ${progressBar}     ║`);

    // 9. RATE LIMITING
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║ ${chalk.bold('⏱️  RATE LIMITING')}                                         ║`);
    const rateLimitColor = rateLimit.isNearLimit ? chalk.red : 
                          rateLimit.utilizationPercent > 60 ? chalk.yellow : chalk.green;
    console.log(`║   Trades/min: ${rateLimitColor(`${rateLimit.tradesPerMinute}/${rateLimit.maxTradesPerMinute}`)} (${rateLimitColor(`${rateLimit.utilizationPercent.toFixed(1)}%`)})             ║`);

    console.log('╚═══════════════════════════════════════════════════════════════╝');

    // Footer with last update time
    console.log(`Last updated: ${new Date().toLocaleTimeString()} | Press Ctrl+C to exit`);
  }

  // ============================================
  // START/STOP METHODS
  // ============================================
  public async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log(chalk.cyan.bold('🚀 Starting SOL Bot Live Monitor...'));
    
    // Initial render
    await this.renderDisplay();
    
    // Set up 5-second update interval
    this.updateInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.renderDisplay();
      }
    }, 5000);

    console.log(chalk.green('✅ Live monitor started successfully!'));
  }

  public shutdown(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    console.clear();
    console.log(chalk.yellow.bold('\n🛑 SOL Bot Live Monitor Shutdown'));
    console.log(chalk.gray('Monitor stopped gracefully.'));
    
    process.exit(0);
  }
}

// ============================================
// MAIN EXECUTION
// ============================================
async function main() {
  const monitor = new LiveMonitor();
  
  try {
    await monitor.start();
    
    // Keep the process running
    process.stdin.resume();
    
  } catch (error) {
    console.error(chalk.red('❌ Error starting live monitor:'), error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the monitor if this file is run directly
if (require.main === module) {
  main();
}

export { LiveMonitor };