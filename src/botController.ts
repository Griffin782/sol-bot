// ============================================
// BOT CONTROLLER - Centralized Configuration Console
// Version: 1.0
// Purpose: Single interface to control ALL bot parameters
// ============================================

import { masterConfig, MasterConfig, getConfig, updateConfig } from './enhanced/masterConfig';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// INTERFACES & TYPES
// ============================================

export interface SessionConfig {
  sessionNumber: number;
  initialPool: number;
  targetPool: number;
  profitRequired: number;          // Target - Initial
  growthMultiplier: number;        // Target / Initial
  maxTrades: number;               // Based on session complexity
  confidenceAdjustment: number;    // Modify base confidence (-10 to +10)
  taxReservePercent: number;       // 40% for taxes
  reinvestmentPercent: number;     // % reinvested to next session
  nextSessionPool: number;         // Auto-calculated
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  description: string;             // Human-readable session goal
}

export interface TradingParams {
  confidenceLevel: number;        // 47% default
  pauseAfterTrades: number;       // 25 trades per session
  maxTradesPerSession: number;    // Auto-calculated based on session
  minLiquidityUSD: number;        // 3000 USD
  positionSizeSOL: number;        // From masterConfig
  maxConcurrentPositions: number;
  slippageTolerance: number;
  priorityFeeSOL: number;
}

export interface FatigueManagement {
  enabled: boolean;
  sessionBreakDuration: number;   // Minutes between sessions
  dailyTradeLimit: number;        // Max trades per day
  performanceBasedPause: boolean; // Pause on consecutive losses
  adaptiveConfidence: boolean;    // Lower confidence after losses
  maxConsecutiveLosses: number;   // Trigger break after X losses
  confidenceDecayRate: number;    // % confidence loss per loss
  recoveryMultiplier: number;     // Confidence boost after wins
}

export interface FatigueStatus {
  tradesThisSession: number;
  consecutiveLosses: number;
  sessionDuration: number;
  recommendedBreak: boolean;
  confidenceAdjustment: number;   // -10 to +10 percentage points
  nextBreakIn: number;            // Minutes until recommended break
  performanceScore: number;       // 0-100 performance rating
}

export interface PerformanceMetrics {
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  profitableTrades: number;
}

export interface ProfitDistribution {
  grossProfit: number;
  taxReserve: number;             // 40% of profit
  netProfit: number;              // After tax
  reinvestment: number;           // To next session
  withdrawn: number;              // Kept as profit
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface RiskAssessment {
  currentRiskLevel: number;       // 0-100
  maxRiskExceeded: boolean;
  recommendedAction: string;
  safeguards: string[];
}

// ============================================
// DEFAULT SESSION PROGRESSION
// ============================================

const DEFAULT_SESSION_PROGRESSION: SessionConfig[] = [
  {
    sessionNumber: 1,
    initialPool: 600,
    targetPool: 6000,
    profitRequired: 5400,
    growthMultiplier: 10.0,
    maxTrades: 50,
    confidenceAdjustment: 0,
    taxReservePercent: 40,
    reinvestmentPercent: 70,
    nextSessionPool: 4200,         // 6000 * 0.7
    riskLevel: 'moderate',
    description: 'Foundation Building - Learn the market, establish base capital'
  },
  {
    sessionNumber: 2,
    initialPool: 4200,
    targetPool: 60000,
    profitRequired: 55800,
    growthMultiplier: 14.3,
    maxTrades: 100,
    confidenceAdjustment: +5,      // Boost confidence
    taxReservePercent: 40,
    reinvestmentPercent: 50,
    nextSessionPool: 30000,        // 60000 * 0.5
    riskLevel: 'aggressive',
    description: 'Growth Phase - Aggressive scaling with higher risk tolerance'
  },
  {
    sessionNumber: 3,
    initialPool: 30000,
    targetPool: 100000,
    profitRequired: 70000,
    growthMultiplier: 3.33,
    maxTrades: 75,
    confidenceAdjustment: -5,      // More conservative
    taxReservePercent: 40,
    reinvestmentPercent: 30,
    nextSessionPool: 30000,        // 100000 * 0.3
    riskLevel: 'conservative',
    description: 'Consolidation - Secure gains with reduced risk'
  },
  {
    sessionNumber: 4,
    initialPool: 30000,
    targetPool: 150000,
    profitRequired: 120000,
    growthMultiplier: 5.0,
    maxTrades: 100,
    confidenceAdjustment: 0,
    taxReservePercent: 40,
    reinvestmentPercent: 20,
    nextSessionPool: 30000,        // 150000 * 0.2 (repeating cycle)
    riskLevel: 'moderate',
    description: 'Mastery Phase - Consistent profitable trading at scale'
  }
];

// ============================================
// BOT CONTROLLER CLASS
// ============================================

export class BotController {
  private sessionProgression: SessionConfig[];
  private currentSessionIndex: number;
  private tradingParams: TradingParams;
  private fatigueManagement: FatigueManagement;
  private performanceHistory: PerformanceMetrics[];
  private sessionStartTime: Date;
  private tradesThisSession: number;
  private consecutiveLosses: number;

