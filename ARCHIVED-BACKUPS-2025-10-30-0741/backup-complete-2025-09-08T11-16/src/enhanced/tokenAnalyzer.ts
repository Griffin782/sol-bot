// tokenAnalyzer.ts - Real-time 5x+ Token Detection System
import { PerformanceLogger } from './performanceLogger';

interface Signal {
  strength: number; // 0-100
  type: 'volume' | 'momentum' | 'pattern' | 'whale';
  description: string;
}

interface HoldDecision {
  shouldHold: boolean;
  extendMinutes: number;
  confidence: number;
  signals: Signal[];
  suggestedExitTiers: ExitTier[];
}

interface ExitTier {
  gainPercent: number;
  sellPercent: number;
  reason: string;
}

export class TokenAnalyzer {
  private logger: PerformanceLogger;
  
  // Thresholds based on your sample 5x+ tokens
  private readonly VOLUME_THRESHOLDS = {
    minFirst30Seconds: 50000,      // $50k volume in first 30s
    accelerationRate: 0.5,          // 50% increase per interval
    sustainedGrowth: 0.3,           // 30% consistent growth
    whaleThreshold: 10000           // $10k+ single transactions
  };
  
  private readonly MOMENTUM_THRESHOLDS = {
    shortTermGain: 0.15,            // 15% in 30 seconds
    acceleratingMomentum: 0.05,     // 5% acceleration rate
    higherLowsCount: 3,             // 3+ higher lows
    maxPullback: 0.25               // Max 25% pullback from high
  };
  
  constructor(logger: PerformanceLogger) {
    this.logger = logger;
  }

  // Main analysis function - called every 5 seconds
  analyzeToken(
    tokenAddress: string,
    currentPrice: number,
    currentVolume: number,
    holdTime: number,
    currentGain: number
  ): HoldDecision {
    const signals: Signal[] = [];
    let totalStrength = 0;
    
    // 1. Volume Analysis
    const volumeSignal = this.analyzeVolume(tokenAddress, currentVolume);
    if (volumeSignal) {
      signals.push(volumeSignal);
      totalStrength += volumeSignal.strength;
    }
    
    // 2. Momentum Analysis
    const momentumSignal = this.analyzeMomentum(tokenAddress, currentPrice, currentGain);
    if (momentumSignal) {
      signals.push(momentumSignal);
      totalStrength += momentumSignal.strength;
    }
    
    // 3. Pattern Recognition
    const patternSignal = this.analyzePatterns(tokenAddress);
    if (patternSignal) {
      signals.push(patternSignal);
      totalStrength += patternSignal.strength;
    }
    
    // 4. Whale Detection
    const whaleSignal = this.detectWhaleActivity(tokenAddress, currentVolume);
    if (whaleSignal) {
      signals.push(whaleSignal);
      totalStrength += whaleSignal.strength;
    }
    
    // Make hold decision
    const decision = this.makeHoldDecision(
      signals,
      totalStrength,
      currentGain,
      holdTime
    );
    
    return decision;
  }

  // Analyze volume patterns for 5x+ indicators
  private analyzeVolume(tokenAddress: string, currentVolume: number): Signal | null {
    // Get recent volume data from logger
    // This would interface with the PerformanceLogger
    
    const volumeROC = this.calculateVolumeROC(tokenAddress);
    
    if (volumeROC > this.VOLUME_THRESHOLDS.accelerationRate) {
      return {
        strength: Math.min(volumeROC * 100, 100),
        type: 'volume',
        description: `Volume accelerating at ${(volumeROC * 100).toFixed(1)}% rate`
      };
    }
    
    return null;
  }

  // Analyze price momentum
  private analyzeMomentum(tokenAddress: string, currentPrice: number, currentGain: number): Signal | null {
    // Short-term momentum check
    if (currentGain < 30) {
      // Early stage - look for explosive momentum
      const momentumScore = this.calculateMomentumScore(tokenAddress, currentPrice);
      
      if (momentumScore > this.MOMENTUM_THRESHOLDS.shortTermGain) {
        return {
          strength: Math.min(momentumScore * 500, 100),
          type: 'momentum',
          description: `Strong early momentum: ${(momentumScore * 100).toFixed(1)}%`
        };
      }
    } else {
      // Later stage - look for sustained momentum
      const isAccelerating = this.checkMomentumAcceleration(tokenAddress);
      
      if (isAccelerating) {
        return {
          strength: 70,
          type: 'momentum',
          description: 'Momentum still accelerating after initial pump'
        };
      }
    }
    
    return null;
  }

  // Detect chart patterns that precede 5x+ moves
  private analyzePatterns(tokenAddress: string): Signal | null {
    const patterns = [];
    
    // 1. Higher lows (bullish continuation)
    if (this.hasHigherLows(tokenAddress)) {
      patterns.push('higher_lows');
    }
    
    // 2. Consolidation after pump (preparation for next leg)
    if (this.isConsolidating(tokenAddress)) {
      patterns.push('consolidation');
    }
    
    // 3. Volume dry-up before explosion
    if (this.detectVolumeCompression(tokenAddress)) {
      patterns.push('volume_compression');
    }
    
    if (patterns.length >= 2) {
      return {
        strength: patterns.length * 30,
        type: 'pattern',
        description: `Bullish patterns detected: ${patterns.join(', ')}`
      };
    }
    
    return null;
  }

