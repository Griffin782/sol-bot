# Configuration File Flow Tree

**Purpose**: Visual map of how configuration changes flow through the system

**Use This**: To plan analysis order - start with File A and work sequentially

---

## File Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ FILE A: src/core/UNIFIED-CONTROL.ts                            │
│ PRIMARY CONFIG - Single Source of Truth                        │
│                                                                 │
│ DEFINES:                                                        │
│   - TradingMode enum (PAPER, LIVE)                            │
│   - MASTER_SETTINGS object (all bot configuration)            │
│   - getCurrentMode() function                                  │
│   - Line 272: currentMode: TradingMode.PAPER or .LIVE        │
│                                                                 │
│ EXPORTS:                                                        │
│   - TradingMode, MASTER_SETTINGS, getCurrentMode, etc.        │
│                                                                 │
│ IMPORTED BY: CONFIG-BRIDGE.ts, secure-pool-system.ts,         │
│              botController.ts                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    (exports to)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FILE B: src/core/CONFIG-BRIDGE.ts                              │
│ COMPATIBILITY LAYER - Backward Compatibility                   │
│                                                                 │
│ IMPORTS:                                                        │
│   - TradingMode, MASTER_SETTINGS from UNIFIED-CONTROL         │
│                                                                 │
│ EXPORTS:                                                        │
│   - TEST_MODE (derived from MASTER_SETTINGS.currentMode)      │
│   - BUY_AMOUNT, MAX_TRADES, POSITION_SIZE                     │
│   - All re-exported from UNIFIED-CONTROL                       │
│                                                                 │
│ PURPOSE: Allows old code using TEST_MODE to work with new     │
│          UNIFIED-CONTROL system                                │
│                                                                 │
│ IMPORTED BY: index.ts                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    (exports to)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FILE C: src/index.ts                                           │
│ MAIN BOT CONTROLLER - Orchestrates all trading                │
│                                                                 │
│ IMPORTS:                                                        │
│   - TEST_MODE from CONFIG-BRIDGE                              │
│   - (Should import more from CONFIG-BRIDGE)                   │
│                                                                 │
│ ALSO IMPORTS (LEGACY):                                         │
│   - Various settings from src/config.ts                       │
│   - This is the DUAL CONFIG SOURCE PROBLEM                    │
│                                                                 │
│ USES:                                                           │
│   - TEST_MODE to control paper vs live trading                │
│   - Line 850: if (TEST_MODE) { ... }                          │
│   - Calls jupiterHandler.swapToken() to execute trades        │
│                                                                 │
│ CALLS: jupiterHandler.ts functions                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    (calls functions in)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FILE C2: src/utils/handlers/jupiterHandler.ts                 │
│ TRADE EXECUTION - Actually swaps tokens                       │
│                                                                 │
│ IMPORTS:                                                        │
│   - Nothing from UNIFIED-CONTROL (potential issue?)           │
│   - Gets TEST_MODE passed as parameter? Or reads .env?        │
│                                                                 │
│ FUNCTIONS:                                                      │
│   - swapToken() - Executes buy trades                         │
│   - unSwapToken() - Executes sell trades                      │
│                                                                 │
│ CRITICAL: This is where actual blockchain transactions happen │
│           If TEST_MODE isn't respected here, bot trades real  │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   PARALLEL      │
                    │   LEGACY PATH   │
                    └─────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FILE D: src/config.ts                                          │
│ LEGACY CONFIG - Still Used for Some Settings                  │
│                                                                 │
│ DEFINES:                                                        │
│   - DATA_STREAM_METHOD                                         │
│   - DATA_STREAM_MODE                                           │
│   - MAX_CONCURRENT                                             │
│   - CHECK_MODE                                                 │
│   - WALLET_MONITOR_INTERVAL                                    │
│   - BUY_PROVIDER                                               │
│   - PLAY_SOUND, OPEN_BROWSER                                   │
│   - SKIP_COPY_TRADE_SELL                                       │
│   - WSOL_MINT                                                  │
│   - (12 settings total)                                        │
│                                                                 │
│ PROBLEM: Dual config source creates confusion                 │
│          Some settings from UNIFIED-CONTROL, some from here   │
│                                                                 │
│ IMPORTED BY: index.ts (Lines 181-204)                         │
│                                                                 │
│ TODO: Migrate these 12 settings to UNIFIED-CONTROL           │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   SEPARATE      │
                    │   MI SYSTEM     │
                    └─────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FILE E: market-intelligence/config/mi-config.ts               │
