import { SessionConfig } from './UNIFIED-CONTROL';
import { SmartConfigValidator } from './SMART-CONFIG-VALIDATOR';
import { ConfigHistory } from './CONFIG-HISTORY';

interface UserGoals {
  startingCapital: number;
  riskTolerance: 'low' | 'medium' | 'high';
  targetProfit: number;
  timeframe: 'day' | 'week' | 'month';
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  maxDrawdown?: number; // Maximum acceptable loss %
  preferredStyle?: 'conservative' | 'balanced' | 'aggressive';
}

interface OptimalConfig {
  initialPool: number;
  positionSizeUSD: number;
  positionSizePercent: number;
  maxTrades: number;
  maxTradesPerSession: number;
  maxPositions: number;
  sessions: SessionConfig[];
  safetyLimits: {
    stopLoss: number;
    maxDrawdown: number;
    cooldownBetweenSessions: number; // hours
  };
  estimatedMetrics: {
    successProbability: number;
    timeToTarget: string;
    worstCaseScenario: number;
    bestCaseScenario: number;
  };
  warnings: string[];
  recommendations: string[];
}

interface RealisticAdjustment {
  original: UserGoals;
  adjusted: UserGoals;
  reasoning: string[];
  alternatives: UserGoals[];
}

class AutoConfig {
  private history: ConfigHistory;
  private riskProfiles: Record<string, any>;

  constructor() {
    this.history = new ConfigHistory();
    this.riskProfiles = {
      low: {
        positionPercent: 2, // 2% per trade
        maxDrawdown: 15,    // 15% max loss
        stopLoss: -10,      // 10% stop loss
        confidenceRequired: 0.8,
        sessionsPreferred: 3
      },
      medium: {
        positionPercent: 4, // 4% per trade
        maxDrawdown: 25,    // 25% max loss
        stopLoss: -15,      // 15% stop loss
        confidenceRequired: 0.6,
        sessionsPreferred: 2
      },
      high: {
        positionPercent: 7, // 7% per trade
        maxDrawdown: 40,    // 40% max loss
        stopLoss: -20,      // 20% stop loss
        confidenceRequired: 0.4,
        sessionsPreferred: 1
      }
    };
  }

  /**
   * Generate optimal configuration based on user goals
   */
  generateOptimalConfig(userInput: UserGoals): OptimalConfig | RealisticAdjustment {
    console.log('\n🤖 AUTO-CONFIG: Analyzing your goals...');

    // Step 1: Validate and potentially adjust unrealistic goals
    const feasibilityCheck = this.checkFeasibility(userInput);
    if (!feasibilityCheck.isRealistic) {
      console.log('⚠️ Goals may be unrealistic, suggesting adjustments...');
      return this.suggestRealisticTarget(userInput, feasibilityCheck.issues);
    }

    // Step 2: Calculate optimal settings
    const config = this.calculateOptimalSettings(userInput);

    // Step 3: Generate session progression
    config.sessions = this.generateSessionProgression(userInput, config);

    // Step 4: Add safety limits
    config.safetyLimits = this.calculateSafetyLimits(userInput);

    // Step 5: Estimate success metrics
    config.estimatedMetrics = this.estimateSuccessMetrics(userInput, config);

    // Step 6: Validate final configuration
    const validation = SmartConfigValidator.validateConfiguration(
      config.sessions,
      config.maxTrades,
      config.maxTradesPerSession,
      config.positionSizeUSD,
      config.maxPositions,
      config.initialPool
    );

    config.warnings = validation.results
      .filter(r => !r.isValid || r.severity === 'warning')
      .map(r => r.message);

    // Step 7: Add recommendations
    config.recommendations = this.generateRecommendations(userInput, config);

    console.log('✅ Optimal configuration generated!');
    return config;
  }

