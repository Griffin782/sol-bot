# SOL-BOT Jupiter API 429 Error - Root Cause Analysis

**Date:** 2025-11-04
**Bot:** sol-bot-main
**Issue:** Excessive Jupiter Price API calls causing 429 rate limit errors

---

## ✅ STATUS: RESOLVED

**Fix Completed:** 2025-11-04
**Changes Applied:** See `JUPITER-API-FIX-COMPLETED.md` for implementation details
**Result:** Zero Jupiter API calls for token prices, zero 429 errors

This document remains for historical reference and understanding of the issue.

---

---

## Executive Summary

**ROOT CAUSE FOUND:** The bot is running TWO price monitoring systems simultaneously:
1. gRPC PositionMonitor (on-chain, real-time) ✅ **Should be used**
2. Jupiter API polling loop (off-chain, every 2s) ❌ **Should NOT be used**

The Jupiter polling loop is **redundant and unnecessary** because the gRPC PositionMonitor already provides real-time prices from on-chain swap events.

---

## Evidence

### 1. Jupiter API Price Fetching Function

**File:** `src/utils/handlers/jupiterHandler.ts`
**Lines:** 380-448

```typescript
export async function getCurrentTokenPrice(tokenMint: string): Promise<number> {
  try {
    // Line 386 - This log matches the screenshot!
    console.log(`💰 [PRICE] Fetching price for ${tokenMint.slice(0, 8)}...`);

    // Line 390 - Jupiter API call
    const jupiterEndpoint = process.env.JUPITER_ENDPOINT || 'https://lite-api.jup.ag';
    const response = await axios.get(`${jupiterEndpoint}/price/v2`, {
      params: {
        ids: tokenMint
      },
      timeout: 5000
    });

    // ... price processing ...

    // Line 435 - Error log that matches screenshot
    console.error(
      `❌ [PRICE] Jupiter Price API error (${error.response?.status || 'unknown'}):`,
      error.response?.statusText || error.message
    );
```

**This function calls Jupiter Price API v2 for token prices.**

### 2. Polling Loop Calling Jupiter API

**File:** `src/index.ts`
**Lines:** 975-1013

```typescript
// Line 975-1000 - Monitoring loop
if (trackedPositions.length > 0) {
  console.log(`\n💎 Checking ${trackedPositions.length} position(s) for exit tiers...`);

  for (const position of trackedPositions) {
    // Line 980 - THE PROBLEM: Calling Jupiter API in loop
    const currentPrice = await getCurrentTokenPrice(position.mint);

    // Skip if price fetch failed
    if (currentPrice === 0) {
      console.warn(`⚠️ Skipping price update for ${position.mint.slice(0,8)}... (price unavailable)`);
      continue;
    }

    // Update price and check if any tiers should trigger
    const exitResults = await partialExitManager.updatePrice(
      position.mint,
      currentPrice
    );
  }
}

// Line 1012 - Runs on interval
setTimeout(monitorPositions, WALLET_MONITOR_INTERVAL);
```

**Frequency:** Every `WALLET_MONITOR_INTERVAL` (10 seconds by default)
**Problem:** If monitoring 10 positions = 10 Jupiter API calls every 10 seconds = **60 calls/minute**

This exceeds the free tier limit of ~10 requests/minute, causing 429 errors.

### 3. gRPC PositionMonitor (Already Exists!)

**File:** `src/monitoring/positionMonitor.ts`
**Lines:** 1-100

```typescript
/**
 * Position Monitor - Phase 4 COMPLETION
 *
 * Real-time price monitoring for bought positions via gRPC
 * This is the MISSING PIECE that enables near-instant exit signals
 *
 * Features:
 * - Subscribes to pool accounts for bought tokens
 * - Monitors swap transactions for price updates
 * - Extracts price from transaction data (no API calls)  ← KEY POINT!
 * - Updates exit strategy with real-time prices
 * - <400ms latency from swap to exit signal
 */

export class PositionMonitor {
  private monitoredPositions: Map<string, MonitoredPosition> = new Map();
  private currentPrices: Map<string, PositionPrice> = new Map();
  private grpcClient: Client | null = null;
  private grpcStream: ClientDuplexStream<SubscribeRequest, SubscribeUpdate> | null = null;
  private priceUpdateCallback: ((mint: string, priceUSD: number) => void) | null = null;

  // ... gRPC subscription and price parsing logic ...
}
```

