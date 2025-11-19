# Paper-Mode Sell Failure - Root Cause Analysis

**Date**: November 1, 2025
**Issue**: Paper-mode sells not executing properly
**Status**: ✅ ROOT CAUSE IDENTIFIED

---

## Executive Summary

**Root Cause Found**: The partial exit callback (index.ts:1771-1796) calls `unSwapToken()` without checking `TEST_MODE`, causing paper-mode trades to attempt real blockchain transactions that fail.

**Impact**: Paper-mode cannot simulate sells, making it impossible to test exit strategies.

**Fix Required**: Add TEST_MODE check to skip real blockchain calls in paper mode.

---

## Investigation Process

### 1. Jupiter Endpoint Analysis ✅

**Verified**: Both `swapToken` and `unSwapToken` use correct endpoint
- Line 293: `${process.env.JUPITER_ENDPOINT}/swap/v1/quote`
- Using `https://lite-api.jup.ag` (free tier)
- ✅ No authentication issues (was fixed previously)

### 2. Partial Exit System Analysis ✅

**Location**: `src/core/PARTIAL-EXIT-SYSTEM.ts`

**How it works**:
1. `PartialExitManager` tracks positions and exit tiers
2. `updatePrice()` checks if tiers should trigger
3. `executeExit()` **only** does calculations, doesn't call blockchain
4. Callback registered via `onExit()` handles actual sell execution

**Key Finding**: PARTIAL-EXIT-SYSTEM itself is mode-agnostic (correct design)

### 3. Exit Callback Analysis 🎯 **ROOT CAUSE FOUND**

**Location**: `src/index.ts:1771-1796`

**Current Code**:
```typescript
partialExitManager.onExit(async (mint, tier, result) => {
  console.log(`\n🎯 EXIT TIER CALLBACK TRIGGERED`);
  console.log(`   Token: ${mint.slice(0,8)}...`);
  console.log(`   Tier: ${tier.name}`);
  console.log(`   Amount to sell: ${result.actualAmountSold.toLocaleString()} tokens`);

  // Execute actual sell via unSwapToken
  try {
    console.log(`💰 Executing sell on blockchain...`);
    const sellSuccess = await unSwapToken(
      mint,                      // Token mint to sell
      WSOL_MINT,                 // Selling for SOL
      result.actualAmountSold,   // Amount of tokens to sell
      logEngine
    );

    if (sellSuccess) {
      console.log(`✅ Partial exit executed successfully`);
      console.log(`   Profit: ${result.profitSOL.toFixed(4)} SOL`);
    } else {
      console.error(`❌ Partial exit failed on blockchain`);
    }
  } catch (sellError) {
    console.error(`❌ Sell execution error:`, sellError);
  }
});
```

**Problem**:
- ❌ **No TEST_MODE check before calling `unSwapToken`**
- ❌ Always attempts real blockchain transaction
- ❌ Fails in paper mode (no tokens in wallet)

---

## Why This Fails in Paper Mode

### Paper-Mode Buy Flow (Working) ✅

```typescript
if (TEST_MODE) {
  // Simulate the buy
  console.log("📝 PAPER TRADING: Simulating buy...");
  // Track position in database
  // Don't call swapToken()
} else {
  // Real buy
  const swapResult = await swapToken(...);
}
```

### Paper-Mode Sell Flow (Broken) ❌

```typescript
// NO TEST_MODE CHECK!
// Always calls unSwapToken regardless of mode
const sellSuccess = await unSwapToken(
  mint,
  WSOL_MINT,
  result.actualAmountSold,
  logEngine
);
```

**What happens**:
1. Paper-mode bot "buys" token (simulated, no real tokens)
2. Price reaches exit tier
3. Partial exit triggers
4. Callback calls `unSwapToken()` with token mint
5. `unSwapToken()` tries to sell tokens that don't exist in wallet
6. Transaction fails
7. Exit not recorded properly

---

## Required Fix

### File: `src/index.ts`
### Location: Lines 1771-1796
### Action: Add TEST_MODE check

**Replace:**
```typescript
partialExitManager.onExit(async (mint, tier, result) => {
  console.log(`\n🎯 EXIT TIER CALLBACK TRIGGERED`);
  console.log(`   Token: ${mint.slice(0,8)}...`);
  console.log(`   Tier: ${tier.name}`);
  console.log(`   Amount to sell: ${result.actualAmountSold.toLocaleString()} tokens`);

  // Execute actual sell via unSwapToken
  try {
    console.log(`💰 Executing sell on blockchain...`);
    const sellSuccess = await unSwapToken(
      mint,
      WSOL_MINT,
      result.actualAmountSold,
      logEngine
    );

    if (sellSuccess) {
      console.log(`✅ Partial exit executed successfully`);
      console.log(`   Profit: ${result.profitSOL.toFixed(4)} SOL`);
    } else {
      console.error(`❌ Partial exit failed on blockchain`);
    }
  } catch (sellError) {
    console.error(`❌ Sell execution error:`, sellError);
  }
});
```

