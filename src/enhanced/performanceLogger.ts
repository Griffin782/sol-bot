// performanceLogger.ts - Real-time OHLC and Volume Tracking
import { Connection, PublicKey } from '@solana/web3.js';

interface OHLCCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volumeROC?: number; // Rate of change from previous candle
}

interface TokenTradeLog {
  tokenAddress: string;
  tokenSymbol: string;
  entryTime: number;
  entryPrice: number;
  exitTime?: number;
  exitPrice?: number;
  maxPrice: number;
  minPrice: number;
  maxGainPercent: number;
  finalGainPercent?: number;
  candles: OHLCCandle[];
  volumePattern: {
    first30Seconds: number;
    first60Seconds: number;
    peakVolumeROC: number;
    volumeAcceleration: boolean[];
  };
  pricePattern: {
    higherLows: number[];
    pullbackDepths: number[];
    momentumScore: number[];
  };
  exitReason?: string;
  potentialMax?: number; // Track what it reached after exit
}

export class PerformanceLogger {
  private activeTrades: Map<string, TokenTradeLog> = new Map();
  private completedTrades: TokenTradeLog[] = [];
  private currentCandles: Map<string, OHLCCandle> = new Map();
  private candleInterval = 5000; // 5 seconds
  
  constructor(private connection: Connection) {
    this.startCandleTimer();
  }

  // Start tracking a new token
  startTracking(tokenAddress: string, tokenSymbol: string, entryPrice: number) {
    const log: TokenTradeLog = {
      tokenAddress,
      tokenSymbol,
      entryTime: Date.now(),
      entryPrice,
      maxPrice: entryPrice,
      minPrice: entryPrice,
      maxGainPercent: 0,
      candles: [],
      volumePattern: {
        first30Seconds: 0,
        first60Seconds: 0,
        peakVolumeROC: 0,
        volumeAcceleration: []
      },
      pricePattern: {
        higherLows: [],
        pullbackDepths: [],
        momentumScore: []
      }
    };
    
    this.activeTrades.set(tokenAddress, log);
    
    // Initialize first candle
    this.currentCandles.set(tokenAddress, {
      timestamp: Date.now(),
      open: entryPrice,
      high: entryPrice,
      low: entryPrice,
      close: entryPrice,
      volume: 0
    });
  }

  // Update price and volume data
  updatePrice(tokenAddress: string, price: number, volume: number) {
    const trade = this.activeTrades.get(tokenAddress);
    const candle = this.currentCandles.get(tokenAddress);
    
    if (!trade || !candle) return;
    
    // Update current candle
    candle.high = Math.max(candle.high, price);
    candle.low = Math.min(candle.low, price);
    candle.close = price;
    candle.volume += volume;
    
    // Update trade metrics
    trade.maxPrice = Math.max(trade.maxPrice, price);
    trade.minPrice = Math.min(trade.minPrice, price);
    trade.maxGainPercent = ((trade.maxPrice - trade.entryPrice) / trade.entryPrice) * 100;
    
    // Calculate momentum
    this.calculateMomentum(trade, price);
    
    // Check for volume patterns
    this.analyzeVolumePattern(trade, candle);
  }

  // Close candle and start new one every 5 seconds
  private startCandleTimer() {
    setInterval(() => {
      this.activeTrades.forEach((trade, tokenAddress) => {
        const currentCandle = this.currentCandles.get(tokenAddress);
        if (!currentCandle) return;
        
        // Calculate volume ROC if we have previous candles
        if (trade.candles.length > 0) {
          const prevCandle = trade.candles[trade.candles.length - 1];
          currentCandle.volumeROC = prevCandle.volume > 0 
            ? ((currentCandle.volume - prevCandle.volume) / prevCandle.volume) * 100
            : 0;
        }
        
        // Save completed candle
        trade.candles.push({ ...currentCandle });
        
        // Start new candle
        this.currentCandles.set(tokenAddress, {
          timestamp: Date.now(),
          open: currentCandle.close,
          high: currentCandle.close,
          low: currentCandle.close,
          close: currentCandle.close,
          volume: 0
        });
        
        // Analyze patterns
        this.detectHigherLows(trade);
        this.detectPullbacks(trade);
      });
    }, this.candleInterval);
  }

