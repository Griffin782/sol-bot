# Bot Startup Files - Complete List

**Purpose**: All files that output information to terminal during bot startup

**Generated**: 2025-11-06
**Analyzed From**: Startup logs comparison

---

## Core Initialization Files

### 1. **src/index.ts** (MAIN ENTRY POINT)
- **Lines Active During Startup**: 1-2000+
- **Outputs**:
  - PumpSwap SDK initialization (line ~1991)
  - Wallet verification
  - Position monitor setup
  - gRPC listener start
  - Enhanced features initialization error (line 815)
- **Issues**:
  - Enhanced features TypeError at line 815
  - PumpSwap SDK initialization fails

### 2. **src/core/UNIFIED-CONTROL.ts**
- **Outputs**:
  - MODE_PRESETS configuration
  - Session progression math validation
- **Issues**:
  - Syntax error fixed (comma on line 31)

### 3. **src/core/CONFIG-BRIDGE.ts**
- **Outputs**:
  - `[CONFIG-BRIDGE] Backward compatibility layer loaded`
  - `BUY_AMOUNT: 0.06865 SOL (15 USD)`
  - `MAX_TRADES: 100`
  - `MODE: PAPER`
- **Issues**:
  - Position sizes don't match ($15 vs $20 vs $11.67)

### 4. **src/core/CONFIG-ENFORCER.ts**
- **Outputs**:
  - All `[CONFIG-ENFORCER]` lines
  - Configuration validation results
  - `api.buyProvider = jupiter` (should be pumpswap)
- **Issues**:
  - Reports jupiter despite config.ts showing pumpswap
  - Missing settings: maxRuntime, maxConcurrentTrades, maxSlippage, maxHoldTime

### 5. **src/botController.ts**
- **Outputs**:
  - `BOT CONTROLLER INITIALIZED`
  - Session parameters
  - `Position Size: $20 = 0.1200 SOL`
  - `SOL Price: $170.00 (auto-updating)`
- **Issues**:
  - SOL price $170 conflicts with other sources ($156.76)
  - Position size $20 conflicts with others

### 6. **src/config.ts**
- **Outputs**:
  - `[Config] Transactions provider is set to: pumpswap` ✅
- **Status**: NOW CORRECT

---

## Security & Safety Files

### 7. **src/utils/managers/securityManager.ts**
- **Outputs**:
  - `SecurityManager initialized`
  - IP whitelist status
  - Security status dashboard

### 8. **src/utils/safetyWrapper.ts**
- **Outputs**:
  - `Emergency Safety Wrapper ACTIVATED`
  - `Emergency mode reset`
  - EMERGENCY SAFETY DASHBOARD

---

## Wallet & Pool Files

### 9. **src/utils/walletRotation.ts**
- **Outputs**:
  - `Wallet Rotation System Initialized`
  - `Current Wallet: #1`
  - `Loaded 10 wallets from pool`

### 10. **src/utils/secure-pool.ts**
- **Outputs**:
  - `Initializing Secure Pool System...`
  - `SOL Price Updated: $156.76 (from CoinGecko)` ✅
  - `Position Size: $200`
  - `Position in SOL: 0.05`
- **Issues**:
  - SOL price $156.76 conflicts with $170 from botController
  - Position size $200 conflicts with others

---

## Validation Files

### 11. **src/utils/simple-jupiter-validator.ts**
- **Outputs**:
  - `Validating Jupiter Configuration...`
  - `Configuration Summary`
  - `Provider: QuickNode + Jupiter`
- **Issues**:
  - Should mention PumpSwap now, not just Jupiter

---

## Market Intelligence Files

### 12. **market-intelligence/handlers/market-recorder.ts**
- **Outputs**:
  - `Market Recorder initialized successfully`
  - `Database: ./data/market-baseline/baseline-2025-11-06.db`
  - `Recording: ALL TOKENS (baseline)`
  - `Min Score to Track: 60`
  - `Check Interval: 5s`
- **Issues**:
  - Baseline Mode: true (should be bot session mode)
  - record_all_tokens: true (should only record bought tokens)

