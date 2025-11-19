"use strict";
/**
 * gRPC Token Detection - Finds NEW tokens via gRPC stream
 *
 * ⚠️ PROJECT: VIP-Sol-Sniper2
 * This module is responsible for detecting NEW token launches via gRPC.
 * It maintains its own persistent gRPC connection (separate from positionMonitor).
 *
 * Features:
 * - Subscribes to program accounts or wallet transactions
 * - Detects new token launches in real-time
 * - Extracts mint addresses from transaction data
 * - Uses updateSubscription() pattern (NO restarts for adding/removing subscriptions)
 * - Independent from position monitoring (Stream #1 for NEW tokens)
 *
 * Architecture:
 * - grpcTokenDetection.ts: Finds NEW tokens (this file - Stream #1)
 * - positionMonitor.ts: Monitors OWNED tokens (Stream #2)
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrpcTokenDetection = void 0;
var yellowstone_grpc_1 = __importDefault(require("@triton-one/yellowstone-grpc"));
var grpcManager_1 = require("../utils/managers/grpcManager");
/**
 * gRPC Token Detection Class
 * Maintains independent gRPC stream for finding NEW tokens
 */
var GrpcTokenDetection = /** @class */ (function () {
    function GrpcTokenDetection(detectionConfig, logFn) {
        this.detectionConfig = detectionConfig;
        this.grpcClient = null;
        this.grpcStream = null;
        this.isActive = false;
        this.onTokenDetectedCallback = null;
        // Exponential backoff for reconnection
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.baseReconnectDelay = 5000; // 5 seconds
        this.reconnectTimer = null;
        this.isReconnecting = false;
        this.logFunction = logFn;
    }
    /**
     * Set callback for when new token is detected
     */
    GrpcTokenDetection.prototype.onTokenDetected = function (callback) {
        this.onTokenDetectedCallback = callback;
    };
    /**
     * Start token detection stream
     */
    GrpcTokenDetection.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.isActive) {
                            this.logFunction("Token Detection", "Already active", "yellow");
                            return [2 /*return*/];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        this.logFunction("\u2705 Starting Sniper via gRPC...", "", "white");
                        this.logFunction("\uD83D\uDFE1 Config", "Token detection stream mode: ".concat(this.detectionConfig.dataStreamMode), "yellow");
                        // Create gRPC client and stream
                        this.grpcClient = new yellowstone_grpc_1.default(this.detectionConfig.grpcEndpoint, this.detectionConfig.grpcToken, { skipPreflight: true });
                        _a = this;
                        return [4 /*yield*/, this.grpcClient.subscribe()];
                    case 2:
                        _a.grpcStream = _b.sent();
                        // Setup initial subscription
                        return [4 /*yield*/, this.setupSubscription()];
                    case 3:
                        // Setup initial subscription
                        _b.sent();
                        this.setupEventHandlers();
                        this.isActive = true;
                        this.logFunction("".concat(this.getCurrentTime()), "Geyser connection and subscription established", "green");
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _b.sent();
                        this.logFunction("".concat(this.getCurrentTime()), "Failed to start token detection: ".concat(error_1), "red");
                        throw error_1;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Stop token detection stream
     */
    GrpcTokenDetection.prototype.stop = function () {
        if (this.grpcStream) {
            this.grpcStream.end();
            this.grpcStream = null;
        }
        this.grpcClient = null;
        this.isActive = false;
        this.logFunction("".concat(this.getCurrentTime()), "Token detection stopped", "yellow");
    };
    /**
     * Update subscription WITHOUT restarting connection
     * Currently not used for token detection (we subscribe to program accounts)
     * But included for future extensibility (e.g., dynamic program list updates)
     */
    GrpcTokenDetection.prototype.updateSubscription = function () {
        return __awaiter(this, void 0, void 0, function () {
            var request;
            return __generator(this, function (_a) {
                if (!this.grpcStream)
                    return [2 /*return*/];
                request = (0, grpcManager_1.createSubscribeRequest)(this.detectionConfig.dataStreamPrograms, this.detectionConfig.dataStreamWallets, this.detectionConfig.dataStreamMode);
                // Send updated subscription (reuses existing connection)
                this.grpcStream.write(request);
                this.logFunction("".concat(this.getCurrentTime()), "Subscription updated", "blue");
                return [2 /*return*/];
            });
        });
    };
    /**
     * Setup initial gRPC subscription
     */
    GrpcTokenDetection.prototype.setupSubscription = function () {
        return __awaiter(this, void 0, void 0, function () {
            var request;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.grpcStream)
                            return [2 /*return*/];
                        request = (0, grpcManager_1.createSubscribeRequest)(this.detectionConfig.dataStreamPrograms, this.detectionConfig.dataStreamWallets, this.detectionConfig.dataStreamMode);
                        return [4 /*yield*/, (0, grpcManager_1.sendSubscribeRequest)(this.grpcStream, request)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Setup event handlers for gRPC stream
     */
    GrpcTokenDetection.prototype.setupEventHandlers = function () {
        var _this = this;
        if (!this.grpcStream)
            return;
        this.grpcStream.on("data", function (data) {
            // Successful data received - reset reconnection attempts
            _this.reconnectAttempts = 0;
            _this.processGrpcData(data);
        });
        this.grpcStream.on("error", function (error) {
            var errorMsg = error.toString();
            // Detect rate limiting (429 error)
            var isRateLimited = errorMsg.includes('429') || errorMsg.includes('Too Many Requests');
            if (isRateLimited) {
                _this.logFunction("".concat(_this.getCurrentTime()), "\uD83D\uDEA8 RATE LIMIT DETECTED (429): ".concat(error), "red");
                // Use longer delay for rate limits (start at 30 seconds)
                _this.scheduleReconnect(30000);
            }
            else {
                _this.logFunction("".concat(_this.getCurrentTime()), "Stream error: ".concat(error), "red");
                _this.scheduleReconnect();
            }
        });
        this.grpcStream.on("end", function () {
            _this.logFunction("".concat(_this.getCurrentTime()), "Stream ended - will reconnect with backoff...", "red");
            _this.scheduleReconnect();
        });
        this.grpcStream.on("close", function () {
            _this.logFunction("".concat(_this.getCurrentTime()), "Stream closed - will reconnect with backoff...", "red");
            _this.scheduleReconnect();
        });
    };
    /**
     * Schedule reconnection with exponential backoff
     */
    GrpcTokenDetection.prototype.scheduleReconnect = function (overrideDelay) {
        var _this = this;
        // Prevent multiple simultaneous reconnection attempts
        if (this.isReconnecting) {
            return;
        }
        // Check if max attempts reached
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logFunction("".concat(this.getCurrentTime()), "\u274C Max reconnection attempts (".concat(this.maxReconnectAttempts, ") reached. Stopping retries."), "red");
            this.isActive = false;
            return;
        }
        this.isReconnecting = true;
        // Clear any existing timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        // Calculate delay with exponential backoff
        // 5s → 10s → 20s → 40s → 80s → 160s (capped at 5 minutes)
        var exponentialDelay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
        var cappedDelay = Math.min(exponentialDelay, 300000); // Max 5 minutes
        var delay = overrideDelay || cappedDelay;
        this.reconnectAttempts++;
        this.logFunction("".concat(this.getCurrentTime()), "\u23F3 Reconnection attempt ".concat(this.reconnectAttempts, "/").concat(this.maxReconnectAttempts, " in ").concat((delay / 1000).toFixed(0), "s..."), "yellow");
        this.reconnectTimer = setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.restartSubscription()];
                    case 1:
                        _a.sent();
                        this.isReconnecting = false;
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _a.sent();
                        this.logFunction("".concat(this.getCurrentTime()), "Reconnection failed: ".concat(error_2), "red");
                        this.isReconnecting = false;
                        // Try again with next backoff level
                        this.scheduleReconnect();
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); }, delay);
    };
    /**
     * Restart subscription (ONLY for error recovery)
     * Do NOT use this for normal operations - use updateSubscription() instead
     */
    GrpcTokenDetection.prototype.restartSubscription = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.grpcClient)
                            return [2 /*return*/];
                        this.logFunction("".concat(this.getCurrentTime()), "\uD83D\uDD04 RESTARTING token detection connection (attempt ".concat(this.reconnectAttempts, ")"), "yellow");
                        // End current stream
                        if (this.grpcStream) {
                            this.grpcStream.end();
                        }
                        // Create new stream
                        _a = this;
                        return [4 /*yield*/, this.grpcClient.subscribe()];
                    case 1:
                        // Create new stream
                        _a.grpcStream = _b.sent();
                        return [4 /*yield*/, this.setupSubscription()];
                    case 2:
                        _b.sent();
                        this.setupEventHandlers();
                        this.logFunction("".concat(this.getCurrentTime()), "\u2705 Reconnection successful", "green");
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Process gRPC data updates
     * Extracted from index.ts processGrpcData()
     */
    GrpcTokenDetection.prototype.processGrpcData = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var transaction, meta, isTokenSell, tokenBalances, tokenMint, logs, instructionType, pre, post;
            var _this = this;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                if (!(0, grpcManager_1.isSubscribeUpdateTransaction)(data) || !data.filters.includes("sniper")) {
                    return [2 /*return*/];
                }
                transaction = (_a = data.transaction) === null || _a === void 0 ? void 0 : _a.transaction;
                meta = transaction === null || transaction === void 0 ? void 0 : transaction.meta;
                isTokenSell = null;
                if (!transaction || !meta) {
                    return [2 /*return*/];
                }
                tokenBalances = meta.postTokenBalances || meta.preTokenBalances;
                if (!(tokenBalances === null || tokenBalances === void 0 ? void 0 : tokenBalances.length))
                    return [2 /*return*/];
                // Determine if this is a token sell or buy based on stream mode
                if (this.detectionConfig.dataStreamMode === "program" && this.detectionConfig.dataStreamPrograms.length > 0) {
                    if (!meta.logMessages.some(function (msg) {
                        return _this.detectionConfig.logDiscriminators.some(function (discriminator) { return msg.includes(discriminator); });
                    })) {
                        return [2 /*return*/];
                    }
                    isTokenSell = false;
                }
                else if (this.detectionConfig.dataStreamMode === "wallet" && this.detectionConfig.dataStreamWallets.length > 0) {
                    if (!meta.logMessages.some(function (log) {
                        return log.includes("Program log: Instruction: Buy") || log.includes("Program log: Instruction: Sell");
                    })) {
                        if (!meta.logMessages.some(function (log) {
                            return log.includes("Program log: Instruction: Swap") || log.includes("Program log: Instruction: SwapV2");
                        })) {
                            return [2 /*return*/];
                        }
                    }
                }
                else {
                    // Invalid state
                    return [2 /*return*/];
                }
                // Extract the token mint from transaction
                this.logFunction("\u2705 New token instruction found", "", "green");
                tokenMint = this.getMintFromTokenBalances(tokenBalances);
                if (!tokenMint) {
                    this.logFunction("".concat(this.getCurrentTime()), "No valid token CA could be extracted", "red");
                    this.logFunction("\uD83D\uDD0E ".concat(this.getCurrentTime()), "Continue looking at the data stream...", "white");
                    return [2 /*return*/];
                }
                // Check token flow direction for wallet mode
                if (this.detectionConfig.dataStreamMode === "wallet" && this.detectionConfig.dataStreamWallets.length > 0) {
                    logs = meta.logMessages || [];
                    instructionType = logs.find(function (log) {
                        return log.includes("Program log: Instruction: Sell") ||
                            log.includes("Program log: Instruction: Buy") ||
                            log.includes("Program log: Instruction: Swap") ||
                            log.includes("Program log: Instruction: SwapV2");
                    });
                    if (instructionType === null || instructionType === void 0 ? void 0 : instructionType.includes("Sell")) {
                        isTokenSell = true;
                    }
                    else if (instructionType === null || instructionType === void 0 ? void 0 : instructionType.includes("Buy")) {
                        isTokenSell = false;
                    }
                    else if (instructionType === null || instructionType === void 0 ? void 0 : instructionType.includes("Swap")) {
                        pre = meta.preTokenBalances.find(function (b) { return b.mint === tokenMint; });
                        post = meta.postTokenBalances.find(function (b) { return b.mint === tokenMint; });
                        if (((_b = pre === null || pre === void 0 ? void 0 : pre.uiTokenAmount) === null || _b === void 0 ? void 0 : _b.amount) && ((_c = post === null || post === void 0 ? void 0 : post.uiTokenAmount) === null || _c === void 0 ? void 0 : _c.amount)) {
                            isTokenSell = Number(post.uiTokenAmount.amount) < Number(pre.uiTokenAmount.amount);
                        }
                        else {
                            this.logFunction("\u274C ".concat(this.getCurrentTime()), "Unable to determine token flow: Missing balances for token during swap.", "red");
                            return [2 /*return*/];
                        }
                    }
                    else {
                        this.logFunction("\u274C ".concat(this.getCurrentTime()), "Unrecognized instruction in logs. Unable to determine token flow direction.", "red");
                        return [2 /*return*/];
                    }
                }
                else {
                    isTokenSell = false;
                }
                this.logFunction("\u2705 ".concat(this.getCurrentTime()), "Token CA extracted successfully", "green");
                // Trigger callback with detected token
                if (this.onTokenDetectedCallback && isTokenSell !== null) {
                    this.onTokenDetectedCallback({
                        mint: tokenMint,
                        isTokenSell: isTokenSell,
                        transaction: data.transaction // Pass full transaction data
                    });
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Extract mint address from token balances
     * Extracted from index.ts getMintFromTokenBalances()
     */
    GrpcTokenDetection.prototype.getMintFromTokenBalances = function (tokenBalances) {
        // Fast path: If we have exactly 2 token balances, one is likely WSOL and the other is the token
        if (tokenBalances.length === 2) {
            var mint1 = tokenBalances[0].mint;
            var mint2 = tokenBalances[1].mint;
            // If mint1 is WSOL, return mint2 (unless it's also WSOL)
            if (mint1 === this.detectionConfig.wsolMint) {
                return mint2 === this.detectionConfig.wsolMint ? null : mint2;
            }
            // If mint2 is WSOL, return mint1
            if (mint2 === this.detectionConfig.wsolMint) {
                return mint1;
            }
            // If neither is WSOL, return the first one
            return mint1;
        }
        // For more than 2 balances, find the first non-WSOL mint
        for (var _i = 0, tokenBalances_1 = tokenBalances; _i < tokenBalances_1.length; _i++) {
            var balance = tokenBalances_1[_i];
            if (balance.mint !== this.detectionConfig.wsolMint) {
                return balance.mint;
            }
        }
        return null;
    };
    /**
     * Helper: Get current time
     */
    GrpcTokenDetection.prototype.getCurrentTime = function () {
        var now = new Date();
        return now.toTimeString().split(" ")[0]; // returns "HH:MM:SS"
    };
    /**
     * Get detection status
     */
    GrpcTokenDetection.prototype.isRunning = function () {
        return this.isActive;
    };
    return GrpcTokenDetection;
}());
exports.GrpcTokenDetection = GrpcTokenDetection;