**Features:**
- ✅ gRPC subscription to pool accounts
- ✅ Parses swap transactions for price updates
- ✅ NO external API calls
- ✅ <400ms latency (vs 2-10 second polling)

### 4. PositionMonitor IS Started

**File:** `src/index.ts`
**Lines:** 1183-1211

```typescript
// Line 1183 - Instantiated
globalPositionMonitor = new PositionMonitor(
  GRPC_HTTP_URI,
  GRPC_AUTH_TOKEN,
  solPrice
);

// Line 1190 - Callback set for real-time price updates
globalPositionMonitor.onPriceUpdate(async (mint, priceUSD) => {
  // Trigger exit strategy check on price updates
  if (partialExitManager) {
    try {
      const currentPrice = priceUSD / solPrice;  // Convert to SOL
      const exitResults = await partialExitManager.updatePrice(mint, currentPrice);

      if (exitResults.length > 0) {
        console.log(`   🎯 Exit tier triggered by real-time price update!`);
      }
    } catch (error) {
      console.warn('⚠️ Error processing real-time price update:', error);
    }
  }
});

// Line 1207 - STARTED
await globalPositionMonitor.start();
logEngine.writeLog(`👁️ Position Monitor`, `Real-time price tracking ACTIVE (${solPrice} SOL/USD)`, "blue", true);
```

**Status:** ✅ Active and running

---

## The Problem: Dual Systems

### System 1: gRPC PositionMonitor (GOOD)

```
gRPC Stream → Swap Event → Parse Price → Callback → partialExitManager.updatePrice()
                ↑
         Real-time (<400ms)
         No API calls
         No rate limits
```

### System 2: Jupiter API Polling (BAD)

```
Polling Loop → getCurrentTokenPrice() → Jupiter API → partialExitManager.updatePrice()
     ↑                                        ↑
Every 10 seconds                      HTTP request
Multiple positions                    Rate limited
Redundant!                           Causes 429 errors
```

---

## Why Both Systems Exist

Looking at the code history, it appears:

1. **Originally:** Bot used Jupiter API polling (System 2)
2. **Later:** gRPC PositionMonitor was added (System 1) to improve speed
3. **Problem:** Old Jupiter polling loop was never removed

The comment on line 197 confirms this:
```typescript
// ✅ VIP2 INTEGRATION: Position Monitor for real-time price tracking
let globalPositionMonitor: PositionMonitor | null = null;
```

"VIP2 INTEGRATION" suggests the PositionMonitor was added from the VIP-SolanaTokenSniper2 bot, but the old Jupiter polling wasn't removed.

---

## Impact Analysis

### Current State (Both Systems Running)

| Metric | Value |
|--------|-------|
| Price update latency | 2-10 seconds (limited by polling) |
| API calls per minute | 60+ (causes 429 errors) |
| System complexity | High (two systems doing same thing) |
| Exit signal accuracy | Degraded (polling delay) |

### Ideal State (gRPC Only)

| Metric | Value |
|--------|-------|
| Price update latency | <400ms (real-time) |
| API calls per minute | 0 (on-chain only) |
| System complexity | Low (single source of truth) |
| Exit signal accuracy | High (instant updates) |

---

## Solution

### Option 1: Remove Jupiter Polling Loop (RECOMMENDED)

**What to do:**
1. Remove the `monitorPositions()` function that calls `getCurrentTokenPrice()`
2. Rely solely on `globalPositionMonitor.onPriceUpdate()` callback
3. The gRPC PositionMonitor already triggers `partialExitManager.updatePrice()`

**Benefits:**
- ✅ No Jupiter API calls for prices
- ✅ Real-time price updates (<400ms)
- ✅ No 429 rate limit errors
- ✅ Simpler codebase

**Implementation:**
```typescript
// DELETE lines 975-1013 in index.ts
// The monitorPositions() function and its setTimeout() call

// KEEP lines 1183-1211 in index.ts
// The globalPositionMonitor initialization and callback
```

### Option 2: Keep Jupiter as Fallback Only

**What to do:**
1. Keep `getCurrentTokenPrice()` function but don't call it in a loop
2. Only use Jupiter API when gRPC price update fails for 10+ seconds
3. Add staleness detection to PositionMonitor (already exists in VIP2 bot)

