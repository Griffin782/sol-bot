# DUAL MARKET INTELLIGENCE RECORDER SYSTEM

**Version**: 1.0
**Date**: October 27, 2025
**Bot Version**: SOL-BOT v5.0

---

## 📋 TABLE OF CONTENTS

1. [Architecture Overview](#architecture-overview)
2. [Two Recorder System](#two-recorder-system)
3. [Quick Start Guide](#quick-start-guide)
4. [Recorder 1: Standalone Market Observer](#recorder-1-standalone-market-observer)
5. [Recorder 2: Bot Session Tracker](#recorder-2-bot-session-tracker)
6. [Comparison & Analysis](#comparison--analysis)
7. [Database Locations](#database-locations)
8. [Workflow Examples](#workflow-examples)
9. [Troubleshooting](#troubleshooting)

---

## 🏗️ ARCHITECTURE OVERVIEW

The Dual Recorder System consists of **two independent recorders** that work together to provide complete market intelligence:

```
┌─────────────────────────────────────────────────────────────┐
│                    SOLANA BLOCKCHAIN                         │
│                    (WebSocket Feed)                          │
└────────────┬────────────────────────────────┬────────────────┘
             │                                │
             ├────────────────────┐           │
             │                    │           │
    ┌────────▼────────┐  ┌────────▼────────┐ │
    │   RECORDER 1    │  │   RECORDER 2    │ │
    │   Standalone    │  │  Bot Session    │ │
    │  Market Observer│  │    Tracker      │ │
    └────────┬────────┘  └────────┬────────┘ │
             │                    │           │
             │                    │           │
    ┌────────▼────────┐  ┌────────▼────────┐ │
    │   baseline-     │  │  live-session-  │ │
    │  YYYY-MM-DD.db  │  │  [timestamp].db │ │
    └─────────────────┘  └─────────────────┘ │
             │                    │           │
             └────────┬───────────┘           │
                      │                       │
              ┌───────▼───────┐               │
              │  COMPARISON   │               │
              │     TOOL      │◄──────────────┘
              └───────────────┘
                      │
              ┌───────▼───────┐
              │   INSIGHTS &  │
              │    REPORTS    │
              └───────────────┘
```

---

## 🎯 TWO RECORDER SYSTEM

### Why Two Recorders?

| Aspect | Standalone Observer | Bot Session Tracker |
|--------|-------------------|---------------------|
| **Purpose** | Baseline market data | Bot's actual performance |
| **Records** | ALL tokens (unfiltered) | Only tokens bot detects |
| **Runtime** | 24/7 continuously | Only when bot trades |
| **Filters** | None (min_score: 0) | Bot's quality filters |
| **Storage** | `data/market-baseline/` | `data/bot-sessions/` |
| **Database** | Daily (baseline-YYYY-MM-DD.db) | Per session (type-session-ID.db) |

### Key Benefits

✅ **Compare bot decisions to market reality**
✅ **Identify missed opportunities**
✅ **Validate scoring system effectiveness**
✅ **Track true positives vs false positives**
✅ **Optimize bot configuration over time**

---

## 🚀 QUICK START GUIDE

### 1. Start Standalone Market Observer (Terminal 1)

```bash
# Run 24/7 to collect baseline market data

```

You'll see:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 STANDALONE MARKET OBSERVER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 This recorder runs INDEPENDENTLY of your trading bot
🎯 Records ALL market activity for baseline data
💾 Storage: data/market-baseline/
⏰ Runtime: 24/7 until stopped
```

### 2. Start Bot with Session Tracking (Terminal 2)

```bash
# Run your trading bot (Market Intelligence auto-enabled)
npm run dev
```

You'll see:
```
✅ Market Intelligence session tracker started (live mode)
   Session ID: 1761598498518
   Database: data/bot-sessions/live-session-1761598498518.db
```

### 3. Compare Results

```bash
# After bot session completes, compare to baseline
npm run mi-compare ./data/bot-sessions/live-session-1761598498518.db 2025-10-27
```

---

## 📊 RECORDER 1: STANDALONE MARKET OBSERVER

### Purpose

Records **ALL market activity** to establish a baseline of what's happening in the market, regardless of bot decisions.

### Configuration

- **Min Score**: 0 (records everything)
- **Max Concurrent**: 200 tokens
- **Batch Size**: 200 (high throughput)
- **Post-Exit**: Disabled (saves space)
- **Database**: `data/market-baseline/baseline-YYYY-MM-DD.db`

### Starting the Recorder

```bash
# Method 1: NPM script
(npm run mi-baseline)

# Method 2: Direct execution
npx ts-node market-intelligence/standalone-recorder.ts
```

### What It Records

✅ Every token detected on WebSocket
✅ Token mint addresses and metadata
✅ Detection program (Pump.fun, Raydium, etc.)
✅ Timestamp and detection method
✅ Simulated neutral score (50)
✅ All tracked as "would_buy: true" for baseline

### Stopping the Recorder

Press `Ctrl+C` for graceful shutdown. You'll see:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛑 SHUTTING DOWN STANDALONE RECORDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 FINAL STATISTICS:
   Tokens Detected: 1,247
   Tokens Tracked: 1,247
   Database Writes: 12,450
```

### Stats Output (Every 60 seconds)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 STATS [14:32:15]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📨 Messages: 18,432 (307.2/s)
🔍 Tokens Detected: 247 (4.1/min)
💾 Database Tokens: 247
📊 Tokens Tracked: 247
⚡ Active Positions: 89
📝 Database Writes: 2,470
📋 Write Queue: 12
```

---

## 🤖 RECORDER 2: BOT SESSION TRACKER

### Purpose

Records **only what the bot detects and decides**, creating a session-specific record of bot behavior.

### Configuration

- **Min Score**: 60 (only would-buy tokens)
- **Max Concurrent**: 50 tokens
- **Batch Size**: 100
- **Post-Exit**: Enabled (tracks aftermath)
- **Database**: `data/bot-sessions/{type}-session-{id}.db`

### How It Works

The bot session tracker is **automatically enabled** when you run the bot. It:

1. Creates a unique session ID (timestamp)
2. Detects trading mode (test/live from IS_TEST_MODE)
3. Records session metadata (balance, targets, runtime)
4. Tracks only tokens the bot sees and scores
5. Creates session-specific database

### Database Naming

```
test-session-1761598498518.db    # Test mode session
live-session-1761612345678.db    # Live trading session
```

### Session Metadata Recorded

- Session ID (unique timestamp)
- Session type (test/live)
- Initial balance
- Target pool
- Max runtime
- Bot version

### Disabling Session Tracker

```bash
# Add to .env file
MI_ENABLED=false

# Then run bot
npm run dev
```

---

## 📈 COMPARISON & ANALYSIS

### Comparison Tool

Analyzes the gap between market reality (baseline) and bot decisions (session).

#### Usage

```bash
npm run mi-compare <session-db-path> [baseline-date]
```

#### Examples

```bash
# Compare latest session to today's baseline
npm run mi-compare ./data/bot-sessions/live-session-1761598498518.db

# Compare to specific baseline date
npm run mi-compare ./data/bot-sessions/test-session-1761598498518.db 2025-10-27

# Show help
npm run mi-compare --help
```

#### What It Shows

The comparison tool provides **7 comprehensive analyses**:

##### 1. Market Coverage Analysis
```
Total tokens in market:     1,247
Tokens bot detected:        489
Coverage:                   39.2%
```

##### 2. Bot Decision Breakdown
```
Would-buy decisions:        127
Blocked/rejected:           362
Actually tracked:           89
```

##### 3. Missed Opportunities
```
TOP 20 MISSED PUMPS:

 1. 7xKXtg2C... → +2847% (45m) [tier_3]
 2. 9kPQm5w8... → +1632% (32m) [tier_2]
 3. 4mYzN7pB... → +1184% (28m) [tier_1]
...

Missed 2x+ opportunities:   89
Missed 5x+ opportunities:   24
Missed 10x+ opportunities:  8
```

##### 4. Correct Blocks (Saved from Losses)
```
TOP 20 CORRECT BLOCKS:

 1. 8pKXm3nQ... → -89% [Blocked: low liquidity]
 2. 5wNzT2mP... → -76% [Blocked: scam keyword]
 3. 3xQyR9kM... → -68% [Blocked: mint authority]
...

Total blocks that saved losses: 142
Average loss avoided:           -42.3%
```

##### 5. False Positives (Bot Bought But Dumped)
```
TOP 20 FALSE POSITIVES:

 1. 6kTmP8nQ... → -45% (Score: 72)
 2. 4pNzX2mP... → -38% (Score: 68)
 3. 9xWyQ7kM... → -31% (Score: 65)
...

False positives:          47
Average loss:             -28.4%
```

##### 6. True Positives (Bot Bought AND Pumped)
```
TOP 20 TRUE POSITIVES:

 1. 5mKpT3nQ... → +847% (Score: 89) [tier_3]
 2. 7kPqX9mP... → +632% (Score: 82) [tier_2]
 3. 2xNyM5kM... → +484% (Score: 78) [tier_1]
...

True positives:           82
Average gain:             +184.7%
2x+ wins:                 38
5x+ wins:                 12
```

##### 7. Overall Accuracy Metrics
```
Total bot decisions:      489
Accurate decisions:       224
Accuracy rate:            45.8%

Precision (% buy signals that won):   64.6%
Recall (% market wins captured):      47.9%
```

### Daily Analysis Tool

Analyze a specific session or baseline database:

```bash
# Analyze bot session
npm run mi-analysis ./data/bot-sessions/live-session-1761598498518.db

# Analyze baseline data
npm run mi-analysis ./data/market-baseline/baseline-2025-10-27.db
```

---

## 💾 DATABASE LOCATIONS

### Directory Structure

```
sol-bot-main/
├── data/
│   ├── market-baseline/          # Standalone recorder databases
│   │   ├── baseline-2025-10-27.db
│   │   ├── baseline-2025-10-28.db
│   │   └── baseline-2025-10-29.db
│   │
│   └── bot-sessions/              # Bot session databases
│       ├── test-session-1761598498518.db
│       ├── test-session-1761612345678.db
│       ├── live-session-1761625987654.db
│       └── live-session-1761639654321.db
```

### Database Schemas

Both recorders use the **same schema** (7 tables, 4 views):

**Tables:**
- `tokens_scored` - All tokens detected
- `tokens_tracked` - Would-buy tokens tracked
- `price_history_1s` - 1-second price charts
- `exit_analysis` - Exit decision analysis
- `daily_stats` - Daily performance stats
- `pattern_library` - ML training data
- `config_snapshots` - Configuration versions

**Views:**
- `todays_performance` - Real-time performance
- `best_hours` - Most profitable hours
- `worst_hours` - Least profitable hours
- `moonshot_opportunities` - 5x+ opportunities

### Database Sizes

- **Baseline**: ~2-5 MB per day (1,000-2,000 tokens)
- **Bot Session**: ~500 KB - 2 MB per session (100-500 tokens)

### Cleanup Recommendations

```bash
# Keep last 30 days of baseline data
find data/market-baseline/ -name "*.db" -mtime +30 -delete

# Archive old bot sessions
tar -czf sessions-archive-$(date +%Y%m).tar.gz data/bot-sessions/
```

---

## 🔄 WORKFLOW EXAMPLES

### Workflow 1: Daily Market Analysis

```bash
# Morning: Start baseline recorder
npm run mi-baseline

# Afternoon: Run bot session
npm run dev

# Evening: Compare results
npm run mi-compare ./data/bot-sessions/live-session-[ID].db

# Night: Analyze findings and adjust bot config
```

### Workflow 2: A/B Testing Different Configs

```bash
# Test Config A
# Edit UNIFIED-CONTROL.ts with Config A settings
npm run dev
# Let run for 1 hour

# Test Config B
# Edit UNIFIED-CONTROL.ts with Config B settings
npm run dev
# Let run for 1 hour

# Compare both sessions to same baseline
npm run mi-compare ./data/bot-sessions/live-session-[A-ID].db
npm run mi-compare ./data/bot-sessions/live-session-[B-ID].db

# Determine which config performed better
```

### Workflow 3: Continuous Baseline Collection

```bash
# Run baseline recorder as a service (Linux/Mac)
nohup npm run mi-baseline > baseline.log 2>&1 &

# Check if running
ps aux | grep standalone-recorder

# View logs
tail -f baseline.log

# Stop baseline recorder
pkill -f standalone-recorder
```

---

## 🛠️ TROUBLESHOOTING

### Issue: Baseline Recorder Won't Start

**Symptoms:**
```
❌ Initialization failed: Error: RPC_WSS_URI is missing
```

**Solution:**
```bash
# Check .env file has WebSocket endpoint
cat .env | grep RPC_WSS_URI

# If missing, add it:
echo "RPC_WSS_URI=wss://your-endpoint-here" >> .env
```

### Issue: No Tokens Being Detected

**Symptoms:**
```
📊 STATS [14:32:15]
📨 Messages: 0 (0/s)
🔍 Tokens Detected: 0 (0/min)
```

**Possible Causes:**
1. WebSocket not connected
2. Wrong program ID subscribed
3. Network issues

**Solution:**
```bash
# Check WebSocket connection in logs
# Look for: "✅ WebSocket connected"

# Verify Pump.fun program ID
# Should be: 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P

# Test connection manually
wscat -c $RPC_WSS_URI
```

### Issue: Comparison Tool Shows "Database not found"

**Symptoms:**
```
❌ Comparison failed: Error: Database not found: ./data/market-baseline/baseline-2025-10-27.db
```

**Solution:**
```bash
# Check if baseline recorder ran that day
ls -lh data/market-baseline/

# If missing, baseline recorder wasn't running
# Start it now and wait for data collection

# Specify different date with available baseline
npm run mi-compare ./data/bot-sessions/[session].db 2025-10-26
```

### Issue: Session Tracker Not Recording

**Symptoms:**
Bot runs but no session database created

**Solution:**
```bash
# Check if MI is disabled
cat .env | grep MI_ENABLED

# If set to false, remove it or set to true
# Remove line from .env or:
echo "MI_ENABLED=true" >> .env

# Verify bot shows MI started message
npm run dev | grep "Market Intelligence"
# Should see: "✅ Market Intelligence session tracker started"
```

### Issue: Database Locked Error

**Symptoms:**
```
❌ Error: SQLITE_BUSY: database is locked
```

**Solution:**
```bash
# Only one process can write to SQLite database at a time
# Don't run multiple instances of same recorder

# Check for multiple processes
ps aux | grep standalone-recorder
ps aux | grep "npm run dev"

# Kill duplicate processes
kill [PID]
```

---

## 📚 ADDITIONAL RESOURCES

### NPM Scripts Reference

| Script | Purpose | Usage |
|--------|---------|-------|
| `mi-baseline` | Start standalone observer | `npm run mi-baseline` |
| `mi-compare` | Compare bot to baseline | `npm run mi-compare <session-db> [date]` |
| `mi-analysis` | Analyze single database | `npm run mi-analysis <db-path>` |
| `mi-test` | Run smoke test | `npm run mi-test` |

### File Locations

- **Standalone Recorder**: `market-intelligence/standalone-recorder.ts`
- **Comparison Tool**: `market-intelligence/reports/compare-bot-to-market.ts`
- **Daily Analysis**: `market-intelligence/reports/daily-analysis.ts`
- **Config**: `market-intelligence/config/mi-config.ts`
- **Schema**: `market-intelligence/database/schema.sql`

### Configuration Files

- **Session Config**: Defined in `mi-config.ts` (SessionConfig interface)
- **Bot Integration**: Modified in `src/index.ts` (lines 719-744)
- **Recorder Settings**: `market-intelligence/config/mi-config.ts`

---

## ✅ VERIFICATION CHECKLIST

Before using the dual recorder system, verify:

- [ ] Standalone recorder starts without errors
- [ ] Creates database in `data/market-baseline/`
- [ ] WebSocket connects and detects tokens
- [ ] Bot session tracker shows session ID on startup
- [ ] Creates database in `data/bot-sessions/`
- [ ] Comparison tool runs successfully
- [ ] Both recorders can run simultaneously (2 terminals)

---

**Documentation Version**: 1.0
**Last Updated**: October 27, 2025
**Maintainer**: SOL-BOT Development Team
