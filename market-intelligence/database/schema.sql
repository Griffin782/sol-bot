-- ============================================
-- MARKET INTELLIGENCE DATABASE SCHEMA
-- Tracks 1-second chart data for all detected tokens
-- ============================================

-- ============================================
-- TABLE 1: ALL TOKENS DETECTED (Every Token Seen)
-- ============================================
CREATE TABLE IF NOT EXISTS tokens_scored (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  date_only DATE NOT NULL,  -- For daily partitioning

  -- Token Identity
  mint TEXT NOT NULL,
  name TEXT,
  symbol TEXT,
  creator TEXT,

  -- Detection Source
  detection_method TEXT NOT NULL,  -- 'websocket' or 'grpc'
  detection_program TEXT,  -- Raydium, Pump.fun, etc.

  -- Market Data at Detection
  initial_price REAL,
  initial_liquidity REAL,
  initial_volume_24h REAL,
  initial_holder_count INTEGER,
  initial_market_cap REAL,

  -- Scoring Results
  score REAL NOT NULL,
  would_buy BOOLEAN NOT NULL,
  would_buy_reason TEXT,
  blocked_reason TEXT,  -- If score failed, why?

  -- Safety Checks
  has_mint_authority BOOLEAN,
  has_freeze_authority BOOLEAN,
  rugcheck_score REAL
);

-- Indexes for tokens_scored
CREATE INDEX IF NOT EXISTS idx_tokens_scored_date ON tokens_scored(date_only);
CREATE INDEX IF NOT EXISTS idx_tokens_scored_mint ON tokens_scored(mint);
CREATE INDEX IF NOT EXISTS idx_tokens_scored_would_buy ON tokens_scored(would_buy);
CREATE INDEX IF NOT EXISTS idx_tokens_scored_score ON tokens_scored(score);

-- ============================================
-- TABLE 2: TOKENS TRACKED (Would-Buy Decisions)
-- ============================================
CREATE TABLE IF NOT EXISTS tokens_tracked (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mint TEXT NOT NULL UNIQUE,
  date_only DATE NOT NULL,

  -- Entry Decision
  detected_at DATETIME NOT NULL,
  entry_score REAL NOT NULL,
  simulated_buy_price REAL NOT NULL,
  simulated_position_size REAL NOT NULL,  -- SOL amount
  simulated_token_amount REAL,

  -- Tracking Status
  tracking_status TEXT DEFAULT 'active',  -- 'active', 'exited', 'timed_out'
  tracking_started DATETIME DEFAULT CURRENT_TIMESTAMP,
  tracking_ended DATETIME,

  -- Exit Tracking
  exit_signal_type TEXT,  -- 'take_profit', 'stop_loss', 'time_limit', 'manual'
  exit_price REAL,
  exit_time DATETIME,
  theoretical_pnl_percent REAL,
  theoretical_pnl_sol REAL,
  hold_duration_seconds INTEGER,

  -- Post-Exit Monitoring (2-3 min continuation)
  post_exit_monitoring BOOLEAN DEFAULT TRUE,
  post_exit_high_price REAL,
  post_exit_high_time DATETIME,
  missed_opportunity_percent REAL,  -- How much more we could have made
  post_exit_rally BOOLEAN DEFAULT FALSE  -- Did it pump >10% after exit?
);

-- Indexes for tokens_tracked
CREATE INDEX IF NOT EXISTS idx_tokens_tracked_date ON tokens_tracked(date_only);
CREATE INDEX IF NOT EXISTS idx_tokens_tracked_mint ON tokens_tracked(mint);
CREATE INDEX IF NOT EXISTS idx_tokens_tracked_status ON tokens_tracked(tracking_status);
CREATE INDEX IF NOT EXISTS idx_tokens_tracked_detected ON tokens_tracked(detected_at);

-- ============================================
-- TABLE 3: 1-SECOND PRICE HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS price_history_1s (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mint TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  date_only DATE NOT NULL,

  -- Price Data
  price REAL NOT NULL,
  price_change_1s REAL,  -- % change from 1s ago

  -- Volume Data
  volume_1s REAL,  -- Volume in last 1 second
  volume_cumulative REAL,  -- Total volume since tracking started

  -- Liquidity Data
  liquidity REAL,
  liquidity_change_1s REAL,

  -- Market Metrics
  holder_count INTEGER,
  market_cap REAL,

  -- Whale Activity Detection
  large_tx_detected BOOLEAN DEFAULT FALSE,
  large_tx_size_sol REAL,

  -- Performance Tracking
  gain_from_entry REAL,  -- % gain since simulated buy
  high_since_entry REAL  -- Highest gain achieved
);

