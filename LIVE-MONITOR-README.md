# Live Bot Monitor Documentation (Enhanced Version)

## Overview

The `live-monitor.ts` script provides **comprehensive real-time monitoring and health checking** for the Sol trading bot. It features a rich terminal UI with interactive controls, running in a separate terminal window alongside the main bot for continuous oversight of trading operations, file integrity, and system health.

**🆕 Enhanced Features:** Professional dashboard interface, advanced file corruption detection, backup verification, interactive alerts, and comprehensive trading analysis.

## Features

### 🔄 Real-Time Status Display
- **Pool Status**: Current pool value, session progress, P&L tracking
- **Trading Metrics**: Active trades, win rate, total trades, session performance
- **Wallet Health**: Balance verification, discrepancy detection
- **Updates every 5 seconds** for real-time monitoring

### 📁 File Validation System
- **CSV Integrity Checks**: Validates pool_transactions.csv, pending_tokens.csv, paper_trading_exits.csv
- **Corruption Detection**: Identifies truncated, malformed, or damaged files
- **Format Validation**: Ensures proper CSV structure and data types
- **Update Monitoring**: Alerts when files stop being updated

### 💾 Backup Verification
- **Backup Presence**: Checks for configuration backups
- **Integrity Validation**: Verifies backup completeness and file hashes
- **Age Monitoring**: Alerts when backups are outdated
- **Version Control**: Tracks backup timestamps and versions

### 🏥 Health Check System
- **Duplicate Trade Detection**: Identifies potential duplicate transactions
- **Pool Calculation Verification**: Ensures mathematical consistency
- **Wallet Balance Validation**: Compares expected vs actual SOL balance
- **System Resource Monitoring**: Memory, CPU, and RPC latency checks

### 🚨 Alert System
- **Error Alerts**: Critical issues requiring immediate attention
- **Warning Alerts**: Potential problems needing monitoring
- **Info Alerts**: General status updates and notifications
- **Alert Categories**: File, wallet, trading, system, backup

### 🎨 Terminal UI Interface
- **Blessed.js Integration**: Professional terminal interface
- **Color-coded Status**: Green/yellow/red indicators for quick assessment
- **Real-time Updates**: Live data refresh without screen flicker
- **Interactive Controls**: Keyboard shortcuts for alert management

## Usage

### Basic Commands
```bash
# Start the live monitor
npm run monitor

# Show help and usage information
npm run monitor:help

# Direct execution
tsx live-monitor.ts
tsx live-monitor.ts --help
```

### Running Alongside the Bot
```bash
# Terminal 1: Start the trading bot
npm run dev

# Terminal 2: Start the live monitor
npm run monitor
```

## Interface Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Sol Bot Live Monitor - RUNNING | Last Update: 12:34:56 | Press 'q' to quit  │
├─────────────────────┬─────────────────────┬─────────────────────────────────┤
│   Pool Status       │  Trading Metrics    │      Wallet Health              │
│                     │                     │                                 │
│ Initial: $600.00    │ Total Trades: 15    │ Expected: 3.245 SOL            │
│ Current: $642.50    │ Active: 3           │ Actual: 3.198 SOL              │
│ Target:  $700.00    │ Win Rate: 73.3%     │ Discrepancy: 0.047 SOL         │
│                     │                     │                                 │
│ Session P&L: +$42.50│ Total P&L: +$28.30  │ Status: Connected               │
│ Progress: [████░░]  │ Session P&L: +$42.50│ Last Checked: 12:34:50          │
│ 42.5%               │                     │                                 │
├─────────────────────┴─────────────────────┼─────────────────────────────────┤
│        File Validation                    │      System Performance         │
│                                           │                                 │
│ Pool Transactions:                        │ Memory: 156.7 MB                │
│   Status: OK                             │ CPU: 0.23s                      │
│   Size: 45.2KB | Lines: 234             │ RPC Latency: 245ms              │
│   Updated: 3s ago                        │                                 │
│                                           ├─────────────────────────────────┤
│ Pending Tokens:                          │      Health Checks              │
│   Status: Warnings                       │                                 │
│   Size: 12.1KB | Lines: 67              │ System Health: Good             │
│   Updated: 1s ago                        │ Errors: 0 | Warnings: 2        │
├──────────────────────────────────────────┴─────────────────────────────────┤
│                           Alerts & Warnings                                 │
│                                                                             │
│ [WARNING] 12:34:45 - Pool calculation inconsistency: Expected 642.50       │
│ [INFO] 12:34:30 - Pool up 7.08%                                            │
│ [WARNING] 12:34:15 - Active trades (4) exceed max positions (3) ✓           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Features Explained

