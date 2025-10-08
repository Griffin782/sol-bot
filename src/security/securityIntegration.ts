// ============================================
// SECURITY INTEGRATION MODULE
// Purpose: Easy integration hooks for main trading bot
// ============================================

import { securityManager, SecurityIndicatorType } from './securityManager';

export interface TradingActivity {
  type: 'BUY' | 'SELL' | 'SWAP';
  amount: number;
  token: string;
  walletAddress: string;
  success: boolean;
}

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface SystemStatus {
  systemStatus: 'ACTIVE' | 'LOCKED' | 'EMERGENCY';
  tradingAllowed: boolean;
  lastSecurityCheck: Date;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Security Integration Class
 * Provides easy-to-use security hooks for the main trading bot
 */
export class SecurityIntegration {
  private static instance: SecurityIntegration;
  
  private constructor() {}
  
  public static getInstance(): SecurityIntegration {
    if (!SecurityIntegration.instance) {
      SecurityIntegration.instance = new SecurityIntegration();
    }
    return SecurityIntegration.instance;
  }
  
  // ============================================
  // PRE-TRADE SECURITY CHECKS
  // ============================================
  
  /**
   * Check if trading is allowed before executing any trade
   * Call this before every buy/sell/swap operation
   */
  public async checkTradingAllowed(tradeDetails?: any): Promise<SecurityCheckResult> {
    try {
      const result = await securityManager.checkSecurityStatusBeforeTrade(tradeDetails);
      const status = securityManager.getSecurityStatusForBot();
      
      return {
        allowed: result.allowed,
        reason: result.reason,
        riskLevel: status.riskLevel
      };
      
    } catch (error) {
      console.error('❌ Security check failed:', error);
      return {
        allowed: false,
        reason: 'Security system error - trading suspended for safety',
        riskLevel: 'CRITICAL'
      };
    }
  }
  
  /**
   * Quick check - returns boolean for simple yes/no trading decisions
   */
  public async isTradingAllowed(): Promise<boolean> {
    const result = await this.checkTradingAllowed();
    return result.allowed;
  }
  
  // ============================================
  // POST-TRADE LOGGING
  // ============================================
  
  /**
   * Log trading activity for security monitoring
   * Call this after every completed trade
   */
  public async logTrade(activity: TradingActivity): Promise<void> {
    try {
      await securityManager.logTradingActivity(activity);
    } catch (error) {
      console.error('❌ Failed to log trading activity:', error);
    }
  }
  
  /**
   * Log successful buy operation
   */
  public async logBuy(amount: number, token: string, walletAddress: string): Promise<void> {
    await this.logTrade({
      type: 'BUY',
      amount,
      token,
      walletAddress,
      success: true
    });
  }
  
  /**
   * Log successful sell operation
   */
  public async logSell(amount: number, token: string, walletAddress: string): Promise<void> {
    await this.logTrade({
      type: 'SELL',
      amount,
      token,
      walletAddress,
      success: true
    });
  }
  
  /**
   * Log failed trade operation
   */
  public async logFailedTrade(type: 'BUY' | 'SELL' | 'SWAP', amount: number, token: string, walletAddress: string): Promise<void> {
    await this.logTrade({
      type,
      amount,
      token,
      walletAddress,
      success: false
    });
  }
  
  // ============================================
  // SYSTEM STATUS
  // ============================================
  
  /**
   * Get current system security status
   */
  public getSystemStatus(): SystemStatus {
    return securityManager.getSecurityStatusForBot();
  }
  
  /**
   * Check if system is in emergency mode
   */
  public isEmergencyMode(): boolean {
    const status = this.getSystemStatus();
    return status.systemStatus === 'EMERGENCY';
  }
  
  /**
   * Check if system is locked
   */
  public isSystemLocked(): boolean {
    const status = this.getSystemStatus();
    return status.systemStatus === 'LOCKED';
  }
  
  // ============================================
  // MANUAL SECURITY ACTIONS
  // ============================================
  
  /**
   * Manually trigger emergency response (admin function)
   */
  public async triggerEmergency(reason: string): Promise<void> {
    try {
      console.log(`🚨 Manual emergency trigger: ${reason}`);
      await securityManager.triggerEmergencyResponse(reason, 'CRITICAL');
    } catch (error) {
      console.error('❌ Failed to trigger emergency:', error);
    }
  }
  
  /**
   * Resume trading after manual review (admin function)
   */
  public resumeTrading(reason: string = 'Manual override'): void {
    try {
      console.log(`▶️ Trading resumed: ${reason}`);
      securityManager.resumeTrading(reason);
      
      // Reset emergency state if needed
      if (securityManager['emergencyTriggered']) {
        securityManager['emergencyTriggered'] = false;
        securityManager['systemLocked'] = false;
        console.log('🔓 Emergency state cleared');
      }
    } catch (error) {
      console.error('❌ Failed to resume trading:', error);
    }
  }
  
  /**
   * Get security status summary for display
   */
  public getStatusSummary(): string {
    const status = this.getSystemStatus();
    const riskEmoji = {
      'LOW': '🟢',
      'MEDIUM': '🟡', 
      'HIGH': '🟠',
      'CRITICAL': '🔴'
    };
    
    return `${riskEmoji[status.riskLevel]} Security: ${status.systemStatus} | Trading: ${status.tradingAllowed ? 'ALLOWED' : 'BLOCKED'} | Risk: ${status.riskLevel}`;
  }
  
  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
  /**
   * Display current security status in console
   */
  public displayStatus(): void {
    securityManager.displaySecurityStatus();
    console.log('📊 Security Integration Status:', this.getStatusSummary());
  }
  
  /**
   * Get recent security events for debugging (includes all events)
   */
  public getRecentEvents(hours: number = 24): any[] {
    return securityManager.getRecentSecurityEvents(hours);
  }
  
  /**
   * Get actual security threats (excludes trading performance)
   */
  public getSecurityThreats(hours: number = 24): any[] {
    return securityManager.getRecentSecurityThreats(hours);
  }
  
  /**
   * Get trading performance metrics (separate from security)
   */
  public getTradingMetrics(hours: number = 24): {
    totalTrades: number;
    largeTrades: number;
    rapidTradingPeriods: number;
    averageTradeSize: number;
  } {
    return securityManager.getTradingPerformanceMetrics(hours);
  }
  
  /**
   * Multi-factor security methods
   */
  public async detectSSHBruteForce(sourceIP: string, attempts: number, timespan: number): Promise<void> {
    await securityManager.detectSSHBruteForce(sourceIP, attempts, timespan);
  }
  
  public async detectUnauthorizedFileAccess(sourceIP: string, filePath: string, accessType: string): Promise<void> {
    await securityManager.detectUnauthorizedFileAccess(sourceIP, filePath, accessType);
  }
  
  public async detectProcessTampering(sourceIP: string, processName: string, action: string): Promise<void> {
    await securityManager.detectProcessTampering(sourceIP, processName, action);
  }
  
  public async detectNetworkIntrusion(sourceIP: string, scanType: string, portCount: number): Promise<void> {
    await securityManager.detectNetworkIntrusion(sourceIP, scanType, portCount);
  }
  
  public async detectPrivilegeEscalation(sourceIP: string, fromUser: string, toUser: string): Promise<void> {
    await securityManager.detectPrivilegeEscalation(sourceIP, fromUser, toUser);
  }
  
  public getMultiFactorAnalysis(): any {
    return securityManager.getMultiFactorAnalysis();
  }
  
  public getRecentSecurityIndicators(minutes: number = 10): any[] {
    return securityManager.getRecentSecurityIndicators(minutes);
  }
  
  /**
   * Display security status with multi-factor analysis
   */
  public displayMultiFactorStatus(): void {
    console.log('\n🔍 MULTI-FACTOR SECURITY ANALYSIS:');
    console.log('='.repeat(50));
    
    const analysis = this.getMultiFactorAnalysis();
    console.log(`Recent Indicators: ${analysis.recentIndicators.length}`);
    console.log(`Unique Types: ${analysis.uniqueTypes}`);
    console.log(`Time Window: ${analysis.timeWindow} minutes`);
    console.log(`Required for Emergency: ${analysis.requiredForTrigger}`);
    console.log(`Emergency Threshold: ${analysis.emergencyThreshold ? '🚨 REACHED' : '✅ Safe'}`);
    
    if (analysis.recentIndicators.length > 0) {
      console.log('\nRecent Security Indicators:');
      analysis.recentIndicators.forEach((indicator: any, index: number) => {
        const age = Math.floor((Date.now() - new Date(indicator.timestamp).getTime()) / 60000);
        console.log(`  ${index + 1}. ${indicator.type} from ${indicator.sourceIP} (${indicator.severity}) - ${age}m ago`);
      });
    }
  }
  
  /**
   * Display security status with clear separation of threats vs performance
   */
  public displayDetailedStatus(): void {
    console.log('\n🛡️ SECURITY STATUS (Threats Only):');
    console.log('='.repeat(50));
    
    const threats = this.getSecurityThreats(24);
    const criticalThreats = threats.filter(t => t.severity === 'CRITICAL');
    const highThreats = threats.filter(t => t.severity === 'HIGH');
    
    console.log(`🔴 Critical Security Threats: ${criticalThreats.length}`);
    console.log(`🟠 High Priority Threats: ${highThreats.length}`);
    console.log(`⚠️ Total Security Events: ${threats.length}`);
    
    if (criticalThreats.length > 0) {
      console.log('\n🚨 Recent Critical Threats:');
      criticalThreats.slice(-3).forEach(threat => {
        console.log(`  - ${threat.eventType}: ${threat.sourceIP} (${threat.details?.action || 'N/A'})`);
      });
    }
    
    console.log('\n📊 TRADING PERFORMANCE (Last 24h):');
    console.log('='.repeat(50));
    
    const metrics = this.getTradingMetrics(24);
    console.log(`📈 Total Trades: ${metrics.totalTrades}`);
    console.log(`💰 Large Trades (>$10k): ${metrics.largeTrades}`);
    console.log(`⚡ High Velocity Periods: ${metrics.rapidTradingPeriods}`);
    console.log(`💵 Average Trade Size: $${metrics.averageTradeSize.toFixed(2)}`);
    
    console.log('\n🔍 System Status:');
    console.log('='.repeat(50));
    console.log(this.getStatusSummary());
  }
}

// ============================================
// CONVENIENCE FUNCTIONS FOR EASY IMPORT
// ============================================

const security = SecurityIntegration.getInstance();

// Export convenience functions for easy use in main bot
export const checkTradingAllowed = (tradeDetails?: any) => security.checkTradingAllowed(tradeDetails);
export const isTradingAllowed = () => security.isTradingAllowed();
export const logBuy = (amount: number, token: string, wallet: string) => security.logBuy(amount, token, wallet);
export const logSell = (amount: number, token: string, wallet: string) => security.logSell(amount, token, wallet);
export const logFailedTrade = (type: 'BUY' | 'SELL' | 'SWAP', amount: number, token: string, wallet: string) => 
  security.logFailedTrade(type, amount, token, wallet);
export const getSystemStatus = () => security.getSystemStatus();
export const isEmergencyMode = () => security.isEmergencyMode();
export const isSystemLocked = () => security.isSystemLocked();
export const displaySecurityStatus = () => security.displayStatus();
export const triggerEmergency = (reason: string) => security.triggerEmergency(reason);
export const resumeTrading = (reason?: string) => security.resumeTrading(reason);
export const getStatusSummary = () => security.getStatusSummary();
export const getSecurityThreats = (hours?: number) => security.getSecurityThreats(hours);
export const getTradingMetrics = (hours?: number) => security.getTradingMetrics(hours);
export const displayDetailedStatus = () => security.displayDetailedStatus();
export const detectSSHBruteForce = (sourceIP: string, attempts: number, timespan: number) => security.detectSSHBruteForce(sourceIP, attempts, timespan);
export const detectUnauthorizedFileAccess = (sourceIP: string, filePath: string, accessType: string) => security.detectUnauthorizedFileAccess(sourceIP, filePath, accessType);
export const detectProcessTampering = (sourceIP: string, processName: string, action: string) => security.detectProcessTampering(sourceIP, processName, action);
export const detectNetworkIntrusion = (sourceIP: string, scanType: string, portCount: number) => security.detectNetworkIntrusion(sourceIP, scanType, portCount);
export const detectPrivilegeEscalation = (sourceIP: string, fromUser: string, toUser: string) => security.detectPrivilegeEscalation(sourceIP, fromUser, toUser);
export const getMultiFactorAnalysis = () => security.getMultiFactorAnalysis();
export const displayMultiFactorStatus = () => security.displayMultiFactorStatus();

// Export the main class as default
export default SecurityIntegration;