-- Indexes for price_history_1s
CREATE INDEX IF NOT EXISTS idx_price_history_mint ON price_history_1s(mint);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history_1s(date_only);
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history_1s(timestamp);

-- ============================================
-- TABLE 4: EXIT DECISIONS & ANALYSIS
-- ============================================
CREATE TABLE IF NOT EXISTS exit_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mint TEXT NOT NULL,
  analysis_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  date_only DATE NOT NULL,

  -- Exit Signal Details
  signal_type TEXT NOT NULL,  -- 'tier_1', 'tier_2', 'tier_3', 'stop_loss', 'time_limit', 'quick_profit'
  signal_reason TEXT,
  confidence_level TEXT,  -- 'high', 'medium', 'low'

  -- Position Status
  current_price REAL,
  entry_price REAL,
  current_gain_percent REAL,
  hold_time_seconds INTEGER,

  -- Exit Decision
  should_exit BOOLEAN,
  exit_percent REAL,  -- 0.25, 0.50, 0.75, 1.0
  remaining_position REAL,

  -- Tiered Exit Tracking
  tier_number INTEGER,  -- 1, 2, 3, or NULL
  is_moonbag BOOLEAN DEFAULT FALSE,

  -- Market Conditions at Exit
  volume_at_exit REAL,
  liquidity_at_exit REAL,
  whale_activity BOOLEAN,

  -- Post-Exit Validation (filled in later)
  actual_missed_opportunity REAL,  -- What happened in next 2-3 min
  exit_was_optimal BOOLEAN  -- Did we exit at good time?
);

-- Indexes for exit_analysis
CREATE INDEX IF NOT EXISTS idx_exit_analysis_mint ON exit_analysis(mint);
CREATE INDEX IF NOT EXISTS idx_exit_analysis_date ON exit_analysis(date_only);
CREATE INDEX IF NOT EXISTS idx_exit_analysis_signal ON exit_analysis(signal_type);

-- ============================================
-- TABLE 5: DAILY SESSION STATS
-- ============================================
CREATE TABLE IF NOT EXISTS daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_only DATE NOT NULL UNIQUE,
  hour_of_day INTEGER,  -- 0-23 for hourly breakdown

  -- Token Detection Stats
  tokens_detected INTEGER DEFAULT 0,
  tokens_scored INTEGER DEFAULT 0,
  tokens_would_buy INTEGER DEFAULT 0,
  tokens_blocked INTEGER DEFAULT 0,

  -- Scoring Distribution
  avg_score REAL,
  median_score REAL,
  high_quality_tokens INTEGER DEFAULT 0,  -- score > 80

  -- Simulated Trading Performance
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  win_rate_percent REAL,

  -- P&L Metrics
  total_pnl_percent REAL,
  avg_gain_percent REAL,
  avg_loss_percent REAL,
  biggest_win_percent REAL,
  biggest_loss_percent REAL,

  -- Timing Metrics
  avg_hold_time_seconds INTEGER,
  quick_exits INTEGER DEFAULT 0,  -- Exits < 5 min
  tier_exits INTEGER DEFAULT 0,  -- Tiered exits (2x, 4x, 6x)
  stop_losses INTEGER DEFAULT 0,

  -- Post-Exit Analysis
  missed_opportunities INTEGER DEFAULT 0,  -- Rallied >10% after exit
  avg_missed_percent REAL,
  optimal_exits INTEGER DEFAULT 0  -- Exited at or near peak
);

-- Indexes for daily_stats
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date_only);
CREATE INDEX IF NOT EXISTS idx_daily_stats_hour ON daily_stats(hour_of_day);