### 1. **Real-Time Pool Tracking**
- Monitors current pool value from CSV files
- Calculates session progress toward target
- Tracks P&L in real-time
- Visual progress bar for session goals

### 2. **Trading Activity Monitoring**
- Counts total and active trades
- Calculates win rate from historical data
- Monitors for excessive concurrent positions
- Tracks session vs. total performance

### 3. **File Integrity Validation**

#### CSV Format Validation
- **Pool Transactions**: Validates timestamp, action, amounts, balances
- **Pending Tokens**: Checks token mints, signatures, statuses
- **Paper Trading**: Verifies exit data and calculations

#### Corruption Detection
- Null byte detection
- Truncated line identification
- Repeated identical line detection
- Average line length analysis

### 4. **Wallet Health Monitoring**
- Connects to Solana RPC to check actual balance
- Compares with expected balance from trading data
- Allows for gas fees and slippage tolerance
- Alerts on significant discrepancies

### 5. **System Health Checks**

#### Duplicate Trade Detection
```typescript
// Identifies potential duplicate trades by signature/token
const duplicates = trades.filter(trade => 
  signatures.get(trade.signature) > 1
);
```

#### Pool Calculation Verification
```typescript
// Verifies mathematical consistency in pool calculations
const expectedBalance = prevBalance + tradeAmount;
const actualBalance = currentBalance;
const discrepancy = Math.abs(expected - actual);
```

### 6. **Alert Management System**

#### Alert Types
- **Error**: Critical issues (red) - corrupted files, wallet problems
- **Warning**: Potential issues (yellow) - calculation inconsistencies, old backups
- **Info**: Status updates (cyan) - successful trades, pool milestones

#### Alert Categories
- **file**: CSV validation, corruption, update issues
- **wallet**: Balance discrepancies, connection problems
- **trading**: Duplicate trades, position limits, calculations
- **system**: Memory, CPU, RPC issues
- **backup**: Missing, outdated, or corrupted backups

## Keyboard Controls

| Key | Action |
|-----|--------|
| `q`, `ESC`, `Ctrl+C` | Quit the monitor |
| `r` | Acknowledge all alerts (mark as seen) |
| `c` | Clear acknowledged alerts from display |

## Configuration Integration

The monitor automatically reads configuration from:
- `masterConfig.ts` - Trading parameters and limits
- Environment variables - RPC URLs, wallet paths
- CSV files - Real-time trading data
- Backup directories - Configuration snapshots

## Validation Rules

### File Validation
```typescript
// Pool transactions validation
- Timestamp format: ISO 8601
- Action types: pool_status, trade_execution, profit_return, stop_loss_exit
- Numeric fields: amount, balance, poolBalance must be valid numbers
- Trade count: Must be integer

// Pending tokens validation  
- Token mint: 44-character base58 string
- Status: pending, bought, rejected, error
- Timestamps: Valid ISO 8601 format
```

### Health Check Thresholds
```typescript
// System thresholds
Memory usage: Warning >200MB, Error >500MB
RPC latency: Good <500ms, Warning <1000ms, Error >1000ms
File update: Warning if >5min old while bot running

// Trading thresholds
Wallet balance: 5% tolerance for expected vs actual
Pool calculations: $1 variance allowed for rounding
Duplicate trades: Alert if same signature appears >1 time
```