│ MI SYSTEM CONFIG - Separate from main bot config              │
│                                                                 │
│ DEFINES:                                                        │
│   - getMarketIntelligenceConfig()                             │
│   - Recording settings (baseline, session tracking)           │
│   - Database locations                                         │
│                                                                 │
│ PURPOSE: Configure Market Intelligence system independently   │
│                                                                 │
│ IMPORTED BY: market-recorder.ts                               │
│                                                                 │
│ NOTE: This is SEPARATE from main bot config (by design)      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    (exports to)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FILE F: market-intelligence/handlers/market-recorder.ts       │
│ MI SYSTEM HANDLER - Records market data                       │
│                                                                 │
│ IMPORTS:                                                        │
│   - getMarketIntelligenceConfig() from mi-config.ts          │
│                                                                 │
│ EXPORTS:                                                        │
│   - MarketRecorder class                                       │
│                                                                 │
│ CRITICAL ISSUE:                                                │
│   - index.ts declares: let marketRecorder: MarketRecorder;   │
│   - BUT never initializes it!                                 │
│   - Result: MI system exists but never runs                   │
│                                                                 │
│ INTEGRATION POINT:                                             │
│   - Should be initialized in index.ts after line 1720        │
│   - Should be called on token detection                       │
│   - Currently: DEAD CODE (never instantiated)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Analysis Order

### For Paper Trading Issue

**Start Here** → **Then** → **Then** → **Finally**

1. **FILE A**: UNIFIED-CONTROL.ts
   - Verify Line 272 sets correct mode
   - Verify MASTER_SETTINGS exports correctly
   - Verify getCurrentMode() works

2. **FILE B**: CONFIG-BRIDGE.ts
   - Verify TEST_MODE derived correctly
   - Verify exports to index.ts
   - Check for any overrides

3. **FILE C**: index.ts
   - Verify TEST_MODE import
   - Verify Line 850 uses TEST_MODE
   - Trace to jupiterHandler calls

4. **FILE C2**: jupiterHandler.ts
   - Verify respects TEST_MODE
   - Check for hardcoded behavior
   - Verify no .env overrides

### For MI System Issue

**Start Here** → **Then** → **Then**

1. **FILE E**: mi-config.ts
   - Verify getMarketIntelligenceConfig() exists
   - Verify settings are correct
   - Check database paths

2. **FILE F**: market-recorder.ts
   - Verify MarketRecorder class exists
   - Verify initialization requirements
   - Check required parameters

3. **FILE C**: index.ts (integration points)
   - Find Line 77 (marketRecorder declaration)
   - Find where it SHOULD be initialized (not found)
   - Find where it SHOULD be called (not found)
   - **This is the bug**: Never initialized!

---

## Key Integration Points

### 1. Configuration Changes

**User Changes Line 272 in UNIFIED-CONTROL.ts**:
```typescript
currentMode: TradingMode.PAPER  // or TradingMode.LIVE
```

**Flow**:
1. UNIFIED-CONTROL.ts exports MASTER_SETTINGS
2. CONFIG-BRIDGE.ts imports MASTER_SETTINGS
3. CONFIG-BRIDGE.ts derives TEST_MODE = (currentMode === PAPER)
4. CONFIG-BRIDGE.ts exports TEST_MODE
5. index.ts imports TEST_MODE
6. index.ts uses TEST_MODE in conditionals
7. jupiterHandler.ts executes or simulates based on TEST_MODE

**Potential Break Points**:
- Line 272 not respected
- CONFIG-BRIDGE derivation wrong
- index.ts import fails
- jupiterHandler doesn't check TEST_MODE

### 2. MI System Integration (BROKEN)

**Expected Flow**:
1. mi-config.ts provides configuration
2. index.ts imports MarketRecorder
3. index.ts initializes: `marketRecorder = new MarketRecorder(connection, config)`
4. index.ts calls: `marketRecorder.onTokenDetected(...)` for each token
5. market-recorder.ts records to database

**Actual Flow**:
1. mi-config.ts provides configuration ✅
2. index.ts imports MarketRecorder ✅
3. index.ts **NEVER** initializes it ❌
4. index.ts **NEVER** calls it ❌
5. market-recorder.ts **NEVER** runs ❌

**The Bug**: Line 77 declares `let marketRecorder` but there's no initialization code anywhere.

---

## File Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | File working correctly |
| ⚠️ | File has issues but not critical |
| ❌ | File broken or not integrated |
| 🔄 | File needs migration/refactoring |
| 📝 | File is documentation/config only |

**Current Status**:
- FILE A (UNIFIED-CONTROL.ts): ✅ Working
- FILE B (CONFIG-BRIDGE.ts): ✅ Working
- FILE C (index.ts): ⚠️ Uses dual config sources
- FILE C2 (jupiterHandler.ts): ❓ Need to analyze
- FILE D (config.ts): 🔄 Should migrate to UNIFIED-CONTROL
- FILE E (mi-config.ts): ✅ Working
- FILE F (market-recorder.ts): ❌ Never initialized/called

---

## Next Steps

1. **Choose Your Issue**:
   - Paper trading? Start with FILE A
   - MI system? Start with FILE E

2. **Use Generic Prompt**: Copy from GENERIC-FILE-ANALYSIS-PROMPT.md

3. **Replace [FILENAME]**: With actual file path

4. **Analyze Systematically**: Complete all 8 phases

5. **Update Tracking Sheet**: Record findings

6. **Follow Chain**: Move to next file based on analysis

---

## Important Notes

- **Don't skip files**: Each file analysis builds on previous
- **Don't rush**: 20-30 minutes per file is normal
- **Don't assume**: Verify every import, every export
- **Don't guess**: Trace actual code paths, not expected paths

The goal is to find where the chain breaks. That's your bug.
