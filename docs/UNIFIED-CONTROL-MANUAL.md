# UNIFIED-CONTROL User Manual

## 📖 Overview

The UNIFIED-CONTROL system centralizes ALL bot configuration in one file, eliminating the chaos of multiple conflicting config files. This manual shows you exactly how to control your bot with **ACCURATE LINE NUMBERS**.

## 🎯 Quick Reference

**File**: `src/core/UNIFIED-CONTROL.ts`

### Key Settings Locations:
- **Trading Modes**: Lines 19-24 (TradingMode enum)
- **Mode Presets**: Lines 26-67 (MODE_PRESETS object)
- **Current Mode**: Line 271 (currentMode setting)
- **Pool Configuration**: Lines 274-284
  - **Position Size SOL**: Line 278
  - **Position Size USD**: Line 279
  - **Target Pool**: Line 277
  - **Initial Pool**: Line 275
- **Trading Limits**: Lines 287-296
  - **Max Trades**: Line 289
  - **Rate Limit**: Line 292
- **Exit Strategy**: Lines 316-325
  - **Stop Loss**: Line 317
  - **Take Profit**: Line 318
- **Execution Settings**: Lines 328-335
  - **Slippage**: Line 329
  - **Priority Fee**: Line 330

---

## 🎮 How to Change Settings

### 1. Switch Trading Modes (Easiest Way)

**Location**: Line 271
```typescript
// Line 271 in src/core/UNIFIED-CONTROL.ts:
currentMode: TradingMode.CONSERVATIVE,  // ← Change this
```

**Available Modes** (defined lines 19-24):
- `TradingMode.PAPER` - Paper trading ($0.002 per trade)
- `TradingMode.MICRO` - Learning mode ($0.17 per trade)
- `TradingMode.CONSERVATIVE` - Safe trading ($0.21 per trade)
- `TradingMode.PRODUCTION` - Large scale ($15 per trade)

### 2. Change Position Size

**Location**: Lines 278-279
```typescript
// In pool object (lines 274-284):
pool: {
  initialPool: 600,              // Line 275
  currentPool: 600,              // Line 276
  targetPoolUSD: 100000,         // Line 277 ← Your target
  positionSizeSOL: 0.00089,      // Line 278 ← SOL amount per trade
  positionSizeUSD: 0.21,         // Line 279 ← USD amount per trade
  // ...
}
```

**Safe Position Sizes**:
- Ultra Safe: `0.0001` SOL (`$0.02`)
- Conservative: `0.00089` SOL (`$0.21`) ← Current
- Moderate: `0.005` SOL (`$1.00`)
- Aggressive: `0.05` SOL (`$10.00`)

### 3. Adjust Pool Targets

**Location**: Line 277
```typescript
targetPoolUSD: 100000,  // Line 277 ← Change your final goal
```

### 4. Modify Safety Settings

**Stop Loss** (Line 317):
```typescript
// In exit object (lines 316-325):
exit: {
  stopLoss: -80,          // Line 317 ← Your stop loss percentage
  takeProfit: 100,        // Line 318 ← Take profit percentage
  // ...
}
```

**Trade Limits** (Lines 287-296):
```typescript
// In limits object:
limits: {
  maxTradesPerSession: 100,      // Line 288
  maxTradesAbsolute: 20,         // Line 289 ← Hard safety limit
  maxLossUSD: 100,               // Line 290
  rateLimitDelay: 5000,          // Line 292 ← Delay between trades (ms)
  // ...
}
```

---

## ⚙️ Trading Mode Details

**Mode Presets** (Lines 26-67):

| Mode | Position Size | Max Trades | Duration | Real Money | Risk Level |
|------|--------------|------------|----------|------------|------------|
| **PAPER** | $0.002 | 20 | Until limit | ❌ No | Minimal |
| **MICRO** | $0.17 | 50 | 1 hour | ✅ Yes | Very Low |
| **CONSERVATIVE** | $0.21 | 100 | Unlimited | ✅ Yes | Low |
| **PRODUCTION** | $15 | Unlimited | Unlimited | ✅ Yes | Moderate |

---

## 🔧 Common Configuration Tasks