-- ============================================
-- TABLE 6: PATTERN LIBRARY (ML Training Data)
-- ============================================
CREATE TABLE IF NOT EXISTS pattern_library (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mint TEXT NOT NULL,
  pattern_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Pattern Classification
  pattern_type TEXT NOT NULL,  -- 'pump_dump', 'steady_growth', 'whale_manipulation', 'organic_rally'
  pattern_confidence REAL,

  -- Pattern Metrics
  peak_gain_percent REAL,
  time_to_peak_seconds INTEGER,
  volume_pattern TEXT,  -- JSON: volume over time
  price_pattern TEXT,  -- JSON: price over time

  -- Outcome
  final_result TEXT,  -- 'profitable', 'breakeven', 'loss'
  final_pnl_percent REAL,

  -- Features for ML
  initial_momentum REAL,
  volume_acceleration REAL,
  liquidity_stability REAL,
  holder_growth_rate REAL,
  whale_activity_score REAL,

  -- Learning
  predicted_outcome TEXT,  -- What our model predicted
  actual_outcome TEXT,  -- What actually happened
  prediction_accuracy REAL
);

-- Indexes for pattern_library
CREATE INDEX IF NOT EXISTS idx_pattern_library_type ON pattern_library(pattern_type);
CREATE INDEX IF NOT EXISTS idx_pattern_library_result ON pattern_library(final_result);

-- ============================================
-- TABLE 7: CONFIGURATION SNAPSHOTS
-- ============================================
CREATE TABLE IF NOT EXISTS config_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  config_type TEXT NOT NULL,  -- 'scoring', 'exit', 'recording'
  config_json TEXT NOT NULL,  -- Full config as JSON
  active BOOLEAN DEFAULT TRUE
);

-- Indexes for config_snapshots
CREATE INDEX IF NOT EXISTS idx_config_snapshots_timestamp ON config_snapshots(snapshot_timestamp);
CREATE INDEX IF NOT EXISTS idx_config_snapshots_active ON config_snapshots(active);

-- ============================================
-- VIEWS FOR QUICK ANALYSIS
-- ============================================

-- View: Today's Performance
CREATE VIEW IF NOT EXISTS todays_performance AS
SELECT
  date_only,
  tokens_detected,
  tokens_would_buy,
  win_rate_percent,
  total_pnl_percent,
  avg_gain_percent,
  missed_opportunities
FROM daily_stats
WHERE date_only = DATE('now')
ORDER BY hour_of_day;

-- View: Best Trading Hours (Last 7 Days)
CREATE VIEW IF NOT EXISTS best_hours AS
SELECT
  hour_of_day,
  AVG(win_rate_percent) as avg_win_rate,
  AVG(total_pnl_percent) as avg_pnl,
  COUNT(*) as days_tracked,
  SUM(tokens_would_buy) as total_trades
FROM daily_stats
WHERE date_only >= DATE('now', '-7 days')
GROUP BY hour_of_day
HAVING total_trades > 10
ORDER BY avg_win_rate DESC;

-- View: Worst Trading Hours (Last 7 Days)
CREATE VIEW IF NOT EXISTS worst_hours AS
SELECT
  hour_of_day,
  AVG(win_rate_percent) as avg_win_rate,
  AVG(total_pnl_percent) as avg_pnl,
  COUNT(*) as days_tracked,
  SUM(tokens_would_buy) as total_trades
FROM daily_stats
WHERE date_only >= DATE('now', '-7 days')
GROUP BY hour_of_day
HAVING total_trades > 10
ORDER BY avg_win_rate ASC
LIMIT 5;

-- View: High Value Opportunities (5x+ Potential)
CREATE VIEW IF NOT EXISTS moonshot_opportunities AS
SELECT
  t.mint,
  t.detected_at,
  t.entry_score,
  t.theoretical_pnl_percent,
  t.hold_duration_seconds,
  t.exit_signal_type,
  t.post_exit_rally,
  t.missed_opportunity_percent
FROM tokens_tracked t
WHERE t.theoretical_pnl_percent >= 400  -- 5x = 400% gain
ORDER BY t.theoretical_pnl_percent DESC;

-- ============================================
-- MAINTENANCE QUERIES
-- ============================================

-- Clean old detailed price history (keep 30 days)
-- Run daily to manage database size
-- DELETE FROM price_history_1s WHERE date_only < DATE('now', '-30 days');

-- Compress old data into daily summaries
-- Keep detailed scoring and tracking forever, but archive 1s price data