## Integration Points

### With Bot Configuration Wizard
- Reads `masterConfig.ts` for trading parameters
- Uses pool limits for validation thresholds
- Integrates with backup system created by wizard

### With Trading Bot
- Monitors CSV files created by bot
- Validates data consistency in real-time
- Tracks wallet addresses used by bot
- Monitors RPC endpoints configured in bot

### With Existing Dashboard Components
- Uses blessed.js like existing terminal interfaces
- Compatible with session management system
- Integrates with backup and logging systems

## Troubleshooting

### Common Issues

**"No files found" warnings**
- Ensure bot has started and created CSV files
- Check that data directory exists
- Verify file permissions

**Wallet balance discrepancies**
- Check RPC connection and latency
- Verify wallet address is correctly loaded
- Consider gas fees and slippage in calculations

**File corruption alerts**
- Stop the bot immediately
- Check disk space and file system
- Restore from backup if necessary

**High memory usage warnings**
- Monitor for memory leaks in bot
- Consider restarting both bot and monitor
- Check system resources

### Performance Optimization

**Reduce Update Frequency**
```typescript
// Change update interval from 5 to 10 seconds
setInterval(() => {
  this.updateStatus();
}, 10000);
```

**Limit Alert History**
```typescript
// Keep fewer alerts in memory
if (this.status.alerts.length > 25) {
  this.status.alerts = this.status.alerts.slice(0, 25);
}
```

## Best Practices

### Deployment
1. **Always run monitor in separate terminal** from trading bot
2. **Start monitor after bot** to ensure CSV files exist
3. **Monitor system resources** alongside trading performance
4. **Acknowledge alerts promptly** to avoid display clutter

### Monitoring
1. **Watch for file corruption alerts** - immediate action required
2. **Monitor wallet discrepancies** - may indicate calculation errors
3. **Track session progress** - ensure bot is meeting targets
4. **Review backup status** - ensure configuration safety

### Maintenance
1. **Clear acknowledged alerts regularly** (press 'c')
2. **Monitor system performance metrics**
3. **Check backup integrity weekly**
4. **Update RPC endpoints if latency increases**

---

## 🆕 Enhanced Version Features (v2.0)

### 🎨 Professional Interface
- **Rich Terminal UI**: Professional dashboard using blessed library
- **Color-Coded Indicators**: Visual health status with green/yellow/red coding
- **Progress Bars**: Session target progress with visual indicators
- **Interactive Controls**: Keyboard shortcuts for alert management

### 🔍 Advanced File Analysis
- **Hash-based Integrity**: MD5 checksum monitoring for file changes
- **Corruption Detection**: Identifies null bytes, truncated lines, repeated patterns
- **CSV Validation**: Line-by-line format validation with specific error reporting
- **Backup Verification**: Automated backup completeness and age checks

### 📊 Enhanced Trading Analytics
- **Duplicate Detection**: Advanced signature-based duplicate trade identification
- **Pool Calculation Auditing**: Mathematical consistency verification
- **Tax-Adjusted Calculations**: Net profit calculations with 40% tax consideration
- **Real-time Win Rate**: Live performance metrics with color coding

### ⚡ Performance Optimizations
- **RPC Caching**: 30-second intervals to reduce API calls
- **Smart Updates**: Only update changed data sections
- **Memory Efficient**: Optimized blessed UI rendering

### 🎮 Interactive Controls
```
Keyboard Shortcuts:
q, ESC, Ctrl+C  - Quit monitor
r               - Acknowledge all alerts
c               - Clear acknowledged alerts
```

*This enhanced monitor provides comprehensive oversight of your trading bot operations with professional-grade monitoring capabilities, advanced data integrity checks, and interactive management features.*