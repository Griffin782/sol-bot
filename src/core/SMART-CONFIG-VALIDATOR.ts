import { SessionConfig } from './UNIFIED-CONTROL';

interface ValidationResult {
  isValid: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface ConfigValidationReport {
  overall: boolean;
  results: ValidationResult[];
  summary: string;
}

class SmartConfigValidator {

  /**
   * Validates all configuration settings and session progression
   */
  static validateConfiguration(
    sessions: SessionConfig[],
    maxTradesAbsolute: number,
    maxTradesPerSession: number,
    positionSizeUSD: number,
    maxPositions: number,
    initialPool: number
  ): ConfigValidationReport {
    const results: ValidationResult[] = [];

    // 1. Trade Limits Validation
    results.push(this.validateTradeLimits(maxTradesAbsolute, maxTradesPerSession));

    // 2. Pool Math Validation
    results.push(this.validatePoolMath(positionSizeUSD, maxPositions, initialPool));

    // 3. Session Progression Validation
    results.push(this.validateSessionProgression(sessions));

    // 4. Individual Session Feasibility
    sessions.forEach((session, index) => {
      results.push(this.validateSessionFeasibility(session, index + 1));
    });

    // 5. Position Size vs Pool Size
    results.push(this.validatePositionSizing(positionSizeUSD, initialPool));

    // 6. Session Flow Continuity
    if (sessions.length > 1) {
      results.push(this.validateSessionFlow(sessions));
    }

    // 7. Risk Level Consistency
    results.push(this.validateRiskProgression(sessions));

    // 8. Target Pool Achievability
    results.push(this.validateTargetRealism(sessions));

    const overall = results.every(r => r.isValid);
    const summary = this.generateSummary(results, overall);

    return {
      overall,
      results,
      summary
    };
  }

  private static validateTradeLimits(maxTradesAbsolute: number, maxTradesPerSession: number): ValidationResult {
    if (maxTradesAbsolute >= maxTradesPerSession) {
      return {
        isValid: true,
        message: `✅ Trade Limits: Valid (Absolute: ${maxTradesAbsolute}, Session: ${maxTradesPerSession})`,
        severity: 'info'
      };
    } else {
      return {
        isValid: false,
        message: `❌ Trade Limits: INVALID - Absolute limit (${maxTradesAbsolute}) must be >= session limit (${maxTradesPerSession})`,
        severity: 'error'
      };
    }
  }

  private static validatePoolMath(positionSizeUSD: number, maxPositions: number, initialPool: number): ValidationResult {
    const maxExposure = positionSizeUSD * maxPositions;

    if (maxExposure <= initialPool) {
      return {
        isValid: true,
        message: `✅ Pool Math: Valid - Max exposure $${maxExposure} within pool $${initialPool}`,
        severity: 'info'
      };
    } else {
      return {
        isValid: false,
        message: `❌ Pool Math: INVALID - Position size $${positionSizeUSD} * ${maxPositions} positions = $${maxExposure} but pool only $${initialPool}`,
        severity: 'error'
      };
    }
  }

  private static validateSessionProgression(sessions: SessionConfig[]): ValidationResult {
    if (sessions.length === 0) {
      return {
        isValid: false,
        message: `❌ Sessions: No sessions defined`,
        severity: 'error'
      };
    }

    // Check if sessions are properly numbered
    for (let i = 0; i < sessions.length; i++) {
      if (sessions[i].sessionNumber !== i + 1) {
        return {
          isValid: false,
          message: `❌ Session Numbering: Session ${i + 1} has sessionNumber ${sessions[i].sessionNumber}`,
          severity: 'error'
        };
      }
    }

    return {
      isValid: true,
      message: `✅ Session Progression: ${sessions.length} sessions properly configured`,
      severity: 'info'
    };
  }