### Check Current Settings
Look for this in console output when bot starts:
```
📋 [UNIFIED-CONTROL] Final configuration active:
   Mode: CONSERVATIVE (Conservative trading with your intended position size)
   Position Size: $0.21 (0.00089 SOL)
   Pool: $600 → $100000
   Trade Limit: 20 (absolute maximum)
```

### Change Mode at Runtime
You **cannot** change mode while running. You must:
1. Stop the bot
2. Edit line 271 in `src/core/UNIFIED-CONTROL.ts`:
   ```typescript
   currentMode: TradingMode.MICRO,  // Change this
   ```
3. Restart the bot

### Adjust Position Size
1. Stop the bot
2. Edit lines 278-279:
   ```typescript
   positionSizeSOL: 0.001,    // Your SOL amount
   positionSizeUSD: 0.25,     // Your USD amount
   ```
3. Restart the bot

### Modify Safety Limits
Edit the limits object (lines 287-296):
```typescript
limits: {
  maxTradesAbsolute: 10,         // Lower trade limit
  rateLimitDelay: 10000,         // 10 second delays
  maxLossUSD: 50,                // Lower loss limit
}
```

---

## 🚨 Important Safety Features

### 1. Absolute Trade Limit (Line 289)
- **Hard coded**: `maxTradesAbsolute: 20`
- **Cannot be overridden**: Bot forces shutdown
- **Purpose**: Prevents runaway trading

### 2. Mode Presets (Lines 26-67)
- **PAPER**: Simulation only, no real money
- **MICRO**: Tiny real trades for learning
- **CONSERVATIVE**: Your intended safe settings
- **PRODUCTION**: Larger scale operations

### 3. Entry Validation (Lines 299-313)
```typescript
entry: {
  honeypotCheck: true,         // Line 300 ← Always enabled
  rugCheck: true,              // Line 301 ← Always enabled
  qualityFilterEnabled: true,  // Line 311 ← Always enabled
}
```

---

## 🛠️ Troubleshooting

### Bot Using Wrong Values?
1. **Check startup logs** for configuration summary
2. **Verify line 271** shows your intended mode
3. **Check lines 278-279** for position size
4. **Restart cleanly** to reload settings

### Values Not Updating?
1. **Stop bot completely**
2. **Save file**: Verify `UNIFIED-CONTROL.ts` modification time
3. **Check TypeScript**: `npm run build`
4. **Start bot**: Watch startup logs

### Wrong Position Size?
- **Check line 278**: `positionSizeSOL` value
- **Check line 279**: `positionSizeUSD` value
- **Verify mode**: Line 271 affects position size automatically

---

## ⚡ Quick Edit Guide

### Most Common Changes:

**Switch to Paper Mode** (Line 271):
```typescript
currentMode: TradingMode.PAPER,
```

**Switch to Micro Mode** (Line 271):
```typescript
currentMode: TradingMode.MICRO,
```

**Change Position Size** (Lines 278-279):
```typescript
positionSizeSOL: 0.005,    // $1.00 trades
positionSizeUSD: 1.0,
```

**Lower Trade Limit** (Line 289):
```typescript
maxTradesAbsolute: 10,     // Stop after 10 trades
```

**Increase Safety Delay** (Line 292):
```typescript
rateLimitDelay: 10000,     // 10 seconds between trades
```

---

## 📞 Configuration Validation

The system includes built-in validation (lines 614-654):
- Position size cannot exceed 10% of pool
- Stop loss must be between -50% and 0%
- Safety checks cannot be disabled
- Trade limits are enforced

**Startup Validation**:
```
✅ [CONFIG-ENFORCER] Startup validation passed
📋 [UNIFIED-CONTROL] Final configuration active
```

**If validation fails**:
```
❌ [UNIFIED-CONTROL] Configuration validation failed:
   - Position size too large: 50 > 10% of 600
```

---

## 🎯 File Structure Summary

**Main Sections**:
- Lines 19-24: Trading mode definitions
- Lines 26-67: Mode preset configurations
- Lines 271: Current active mode
- Lines 274-284: Pool and position settings
- Lines 287-296: Trading limits and safety
- Lines 316-325: Exit strategy settings
- Lines 328-335: Execution parameters

**Key Rule**: Always restart the bot after editing any configuration values.

The unified system prevents configuration conflicts and ensures your settings are respected across the entire application.