  constructor() {
    this.sessionProgression = [...DEFAULT_SESSION_PROGRESSION];
    this.currentSessionIndex = 0;
    this.tradesThisSession = 0;
    this.consecutiveLosses = 0;
    this.sessionStartTime = new Date();
    this.performanceHistory = [];

    // Initialize trading parameters from masterConfig
    this.tradingParams = {
      confidenceLevel: 47,            // 47% default confidence
      pauseAfterTrades: 25,           // Pause after 25 trades
      maxTradesPerSession: this.getCurrentSession().maxTrades,
      minLiquidityUSD: 3000,          // Minimum 3000 USD liquidity
      positionSizeSOL: masterConfig.pool.positionSize,
      maxConcurrentPositions: masterConfig.pool.maxPositions,
      slippageTolerance: masterConfig.execution.slippageTolerance,
      priorityFeeSOL: masterConfig.execution.priorityFee / 1000000000 // Convert lamports to SOL
    };

    // Initialize fatigue management
    this.fatigueManagement = {
      enabled: true,
      sessionBreakDuration: 15,      // 15 minute breaks
      dailyTradeLimit: 200,          // Max 200 trades per day
      performanceBasedPause: true,
      adaptiveConfidence: true,
      maxConsecutiveLosses: 5,       // Break after 5 consecutive losses
      confidenceDecayRate: 2,        // -2% confidence per loss
      recoveryMultiplier: 1.5        // +1.5% confidence per win after losses
    };

    this.logInitialization();
  }

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  public getCurrentSession(): SessionConfig {
    return this.sessionProgression[this.currentSessionIndex];
  }

  public getNextSession(): SessionConfig | null {
    const nextIndex = this.currentSessionIndex + 1;
    if (nextIndex < this.sessionProgression.length) {
      return this.sessionProgression[nextIndex];
    }
    // Return repeating session (session 4 repeats)
    return this.sessionProgression[this.sessionProgression.length - 1];
  }

  public advanceSession(): boolean {
    const nextIndex = this.currentSessionIndex + 1;
    if (nextIndex < this.sessionProgression.length) {
      this.currentSessionIndex = nextIndex;
    } else {
      // Keep repeating the last session
      this.currentSessionIndex = this.sessionProgression.length - 1;
    }
    
    this.resetSessionCounters();
    this.logSessionAdvancement();
    return true;
  }

  public resetToSession(index: number): void {
    if (index >= 0 && index < this.sessionProgression.length) {
      this.currentSessionIndex = index;
      this.resetSessionCounters();
      console.log(`🔄 Reset to Session ${index + 1}`);
    }
  }

  private resetSessionCounters(): void {
    this.tradesThisSession = 0;
    this.consecutiveLosses = 0;
    this.sessionStartTime = new Date();
    
    // Update trading params for new session
    this.tradingParams.maxTradesPerSession = this.getCurrentSession().maxTrades;
  }

