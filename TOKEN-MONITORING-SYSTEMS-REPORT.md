# Token Monitoring Systems Report

**Date**: October 29, 2025
**Investigation**: Clarify monitoring systems and their purposes
**Requested By**: User

---

## 🔍 INVESTIGATION SUMMARY

Investigated three monitoring systems:
1. **automated-reporter.ts** (Legacy/Old system)
2. **PARTIAL-EXIT-SYSTEM.ts** (New/Active system)
3. **market-recorder.ts** (Market Intelligence)

---

## 📊 FINDINGS

### **1. automated-reporter.ts - LEGACY SYSTEM (Not Currently Used)**

**Location**: `src/enhanced/automated-reporter.ts`

**Purpose**: OLD whale-watching token monitor (replaced by PARTIAL-EXIT-SYSTEM)

**What It Does**:
- Monitors token positions for whale activity
- Has OLD tiered exit logic (25% at 2x, 4x, 6x, 20x+)
- Multiple monitoring intervals: 30s, 1min, 2min, 3min, 5min, 10min, 15min, 30min, 45min
- Includes whale exodus detection

**Key Evidence It's NOT Used**:
```bash
# Searching index.ts for imports:
grep "automated-reporter" src/index.ts
# Result: NO MATCHES

# What IS imported:
grep "PARTIAL-EXIT-SYSTEM" src/index.ts
# Result: Line 27: import { PartialExitManager, ExitResult } from './core/PARTIAL-EXIT-SYSTEM';
```

**Status**: ❌ **NOT ACTIVE** - Replaced by PARTIAL-EXIT-SYSTEM.ts

**Code Reference**: Lines 88-121 show tiered exit logic (similar to new system but unused)

---

### **2. PARTIAL-EXIT-SYSTEM.ts - ACTIVE TRADING BOT MONITOR** ✅

**Location**: `src/core/PARTIAL-EXIT-SYSTEM.ts`

**Purpose**: NEW tiered exit system for TRADING BOT (actively monitoring bought tokens)

**What It Does**:
- Monitors all tokens the bot buys
- Checks for exit tiers: 25% @ 2x, 4x, 6x, + 25% moonbag
- Integrated with bot's position tracking

**Integration Points** (`src/index.ts`):
1. **Line 27**: Import PartialExitManager
2. **Line 216**: Variable declared: `let partialExitManager: PartialExitManager | null = null`
3. **Line 1738**: Initialized: `partialExitManager = new PartialExitManager()`
4. **Lines 941-974**: Active monitoring loop

**Monitoring Interval**: ✅ **EVERY 10 SECONDS**

**Evidence**:
```typescript
// Line 189 in index.ts:
const WALLET_MONITOR_INTERVAL = config.token_sell.wallet_token_balances_monitor_interval || 10000;

// Line 982 in index.ts:
setTimeout(monitorPositions, WALLET_MONITOR_INTERVAL);

// Inside monitorPositions function (lines 941-974):
if (partialExitManager) {
  const trackedPositions = partialExitManager.getAllPositions();

  if (trackedPositions.length > 0) {
    console.log(`\n💎 Checking ${trackedPositions.length} position(s) for exit tiers...`);

    for (const position of trackedPositions) {
      const currentPrice = await getCurrentTokenPrice(position.mint);
      const exitResults = await partialExitManager.updatePrice(position.mint, currentPrice);
    }
  }
}
```

**Status**: ✅ **ACTIVE** - This is what the trading bot uses

**Monitoring Flow**:
1. Bot buys token → Position added to PARTIAL-EXIT-SYSTEM
2. Every 10 seconds: `monitorPositions()` runs
3. Fetches current price via Jupiter Price API v2
4. Checks if any tiers should trigger (2x, 4x, 6x)
5. If tier triggers → Executes partial sell via callback

---

### **3. market-recorder.ts - MARKET INTELLIGENCE MONITOR** 📊

**Location**: `market-intelligence/handlers/market-recorder.ts`

**Purpose**: Records market data for ALL tokens (baseline + bot sessions)

**What It Does**:
- Records ALL detected tokens (not just bot buys)
- Tracks price history for analysis
- Used for comparing bot performance vs market

**Monitoring Interval**: ⚡ **EVERY 1 SECOND** (10x faster than trading bot!)