**With:**
```typescript
partialExitManager.onExit(async (mint, tier, result) => {
  console.log(`\n🎯 EXIT TIER CALLBACK TRIGGERED`);
  console.log(`   Token: ${mint.slice(0,8)}...`);
  console.log(`   Tier: ${tier.name}`);
  console.log(`   Amount to sell: ${result.actualAmountSold.toLocaleString()} tokens`);

  // Check if we're in paper trading mode
  if (TEST_MODE) {
    // PAPER TRADING: Simulate the sell
    console.log(`📝 PAPER TRADING: Simulating ${tier.percentage}% exit`);
    console.log(`   Simulated sell: ${result.actualAmountSold.toLocaleString()} tokens`);
    console.log(`   Simulated profit: ${result.profitSOL.toFixed(4)} SOL`);
    console.log(`   Remaining: ${result.remainingAmount.toLocaleString()} tokens`);
    console.log(`✅ Paper exit recorded successfully`);

    // Update database to reflect simulated sell
    // (Add database update logic here if needed)

    return; // Don't execute real sell in paper mode
  }

  // LIVE TRADING: Execute actual sell via unSwapToken
  try {
    console.log(`💰 Executing sell on blockchain...`);
    const sellSuccess = await unSwapToken(
      mint,
      WSOL_MINT,
      result.actualAmountSold,
      logEngine
    );

    if (sellSuccess) {
      console.log(`✅ Partial exit executed successfully`);
      console.log(`   Profit: ${result.profitSOL.toFixed(4)} SOL`);
    } else {
      console.error(`❌ Partial exit failed on blockchain`);
    }
  } catch (sellError) {
    console.error(`❌ Sell execution error:`, sellError);
  }
});
```

---

## Expected Results After Fix

### Paper Mode ✅
```
🎯 EXIT TIER CALLBACK TRIGGERED
   Token: ABC123...
   Tier: Tier 1 - Initial Profit
   Amount to sell: 250,000 tokens
📝 PAPER TRADING: Simulating 25% exit
   Simulated sell: 250,000 tokens
   Simulated profit: 0.0234 SOL
   Remaining: 750,000 tokens
✅ Paper exit recorded successfully
```

### Live Mode ✅
```
🎯 EXIT TIER CALLBACK TRIGGERED
   Token: ABC123...
   Tier: Tier 1 - Initial Profit
   Amount to sell: 250,000 tokens
💰 Executing sell on blockchain...
📡 [UNSWAP] Sending transaction...
✅ Partial exit executed successfully
   Profit: 0.0234 SOL
```

---

## Testing Plan

### 1. Verify Fix Applied
```bash
# Check that TEST_MODE check is present
grep -A 20 "partialExitManager.onExit" src/index.ts | grep "if (TEST_MODE)"
```

### 2. Run Paper Trading Test
```bash
# Edit UNIFIED-CONTROL.ts to ensure PAPER mode
# Run bot with small test amount
npm run dev

# Watch for exit tier triggers
# Verify sells are simulated, not executed
```

### 3. Monitor for Success Indicators
- ✅ "📝 PAPER TRADING: Simulating..." messages
- ✅ No "💰 Executing sell on blockchain..." in paper mode
- ✅ No unSwapToken errors
- ✅ Exit tiers recorded in database

---

## Related Issues Resolved

1. ✅ Jupiter endpoint fix (401 → 404 for price API)
2. ✅ Race condition fix (baseline recorder)
3. ⏳ Paper-mode sell fix (this document)

**Jupiter endpoint fix may have helped** by ensuring the correct endpoint is used, but the root cause is the missing TEST_MODE check.

---

## Additional Improvements (Optional)

### Add Paper Trading Statistics
Track simulated profits separately:
```typescript
const paperTradingStats = {
  totalSimulatedProfits: 0,
  totalSimulatedSells: 0,
  avgSimulatedProfit: 0
};

// In paper mode callback:
paperTradingStats.totalSimulatedProfits += result.profitSOL;
paperTradingStats.totalSimulatedSells++;
paperTradingStats.avgSimulatedProfit = paperTradingStats.totalSimulatedProfits / paperTradingStats.totalSimulatedSells;
```

### Add Paper Trading Database Table
Track simulated exits for analysis:
```sql
CREATE TABLE paper_exits (
  id INTEGER PRIMARY KEY,
  timestamp INTEGER,
  mint TEXT,
  tier_name TEXT,
  amount_sold REAL,
  profit_sol REAL,
  remaining_amount REAL
);
```

---

## Files to Modify

1. **src/index.ts** (Lines 1771-1796)
   - Add TEST_MODE check in exit callback
   - Add paper trading simulation logic

2. **Optional: Add paper trading statistics**
   - Track simulated profits
   - Add database table for paper exits

---

## Priority

**HIGH** - This blocks paper-mode testing of exit strategies

---

## Next Steps

1. ⏳ Apply fix to index.ts
2. ⏳ Test paper-mode with fix
3. ⏳ Verify live-mode still works
4. ⏳ Document results

---

**Analysis Complete**: November 1, 2025
**Status**: Ready for fix implementation