  private checkFeasibility(goals: UserGoals): { isRealistic: boolean; issues: string[] } {
    const issues: string[] = [];
    const requiredMultiplier = goals.targetProfit / goals.startingCapital;

    // Check growth expectations
    if (requiredMultiplier > 100) {
      issues.push(`${requiredMultiplier.toFixed(0)}x growth is extremely ambitious`);
    } else if (requiredMultiplier > 20) {
      issues.push(`${requiredMultiplier.toFixed(1)}x growth is very challenging`);
    }

    // Check timeframe realism
    const dailyGrowthRequired = Math.pow(requiredMultiplier, 1 / this.getTimeframeDays(goals.timeframe));
    if (dailyGrowthRequired > 1.3) { // >30% daily growth
      issues.push(`Requires ${((dailyGrowthRequired - 1) * 100).toFixed(1)}% daily growth`);
    }

    // Check capital adequacy
    if (goals.startingCapital < 50) {
      issues.push('Starting capital may be too low for effective trading');
    }

    // Risk/reward mismatch
    if (goals.riskTolerance === 'low' && requiredMultiplier > 5) {
      issues.push('Low risk tolerance incompatible with high growth target');
    }

    return {
      isRealistic: issues.length === 0,
      issues
    };
  }

  private calculateOptimalSettings(goals: UserGoals): OptimalConfig {
    const riskProfile = this.riskProfiles[goals.riskTolerance];

    // Adjust for experience level
    let experienceMultiplier = 1.0;
    if (goals.experienceLevel === 'beginner') experienceMultiplier = 0.7;
    else if (goals.experienceLevel === 'advanced') experienceMultiplier = 1.3;

    const positionSizePercent = Math.min(
      riskProfile.positionPercent * experienceMultiplier,
      10 // Never exceed 10%
    );

    const positionSizeUSD = (goals.startingCapital * positionSizePercent) / 100;

    // Calculate trade limits based on capital and timeframe
    const maxTradesPerDay = this.calculateMaxTradesPerDay(goals);
    const timeframeDays = this.getTimeframeDays(goals.timeframe);
    const maxTradesTotal = Math.min(200, maxTradesPerDay * timeframeDays);

    // Session-specific limits
    const sessionCount = riskProfile.sessionsPreferred;
    const maxTradesPerSession = Math.ceil(maxTradesTotal / sessionCount);

    // Position limits
    const maxPositions = Math.min(
      20,
      Math.floor(goals.startingCapital / positionSizeUSD / 2) // Can hold half the possible positions
    );

    return {
      initialPool: goals.startingCapital,
      positionSizeUSD: Math.round(positionSizeUSD * 100) / 100,
      positionSizePercent,
      maxTrades: maxTradesTotal,
      maxTradesPerSession,
      maxPositions,
      sessions: [], // Will be filled later
      safetyLimits: {
        stopLoss: 0,
        maxDrawdown: 0,
        cooldownBetweenSessions: 0
      },
      estimatedMetrics: {
        successProbability: 0,
        timeToTarget: '',
        worstCaseScenario: 0,
        bestCaseScenario: 0
      },
      warnings: [],
      recommendations: []
    };
  }

  private calculateMaxTradesPerDay(goals: UserGoals): number {
    // Base trades per day based on risk tolerance
    const baseTrades = {
      low: 8,      // Conservative, quality over quantity
      medium: 15,  // Balanced approach
      high: 25     // Aggressive, more opportunities
    };

    let maxTrades = baseTrades[goals.riskTolerance];

    // Adjust for experience
    if (goals.experienceLevel === 'beginner') {
      maxTrades = Math.floor(maxTrades * 0.6); // Slower pace for beginners
    } else if (goals.experienceLevel === 'advanced') {
      maxTrades = Math.floor(maxTrades * 1.2); // More for experienced traders
    }

    return Math.max(5, maxTrades); // Minimum 5 trades per day
  }

  private getTimeframeDays(timeframe: string): number {
    switch (timeframe) {
      case 'day': return 1;
      case 'week': return 7;
      case 'month': return 30;
      default: return 7;
    }
  }