  private static validateSessionFeasibility(session: SessionConfig, sessionNum: number): ValidationResult {
    const maxPossibleTrades = Math.floor(session.initialPool / session.positionSizeUSD);

    if (session.maxTrades <= maxPossibleTrades) {
      return {
        isValid: true,
        message: `✅ Session ${sessionNum}: Feasible (${session.maxTrades} trades possible with $${session.initialPool} pool)`,
        severity: 'info'
      };
    } else {
      return {
        isValid: false,
        message: `❌ Session ${sessionNum}: INFEASIBLE - Need ${session.maxTrades} trades but pool $${session.initialPool} only supports ${maxPossibleTrades} trades at $${session.positionSizeUSD} each`,
        severity: 'error'
      };
    }
  }

  private static validatePositionSizing(positionSizeUSD: number, initialPool: number): ValidationResult {
    const positionPercent = (positionSizeUSD / initialPool) * 100;

    if (positionPercent <= 5) {
      return {
        isValid: true,
        message: `✅ Position Sizing: Conservative (${positionPercent.toFixed(2)}% of pool per trade)`,
        severity: 'info'
      };
    } else if (positionPercent <= 10) {
      return {
        isValid: true,
        message: `⚠️ Position Sizing: Moderate risk (${positionPercent.toFixed(2)}% of pool per trade)`,
        severity: 'warning'
      };
    } else {
      return {
        isValid: false,
        message: `❌ Position Sizing: HIGH RISK - ${positionPercent.toFixed(2)}% of pool per trade exceeds recommended 10% max`,
        severity: 'error'
      };
    }
  }

  private static validateSessionFlow(sessions: SessionConfig[]): ValidationResult {
    const errors: string[] = [];

    for (let i = 1; i < sessions.length; i++) {
      const prevSession = sessions[i - 1];
      const currentSession = sessions[i];

      // Check if current session's initial pool matches previous session's next pool
      const tolerance = 0.01; // $0.01 tolerance for floating point precision
      const diff = Math.abs(currentSession.initialPool - prevSession.nextSessionPool);

      if (diff > tolerance) {
        errors.push(`Session ${i + 1} starts with $${currentSession.initialPool} but Session ${i} ends with $${prevSession.nextSessionPool}`);
      }
    }

    if (errors.length === 0) {
      return {
        isValid: true,
        message: `✅ Session Flow: Valid - Each session flows properly to next`,
        severity: 'info'
      };
    } else {
      return {
        isValid: false,
        message: `❌ Session Flow: BROKEN - ${errors.join('; ')}`,
        severity: 'error'
      };
    }
  }

  private static validateRiskProgression(sessions: SessionConfig[]): ValidationResult {
    if (sessions.length <= 1) {
      return {
        isValid: true,
        message: `✅ Risk Progression: Single session, no progression to validate`,
        severity: 'info'
      };
    }

    // Check for logical risk progression
    const riskLevels = { 'conservative': 1, 'moderate': 2, 'aggressive': 3 };
    let hasLogicalProgression = true;
    let progressionNote = '';

    for (let i = 1; i < sessions.length; i++) {
      const prevRisk = riskLevels[sessions[i - 1].riskLevel as keyof typeof riskLevels] || 2;
      const currentRisk = riskLevels[sessions[i].riskLevel as keyof typeof riskLevels] || 2;

      if (currentRisk < prevRisk - 1) { // Allow for some risk reduction
        hasLogicalProgression = false;
        progressionNote = `Session ${i + 1} has ${sessions[i].riskLevel} risk after ${sessions[i - 1].riskLevel}`;
        break;
      }
    }

    if (hasLogicalProgression) {
      return {
        isValid: true,
        message: `✅ Risk Progression: Logical progression through sessions`,
        severity: 'info'
      };
    } else {
      return {
        isValid: false,
        message: `⚠️ Risk Progression: Questionable - ${progressionNote}`,
        severity: 'warning'
      };
    }
  }