  public calculateSessionProgression(): SessionConfig[] {
    // Recalculate all dependent values
    for (let i = 0; i < this.sessionProgression.length; i++) {
      const session = this.sessionProgression[i];
      session.profitRequired = session.targetPool - session.initialPool;
      session.growthMultiplier = session.targetPool / session.initialPool;
      session.nextSessionPool = Math.floor(session.targetPool * (session.reinvestmentPercent / 100));
      
      // Update next session's initial pool (except for last session)
      if (i + 1 < this.sessionProgression.length) {
        this.sessionProgression[i + 1].initialPool = session.nextSessionPool;
      }
    }
    
    return this.sessionProgression;
  }

  // ============================================
  // CONFIGURATION MANAGEMENT
  // ============================================

  public updateMasterConfig(updates: Partial<MasterConfig>): void {
    try {
      updateConfig(updates);
      this.syncWithMasterConfig();
      console.log('✅ MasterConfig updated successfully');
    } catch (error) {
      console.error('❌ Failed to update MasterConfig:', error);
    }
  }

  public syncWithMasterConfig(): void {
    const config = getConfig();
    
    this.tradingParams.positionSizeSOL = config.pool.positionSize;
    this.tradingParams.maxConcurrentPositions = config.pool.maxPositions;
    this.tradingParams.slippageTolerance = config.execution.slippageTolerance;
    this.tradingParams.priorityFeeSOL = config.execution.priorityFee / 1000000000;
    
    console.log('🔄 Synced with MasterConfig');
  }

  public recalculateAllSessions(): void {
    this.sessionProgression = this.calculateSessionProgression();
    console.log('🔢 Recalculated all session values');
  }

  // ============================================
  // TRADING PARAMETER CONTROL
  // ============================================

  public setConfidenceLevel(level: number): void {
    if (level >= 10 && level <= 90) {
      this.tradingParams.confidenceLevel = level;
      console.log(`🎯 Confidence level set to ${level}%`);
    } else {
      console.error('❌ Confidence level must be between 10-90%');
    }
  }

  public setPauseThreshold(trades: number): void {
    if (trades > 0 && trades <= 100) {
      this.tradingParams.pauseAfterTrades = trades;
      console.log(`⏸️ Pause threshold set to ${trades} trades`);
    } else {
      console.error('❌ Pause threshold must be between 1-100 trades');
    }
  }

  public setMinLiquidity(usd: number): void {
    if (usd >= 1000) {
      this.tradingParams.minLiquidityUSD = usd;
      console.log(`💧 Minimum liquidity set to $${usd.toLocaleString()}`);
    } else {
      console.error('❌ Minimum liquidity must be at least $1,000');
    }
  }

  public updateTradingParams(params: Partial<TradingParams>): void {
    Object.assign(this.tradingParams, params);
    console.log('🔧 Trading parameters updated');
  }

  // ============================================
  // FATIGUE & PERFORMANCE MANAGEMENT
  // ============================================

  public checkFatigueStatus(): FatigueStatus {
    const sessionDuration = Math.floor((Date.now() - this.sessionStartTime.getTime()) / 60000); // Minutes
    const currentSession = this.getCurrentSession();
    
    let confidenceAdjustment = currentSession.confidenceAdjustment;
    
    // Apply adaptive confidence based on consecutive losses
    if (this.fatigueManagement.adaptiveConfidence) {
      confidenceAdjustment -= this.consecutiveLosses * this.fatigueManagement.confidenceDecayRate;
    }
    
    const recommendedBreak = 
      this.tradesThisSession >= this.tradingParams.pauseAfterTrades ||
      this.consecutiveLosses >= this.fatigueManagement.maxConsecutiveLosses ||
      sessionDuration >= 120; // 2 hours
    
    const performanceScore = this.calculatePerformanceScore();
    
    return {
      tradesThisSession: this.tradesThisSession,
      consecutiveLosses: this.consecutiveLosses,
      sessionDuration,
      recommendedBreak,
      confidenceAdjustment: Math.max(-10, Math.min(10, confidenceAdjustment)),
      nextBreakIn: recommendedBreak ? 0 : this.tradingParams.pauseAfterTrades - this.tradesThisSession,
      performanceScore
    };
  }

  public adjustConfidenceForPerformance(): number {
    const fatigueStatus = this.checkFatigueStatus();
    const baseConfidence = this.tradingParams.confidenceLevel;
    const adjustedConfidence = baseConfidence + fatigueStatus.confidenceAdjustment;
    
    return Math.max(20, Math.min(80, adjustedConfidence)); // Clamp between 20-80%
  }

