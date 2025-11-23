"use strict";
// ============================================
// MARKET INTELLIGENCE SYSTEM CONFIGURATION
// Controls recording, analysis, and backtesting
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MI_CONFIG = void 0;
exports.getMarketIntelligenceConfig = getMarketIntelligenceConfig;
exports.getCurrentDatabasePath = getCurrentDatabasePath;
exports.shouldRecordToken = shouldRecordToken;
exports.getExitCheckIntervals = getExitCheckIntervals;
// ============================================
// DEFAULT CONFIGURATION
// ============================================
exports.DEFAULT_MI_CONFIG = {
    recording: {
        enabled: true,
        detection_source: 'websocket', // Start with WebSocket, add gRPC later
        record_all_tokens: true, // Record everything, even rejects
        record_1s_charts: true, // Full 1-second detail
        record_post_exit: true, // Continue 2-3 min after exit
        post_exit_duration: 180, // 3 minutes post-exit
        database_path: './data/market-intelligence',
        daily_rotation: true, // New DB each day
        compress_old_data: true,
        compression_threshold_days: 30,
        max_concurrent_tokens: 50, // Track up to 50 tokens simultaneously
        batch_insert_size: 100, // Batch 100 inserts
        flush_interval: 5, // Flush every 5 seconds
    },
    scoring: {
        enabled: true,
        min_score_to_track: 60, // Only track tokens scoring 60+
        // From sol-bot working filters
        block_keywords: [
            'pump', 'inu', 'moon', 'safe', 'elon', 'doge', 'shib',
            'baby', 'mini', 'rocket', '100x', '1000x', 'gem'
        ],
        require_no_mint_authority: true,
        require_no_freeze_authority: true,
        min_liquidity: 10000, // 10k SOL minimum
        min_holder_count: 20,
        max_holder_concentration: 0.50, // Top holder can't own >50%
    },
    exit_simulation: {
        enabled: true,
        // Tiered exits from sol-bot
        tier_1: { trigger_gain: 100, sell_percent: 0.25 }, // 2x, sell 25%
        tier_2: { trigger_gain: 300, sell_percent: 0.25 }, // 4x, sell 25%
        tier_3: { trigger_gain: 500, sell_percent: 0.25 }, // 6x, sell 25%
        moonbag_percent: 0.25, // Keep final 25%
        // Quick profit from sol-bot
        quick_profit: {
            enabled: true,
            time_limit: 300, // 5 minutes
            min_gain: 10, // 10% minimum
            momentum_threshold: 30, // 30% in 60s
        },
        stop_loss_percent: -25, // -25% stop loss
        trailing_stop_percent: 30, // 30% trailing stop
        max_hold_time: 2700, // 45 minutes max hold
        check_interval: 5, // Check every 5 seconds
    },
    analysis: {
        enabled: true,
        hourly_breakdown: true,
        daily_breakdown: true,
        weekly_patterns: true,
        detect_pump_dump: true,
        detect_organic_growth: true,
        detect_whale_manipulation: true,
        build_training_dataset: true,
        min_samples_per_pattern: 50,
    },
    backtesting: {
        enabled: true,
        default_position_size: 0.089, // Match bot's position size
        include_fees: true,
        slippage_percent: 1.0, // 1% slippage
        min_trades_for_validation: 100,
        confidence_interval: 0.95,
    },
    reporting: {
        enabled: true,
        daily_summary: true,
        weekly_analysis: true,
        monthly_deep_dive: false, // Too detailed for now
        console_output: true,
        file_output: true,
        output_directory: './data/market-intelligence/reports',
        alert_on_best_hours: true,
        alert_on_worst_hours: true,
        alert_on_moonshot: true,
    },
    integration: {
        listen_to_websocket: true, // Monitor same feed as main bot
        listen_to_grpc: false, // Add later when gRPC integrated
        separate_process: false, // Run in same process for now
        emit_token_detected: true,
        emit_would_buy: true,
        emit_exit_signal: true,
    },
};
// ============================================
// ENVIRONMENT-BASED CONFIG OVERRIDE
// ============================================
function getMarketIntelligenceConfig(sessionConfig) {
    const config = { ...exports.DEFAULT_MI_CONFIG };
    // If session config provided, customize for bot session tracking
    if (sessionConfig) {
        // Use session-specific database path
        const sessionDb = `${sessionConfig.session_type}-session-${sessionConfig.session_id}.db`;
        config.recording.database_path = sessionConfig.database_path_override || './data/bot-sessions';
        // Store session metadata in config for later retrieval
        config.session_metadata = {
            session_id: sessionConfig.session_id,
            session_type: sessionConfig.session_type,
            session_start: sessionConfig.session_start,
            bot_version: sessionConfig.bot_version,
            ...sessionConfig.session_metadata,
        };
        // Bot session optimizations
        config.recording.max_concurrent_tokens = 50; // Lower for bot sessions
        config.recording.batch_insert_size = 100;
        config.recording.record_post_exit = true; // Track post-exit behavior
        // Higher quality threshold for bot sessions
        config.scoring.min_score_to_track = 60; // Only track would-buy tokens
    }
    // Override from environment variables if present
    if (process.env.MI_RECORDING_ENABLED) {
        config.recording.enabled = process.env.MI_RECORDING_ENABLED === 'true';
    }
    if (process.env.MI_DETECTION_SOURCE) {
        config.recording.detection_source = process.env.MI_DETECTION_SOURCE;
    }
    if (process.env.MI_MIN_SCORE) {
        config.scoring.min_score_to_track = parseFloat(process.env.MI_MIN_SCORE);
    }
    if (process.env.MI_POSITION_SIZE) {
        config.backtesting.default_position_size = parseFloat(process.env.MI_POSITION_SIZE);
    }
    return config;
}
// ============================================
// HELPER FUNCTIONS
// ============================================
function getCurrentDatabasePath(sessionType) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    if (sessionType === 'baseline') {
        // Baseline recorder: daily rotation (baseline-2025-11-04.db)
        return `./data/market-baseline/baseline-${today}.db`;
    }
    else if (sessionType === 'bot') {
        // Bot session tracker: uses session-specific naming (handled in getMarketIntelligenceConfig)
        return `./data/bot-sessions/mi-${today}.db`;
    }
    else {
        // Default: daily rotation
        return `${exports.DEFAULT_MI_CONFIG.recording.database_path}/mi-${today}.db`;
    }
}
function shouldRecordToken(score, config) {
    if (!config.recording.enabled)
        return false;
    // DEBUG: Log what we're checking
    console.log(`[shouldRecordToken] record_all_tokens: ${config.recording.record_all_tokens}, score: ${score}, min_score: ${config.scoring.min_score_to_track}`);
    // CRITICAL FIX: Check record_all_tokens flag FIRST (for baseline recorder)
    if (config.recording.record_all_tokens) {
        console.log(`[shouldRecordToken] ✅ RECORDING TOKEN (record_all_tokens=true)`);
        return true; // Baseline mode: record EVERYTHING
    }
    // Original logic for bot sessions (filtered recording)
    if (!config.scoring.enabled)
        return true; // Record all if scoring disabled
    const shouldRecord = score >= config.scoring.min_score_to_track;
    console.log(`[shouldRecordToken] ${shouldRecord ? '✅' : '❌'} score ${score} >= min ${config.scoring.min_score_to_track}`);
    return shouldRecord;
}
function getExitCheckIntervals() {
    // Sol-bot's 9 monitoring intervals (in seconds)
    return [30, 60, 120, 180, 300, 600, 900, 1800, 2700];
}
