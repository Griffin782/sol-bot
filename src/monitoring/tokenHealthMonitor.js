"use strict";
/**
 * Token Health Monitor - Phase 3 Implementation
 *
 * Tracks token activity (swap frequency and volume) to classify token health
 * Provides adaptive exit recommendations based on token lifecycle stage
 *
 * Philosophy: "Volume beats magnitude" - capture smaller gains on many tokens
 * rather than miss exits waiting for large gains on dead tokens
 *
 * Health Classifications:
 * - Healthy: High activity, normal exit targets (3x-10x)
 * - Declining: Moderate activity, aggressive targets (2x-3x)
 * - Dying: Low activity, emergency targets (1.5x-2x)
 * - Dead: No activity, exit at any profit
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenHealthMonitor = exports.TokenHealthMonitor = void 0;
/**
 * Token Health Monitor Class
 * Singleton pattern - one instance shared across the application
 */
var TokenHealthMonitor = /** @class */ (function () {
    function TokenHealthMonitor() {
        this.tokenActivities = new Map();
        this.swapTimestamps = new Map(); // mint -> array of swap timestamps
        this.volumeHistory = new Map(); // mint -> array of volumes
        // Classification thresholds
        this.HEALTHY_SWAPS_PER_MIN = 5; // 5+ swaps/min = healthy
        this.DECLINING_SWAPS_PER_MIN = 2; // 2-5 swaps/min = declining
        this.DYING_SWAPS_PER_MIN = 0.5; // 0.5-2 swaps/min = dying
        // < 0.5 swaps/min = dead
        this.HEALTHY_VOLUME_1M = 100; // $100+ volume/min = healthy
        this.DECLINING_VOLUME_1M = 50; // $50-100 volume/min = declining
        this.DYING_VOLUME_1M = 10; // $10-50 volume/min = dying
    }
    // < $10 volume/min = dead
    /**
     * Record a swap transaction for a token
     * Called whenever a swap is detected (from gRPC or other sources)
     */
    TokenHealthMonitor.prototype.recordSwap = function (mint, volumeUSD) {
        var now = new Date();
        // Initialize tracking if this is first swap for token
        if (!this.tokenActivities.has(mint)) {
            this.tokenActivities.set(mint, {
                mint: mint,
                firstSeen: now,
                lastSwapTime: now,
                swapCount1m: 0,
                swapCount5m: 0,
                totalVolume1m: 0,
                totalVolume5m: 0,
            });
            this.swapTimestamps.set(mint, []);
            this.volumeHistory.set(mint, []);
        }
        // Record swap timestamp
        var timestamps = this.swapTimestamps.get(mint);
        timestamps.push(now);
        this.swapTimestamps.set(mint, timestamps);
        // Record volume
        var volumes = this.volumeHistory.get(mint);
        volumes.push(volumeUSD);
        this.volumeHistory.set(mint, volumes);
        // Update activity metrics
        this.updateActivityMetrics(mint);
    };
    /**
     * Update activity metrics for a token
     * Calculates swap counts and volumes for different time windows
     */
    TokenHealthMonitor.prototype.updateActivityMetrics = function (mint) {
        var now = new Date();
        var oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
        var fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        var timestamps = this.swapTimestamps.get(mint) || [];
        var volumes = this.volumeHistory.get(mint) || [];
        // Count swaps in last 1 minute and 5 minutes
        var swaps1m = timestamps.filter(function (t) { return t >= oneMinuteAgo; }).length;
        var swaps5m = timestamps.filter(function (t) { return t >= fiveMinutesAgo; }).length;
        // Calculate volume in last 1 minute and 5 minutes
        var volume1m = 0;
        var volume5m = 0;
        for (var i = timestamps.length - 1; i >= 0; i--) {
            if (timestamps[i] >= oneMinuteAgo) {
                volume1m += volumes[i] || 0;
            }
            if (timestamps[i] >= fiveMinutesAgo) {
                volume5m += volumes[i] || 0;
            }
            else {
                break; // Older timestamps won't be in either window
            }
        }
        // Update activity record
        var activity = this.tokenActivities.get(mint);
        if (activity) {
            activity.lastSwapTime = new Date();
            activity.swapCount1m = swaps1m;
            activity.swapCount5m = swaps5m;
            activity.totalVolume1m = volume1m;
            activity.totalVolume5m = volume5m;
            this.tokenActivities.set(mint, activity);
        }
    };
    /**
     * Get health metrics for a token
     * Returns comprehensive health assessment
     */
    TokenHealthMonitor.prototype.getHealthMetrics = function (mint) {
        var activity = this.tokenActivities.get(mint);
        if (!activity) {
            // Token not tracked yet - default to healthy (no data = benefit of doubt)
            return null;
        }
        // Calculate activity score (0-100) based on swap frequency
        var swapsPerMin = activity.swapCount1m;
        var activityScore = 0;
        if (swapsPerMin >= this.HEALTHY_SWAPS_PER_MIN) {
            activityScore = 100;
        }
        else if (swapsPerMin >= this.DECLINING_SWAPS_PER_MIN) {
            activityScore = 60 + ((swapsPerMin - this.DECLINING_SWAPS_PER_MIN) / (this.HEALTHY_SWAPS_PER_MIN - this.DECLINING_SWAPS_PER_MIN)) * 40;
        }
        else if (swapsPerMin >= this.DYING_SWAPS_PER_MIN) {
            activityScore = 30 + ((swapsPerMin - this.DYING_SWAPS_PER_MIN) / (this.DECLINING_SWAPS_PER_MIN - this.DYING_SWAPS_PER_MIN)) * 30;
        }
        else {
            activityScore = Math.min(30, swapsPerMin * 60); // Linear up to 0.5 swaps/min
        }
        // Calculate liquidity score (0-100) based on volume
        var volumePerMin = activity.totalVolume1m;
        var liquidityScore = 0;
        if (volumePerMin >= this.HEALTHY_VOLUME_1M) {
            liquidityScore = 100;
        }
        else if (volumePerMin >= this.DECLINING_VOLUME_1M) {
            liquidityScore = 60 + ((volumePerMin - this.DECLINING_VOLUME_1M) / (this.HEALTHY_VOLUME_1M - this.DECLINING_VOLUME_1M)) * 40;
        }
        else if (volumePerMin >= this.DYING_VOLUME_1M) {
            liquidityScore = 30 + ((volumePerMin - this.DYING_VOLUME_1M) / (this.DECLINING_VOLUME_1M - this.DYING_VOLUME_1M)) * 30;
        }
        else {
            liquidityScore = Math.min(30, (volumePerMin / this.DYING_VOLUME_1M) * 30);
        }
        // Calculate momentum score (0-100) based on trend
        // Compare last 1 minute to previous 4 minutes
        var swaps1m = activity.swapCount1m;
        var swaps4m = activity.swapCount5m - activity.swapCount1m; // Previous 4 minutes
        var momentumScore = 50; // Default to neutral
        if (swaps4m > 0) {
            var swapsPerMin1m = swaps1m;
            var swapsPerMin4m = swaps4m / 4;
            if (swapsPerMin1m > swapsPerMin4m * 1.5) {
                momentumScore = 100; // Strong upward momentum
            }
            else if (swapsPerMin1m > swapsPerMin4m) {
                momentumScore = 75; // Moderate upward momentum
            }
            else if (swapsPerMin1m < swapsPerMin4m * 0.5) {
                momentumScore = 0; // Strong downward momentum
            }
            else if (swapsPerMin1m < swapsPerMin4m) {
                momentumScore = 25; // Moderate downward momentum
            }
        }
        // Overall health (weighted average)
        var overallHealth = (activityScore * 0.4) + (liquidityScore * 0.4) + (momentumScore * 0.2);
        // Classify based on overall health
        var classification;
        var recommendation;
        if (overallHealth >= 70) {
            classification = 'healthy';
            recommendation = 'Token shows strong activity. Use normal exit targets (3x-10x).';
        }
        else if (overallHealth >= 50) {
            classification = 'declining';
            recommendation = 'Token activity declining. Use aggressive targets (2x-3x).';
        }
        else if (overallHealth >= 30) {
            classification = 'dying';
            recommendation = 'Token activity very low. Use emergency targets (1.5x-2x).';
        }
        else {
            classification = 'dead';
            recommendation = 'Token appears dead. Exit at any profit.';
        }
        return {
            mint: mint,
            activityScore: Math.round(activityScore),
            liquidityScore: Math.round(liquidityScore),
            momentumScore: Math.round(momentumScore),
            overallHealth: Math.round(overallHealth),
            classification: classification,
            recommendation: recommendation,
        };
    };
    /**
     * Get exit recommendation for a token
     * Returns strategy and target multiple based on health
     */
    TokenHealthMonitor.prototype.getExitRecommendation = function (mint) {
        var metrics = this.getHealthMetrics(mint);
        if (!metrics) {
            // No data yet - default to normal strategy
            return {
                strategy: 'normal',
                targetMultiple: 3.0,
                reason: 'No activity data yet - using default strategy',
            };
        }
        // Determine strategy based on classification
        switch (metrics.classification) {
            case 'healthy':
                return {
                    strategy: 'normal',
                    targetMultiple: 3.0,
                    reason: 'Token is healthy - aim for normal targets',
                };
            case 'declining':
                return {
                    strategy: 'aggressive',
                    targetMultiple: 2.0,
                    reason: 'Token activity declining - take profits early',
                };
            case 'dying':
                return {
                    strategy: 'emergency',
                    targetMultiple: 1.5,
                    reason: 'Token dying - exit at lower targets',
                };
            case 'dead':
                return {
                    strategy: 'emergency',
                    targetMultiple: 1.2,
                    reason: 'Token appears dead - exit at breakeven or small profit',
                };
        }
    };
    /**
     * Get activity report for all tracked tokens
     * Useful for logging and monitoring
     */
    TokenHealthMonitor.prototype.getActivityReport = function () {
        var healthy = 0;
        var declining = 0;
        var dying = 0;
        var dead = 0;
        for (var _i = 0, _a = this.tokenActivities.keys(); _i < _a.length; _i++) {
            var mint = _a[_i];
            var metrics = this.getHealthMetrics(mint);
            if (metrics) {
                switch (metrics.classification) {
                    case 'healthy':
                        healthy++;
                        break;
                    case 'declining':
                        declining++;
                        break;
                    case 'dying':
                        dying++;
                        break;
                    case 'dead':
                        dead++;
                        break;
                }
            }
        }
        return {
            totalTokens: this.tokenActivities.size,
            healthy: healthy,
            declining: declining,
            dying: dying,
            dead: dead,
        };
    };
    /**
     * Cleanup old token data
     * Remove tokens that haven't been seen in 10+ minutes
     */
    TokenHealthMonitor.prototype.cleanup = function () {
        var now = new Date();
        var tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
        for (var _i = 0, _a = this.tokenActivities.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], mint = _b[0], activity = _b[1];
            if (activity.lastSwapTime < tenMinutesAgo) {
                this.tokenActivities.delete(mint);
                this.swapTimestamps.delete(mint);
                this.volumeHistory.delete(mint);
                console.log("[Token Health] Cleaned up old data for ".concat(mint));
            }
        }
    };
    return TokenHealthMonitor;
}());
exports.TokenHealthMonitor = TokenHealthMonitor;
// Export singleton instance
exports.tokenHealthMonitor = new TokenHealthMonitor();
