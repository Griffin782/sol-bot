"use strict";
// ============================================
// MARKET RECORDER - Core Recording Engine
// Integrates with existing bot's WebSocket detection
// Records 1s chart data for all detected tokens
// ============================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketRecorder = void 0;
const web3_js_1 = require("@solana/web3.js");
const sqlite3 = __importStar(require("sqlite3"));
const sqlite_1 = require("sqlite");
const events_1 = require("events");
const mi_config_1 = require("../config/mi-config");
const poolDerivation_1 = require("../../src/utils/poolDerivation");
// ============================================
// HELPER FUNCTIONS
// ============================================
/**
 * Sanitize strings to remove broken unicode/emojis
 * Prevents JSON encoding errors and SQLite issues
 *
 * @param str - Input string that may contain broken unicode
 * @returns Clean string safe for database and JSON
 */
function sanitizeString(str) {
    if (!str)
        return '';
    try {
        // Remove broken unicode surrogates (causes "no low surrogate" error)
        let clean = str.replace(/[\uD800-\uDFFF]/g, '');
        // Remove any remaining problematic characters
        clean = clean.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
        // Trim whitespace and limit length
        return clean.trim().slice(0, 100);
    }
    catch (error) {
        console.warn('String sanitization error:', error);
        return 'ENCODING_ERROR';
    }
}
// ============================================
// MARKET RECORDER CLASS
// ============================================
class MarketRecorder extends events_1.EventEmitter {
    constructor(connection, config) {
        super();
        this.db = null;
        // Active tracking
        this.trackedPositions = new Map();
        this.priceUpdateIntervals = new Map();
        this.tokensBeingTracked = new Set(); // Race condition fix
        // Batch writing for performance
        this.writeQueue = [];
        this.flushInterval = null;
        this.isRunning = false;
        // PHASE 1 FIX: Transaction queue to prevent nested transactions
        // Problem: Multiple concurrent flushWriteQueue() calls cause "SQLITE_ERROR: cannot start a transaction within a transaction"
        // Solution: Serialize all transaction operations through a promise queue
        // This ensures only ONE transaction runs at a time
        this.transactionQueue = Promise.resolve();
        this.isTransactionInProgress = false;
        // Statistics
        this.stats = {
            tokens_detected: 0,
            tokens_scored: 0,
            tokens_tracked: 0,
            tokens_blocked: 0,
            positions_exited: 0,
            database_writes: 0,
        };
        this.connection = connection;
        this.config = config || (0, mi_config_1.getMarketIntelligenceConfig)();
    }
    // ============================================
    // INITIALIZATION & SHUTDOWN
    // ============================================
    async initialize() {
        if (this.isRunning) {
            console.log('📊 Market Recorder already running');
            return;
        }
        console.log('📊 Initializing Market Intelligence Recorder...');
        // Initialize database
        await this.initializeDatabase();
        // Start batch flush interval
        this.startBatchFlush();
        this.isRunning = true;
        // Display database path (behavior-based, not terminology-dependent)
        const isBaselineMode = this.config.recording.record_all_tokens;
        const dbPath = isBaselineMode
            ? (0, mi_config_1.getCurrentDatabasePath)('baseline')
            : (0, mi_config_1.getCurrentDatabasePath)('bot');
        console.log('✅ Market Recorder initialized successfully');
        console.log(`📁 Database: ${dbPath}`);
        console.log(`📊 Recording: ${isBaselineMode ? 'ALL TOKENS (baseline)' : 'FILTERED (bot session)'}`);
        console.log(`🎯 Min Score to Track: ${this.config.scoring.min_score_to_track}`);
        console.log(`⏱️  Price update interval: ${this.config.exit_simulation.check_interval}s (baseline market data collection)`);
        this.emit('recorder_started');
    }
    async shutdown() {
        if (!this.isRunning)
            return;
        console.log('📊 Shutting down Market Recorder...');
        // Stop all price monitoring
        for (const [mint, interval] of this.priceUpdateIntervals) {
            clearInterval(interval);
        }
        this.priceUpdateIntervals.clear();
        // Stop batch flush
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        // Flush any remaining writes
        await this.flushWriteQueue();
        // Close database
        if (this.db) {
            await this.db.close();
        }
        this.isRunning = false;
        console.log('✅ Market Recorder shut down successfully');
        console.log(`📊 Final Stats: ${JSON.stringify(this.stats, null, 2)}`);
        this.emit('recorder_stopped');
    }
    // ============================================
    // DATABASE MANAGEMENT
    // ============================================
    async initializeDatabase() {
        // ============================================
        // DATABASE PATH SELECTION
        // ============================================
        // IMPORTANT: Logic is based on BEHAVIOR (record_all_tokens flag)
        // NOT on mode terminology (test/paper/live/conservative)
        // This ensures terminology cleanup won't break database logic
        //
        // - record_all_tokens = true  → BASELINE recorder → baseline-YYYY-MM-DD.db (daily rotation)
        // - record_all_tokens = false → BOT SESSION tracker → session-specific name from config
        // ============================================
        const isBaselineMode = this.config.recording.record_all_tokens;
        const dbPath = isBaselineMode
            ? (0, mi_config_1.getCurrentDatabasePath)('baseline')
            : (0, mi_config_1.getCurrentDatabasePath)('bot');
        // Create database directory if doesn't exist
        const fs = require('fs');
        const path = require('path');
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        // Open database
        this.db = await (0, sqlite_1.open)({
            filename: dbPath,
            driver: sqlite3.Database
        });
        // Load schema
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            await this.db.exec(schema);
            console.log('✅ Database schema loaded');
        }
        else {
            console.warn('⚠️  Schema file not found, using existing database structure');
        }
    }
    // ============================================
    // TOKEN DETECTION HANDLING
    // ============================================
    /**
     * Main entry point - called when bot detects a new token
     * This integrates with existing WebSocket detection in index.ts
     */
    async onTokenDetected(token, score) {
        if (!this.isRunning || !this.config.recording.enabled)
            return;
        // NOTE: tokens_detected++ moved to startTrackingToken() to count UNIQUE tokens only
        // (not repeated detection events for same token)
        this.stats.tokens_scored++;
        const dateOnly = new Date().toISOString().split('T')[0];
        // ALWAYS record to tokens_scored table (even if we won't buy)
        // BUG FIX: Sanitize strings to prevent unicode/emoji encoding errors
        this.queueWrite('tokens_scored', {
            timestamp: new Date(token.timestamp).toISOString(),
            date_only: dateOnly,
            mint: token.mint,
            name: sanitizeString(token.name),
            symbol: sanitizeString(token.symbol),
            creator: sanitizeString(token.creator),
            detection_method: token.detection_method,
            detection_program: sanitizeString(token.detection_program),
            initial_price: token.initial_price || 0,
            initial_liquidity: token.initial_liquidity || 0,
            initial_volume_24h: token.initial_volume_24h || 0,
            initial_holder_count: token.initial_holder_count || 0,
            initial_market_cap: token.initial_market_cap || 0,
            score: score.score,
            would_buy: score.would_buy,
            would_buy_reason: score.would_buy_reason || '',
            blocked_reason: score.blocked_reason || '',
            has_mint_authority: score.has_mint_authority,
            has_freeze_authority: score.has_freeze_authority,
            rugcheck_score: score.rugcheck_score || 0
        });
        // If token passes scoring, start tracking it
        // BASELINE MODE: Track everything (ignore would_buy and score filters)
        // BOT MODE: Only track tokens that pass filters
        const shouldTrack = (0, mi_config_1.shouldRecordToken)(score.score, this.config);
        const isBaselineMode = this.config.recording.record_all_tokens;
        console.log(`\n🔍 [DEBUG] Token ${token.mint.slice(0, 8)}:`);
        console.log(`   - Score: ${score.score}`);
        console.log(`   - Min Score Required: ${this.config.scoring.min_score_to_track}`);
        console.log(`   - Baseline Mode: ${isBaselineMode}`);
        console.log(`   - record_all_tokens: ${this.config.recording.record_all_tokens}`);
        console.log(`   - shouldRecordToken() returned: ${shouldTrack}`);
        console.log(`   - Decision: ${shouldTrack ? '✅ WILL TRACK' : '❌ REJECTED'}\n`);
        if (shouldTrack) {
            await this.startTrackingToken(token, score);
        }
        else {
            this.stats.tokens_blocked++;
            console.log(`⏭️  Token ${token.mint.slice(0, 8)} REJECTED by shouldRecordToken() - score: ${score.score}, min: ${this.config.scoring.min_score_to_track}`);
        }
        // Emit event for monitoring
        this.emit('token_detected', { token, score });
    }
    // ============================================
    // TOKEN TRACKING
    // ============================================
    async startTrackingToken(token, score) {
        console.log(`\n📊 [START_TRACKING] Token ${token.mint.slice(0, 8)} - ENTERED startTrackingToken()`);
        // RACE CONDITION FIX: Check in-memory set first (instant, prevents duplicates)
        if (this.tokensBeingTracked.has(token.mint)) {
            console.log(`⏭️  [IN-MEMORY CHECK] Token ${token.mint.slice(0, 8)} already in memory - REJECTED`);
            return;
        }
        console.log(`✅ [IN-MEMORY CHECK] Token ${token.mint.slice(0, 8)} not in memory - continuing...`);
        // INCREMENT COUNTER: Only count UNIQUE tokens (passed in-memory check)
        this.stats.tokens_detected++;
        console.log(`📊 [COUNTER] tokens_detected incremented to: ${this.stats.tokens_detected}`);
        // ============================================
        // DATABASE DUPLICATE CHECK
        // ============================================
        // ONLY check database in BOT SESSION MODE (for handling restarts)
        // SKIP this check in BASELINE MODE (want to record all detections)
        //
        // Use Cases:
        // - Bot session (record_all_tokens: false): Check DB to prevent duplicates during session restart
        // - Baseline (record_all_tokens: true): Skip DB check, record every detection even if seen before
        // ============================================
        const isBaselineMode = this.config.recording.record_all_tokens;
        console.log(`\n🔍 [DB CHECK] Baseline Mode: ${isBaselineMode}`);
        console.log(`🔍 [DB CHECK] Will ${isBaselineMode ? 'SKIP' : 'PERFORM'} database duplicate check`);
        if (!isBaselineMode) {
            // BOT SESSION MODE: Check database for duplicates (handle restarts)
            console.log(`🔍 [DB CHECK] BOT MODE - checking database for duplicates...`);
            try {
                const existing = await this.db?.get('SELECT mint, tracking_status FROM tokens_tracked WHERE mint = ?', [token.mint]);
                if (existing) {
                    if (existing.tracking_status === 'active') {
                        console.log(`⏭️  Token ${token.mint.slice(0, 8)}... already being tracked (database)`);
                        this.tokensBeingTracked.add(token.mint); // Add to in-memory set
                        return; // Don't insert duplicate
                    }
                    else {
                        // Token was previously tracked but exited - this is a re-appearance
                        console.log(`🔄 Token ${token.mint.slice(0, 8)}... re-appeared after exit`);
                        // Continue with tracking (will update existing record or create new entry)
                    }
                }
            }
            catch (error) {
                console.warn('Error checking existing token:', error);
                // Continue anyway
            }
        }
        else {
            // BASELINE MODE: Skip database check, record every detection
            console.log(`📊 [BASELINE MODE] Token ${token.mint.slice(0, 8)} - SKIPPING database duplicate check`);
            console.log(`📊 [BASELINE MODE] Will record this token regardless of previous detections`);
        }
        // Mark as being tracked BEFORE database write (prevents race condition)
        this.tokensBeingTracked.add(token.mint);
        console.log(`✅ [TRACKING] Token ${token.mint.slice(0, 8)} added to in-memory tracking set`);
        this.stats.tokens_tracked++;
        console.log(`✅ [TRACKING] tokens_tracked counter incremented to: ${this.stats.tokens_tracked}`);
        const position = {
            mint: token.mint,
            detected_at: token.timestamp,
            entry_score: score.score,
            simulated_buy_price: token.initial_price || 0,
            simulated_position_size: this.config.backtesting.default_position_size,
            simulated_token_amount: 0, // Would calculate based on price
            tracking_status: 'active',
            tracking_started: Date.now(),
            current_price: token.initial_price || 0,
            current_gain_percent: 0,
            high_price: token.initial_price || 0,
            high_gain_percent: 0,
            hold_duration_seconds: 0,
            post_exit_monitoring: false,
            remaining_position: 1.0, // 100% position
        };
        // Calculate simulated token amount
        if (token.initial_price && token.initial_price > 0) {
            position.simulated_token_amount = position.simulated_position_size / token.initial_price;
        }
        this.trackedPositions.set(token.mint, position);
        // Record to database
        const dateOnly = new Date().toISOString().split('T')[0];
        this.queueWrite('tokens_tracked', {
            mint: token.mint,
            date_only: dateOnly,
            detected_at: new Date(token.timestamp).toISOString(),
            entry_score: score.score,
            simulated_buy_price: position.simulated_buy_price,
            simulated_position_size: position.simulated_position_size,
            simulated_token_amount: position.simulated_token_amount,
            tracking_status: 'active',
            tracking_started: new Date(position.tracking_started).toISOString()
        });
        // Start 1-second price monitoring (only if price tracking enabled)
        if (this.config.recording.record_1s_charts) {
            this.startPriceMonitoring(token.mint);
            console.log(`📈 Started tracking: ${token.symbol || token.mint.slice(0, 8)} (Score: ${score.score})`);
        }
        else {
            // Baseline mode: Just record detection, no price tracking
            console.log(`📊 Recorded: ${token.symbol || token.mint.slice(0, 8)} (Score: ${score.score}) [No price tracking]`);
        }
        console.log(`\n✅ [SUCCESS] Token ${token.mint.slice(0, 8)} SUCCESSFULLY TRACKED - END OF FUNCTION\n`);
        this.emit('tracking_started', { mint: token.mint, score: score.score });
    }
    //============================================
    // PRICE MONITORING (1-SECOND INTERVALS)
    // ============================================
    startPriceMonitoring(mint) {
        const interval = setInterval(async () => {
            await this.updateTokenPrice(mint);
        }, 1000); // Every 1 second
        this.priceUpdateIntervals.set(mint, interval);
    }
    async updateTokenPrice(mint) {
        const position = this.trackedPositions.get(mint);
        if (!position)
            return;
        try {
            // TODO: Get actual price from your price feed
            // For now, simulate price updates
            const currentPrice = await this.getCurrentPrice(mint);
            if (!currentPrice)
                return;
            // Update position state
            const previousPrice = position.current_price;
            position.current_price = currentPrice;
            position.hold_duration_seconds = Math.floor((Date.now() - position.tracking_started) / 1000);
            // Calculate gains
            if (position.simulated_buy_price > 0) {
                position.current_gain_percent =
                    ((currentPrice - position.simulated_buy_price) / position.simulated_buy_price) * 100;
                if (currentPrice > position.high_price) {
                    position.high_price = currentPrice;
                    position.high_gain_percent = position.current_gain_percent;
                }
            }
            // Record 1s price data
            const dateOnly = new Date().toISOString().split('T')[0];
            this.queueWrite('price_history_1s', {
                mint: mint,
                timestamp: new Date().toISOString(),
                date_only: dateOnly,
                price: currentPrice,
                price_change_1s: previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0,
                gain_from_entry: position.current_gain_percent,
                high_since_entry: position.high_gain_percent
            });
            // Check for exit conditions
            await this.checkExitConditions(mint, position);
        }
        catch (error) {
            console.error(`Error updating price for ${mint}:`, error);
        }
    }
    /**
     * Get current token price from on-chain bonding curve data
     * Uses same method as PositionMonitor - no API calls needed!
     * Fetches bonding curve account state and calculates price from reserves
     */
    async getCurrentPrice(mint) {
        try {
            // Derive bonding curve address (deterministic PDA)
            const bondingCurveInfo = (0, poolDerivation_1.derivePumpFunBondingCurve)(mint);
            const bondingCurvePubkey = new web3_js_1.PublicKey(bondingCurveInfo.poolAddress);
            // Fetch bonding curve account data from RPC
            const accountInfo = await this.connection.getAccountInfo(bondingCurvePubkey);
            if (!accountInfo || !accountInfo.data) {
                // Token might not be on pump.fun or bonding curve doesn't exist yet
                return null;
            }
            // Parse bonding curve data (same structure as PositionMonitor uses)
            const bondingCurveData = this.parseBondingCurveData(accountInfo.data);
            if (!bondingCurveData) {
                return null;
            }
            // Calculate price from reserves
            const price = this.calculatePriceFromReserves(bondingCurveData);
            return price;
        }
        catch (error) {
            console.error(`❌ [MI] Error fetching on-chain price for ${mint.slice(0, 8)}:`, error);
            return null;
        }
    }
    /**
     * Parse bonding curve account data
     * Bonding curve layout (pump.fun):
     * - Offset 8: virtual_token_reserves (u64, 8 bytes)
     * - Offset 16: virtual_sol_reserves (u64, 8 bytes)
     */
    parseBondingCurveData(accountData) {
        try {
            // Validate buffer length
            if (!accountData || accountData.length < 49) {
                return null;
            }
            // Parse reserves as BigInt
            const virtualTokenReserves = accountData.readBigUInt64LE(8);
            const virtualSolReserves = accountData.readBigUInt64LE(16);
            // Validate reserves
            if (virtualTokenReserves <= 0n || virtualSolReserves <= 0n) {
                return null;
            }
            return { virtualTokenReserves, virtualSolReserves };
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Calculate token price from bonding curve reserves
     * Formula: price_per_token_in_SOL = virtual_sol_reserves / virtual_token_reserves
     */
    calculatePriceFromReserves(data) {
        try {
            // Check for division by zero
            if (data.virtualTokenReserves === 0n) {
                return null;
            }
            // Calculate price: SOL reserves / token reserves
            const solReserves = Number(data.virtualSolReserves) / 1e9; // lamports to SOL
            const tokenReserves = Number(data.virtualTokenReserves) / 1e6; // Adjust for token decimals
            const pricePerTokenSOL = solReserves / tokenReserves;
            // Validate price is realistic
            if (pricePerTokenSOL < 0.0000000001 || pricePerTokenSOL > 1000) {
                return null;
            }
            return pricePerTokenSOL;
        }
        catch (error) {
            return null;
        }
    }
    // ============================================
    // EXIT CONDITION CHECKING
    // ============================================
    async checkExitConditions(mint, position) {
        if (position.tracking_status !== 'active')
            return;
        const config = this.config.exit_simulation;
        const gain = position.current_gain_percent;
        const holdTime = position.hold_duration_seconds;
        // Check stop loss
        if (gain <= config.stop_loss_percent) {
            await this.executeExit(mint, position, 100, 'stop_loss', `Stop loss hit: ${gain.toFixed(1)}%`);
            return;
        }
        // Check trailing stop (if in profit)
        if (position.high_gain_percent > 0) {
            const dropFromHigh = position.high_gain_percent - gain;
            if (dropFromHigh >= config.trailing_stop_percent) {
                await this.executeExit(mint, position, 100, 'trailing_stop', `Trailing stop: Dropped ${dropFromHigh.toFixed(1)}% from high`);
                return;
            }
        }
        // Check max hold time
        if (holdTime >= config.max_hold_time) {
            await this.executeExit(mint, position, 100, 'time_limit', `Max hold time reached: ${holdTime}s`);
            return;
        }
        // Check quick profit
        if (config.quick_profit.enabled && holdTime < config.quick_profit.time_limit) {
            if (gain >= config.quick_profit.min_gain) {
                await this.executeExit(mint, position, 100, 'quick_profit', `Quick profit: ${gain.toFixed(1)}% in ${holdTime}s`);
                return;
            }
        }
        // Check tiered exits
        await this.checkTieredExits(mint, position, gain);
    }
    async checkTieredExits(mint, position, gain) {
        const config = this.config.exit_simulation;
        // Tier 1: 2x (100% gain) - sell 25%
        if (gain >= config.tier_1.trigger_gain && position.remaining_position > 0.75 &&
            (!position.last_tier_exited || position.last_tier_exited < 1)) {
            await this.executeExit(mint, position, 25, 'tier_1', `Tier 1: Taking 25% at ${gain.toFixed(0)}% gain (2x)`);
            position.remaining_position = 0.75;
            position.last_tier_exited = 1;
            return;
        }
        // Tier 2: 4x (300% gain) - sell 25%
        if (gain >= config.tier_2.trigger_gain && position.remaining_position > 0.50 &&
            (!position.last_tier_exited || position.last_tier_exited < 2)) {
            await this.executeExit(mint, position, 25, 'tier_2', `Tier 2: Taking 25% at ${gain.toFixed(0)}% gain (4x)`);
            position.remaining_position = 0.50;
            position.last_tier_exited = 2;
            return;
        }
        // Tier 3: 6x (500% gain) - sell 25%
        if (gain >= config.tier_3.trigger_gain && position.remaining_position > 0.25 &&
            (!position.last_tier_exited || position.last_tier_exited < 3)) {
            await this.executeExit(mint, position, 25, 'tier_3', `Tier 3: Taking 25% at ${gain.toFixed(0)}% gain (6x)`);
            position.remaining_position = 0.25;
            position.last_tier_exited = 3;
            return;
        }
    }
    // ============================================
    // EXIT EXECUTION
    // ============================================
    async executeExit(mint, position, exitPercent, signalType, reason) {
        console.log(`🚪 EXIT SIGNAL: ${reason}`);
        const dateOnly = new Date().toISOString().split('T')[0];
        // Record exit analysis
        this.queueWrite('exit_analysis', {
            mint: mint,
            analysis_timestamp: new Date().toISOString(),
            date_only: dateOnly,
            signal_type: signalType,
            signal_reason: reason,
            confidence_level: 'high',
            current_price: position.current_price,
            entry_price: position.simulated_buy_price,
            current_gain_percent: position.current_gain_percent,
            hold_time_seconds: position.hold_duration_seconds,
            should_exit: true,
            exit_percent: exitPercent / 100,
            remaining_position: position.remaining_position,
            tier_number: position.last_tier_exited || null,
            is_moonbag: position.remaining_position === 0.25
        });
        // If full exit (100% or final position)
        if (exitPercent === 100 || position.remaining_position <= 0.25) {
            position.tracking_status = 'exited';
            position.exit_signal_type = signalType;
            position.exit_price = position.current_price;
            position.exit_time = Date.now();
            position.theoretical_pnl_percent = position.current_gain_percent;
            // Calculate P&L in SOL
            if (position.simulated_buy_price > 0) {
                const tokensOwned = position.simulated_token_amount * position.remaining_position;
                const exitValue = tokensOwned * position.current_price;
                const entryValue = position.simulated_position_size * position.remaining_position;
                position.theoretical_pnl_sol = exitValue - entryValue;
            }
            // Update database - use transaction queue to prevent conflicts
            // PHASE 1 FIX: Queue this update to avoid interfering with batch writes
            this.transactionQueue = this.transactionQueue.then(async () => {
                if (!this.db)
                    return;
                try {
                    await this.db.run(`UPDATE tokens_tracked SET
              tracking_status = ?,
              tracking_ended = ?,
              exit_signal_type = ?,
              exit_price = ?,
              exit_time = ?,
              theoretical_pnl_percent = ?,
              theoretical_pnl_sol = ?,
              hold_duration_seconds = ?
            WHERE mint = ?`, [
                        'exited',
                        new Date().toISOString(),
                        signalType,
                        position.exit_price,
                        new Date(position.exit_time).toISOString(),
                        position.theoretical_pnl_percent,
                        position.theoretical_pnl_sol,
                        position.hold_duration_seconds,
                        mint
                    ]);
                }
                catch (error) {
                    console.error('❌ [SQLite] Error updating exit status:', error);
                }
            }).catch(error => {
                console.error('❌ [SQLite] Transaction queue error in executeExit:', error);
            });
            // Start post-exit monitoring
            if (this.config.recording.record_post_exit) {
                await this.startPostExitMonitoring(mint, position);
            }
            else {
                // Stop price monitoring immediately
                this.stopPriceMonitoring(mint);
            }
            this.stats.positions_exited++;
            this.emit('position_exited', { mint, reason, gain: position.current_gain_percent });
        }
    }
    // ============================================
    // POST-EXIT MONITORING
    // ============================================
    async startPostExitMonitoring(mint, position) {
        console.log(`📊 Continuing post-exit monitoring for ${this.config.recording.post_exit_duration}s...`);
        position.post_exit_monitoring = true;
        const exitPrice = position.current_price;
        // Continue monitoring for configured duration
        setTimeout(() => {
            this.stopPriceMonitoring(mint);
            // Calculate missed opportunity
            if (position.post_exit_high_price && exitPrice > 0) {
                position.missed_opportunity_percent =
                    ((position.post_exit_high_price - exitPrice) / exitPrice) * 100;
                // Mark as rally if >10% gain after exit
                position.post_exit_rally = position.missed_opportunity_percent >= 10;
                // Update database - use transaction queue to prevent conflicts
                // PHASE 1 FIX: Queue this update to avoid interfering with batch writes
                this.transactionQueue = this.transactionQueue.then(async () => {
                    if (!this.db)
                        return;
                    try {
                        await this.db.run(`UPDATE tokens_tracked SET
                post_exit_high_price = ?,
                post_exit_high_time = ?,
                missed_opportunity_percent = ?,
                post_exit_rally = ?
              WHERE mint = ?`, [
                            position.post_exit_high_price,
                            position.post_exit_high_time ? new Date(position.post_exit_high_time).toISOString() : null,
                            position.missed_opportunity_percent,
                            position.post_exit_rally ? 1 : 0,
                            mint
                        ]);
                    }
                    catch (error) {
                        console.error('❌ [SQLite] Error updating post-exit data:', error);
                    }
                }).catch(error => {
                    console.error('❌ [SQLite] Transaction queue error in post-exit update:', error);
                });
                if (position.post_exit_rally) {
                    console.log(`🚀 POST-EXIT RALLY DETECTED: +${position.missed_opportunity_percent.toFixed(1)}% after exit!`);
                }
            }
            this.trackedPositions.delete(mint);
        }, this.config.recording.post_exit_duration * 1000);
        // Track post-exit highs
        const postExitCheck = setInterval(() => {
            if (position.current_price > (position.post_exit_high_price || 0)) {
                position.post_exit_high_price = position.current_price;
                position.post_exit_high_time = Date.now();
            }
        }, 1000);
        // Clear interval after duration
        setTimeout(() => clearInterval(postExitCheck), this.config.recording.post_exit_duration * 1000);
    }
    stopPriceMonitoring(mint) {
        const interval = this.priceUpdateIntervals.get(mint);
        if (interval) {
            clearInterval(interval);
            this.priceUpdateIntervals.delete(mint);
        }
    }
    // ============================================
    // BATCH WRITING SYSTEM
    // ============================================
    queueWrite(table, data) {
        this.writeQueue.push({ table, data });
        // If queue is getting large, flush immediately
        if (this.writeQueue.length >= this.config.recording.batch_insert_size) {
            this.flushWriteQueue();
        }
    }
    startBatchFlush() {
        this.flushInterval = setInterval(() => {
            this.flushWriteQueue();
        }, this.config.recording.flush_interval * 1000);
    }
    async flushWriteQueue() {
        if (this.writeQueue.length === 0 || !this.db)
            return;
        // PHASE 1 FIX: Queue all transaction operations to prevent nested transactions
        // Chain this flush operation after any pending transactions
        this.transactionQueue = this.transactionQueue.then(async () => {
            // Double-check queue still has items (might have been flushed by another call)
            if (this.writeQueue.length === 0 || !this.db)
                return;
            // Check if transaction is already in progress
            if (this.isTransactionInProgress) {
                console.log('⏳ [SQLite] Transaction already in progress, will retry on next flush');
                return;
            }
            const writes = [...this.writeQueue];
            this.writeQueue = [];
            try {
                this.isTransactionInProgress = true;
                await this.db.run('BEGIN TRANSACTION');
                for (const write of writes) {
                    await this.insertRecord(write.table, write.data);
                }
                await this.db.run('COMMIT');
                this.stats.database_writes += writes.length;
            }
            catch (error) {
                console.error('❌ [SQLite] Error flushing write queue:', error);
                try {
                    await this.db.run('ROLLBACK');
                }
                catch (rollbackError) {
                    console.error('❌ [SQLite] Error during rollback:', rollbackError);
                }
            }
            finally {
                this.isTransactionInProgress = false;
            }
        }).catch(error => {
            console.error('❌ [SQLite] Transaction queue error:', error);
            this.isTransactionInProgress = false;
        });
        // Return the queued promise so callers can await if needed
        return this.transactionQueue;
    }
    async insertRecord(table, data) {
        if (!this.db)
            return;
        const columns = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data);
        const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
        await this.db.run(sql, values);
    }
    // ============================================
    // PUBLIC METHODS & STATS
    // ============================================
    getStats() {
        return {
            ...this.stats,
            active_positions: this.trackedPositions.size,
            write_queue_size: this.writeQueue.length
        };
    }
    getActivePositions() {
        return Array.from(this.trackedPositions.values());
    }
    isRecording() {
        return this.isRunning;
    }
}
exports.MarketRecorder = MarketRecorder;