  // Calculate price momentum score
  private calculateMomentum(trade: TokenTradeLog, currentPrice: number) {
    if (trade.candles.length < 2) return;
    
    const shortTermCandles = trade.candles.slice(-6); // Last 30 seconds
    const mediumTermCandles = trade.candles.slice(-12); // Last 60 seconds
    
    if (shortTermCandles.length > 0 && mediumTermCandles.length > 0) {
      const shortTermChange = ((currentPrice - shortTermCandles[0].open) / shortTermCandles[0].open) * 100;
      const mediumTermChange = ((currentPrice - mediumTermCandles[0].open) / mediumTermCandles[0].open) * 100;
      
      const momentumScore = shortTermChange > mediumTermChange ? shortTermChange - mediumTermChange : 0;
      trade.pricePattern.momentumScore.push(momentumScore);
    }
  }

  // Analyze volume patterns for 5x+ indicators
  private analyzeVolumePattern(trade: TokenTradeLog, candle: OHLCCandle) {
    const timeSinceEntry = Date.now() - trade.entryTime;
    
    // Track first 30/60 second volumes
    if (timeSinceEntry <= 30000) {
      trade.volumePattern.first30Seconds += candle.volume;
    }
    if (timeSinceEntry <= 60000) {
      trade.volumePattern.first60Seconds += candle.volume;
    }
    
    // Track peak volume ROC
    if (candle.volumeROC && candle.volumeROC > trade.volumePattern.peakVolumeROC) {
      trade.volumePattern.peakVolumeROC = candle.volumeROC;
    }
    
    // Detect volume acceleration (>50% increase)
    if (candle.volumeROC && candle.volumeROC > 50) {
      trade.volumePattern.volumeAcceleration.push(true);
    } else {
      trade.volumePattern.volumeAcceleration.push(false);
    }
  }

  // Detect higher lows pattern
  private detectHigherLows(trade: TokenTradeLog) {
    if (trade.candles.length < 10) return;
    
    const recentCandles = trade.candles.slice(-10);
    const lows = recentCandles.map(c => c.low);
    
    // Find local minima
    for (let i = 1; i < lows.length - 1; i++) {
      if (lows[i] < lows[i-1] && lows[i] < lows[i+1]) {
        trade.pricePattern.higherLows.push(lows[i]);
      }
    }
    
    // Check if lows are ascending
    if (trade.pricePattern.higherLows.length >= 2) {
      const lastTwo = trade.pricePattern.higherLows.slice(-2);
      return lastTwo[1] > lastTwo[0];
    }
    return false;
  }

  // Detect and measure pullback depths
  private detectPullbacks(trade: TokenTradeLog) {
    if (trade.candles.length < 3) return;
    
    const lastCandle = trade.candles[trade.candles.length - 1];
    const pullbackDepth = ((trade.maxPrice - lastCandle.low) / trade.maxPrice) * 100;
    
    if (pullbackDepth > 5) { // Significant pullback
      trade.pricePattern.pullbackDepths.push(pullbackDepth);
    }
  }