  private static validateTargetRealism(sessions: SessionConfig[]): ValidationResult {
    const warnings: string[] = [];

    sessions.forEach((session, index) => {
      // Check if growth multiplier is realistic
      if (session.growthMultiplier > 20) {
        warnings.push(`Session ${index + 1}: ${session.growthMultiplier.toFixed(1)}x growth may be unrealistic`);
      }

      // Check if profit required is achievable
      const avgTradeProfit = session.profitRequired / session.maxTrades;
      const avgTradeProfitPercent = (avgTradeProfit / session.positionSizeUSD) * 100;

      if (avgTradeProfitPercent > 100) {
        warnings.push(`Session ${index + 1}: Requires ${avgTradeProfitPercent.toFixed(1)}% average profit per trade`);
      }
    });

    if (warnings.length === 0) {
      return {
        isValid: true,
        message: `✅ Target Realism: All targets appear achievable`,
        severity: 'info'
      };
    } else {
      return {
        isValid: true,
        message: `⚠️ Target Realism: ${warnings.join('; ')}`,
        severity: 'warning'
      };
    }
  }

  private static generateSummary(results: ValidationResult[], overall: boolean): string {
    const errors = results.filter(r => !r.isValid && r.severity === 'error').length;
    const warnings = results.filter(r => r.severity === 'warning').length;
    const passed = results.filter(r => r.isValid).length;

    let summary = `\n${'='.repeat(60)}\n`;
    summary += `🔍 SMART CONFIG VALIDATION REPORT\n`;
    summary += `${'='.repeat(60)}\n`;

    if (overall) {
      summary += `✅ OVERALL STATUS: VALID CONFIGURATION\n`;
    } else {
      summary += `❌ OVERALL STATUS: CONFIGURATION HAS ISSUES\n`;
    }

    summary += `\n📊 VALIDATION SUMMARY:\n`;
    summary += `   ✅ Passed: ${passed}/${results.length} checks\n`;
    if (errors > 0) summary += `   ❌ Errors: ${errors}\n`;
    if (warnings > 0) summary += `   ⚠️ Warnings: ${warnings}\n`;

    summary += `\n📋 DETAILED RESULTS:\n`;
    results.forEach(result => {
      summary += `   ${result.message}\n`;
    });

    if (!overall) {
      summary += `\n🚨 RECOMMENDED ACTIONS:\n`;
      const errorResults = results.filter(r => !r.isValid && r.severity === 'error');
      errorResults.forEach((result, index) => {
        summary += `   ${index + 1}. Fix: ${result.message.replace('❌ ', '').split(':')[0]}\n`;
      });
    }

    summary += `\n${'='.repeat(60)}\n`;

    return summary;
  }

  /**
   * Quick validation for specific config values
   */
  static quickValidate(config: {
    maxTradesAbsolute: number;
    maxTradesPerSession: number;
    positionSizeUSD: number;
    initialPool: number;
  }): boolean {
    return (
      config.maxTradesAbsolute >= config.maxTradesPerSession &&
      config.positionSizeUSD > 0 &&
      config.initialPool > config.positionSizeUSD &&
      config.positionSizeUSD <= config.initialPool * 0.1 // Max 10% per trade
    );
  }

  /**
   * Validate a single session configuration
   */
  static validateSingleSession(session: SessionConfig): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Basic math checks
    if (session.targetPool <= session.initialPool) {
      results.push({
        isValid: false,
        message: `❌ Target pool ($${session.targetPool}) must be greater than initial pool ($${session.initialPool})`,
        severity: 'error'
      });
    }

    if (session.profitRequired !== (session.targetPool - session.initialPool)) {
      results.push({
        isValid: false,
        message: `❌ Profit required ($${session.profitRequired}) doesn't match target - initial ($${session.targetPool - session.initialPool})`,
        severity: 'error'
      });
    }

    if (Math.abs(session.growthMultiplier - (session.targetPool / session.initialPool)) > 0.01) {
      results.push({
        isValid: false,
        message: `❌ Growth multiplier (${session.growthMultiplier}) doesn't match calculated ratio (${(session.targetPool / session.initialPool).toFixed(2)})`,
        severity: 'error'
      });
    }

    return results;
  }
}

export { SmartConfigValidator, ValidationResult, ConfigValidationReport };