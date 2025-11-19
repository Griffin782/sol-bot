# Market Intelligence Baseline Recorder - Fixes Required

**Date**: 2025-11-01
**Session**: Post-Implementation Testing
**Status**: 3 Critical Issues Found

---

## Issue Summary

| Issue | Severity | Impact | Status |
|-------|----------|--------|--------|
| #1: Low Tracking Ratio (37.5%) | 🔴 CRITICAL | Only tracking 3 of 13 detected tokens | Root cause identified |
| #2: Jupiter API 401 Errors | 🔴 CRITICAL | Cannot fetch prices for any token | Root cause identified |
| #3: SQLITE UNIQUE Constraint | 🟡 HIGH | Race condition causes duplicate tracking attempts | Root cause identified |
| #4: ConfigurationEnforcer Errors | 🟢 LOW | Validation warnings (doesn't block tracking) | Cosmetic only |

---

## Issue #1: Low Tracking Ratio (37.5% instead of ~100%)

### Evidence
```
📊 Final Stats: {
  "tokens_detected": 13,
  "tokens_scored": 13,     // All tokens scored
  "tokens_tracked": 3,      // Only 23% tracked
  "tokens_blocked": 0,      // Filtering not blocking
  "database_writes": 12
}

⚠️ WARNING: Low tracking ratio! Check scoring config.
```

### Root Cause
**Race condition in duplicate detection** (market-recorder.ts:329-347)

