"use strict";
/**
 * Position Monitor - Phase 4 COMPLETION
 *
 * Real-time price monitoring for bought positions via gRPC
 * This is the MISSING PIECE that enables near-instant exit signals
 *
 * Features:
 * - Subscribes to pool accounts for bought tokens
 * - Monitors swap transactions for price updates
 * - Extracts price from transaction data (no API calls)
 * - Updates exit strategy with real-time prices
 * - <400ms latency from swap to exit signal
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionMonitor = void 0;
exports.derivePoolAddress = derivePoolAddress;
var web3_js_1 = require("@solana/web3.js");
var yellowstone_grpc_1 = __importDefault(require("@triton-one/yellowstone-grpc"));
var poolDerivation_1 = require("../utils/poolDerivation");
var mpl_token_metadata_1 = require("@metaplex-foundation/mpl-token-metadata");
var axios_1 = __importDefault(require("axios"));
var tokenHealthMonitor_1 = require("./tokenHealthMonitor"); // Phase 3: Track token activity for adaptive exits
var sharedState_1 = require("../core/sharedState"); // For lifecycle integration price updates
var metadataCache_1 = require("../detection/metadataCache"); // NEW: Metadata caching
/**
 * Real-time position monitor using gRPC pool subscriptions
 */
var PositionMonitor = /** @class */ (function () {
    function PositionMonitor(grpcEndpoint, grpcToken, solPriceUSD // TODO: Get from price feed
    ) {
        if (solPriceUSD === void 0) { solPriceUSD = 218; }
        this.grpcEndpoint = grpcEndpoint;
        this.grpcToken = grpcToken;
        this.solPriceUSD = solPriceUSD;
        this.monitoredPositions = new Map();
        this.currentPrices = new Map();
        this.bondingCurveAddresses = new Map(); // mint -> bonding curve address
        this.lastUpdateTimes = new Map(); // mint -> timestamp of last update (Layer 3: Fallback detection)
        this.fallbackPollInterval = null; // Layer 3: Interval for checking stale positions
        this.healthMonitorCleanupInterval = null; // Phase 3: Interval for cleaning old token health data
        this.grpcClient = null;
        this.grpcStream = null;
        this.priceUpdateCallback = null;
        this.isActive = false;
        // Circuit breaker properties (Nov 11, 2025)
        this.reconnectAttempts = 0;
        this.lastErrorMessage = '';
        this.sameErrorCount = 0;
        this.maxReconnectAttempts = 10;
    }
    /**
     * Set callback for when prices update
     */
    PositionMonitor.prototype.onPriceUpdate = function (callback) {
        this.priceUpdateCallback = callback;
    };
    /**
     * Add position to real-time monitoring
     */
    PositionMonitor.prototype.addPosition = function (position) {
        return __awaiter(this, void 0, void 0, function () {
            var bondingCurveInfo, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        console.log("[Position Monitor] Adding ".concat(position.mint, " to real-time tracking"));
                        this.monitoredPositions.set(position.mint, position);
                        // Derive bonding curve address for pump.fun tokens (provides continuous price updates)
                        // Bonding curve account updates every block (~400ms) even when no swaps occur
                        if (position.dex === "pumpfun") {
                            try {
                                bondingCurveInfo = (0, poolDerivation_1.derivePumpFunBondingCurve)(position.mint);
                                this.bondingCurveAddresses.set(position.mint, bondingCurveInfo.poolAddress);
                                console.log("[Position Monitor] Bonding curve for ".concat(position.mint, ": ").concat(bondingCurveInfo.poolAddress));
                            }
                            catch (error) {
                                console.warn("[Position Monitor] Could not derive bonding curve for ".concat(position.mint, ":"), error);
                                // Gracefully continue - will use transaction-based monitoring only
                            }
                        }
                        // Initialize price tracking
                        this.currentPrices.set(position.mint, {
                            mint: position.mint,
                            poolAddress: position.poolAddress,
                            currentPriceSOL: position.entryPriceSOL,
                            currentPriceUSD: position.entryPriceUSD,
                            lastUpdateTime: new Date(),
                            lastUpdateSignature: "initial",
                            source: position.dex,
                        });
                        // Initialize update time tracking for fallback detection (Layer 3)
                        this.lastUpdateTimes.set(position.mint, Date.now());
                        if (!this.isActive) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.updateSubscription()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/, true];
                    case 3:
                        error_1 = _a.sent();
                        console.error("[Position Monitor] Error adding position ".concat(position.mint, ":"), error_1);
                        return [2 /*return*/, false];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Remove position from monitoring
     */
    PositionMonitor.prototype.removePosition = function (mint) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.monitoredPositions.delete(mint);
                        this.currentPrices.delete(mint);
                        this.bondingCurveAddresses.delete(mint); // Clean up bonding curve tracking
                        this.lastUpdateTimes.delete(mint); // Clean up update time tracking (Layer 3)
                        if (!(this.isActive && this.monitoredPositions.size > 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.updateSubscription()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get current price for a position
     */
    PositionMonitor.prototype.getCurrentPrice = function (mint) {
        return this.currentPrices.get(mint) || null;
    };
    /**
     * Get all current prices
     */
    PositionMonitor.prototype.getAllPrices = function () {
        return Array.from(this.currentPrices.values());
    };
    /**
     * Start monitoring all positions
     */
    PositionMonitor.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.isActive) {
                            console.log("[Position Monitor] Already active");
                            return [2 /*return*/];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        this.grpcClient = new yellowstone_grpc_1.default(this.grpcEndpoint, this.grpcToken, { skipPreflight: true });
                        _a = this;
                        return [4 /*yield*/, this.grpcClient.subscribe()];
                    case 2:
                        _a.grpcStream = _b.sent();
                        return [4 /*yield*/, this.setupSubscription()];
                    case 3:
                        _b.sent();
                        this.setupEventHandlers();
                        // Start fallback polling (Layer 3)
                        this.startFallbackPolling();
                        // Start health monitor cleanup (Phase 3)
                        this.startHealthMonitorCleanup();
                        this.isActive = true;
                        console.log("[Position Monitor] Started monitoring ".concat(this.monitoredPositions.size, " positions"));
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _b.sent();
                        console.error("[Position Monitor] Failed to start:", error_2);
                        throw error_2;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Stop monitoring
     */
    PositionMonitor.prototype.stop = function () {
        if (this.grpcStream) {
            this.grpcStream.end();
            this.grpcStream = null;
        }
        // Stop fallback polling (Layer 3)
        if (this.fallbackPollInterval) {
            clearInterval(this.fallbackPollInterval);
            this.fallbackPollInterval = null;
        }
        // Stop health monitor cleanup (Phase 3)
        if (this.healthMonitorCleanupInterval) {
            clearInterval(this.healthMonitorCleanupInterval);
            this.healthMonitorCleanupInterval = null;
        }
        this.grpcClient = null;
        this.isActive = false;
        console.log("[Position Monitor] Stopped");
    };
    /**
     * Update subscription with new pool list WITHOUT restarting connection
     * This prevents HTTP 429 rate limiting when adding/removing positions
     * Also updates bonding curve subscriptions for continuous price monitoring
     */
    PositionMonitor.prototype.updateSubscription = function () {
        return __awaiter(this, void 0, void 0, function () {
            var positions, poolAddresses, bondingCurveAddresses, request;
            return __generator(this, function (_a) {
                if (!this.grpcStream)
                    return [2 /*return*/];
                positions = Array.from(this.monitoredPositions.values());
                if (positions.length === 0) {
                    console.log("[Position Monitor] No positions to monitor, keeping connection alive");
                    return [2 /*return*/];
                }
                poolAddresses = positions.map(function (p) { return p.poolAddress; });
                bondingCurveAddresses = Array.from(this.bondingCurveAddresses.values());
                request = {
                    slots: {},
                    accounts: __assign({ pool_monitor: {
                            account: poolAddresses,
                            owner: [],
                            filters: [],
                        } }, (bondingCurveAddresses.length > 0 && {
                        bonding_curve_monitor: {
                            account: bondingCurveAddresses,
                            owner: [],
                            filters: [],
                        }
                    })),
                    // REMOVED: metadata_monitor (Nov 11, 2025)
                    // Caused "String is the wrong size" gRPC error → infinite reconnect loop → HTTP 429
                    // Subscribing to ALL accounts owned by metadata program is too broad (millions of accounts)
                    // Solution: Use on-demand RPC metadata fetching instead
                    transactions: {
                        swap_monitor: {
                            vote: false,
                            failed: false,
                            signature: undefined,
                            accountInclude: poolAddresses, // Only transactions touching our pools
                            accountExclude: [],
                            accountRequired: [],
                        },
                    },
                    blocks: {},
                    blocksMeta: {},
                    accountsDataSlice: [],
                    commitment: 0, // Processed
                    entry: {},
                    transactionsStatus: {},
                };
                // Send updated subscription (reuses existing connection)
                this.grpcStream.write(request);
                console.log("[Position Monitor] Updated subscription: ".concat(poolAddresses.length, " pools + ").concat(bondingCurveAddresses.length, " bonding curves"));
                return [2 /*return*/];
            });
        });
    };
    /**
     * Restart subscription with updated pool list (ONLY for error recovery)
     * Do NOT use this for adding/removing positions - use updateSubscription() instead
     */
    PositionMonitor.prototype.restartSubscription = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.grpcStream)
                            return [2 /*return*/];
                        console.log("[Position Monitor] RESTARTING connection (error recovery)");
                        // End current stream
                        this.grpcStream.end();
                        if (!this.grpcClient) return [3 /*break*/, 3];
                        _a = this;
                        return [4 /*yield*/, this.grpcClient.subscribe()];
                    case 1:
                        _a.grpcStream = _b.sent();
                        return [4 /*yield*/, this.setupSubscription()];
                    case 2:
                        _b.sent();
                        this.setupEventHandlers();
                        // Reset reconnect counter on successful restart
                        console.log("[Position Monitor] Connection restarted successfully - resetting reconnect counter");
                        this.reconnectAttempts = 0;
                        this.sameErrorCount = 0;
                        _b.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Setup gRPC subscription for all monitored pool addresses AND bonding curves
     * This enables dual monitoring:
     * 1. Transaction-based (swap events) - fast when active
     * 2. Account-based (bonding curve state) - continuous even with no swaps
     */
    PositionMonitor.prototype.setupSubscription = function () {
        return __awaiter(this, void 0, void 0, function () {
            var positions, poolAddresses, bondingCurveAddresses, request;
            return __generator(this, function (_a) {
                if (!this.grpcStream)
                    return [2 /*return*/];
                positions = Array.from(this.monitoredPositions.values());
                if (positions.length === 0) {
                    console.log("[Position Monitor] No positions to monitor");
                    return [2 /*return*/];
                }
                poolAddresses = positions.map(function (p) { return p.poolAddress; });
                bondingCurveAddresses = Array.from(this.bondingCurveAddresses.values());
                request = {
                    slots: {},
                    accounts: __assign({ pool_monitor: {
                            account: poolAddresses,
                            owner: [],
                            filters: [],
                        } }, (bondingCurveAddresses.length > 0 && {
                        bonding_curve_monitor: {
                            account: bondingCurveAddresses,
                            owner: [],
                            filters: [],
                        }
                    })),
                    transactions: {
                        swap_monitor: {
                            vote: false,
                            failed: false,
                            signature: undefined,
                            accountInclude: poolAddresses, // Only transactions touching our pools
                            accountExclude: [],
                            accountRequired: [],
                        },
                    },
                    blocks: {},
                    blocksMeta: {},
                    accountsDataSlice: [],
                    commitment: 0, // Processed
                    entry: {},
                    transactionsStatus: {},
                };
                // Send subscription
                this.grpcStream.write(request);
                console.log("[Position Monitor] Subscribed to ".concat(poolAddresses.length, " pools + ").concat(bondingCurveAddresses.length, " bonding curves"));
                return [2 /*return*/];
            });
        });
    };
    /**
     * Setup event handlers for gRPC stream
     */
    PositionMonitor.prototype.setupEventHandlers = function () {
        var _this = this;
        if (!this.grpcStream)
            return;
        this.grpcStream.on("data", function (data) {
            _this.handleGrpcUpdate(data);
        });
        this.grpcStream.on("error", function (error) {
            console.error("[Position Monitor] Stream error:", error);

            // Circuit breaker - check for repeated same error
            var errorMsg = error.message || error.toString();
            if (errorMsg === _this.lastErrorMessage) {
                _this.sameErrorCount++;
                if (_this.sameErrorCount >= 5) {
                    console.error("[Position Monitor] CIRCUIT BREAKER: Same error repeated ".concat(_this.sameErrorCount, " times - \"").concat(errorMsg, "\""));
                    console.error("[Position Monitor] Stopping reconnect attempts to prevent infinite loop");
                    _this.stop();
                    return;
                }
            } else {
                _this.lastErrorMessage = errorMsg;
                _this.sameErrorCount = 1;
            }

            // Maximum reconnect attempts
            if (_this.reconnectAttempts >= _this.maxReconnectAttempts) {
                console.error("[Position Monitor] Max reconnect attempts (".concat(_this.maxReconnectAttempts, ") reached - stopping"));
                _this.stop();
                return;
            }

            // Exponential backoff with maximum of 60 seconds
            var backoff = Math.min(5000 * Math.pow(2, _this.reconnectAttempts), 60000);
            _this.reconnectAttempts++;

            console.log("[Position Monitor] Reconnect attempt ".concat(_this.reconnectAttempts, "/").concat(_this.maxReconnectAttempts, " in ").concat(backoff, "ms..."));
            setTimeout(function () { return _this.restartSubscription(); }, backoff);
        });
        this.grpcStream.on("end", function () {
            console.log("[Position Monitor] Stream ended - reconnecting in 5 seconds...");
            // Attempt reconnection after delay (connection timeout/ended by server)
            setTimeout(function () { return _this.restartSubscription(); }, 5000);
        });
        this.grpcStream.on("close", function () {
            console.log("[Position Monitor] Stream closed - reconnecting in 5 seconds...");
            // Attempt reconnection after delay (connection closed by server)
            setTimeout(function () { return _this.restartSubscription(); }, 5000);
        });
    };
    /**
     * Handle gRPC updates (transactions AND account updates)
     * - Transaction updates: Swap transactions providing price from actual trades
     * - Account updates: Bonding curve state providing continuous price updates (~400ms)
     * - Priority: Transaction updates take precedence if received within 1 second
     */
    PositionMonitor.prototype.handleGrpcUpdate = function (data) {
        var _a, _b;
        // Process transaction updates (swap transactions)
        if (data.transaction) {
            var tx = data.transaction;
            var transaction = (_a = tx.transaction) === null || _a === void 0 ? void 0 : _a.transaction;
            var meta = transaction === null || transaction === void 0 ? void 0 : transaction.meta;
            if (transaction && meta) {
                // Extract price from swap transaction
                var priceUpdate = this.extractPriceFromTransaction(tx);
                if (priceUpdate) {
                    // Update cached price
                    var existing = this.currentPrices.get(priceUpdate.mint);
                    if (existing) {
                        var sig = (_b = tx.transaction) === null || _b === void 0 ? void 0 : _b.signature;
                        var sigString = typeof sig === 'string' ? sig : (sig ? Buffer.from(sig).toString('base64') : 'unknown');
                        this.currentPrices.set(priceUpdate.mint, __assign(__assign({}, existing), { currentPriceSOL: priceUpdate.currentPriceSOL, currentPriceUSD: priceUpdate.currentPriceUSD, lastUpdateTime: new Date(), lastUpdateSignature: sigString, volumeUSD: priceUpdate.volumeUSD }));
                        // Track update time for fallback detection (Layer 3)
                        this.lastUpdateTimes.set(priceUpdate.mint, Date.now());
                        // Phase 3: Record swap activity for token health monitoring
                        if (priceUpdate.volumeUSD && priceUpdate.volumeUSD > 0) {
                            tokenHealthMonitor_1.tokenHealthMonitor.recordSwap(priceUpdate.mint, priceUpdate.volumeUSD);
                        }
                        // Trigger callback with new price
                        if (this.priceUpdateCallback) {
                            this.priceUpdateCallback(priceUpdate.mint, priceUpdate.currentPriceUSD);
                        }
                    }
                }
            }
        }
        // Process account updates (bonding curve accounts AND metadata accounts)
        // These provide continuous price updates even when no swaps occur
        if (data.account) {
            try {
                var accountUpdate = data.account;
                var accountInfo = accountUpdate.account;
                if (!accountInfo)
                    return;
                // Extract account address and data
                var accountPubkey = accountInfo.pubkey;
                var accountData = accountInfo.data;
                if (!accountPubkey || !accountData)
                    return;
                // Convert pubkey to base58 string for comparison
                // yellowstone-grpc returns pubkey as Uint8Array
                var pubkeyBytes = accountPubkey instanceof Uint8Array ? accountPubkey : new Uint8Array(accountPubkey);
                var accountAddressString = new web3_js_1.PublicKey(pubkeyBytes).toBase58();
                // Check if this is a metadata account update
                var dataBuffer = accountData instanceof Uint8Array ? Buffer.from(accountData) : Buffer.from(new Uint8Array(accountData));
                // Metadata accounts have specific discriminator (first byte = 4)
                if (dataBuffer[0] === 4 && dataBuffer.length > 100) {
                    // This is a metadata account - parse and cache it
                    var metadata = metadataCache_1.metadataCache.parseMetadata(dataBuffer);
                    if (metadata) {
                        // Extract mint address from metadata PDA
                        // Metadata PDA = ["metadata", program_id, mint_pubkey]
                        // We need to derive which mint this metadata is for
                        // The metadata account itself contains the mint at offset 33-65
                        try {
                            var mintBytes = dataBuffer.slice(33, 65);
                            var mintPubkey = new web3_js_1.PublicKey(mintBytes);
                            var mintAddress = mintPubkey.toBase58();
                            // Store in cache
                            metadataCache_1.metadataCache.set(mintAddress, metadata);
                        }
                        catch (mintError) {
                            console.warn("[Position Monitor] Failed to extract mint from metadata:", mintError);
                        }
                    }
                    return; // Metadata handled, no further processing needed
                }
                // Find which mint this bonding curve belongs to (reverse lookup)
                var targetMint = null;
                for (var _i = 0, _c = this.bondingCurveAddresses.entries(); _i < _c.length; _i++) {
                    var _d = _c[_i], mint = _d[0], bcAddress = _d[1];
                    if (bcAddress === accountAddressString) {
                        targetMint = mint;
                        break;
                    }
                }
                if (!targetMint) {
                    // This account update is not for any of our monitored bonding curves
                    return;
                }
                // Parse bonding curve data (reuse existing dataBuffer from line 472)
                var bcData = this.parseBondingCurveData(dataBuffer);
                if (!bcData) {
                    console.warn("[Position Monitor] Failed to parse bonding curve data for ".concat(targetMint));
                    return;
                }
                // Calculate price from reserves
                var priceSOL = this.calculatePriceFromReserves(bcData);
                if (priceSOL === null) {
                    return;
                }
                var priceUSD = priceSOL * this.solPriceUSD;
                // Check if we should use this price (transaction takes precedence if recent)
                var existing = this.currentPrices.get(targetMint);
                var now = new Date();
                var shouldUpdate = true;
                if (existing && existing.lastUpdateSignature !== "initial" && existing.lastUpdateSignature !== "bonding-curve-account") {
                    // If we have a recent transaction update (within 1 second), don't override with account update
                    var timeSinceLastUpdate = now.getTime() - existing.lastUpdateTime.getTime();
                    if (timeSinceLastUpdate < 1000) {
                        shouldUpdate = false;
                        // Only log every 10th skip to avoid spam
                        if (Math.random() < 0.1) {
                            console.log("[Position Monitor] Skipping account update for ".concat(targetMint, " - recent transaction update (").concat(timeSinceLastUpdate, "ms ago)"));
                        }
                    }
                }
                if (shouldUpdate && existing) {
                    this.currentPrices.set(targetMint, __assign(__assign({}, existing), { currentPriceSOL: priceSOL, currentPriceUSD: priceUSD, lastUpdateTime: now, lastUpdateSignature: "bonding-curve-account" }));
                    // Track update time for fallback detection (Layer 3)
                    this.lastUpdateTimes.set(targetMint, now.getTime());
                    // Log bonding curve price updates (throttled - only every 5 seconds per token)
                    var lastLogKey = "lastBCLog_".concat(targetMint);
                    var lastLog = this[lastLogKey] || 0;
                    if (now.getTime() - lastLog > 5000) {
                        console.log("[Position Monitor] Bonding curve update for ".concat(targetMint, ": $").concat(priceUSD.toFixed(8), " (").concat(priceSOL.toFixed(10), " SOL)"));
                        this[lastLogKey] = now.getTime();
                    }
                    // Trigger callback with new price
                    if (this.priceUpdateCallback) {
                        this.priceUpdateCallback(targetMint, priceUSD);
                    }
                    // CRITICAL FIX: Send price to lifecycle integration for tracking
                    if (sharedState_1.sharedState.lifecycleIntegration) {
                        console.log('\x1b[90m%s\x1b[0m', "[DEBUG POS MONITOR] Sending price to lifecycle: ".concat(targetMint.substring(0, 8), "... = $").concat(priceUSD.toFixed(8)));
                        sharedState_1.sharedState.lifecycleIntegration.onPriceUpdate(targetMint, priceUSD);
                    }
                }
            }
            catch (error) {
                console.error("[Position Monitor] Error processing account update:", error);
            }
        }
    };
    /**
     * Parse bonding curve account data from gRPC account update
     * Bonding curve layout (pump.fun):
     * - Offset 0: discriminator (u64, 8 bytes)
     * - Offset 8: virtual_token_reserves (u64, 8 bytes)
     * - Offset 16: virtual_sol_reserves (u64, 8 bytes)
     * - Offset 24: real_token_reserves (u64, 8 bytes)
     * - Offset 32: real_sol_reserves (u64, 8 bytes)
     * - Offset 40: token_total_supply (u64, 8 bytes)
     * - Offset 48: complete (bool, 1 byte)
     */
    PositionMonitor.prototype.parseBondingCurveData = function (accountData) {
        try {
            // Validate buffer length (minimum 49 bytes for pump.fun bonding curve)
            if (!accountData || accountData.length < 49) {
                console.warn("[Position Monitor] Invalid bonding curve data: buffer too short (".concat((accountData === null || accountData === void 0 ? void 0 : accountData.length) || 0, " bytes)"));
                return null;
            }
            // Parse u64 values as BigInt (8 bytes each)
            var virtualTokenReserves = accountData.readBigUInt64LE(8);
            var virtualSolReserves = accountData.readBigUInt64LE(16);
            var realTokenReserves = accountData.readBigUInt64LE(24);
            var realSolReserves = accountData.readBigUInt64LE(32);
            var tokenTotalSupply = accountData.readBigUInt64LE(40);
            var complete = accountData.readUInt8(48) === 1;
            // Validate reserves are not negative (shouldn't happen with unsigned, but check for corruption)
            if (virtualTokenReserves < 0n || virtualSolReserves < 0n) {
                console.warn("[Position Monitor] Invalid reserves: negative values detected");
                return null;
            }
            return {
                virtualTokenReserves: virtualTokenReserves,
                virtualSolReserves: virtualSolReserves,
                realTokenReserves: realTokenReserves,
                realSolReserves: realSolReserves,
                tokenTotalSupply: tokenTotalSupply,
                complete: complete
            };
        }
        catch (error) {
            console.error("[Position Monitor] Error parsing bonding curve data:", error);
            return null;
        }
    };
    /**
     * Calculate token price from bonding curve reserves
     * Formula: price_per_token_in_SOL = virtual_sol_reserves / virtual_token_reserves
     * This provides continuous price updates (~400ms) even when no swaps occur
     */
    PositionMonitor.prototype.calculatePriceFromReserves = function (data) {
        try {
            // Check for division by zero
            if (data.virtualTokenReserves === 0n) {
                console.warn("[Position Monitor] Cannot calculate price: zero token reserves");
                return null;
            }
            // Check for zero reserves (brand new token, no liquidity yet)
            if (data.virtualSolReserves === 0n) {
                console.warn("[Position Monitor] Cannot calculate price: zero SOL reserves");
                return null;
            }
            // Calculate price: SOL reserves / token reserves
            // Convert BigInt to Number for price calculation
            var solReserves = Number(data.virtualSolReserves) / 1e9; // lamports to SOL
            var tokenReserves = Number(data.virtualTokenReserves) / 1e6; // Adjust for token decimals (typically 6 for pump.fun)
            var pricePerTokenSOL = solReserves / tokenReserves;
            // Validate price is realistic (between 0.0000000001 and 1000 SOL per token)
            // Pump.fun tokens can have very small prices (e.g., 0.00000003 SOL)
            if (pricePerTokenSOL < 0.0000000001 || pricePerTokenSOL > 1000) {
                console.warn("[Position Monitor] Unrealistic price calculated: ".concat(pricePerTokenSOL, " SOL"));
                return null;
            }
            return pricePerTokenSOL;
        }
        catch (error) {
            console.error("[Position Monitor] Error calculating price from reserves:", error);
            return null;
        }
    };
    /**
     * Fetch price from pump.fun API as fallback (Layer 3: Fallback Polling)
     * Called when gRPC updates have been stale for 10+ seconds
     * This provides a safety net for edge cases where bonding curve/transaction updates fail
     */
    PositionMonitor.prototype.fetchPriceFromAPI = function (mint) {
        return __awaiter(this, void 0, void 0, function () {
            var url, response, priceUSD, error_3;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        console.log("[Position Monitor] Fetching fallback price from API for ".concat(mint));
                        url = "https://frontend-api.pump.fun/coins/".concat(mint);
                        return [4 /*yield*/, axios_1.default.get(url, {
                                timeout: 3000,
                                headers: {
                                    'User-Agent': 'Mozilla/5.0',
                                }
                            })];
                    case 1:
                        response = _c.sent();
                        if (!response.data) {
                            console.warn("[Position Monitor] API returned no data for ".concat(mint));
                            return [2 /*return*/, null];
                        }
                        priceUSD = response.data.usd_market_cap / response.data.total_supply;
                        if (typeof priceUSD !== 'number' || isNaN(priceUSD) || priceUSD <= 0) {
                            console.warn("[Position Monitor] Invalid price from API for ".concat(mint, ": ").concat(priceUSD));
                            return [2 /*return*/, null];
                        }
                        // Validate price is realistic (between $0.0000001 and $1000)
                        if (priceUSD < 0.0000001 || priceUSD > 1000) {
                            console.warn("[Position Monitor] Unrealistic API price for ".concat(mint, ": $").concat(priceUSD));
                            return [2 /*return*/, null];
                        }
                        console.log("[Position Monitor] Fallback API price for ".concat(mint, ": $").concat(priceUSD.toFixed(8)));
                        return [2 /*return*/, priceUSD];
                    case 2:
                        error_3 = _c.sent();
                        if (axios_1.default.isAxiosError(error_3)) {
                            if (error_3.code === 'ECONNABORTED') {
                                console.warn("[Position Monitor] API timeout for ".concat(mint, " (>3s)"));
                            }
                            else if (((_a = error_3.response) === null || _a === void 0 ? void 0 : _a.status) === 404) {
                                console.warn("[Position Monitor] Token ".concat(mint, " not found in API (may have migrated)"));
                            }
                            else if (((_b = error_3.response) === null || _b === void 0 ? void 0 : _b.status) === 429) {
                                console.warn("[Position Monitor] API rate limit hit for ".concat(mint));
                            }
                            else {
                                console.warn("[Position Monitor] API error for ".concat(mint, ": ").concat(error_3.message));
                            }
                        }
                        else {
                            console.error("[Position Monitor] Unexpected error fetching API price for ".concat(mint, ":"), error_3);
                        }
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check for stale positions and fetch prices from API (Layer 3: Fallback Polling)
     * Called every 10 seconds by fallback polling interval
     * Identifies positions with no updates for 10+ seconds and fetches fresh prices
     */
    PositionMonitor.prototype.checkStalePositions = function () {
        return __awaiter(this, void 0, void 0, function () {
            var now, staleThreshold, stalePositions, _i, _a, _b, mint, lastUpdateTime, timeSinceUpdate, _c, stalePositions_1, mint, priceUSD, existing, priceSOL, error_4;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 6, , 7]);
                        now = Date.now();
                        staleThreshold = 10000;
                        stalePositions = [];
                        // Find all positions with no updates for 10+ seconds
                        for (_i = 0, _a = this.lastUpdateTimes.entries(); _i < _a.length; _i++) {
                            _b = _a[_i], mint = _b[0], lastUpdateTime = _b[1];
                            timeSinceUpdate = now - lastUpdateTime;
                            if (timeSinceUpdate > staleThreshold) {
                                stalePositions.push(mint);
                            }
                        }
                        if (stalePositions.length === 0) {
                            // All positions are being updated properly
                            return [2 /*return*/];
                        }
                        console.log("[Position Monitor] Found ".concat(stalePositions.length, " stale positions (no updates >10s), fetching fallback prices..."));
                        _c = 0, stalePositions_1 = stalePositions;
                        _d.label = 1;
                    case 1:
                        if (!(_c < stalePositions_1.length)) return [3 /*break*/, 5];
                        mint = stalePositions_1[_c];
                        // Check if position still exists (may have been removed)
                        if (!this.monitoredPositions.has(mint)) {
                            return [3 /*break*/, 4];
                        }
                        return [4 /*yield*/, this.fetchPriceFromAPI(mint)];
                    case 2:
                        priceUSD = _d.sent();
                        if (priceUSD !== null) {
                            existing = this.currentPrices.get(mint);
                            if (existing) {
                                priceSOL = priceUSD / this.solPriceUSD;
                                this.currentPrices.set(mint, __assign(__assign({}, existing), { currentPriceSOL: priceSOL, currentPriceUSD: priceUSD, lastUpdateTime: new Date(), lastUpdateSignature: "api-fallback" }));
                                // Update last update time to prevent immediate re-fetch
                                this.lastUpdateTimes.set(mint, Date.now());
                                // Trigger callback with new price
                                if (this.priceUpdateCallback) {
                                    this.priceUpdateCallback(mint, priceUSD);
                                }
                                console.log("[Position Monitor] Updated stale position ".concat(mint, " from API: $").concat(priceUSD.toFixed(8)));
                            }
                        }
                        else {
                            // API fetch failed - use last known price (no action needed, already cached)
                            console.warn("[Position Monitor] Could not fetch fallback price for ".concat(mint, ", using last known price"));
                        }
                        // Rate limit: Wait 200ms between API requests (max 5/second)
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 200); })];
                    case 3:
                        // Rate limit: Wait 200ms between API requests (max 5/second)
                        _d.sent();
                        _d.label = 4;
                    case 4:
                        _c++;
                        return [3 /*break*/, 1];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_4 = _d.sent();
                        console.error("[Position Monitor] Error checking stale positions:", error_4);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Start fallback polling system (Layer 3: Fallback Polling)
     * Runs checkStalePositions() every 10 seconds to detect and fix stale data
     * Provides additional safety net beyond gRPC and bonding curve monitoring
     */
    PositionMonitor.prototype.startFallbackPolling = function () {
        var _this = this;
        // Clear any existing interval
        if (this.fallbackPollInterval) {
            clearInterval(this.fallbackPollInterval);
        }
        console.log("[Position Monitor] Starting fallback polling (checks every 10 seconds for stale positions)");
        // Start polling interval (10 seconds)
        this.fallbackPollInterval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.checkStalePositions()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); }, 10000);
    };
    /**
     * Phase 3: Start health monitor cleanup interval
     * Removes old token data from health monitor every 5 minutes
     */
    PositionMonitor.prototype.startHealthMonitorCleanup = function () {
        // Clear any existing interval
        if (this.healthMonitorCleanupInterval) {
            clearInterval(this.healthMonitorCleanupInterval);
        }
        console.log("[Position Monitor] Starting health monitor cleanup (runs every 5 minutes)");
        // Start cleanup interval (5 minutes)
        this.healthMonitorCleanupInterval = setInterval(function () {
            tokenHealthMonitor_1.tokenHealthMonitor.cleanup();
        }, 5 * 60 * 1000);
    };
    /**
     * Extract price from swap transaction
     * This is the CORE of real-time monitoring - parsing prices from gRPC data
     */
    PositionMonitor.prototype.extractPriceFromTransaction = function (tx) {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
            var txData = (_a = tx.transaction) === null || _a === void 0 ? void 0 : _a.transaction;
            var meta = txData === null || txData === void 0 ? void 0 : txData.meta;
            if (!meta)
                return null;
            var preBalances = meta.preTokenBalances || [];
            var postBalances = meta.postTokenBalances || [];
            var _loop_1 = function (mint, position) {
                var preMint = preBalances.find(function (b) { return b.mint === mint; });
                var postMint = postBalances.find(function (b) { return b.mint === mint; });
                var preSOL = preBalances.find(function (b) { return b.mint === "So11111111111111111111111111111111111111112"; });
                var postSOL = postBalances.find(function (b) { return b.mint === "So11111111111111111111111111111111111111112"; });
                if (preMint && postMint && preSOL && postSOL) {
                    // Calculate swap amounts
                    var tokenDelta = Math.abs(Number(((_b = postMint.uiTokenAmount) === null || _b === void 0 ? void 0 : _b.amount) || 0) -
                        Number(((_c = preMint.uiTokenAmount) === null || _c === void 0 ? void 0 : _c.amount) || 0));
                    var solDelta = Math.abs(Number(((_d = postSOL.uiTokenAmount) === null || _d === void 0 ? void 0 : _d.amount) || 0) -
                        Number(((_e = preMint.uiTokenAmount) === null || _e === void 0 ? void 0 : _e.amount) || 0));
                    if (tokenDelta > 0 && solDelta > 0) {
                        // Price = SOL amount / Token amount
                        var tokenDecimals = ((_f = postMint.uiTokenAmount) === null || _f === void 0 ? void 0 : _f.decimals) || 9;
                        var solDecimals = 9;
                        var tokenAmount = tokenDelta / (Math.pow(10, tokenDecimals));
                        var solAmount = solDelta / (Math.pow(10, solDecimals));
                        var pricePerTokenSOL = solAmount / tokenAmount;
                        var pricePerTokenUSD = pricePerTokenSOL * this_1.solPriceUSD;
                        // Phase 3: Calculate swap volume for health tracking
                        var volumeUSD = solAmount * this_1.solPriceUSD;
                        var sig = (_g = tx.transaction) === null || _g === void 0 ? void 0 : _g.signature;
                        var sigString = typeof sig === 'string' ? sig : (sig ? Buffer.from(sig).toString('base64') : 'unknown');
                        return { value: {
                                mint: mint,
                                poolAddress: position.poolAddress,
                                currentPriceSOL: pricePerTokenSOL,
                                currentPriceUSD: pricePerTokenUSD,
                                lastUpdateTime: new Date(),
                                lastUpdateSignature: sigString,
                                source: position.dex,
                                volumeUSD: volumeUSD,
                            } };
                    }
                }
            };
            var this_1 = this;
            // Find which monitored token is involved
            for (var _i = 0, _h = this.monitoredPositions; _i < _h.length; _i++) {
                var _j = _h[_i], mint = _j[0], position = _j[1];
                var state_1 = _loop_1(mint, position);
                if (typeof state_1 === "object")
                    return state_1.value;
            }
            return null;
        }
        catch (error) {
            console.error("[Position Monitor] Error extracting price:", error);
            return null;
        }
    };
    /**
     * Get monitoring statistics
     */
    PositionMonitor.prototype.getStats = function () {
        var prices = Array.from(this.currentPrices.values());
        var oldest = null;
        var newest = null;
        prices.forEach(function (p) {
            if (!oldest || p.lastUpdateTime < oldest)
                oldest = p.lastUpdateTime;
            if (!newest || p.lastUpdateTime > newest)
                newest = p.lastUpdateTime;
        });
        return {
            totalPositions: this.monitoredPositions.size,
            pricesUpdated: prices.filter(function (p) { return p.lastUpdateSignature !== "initial"; }).length,
            oldestUpdate: oldest,
            newestUpdate: newest,
        };
    };
    return PositionMonitor;
}());
exports.PositionMonitor = PositionMonitor;
/**
 * Helper: Derive pool address for different DEXes
 * This is a simplified version - full implementation needs proper PDA derivation
 */
function derivePoolAddress(tokenMint, dex) {
    // TODO: Implement proper pool address derivation for each DEX
    // For now, return placeholder
    // In production:
    // - Raydium: Use AMM pool PDA derivation
    // - Pump.fun: Use bonding curve address
    // - Pumpswap: Use their pool derivation logic
    console.warn("[Pool Derivation] TODO: Implement proper derivation for ".concat(dex));
    return tokenMint; // Placeholder
}