  private generateSessionProgression(goals: UserGoals, config: OptimalConfig): SessionConfig[] {
    const riskProfile = this.riskProfiles[goals.riskTolerance];
    const sessionCount = riskProfile.sessionsPreferred;
    const sessions: SessionConfig[] = [];

    // Calculate growth per session
    const totalGrowthRequired = goals.targetProfit / goals.startingCapital;
    const growthPerSession = Math.pow(totalGrowthRequired, 1 / sessionCount);

    let currentPool = goals.startingCapital;

    for (let i = 0; i < sessionCount; i++) {
      const sessionNumber = i + 1;
      const isLastSession = sessionNumber === sessionCount;

      // Target for this session
      const targetPool = isLastSession
        ? goals.targetProfit
        : currentPool * growthPerSession;

      const profitRequired = targetPool - currentPool;

      // Adjust position size based on current pool
      const sessionPositionSize = Math.min(
        config.positionSizeUSD,
        (currentPool * config.positionSizePercent) / 100
      );

      // Calculate session-specific trade limits
      const maxTradesThisSession = Math.min(
        config.maxTradesPerSession,
        Math.floor(currentPool / sessionPositionSize)
      );

      // Tax and reinvestment calculations
      const taxReservePercent = 40; // Standard tax reserve
      const reinvestmentPercent = sessionNumber === 1 ? 70 : 50; // More aggressive early on

      const afterTaxProfit = profitRequired * (1 - taxReservePercent / 100);
      const nextSessionPool = isLastSession ? 0 : afterTaxProfit * (reinvestmentPercent / 100);

      // Risk level progression
      let riskLevel: string;
      if (sessionNumber === 1) {
        riskLevel = goals.riskTolerance === 'high' ? 'moderate' : 'conservative';
      } else if (sessionNumber === sessionCount) {
        riskLevel = goals.riskTolerance;
      } else {
        riskLevel = 'moderate';
      }

      const session: SessionConfig = {
        sessionNumber,
        initialPool: Math.round(currentPool * 100) / 100,
        targetPool: Math.round(targetPool * 100) / 100,
        profitRequired: Math.round(profitRequired * 100) / 100,
        growthMultiplier: Math.round((targetPool / currentPool) * 100) / 100,
        maxTrades: maxTradesThisSession,
        positionSizeUSD: Math.round(sessionPositionSize * 100) / 100,
        confidenceAdjustment: sessionNumber > 1 ? (sessionNumber - 1) * 3 : 0,
        taxReservePercent,
        reinvestmentPercent,
        nextSessionPool: Math.round(nextSessionPool * 100) / 100,
        riskLevel: riskLevel as any,
        description: this.getSessionDescription(sessionNumber, sessionCount, goals.timeframe)
      };

      sessions.push(session);

      // Update current pool for next iteration
      if (!isLastSession) {
        currentPool = nextSessionPool > 0 ? nextSessionPool : currentPool * 0.3;
      }
    }

    return sessions;
  }

  private getSessionDescription(sessionNumber: number, totalSessions: number, timeframe: string): string {
    const timeUnit = timeframe === 'day' ? 'day' : timeframe === 'week' ? 'week' : 'month';

    if (totalSessions === 1) {
      return `Complete ${timeUnit} target in single session`;
    }

    const phase = sessionNumber === 1 ? 'Foundation' :
                 sessionNumber === totalSessions ? 'Target Achievement' :
                 sessionNumber === 2 && totalSessions === 3 ? 'Growth Acceleration' :
                 'Progression';

    return `${phase} phase - ${timeframe} strategy session ${sessionNumber}`;
  }

  private calculateSafetyLimits(goals: UserGoals): { stopLoss: number; maxDrawdown: number; cooldownBetweenSessions: number } {
    const riskProfile = this.riskProfiles[goals.riskTolerance];

    return {
      stopLoss: riskProfile.stopLoss,
      maxDrawdown: goals.maxDrawdown || riskProfile.maxDrawdown,
      cooldownBetweenSessions: goals.timeframe === 'day' ? 2 : goals.timeframe === 'week' ? 12 : 24
    };
  }

