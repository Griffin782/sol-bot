import * as fs from 'fs';
import * as path from 'path';

interface SessionConfig {
  sessionNumber: number;
  initialPool: number;
  targetPool: number;
  positionSizeUSD: number;
  maxTrades: number;
  maxPositions: number;
  riskLevel: string;
  timestamp: string;
  testMode: boolean;
  duration?: number;
  stopLoss?: number;
  takeProfit?: number;
}

interface SessionResults {
  trades: number;
  winRate: number;
  pnl: number;
  roi: number;
  duration: number; // minutes
  finalPool: number;
  peakPool: number;
  issues: string[];
  avgTradeTime: number; // seconds
  topGainer?: {
    token: string;
    profit: number;
  };
  worstLoss?: {
    token: string;
    loss: number;
  };
  tradingPattern: {
    timeOfDay: string;
    tokenTypes: string[];
    exitReasons: string[];
  };
}

interface ConfigHistoryEntry {
  id: string;
  sessionDate: string;
  config: SessionConfig;
  results?: SessionResults;
  status: 'planned' | 'running' | 'completed' | 'failed';
  notes?: string;
}

interface PerformanceMetrics {
  avgWinRate: number;
  avgROI: number;
  totalTrades: number;
  totalPnL: number;
  bestSession: string;
  worstSession: string;
  consistency: number; // variance in results
}

interface OptimizationSuggestion {
  parameter: string;
  currentValue: any;
  suggestedValue: any;
  reasoning: string;
  confidence: number; // 0-100%
  expectedImprovement: string;
}

class ConfigHistory {
  private historyDir: string;
  private analysisDir: string;

