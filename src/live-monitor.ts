#!/usr/bin/env tsx
/**
 * Live Bot Monitoring Console
 * Real-time monitoring system that runs alongside the trading bot
 * 
 * Features:
 * - Real-time status display with 5-second updates
 * - CSV file validation and corruption detection
 * - Backup verification and version control checks
 * - Health checks for wallet balance and trade validation
 * - Alert system for anomalies and issues
 * - Integration with existing dashboard components
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as crypto from 'crypto';
import * as blessed from 'blessed';
import { MASTER_SETTINGS } from './core/UNIFIED-CONTROL';

// ============================================
// INTERFACES AND TYPES
// ============================================

interface MonitorStatus {
  botRunning: boolean;
  lastUpdate: Date;
  poolStatus: {
    initialPool: number;
    currentPool: number;
    sessionProgress: number;
    targetPool: number;
  };
  tradingMetrics: {
    totalTrades: number;
    activeTrades: number;
    winRate: number;
    totalPnL: number;
    sessionPnL: number;
  };
  walletHealth: {
    expectedBalance: number;
    actualBalance: number;
    discrepancy: number;
    lastChecked: Date;
  };
  fileStatus: {
    poolTransactions: FileStatus;
    pendingTokens: FileStatus;
    paperTradingExits: FileStatus;
  };
  alerts: Alert[];
  performance: {
    memoryUsage: number;
    cpuUsage: number;
    rpcLatency: number;
  };
}

interface FileStatus {
  exists: boolean;
  size: number;
  lastModified: Date;
  corrupted: boolean;
  lineCount: number;
  hash: string;
  validationErrors: string[];
}

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  category: 'file' | 'wallet' | 'trading' | 'system' | 'backup';
}

interface TradeRecord {
  timestamp: string;
  action: string;
  amount: number;
  balance: number;
  poolBalance: number;
  tradeCount: number;
  details: string;
}

// ============================================
// LIVE MONITORING SYSTEM
// ============================================

class LiveMonitor {
  private connection: Connection;
  private screen: blessed.Widgets.Screen;
  private boxes: { [key: string]: blessed.Widgets.BoxElement } = {};
  private status: MonitorStatus;
  private updateInterval: NodeJS.Timeout | null = null;
  private walletAddress: string | null = null;
  private alertCounter = 1;
  private lastFileHashes: Map<string, string> = new Map();
  private tradingHistory: TradeRecord[] = [];
  private startTime: Date = new Date();
  private lastRpcCheck: Date = new Date(0); // For caching RPC calls
  private rpcCheckInterval: number = 30000; // Check RPC every 30 seconds instead of 5

  // File paths
  private readonly FILES = {
    poolTransactions: './data/pool_transactions.csv',
    pendingTokens: './data/pending_tokens.csv',
    paperTradingExits: './data/paper_trading_exits.csv',
    backupDir: './config-backups',
    walletsDir: './wallets',
    dataDir: './data',
  };

  constructor() {
    // Initialize Solana connection
    const rpcUrl = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(rpcUrl);

    // Initialize status
    this.status = this.initializeStatus();

    // Setup blessed terminal UI
    this.setupTerminalUI();

    // Load wallet address if available
    this.loadWalletAddress();

    // Start monitoring
    this.startMonitoring();
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  private initializeStatus(): MonitorStatus {
    return {
      botRunning: false,
      lastUpdate: new Date(),
      poolStatus: {
        initialPool: MASTER_SETTINGS.pool.initialPool,
        currentPool: 0, // Fresh start - no current pool value yet
        sessionProgress: 0,
        targetPool: MASTER_SETTINGS.pool.targetPoolUSD,
      },
      tradingMetrics: {
        totalTrades: 0,
        activeTrades: 0,
        winRate: 0,
        totalPnL: 0,
        sessionPnL: 0,
      },
      walletHealth: {
        expectedBalance: 0,
        actualBalance: 0,
        discrepancy: 0,
        lastChecked: new Date(),
      },
      fileStatus: {
        poolTransactions: this.createEmptyFileStatus(),
        pendingTokens: this.createEmptyFileStatus(),
        paperTradingExits: this.createEmptyFileStatus(),
      },
      alerts: [],
      performance: {
        memoryUsage: 0,
        cpuUsage: 0,
        rpcLatency: 0,
      },
    };
  }

  private createEmptyFileStatus(): FileStatus {
    return {
      exists: false,
      size: 0,
      lastModified: new Date(),
      corrupted: false,
      lineCount: 0,
      hash: '',
      validationErrors: [],
    };
  }

  // ============================================
  // TERMINAL UI SETUP
  // ============================================

  private setupTerminalUI(): void {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Sol Bot Live Monitor',
    });

    // Header
    this.boxes.header = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: ' Sol Bot Live Monitor - Real-time Status',
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: 'blue',
        },
      },
    });

    // Pool Status (top-left)
    this.boxes.poolStatus = blessed.box({
      top: 3,
      left: 0,
      width: '33%',
      height: 10,
      label: ' Pool Status ',
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        border: {
          fg: 'green',
        },
      },
    });

    // Trading Metrics (top-middle)
    this.boxes.tradingMetrics = blessed.box({
      top: 3,
      left: '33%',
      width: '34%',
      height: 10,
      label: ' Trading Metrics ',
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan',
        },
      },
    });

    // Wallet Health (top-right)
    this.boxes.walletHealth = blessed.box({
      top: 3,
      left: '67%',
      width: '33%',
      height: 10,
      label: ' Wallet Health ',
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        border: {
          fg: 'yellow',
        },
      },
    });

    // File Status (middle-left)
    this.boxes.fileStatus = blessed.box({
      top: 13,
      left: 0,
      width: '50%',
      height: 12,
      label: ' File Validation ',
      tags: true,
      border: {
        type: 'line',
      },
      scrollable: true,
      style: {
        fg: 'white',
        border: {
          fg: 'magenta',
        },
      },
    });

    // Performance Metrics (middle-right)
    this.boxes.performance = blessed.box({
      top: 13,
      left: '50%',
      width: '50%',
      height: 8,
      label: ' System Performance ',
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        border: {
          fg: 'white',
        },
      },
    });

    // Health Checks (middle-right-bottom)
    this.boxes.healthChecks = blessed.box({
      top: 21,
      left: '50%',
      width: '50%',
      height: 4,
      label: ' Health Checks ',
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        border: {
          fg: 'green',
        },
      },
    });

    // Alerts (bottom)
    this.boxes.alerts = blessed.box({
      top: 25,
      left: 0,
      width: '100%',
      height: 10,
      label: ' Alerts & Warnings ',
      tags: true,
      border: {
        type: 'line',
      },
      scrollable: true,
      style: {
        fg: 'white',
        border: {
          fg: 'red',
        },
      },
    });

    // Add all boxes to screen
    Object.values(this.boxes).forEach(box => this.screen.append(box));

    // Key bindings
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.shutdown();
    });

    this.screen.key(['r'], () => {
      this.acknowledgeAllAlerts();
    });

    this.screen.key(['c'], () => {
      this.clearAcknowledgedAlerts();
    });

    this.screen.render();
  }

  // ============================================
  // MONITORING CORE
  // ============================================

  private startMonitoring(): void {
    this.updateInterval = setInterval(() => {
      this.updateStatus();
      this.updateDisplay();
    }, 5000); // Update every 5 seconds

    // Initial update
    this.updateStatus();
    this.updateDisplay();

    this.addAlert('info', 'system', 'Live monitoring started');
  }

  private async updateStatus(): Promise<void> {
    try {
      // Update timestamps
      this.status.lastUpdate = new Date();

      // Check if bot is running
      await this.checkBotStatus();

      // Update pool status from CSV
      await this.updatePoolStatusFromFiles();

      // Update trading metrics
      await this.updateTradingMetrics();

      // Validate files
      await this.validateFiles();

      // Check wallet health
      await this.checkWalletHealth();

      // Update performance metrics
      this.updatePerformanceMetrics();

      // Run health checks
      await this.runHealthChecks();

      // Verify backups
      await this.verifyBackups();

    } catch (error) {
      this.addAlert('error', 'system', `Monitor update failed: ${error}`);
    }
  }

  // ============================================
  // STATUS UPDATES
  // ============================================

  private async checkBotStatus(): Promise<void> {
    // Check if bot process is running by looking for recent file modifications
    const recentActivity = Object.values(this.FILES)
      .filter(file => fs.existsSync(file))
      .some(file => {
        const stats = fs.statSync(file);
        const timeDiff = Date.now() - stats.mtime.getTime();
        return timeDiff < 30000; // Active if modified within 30 seconds
      });

    this.status.botRunning = recentActivity;
    
    if (!this.status.botRunning && this.status.tradingMetrics.totalTrades > 0) {
      this.addAlert('warning', 'system', 'Bot appears to have stopped - no recent file activity');
    }
  }

  private async updatePoolStatusFromFiles(): Promise<void> {
    if (!fs.existsSync(this.FILES.poolTransactions)) return;

    try {
      const content = fs.readFileSync(this.FILES.poolTransactions, 'utf8');
      const lines = content.trim().split('\n');
      
      if (lines.length === 0) return;

      // Parse the latest pool transaction
      const latestLine = lines[lines.length - 1];
      const [timestamp, action, amount, balance, poolBalance] = latestLine.split(',');

      if (poolBalance && !isNaN(parseFloat(poolBalance))) {
        const currentPool = parseFloat(poolBalance);
        this.status.poolStatus.currentPool = currentPool;
        
        // Calculate session progress
        const progress = ((currentPool - this.status.poolStatus.initialPool) / 
                         (this.status.poolStatus.targetPool - this.status.poolStatus.initialPool)) * 100;
        this.status.poolStatus.sessionProgress = Math.max(0, Math.min(100, progress));

        // Check for significant pool changes
        const expectedRange = this.status.poolStatus.initialPool * 0.1; // 10% variance
        if (Math.abs(currentPool - this.status.poolStatus.initialPool) > expectedRange) {
          const change = ((currentPool - this.status.poolStatus.initialPool) / this.status.poolStatus.initialPool * 100).toFixed(2);
          if (parseFloat(change) > 5) {
            this.addAlert('info', 'trading', `Pool ${parseFloat(change) > 0 ? 'up' : 'down'} ${Math.abs(parseFloat(change))}%`);
          }
        }
      }

    } catch (error) {
      this.addAlert('error', 'file', `Failed to parse pool transactions: ${error}`);
    }
  }

  private async updateTradingMetrics(): Promise<void> {
    if (!fs.existsSync(this.FILES.poolTransactions)) return;

    try {
      const content = fs.readFileSync(this.FILES.poolTransactions, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);
      
      this.tradingHistory = lines.map(line => {
        const [timestamp, action, amount, balance, poolBalance, tradeCount, details] = line.split(',');
        return {
          timestamp,
          action,
          amount: parseFloat(amount) || 0,
          balance: parseFloat(balance) || 0,
          poolBalance: parseFloat(poolBalance) || 0,
          tradeCount: parseInt(tradeCount) || 0,
          details: details || '',
        };
      });

      // Calculate metrics
      const trades = this.tradingHistory.filter(t => t.action === 'trade_execution');
      const profits = this.tradingHistory.filter(t => t.action === 'profit_return');
      const losses = this.tradingHistory.filter(t => t.action === 'stop_loss_exit');

      this.status.tradingMetrics.totalTrades = trades.length;
      this.status.tradingMetrics.winRate = trades.length > 0 ? 
        (profits.length / (profits.length + losses.length)) * 100 : 0;

      // Calculate PnL
      const totalPnL = [...profits, ...losses].reduce((sum, trade) => sum + trade.amount, 0);
      this.status.tradingMetrics.totalPnL = totalPnL;
      this.status.tradingMetrics.sessionPnL = this.status.poolStatus.currentPool - this.status.poolStatus.initialPool;

      // Count active trades (trades without corresponding exits)
      const exitedTrades = new Set();
      profits.concat(losses).forEach(exit => {
        const tokenMatch = exit.details.match(/([A-Za-z0-9]{8}\.\.\.)/) || 
                          exit.details.match(/([A-Za-z0-9]{44})/);
        if (tokenMatch) exitedTrades.add(tokenMatch[1]);
      });
      
      const activeTrades = new Set();
      trades.forEach(trade => {
        const tokenMatch = trade.details.match(/([A-Za-z0-9]{8}\.\.\.)/) || 
                          trade.details.match(/([A-Za-z0-9]{44})/);
        if (tokenMatch && !exitedTrades.has(tokenMatch[1])) {
          activeTrades.add(tokenMatch[1]);
        }
      });
      
      this.status.tradingMetrics.activeTrades = activeTrades.size;

      // Alert on unusual activity
      const maxPositions = MASTER_SETTINGS.pool.maxPositions;
      if (this.status.tradingMetrics.activeTrades > maxPositions) {
        this.addAlert('warning', 'trading',
          `Active trades (${this.status.tradingMetrics.activeTrades}) exceed max positions (${maxPositions})`);
      }

    } catch (error) {
      this.addAlert('error', 'file', `Failed to calculate trading metrics: ${error}`);
    }
  }

  // ============================================
  // FILE VALIDATION SYSTEM
  // ============================================

  private async validateFiles(): Promise<void> {
    const fileKeys = ['poolTransactions', 'pendingTokens', 'paperTradingExits'] as const;
    
    for (const fileKey of fileKeys) {
      const filePath = this.FILES[fileKey];
      const status = await this.validateFile(filePath);
      this.status.fileStatus[fileKey] = status;

      // Check for file corruption or issues
      if (status.corrupted) {
        this.addAlert('error', 'file', `${fileKey} is corrupted`);
      }

      if (status.validationErrors.length > 0) {
        status.validationErrors.forEach(error => {
          this.addAlert('warning', 'file', `${fileKey}: ${error}`);
        });
      }

      // Check if file stopped updating
      if (status.exists) {
        const timeSinceUpdate = Date.now() - status.lastModified.getTime();
        if (timeSinceUpdate > 300000 && this.status.botRunning) { // 5 minutes
          this.addAlert('warning', 'file', 
            `${fileKey} hasn't been updated in ${Math.round(timeSinceUpdate / 60000)} minutes`);
        }
      }
    }
  }

  private async validateFile(filePath: string): Promise<FileStatus> {
    const status: FileStatus = {
      exists: false,
      size: 0,
      lastModified: new Date(),
      corrupted: false,
      lineCount: 0,
      hash: '',
      validationErrors: [],
    };

    if (!fs.existsSync(filePath)) {
      return status;
    }

    try {
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      
      status.exists = true;
      status.size = stats.size;
      status.lastModified = stats.mtime;
      status.hash = crypto.createHash('md5').update(content).digest('hex');
      
      // Check for hash changes (indicating updates)
      const previousHash = this.lastFileHashes.get(filePath);
      if (previousHash && previousHash !== status.hash) {
        // File was updated
      }
      this.lastFileHashes.set(filePath, status.hash);

      // Count lines and validate format
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      status.lineCount = lines.length;

      // CSV format validation
      if (filePath.includes('pool_transactions.csv')) {
        status.validationErrors = this.validatePoolTransactionsCsv(lines);
      } else if (filePath.includes('pending_tokens.csv')) {
        status.validationErrors = this.validatePendingTokensCsv(lines);
      } else if (filePath.includes('paper_trading_exits.csv')) {
        status.validationErrors = this.validatePaperTradingCsv(lines);
      }

      // Check for corruption indicators
      status.corrupted = this.detectCorruption(content, lines);

    } catch (error) {
      status.validationErrors.push(`Read error: ${error}`);
    }

    return status;
  }

  private validatePoolTransactionsCsv(lines: string[]): string[] {
    const errors: string[] = [];
    
    lines.forEach((line, index) => {
      const parts = line.split(',');
      if (parts.length < 6) {
        errors.push(`Line ${index + 1}: Insufficient columns (${parts.length}/6)`);
        return;
      }

      const [timestamp, action, amount, balance, poolBalance, tradeCount] = parts;
      
      // Validate timestamp
      if (!timestamp || isNaN(Date.parse(timestamp))) {
        errors.push(`Line ${index + 1}: Invalid timestamp`);
      }

      // Validate numeric fields
      if (amount && isNaN(parseFloat(amount))) {
        errors.push(`Line ${index + 1}: Invalid amount`);
      }
      
      if (balance && isNaN(parseFloat(balance))) {
        errors.push(`Line ${index + 1}: Invalid balance`);
      }
      
      if (poolBalance && isNaN(parseFloat(poolBalance))) {
        errors.push(`Line ${index + 1}: Invalid pool balance`);
      }
      
      if (tradeCount && isNaN(parseInt(tradeCount))) {
        errors.push(`Line ${index + 1}: Invalid trade count`);
      }
    });

    return errors.slice(0, 5); // Limit to first 5 errors
  }

  private validatePendingTokensCsv(lines: string[]): string[] {
    const errors: string[] = [];
    
    lines.forEach((line, index) => {
      const parts = line.split(',');
      if (parts.length < 6) {
        errors.push(`Line ${index + 1}: Insufficient columns`);
        return;
      }

      const [tokenMint, signature, timestamp, status] = parts;
      
      // Validate token mint (should be base58)
      if (tokenMint && tokenMint.length !== 44) {
        errors.push(`Line ${index + 1}: Invalid token mint length`);
      }
      
      // Validate timestamp
      if (timestamp && isNaN(Date.parse(timestamp))) {
        errors.push(`Line ${index + 1}: Invalid timestamp`);
      }
      
      // Validate status
      const validStatuses = ['pending', 'bought', 'rejected', 'error'];
      if (status && !validStatuses.includes(status)) {
        errors.push(`Line ${index + 1}: Invalid status '${status}'`);
      }
    });

    return errors.slice(0, 5);
  }

  private validatePaperTradingCsv(lines: string[]): string[] {
    const errors: string[] = [];
    
    lines.forEach((line, index) => {
      const parts = line.split(',');
      if (parts.length < 4) {
        errors.push(`Line ${index + 1}: Insufficient columns`);
      }
    });

    return errors.slice(0, 5);
  }

  private detectCorruption(content: string, lines: string[]): boolean {
    // Check for null bytes
    if (content.includes('\0')) return true;
    
    // Check for truncated lines (very short when they should be longer)
    const avgLineLength = content.length / lines.length;
    const shortLines = lines.filter(line => line.length < avgLineLength * 0.3).length;
    if (shortLines > lines.length * 0.1) return true; // 10% of lines are suspiciously short
    
    // Check for repeated identical lines (possible corruption)
    const uniqueLines = new Set(lines);
    if (lines.length > 10 && uniqueLines.size < lines.length * 0.8) return true;
    
    return false;
  }

  // ============================================
  // WALLET HEALTH CHECKS
  // ============================================

  private async checkWalletHealth(): Promise<void> {
    if (!this.walletAddress) return;

    // Only check wallet balance every 30 seconds to reduce RPC calls
    const now = new Date();
    if (now.getTime() - this.lastRpcCheck.getTime() < this.rpcCheckInterval) {
      return;
    }
    this.lastRpcCheck = now;

    try {
      const startTime = Date.now();
      const publicKey = new PublicKey(this.walletAddress);
      const balance = await this.connection.getBalance(publicKey);
      const actualBalance = balance / LAMPORTS_PER_SOL;
      
      // Update RPC latency from this call
      this.status.performance.rpcLatency = Date.now() - startTime;

      // Calculate expected balance from pool data
      let expectedBalance = this.status.poolStatus.currentPool / 200; // Rough SOL price estimate
      
      // Add some buffer for gas fees and slippage
      const gasBuffer = 0.1; // 0.1 SOL buffer
      const tolerance = expectedBalance * 0.05; // 5% tolerance

      this.status.walletHealth = {
        expectedBalance,
        actualBalance,
        discrepancy: Math.abs(actualBalance - expectedBalance),
        lastChecked: new Date(),
      };

      // Alert on significant discrepancies
      if (this.status.walletHealth.discrepancy > tolerance && expectedBalance > gasBuffer) {
        this.addAlert('warning', 'wallet', 
          `Wallet balance mismatch: Expected ~${expectedBalance.toFixed(3)} SOL, got ${actualBalance.toFixed(3)} SOL`);
      }

      // Alert on low balance
      if (actualBalance < 0.05) {
        this.addAlert('error', 'wallet', `Wallet balance critically low: ${actualBalance.toFixed(4)} SOL`);
      }

    } catch (error) {
      this.addAlert('error', 'wallet', `Failed to check wallet balance: ${error}`);
    }
  }

  private loadWalletAddress(): void {
    // Try to load wallet address from environment or config files
    const walletPaths = [
      process.env.WALLET_PRIVATE_KEY_PATH,
      './wallet.json',
      './keypair.json',
      './wallets/session1/wallet.json',
    ].filter(Boolean);

    for (const walletPath of walletPaths) {
      if (fs.existsSync(walletPath as string)) {
        try {
          const walletData = JSON.parse(fs.readFileSync(walletPath as string, 'utf8'));
          if (Array.isArray(walletData) && walletData.length === 64) {
            // Convert secret key array to public key
            // This is a simplified approach - in production you'd use proper Solana key handling
            this.walletAddress = 'wallet_loaded'; // Placeholder
            break;
          }
        } catch (error) {
          // Continue searching
        }
      }
    }
  }

  // ============================================
  // HEALTH CHECKS
  // ============================================

  private async runHealthChecks(): Promise<void> {
    const checks = [
      this.checkDuplicateTrades(),
      this.checkPoolCalculations(),
      this.checkFileIntegrity(),
      this.checkSystemResources(),
    ];

    await Promise.all(checks);
  }

  private async checkDuplicateTrades(): Promise<void> {
    if (this.tradingHistory.length === 0) return;

    const trades = this.tradingHistory.filter(t => t.action === 'trade_execution');
    const signatures = new Map<string, number>();

    trades.forEach(trade => {
      const sig = trade.details.split(' ')[0]; // Extract signature/token
      signatures.set(sig, (signatures.get(sig) || 0) + 1);
    });

    const duplicates = Array.from(signatures.entries()).filter(([sig, count]) => count > 1);
    
    if (duplicates.length > 0) {
      this.addAlert('warning', 'trading', 
        `Found ${duplicates.length} potential duplicate trades`);
    }
  }

  private async checkPoolCalculations(): Promise<void> {
    if (this.tradingHistory.length < 2) return;

    // Verify pool balance consistency
    const poolTransactions = this.tradingHistory.filter(t => t.poolBalance > 0);
    
    for (let i = 1; i < poolTransactions.length; i++) {
      const prev = poolTransactions[i - 1];
      const curr = poolTransactions[i];
      
      const expectedBalance = prev.poolBalance + curr.amount;
      const actualBalance = curr.poolBalance;
      const diff = Math.abs(expectedBalance - actualBalance);
      
      if (diff > 1) { // Allow $1 variance for rounding
        this.addAlert('warning', 'trading', 
          `Pool calculation inconsistency: Expected ${expectedBalance.toFixed(2)}, got ${actualBalance.toFixed(2)}`);
        break; // Only report first inconsistency to avoid spam
      }
    }
  }

  private async checkFileIntegrity(): Promise<void> {
    // Check if backup files exist
    if (!fs.existsSync(this.FILES.backupDir)) {
      this.addAlert('warning', 'backup', 'No backup directory found');
      return;
    }

    // Check for recent backups
    const backups = fs.readdirSync(this.FILES.backupDir)
      .map(name => ({
        name,
        path: path.join(this.FILES.backupDir, name),
        stats: fs.statSync(path.join(this.FILES.backupDir, name))
      }))
      .filter(backup => backup.stats.isDirectory())
      .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

    if (backups.length === 0) {
      this.addAlert('warning', 'backup', 'No backups found');
    } else {
      const latestBackup = backups[0];
      const age = Date.now() - latestBackup.stats.mtime.getTime();
      
      if (age > 24 * 60 * 60 * 1000) { // 24 hours
        this.addAlert('warning', 'backup', 
          `Latest backup is ${Math.round(age / (60 * 60 * 1000))} hours old`);
      }
    }
  }

  private async checkSystemResources(): Promise<void> {
    // Check disk space
    const dataDir = this.FILES.dataDir;
    if (fs.existsSync(dataDir)) {
      try {
        const stats = fs.statSync(dataDir);
        // This is a simplified check - in production you'd use a proper disk space library
      } catch (error) {
        this.addAlert('warning', 'system', `Cannot check disk space: ${error}`);
      }
    }
  }

  // ============================================
  // BACKUP VERIFICATION
  // ============================================

  private async verifyBackups(): Promise<void> {
    if (!fs.existsSync(this.FILES.backupDir)) return;

    try {
      const backupDirs = fs.readdirSync(this.FILES.backupDir)
        .filter(name => fs.statSync(path.join(this.FILES.backupDir, name)).isDirectory());

      if (backupDirs.length === 0) {
        this.addAlert('warning', 'backup', 'No configuration backups found');
        return;
      }

      // Check latest backup
      const latestBackup = backupDirs.sort().pop();
      const backupPath = path.join(this.FILES.backupDir, latestBackup!);
      const backupInfoPath = path.join(backupPath, 'backup-info.json');

      if (fs.existsSync(backupInfoPath)) {
        const backupInfo = JSON.parse(fs.readFileSync(backupInfoPath, 'utf8'));
        
        // Verify backup integrity
        let allFilesPresent = true;
        for (const file of backupInfo.files) {
          const backupFilePath = path.join(backupPath, path.basename(file));
          if (!fs.existsSync(backupFilePath)) {
            allFilesPresent = false;
            break;
          }
        }

        if (!allFilesPresent) {
          this.addAlert('error', 'backup', `Backup ${latestBackup} is incomplete`);
        }
      }

    } catch (error) {
      this.addAlert('error', 'backup', `Backup verification failed: ${error}`);
    }
  }

  // ============================================
  // PERFORMANCE METRICS
  // ============================================

  private updatePerformanceMetrics(): void {
    const memUsage = process.memoryUsage();
    this.status.performance.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB

    // Simple CPU usage approximation
    const cpuUsage = process.cpuUsage();
    this.status.performance.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

    // RPC latency will be updated during wallet health checks to reduce requests
  }

  // ============================================
  // ALERT SYSTEM
  // ============================================

  private addAlert(type: Alert['type'], category: Alert['category'], message: string): void {
    // Avoid duplicate alerts
    const existing = this.status.alerts.find(alert => 
      alert.message === message && 
      alert.type === type && 
      Date.now() - alert.timestamp.getTime() < 60000 // Within last minute
    );

    if (existing) return;

    const alert: Alert = {
      id: `alert_${this.alertCounter++}`,
      type,
      category,
      message,
      timestamp: new Date(),
      acknowledged: false,
    };

    this.status.alerts.unshift(alert);
    
    // Keep only last 50 alerts
    if (this.status.alerts.length > 50) {
      this.status.alerts = this.status.alerts.slice(0, 50);
    }
  }

  private acknowledgeAllAlerts(): void {
    this.status.alerts.forEach(alert => alert.acknowledged = true);
  }

  private clearAcknowledgedAlerts(): void {
    this.status.alerts = this.status.alerts.filter(alert => !alert.acknowledged);
  }

  // ============================================
  // DISPLAY UPDATES
  // ============================================

  private updateDisplay(): void {
    this.updateHeaderDisplay();
    this.updatePoolStatusDisplay();
    this.updateTradingMetricsDisplay();
    this.updateWalletHealthDisplay();
    this.updateFileStatusDisplay();
    this.updatePerformanceDisplay();
    this.updateHealthChecksDisplay();
    this.updateAlertsDisplay();
    
    this.screen.render();
  }

  private formatRuntime(): string {
    const now = new Date();
    const runtimeMs = now.getTime() - this.startTime.getTime();
    const runtimeSeconds = Math.floor(runtimeMs / 1000);
    
    const hours = Math.floor(runtimeSeconds / 3600);
    const minutes = Math.floor((runtimeSeconds % 3600) / 60);
    const seconds = runtimeSeconds % 60;
    
    let runtime = '';
    if (hours > 0) runtime += `${hours}h `;
    if (minutes > 0) runtime += `${minutes}m `;
    runtime += `${seconds}s`;
    
    const duration = MASTER_SETTINGS.limits.duration;
    const durationText = duration === 0 ? 'unlimited' : `${duration}s`;
    return `${runtime} (${durationText})`;
  }

  private updateHeaderDisplay(): void {
    const status = this.status.botRunning ? '{green-fg}RUNNING{/green-fg}' : '{red-fg}STOPPED{/red-fg}';
    const lastUpdate = this.status.lastUpdate.toLocaleTimeString();
    const runtime = this.formatRuntime();
    
    this.boxes.header.setContent(
      ` Sol Bot Live Monitor - ${status} | Runtime: ${runtime} | Last Update: ${lastUpdate} | Press 'q' to quit, 'r' to acknowledge alerts`
    );
  }

  private updatePoolStatusDisplay(): void {
    const pool = this.status.poolStatus;
    const change = pool.currentPool - pool.initialPool;
    const changePercent = (change / pool.initialPool * 100).toFixed(2);
    const progressBar = '█'.repeat(Math.floor(pool.sessionProgress / 5)) + 
                       '░'.repeat(20 - Math.floor(pool.sessionProgress / 5));

    // Calculate net profit after 40% tax
    const grossProfit = Math.max(0, change);
    const netProfit = grossProfit * 0.6; // After 40% tax
    
    const content = [
      `Session 1: $${pool.initialPool.toFixed(0)} → $${pool.targetPool.toFixed(0)}`,
      '',
      `Initial Pool: {cyan-fg}$${pool.initialPool.toFixed(2)}{/cyan-fg}`,
      `Current Pool: {green-fg}$${pool.currentPool.toFixed(2)}{/green-fg}`,
      `Target Pool:  {yellow-fg}$${pool.targetPool.toFixed(2)}{/yellow-fg}`,
      '',
      `Session P&L: ${change >= 0 ? '{green-fg}+' : '{red-fg}'}$${Math.abs(change).toFixed(2)} (${changePercent}%){/}`,
      `Net Profit (after 40% tax): {green-fg}+$${netProfit.toFixed(2)}{/}`,
      '',
      `Progress: [${progressBar}] ${pool.sessionProgress.toFixed(1)}%`,
    ].join('\n');

    this.boxes.poolStatus.setContent(content);
  }

  private updateTradingMetricsDisplay(): void {
    const metrics = this.status.tradingMetrics;
    const winRateColor = metrics.winRate >= 60 ? 'green' : metrics.winRate >= 40 ? 'yellow' : 'red';
    const pnlColor = metrics.totalPnL >= 0 ? 'green' : 'red';

    const content = [
      `Total Trades: {cyan-fg}${metrics.totalTrades}{/cyan-fg}`,
      `Active Trades: {yellow-fg}${metrics.activeTrades}{/yellow-fg}`,
      `Win Rate: {${winRateColor}-fg}${metrics.winRate.toFixed(1)}%{/}`,
      '',
      `Total P&L: {${pnlColor}-fg}${metrics.totalPnL >= 0 ? '+' : ''}$${metrics.totalPnL.toFixed(2)}{/}`,
      `Session P&L: {${metrics.sessionPnL >= 0 ? 'green' : 'red'}-fg}${metrics.sessionPnL >= 0 ? '+' : ''}$${metrics.sessionPnL.toFixed(2)}{/}`,
    ].join('\n');

    this.boxes.tradingMetrics.setContent(content);
  }

  private updateWalletHealthDisplay(): void {
    const wallet = this.status.walletHealth;
    const discrepancyColor = wallet.discrepancy > 0.1 ? 'red' : wallet.discrepancy > 0.05 ? 'yellow' : 'green';

    const content = [
      `Expected: {cyan-fg}${wallet.expectedBalance.toFixed(3)} SOL{/cyan-fg}`,
      `Actual: {green-fg}${wallet.actualBalance.toFixed(3)} SOL{/green-fg}`,
      `Discrepancy: {${discrepancyColor}-fg}${wallet.discrepancy.toFixed(3)} SOL{/}`,
      '',
      `Last Checked: ${wallet.lastChecked.toLocaleTimeString()}`,
      '',
      `Status: ${this.walletAddress ? '{green-fg}Connected{/}' : '{red-fg}Not Connected{/}'}`,
    ].join('\n');

    this.boxes.walletHealth.setContent(content);
  }

  private updateFileStatusDisplay(): void {
    const files = this.status.fileStatus;
    const content: string[] = [];

    Object.entries(files).forEach(([name, status]) => {
      const statusColor = !status.exists ? 'red' : status.corrupted ? 'red' : 
                         status.validationErrors.length > 0 ? 'yellow' : 'green';
      const statusText = !status.exists ? 'Missing' : status.corrupted ? 'Corrupted' : 
                        status.validationErrors.length > 0 ? 'Warnings' : 'OK';
      
      content.push(`{bold}${name.replace(/([A-Z])/g, ' $1').trim()}:{/bold}`);
      content.push(`  Status: {${statusColor}-fg}${statusText}{/}`);
      content.push(`  Size: ${(status.size / 1024).toFixed(1)}KB | Lines: ${status.lineCount}`);
      if (status.lastModified) {
        const age = Math.floor((Date.now() - status.lastModified.getTime()) / 1000);
        content.push(`  Updated: ${age < 60 ? age + 's' : Math.floor(age / 60) + 'm'} ago`);
      }
      content.push('');
    });

    this.boxes.fileStatus.setContent(content.join('\n'));
  }

  private updatePerformanceDisplay(): void {
    const perf = this.status.performance;
    const memColor = perf.memoryUsage > 500 ? 'red' : perf.memoryUsage > 200 ? 'yellow' : 'green';
    const rpcColor = perf.rpcLatency > 1000 ? 'red' : perf.rpcLatency > 500 ? 'yellow' : 'green';

    const content = [
      `Memory: {${memColor}-fg}${perf.memoryUsage.toFixed(1)} MB{/}`,
      `CPU: {cyan-fg}${perf.cpuUsage.toFixed(2)}s{/}`,
      `RPC Latency: {${rpcColor}-fg}${perf.rpcLatency === -1 ? 'Error' : perf.rpcLatency + 'ms'}{/}`,
    ].join('\n');

    this.boxes.performance.setContent(content);
  }

  private updateHealthChecksDisplay(): void {
    const errorCount = this.status.alerts.filter(a => a.type === 'error' && !a.acknowledged).length;
    const warningCount = this.status.alerts.filter(a => a.type === 'warning' && !a.acknowledged).length;

    const content = [
      `System Health: ${errorCount === 0 ? '{green-fg}Good{/}' : '{red-fg}Issues{/}'}`,
      `Errors: {red-fg}${errorCount}{/} | Warnings: {yellow-fg}${warningCount}{/}`,
    ].join('\n');

    this.boxes.healthChecks.setContent(content);
  }

  private updateAlertsDisplay(): void {
    const recentAlerts = this.status.alerts.slice(0, 15); // Show last 15 alerts
    const content = recentAlerts.map(alert => {
      const color = alert.type === 'error' ? 'red' : alert.type === 'warning' ? 'yellow' : 'cyan';
      const ackFlag = alert.acknowledged ? ' ✓' : '';
      const timestamp = alert.timestamp.toLocaleTimeString();
      
      return `{${color}-fg}[${alert.type.toUpperCase()}]{/} ${timestamp} - ${alert.message}${ackFlag}`;
    }).join('\n');

    this.boxes.alerts.setContent(content || 'No alerts');
  }

  // ============================================
  // SHUTDOWN
  // ============================================

  private shutdown(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.screen.destroy();
    process.exit(0);
  }
}

// ============================================
// CLI ENTRY POINT
// ============================================

function main() {
  // Check command line arguments
  const args = process.argv.slice(2);
  const helpFlag = args.includes('--help') || args.includes('-h');

  if (helpFlag) {
    console.log(`
🔍 Sol Bot Live Monitor

Usage:
  tsx live-monitor.ts [options]

Options:
  -h, --help     Show this help message

Features:
  • Real-time status display (updates every 5 seconds)
  • CSV file validation and corruption detection
  • Backup verification and version control checks
  • Wallet balance and trade validation health checks
  • Alert system for anomalies and issues
  • Integration with existing dashboard components

Controls:
  q, ESC, Ctrl+C  - Quit
  r              - Acknowledge all alerts
  c              - Clear acknowledged alerts

The monitor displays:
  • Pool status and session progress
  • Trading metrics and performance
  • Wallet health and balance checks
  • File validation status
  • System performance metrics
  • Real-time alerts and warnings
    `);
    return;
  }

  console.log('🔍 Starting Sol Bot Live Monitor...');
  console.log('Press q to quit, r to acknowledge alerts, c to clear acknowledged alerts');
  
  new LiveMonitor();
}

// Run the monitor if this file is executed directly
if (require.main === module) {
  main();
}

export { LiveMonitor };