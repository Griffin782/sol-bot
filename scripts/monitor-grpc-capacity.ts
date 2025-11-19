/**
 * gRPC Capacity Monitor
 *
 * Tracks position monitor performance to determine maximum capacity
 * Run this alongside your bot to see real-time metrics
 */

import { PositionMonitor } from '../src/monitoring/positionMonitor';

interface CapacityMetrics {
  timestamp: number;
  activePositions: number;
  updatesReceived: number;
  updatesPerSecond: number;
  avgProcessingTimeMs: number;
  peakProcessingTimeMs: number;
  memoryUsageMB: number;
  cpuUsagePercent: number;
  updateLagMs: number;
}

class CapacityMonitor {
  private metrics: CapacityMetrics[] = [];
  private updateCount = 0;
  private processingTimes: number[] = [];
  private lastCheckTime = Date.now();
  private warningThresholds = {
    cpuPercent: 80,
    lagMs: 200,
    processingMs: 50
  };

  /**
   * Record an update event
   */
  public recordUpdate(processingTimeMs: number): void {
    this.updateCount++;
    this.processingTimes.push(processingTimeMs);

    // Keep only last 100 processing times
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }
  }

  /**
   * Get current metrics snapshot
   */
  public getMetrics(positionMonitor: PositionMonitor): CapacityMetrics {
    const now = Date.now();
    const timeDiff = (now - this.lastCheckTime) / 1000; // seconds

    const avgProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
      : 0;

    const peakProcessingTime = this.processingTimes.length > 0
      ? Math.max(...this.processingTimes)
      : 0;

    const memUsage = process.memoryUsage();
    const memoryUsageMB = memUsage.heapUsed / 1024 / 1024;

    // Calculate updates per second
    const updatesPerSecond = timeDiff > 0 ? this.updateCount / timeDiff : 0;

    const metrics: CapacityMetrics = {
      timestamp: now,
      activePositions: 0, // Would need to expose from positionMonitor
      updatesReceived: this.updateCount,
      updatesPerSecond: Math.round(updatesPerSecond * 10) / 10,
      avgProcessingTimeMs: Math.round(avgProcessingTime * 10) / 10,
      peakProcessingTimeMs: Math.round(peakProcessingTime * 10) / 10,
      memoryUsageMB: Math.round(memoryUsageMB * 10) / 10,
      cpuUsagePercent: 0, // Requires external monitoring
      updateLagMs: 0 // Would calculate from timestamp differences
    };

    // Store metrics
    this.metrics.push(metrics);

    // Keep only last hour of metrics
    const oneHourAgo = now - (60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);

    // Reset counters
    this.updateCount = 0;
    this.lastCheckTime = now;

    return metrics;
  }

  /**
   * Check if system is under stress
   */
  public checkHealth(metrics: CapacityMetrics): { healthy: boolean; warnings: string[] } {
    const warnings: string[] = [];

    if (metrics.cpuUsagePercent > this.warningThresholds.cpuPercent) {
      warnings.push(`⚠️ High CPU usage: ${metrics.cpuUsagePercent}%`);
    }

    if (metrics.updateLagMs > this.warningThresholds.lagMs) {
      warnings.push(`⚠️ High update lag: ${metrics.updateLagMs}ms`);
    }

    if (metrics.avgProcessingTimeMs > this.warningThresholds.processingMs) {
      warnings.push(`⚠️ Slow processing: ${metrics.avgProcessingTimeMs}ms avg`);
    }

    return {
      healthy: warnings.length === 0,
      warnings
    };
  }

  /**
   * Display metrics to console
   */
  public displayMetrics(metrics: CapacityMetrics): void {
    console.log('\n========================================');
    console.log('📊 gRPC CAPACITY MONITOR');
    console.log('========================================');
    console.log(`🎯 Active Positions: ${metrics.activePositions}`);
    console.log(`📨 Updates/sec: ${metrics.updatesPerSecond}`);
    console.log(`⚡ Avg Processing: ${metrics.avgProcessingTimeMs}ms`);
    console.log(`🔥 Peak Processing: ${metrics.peakProcessingTimeMs}ms`);
    console.log(`💾 Memory Usage: ${metrics.memoryUsageMB} MB`);
    console.log(`⏱️  Update Lag: ${metrics.updateLagMs}ms`);

    const health = this.checkHealth(metrics);
    if (health.healthy) {
      console.log(`✅ Status: HEALTHY`);
    } else {
      console.log(`⚠️  Status: STRESSED`);
      health.warnings.forEach(w => console.log(`   ${w}`));
    }

    // Capacity recommendation
    const estimatedMaxPositions = this.estimateMaxCapacity(metrics);
    console.log(`\n💡 Estimated Max Capacity: ${estimatedMaxPositions} positions`);
    console.log('========================================\n');
  }

  /**
   * Estimate maximum capacity based on current metrics
   */
  private estimateMaxCapacity(metrics: CapacityMetrics): number {
    if (metrics.activePositions === 0) return 0;

    // Assume target of 80% CPU and 150ms max processing time
    const cpuHeadroom = 80 / Math.max(metrics.cpuUsagePercent, 10);
    const processingHeadroom = 50 / Math.max(metrics.avgProcessingTimeMs, 1);

    // Use most conservative estimate
    const headroom = Math.min(cpuHeadroom, processingHeadroom);

    return Math.floor(metrics.activePositions * headroom);
  }

  /**
   * Generate capacity report
   */
  public generateReport(): string {
    if (this.metrics.length === 0) {
      return 'No metrics collected yet';
    }

    const avgPositions = this.metrics.reduce((sum, m) => sum + m.activePositions, 0) / this.metrics.length;
    const avgUpdatesPerSec = this.metrics.reduce((sum, m) => sum + m.updatesPerSecond, 0) / this.metrics.length;
    const maxUpdatesPerSec = Math.max(...this.metrics.map(m => m.updatesPerSecond));
    const avgProcessing = this.metrics.reduce((sum, m) => sum + m.avgProcessingTimeMs, 0) / this.metrics.length;
    const maxMemory = Math.max(...this.metrics.map(m => m.memoryUsageMB));

    return `
CAPACITY REPORT
===============
Duration: ${Math.round((Date.now() - this.metrics[0].timestamp) / 60000)} minutes
Samples: ${this.metrics.length}

Average Positions: ${Math.round(avgPositions)}
Average Updates/sec: ${Math.round(avgUpdatesPerSec * 10) / 10}
Peak Updates/sec: ${Math.round(maxUpdatesPerSec * 10) / 10}
Average Processing: ${Math.round(avgProcessing * 10) / 10}ms
Peak Memory: ${Math.round(maxMemory * 10) / 10} MB

RECOMMENDATION:
${this.getCapacityRecommendation(avgPositions, avgProcessing)}
`;
  }

  private getCapacityRecommendation(avgPositions: number, avgProcessing: number): string {
    if (avgPositions === 0) {
      return 'No positions monitored yet - unable to estimate capacity';
    }

    if (avgProcessing < 10) {
      return `✅ System has plenty of headroom. Can likely handle ${Math.floor(avgPositions * 5)}+ positions`;
    } else if (avgProcessing < 30) {
      return `✅ System performing well. Estimated capacity: ${Math.floor(avgPositions * 2)}-${Math.floor(avgPositions * 3)} positions`;
    } else if (avgProcessing < 50) {
      return `⚠️  System under moderate load. Maximum recommended: ${Math.floor(avgPositions * 1.5)} positions`;
    } else {
      return `🚨 System near capacity. Do not exceed ${avgPositions} positions`;
    }
  }
}