The duplicate check queries the database BEFORE the first write completes:
1. Token "Tokenkeg" detected (event #1)
2. startTrackingToken() called → DB check → not found → queue write #1
3. Token "Tokenkeg" detected again (event #2, same token multiple times)
4. startTrackingToken() called → DB check → not found (write #1 not committed) → queue write #2
5. Write #1 commits successfully
6. Write #2 fails with UNIQUE constraint error
7. Token appears "tracked" but second write silently fails

**Evidence**:
```
📈 Started tracking: Tokenkeg (Score: 100)  // Write #1
📈 Started tracking: Tokenkeg (Score: 100)  // Write #2
Error flushing write queue: [Error: SQLITE_CONSTRAINT: UNIQUE constraint failed: tokens_tracked.mint]
⏭️ Token Tokenkeg... already being tracked (active)  // Later detections caught
```

### Fix Required

**File**: `market-intelligence/handlers/market-recorder.ts`

**Change 1** - Add in-memory duplicate tracking (before line 70):
```typescript
// Track tokens currently being processed (prevent race conditions)
private tokensBeingTracked: Set<string> = new Set();
```

**Change 2** - Use in-memory check first (replace lines 327-347):
```typescript
private async startTrackingToken(token: DetectedToken, score: TokenScore): Promise<void> {
  // RACE CONDITION FIX: Check in-memory set first (instant)
  if (this.tokensBeingTracked.has(token.mint)) {
    console.log(`⏭️  Token ${token.mint.slice(0, 8)}... already being tracked (in-memory check)`);
    return;
  }

  // BUG FIX: Check if token is already in database (for restarted sessions)
  try {
    const existing = await this.db.get(
      'SELECT mint, tracking_status FROM tokens_tracked WHERE mint = ?',
      [token.mint]
    );

    if (existing) {
      if (existing.tracking_status === 'active') {
        console.log(`⏭️  Token ${token.mint.slice(0, 8)}... already being tracked (database check)`);
        this.tokensBeingTracked.add(token.mint); // Add to in-memory set
        return; // Don't insert duplicate
      } else {
        // Token was previously tracked but exited - this is a re-appearance
        console.log(`🔄 Token ${token.mint.slice(0, 8)}... re-appeared after exit`);
        // Continue with tracking (will update existing record)
      }
    }
  } catch (error) {
    console.warn('Error checking existing token:', error);
    // Continue anyway
  }

  // Mark as being tracked BEFORE database write
  this.tokensBeingTracked.add(token.mint);

  this.stats.tokens_tracked++;
  // ... rest of function
}
```

**Change 3** - Remove from set when tracking stops (add after line 600):
```typescript
// When position exits or stops tracking
this.tokensBeingTracked.delete(mint);
```

**Expected Result**: Tracking ratio should reach ~95-100% (only legitimate filtering blocks tokens)

---

## Issue #2: Jupiter Price API 401 Unauthorized

### Evidence
```
💰 [PRICE] Fetching price for Tokenkeg...
❌ [PRICE] Jupiter Price API error (401): Unauthorized
```
(Repeated hundreds of times - every 1-second price check fails)

### Root Cause
**Missing JUPITER_API_KEY environment variable**

Jupiter Price API v2 (https://api.jup.ag/price/v2) requires authentication for production use. The free tier allows anonymous requests but with severe rate limiting.

**File**: `src/utils/handlers/jupiterHandler.ts:380-447`

The getCurrentTokenPrice() function calls Jupiter API without an API key:
```typescript
const response = await axios.get('https://api.jup.ag/price/v2', {
  params: { ids: tokenMint },
  timeout: 5000
  // ❌ Missing: headers: { 'X-API-KEY': process.env.JUPITER_API_KEY }
});
```

### Fix Required

**Option 1: Add Jupiter API Key (Recommended)**

1. Get API key from Jupiter: https://station.jup.ag/docs/apis/price-api-v2
2. Add to `.env`:
```bash
JUPITER_API_KEY=your_key_here
```

3. **File**: `src/utils/handlers/jupiterHandler.ts`

**Find** (around line 399):
```typescript
const response = await axios.get('https://api.jup.ag/price/v2', {
  params: { ids: tokenMint },
  timeout: 5000
});
```

**Replace with**:
```typescript
const headers: any = {
  'Accept': 'application/json',
  'User-Agent': 'SolBot/5.0'
};

// Add API key if available (increases rate limits)
if (process.env.JUPITER_API_KEY) {
  headers['X-API-KEY'] = process.env.JUPITER_API_KEY;
}

const response = await axios.get('https://api.jup.ag/price/v2', {
  params: { ids: tokenMint },
  headers,
  timeout: 5000
});
```

**Option 2: Use Alternative Price Source (Fallback)**

If Jupiter API key not available, fall back to DexScreener:

```typescript
async function getTokenPriceWithFallback(mint: string): Promise<number> {
  try {
    // Try Jupiter first
    return await getCurrentTokenPrice(mint);
  } catch (error) {
    // Fall back to DexScreener
    const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    const pair = response.data?.pairs?.[0];
    return pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
  }
}
```

**Expected Result**: Price fetching should succeed, enabling proper gain tracking and exit simulation.

---

## Issue #3: SQLITE_CONSTRAINT UNIQUE Violation

### Evidence
```
Error flushing write queue: [Error: SQLITE_CONSTRAINT: UNIQUE constraint failed: tokens_tracked.mint] {
  errno: 19,
  code: 'SQLITE_CONSTRAINT'
}
```

### Root Cause
Same as Issue #1 - race condition in duplicate detection. When same token detected multiple times rapidly, both attempts queue writes before first completes.

### Fix Required
Same fix as Issue #1 (in-memory duplicate tracking set).

**Additional Improvement** - Better error handling in queueWrite:

**File**: `market-intelligence/handlers/market-recorder.ts`

**Find** (around line 523, in flushWriteQueue method):
```typescript
} catch (error) {
  console.error('Error flushing write queue:', error);
  // Re-queue failed writes?
}
```

**Replace with**:
```typescript
} catch (error) {
  // Ignore UNIQUE constraint errors (duplicates are expected)
  if ((error as any).code === 'SQLITE_CONSTRAINT') {
    console.log(`⏭️  Skipping duplicate write for ${(write as any).params?.mint?.slice(0, 8) || 'unknown'}`);
  } else {
    console.error('Error flushing write queue:', error);
    // Re-queue failed writes for non-constraint errors
  }
}
```

**Expected Result**: No more UNIQUE constraint errors in logs, failed duplicates handled gracefully.

---

## Issue #4: ConfigurationEnforcer Validation Errors

### Evidence
```
🔒 ConfigurationEnforcer initialized
❌ [CONFIG-ENFORCER] Configuration validation failed:
   - Position size too large: 15 > 10% of 60
```

### Root Cause
ConfigurationEnforcer is validating TRADING BOT configuration in BASELINE RECORDER context.

The standalone baseline recorder (market-intelligence/standalone-recorder.ts) doesn't use trading configuration, but ConfigurationEnforcer is still being initialized somewhere in the import chain.

### Impact
**NONE** - This is cosmetic only. The baseline recorder doesn't use position sizing or pool limits. The validation errors don't block token tracking.

### Fix Required (Optional)

**File**: `market-intelligence/standalone-recorder.ts`

**Option 1**: Disable ConfigurationEnforcer for baseline mode
```typescript
// At top of file
process.env.SKIP_CONFIG_ENFORCER = 'true';
```

**Option 2**: Ignore the warnings
The baseline recorder works fine despite these warnings. They can be safely ignored.

**Priority**: LOW - Cosmetic only, no functional impact.

---

## Testing Plan

### Test 1: Verify Fix #1 (Tracking Ratio)
```bash
npm run mi-baseline
# Let run for 2 minutes
# Ctrl+C to stop
```

**Expected**:
```
📊 Final Stats: {
  "tokens_detected": 50,
  "tokens_tracked": 48,     // ~96% (some legitimate duplicates)
  "tokens_blocked": 0
}
Tracking Ratio: 96% ✅ (should be ~95-100%)
```

### Test 2: Verify Fix #2 (Price Fetching)
```bash
# After adding JUPITER_API_KEY to .env
npm run mi-baseline
```

**Expected**:
```
💰 [PRICE] Fetching price for Tokenkeg...
✅ [PRICE] Tokenkeg: 0.0000001234 SOL ($0.00002315)
```

No more 401 Unauthorized errors.

### Test 3: Verify Fix #3 (No UNIQUE Errors)
```bash
npm run mi-baseline
# Let run for 2 minutes
```

**Expected**: No "SQLITE_CONSTRAINT" errors in output.

---

## Summary

**Critical Fixes Needed**:
1. ✅ Add in-memory duplicate tracking (fixes tracking ratio + UNIQUE errors)
2. ✅ Add Jupiter API key authentication (fixes price fetching)
3. ⏭️ Optional: Disable ConfigurationEnforcer for baseline mode (cosmetic)

**Estimated Time**: 15 minutes

**Priority**: CRITICAL - Baseline recorder not usable without these fixes

**Next Steps**:
1. Implement Fix #1 (in-memory duplicate tracking)
2. Get Jupiter API key and implement Fix #2
3. Test with `npm run mi-baseline` for 2-5 minutes
4. Verify tracking ratio reaches ~95-100%
5. Verify price fetching works
6. Document final results in session log

---

**End of Report**