### 13. **market-intelligence/handlers/session-tracker.ts**
- **Outputs**:
  - `Market Intelligence session tracker started (test mode)`
  - `Session ID: 1762451425087`
  - `Database: data/bot-sessions/test-session-1762451425087.db`

---

## Token Processing Files

### 14. **src/utils/managers/tokenQueueManager.ts**
- **Outputs**:
  - `DEBUG: TokenQueueManager received initialPool: $600`
  - `DEBUG: Creating PoolManager with initialPool: $600, positionSize: $11.6705`
  - `POOL STATUS UPDATE`
  - `Position Size: $11.6705 (0.0687 SOL)`
- **Issues**:
  - Position size $11.6705 conflicts with $20, $200, etc.

### 15. **src/core/PARTIAL-EXIT-SYSTEM.ts**
- **Outputs**:
  - `Initializing Partial Exit System...`
  - `Partial Exit System initialized`

---

## Monitoring Files

### 16. **src/monitoring/positionMonitor.ts**
- **Outputs**:
  - `Position Monitor: No positions to monitor`
  - `Starting fallback polling`
  - `Position Monitor: Real-time price tracking ACTIVE (156.76 SOL/USD)`
- **Issues**:
  - SOL price $156.76 conflicts with $170
  - "fallback polling" suggests monitoring might use polling instead of pure gRPC

---

## Handler Files (PumpSwap & Jupiter)

### 17. **src/utils/handlers/pumpswapHandler.ts**
- **Outputs**:
  - `Initializing PumpSwap SDK...`
  - `[❌ PumpSwap SDK] Initialization failed: TypeError: bs58.decode is not a function`
  - `PumpSwap SDK not available - will use Jupiter API`
- **Issues**:
  - 🔴 CRITICAL: bs58 import/usage error
  - Falls back to Jupiter when should be primary

### 18. **src/utils/handlers/jupiterHandler.ts**
- **Outputs**:
  - `💰 [PRICE] Fetching price for...` (SHOULD NOT APPEAR!)
  - `❌ [PRICE] Jupiter Price API error (404): Not Found`
- **Issues**:
  - 🔴 CRITICAL: `getCurrentTokenPrice()` is STILL BEING CALLED
  - This is the polling loop we supposedly deleted!

---

## Token Quality & Checks

### 19. **src/core/TOKEN-QUALITY-FILTER.ts**
- **Outputs**:
  - `⚠️ YOLO mode - no checks performed!` 🔴
- **Issues**:
  - YOLO mode bypasses all safety checks - DANGEROUS!

---

## Database & Tracking

### 20. **src/tracker/db.ts**
- **Outputs**:
  - `Database schema loaded`
  - Token verification messages

---

## Status & Reporting

### 21. **src/index.ts** (Status Display Function)
- **Outputs**:
  - `BOT STATUS` dashboard (every 5 seconds)
  - `Tokens Detected`, `Tokens Bought`, etc.
  - `POOL STATUS`
  - `SECURE TRADING STATUS`

---

## Summary

**Total Files Involved in Startup**: 21 files
**Files with Critical Issues**: 8 files
**Files with Moderate Issues**: 7 files
**Files Working Correctly**: 6 files

---

## Critical Files Requiring Immediate Attention

1. **jupiterHandler.ts** - Still calling Price API (polling loop alive)
2. **pumpswapHandler.ts** - bs58.decode error preventing SDK use
3. **botController.ts** - Wrong SOL price ($170 vs $156.76)
4. **tokenQueueManager.ts** - Wrong position size ($11.67 vs $20)
5. **TOKEN-QUALITY-FILTER.ts** - YOLO mode active (dangerous)
6. **market-recorder.ts** - Baseline mode instead of bot session mode
7. **CONFIG-ENFORCER.ts** - Reports jupiter despite config showing pumpswap
8. **index.ts line 815** - TypeError with undefined toLocaleString()

---

**Next Steps**: Systematically analyze each critical file using the analysis templates