// Export for use in main bot
export const capacityMonitor = new CapacityMonitor();

// If run directly, display instructions
if (require.main === module) {
  console.log(`
╔════════════════════════════════════════════════════╗
║   gRPC CAPACITY MONITOR                            ║
╚════════════════════════════════════════════════════╝

This script monitors your bot's position tracking capacity.

TO USE:
1. Import in index.ts:
   import { capacityMonitor } from './scripts/monitor-grpc-capacity';

2. Record updates in positionMonitor callback:
   const startTime = Date.now();
   // ... process update ...
   capacityMonitor.recordUpdate(Date.now() - startTime);

3. Display metrics every 10 seconds:
   setInterval(() => {
     const metrics = capacityMonitor.getMetrics(globalPositionMonitor);
     capacityMonitor.displayMetrics(metrics);
   }, 10000);

4. Generate report on shutdown:
   console.log(capacityMonitor.generateReport());

WHAT TO WATCH:
- ✅ Updates/sec should match: positions × 2.5
- ✅ Avg processing should stay < 30ms
- ✅ Memory usage should be stable
- ⚠️  If lag > 200ms, you're at capacity

CAPACITY GUIDELINES:
- < 10ms processing = Can add more positions
- 10-30ms processing = Good capacity
- 30-50ms processing = Near limit
- > 50ms processing = At or over capacity
  `);
}
