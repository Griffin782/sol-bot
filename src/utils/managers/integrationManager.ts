// ============================================
// INTEGRATION MANAGER - System Integration
// ============================================

import { SessionManager } from './sessionManager';
import { WalletRotator } from './walletRotator';
import { BackupManager } from './backupManager';
import { AdvancedBotManager } from '../../advanced-features';

export interface SystemStatus {
  sessionManager: boolean;
  walletRotator: boolean;
  backupManager: boolean;
  taxCompliance: boolean;
  advancedFeatures: boolean;
  security: boolean;
}

export class IntegrationManager {
  private sessionManager: SessionManager;
  private walletRotator: WalletRotator;
  private backupManager: BackupManager;
  private advancedManager: AdvancedBotManager | null = null;

  constructor() {
    this.sessionManager = new SessionManager();
    this.walletRotator = new WalletRotator();
    this.backupManager = new BackupManager();

    console.log('🔗 Integration Manager initialized');
  }

  public initializeAdvancedFeatures(config: any): void {
    this.advancedManager = new AdvancedBotManager(config);
    console.log('✅ Advanced features integrated');
  }

  public startTradingSession(initialBalance: number = 1000): string {
    try {
      // Create backup before starting session
      const backupId = this.backupManager.backupCriticalFiles('Pre-session backup');
      console.log(`💾 Pre-session backup created: ${backupId}`);

      // Start new session
      const session = this.sessionManager.startNewSession(initialBalance);
      
      // Update environment with new wallet
      process.env.PRIVATE_KEY = session.wallet.privateKey;
      
      console.log(`🚀 Trading session integrated successfully`);
      console.log(`   📊 Session ID: ${session.sessionId}`);
      console.log(`   💼 Wallet: ${session.wallet.publicKey.slice(0, 8)}...`);
      console.log(`   💰 Balance: $${session.initialBalance}`);

      return session.wallet.privateKey;

    } catch (error) {
      console.error(`❌ Failed to start trading session: ${error}`);
      throw error;
    }
  }

  public completeTradingSession(reason: string = 'Session completed'): void {
    try {
      // Complete session
      this.sessionManager.completeSession(reason);

      // Create post-session backup
      const backupId = this.backupManager.backupTradingData('Post-session backup');
      console.log(`💾 Post-session backup created: ${backupId}`);

      // Generate reports if advanced manager is available
      if (this.advancedManager) {
        this.advancedManager.generateReports();
      }

      console.log(`✅ Trading session completed and archived`);

    } catch (error) {
      console.error(`❌ Error completing session: ${error}`);
    }
  }

  public recordTradeResult(
    tokenAddress: string,
    success: boolean,
    pnl: number,
    holdTimeMinutes: number
  ): void {
    // Update session metrics
    this.sessionManager.updateSessionMetrics({
      success,
      pnl,
      holdTimeMinutes
    });

    // Check if session should be completed due to target reached
    const session = this.sessionManager.getCurrentSession();
    if (session?.targetReached) {
      console.log(`🎯 Session target reached! Preparing to complete session...`);
      
      // Complete session after a brief delay to log final trades
      setTimeout(() => {
        this.completeTradingSession('Target reached (10x)');
        
        // Start new session automatically
        setTimeout(() => {
          this.startTradingSession(1000);
        }, 2000);
      }, 1000);
    }
  }

  public shouldContinueTrading(): boolean {
    return this.sessionManager.shouldContinueTrading();
  }

  public getSystemStatus(): SystemStatus {
    const session = this.sessionManager.getCurrentSession();
    const walletStatus = this.walletRotator.getWalletPoolStatus();
    const backupStats = this.backupManager.getBackupStats();

    return {
      sessionManager: session?.status === 'active',
      walletRotator: walletStatus.available > 0,
      backupManager: backupStats.totalBackups > 0,
      taxCompliance: this.checkTaxComplianceSystem(),
      advancedFeatures: this.advancedManager !== null,
      security: this.checkSecuritySystem()
    };
  }