  constructor() {
    this.historyDir = './data/config-history';
    this.analysisDir = './data/analysis';
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    [this.historyDir, this.analysisDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Save configuration before session starts
   */
  async savePreSessionConfig(config: SessionConfig): Promise<string> {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sessionId = `${timestamp}-session-${config.sessionNumber}`;

    const entry: ConfigHistoryEntry = {
      id: sessionId,
      sessionDate: timestamp,
      config: {
        ...config,
        timestamp: new Date().toISOString()
      },
      status: 'planned'
    };

    const filePath = path.join(this.historyDir, `${sessionId}.json`);

    try {
      fs.writeFileSync(filePath, JSON.stringify(entry, null, 2));
      console.log(`📁 Configuration saved: ${sessionId}`);
      return sessionId;
    } catch (error) {
      console.error('❌ Failed to save configuration:', error);
      throw error;
    }
  }

  /**
   * Update with session results after completion
   */
  async savePostSessionResults(sessionId: string, results: SessionResults, notes?: string): Promise<void> {
    const filePath = path.join(this.historyDir, `${sessionId}.json`);

    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const entry: ConfigHistoryEntry = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      entry.results = results;
      entry.status = 'completed';
      entry.notes = notes;

      fs.writeFileSync(filePath, JSON.stringify(entry, null, 2));

      console.log(`✅ Session results saved for ${sessionId}`);
      console.log(`   📊 Trades: ${results.trades} | Win Rate: ${(results.winRate * 100).toFixed(1)}% | P&L: $${results.pnl.toFixed(2)}`);

      // Trigger analysis update
      await this.updateAnalysis();

    } catch (error) {
      console.error('❌ Failed to save session results:', error);
      throw error;
    }
  }

  /**
   * Mark session as failed with reason
   */
  async markSessionFailed(sessionId: string, reason: string): Promise<void> {
    const filePath = path.join(this.historyDir, `${sessionId}.json`);

    try {
      if (fs.existsSync(filePath)) {
        const entry: ConfigHistoryEntry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        entry.status = 'failed';
        entry.notes = reason;
        fs.writeFileSync(filePath, JSON.stringify(entry, null, 2));
        console.log(`⚠️ Session ${sessionId} marked as failed: ${reason}`);
      }
    } catch (error) {
      console.error('❌ Failed to mark session as failed:', error);
    }
  }

  /**
   * Get all historical sessions
   */
  getAllSessions(): ConfigHistoryEntry[] {
    try {
      const files = fs.readdirSync(this.historyDir)
        .filter(file => file.endsWith('.json'))
        .sort();

      return files.map(file => {
        const filePath = path.join(this.historyDir, file);
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      });
    } catch (error) {
      console.error('❌ Failed to load session history:', error);
      return [];
    }
  }

  /**
   * Get completed sessions only
   */
  getCompletedSessions(): ConfigHistoryEntry[] {
    return this.getAllSessions().filter(session =>
      session.status === 'completed' && session.results
    );
  }

  /**
   * Calculate performance metrics
   */
  calculatePerformanceMetrics(): PerformanceMetrics {
    const completed = this.getCompletedSessions();

    if (completed.length === 0) {
      return {
        avgWinRate: 0,
        avgROI: 0,
        totalTrades: 0,
        totalPnL: 0,
        bestSession: '',
        worstSession: '',
        consistency: 0
      };
    }

    const winRates = completed.map(s => s.results!.winRate);
    const rois = completed.map(s => s.results!.roi);
    const totalTrades = completed.reduce((sum, s) => sum + s.results!.trades, 0);
    const totalPnL = completed.reduce((sum, s) => sum + s.results!.pnl, 0);

    // Find best and worst sessions
    const bestSession = completed.reduce((best, current) =>
      current.results!.roi > best.results!.roi ? current : best
    );

    const worstSession = completed.reduce((worst, current) =>
      current.results!.roi < worst.results!.roi ? current : worst
    );

    // Calculate consistency (lower variance = more consistent)
    const avgROI = rois.reduce((sum, roi) => sum + roi, 0) / rois.length;
    const variance = rois.reduce((sum, roi) => sum + Math.pow(roi - avgROI, 2), 0) / rois.length;
    const consistency = Math.max(0, 100 - Math.sqrt(variance));

    return {
      avgWinRate: winRates.reduce((sum, wr) => sum + wr, 0) / winRates.length,
      avgROI: avgROI,
      totalTrades,
      totalPnL,
      bestSession: bestSession.id,
      worstSession: worstSession.id,
      consistency
    };
  }

  /**
   * Generate optimization suggestions based on historical data
   */
  generateOptimizationSuggestions(): OptimizationSuggestion[] {
    const completed = this.getCompletedSessions();
    const suggestions: OptimizationSuggestion[] = [];

    if (completed.length < 3) {
      return [{
        parameter: 'data_collection',
        currentValue: completed.length,
        suggestedValue: 'more sessions',
        reasoning: 'Need at least 3 completed sessions for meaningful analysis',
        confidence: 100,
        expectedImprovement: 'Better optimization recommendations'
      }];
    }

    // Analyze position size correlation with win rate
    const positionSizeAnalysis = this.analyzePositionSizeOptimal(completed);
    if (positionSizeAnalysis) {
      suggestions.push(positionSizeAnalysis);
    }

    // Analyze trade count correlation with performance
    const tradeCountAnalysis = this.analyzeOptimalTradeCount(completed);
    if (tradeCountAnalysis) {
      suggestions.push(tradeCountAnalysis);
    }

    // Analyze session duration impact
    const durationAnalysis = this.analyzeOptimalDuration(completed);
    if (durationAnalysis) {
      suggestions.push(durationAnalysis);
    }

    // Analyze risk level effectiveness
    const riskLevelAnalysis = this.analyzeOptimalRiskLevel(completed);
    if (riskLevelAnalysis) {
      suggestions.push(riskLevelAnalysis);
    }

    return suggestions;
  }

  private analyzePositionSizeOptimal(sessions: ConfigHistoryEntry[]): OptimizationSuggestion | null {
    // Group sessions by position size ranges
    const ranges = [
      { min: 0, max: 5, label: '$0-5' },
      { min: 5, max: 10, label: '$5-10' },
      { min: 10, max: 20, label: '$10-20' },
      { min: 20, max: 50, label: '$20-50' },
      { min: 50, max: 999, label: '$50+' }
    ];

    const rangePerformance = ranges.map(range => {
      const sessionsInRange = sessions.filter(s =>
        s.config.positionSizeUSD >= range.min && s.config.positionSizeUSD < range.max
      );

      if (sessionsInRange.length === 0) return null;

      const avgWinRate = sessionsInRange.reduce((sum, s) => sum + s.results!.winRate, 0) / sessionsInRange.length;
      const avgROI = sessionsInRange.reduce((sum, s) => sum + s.results!.roi, 0) / sessionsInRange.length;

      return {
        range: range.label,
        count: sessionsInRange.length,
        avgWinRate,
        avgROI,
        score: avgWinRate * 0.6 + (avgROI / 100) * 0.4 // Weighted score
      };
    }).filter(r => r !== null);

    if (rangePerformance.length < 2) return null;

    const bestRange = rangePerformance.reduce((best, current) =>
      current!.score > best!.score ? current : best
    );

    const currentSession = sessions[sessions.length - 1];
    const currentPositionSize = currentSession.config.positionSizeUSD;

    return {
      parameter: 'positionSizeUSD',
      currentValue: `$${currentPositionSize}`,
      suggestedValue: bestRange!.range,
      reasoning: `Best win rate (${(bestRange!.avgWinRate * 100).toFixed(1)}%) and ROI (${bestRange!.avgROI.toFixed(1)}%) achieved in ${bestRange!.range} range`,
      confidence: Math.min(90, bestRange!.count * 20),
      expectedImprovement: `${((bestRange!.avgWinRate - currentSession.results!.winRate) * 100).toFixed(1)}% better win rate`
    };
  }

  private analyzeOptimalTradeCount(sessions: ConfigHistoryEntry[]): OptimizationSuggestion | null {
    // Analyze correlation between trade count and declining performance
    const tradeCountData = sessions.map(s => ({
      maxTrades: s.config.maxTrades,
      actualTrades: s.results!.trades,
      winRate: s.results!.winRate,
      roi: s.results!.roi
    }));

    // Look for performance decline in longer sessions
    const highTradeCountSessions = tradeCountData.filter(s => s.actualTrades > 40);
    const lowTradeCountSessions = tradeCountData.filter(s => s.actualTrades <= 40);

    if (highTradeCountSessions.length < 2 || lowTradeCountSessions.length < 2) {
      return null;
    }

    const avgHighTradeWinRate = highTradeCountSessions.reduce((sum, s) => sum + s.winRate, 0) / highTradeCountSessions.length;
    const avgLowTradeWinRate = lowTradeCountSessions.reduce((sum, s) => sum + s.winRate, 0) / lowTradeCountSessions.length;

    if (avgLowTradeWinRate > avgHighTradeWinRate + 0.05) { // 5% better win rate
      return {
        parameter: 'maxTrades',
        currentValue: sessions[sessions.length - 1].config.maxTrades,
        suggestedValue: 40,
        reasoning: `Sessions with ≤40 trades show ${((avgLowTradeWinRate - avgHighTradeWinRate) * 100).toFixed(1)}% better win rate`,
        confidence: 75,
        expectedImprovement: 'Higher quality trades, less fatigue, better focus'
      };
    }

    return null;
  }

  private analyzeOptimalDuration(sessions: ConfigHistoryEntry[]): OptimizationSuggestion | null {
    const durationsWithPerformance = sessions
      .filter(s => s.results!.duration)
      .map(s => ({
        duration: s.results!.duration,
        winRate: s.results!.winRate,
        roi: s.results!.roi
      }));

    if (durationsWithPerformance.length < 3) return null;

    // Find optimal duration range
    const shortSessions = durationsWithPerformance.filter(s => s.duration <= 60); // ≤1 hour
    const longSessions = durationsWithPerformance.filter(s => s.duration > 60);

    if (shortSessions.length < 2 || longSessions.length < 2) return null;

    const avgShortWinRate = shortSessions.reduce((sum, s) => sum + s.winRate, 0) / shortSessions.length;
    const avgLongWinRate = longSessions.reduce((sum, s) => sum + s.winRate, 0) / longSessions.length;

    if (avgShortWinRate > avgLongWinRate + 0.1) { // 10% better
      return {
        parameter: 'sessionDuration',
        currentValue: 'unlimited',
        suggestedValue: '60 minutes',
        reasoning: `Shorter sessions (≤60min) show ${((avgShortWinRate - avgLongWinRate) * 100).toFixed(1)}% better performance`,
        confidence: 70,
        expectedImprovement: 'Reduced fatigue, maintained focus, better decision making'
      };
    }

    return null;
  }

  private analyzeOptimalRiskLevel(sessions: ConfigHistoryEntry[]): OptimizationSuggestion | null {
    const riskGroups = {
      conservative: sessions.filter(s => s.config.riskLevel === 'conservative'),
      moderate: sessions.filter(s => s.config.riskLevel === 'moderate'),
      aggressive: sessions.filter(s => s.config.riskLevel === 'aggressive')
    };

    const riskPerformance = Object.entries(riskGroups)
      .map(([level, sessionsInLevel]) => {
        if (sessionsInLevel.length === 0) return null;

        const avgWinRate = sessionsInLevel.reduce((sum, s) => sum + s.results!.winRate, 0) / sessionsInLevel.length;
        const avgROI = sessionsInLevel.reduce((sum, s) => sum + s.results!.roi, 0) / sessionsInLevel.length;

        return {
          level,
          count: sessionsInLevel.length,
          avgWinRate,
          avgROI,
          consistency: this.calculateConsistency(sessionsInLevel.map(s => s.results!.roi))
        };
      })
      .filter(r => r !== null);

    if (riskPerformance.length < 2) return null;

    // Find best risk level (balance of win rate, ROI, and consistency)
    const bestRisk = riskPerformance.reduce((best, current) => {
      const currentScore = current!.avgWinRate * 0.4 + (current!.avgROI / 100) * 0.3 + current!.consistency * 0.3;
      const bestScore = best!.avgWinRate * 0.4 + (best!.avgROI / 100) * 0.3 + best!.consistency * 0.3;
      return currentScore > bestScore ? current : best;
    });

    const currentRisk = sessions[sessions.length - 1].config.riskLevel;

    if (bestRisk!.level !== currentRisk) {
      return {
        parameter: 'riskLevel',
        currentValue: currentRisk,
        suggestedValue: bestRisk!.level,
        reasoning: `${bestRisk!.level} risk shows best balance: ${(bestRisk!.avgWinRate * 100).toFixed(1)}% win rate, ${bestRisk!.avgROI.toFixed(1)}% ROI, ${bestRisk!.consistency.toFixed(1)}% consistency`,
        confidence: Math.min(85, bestRisk!.count * 15),
        expectedImprovement: 'Better risk-adjusted returns'
      };
    }

    return null;
  }

  private calculateConsistency(rois: number[]): number {
    if (rois.length < 2) return 0;
    const avg = rois.reduce((sum, roi) => sum + roi, 0) / rois.length;
    const variance = rois.reduce((sum, roi) => sum + Math.pow(roi - avg, 2), 0) / rois.length;
    return Math.max(0, 100 - Math.sqrt(variance));
  }

  /**
   * Update analysis file with latest insights
   */
  private async updateAnalysis(): Promise<void> {
    try {
      const metrics = this.calculatePerformanceMetrics();
      const suggestions = this.generateOptimizationSuggestions();

      const analysis = {
        lastUpdated: new Date().toISOString(),
        totalSessions: this.getAllSessions().length,
        completedSessions: this.getCompletedSessions().length,
        metrics,
        suggestions,
        insights: this.generateInsights(metrics, suggestions)
      };

      const analysisPath = path.join(this.analysisDir, 'performance-analysis.json');
      fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));

    } catch (error) {
      console.error('❌ Failed to update analysis:', error);
    }
  }

  private generateInsights(metrics: PerformanceMetrics, suggestions: OptimizationSuggestion[]): string[] {
    const insights: string[] = [];

    if (metrics.avgWinRate > 0.7) {
      insights.push('🎯 Excellent win rate - strategy is working well');
    } else if (metrics.avgWinRate < 0.5) {
      insights.push('⚠️ Low win rate - consider adjusting strategy');
    }

    if (metrics.consistency > 80) {
      insights.push('📊 High consistency - reliable performance across sessions');
    } else if (metrics.consistency < 60) {
      insights.push('📈 Variable results - strategy needs refinement');
    }

    if (suggestions.length > 0) {
      const highConfidenceSuggestions = suggestions.filter(s => s.confidence > 70);
      if (highConfidenceSuggestions.length > 0) {
        insights.push(`🔧 ${highConfidenceSuggestions.length} high-confidence optimization(s) available`);
      }
    }

    return insights;
  }

  /**
   * Generate summary report
   */
  generateSummaryReport(): string {
    const completed = this.getCompletedSessions();
    const metrics = this.calculatePerformanceMetrics();
    const suggestions = this.generateOptimizationSuggestions();

    let report = '\n📊 CONFIG HISTORY ANALYSIS REPORT\n';
    report += '='.repeat(50) + '\n\n';

    report += `📈 PERFORMANCE SUMMARY:\n`;
    report += `   Sessions Completed: ${completed.length}\n`;
    report += `   Average Win Rate: ${(metrics.avgWinRate * 100).toFixed(1)}%\n`;
    report += `   Average ROI: ${metrics.avgROI.toFixed(1)}%\n`;
    report += `   Total Trades: ${metrics.totalTrades.toLocaleString()}\n`;
    report += `   Total P&L: $${metrics.totalPnL.toFixed(2)}\n`;
    report += `   Consistency Score: ${metrics.consistency.toFixed(1)}%\n\n`;

    if (suggestions.length > 0) {
      report += `🔧 OPTIMIZATION SUGGESTIONS:\n`;
      suggestions.forEach((suggestion, index) => {
        report += `   ${index + 1}. ${suggestion.parameter}:\n`;
        report += `      Current: ${suggestion.currentValue}\n`;
        report += `      Suggested: ${suggestion.suggestedValue}\n`;
        report += `      Reason: ${suggestion.reasoning}\n`;
        report += `      Confidence: ${suggestion.confidence}%\n`;
        report += `      Expected: ${suggestion.expectedImprovement}\n\n`;
      });
    } else {
      report += `🔧 No optimization suggestions available yet.\n`;
      report += `   Need more session data for analysis.\n\n`;
    }

    if (completed.length > 0) {
      report += `🏆 BEST SESSION: ${metrics.bestSession}\n`;
      report += `📉 WORST SESSION: ${metrics.worstSession}\n\n`;
    }

    report += '='.repeat(50) + '\n';

    return report;
  }

  /**
   * Export data for external analysis
   */
  exportToCSV(): string {
    const completed = this.getCompletedSessions();
    if (completed.length === 0) return '';

    const headers = [
      'session_id', 'date', 'initial_pool', 'position_size', 'max_trades',
      'risk_level', 'trades_executed', 'win_rate', 'roi', 'pnl', 'duration'
    ];

    const rows = completed.map(session => [
      session.id,
      session.sessionDate,
      session.config.initialPool,
      session.config.positionSizeUSD,
      session.config.maxTrades,
      session.config.riskLevel,
      session.results!.trades,
      session.results!.winRate,
      session.results!.roi,
      session.results!.pnl,
      session.results!.duration
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    const csvPath = path.join(this.analysisDir, 'session-data.csv');
    fs.writeFileSync(csvPath, csvContent);

    return csvPath;
  }
}

export {
  ConfigHistory,
  SessionConfig,
  SessionResults,
  ConfigHistoryEntry,
  PerformanceMetrics,
  OptimizationSuggestion
};