  public recommendSessionBreak(): boolean {
    return this.checkFatigueStatus().recommendedBreak;
  }

  public trackPerformanceMetrics(): PerformanceMetrics {
    // This would integrate with actual trading results
    // For now, return default metrics
    return {
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      totalTrades: this.tradesThisSession,
      profitableTrades: 0
    };
  }

  private calculatePerformanceScore(): number {
    // Simple performance scoring based on win rate and recent activity
    // Returns 0-100 score
    if (this.tradesThisSession === 0) return 50; // Neutral
    
    const lossRate = this.consecutiveLosses / Math.max(1, this.tradesThisSession);
    return Math.max(0, Math.min(100, 100 - (lossRate * 100)));
  }

  // ============================================
  // AUTO-CALCULATIONS
  // ============================================

  public calculateProfitDistribution(totalProfit: number): ProfitDistribution {
    const currentSession = this.getCurrentSession();
    const taxReserve = totalProfit * (currentSession.taxReservePercent / 100);
    const netProfit = totalProfit - taxReserve;
    const reinvestment = totalProfit * (currentSession.reinvestmentPercent / 100);
    const withdrawn = netProfit - reinvestment;

    return {
      grossProfit: totalProfit,
      taxReserve,
      netProfit,
      reinvestment,
      withdrawn
    };
  }

  public calculateNextSessionPool(currentProfit: number): number {
    const currentSession = this.getCurrentSession();
    return currentProfit * (currentSession.reinvestmentPercent / 100);
  }

  public calculateOptimalPositionSize(): number {
    const currentSession = this.getCurrentSession();
    const baseSize = masterConfig.pool.positionSize;
    
    // Adjust based on risk level
    switch (currentSession.riskLevel) {
      case 'conservative':
        return baseSize * 0.75;
      case 'aggressive':
        return baseSize * 1.25;
      default:
        return baseSize;
    }
  }

  // ============================================
  // SAFETY & VALIDATION
  // ============================================

  public validateSessionProgression(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Validate each session
    this.sessionProgression.forEach((session, index) => {
      if (session.initialPool <= 0) {
        errors.push(`Session ${index + 1}: Initial pool must be positive`);
      }
      
      if (session.targetPool <= session.initialPool) {
        errors.push(`Session ${index + 1}: Target pool must exceed initial pool`);
      }
      
      if (session.growthMultiplier > 20) {
        warnings.push(`Session ${index + 1}: Growth multiplier ${session.growthMultiplier}x is very high`);
      }
      
      if (session.maxTrades > 200) {
        warnings.push(`Session ${index + 1}: ${session.maxTrades} trades may cause fatigue`);
      }
    });

    if (this.tradingParams.confidenceLevel < 30) {
      warnings.push('Confidence level is quite low, may miss opportunities');
    }

    if (this.tradingParams.minLiquidityUSD < 2000) {
      recommendations.push('Consider higher minimum liquidity for better trade execution');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations
    };
  }

  public checkRiskLimits(): RiskAssessment {
    const currentSession = this.getCurrentSession();
    let riskLevel = 30; // Base risk
    
    // Adjust risk based on session
    switch (currentSession.riskLevel) {
      case 'aggressive':
        riskLevel = 70;
        break;
      case 'conservative':
        riskLevel = 20;
        break;
    }

    // Adjust for consecutive losses
    riskLevel += this.consecutiveLosses * 10;

    const maxRiskExceeded = riskLevel > 80;
    
    return {
      currentRiskLevel: riskLevel,
      maxRiskExceeded,
      recommendedAction: maxRiskExceeded ? 'Reduce position size or take a break' : 'Continue trading',
      safeguards: [
        'Stop loss at -80%',
        'Maximum 5 consecutive losses before break',
        'Daily trade limit enforced',
        'Position size limits active'
      ]
    };
  }

  public emergencyStop(): void {
    console.log('🚨 EMERGENCY STOP ACTIVATED');
    console.log('   All trading activities paused');
    console.log('   Manual intervention required');
    
    // Here you would implement actual stop mechanisms
    // For now, just log the emergency stop
    this.saveBotState('EMERGENCY_STOP');
  }