  private estimateSuccessMetrics(goals: UserGoals, config: OptimalConfig): {
    successProbability: number;
    timeToTarget: string;
    worstCaseScenario: number;
    bestCaseScenario: number;
  } {
    const growthRequired = goals.targetProfit / goals.startingCapital;
    const timeframeDays = this.getTimeframeDays(goals.timeframe);

    // Base success probability calculation
    let successProbability = 70; // Start optimistic

    // Adjust for growth ambition
    if (growthRequired > 10) successProbability -= 30;
    else if (growthRequired > 5) successProbability -= 15;
    else if (growthRequired > 2) successProbability -= 5;

    // Adjust for timeframe pressure
    const dailyGrowthNeeded = Math.pow(growthRequired, 1 / timeframeDays);
    if (dailyGrowthNeeded > 1.1) successProbability -= 20; // >10% daily growth

    // Adjust for risk tolerance
    if (goals.riskTolerance === 'low' && growthRequired > 3) successProbability -= 15;
    if (goals.riskTolerance === 'high') successProbability += 10;

    // Adjust for experience
    if (goals.experienceLevel === 'beginner') successProbability -= 15;
    else if (goals.experienceLevel === 'advanced') successProbability += 10;

    // Historical data adjustment
    const completedSessions = this.history.getCompletedSessions();
    if (completedSessions.length > 5) {
      const avgSuccess = completedSessions.filter(s => s.results!.roi > 0).length / completedSessions.length;
      successProbability = (successProbability + (avgSuccess * 100)) / 2; // Blend with historical
    }

    successProbability = Math.max(10, Math.min(90, successProbability));

    // Time estimate
    const estimatedDays = Math.ceil(timeframeDays * (100 / successProbability));
    const timeToTarget = estimatedDays <= 1 ? '1 day' :
                        estimatedDays <= 7 ? `${estimatedDays} days` :
                        estimatedDays <= 30 ? `${Math.ceil(estimatedDays / 7)} weeks` :
                        `${Math.ceil(estimatedDays / 30)} months`;

    // Scenario analysis
    const worstCaseScenario = goals.startingCapital * (1 - config.safetyLimits.maxDrawdown / 100);
    const bestCaseScenario = goals.targetProfit * 1.5; // 50% better than target

    return {
      successProbability: Math.round(successProbability),
      timeToTarget,
      worstCaseScenario,
      bestCaseScenario
    };
  }

  private generateRecommendations(goals: UserGoals, config: OptimalConfig): string[] {
    const recommendations: string[] = [];

    // Position sizing recommendations
    if (config.positionSizePercent > 8) {
      recommendations.push('Consider reducing position size for safer trading');
    } else if (config.positionSizePercent < 2) {
      recommendations.push('Position size is very conservative - growth may be slow');
    }

    // Session count recommendations
    if (config.sessions.length === 1 && goals.targetProfit / goals.startingCapital > 5) {
      recommendations.push('Consider splitting into multiple sessions for better risk management');
    }

    // Experience-based recommendations
    if (goals.experienceLevel === 'beginner') {
      recommendations.push('Start with paper trading to validate strategy');
      recommendations.push('Focus on learning rather than maximizing profits initially');
    }

    // Timeframe recommendations
    if (goals.timeframe === 'day' && goals.targetProfit / goals.startingCapital > 2) {
      recommendations.push('Daily targets >2x are very challenging - consider weekly timeframe');
    }

    // Risk-specific recommendations
    if (goals.riskTolerance === 'low' && config.estimatedMetrics.successProbability < 60) {
      recommendations.push('Consider reducing target profit or increasing timeframe');
    }

    return recommendations;
  }

  private suggestRealisticTarget(goals: UserGoals, issues: string[]): RealisticAdjustment {
    console.log('🔧 Generating realistic alternatives...');

    const alternatives: UserGoals[] = [];

    // Alternative 1: Reduce target profit
    const conservativeMultiplier = goals.riskTolerance === 'low' ? 2 :
                                  goals.riskTolerance === 'medium' ? 3 : 5;
    alternatives.push({
      ...goals,
      targetProfit: goals.startingCapital * conservativeMultiplier
    });

    // Alternative 2: Extend timeframe
    const longerTimeframe = goals.timeframe === 'day' ? 'week' :
                           goals.timeframe === 'week' ? 'month' : 'month';
    alternatives.push({
      ...goals,
      timeframe: longerTimeframe
    });

    // Alternative 3: Increase starting capital
    if (goals.startingCapital < 500) {
      alternatives.push({
        ...goals,
        startingCapital: Math.max(500, goals.startingCapital * 2)
      });
    }

    // Alternative 4: Balanced adjustment
    alternatives.push({
      ...goals,
      targetProfit: goals.startingCapital * (conservativeMultiplier + 1),
      timeframe: longerTimeframe,
      riskTolerance: goals.riskTolerance === 'low' ? 'medium' : goals.riskTolerance
    });

    const reasoning = [
      `Original target requires ${(goals.targetProfit / goals.startingCapital).toFixed(1)}x growth`,
      ...issues,
      'Suggested alternatives balance ambition with achievability'
    ];

    return {
      original: goals,
      adjusted: alternatives[3], // Balanced alternative as main suggestion
      reasoning,
      alternatives
    };
  }