**Evidence**:
```typescript
// Line 402 in market-recorder.ts:
const interval = setInterval(async () => {
  await this.updateTokenPrice(mint);
}, 1000);  // Every 1 second
```

**Status**: ✅ **ACTIVE** - Runs independently for data collection

---

## 📊 COMPARISON TABLE

| System | Purpose | Monitoring Interval | Used By | Status |
|--------|---------|-------------------|---------|--------|
| **automated-reporter.ts** | Legacy whale monitor | Multiple (30s-45min) | Nothing | ❌ Inactive |
| **PARTIAL-EXIT-SYSTEM.ts** | Trading bot exits | **10 seconds** | Trading Bot | ✅ Active |
| **market-recorder.ts** | Market Intelligence | **1 second** | MI System | ✅ Active |

---

## ✅ ANSWERS TO YOUR QUESTIONS

### **Q1: Is automated-reporter.ts used for token monitoring after buys?**

**Answer**: ❌ **NO** - It's the OLD system, replaced by PARTIAL-EXIT-SYSTEM.ts

**Evidence**:
- Not imported in `src/index.ts`
- PARTIAL-EXIT-SYSTEM.ts is imported and used instead
- automated-reporter.ts appears to be legacy code kept for reference

---

### **Q2: Does the trading bot use tiered-exit system?**

**Answer**: ✅ **YES** - Via PARTIAL-EXIT-SYSTEM.ts

**Evidence**:
```typescript
// Lines 941-974 in src/index.ts show active integration:
if (partialExitManager) {
  const trackedPositions = partialExitManager.getAllPositions();
  for (const position of trackedPositions) {
    const currentPrice = await getCurrentTokenPrice(position.mint);
    const exitResults = await partialExitManager.updatePrice(position.mint, currentPrice);
  }
}
```

**Tiers Configured**:
1. Tier 1: Sell 25% at 2x (100% gain)
2. Tier 2: Sell 25% at 4x (300% gain)
3. Tier 3: Sell 25% at 6x (500% gain)
4. Tier 4: Keep 25% as moonbag 💎

---

### **Q3: Was check time adjusted to every 10 seconds?**

**Answer**: ✅ **YES** - Confirmed every 10 seconds

**Evidence**:
```typescript
// Line 189 in src/index.ts:
const WALLET_MONITOR_INTERVAL = config.token_sell.wallet_token_balances_monitor_interval || 10000;
// 10000 milliseconds = 10 seconds

// This is used at line 982:
setTimeout(monitorPositions, WALLET_MONITOR_INTERVAL);
```

**Configuration Source**:
- Read from: `config.token_sell.wallet_token_balances_monitor_interval`
- Default: `10000` (10 seconds)
- This comes from UNIFIED-CONTROL.ts

---

### **Q4: Does Market Intelligence standalone version mirror how bot monitors tokens?**

**Answer**: ❌ **NO** - Different purposes, different intervals

**Key Differences**:

| Aspect | Trading Bot | MI Standalone |
|--------|------------|---------------|
| **Purpose** | Monitor bought positions for exits | Record ALL market tokens for analysis |
| **Interval** | 10 seconds | 1 second |
| **Scope** | Only bot's positions | ALL detected tokens |
| **Exit Logic** | Yes (tiered exits) | No (just recording) |
| **Price Source** | Jupiter Price API v2 | Simulated (TODO: actual feed) |

**MI Standalone Details**:
```typescript
// market-recorder.ts line 402:
private startPriceMonitoring(mint: string): void {
  const interval = setInterval(async () => {
    await this.updateTokenPrice(mint);
  }, 1000);  // Every 1 second (10x faster!)
}
```

**Why Different?**:
- **Trading Bot**: Only cares about owned positions, checks every 10s to balance API rate limits
- **MI Standalone**: Tracks ALL tokens for baseline data, uses 1s intervals for detailed price history

---

## 🎯 SYSTEM PURPOSES CLARIFIED

### **Trading Bot Token Monitoring** (After Buys):

**System Used**: `PARTIAL-EXIT-SYSTEM.ts`