  public displayIntegratedStatus(): void {
    const status = this.getSystemStatus();
    const session = this.sessionManager.getCurrentSession();
    const walletStatus = this.walletRotator.getWalletPoolStatus();

    console.log(`\n🔗 INTEGRATED SYSTEMS STATUS:`);
    console.log(`   🎮 Session Manager: ${status.sessionManager ? '✅ ACTIVE' : '❌ INACTIVE'}`);
    console.log(`   💼 Wallet Rotator: ${status.walletRotator ? '✅ READY' : '⚠️ LOW WALLETS'}`);
    console.log(`   💾 Backup Manager: ${status.backupManager ? '✅ ACTIVE' : '❌ NO BACKUPS'}`);
    console.log(`   📊 Tax Compliance: ${status.taxCompliance ? '✅ READY' : '⚠️ NEEDS SETUP'}`);
    console.log(`   🚀 Advanced Features: ${status.advancedFeatures ? '✅ LOADED' : '❌ NOT LOADED'}`);
    console.log(`   🔒 Security System: ${status.security ? '✅ ACTIVE' : '❌ INACTIVE'}`);

    if (session) {
      const stats = this.sessionManager.getSessionStats();
      console.log(`\n📊 CURRENT SESSION:`);
      console.log(`   🆔 ID: ${stats.sessionId}`);
      console.log(`   💰 Balance: $${stats.balance.toFixed(2)} (${stats.roi.toFixed(1)}% ROI)`);
      console.log(`   📈 Trades: ${stats.trades} (${stats.winRate.toFixed(1)}% win rate)`);
      console.log(`   ⏰ Runtime: ${stats.runtime.toFixed(1)} minutes`);
      console.log(`   🎯 Target: ${stats.targetReached ? 'REACHED' : 'In Progress'}`);
    }

    console.log(`\n💼 WALLET POOL:`);
    console.log(`   📊 Total: ${walletStatus.total}`);
    console.log(`   🟢 Available: ${walletStatus.available}`);
    console.log(`   🔵 Active: ${walletStatus.active}`);
    console.log(`   ✅ Completed: ${walletStatus.completed}`);
  }

  private checkTaxComplianceSystem(): boolean {
    const fs = require('fs');
    return fs.existsSync('./tax-compliance/2025/transactions') &&
           fs.existsSync('./tax-compliance/2025/reports') &&
           fs.existsSync('./tax-compliance/2025/form8949');
  }

  private checkSecuritySystem(): boolean {
    const fs = require('fs');
    return fs.existsSync('./src/security/securityManager.ts') &&
           fs.existsSync('./src/security/securityIntegration.ts') &&
           fs.existsSync('./dist/data/security_config.json');
  }

  public createSystemSnapshot(reason: string = 'Manual snapshot'): string {
    console.log(`📸 Creating system snapshot: ${reason}`);
    
    // Create comprehensive backup
    const backupId = this.backupManager.backupCriticalFiles(`Snapshot: ${reason}`);
    
    // Also backup trading data
    this.backupManager.backupTradingData(`Snapshot data: ${reason}`);
    
    // Create rollback point
    this.backupManager.createRollbackPoint(
      `snapshot_${Date.now()}`,
      new Date(),
      backupId,
      `System snapshot: ${reason}`,
      [
        './src/index.ts',
        './src/config.ts',
        './src/enhanced/masterConfig.ts',
        './data/trading_log.json',
        './wallets/pending/wallet-pool.json'
      ],
      true
    );

    return backupId;
  }

  public performSystemHealthCheck(): {
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check wallet availability
    const walletStatus = this.walletRotator.getWalletPoolStatus();
    if (walletStatus.available < 2) {
      issues.push('Low wallet availability');
      recommendations.push('Generate more wallets for rotation pool');
    }

    // Check session status
    const session = this.sessionManager.getCurrentSession();
    if (!session) {
      issues.push('No active trading session');
      recommendations.push('Start new trading session');
    }

    // Check tax compliance directory
    if (!this.checkTaxComplianceSystem()) {
      issues.push('Tax compliance system not properly set up');
      recommendations.push('Verify tax-compliance directory structure');
    }

    // Check recent backups
    const backupStats = this.backupManager.getBackupStats();
    if (backupStats.totalBackups === 0) {
      issues.push('No system backups found');
      recommendations.push('Create initial system backup');
    }

    const healthy = issues.length === 0;

    console.log(`\n🏥 SYSTEM HEALTH CHECK:`);
    console.log(`   Overall Health: ${healthy ? '✅ HEALTHY' : '⚠️ NEEDS ATTENTION'}`);
    console.log(`   Issues Found: ${issues.length}`);
    
    if (issues.length > 0) {
      console.log(`\n⚠️ ISSUES:`);
      issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
      
      console.log(`\n💡 RECOMMENDATIONS:`);
      recommendations.forEach((rec, i) => console.log(`   ${i + 1}. ${rec}`));
    }

    return { healthy, issues, recommendations };
  }

  public performMaintenanceTasks(): void {
    console.log(`🔧 Performing system maintenance...`);

    // Clean old backups
    this.backupManager.cleanupOldBackups(30);

    // Ensure wallet availability
    this.walletRotator.ensureWalletAvailability();

    // Generate reports
    this.walletRotator.generateRotationReport();

    // Create maintenance snapshot
    this.createSystemSnapshot('Routine maintenance');

    console.log(`✅ System maintenance completed`);
  }
}

// Export singleton instance
export const integrationManager = new IntegrationManager();