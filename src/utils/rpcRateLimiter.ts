/**
 * Smart RPC Rate Limiter
 *
 * Purpose: Monitor and throttle RPC requests to stay within Helius limits
 * Tier: Developer (50 req/s = 3,000 req/min)
 *
 * Features:
 * - Real-time request tracking
 * - Adaptive throttling when approaching limits
 * - Warning system before hitting limits
 * - Statistics and monitoring
 */

export interface RateLimiterConfig {
  maxRequestsPerSecond: number;  // 50 for Developer tier
  warningThreshold: number;      // % of limit to trigger warning (e.g., 0.8 = 80%)
  throttleThreshold: number;     // % of limit to start throttling (e.g., 0.9 = 90%)
  windowSize: number;            // Tracking window in ms (1000 = 1 second)
}

export interface RateLimiterStats {
  currentRate: number;           // Requests in current window
  averageRate: number;           // Average over last minute
  peakRate: number;              // Highest rate seen
  totalRequests: number;         // Total since start
  throttleEvents: number;        // Times throttling was triggered
  estimatedUtilization: number;  // % of limit being used
}

export class RPCRateLimiter {
  private requests: number[] = [];           // Timestamps of recent requests
  private config: RateLimiterConfig;
  private stats: RateLimiterStats;
  private warningLogged: boolean = false;

  constructor(config?: Partial<RateLimiterConfig>) {
    this.config = {
      maxRequestsPerSecond: config?.maxRequestsPerSecond || 50,  // Helius Developer tier
      warningThreshold: config?.warningThreshold || 0.7,         // Warn at 70%
      throttleThreshold: config?.throttleThreshold || 0.85,      // Throttle at 85%
      windowSize: config?.windowSize || 1000,                    // 1 second window
    };

    this.stats = {
      currentRate: 0,
      averageRate: 0,
      peakRate: 0,
      totalRequests: 0,
      throttleEvents: 0,
      estimatedUtilization: 0,
    };

    // Cleanup old requests every 5 seconds
    setInterval(() => this.cleanup(), 5000);

    // Log stats every 60 seconds
    setInterval(() => this.logStats(), 60000);
  }

  /**
   * Request permission to make an RPC call
   * Returns delay in ms (0 = proceed immediately, >0 = wait this long)
   */
  public async requestPermit(): Promise<number> {
    const now = Date.now();

    // Clean up old requests outside the window
    this.cleanup();

    // Count requests in current window
    const currentRate = this.requests.filter(
      t => now - t < this.config.windowSize
    ).length;

    this.stats.currentRate = currentRate;
    this.stats.totalRequests++;

    // Update peak rate
    if (currentRate > this.stats.peakRate) {
      this.stats.peakRate = currentRate;
    }

    // Calculate utilization
    const utilization = currentRate / this.config.maxRequestsPerSecond;
    this.stats.estimatedUtilization = utilization;

    // Check if we need to throttle
    if (utilization >= this.config.throttleThreshold) {
      this.stats.throttleEvents++;
      const delay = this.calculateThrottleDelay(utilization);

      console.log(`⚠️ [RATE LIMITER] Throttling: ${currentRate}/${this.config.maxRequestsPerSecond} req/s (${(utilization * 100).toFixed(1)}%) - Delaying ${delay}ms`);

      // Wait before adding this request
      await new Promise(resolve => setTimeout(resolve, delay));

      // Add request after delay
      this.requests.push(Date.now());
      return delay;
    }

    // Check if we should warn
    if (utilization >= this.config.warningThreshold && !this.warningLogged) {
      console.warn(`⚠️ [RATE LIMITER] Warning: Approaching limit ${currentRate}/${this.config.maxRequestsPerSecond} req/s (${(utilization * 100).toFixed(1)}%)`);
      this.warningLogged = true;

      // Reset warning flag after 10 seconds
      setTimeout(() => { this.warningLogged = false; }, 10000);
    }

    // Add request to tracking
    this.requests.push(now);
    return 0;
  }

  /**
   * Calculate adaptive delay based on utilization
   */
  private calculateThrottleDelay(utilization: number): number {
    // Progressive delay based on how close to limit
    // 85% = 100ms, 90% = 200ms, 95% = 500ms, 100% = 1000ms

    if (utilization >= 1.0) {
      return 1000; // At/over limit: 1 second delay
    } else if (utilization >= 0.95) {
      return 500;  // 95%: 500ms delay
    } else if (utilization >= 0.90) {
      return 200;  // 90%: 200ms delay
    } else {
      return 100;  // 85%: 100ms delay
    }
  }

  /**
   * Clean up old requests outside tracking window
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.config.windowSize;

    // Keep only recent requests (within window)
    this.requests = this.requests.filter(t => t > cutoff);

    // Calculate average rate over last minute
    const oneMinuteAgo = now - 60000;
    const requestsInLastMinute = this.requests.filter(t => t > oneMinuteAgo).length;
    this.stats.averageRate = requestsInLastMinute / 60; // Requests per second
  }

  /**
   * Get current statistics
   */
  public getStats(): RateLimiterStats {
    return { ...this.stats };
  }

  /**
   * Log statistics (called every 60 seconds)
   */
  private logStats(): void {
    if (this.stats.totalRequests === 0) return;

    const util = (this.stats.estimatedUtilization * 100).toFixed(1);

    console.log(`📊 [RATE LIMITER] Stats: ${this.stats.currentRate}/${this.config.maxRequestsPerSecond} req/s (${util}%) | Avg: ${this.stats.averageRate.toFixed(1)} req/s | Peak: ${this.stats.peakRate} | Total: ${this.stats.totalRequests} | Throttled: ${this.stats.throttleEvents}`);
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      currentRate: 0,
      averageRate: 0,
      peakRate: 0,
      totalRequests: 0,
      throttleEvents: 0,
      estimatedUtilization: 0,
    };
  }

  /**
   * Update configuration (e.g., when upgrading tier)
   */
  public updateConfig(config: Partial<RateLimiterConfig>): void {
    this.config = { ...this.config, ...config };
    console.log(`✅ [RATE LIMITER] Config updated: ${this.config.maxRequestsPerSecond} req/s limit`);
  }
}

// Singleton instance
export const rpcRateLimiter = new RPCRateLimiter({
  maxRequestsPerSecond: 50,      // Helius Developer tier
  warningThreshold: 0.7,         // Warn at 70% (35 req/s)
  throttleThreshold: 0.85,       // Throttle at 85% (42.5 req/s)
});

/**
 * Wrapper function for RPC calls with rate limiting
 *
 * Usage:
 * const result = await withRateLimit(() => connection.getAccountInfo(address));
 */
export async function withRateLimit<T>(
  rpcCall: () => Promise<T>
): Promise<T> {
  await rpcRateLimiter.requestPermit();
  return rpcCall();
}