  // Detect whale accumulation
  private detectWhaleActivity(tokenAddress: string, currentVolume: number): Signal | null {
    // Look for large single transactions
    // This would need integration with transaction monitoring
    
    const whaleVolume = this.getWhaleVolume(tokenAddress);
    const whaleRatio = whaleVolume / currentVolume;
    
    if (whaleRatio > 0.3) { // 30%+ volume from whales
      return {
        strength: Math.min(whaleRatio * 150, 100),
        type: 'whale',
        description: `Whale accumulation: ${(whaleRatio * 100).toFixed(1)}% of volume`
      };
    }
    
    return null;
  }

  // Make the final hold/sell decision
  private makeHoldDecision(
    signals: Signal[],
    totalStrength: number,
    currentGain: number,
    holdTime: number
  ): HoldDecision {
    const avgStrength = signals.length > 0 ? totalStrength / signals.length : 0;
    const confidence = Math.min(avgStrength / 100, 1);
    
    // Dynamic hold decision based on signals
    let shouldHold = false;
    let extendMinutes = 0;
    
    if (currentGain < 100) {
      // Under 2x - hold if any strong signals
      shouldHold = avgStrength > 40;
      extendMinutes = avgStrength > 60 ? 15 : 10;
    } else if (currentGain < 300) {
      // 2x-4x - need stronger signals to hold
      shouldHold = avgStrength > 50;
      extendMinutes = avgStrength > 70 ? 10 : 5;
    } else if (currentGain < 500) {
      // 4x-6x - only hold with very strong signals
      shouldHold = avgStrength > 60;
      extendMinutes = avgStrength > 80 ? 10 : 3;
    } else {
      // 6x+ - hold if momentum continues
      shouldHold = avgStrength > 70;
      extendMinutes = 5;
    }
    
    // Generate exit tiers based on signal strength
    const exitTiers = this.generateExitTiers(avgStrength, currentGain);
    
    return {
      shouldHold,
      extendMinutes,
      confidence,
      signals,
      suggestedExitTiers: exitTiers
    };
  }

  // Generate dynamic exit strategy
  private generateExitTiers(signalStrength: number, currentGain: number): ExitTier[] {
    if (signalStrength > 70) {
      // Very strong signals - aggressive hold
      return [
        { gainPercent: 200, sellPercent: 20, reason: 'Initial profit taking' },
        { gainPercent: 400, sellPercent: 20, reason: 'Secure more gains' },
        { gainPercent: 600, sellPercent: 20, reason: 'Lock in 6x' },
        { gainPercent: 1000, sellPercent: 20, reason: 'Take 10x profits' }
        // Keep 20% as moon bag
      ];
    } else if (signalStrength > 50) {
      // Moderate signals - balanced approach
      return [
        { gainPercent: 100, sellPercent: 25, reason: 'Take initial 2x' },
        { gainPercent: 300, sellPercent: 25, reason: 'Secure 4x gains' },
        { gainPercent: 500, sellPercent: 25, reason: 'Lock in 6x' }
        // Keep 25% for potential upside
      ];
    } else {
      // Weak signals - conservative exit
      return [
        { gainPercent: 50, sellPercent: 33, reason: 'Early profit taking' },
        { gainPercent: 100, sellPercent: 33, reason: 'Secure 2x' },
        { gainPercent: 200, sellPercent: 34, reason: 'Full exit at 3x' }
      ];
    }
  }

  // Helper methods (these would interface with PerformanceLogger data)
  private calculateVolumeROC(tokenAddress: string): number {
    // Implementation would get data from logger
    return 0;
  }
  
  private calculateMomentumScore(tokenAddress: string, currentPrice: number): number {
    // Implementation would calculate from OHLC data
    return 0;
  }
  
  private checkMomentumAcceleration(tokenAddress: string): boolean {
    // Check if momentum is increasing
    return false;
  }
  
  private hasHigherLows(tokenAddress: string): boolean {
    // Check for higher lows pattern
    return false;
  }
  
  private isConsolidating(tokenAddress: string): boolean {
    // Check for consolidation pattern
    return false;
  }
  
  private detectVolumeCompression(tokenAddress: string): boolean {
    // Check for volume compression before breakout
    return false;
  }
  
  private getWhaleVolume(tokenAddress: string): number {
    // Get volume from large transactions
    return 0;
  }

  // Generate real-time insights
  generateInsights(tokenAddress: string): string {
    const decision = this.analyzeToken(tokenAddress, 0, 0, 0, 0);
    
    let insight = `📊 Token Analysis\n`;
    insight += `Confidence: ${(decision.confidence * 100).toFixed(1)}%\n`;
    insight += `Signals:\n`;
    
    decision.signals.forEach(signal => {
      const emoji = signal.type === 'volume' ? '📈' :
                    signal.type === 'momentum' ? '🚀' :
                    signal.type === 'pattern' ? '📉' : '🐋';
      insight += `  ${emoji} ${signal.description} (${signal.strength.toFixed(0)}%)\n`;
    });
    
    insight += decision.shouldHold ? 
      `✅ HOLD for ${decision.extendMinutes} more minutes` :
      `❌ Consider exit based on tiers`;
    
    return insight;
  }
}