  // Exit a trade and log final metrics
  exitTrade(tokenAddress: string, exitPrice: number, exitReason: string) {
    const trade = this.activeTrades.get(tokenAddress);
    if (!trade) return;
    
    trade.exitTime = Date.now();
    trade.exitPrice = exitPrice;
    trade.finalGainPercent = ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
    trade.exitReason = exitReason;
    
    // Continue tracking for 5 minutes after exit to see potential
    this.trackPostExit(trade);
    
    // Move to completed trades
    this.completedTrades.push(trade);
    this.activeTrades.delete(tokenAddress);
    
    // Log if this was a potential 5x+ miss
    if (trade.maxGainPercent > 500 && trade.finalGainPercent < 200) {
      console.log(`⚠️ MISSED 5x+ OPPORTUNITY: ${trade.tokenSymbol}`);
      console.log(`   Exit: ${trade.finalGainPercent.toFixed(2)}%, Max: ${trade.maxGainPercent.toFixed(2)}%`);
      console.log(`   Volume Pattern:`, trade.volumePattern);
    }
  }

  // Track token for 5 minutes after exit to see what we missed
  private async trackPostExit(trade: TokenTradeLog) {
    // Implementation would continue monitoring price
    // This helps identify patterns in tokens that went 5x+ after early exit
    setTimeout(async () => {
      // Fetch current price and update potentialMax
      // This helps identify what patterns we should have held for
    }, 300000); // 5 minutes
  }

  // Generate analysis report
  generateReport(): {
    totalTrades: number;
    missed5xCount: number;
    averageExitGain: number;
    averageMaxGain: number;
    patterns: any;
  } {
    const missed5x = this.completedTrades.filter(t => 
      t.maxGainPercent > 500 && (t.finalGainPercent || 0) < 200
    );
    
    const avgExit = this.completedTrades.reduce((sum, t) => 
      sum + (t.finalGainPercent || 0), 0
    ) / this.completedTrades.length;
    
    const avgMax = this.completedTrades.reduce((sum, t) => 
      sum + t.maxGainPercent, 0
    ) / this.completedTrades.length;
    
    // Analyze common patterns in 5x+ tokens
    const successfulPatterns = this.analyzeSuccessfulPatterns();
    
    return {
      totalTrades: this.completedTrades.length,
      missed5xCount: missed5x.length,
      averageExitGain: avgExit,
      averageMaxGain: avgMax,
      patterns: successfulPatterns
    };
  }

  // Identify patterns common to 5x+ tokens
  private analyzeSuccessfulPatterns() {
    const highPerformers = this.completedTrades.filter(t => t.maxGainPercent > 500);
    
    if (highPerformers.length === 0) return null;
    
    return {
      avgFirst30SecVolume: highPerformers.reduce((sum, t) => 
        sum + t.volumePattern.first30Seconds, 0
      ) / highPerformers.length,
      
      avgPeakVolumeROC: highPerformers.reduce((sum, t) => 
        sum + t.volumePattern.peakVolumeROC, 0
      ) / highPerformers.length,
      
      volumeAccelerationRate: highPerformers.map(t => {
        const accelerations = t.volumePattern.volumeAcceleration.filter(Boolean).length;
        return accelerations / t.volumePattern.volumeAcceleration.length;
      }),
      
      avgPullbackDepth: highPerformers.map(t => 
        t.pricePattern.pullbackDepths.length > 0 
          ? t.pricePattern.pullbackDepths.reduce((a, b) => a + b, 0) / t.pricePattern.pullbackDepths.length
          : 0
      )
    };
  }

  // Export data for analysis
  exportToCSV(): string {
    const headers = [
      'Symbol', 'Entry Time', 'Entry Price', 'Exit Price', 
      'Final Gain %', 'Max Gain %', 'First 30s Volume', 
      'Peak Volume ROC', 'Exit Reason'
    ].join(',');
    
    const rows = this.completedTrades.map(t => [
      t.tokenSymbol,
      new Date(t.entryTime).toISOString(),
      t.entryPrice,
      t.exitPrice || '',
      t.finalGainPercent?.toFixed(2) || '',
      t.maxGainPercent.toFixed(2),
      t.volumePattern.first30Seconds,
      t.volumePattern.peakVolumeROC.toFixed(2),
      t.exitReason || ''
    ].join(','));
    
    return [headers, ...rows].join('\n');
  }
}