**Benefits:**
- ✅ Safety net for edge cases
- ✅ Minimal API calls (only when gRPC fails)
- ⚠️ More complex (two code paths)

---

## Comparison with VIP-SolanaTokenSniper2

### VIP-SolanaTokenSniper2 Architecture

```typescript
// positionMonitor.ts line 676 - Fallback ONLY for stale positions
private async fetchPriceFromAPI(mint: string): Promise<number | null> {
  // Uses pump.fun API (NOT Jupiter) as fallback
  const url = `https://frontend-api.pump.fun/coins/${mint}`;
  // ... only called when gRPC hasn't updated for 10+ seconds
}
```

**Key Difference:**
- VIP2 bot: gRPC primary, pump.fun API fallback (rare)
- sol-bot: gRPC primary, Jupiter API polling (constant) ← **THIS IS THE PROBLEM**

---

## Code Locations Summary

| Item | File | Lines | Status |
|------|------|-------|--------|
| **Jupiter Price Function** | `jupiterHandler.ts` | 380-448 | ❌ Called excessively |
| **Polling Loop** | `index.ts` | 975-1013 | ❌ Remove this |
| **PositionMonitor Class** | `positionMonitor.ts` | 1-959 | ✅ Keep this |
| **PositionMonitor Init** | `index.ts` | 1183-1211 | ✅ Keep this |
| **Price Update Callback** | `index.ts` | 1190-1204 | ✅ Keep this |

---

## Recommended Action Plan

### Step 1: Verify PositionMonitor is Working

Check logs for these messages:
```
👁️ Position Monitor: Real-time price tracking ACTIVE
[Position Monitor] Adding {mint} to real-time tracking
✅ [PRICE] {mint}: {price} SOL ($USD)
```

If you see these, the gRPC system is working.

### Step 2: Remove Jupiter Polling Loop

**File:** `src/index.ts`

**Delete lines 975-1013:**
```typescript
// DELETE THIS ENTIRE BLOCK:
        try {
          if (trackedPositions.length > 0) {
            console.log(`\n💎 Checking ${trackedPositions.length} position(s) for exit tiers...`);

            for (const position of trackedPositions) {
              // Get current token price from Jupiter Price API
              const currentPrice = await getCurrentTokenPrice(position.mint);
              // ... rest of polling loop
            }
          }
        } catch (exitError) {
          console.warn('⚠️ Error checking exit tiers:', exitError);
        }
      }

      verifyPositions();

      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('⏳ Rate limiting: 2 second delay added');
    }
  }
  setTimeout(monitorPositions, WALLET_MONITOR_INTERVAL);
```

**Replace with:**
```typescript
        // Position monitoring now handled by globalPositionMonitor
        // via real-time gRPC price updates (line 1190 callback)
      }

      verifyPositions();
    }
  }
```

### Step 3: Test

Run the bot and verify:
1. ✅ No more `💰 [PRICE] Fetching price for...` messages
2. ✅ No more `❌ [PRICE] Jupiter Price API error (429)` errors
3. ✅ Prices still update (via gRPC callback)
4. ✅ Exit tiers still trigger

---

## Verification Checklist

After making changes:

- [ ] No Jupiter API calls in logs for token prices
- [ ] PositionMonitor still starting successfully
- [ ] Price updates still appearing (from gRPC callback)
- [ ] Exit tiers still triggering correctly
- [ ] No 429 rate limit errors
- [ ] Response time improved (<400ms vs 2-10s)

---

## Summary

**Current Problem:**
```
Bot uses BOTH gRPC (good) AND Jupiter polling (bad) simultaneously
→ Redundant API calls
→ 429 rate limit errors
→ Slower price updates
```

**Solution:**
```
Remove Jupiter polling loop
→ Keep only gRPC PositionMonitor
→ Zero API calls for token prices
→ Real-time price updates (<400ms)
→ No rate limit errors
```

**Impact:**
- Code simplification: Delete ~40 lines
- Performance improvement: 2-10s → <400ms
- Cost reduction: 60+ API calls/min → 0
- Reliability: No more 429 errors

---

**The bot architecture is already correct - we just need to remove the old polling code that's no longer needed.**

