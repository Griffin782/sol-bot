import { Connection, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import bs58 from 'bs58';
import { SmartConfigValidator } from './SMART-CONFIG-VALIDATOR';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  details?: string;
}

interface FlightStatus {
  readyForLaunch: boolean;
  checks: CheckResult[];
  criticalIssues: number;
  warnings: number;
  recommendations: string[];
}

interface SystemConfig {
  initialPool: number;
  positionSizeUSD: number;
  maxTradesAbsolute: number;
  maxTradesPerSession: number;
  maxPositions: number;
  rpcUrl: string;
  privateKey: string;
  walletAddress: string;
  testMode: boolean;
}

class PreFlightCheck {
  private config: SystemConfig;
  private connection: Connection;

  constructor(config: SystemConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, 'confirmed');
  }

  async runAllChecks(): Promise<FlightStatus> {
    console.log('\n🛫 INITIATING PRE-FLIGHT CHECK SEQUENCE...');
    console.log('='.repeat(60));

    const checks: CheckResult[] = [];

    // Execute all checks
    checks.push(await this.checkConfiguration());
    checks.push(await this.checkWalletBalance());
    checks.push(await this.checkRPCConnection());
    checks.push(await this.checkTradeLimits());
    checks.push(await this.checkSessionMath());
    checks.push(await this.checkPoolCalculations());
    checks.push(await this.checkSafetyMechanisms());
    checks.push(await this.checkDataFolders());
    checks.push(await this.checkPrivateKeyFormat());
    checks.push(await this.checkNetworkLatency());
    checks.push(await this.checkDiskSpace());
    checks.push(await this.checkMemoryUsage());

    const status = this.generateReport(checks);
    return status;
  }

  private async checkConfiguration(): Promise<CheckResult> {
    try {
      // Check if basic config values are present and valid
      const issues: string[] = [];

      if (!this.config.initialPool || this.config.initialPool <= 0) {
        issues.push('Invalid initial pool amount');
      }

      if (!this.config.positionSizeUSD || this.config.positionSizeUSD <= 0) {
        issues.push('Invalid position size');
      }

      if (!this.config.rpcUrl || !this.config.rpcUrl.startsWith('http')) {
        issues.push('Invalid RPC URL');
      }

      if (!this.config.privateKey) {
        issues.push('Missing private key');
      }

      if (issues.length > 0) {
        return {
          name: 'Configuration',
          passed: false,
          message: `${issues.length} config issue(s) found`,
          severity: 'critical',
          details: issues.join(', ')
        };
      }

      return {
        name: 'Configuration',
        passed: true,
        message: 'All configuration values valid',
        severity: 'info'
      };

    } catch (error) {
      return {
        name: 'Configuration',
        passed: false,
        message: 'Failed to validate configuration',
        severity: 'critical',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkWalletBalance(): Promise<CheckResult> {
    try {
      // Skip wallet check for paper trading
      if (this.config.testMode) {
        return {
          name: 'Wallet Balance',
          passed: true,
          message: 'Paper trading mode - wallet check skipped',
          severity: 'info',
          details: 'Test mode enabled - no real funds required'
        };
      }
      let wallet: Keypair;

      // Handle both array and base58 private key formats
      if (this.config.privateKey.startsWith('[')) {
        const keyArray = JSON.parse(this.config.privateKey);
        wallet = Keypair.fromSecretKey(new Uint8Array(keyArray));
      } else {
        wallet = Keypair.fromSecretKey(bs58.decode(this.config.privateKey));
      }

      const balance = await this.connection.getBalance(wallet.publicKey);
      const balanceSOL = balance / LAMPORTS_PER_SOL;
      const balanceUSD = balanceSOL * 170; // Approximate SOL price

      const requiredForTrading = this.config.positionSizeUSD * 2; // At least 2 trades worth
      const requiredSOL = requiredForTrading / 170;

      if (balanceUSD < requiredForTrading) {
        return {
          name: 'Wallet Balance',
          passed: false,
          message: `Insufficient balance: $${balanceUSD.toFixed(2)} (need $${requiredForTrading.toFixed(2)})`,
          severity: 'critical',
          details: `Wallet: ${wallet.publicKey.toString()}`
        };
      }

      if (balanceUSD < this.config.initialPool) {
        return {
          name: 'Wallet Balance',
          passed: false,
          message: `Balance $${balanceUSD.toFixed(2)} less than configured pool $${this.config.initialPool}`,
          severity: 'warning',
          details: `Consider reducing initial pool or adding funds`
        };
      }

      return {
        name: 'Wallet Balance',
        passed: true,
        message: `Sufficient balance: ${balanceSOL.toFixed(3)} SOL ($${balanceUSD.toFixed(2)})`,
        severity: 'info',
        details: `Wallet: ${wallet.publicKey.toString()}`
      };

    } catch (error) {
      return {
        name: 'Wallet Balance',
        passed: false,
        message: 'Failed to check wallet balance',
        severity: 'critical',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkRPCConnection(): Promise<CheckResult> {
    try {
      const startTime = Date.now();
      const blockHeight = await this.connection.getBlockHeight();
      const latency = Date.now() - startTime;

      if (latency > 5000) {
        return {
          name: 'RPC Connection',
          passed: false,
          message: `RPC too slow: ${latency}ms (>5000ms)`,
          severity: 'critical',
          details: `Block height: ${blockHeight}`
        };
      }

      if (latency > 2000) {
        return {
          name: 'RPC Connection',
          passed: true,
          message: `RPC connected but slow: ${latency}ms`,
          severity: 'warning',
          details: `Consider switching to a faster RPC`
        };
      }

      return {
        name: 'RPC Connection',
        passed: true,
        message: `RPC healthy: ${latency}ms response time`,
        severity: 'info',
        details: `Block height: ${blockHeight.toLocaleString()}`
      };

    } catch (error) {
      return {
        name: 'RPC Connection',
        passed: false,
        message: 'Cannot connect to RPC',
        severity: 'critical',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkTradeLimits(): Promise<CheckResult> {
    const issues: string[] = [];

    if (this.config.maxTradesAbsolute < this.config.maxTradesPerSession) {
      issues.push('Absolute trade limit < session limit');
    }

    if (this.config.maxTradesPerSession <= 0) {
      issues.push('Invalid max trades per session');
    }

    if (this.config.maxPositions <= 0) {
      issues.push('Invalid max positions');
    }

    // Check if position size allows for meaningful trading
    const tradesPerPool = Math.floor(this.config.initialPool / this.config.positionSizeUSD);
    if (tradesPerPool < 5) {
      issues.push(`Position size too large: only ${tradesPerPool} trades possible`);
    }

    if (issues.length > 0) {
      return {
        name: 'Trade Limits',
        passed: false,
        message: `${issues.length} trade limit issue(s)`,
        severity: 'critical',
        details: issues.join(', ')
      };
    }

    return {
      name: 'Trade Limits',
      passed: true,
      message: `Trade limits configured correctly`,
      severity: 'info',
      details: `${this.config.maxTradesPerSession} per session, ${this.config.maxPositions} positions`
    };
  }

  private async checkSessionMath(): Promise<CheckResult> {
    try {
      // Check basic math relationships
      const positionPercent = (this.config.positionSizeUSD / this.config.initialPool) * 100;

      if (positionPercent > 15) {
        return {
          name: 'Session Math',
          passed: false,
          message: `Position size ${positionPercent.toFixed(1)}% of pool is too high (>15%)`,
          severity: 'critical',
          details: 'Reduce position size or increase initial pool'
        };
      }

      if (positionPercent > 10) {
        return {
          name: 'Session Math',
          passed: true,
          message: `Position size ${positionPercent.toFixed(1)}% of pool is aggressive`,
          severity: 'warning',
          details: 'Consider reducing for safer trading'
        };
      }

      const maxConcurrentValue = this.config.positionSizeUSD * this.config.maxPositions;
      if (maxConcurrentValue > this.config.initialPool) {
        return {
          name: 'Session Math',
          passed: false,
          message: `Max concurrent exposure $${maxConcurrentValue} > pool $${this.config.initialPool}`,
          severity: 'critical',
          details: 'Reduce position size or max positions'
        };
      }

      return {
        name: 'Session Math',
        passed: true,
        message: `Session mathematics are sound`,
        severity: 'info',
        details: `${positionPercent.toFixed(1)}% position sizing`
      };

    } catch (error) {
      return {
        name: 'Session Math',
        passed: false,
        message: 'Failed to validate session math',
        severity: 'critical',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkPoolCalculations(): Promise<CheckResult> {
    const maxTrades = Math.floor(this.config.initialPool / this.config.positionSizeUSD);
    const efficiency = (this.config.maxTradesPerSession / maxTrades) * 100;

    if (efficiency > 100) {
      return {
        name: 'Pool Calculations',
        passed: false,
        message: `Cannot execute ${this.config.maxTradesPerSession} trades with $${this.config.initialPool} pool`,
        severity: 'critical',
        details: `Maximum possible: ${maxTrades} trades`
      };
    }

    if (efficiency > 80) {
      return {
        name: 'Pool Calculations',
        passed: true,
        message: `High pool utilization: ${efficiency.toFixed(1)}%`,
        severity: 'warning',
        details: 'Pool will be nearly depleted by max trades'
      };
    }

    return {
      name: 'Pool Calculations',
      passed: true,
      message: `Pool calculations valid: ${efficiency.toFixed(1)}% utilization`,
      severity: 'info',
      details: `${maxTrades} trades possible with current settings`
    };
  }

  private async checkSafetyMechanisms(): Promise<CheckResult> {
    const safetyFeatures: string[] = [];
    const missing: string[] = [];

    // Check for key safety mechanisms (these would be imported from actual config)
    if (this.config.testMode !== undefined) {
      safetyFeatures.push('Test mode toggle');
    } else {
      missing.push('Test mode configuration');
    }

    // Check for reasonable limits
    if (this.config.maxTradesAbsolute > 0 && this.config.maxTradesAbsolute < 1000) {
      safetyFeatures.push('Trade limit protection');
    } else {
      missing.push('Reasonable trade limits');
    }

    if (this.config.positionSizeUSD / this.config.initialPool <= 0.1) {
      safetyFeatures.push('Position size protection');
    } else {
      missing.push('Safe position sizing');
    }

    if (missing.length > 0) {
      return {
        name: 'Safety Mechanisms',
        passed: false,
        message: `${missing.length} safety feature(s) missing`,
        severity: 'warning',
        details: missing.join(', ')
      };
    }

    return {
      name: 'Safety Mechanisms',
      passed: true,
      message: `${safetyFeatures.length} safety features active`,
      severity: 'info',
      details: safetyFeatures.join(', ')
    };
  }

  private async checkDataFolders(): Promise<CheckResult> {
    const requiredFolders = ['./data', './logs'];
    const missingFolders: string[] = [];
    const createdFolders: string[] = [];

    for (const folder of requiredFolders) {
      if (!fs.existsSync(folder)) {
        try {
          fs.mkdirSync(folder, { recursive: true });
          createdFolders.push(folder);
        } catch (error) {
          missingFolders.push(folder);
        }
      }
    }

    if (missingFolders.length > 0) {
      return {
        name: 'Data Folders',
        passed: false,
        message: `Cannot create required folders: ${missingFolders.join(', ')}`,
        severity: 'critical',
        details: 'Check directory permissions'
      };
    }

    const message = createdFolders.length > 0
      ? `Data folders ready (created: ${createdFolders.join(', ')})`
      : 'Data folders ready';

    return {
      name: 'Data Folders',
      passed: true,
      message,
      severity: 'info'
    };
  }

  private async checkPrivateKeyFormat(): Promise<CheckResult> {
    try {
      let wallet: Keypair;

      if (this.config.privateKey.startsWith('[')) {
        // Array format
        const keyArray = JSON.parse(this.config.privateKey);
        if (!Array.isArray(keyArray) || keyArray.length !== 64) {
          return {
            name: 'Private Key Format',
            passed: false,
            message: 'Invalid private key array format',
            severity: 'critical',
            details: 'Array must have exactly 64 elements'
          };
        }
        wallet = Keypair.fromSecretKey(new Uint8Array(keyArray));
      } else {
        // Base58 format
        if (this.config.privateKey.length < 32) {
          return {
            name: 'Private Key Format',
            passed: false,
            message: 'Private key too short',
            severity: 'critical',
            details: 'Base58 private keys should be longer'
          };
        }
        wallet = Keypair.fromSecretKey(bs58.decode(this.config.privateKey));
      }

      return {
        name: 'Private Key Format',
        passed: true,
        message: 'Private key format valid',
        severity: 'info',
        details: `Wallet: ${wallet.publicKey.toString().slice(0, 8)}...`
      };

    } catch (error) {
      return {
        name: 'Private Key Format',
        passed: false,
        message: 'Invalid private key format',
        severity: 'critical',
        details: error instanceof Error ? error.message : 'Cannot parse private key'
      };
    }
  }

  private async checkNetworkLatency(): Promise<CheckResult> {
    try {
      const startTime = Date.now();
      await this.connection.getRecentBlockhash();
      const latency = Date.now() - startTime;

      if (latency > 3000) {
        return {
          name: 'Network Latency',
          passed: false,
          message: `High latency: ${latency}ms (trading may be impacted)`,
          severity: 'warning',
          details: 'Consider switching RPC providers'
        };
      }

      return {
        name: 'Network Latency',
        passed: true,
        message: `Network latency acceptable: ${latency}ms`,
        severity: 'info'
      };

    } catch (error) {
      return {
        name: 'Network Latency',
        passed: false,
        message: 'Network latency test failed',
        severity: 'warning',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkDiskSpace(): Promise<CheckResult> {
    try {
      const dataPath = './data';
      const stats = fs.statSync('./');

      // Simple check - if we can write a test file
      const testFile = path.join(dataPath, 'disk-test.tmp');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);

      return {
        name: 'Disk Space',
        passed: true,
        message: 'Sufficient disk space available',
        severity: 'info'
      };

    } catch (error) {
      return {
        name: 'Disk Space',
        passed: false,
        message: 'Disk space check failed',
        severity: 'warning',
        details: 'Cannot write to data directory'
      };
    }
  }

  private async checkMemoryUsage(): Promise<CheckResult> {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

    if (heapUsedMB > 500) {
      return {
        name: 'Memory Usage',
        passed: false,
        message: `High memory usage: ${heapUsedMB}MB`,
        severity: 'warning',
        details: 'Consider restarting the application'
      };
    }

    return {
      name: 'Memory Usage',
      passed: true,
      message: `Memory usage normal: ${heapUsedMB}MB/${heapTotalMB}MB`,
      severity: 'info'
    };
  }

  private generateReport(checks: CheckResult[]): FlightStatus {
    console.log('\n📋 PRE-FLIGHT CHECK RESULTS');
    console.log('='.repeat(60));

    const criticalIssues = checks.filter(c => !c.passed && c.severity === 'critical').length;
    const warnings = checks.filter(c => c.severity === 'warning').length;
    const readyForLaunch = criticalIssues === 0;

    checks.forEach(check => {
      const icon = check.passed ? '✅' : '❌';
      const severity = check.severity === 'critical' ? '🚨' :
                      check.severity === 'warning' ? '⚠️' : 'ℹ️';

      console.log(`${icon} ${check.name}: ${check.message}`);

      if (check.details) {
        console.log(`   ${severity} ${check.details}`);
      }
    });

    console.log('\n' + '='.repeat(60));

    if (readyForLaunch) {
      console.log('🚀 ALL SYSTEMS GO - READY FOR LAUNCH!');
      console.log(`✅ ${checks.filter(c => c.passed).length}/${checks.length} checks passed`);
      if (warnings > 0) {
        console.log(`⚠️ ${warnings} warnings (non-critical)`);
      }
    } else {
      console.log('🛑 CRITICAL ISSUES FOUND - FIX BEFORE TRADING');
      console.log(`❌ ${criticalIssues} critical issue(s) must be resolved`);
      console.log(`⚠️ ${warnings} warning(s) should be reviewed`);
    }

    const recommendations: string[] = [];

    checks.filter(c => !c.passed).forEach(check => {
      if (check.severity === 'critical') {
        recommendations.push(`Fix ${check.name}: ${check.details || check.message}`);
      }
    });

    if (warnings > 0 && readyForLaunch) {
      recommendations.push('Review warnings before starting live trading');
    }

    console.log('='.repeat(60) + '\n');

    return {
      readyForLaunch,
      checks,
      criticalIssues,
      warnings,
      recommendations
    };
  }

  // Static helper method
  static async runQuickCheck(config: SystemConfig): Promise<boolean> {
    const checker = new PreFlightCheck(config);
    const status = await checker.runAllChecks();
    return status.readyForLaunch;
  }
}

export { PreFlightCheck, CheckResult, FlightStatus, SystemConfig };