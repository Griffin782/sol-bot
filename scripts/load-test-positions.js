"use strict";
/**
 * Position Monitoring Load Test
 *
 * Tests gRPC position monitoring capacity by adding simulated positions
 * Phases: 200 → 500 → 1,000 → 1,500+ positions
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadTester = void 0;
var positionMonitor_1 = require("../src/monitoring/positionMonitor");
var monitor_grpc_capacity_1 = require("./monitor-grpc-capacity");
// Configuration
var GRPC_ENDPOINT = process.env.GRPC_HTTP_URI || "https://basic.grpc.solanavibestation.com";
var GRPC_TOKEN = process.env.GRPC_AUTH_TOKEN || "";
var SOL_PRICE = 167;
// Test phases - OPTIMIZED FOR 12 vCPU SERVER
var PHASES = [
    { name: "Phase 1", positions: 200, expectedCpu: "10-15%", duration: 180000 }, // 3 min
    { name: "Phase 2", positions: 500, expectedCpu: "25-35%", duration: 240000 }, // 4 min
    { name: "Phase 3", positions: 1000, expectedCpu: "50-60%", duration: 300000 }, // 5 min
    { name: "Phase 4", positions: 1500, expectedCpu: "70-80%", duration: 300000 }, // 5 min
];
// Sample pump.fun tokens for testing (real tokens from mainnet)
var SAMPLE_TOKENS = [
    "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", // POPCAT
    "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY", // MUMU
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
    "8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn", // SILLY
    "5z3EqYQo9HiCEs3R84RCDMu2n7anpDMxRhdK8PSWmrRC", // PONKE
];
var LoadTester = /** @class */ (function () {
    function LoadTester() {
        this.positionMonitor = null;
        this.testResults = [];
        this.currentPhase = 0;
        this.isRunning = false;
    }
    LoadTester.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\n╔══════════════════════════════════════════════════╗");
                        console.log("║   gRPC LOAD TEST - 12 vCPU SERVER               ║");
                        console.log("╚══════════════════════════════════════════════════╝\n");
                        console.log("📋 Configuration:");
                        console.log("   Server: 12 vCPU, 24GB RAM");
                        console.log("   Endpoint: ".concat(GRPC_ENDPOINT));
                        console.log("   Expected Capacity: 1,000-1,200 positions");
                        console.log("");
                        // Initialize position monitor
                        this.positionMonitor = new positionMonitor_1.PositionMonitor(GRPC_ENDPOINT, GRPC_TOKEN, SOL_PRICE);
                        // Set up price update callback with performance tracking
                        this.positionMonitor.onPriceUpdate(function (mint, priceUSD) { return __awaiter(_this, void 0, void 0, function () {
                            var startTime;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        startTime = Date.now();
                                        // Simulate exit strategy check
                                        return [4 /*yield*/, this.simulateExitCheck(mint, priceUSD)];
                                    case 1:
                                        // Simulate exit strategy check
                                        _a.sent();
                                        // Track performance
                                        monitor_grpc_capacity_1.capacityMonitor.recordUpdate(Date.now() - startTime);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        // Start monitoring
                        return [4 /*yield*/, this.positionMonitor.start()];
                    case 1:
                        // Start monitoring
                        _a.sent();
                        console.log("✅ Position monitor initialized\n");
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Simulate exit strategy check (lightweight)
     */
    LoadTester.prototype.simulateExitCheck = function (mint, priceUSD) {
        return __awaiter(this, void 0, void 0, function () {
            var change;
            return __generator(this, function (_a) {
                change = (priceUSD - 0.001) / 0.001;
                if (change > 2.0) {
                    // Would trigger 2x exit
                }
                else if (change < -0.5) {
                    // Would trigger stop loss
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Generate test positions
     */
    LoadTester.prototype.generateTestPositions = function (count) {
        var positions = [];
        for (var i = 0; i < count; i++) {
            // Use sample tokens in rotation
            var tokenIndex = i % SAMPLE_TOKENS.length;
            var mint = SAMPLE_TOKENS[tokenIndex];
            // Add unique suffix to mint for testing (not real addresses)
            var uniqueMint = "".concat(mint, "_test_").concat(i);
            positions.push({
                mint: uniqueMint,
                poolAddress: "pool_".concat(i),
                entryPriceSOL: 0.001 + (Math.random() * 0.01),
                entryPriceUSD: (0.001 + (Math.random() * 0.01)) * SOL_PRICE,
                tokenAmount: 1000000 + Math.floor(Math.random() * 9000000),
                entryTime: new Date(),
                dex: "pumpfun"
            });
        }
        return positions;
    };
    /**
     * Run a single test phase
     */
    LoadTester.prototype.runPhase = function (phaseConfig) {
        return __awaiter(this, void 0, void 0, function () {
            var metrics, positions, batchSize, i, batch, _i, batch_1, position, error_1, monitorInterval, finalMetrics, error_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\n".concat("=".repeat(60)));
                        console.log("\uD83D\uDE80 ".concat(phaseConfig.name, ": Testing ").concat(phaseConfig.positions, " positions"));
                        console.log("   Expected CPU: ".concat(phaseConfig.expectedCpu));
                        console.log("   Duration: ".concat(phaseConfig.duration / 1000, " seconds"));
                        console.log("".concat("=".repeat(60), "\n"));
                        metrics = {
                            phase: phaseConfig.name,
                            targetPositions: phaseConfig.positions,
                            actualPositions: 0,
                            startTime: Date.now(),
                            avgCpuPercent: 0,
                            peakCpuPercent: 0,
                            avgUpdatesPerSec: 0,
                            avgProcessingMs: 0,
                            peakProcessingMs: 0,
                            avgMemoryMB: 0,
                            peakMemoryMB: 0,
                            errors: 0,
                            success: false
                        };
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 13, , 14]);
                        // Generate positions
                        console.log("\uD83D\uDCDD Generating ".concat(phaseConfig.positions, " test positions..."));
                        positions = this.generateTestPositions(phaseConfig.positions);
                        // Add positions to monitor (SILENT MODE - reduce output)
                        console.log("\uD83D\uDCE4 Adding ".concat(phaseConfig.positions, " positions..."));
                        batchSize = 100;
                        i = 0;
                        _a.label = 2;
                    case 2:
                        if (!(i < positions.length)) return [3 /*break*/, 11];
                        batch = positions.slice(i, i + batchSize);
                        _i = 0, batch_1 = batch;
                        _a.label = 3;
                    case 3:
                        if (!(_i < batch_1.length)) return [3 /*break*/, 8];
                        position = batch_1[_i];
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, this.positionMonitor.addPosition(position)];
                    case 5:
                        _a.sent();
                        metrics.actualPositions++;
                        return [3 /*break*/, 7];
                    case 6:
                        error_1 = _a.sent();
                        metrics.errors++;
                        return [3 /*break*/, 7];
                    case 7:
                        _i++;
                        return [3 /*break*/, 3];
                    case 8:
                        // Only show progress every 200 positions
                        if (metrics.actualPositions % 200 === 0 || metrics.actualPositions === phaseConfig.positions) {
                            console.log("   \u2713 ".concat(metrics.actualPositions, "/").concat(phaseConfig.positions, " added"));
                        }
                        // Small delay between batches
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                    case 9:
                        // Small delay between batches
                        _a.sent();
                        _a.label = 10;
                    case 10:
                        i += batchSize;
                        return [3 /*break*/, 2];
                    case 11:
                        console.log("\u2705 Added ".concat(metrics.actualPositions, " positions\n"));
                        // Monitor for specified duration
                        console.log("\u23F1\uFE0F  Monitoring for ".concat(phaseConfig.duration / 1000, " seconds...\n"));
                        monitorInterval = setInterval(function () {
                            var currentMetrics = monitor_grpc_capacity_1.capacityMonitor.getMetrics(_this.positionMonitor);
                            // MINIMAL OUTPUT - Prevent CLI buffer overflow
                            var timestamp = new Date().toLocaleTimeString();
                            console.log("[".concat(timestamp, "] ").concat(currentMetrics.activePositions, " pos | ").concat(currentMetrics.updatesPerSecond.toFixed(0), " upd/s | ").concat(currentMetrics.avgProcessingTimeMs.toFixed(1), "ms | ").concat(currentMetrics.cpuUsagePercent.toFixed(0), "% CPU"));
                            // Track peak values
                            metrics.peakCpuPercent = Math.max(metrics.peakCpuPercent, currentMetrics.cpuUsagePercent);
                            metrics.peakProcessingMs = Math.max(metrics.peakProcessingMs, currentMetrics.peakProcessingTimeMs);
                            metrics.peakMemoryMB = Math.max(metrics.peakMemoryMB, currentMetrics.memoryUsageMB);
                        }, 15000);
                        // Wait for test duration
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, phaseConfig.duration); })];
                    case 12:
                        // Wait for test duration
                        _a.sent();
                        // Stop monitoring interval
                        clearInterval(monitorInterval);
                        finalMetrics = monitor_grpc_capacity_1.capacityMonitor.getMetrics(this.positionMonitor);
                        metrics.avgCpuPercent = finalMetrics.cpuUsagePercent;
                        metrics.avgUpdatesPerSec = finalMetrics.updatesPerSecond;
                        metrics.avgProcessingMs = finalMetrics.avgProcessingTimeMs;
                        metrics.avgMemoryMB = finalMetrics.memoryUsageMB;
                        metrics.endTime = Date.now();
                        metrics.success = metrics.avgProcessingMs < 50 && metrics.errors < (phaseConfig.positions * 0.01);
                        // Display phase results
                        this.displayPhaseResults(metrics);
                        return [2 /*return*/, metrics];
                    case 13:
                        error_2 = _a.sent();
                        console.error("\u274C Phase failed:", error_2);
                        metrics.success = false;
                        metrics.endTime = Date.now();
                        return [2 /*return*/, metrics];
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Display phase results
     */
    LoadTester.prototype.displayPhaseResults = function (metrics) {
        console.log("\n".concat("=".repeat(60)));
        console.log("\uD83D\uDCCA ".concat(metrics.phase, " RESULTS"));
        console.log("".concat("=".repeat(60)));
        console.log("\u2705 Positions: ".concat(metrics.actualPositions, "/").concat(metrics.targetPositions));
        console.log("\u26A1 Updates/sec: ".concat(metrics.avgUpdatesPerSec.toFixed(1)));
        console.log("\uD83D\uDD25 Processing: ".concat(metrics.avgProcessingMs.toFixed(1), "ms avg, ").concat(metrics.peakProcessingMs.toFixed(1), "ms peak"));
        console.log("\uD83D\uDCBE Memory: ".concat(metrics.avgMemoryMB.toFixed(1), " MB avg, ").concat(metrics.peakMemoryMB.toFixed(1), " MB peak"));
        console.log("\uD83D\uDCBB CPU: ".concat(metrics.avgCpuPercent.toFixed(1), "% avg, ").concat(metrics.peakCpuPercent.toFixed(1), "% peak"));
        console.log("\u274C Errors: ".concat(metrics.errors));
        console.log("\n".concat(metrics.success ? "✅ PASS" : "❌ FAIL", " - ").concat(metrics.success ? "System stable" : "System overloaded"));
        console.log("".concat("=".repeat(60), "\n"));
    };
    /**
     * Run all phases
     */
    LoadTester.prototype.runAllPhases = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, PHASES_1, phase, metrics;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.isRunning = true;
                        _i = 0, PHASES_1 = PHASES;
                        _a.label = 1;
                    case 1:
                        if (!(_i < PHASES_1.length)) return [3 /*break*/, 5];
                        phase = PHASES_1[_i];
                        return [4 /*yield*/, this.runPhase(phase)];
                    case 2:
                        metrics = _a.sent();
                        this.testResults.push(metrics);
                        // Stop if phase failed
                        if (!metrics.success) {
                            console.log("\n\u26A0\uFE0F  ".concat(phase.name, " failed - stopping load test"));
                            console.log("   Max capacity appears to be around ".concat(metrics.targetPositions, " positions"));
                            return [3 /*break*/, 5];
                        }
                        // Ask user if they want to continue
                        console.log("\n\u2705 ".concat(phase.name, " completed successfully"));
                        console.log("   Continue to next phase? (5 second pause...)\n");
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 5000); })];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 1];
                    case 5:
                        this.isRunning = false;
                        this.generateFinalReport();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Generate final report
     */
    LoadTester.prototype.generateFinalReport = function () {
        console.log("\n".concat("=".repeat(60)));
        console.log("\uD83D\uDCCB LOAD TEST FINAL REPORT");
        console.log("".concat("=".repeat(60), "\n"));
        console.log("Server: 12 vCPU, 24 GB RAM");
        console.log("gRPC Tier: Basic (100 r/s)");
        console.log("Test Duration: ".concat(((Date.now() - this.testResults[0].startTime) / 60000).toFixed(1), " minutes\n"));
        console.log("PHASE RESULTS:");
        console.log("".concat("─".repeat(60)));
        for (var _i = 0, _a = this.testResults; _i < _a.length; _i++) {
            var result = _a[_i];
            var status_1 = result.success ? "✅ PASS" : "❌ FAIL";
            console.log("".concat(status_1, " ").concat(result.phase, ": ").concat(result.actualPositions, " positions"));
            console.log("   Processing: ".concat(result.avgProcessingMs.toFixed(1), "ms avg"));
            console.log("   Memory: ".concat(result.avgMemoryMB.toFixed(1), " MB"));
            console.log("   Errors: ".concat(result.errors));
        }
        console.log("\n".concat("=".repeat(60)));
        // Determine recommended capacity
        var lastSuccessful = this.testResults.filter(function (r) { return r.success; }).pop();
        if (lastSuccessful) {
            console.log("\n\uD83D\uDCA1 RECOMMENDED CAPACITY: ".concat(lastSuccessful.actualPositions, " positions"));
            console.log("   This is your safe operating limit with current hardware.");
            console.log("   CPU usage was ".concat(lastSuccessful.avgCpuPercent.toFixed(1), "% with headroom remaining."));
        }
        console.log("\n".concat("=".repeat(60), "\n"));
        // Save report
        var report = JSON.stringify(this.testResults, null, 2);
        require('fs').writeFileSync("./load-test-report-".concat(Date.now(), ".json"), report);
        console.log("\uD83D\uDCC4 Full report saved to: load-test-report-".concat(Date.now(), ".json\n"));
    };
    /**
     * Cleanup
     */
    LoadTester.prototype.cleanup = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\n\uD83E\uDDF9 Cleaning up...");
                        if (!this.positionMonitor) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.positionMonitor.stop()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        console.log("\u2705 Cleanup complete\n");
                        return [2 /*return*/];
                }
            });
        });
    };
    return LoadTester;
}());
exports.LoadTester = LoadTester;
// Run load test
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var tester, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tester = new LoadTester();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 7]);
                    return [4 /*yield*/, tester.initialize()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, tester.runAllPhases()];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 7];
                case 4:
                    error_3 = _a.sent();
                    console.error("\n\uD83D\uDCA5 Load test failed:", error_3);
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, tester.cleanup()];
                case 6:
                    _a.sent();
                    process.exit(0);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}
// Handle interrupts
process.on('SIGINT', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        console.log("\n\u26A0\uFE0F  Interrupted - cleaning up...");
        process.exit(0);
        return [2 /*return*/];
    });
}); });
// Run if called directly
if (require.main === module) {
    main();
}
