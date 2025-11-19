"use strict";
/**
 * gRPC Capacity Monitor
 *
 * Tracks position monitor performance to determine maximum capacity
 * Run this alongside your bot to see real-time metrics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.capacityMonitor = void 0;
var CapacityMonitor = /** @class */ (function () {
    function CapacityMonitor() {
        this.metrics = [];
        this.updateCount = 0;
        this.processingTimes = [];
        this.lastCheckTime = Date.now();
        this.warningThresholds = {
            cpuPercent: 80,
            lagMs: 200,
            processingMs: 50
        };
    }
    /**
     * Record an update event
     */
    CapacityMonitor.prototype.recordUpdate = function (processingTimeMs) {
        this.updateCount++;
        this.processingTimes.push(processingTimeMs);
        // Keep only last 100 processing times
        if (this.processingTimes.length > 100) {
            this.processingTimes.shift();
        }
    };
    /**
     * Get current metrics snapshot
     */
    CapacityMonitor.prototype.getMetrics = function (positionMonitor) {
        var now = Date.now();
        var timeDiff = (now - this.lastCheckTime) / 1000; // seconds
        var avgProcessingTime = this.processingTimes.length > 0
            ? this.processingTimes.reduce(function (a, b) { return a + b; }, 0) / this.processingTimes.length
            : 0;
        var peakProcessingTime = this.processingTimes.length > 0
            ? Math.max.apply(Math, this.processingTimes) : 0;
        var memUsage = process.memoryUsage();
        var memoryUsageMB = memUsage.heapUsed / 1024 / 1024;
        // Calculate updates per second
        var updatesPerSecond = timeDiff > 0 ? this.updateCount / timeDiff : 0;
        var metrics = {
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
        var oneHourAgo = now - (60 * 60 * 1000);
        this.metrics = this.metrics.filter(function (m) { return m.timestamp > oneHourAgo; });
        // Reset counters
        this.updateCount = 0;
        this.lastCheckTime = now;
        return metrics;
    };
    /**
     * Check if system is under stress
     */
    CapacityMonitor.prototype.checkHealth = function (metrics) {
        var warnings = [];
        if (metrics.cpuUsagePercent > this.warningThresholds.cpuPercent) {
            warnings.push("\u26A0\uFE0F High CPU usage: ".concat(metrics.cpuUsagePercent, "%"));
        }
        if (metrics.updateLagMs > this.warningThresholds.lagMs) {
            warnings.push("\u26A0\uFE0F High update lag: ".concat(metrics.updateLagMs, "ms"));
        }
        if (metrics.avgProcessingTimeMs > this.warningThresholds.processingMs) {
            warnings.push("\u26A0\uFE0F Slow processing: ".concat(metrics.avgProcessingTimeMs, "ms avg"));
        }
        return {
            healthy: warnings.length === 0,
            warnings: warnings
        };
    };
    /**
     * Display metrics to console
     */
    CapacityMonitor.prototype.displayMetrics = function (metrics) {
        console.log('\n========================================');
        console.log('📊 gRPC CAPACITY MONITOR');
        console.log('========================================');
        console.log("\uD83C\uDFAF Active Positions: ".concat(metrics.activePositions));
        console.log("\uD83D\uDCE8 Updates/sec: ".concat(metrics.updatesPerSecond));
        console.log("\u26A1 Avg Processing: ".concat(metrics.avgProcessingTimeMs, "ms"));
        console.log("\uD83D\uDD25 Peak Processing: ".concat(metrics.peakProcessingTimeMs, "ms"));
        console.log("\uD83D\uDCBE Memory Usage: ".concat(metrics.memoryUsageMB, " MB"));
        console.log("\u23F1\uFE0F  Update Lag: ".concat(metrics.updateLagMs, "ms"));
        var health = this.checkHealth(metrics);
        if (health.healthy) {
            console.log("\u2705 Status: HEALTHY");
        }
        else {
            console.log("\u26A0\uFE0F  Status: STRESSED");
            health.warnings.forEach(function (w) { return console.log("   ".concat(w)); });
        }
        // Capacity recommendation
        var estimatedMaxPositions = this.estimateMaxCapacity(metrics);
        console.log("\n\uD83D\uDCA1 Estimated Max Capacity: ".concat(estimatedMaxPositions, " positions"));
        console.log('========================================\n');
    };
    /**
     * Estimate maximum capacity based on current metrics
     */
    CapacityMonitor.prototype.estimateMaxCapacity = function (metrics) {
        if (metrics.activePositions === 0)
            return 0;
        // Assume target of 80% CPU and 150ms max processing time
        var cpuHeadroom = 80 / Math.max(metrics.cpuUsagePercent, 10);
        var processingHeadroom = 50 / Math.max(metrics.avgProcessingTimeMs, 1);
        // Use most conservative estimate
        var headroom = Math.min(cpuHeadroom, processingHeadroom);
        return Math.floor(metrics.activePositions * headroom);
    };
    /**
     * Generate capacity report
     */
    CapacityMonitor.prototype.generateReport = function () {
        if (this.metrics.length === 0) {
            return 'No metrics collected yet';
        }
        var avgPositions = this.metrics.reduce(function (sum, m) { return sum + m.activePositions; }, 0) / this.metrics.length;
        var avgUpdatesPerSec = this.metrics.reduce(function (sum, m) { return sum + m.updatesPerSecond; }, 0) / this.metrics.length;
        var maxUpdatesPerSec = Math.max.apply(Math, this.metrics.map(function (m) { return m.updatesPerSecond; }));
        var avgProcessing = this.metrics.reduce(function (sum, m) { return sum + m.avgProcessingTimeMs; }, 0) / this.metrics.length;
        var maxMemory = Math.max.apply(Math, this.metrics.map(function (m) { return m.memoryUsageMB; }));
        return "\nCAPACITY REPORT\n===============\nDuration: ".concat(Math.round((Date.now() - this.metrics[0].timestamp) / 60000), " minutes\nSamples: ").concat(this.metrics.length, "\n\nAverage Positions: ").concat(Math.round(avgPositions), "\nAverage Updates/sec: ").concat(Math.round(avgUpdatesPerSec * 10) / 10, "\nPeak Updates/sec: ").concat(Math.round(maxUpdatesPerSec * 10) / 10, "\nAverage Processing: ").concat(Math.round(avgProcessing * 10) / 10, "ms\nPeak Memory: ").concat(Math.round(maxMemory * 10) / 10, " MB\n\nRECOMMENDATION:\n").concat(this.getCapacityRecommendation(avgPositions, avgProcessing), "\n");
    };
    CapacityMonitor.prototype.getCapacityRecommendation = function (avgPositions, avgProcessing) {
        if (avgPositions === 0) {
            return 'No positions monitored yet - unable to estimate capacity';
        }
        if (avgProcessing < 10) {
            return "\u2705 System has plenty of headroom. Can likely handle ".concat(Math.floor(avgPositions * 5), "+ positions");
        }
        else if (avgProcessing < 30) {
            return "\u2705 System performing well. Estimated capacity: ".concat(Math.floor(avgPositions * 2), "-").concat(Math.floor(avgPositions * 3), " positions");
        }
        else if (avgProcessing < 50) {
            return "\u26A0\uFE0F  System under moderate load. Maximum recommended: ".concat(Math.floor(avgPositions * 1.5), " positions");
        }
        else {
            return "\uD83D\uDEA8 System near capacity. Do not exceed ".concat(avgPositions, " positions");
        }
    };
    return CapacityMonitor;
}());
// Export for use in main bot
exports.capacityMonitor = new CapacityMonitor();
// If run directly, display instructions
if (require.main === module) {
    console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n\u2551   gRPC CAPACITY MONITOR                            \u2551\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n\nThis script monitors your bot's position tracking capacity.\n\nTO USE:\n1. Import in index.ts:\n   import { capacityMonitor } from './scripts/monitor-grpc-capacity';\n\n2. Record updates in positionMonitor callback:\n   const startTime = Date.now();\n   // ... process update ...\n   capacityMonitor.recordUpdate(Date.now() - startTime);\n\n3. Display metrics every 10 seconds:\n   setInterval(() => {\n     const metrics = capacityMonitor.getMetrics(globalPositionMonitor);\n     capacityMonitor.displayMetrics(metrics);\n   }, 10000);\n\n4. Generate report on shutdown:\n   console.log(capacityMonitor.generateReport());\n\nWHAT TO WATCH:\n- \u2705 Updates/sec should match: positions \u00D7 2.5\n- \u2705 Avg processing should stay < 30ms\n- \u2705 Memory usage should be stable\n- \u26A0\uFE0F  If lag > 200ms, you're at capacity\n\nCAPACITY GUIDELINES:\n- < 10ms processing = Can add more positions\n- 10-30ms processing = Good capacity\n- 30-50ms processing = Near limit\n- > 50ms processing = At or over capacity\n  ");
}