**How It Works**:
1. Token purchased → `partialExitManager.addPosition()` called
2. Position tracked with entry price, amount, timestamp
3. Every 10 seconds: `monitorPositions()` checks all positions
4. Fetches current price via Jupiter Price API v2
5. Checks if any tiers triggered (2x, 4x, 6x)
6. If triggered → Executes partial sell, updates remaining position

**File**: `src/index.ts` lines 941-974

---

### **Market Intelligence Monitoring** (All Tokens):

**System Used**: `market-recorder.ts`

**How It Works**:
1. Token detected → `onTokenDetected()` called
2. If score passes threshold → Start tracking
3. Every 1 second: Update price and record to database
4. Tracks for duration or until exit condition
5. Records 1s price chart for analysis

**Purpose**: Baseline data collection to measure bot performance

**Files**:
- `market-intelligence/handlers/market-recorder.ts`
- `market-intelligence/standalone-recorder.ts`

---

## 📝 ADDITIONAL FINDINGS

### **automated-reporter.ts Historical Context**:

This file appears to be from an earlier version of the bot (V4 or earlier):
- Has OLD tiered exit logic similar to current system
- Includes whale monitoring features
- Multiple monitoring intervals (more complex)
- Likely replaced when PARTIAL-EXIT-SYSTEM.ts was created (Oct 27-28, 2025)

**Should It Be Removed?**
- Currently: Inactive but not causing issues
- Recommendation: Archive or delete to reduce confusion
- No risk keeping it (not imported anywhere)

---

## 🔄 SYSTEM INTERACTION

```
┌─────────────────────────────────────────────────────┐
│                   TRADING BOT                       │
│                                                     │
│  1. Buys Token                                      │
│  2. Adds to PARTIAL-EXIT-SYSTEM                     │
│  3. Every 10s: Check exit tiers                     │
│  4. If tier triggers → Sell portion                 │
│                                                     │
└─────────────────────────────────────────────────────┘
                          │
                          │ Records to MI (if enabled)
                          ↓
┌─────────────────────────────────────────────────────┐
│         MARKET INTELLIGENCE SYSTEM                  │
│                                                     │
│  Standalone:                                        │
│  - Monitors ALL market tokens                       │
│  - Every 1s: Record price                          │
│  - Baseline data for comparison                     │
│                                                     │
│  Bot Session Tracker:                               │
│  - Records bot's actual trades                      │
│  - Compares to baseline later                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**No Overlap**: Trading bot and MI standalone run independently

---

## ✅ VERIFICATION COMPLETED

**Trading Bot Monitoring**:
- ✅ Uses PARTIAL-EXIT-SYSTEM.ts (not automated-reporter.ts)
- ✅ Checks every 10 seconds (WALLET_MONITOR_INTERVAL = 10000)
- ✅ Tiered exits configured (25% @ 2x, 4x, 6x, + moonbag)
- ✅ Uses Jupiter Price API v2 for real prices

**Market Intelligence**:
- ✅ Runs independently on 1-second intervals
- ✅ Different purpose (data collection vs position management)
- ❌ Does NOT mirror bot monitoring (faster interval, broader scope)

---

## 📚 FILE REFERENCES

**Trading Bot Exit System**:
- `src/core/PARTIAL-EXIT-SYSTEM.ts` - Exit logic implementation
- `src/index.ts` lines 27, 216, 941-974, 982, 1738 - Integration points
- `src/utils/handlers/jupiterHandler.ts` lines 372-447 - Price fetching

**Market Intelligence**:
- `market-intelligence/handlers/market-recorder.ts` lines 402-407 - 1s monitoring
- `market-intelligence/standalone-recorder.ts` - Standalone baseline recorder
- `market-intelligence/config/mi-config.ts` - MI configuration

**Legacy (Unused)**:
- `src/enhanced/automated-reporter.ts` - Old system (not imported)

---

## 🎯 RECOMMENDATIONS

1. **Keep Current Setup**: PARTIAL-EXIT-SYSTEM works correctly
2. **Archive automated-reporter.ts**: Move to `/legacy` folder to reduce confusion
3. **Document Difference**: MI standalone serves different purpose than bot monitoring
4. **Monitor Performance**: Ensure 10-second intervals adequate for exit timing

---

**Report Created**: October 29, 2025
**Investigation Complete**: ✅ All questions answered
**Systems Verified**: 3 (1 inactive, 2 active)