  /**
   * Quick configuration for common scenarios
   */
  getPresetConfig(preset: 'conservative' | 'balanced' | 'aggressive', startingCapital: number): OptimalConfig {
    const presets = {
      conservative: {
        startingCapital,
        riskTolerance: 'low' as const,
        targetProfit: startingCapital * 2,
        timeframe: 'month' as const,
        experienceLevel: 'beginner' as const
      },
      balanced: {
        startingCapital,
        riskTolerance: 'medium' as const,
        targetProfit: startingCapital * 5,
        timeframe: 'week' as const,
        experienceLevel: 'intermediate' as const
      },
      aggressive: {
        startingCapital,
        riskTolerance: 'high' as const,
        targetProfit: startingCapital * 10,
        timeframe: 'week' as const,
        experienceLevel: 'advanced' as const
      }
    };

    const goals = presets[preset];
    const result = this.generateOptimalConfig(goals);

    // Should always return OptimalConfig for presets
    return result as OptimalConfig;
  }

  /**
   * Validate if goals are achievable
   */
  isAchievable(config: OptimalConfig, targetProfit: number): boolean {
    // Simple achievability check
    const requiredWinRate = 0.6; // Assume 60% win rate needed
    const avgProfitPerTrade = (targetProfit - config.initialPool) / config.maxTrades;
    const avgProfitPercent = (avgProfitPerTrade / config.positionSizeUSD) * 100;

    // If we need >200% per trade on average, it's probably not achievable
    return avgProfitPercent <= 200 && config.estimatedMetrics.successProbability >= 30;
  }

  /**
   * Generate summary of the auto-configuration
   */
  generateConfigSummary(config: OptimalConfig): string {
    let summary = '\n🤖 AUTO-GENERATED CONFIGURATION SUMMARY\n';
    summary += '='.repeat(50) + '\n\n';

    summary += `💰 TRADING SETUP:\n`;
    summary += `   Initial Pool: $${config.initialPool.toLocaleString()}\n`;
    summary += `   Position Size: $${config.positionSizeUSD} (${config.positionSizePercent.toFixed(1)}% per trade)\n`;
    summary += `   Max Trades: ${config.maxTrades} total, ${config.maxTradesPerSession} per session\n`;
    summary += `   Max Positions: ${config.maxPositions} concurrent\n\n`;

    summary += `📊 SESSIONS (${config.sessions.length}):\n`;
    config.sessions.forEach((session, index) => {
      summary += `   Session ${index + 1}: $${session.initialPool.toLocaleString()} → $${session.targetPool.toLocaleString()} (${session.growthMultiplier}x)\n`;
    });

    summary += `\n🛡️ SAFETY LIMITS:\n`;
    summary += `   Stop Loss: ${config.safetyLimits.stopLoss}%\n`;
    summary += `   Max Drawdown: ${config.safetyLimits.maxDrawdown}%\n`;
    summary += `   Session Cooldown: ${config.safetyLimits.cooldownBetweenSessions} hours\n\n`;

    summary += `📈 ESTIMATED OUTCOMES:\n`;
    summary += `   Success Probability: ${config.estimatedMetrics.successProbability}%\n`;
    summary += `   Time to Target: ${config.estimatedMetrics.timeToTarget}\n`;
    summary += `   Best Case: $${config.estimatedMetrics.bestCaseScenario.toLocaleString()}\n`;
    summary += `   Worst Case: $${config.estimatedMetrics.worstCaseScenario.toLocaleString()}\n`;

    if (config.warnings.length > 0) {
      summary += `\n⚠️ WARNINGS:\n`;
      config.warnings.forEach(warning => {
        summary += `   • ${warning}\n`;
      });
    }

    if (config.recommendations.length > 0) {
      summary += `\n💡 RECOMMENDATIONS:\n`;
      config.recommendations.forEach(rec => {
        summary += `   • ${rec}\n`;
      });
    }

    summary += '\n' + '='.repeat(50) + '\n';

    return summary;
  }
}

export { AutoConfig, UserGoals, OptimalConfig, RealisticAdjustment };