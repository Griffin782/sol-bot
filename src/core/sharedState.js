"use strict";
/**
 * Shared State Manager
 * Centralized state to avoid breaking global dependencies during modularization
 * Phase 4 - Modularization Step 1
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sharedState = exports.SharedState = void 0;
var SharedState = /** @class */ (function () {
    function SharedState() {
        // Core systems
        this.positionMonitor = null;
        this.exitStrategyEngine = null;
        this.tokenDetector = null;
        this.lifecycleIntegration = null;
        // State tracking
        this.handledMints = [];
        this.cachedSolPrice = 218; // Fallback
        this.activeTransactions = 0;
        console.log('[SharedState] Instance created');
    }
    SharedState.getInstance = function () {
        if (!SharedState.instance) {
            SharedState.instance = new SharedState();
        }
        return SharedState.instance;
    };
    SharedState.prototype.initialize = function (positionMonitor, exitStrategyEngine, tokenDetector) {
        this.positionMonitor = positionMonitor;
        this.exitStrategyEngine = exitStrategyEngine;
        this.tokenDetector = tokenDetector;
        console.log('[SharedState] Initialized with all dependencies');
        console.log("[SharedState] - Position Monitor: ".concat(positionMonitor ? 'Active' : 'Null'));
        console.log("[SharedState] - Exit Strategy: ".concat(exitStrategyEngine ? 'Active' : 'Null'));
        console.log("[SharedState] - Token Detector: ".concat(tokenDetector ? 'Active' : 'Null'));
    };
    SharedState.prototype.updateSolPrice = function (price) {
        this.cachedSolPrice = price;
        console.log("[SharedState] SOL price updated: $".concat(price));
    };
    SharedState.prototype.incrementTransactions = function () {
        this.activeTransactions++;
    };
    SharedState.prototype.decrementTransactions = function () {
        this.activeTransactions--;
    };
    SharedState.prototype.addHandledMint = function (mint, provider) {
        this.handledMints.push({ mint: mint, provider: provider });
    };
    SharedState.prototype.isHandled = function (mint) {
        return this.handledMints.some(function (item) { return item.mint === mint; });
    };
    SharedState.prototype.removeHandledMint = function (mint) {
        this.handledMints = this.handledMints.filter(function (item) { return item.mint !== mint; });
    };
    return SharedState;
}());
exports.SharedState = SharedState;
// Export singleton instance
exports.sharedState = SharedState.getInstance();