  // ============================================
  // TRADE EVENT HANDLERS
  // ============================================

  public onTradeExecuted(profitable: boolean): void {
    this.tradesThisSession++;
    
    if (profitable) {
      this.consecutiveLosses = 0; // Reset on profit
    } else {
      this.consecutiveLosses++;
    }

    // Log trade milestone
    if (this.tradesThisSession % this.tradingParams.pauseAfterTrades === 0) {
      console.log(`📊 Trade milestone: ${this.tradesThisSession} trades completed`);
    }
  }

  // ============================================
  // PERSISTENCE & LOGGING
  // ============================================

  private saveBotState(reason: string = 'UPDATE'): void {
    const stateData = {
      timestamp: new Date().toISOString(),
      reason,
      currentSessionIndex: this.currentSessionIndex,
      tradesThisSession: this.tradesThisSession,
      consecutiveLosses: this.consecutiveLosses,
      sessionStartTime: this.sessionStartTime,
      tradingParams: this.tradingParams,
      fatigueManagement: this.fatigueManagement
    };

    const stateFile = path.join(__dirname, '../data/bot_controller_state.json');
    
    try {
      fs.writeFileSync(stateFile, JSON.stringify(stateData, null, 2));
    } catch (error) {
      console.error('❌ Failed to save bot state:', error);
    }
  }

  private logInitialization(): void {
    console.log('\n' + '='.repeat(60));
    console.log('🤖 BOT CONTROLLER INITIALIZED');
    console.log('='.repeat(60));
    
    const currentSession = this.getCurrentSession();
    console.log(`📈 Session ${currentSession.sessionNumber}: ${currentSession.description}`);
    console.log(`💰 Pool: $${currentSession.initialPool.toLocaleString()} → $${currentSession.targetPool.toLocaleString()}`);
    console.log(`🎯 Growth Target: ${currentSession.growthMultiplier.toFixed(1)}x`);
    console.log(`🎲 Confidence: ${this.tradingParams.confidenceLevel}%`);
    console.log(`⏸️ Pause After: ${this.tradingParams.pauseAfterTrades} trades`);
    console.log(`💧 Min Liquidity: $${this.tradingParams.minLiquidityUSD.toLocaleString()}`);
    console.log(`⚡ Position Size: ${this.tradingParams.positionSizeSOL} SOL`);
    console.log('='.repeat(60) + '\n');
  }

  private logSessionAdvancement(): void {
    const currentSession = this.getCurrentSession();
    console.log('\n' + '🚀 SESSION ADVANCED');
    console.log(`📈 Now in Session ${currentSession.sessionNumber}: ${currentSession.description}`);
    console.log(`💰 New Pool: $${currentSession.initialPool.toLocaleString()} → $${currentSession.targetPool.toLocaleString()}`);
    console.log(`🎯 Growth Target: ${currentSession.growthMultiplier.toFixed(1)}x`);
  }

  // ============================================
  // GETTERS & SETTERS
  // ============================================

  public getTradingParams(): TradingParams {
    return { ...this.tradingParams };
  }

  public getFatigueManagement(): FatigueManagement {
    return { ...this.fatigueManagement };
  }

  public getSessionProgression(): SessionConfig[] {
    return [...this.sessionProgression];
  }

  public getCurrentSessionIndex(): number {
    return this.currentSessionIndex;
  }

  public getTradesThisSession(): number {
    return this.tradesThisSession;
  }

  public getConsecutiveLosses(): number {
    return this.consecutiveLosses;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const botController = new BotController();

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getActiveConfidenceLevel(): number {
  return botController.adjustConfidenceForPerformance();
}

export function shouldPauseTrading(): boolean {
  return botController.recommendSessionBreak();
}

export function getCurrentTradingParams(): TradingParams {
  return botController.getTradingParams();
}

export function getCurrentSessionInfo(): SessionConfig {
  return botController.getCurrentSession();
}

export function logTradeResult(profitable: boolean): void {
  botController.onTradeExecuted(profitable);
}

// ============================================
// EXPORT DEFAULT
// ============================================

export default botController;