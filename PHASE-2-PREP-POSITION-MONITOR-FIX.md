# Phase 2: Position Monitor gRPC Fix - PREPARATION

**Date**: November 9, 2025
**Error**: `Error: 3 INVALID_ARGUMENT: failed to create filter: String is the wrong size`
**Status**: 📋 **ANALYSIS COMPLETE - READY TO IMPLEMENT**

---

## 🔍 ROOT CAUSE IDENTIFIED

### The Error Location:
**File**: `src/monitoring/positionMonitor.ts`
**Function**: `updateSubscription()` (line 227) and `setupSubscription()` (line 315)
**Problem**: Account addresses not formatted correctly for gRPC filter

### The Issue:

In `updateSubscription()` (lines 243-264):
```typescript
accounts: {
  pool_monitor: {
    account: poolAddresses,  // ← Array of base58 strings
    owner: [],
    filters: [],
  },
  bonding_curve_monitor: {
    account: bondingCurveAddresses,  // ← Array of base58 strings
    owner: [],
    filters: [],
  },
  metadata_monitor: {
    account: [],
    owner: [MPL_TOKEN_METADATA_PROGRAM_ID],  // ← May be wrong format
    filters: [],
  },
},
```

### Why It Fails:

**Yellowstone gRPC expects**:
- Account addresses as **base58 strings** (correct format)
- Owner addresses as **base58 strings** (correct format)
- BUT: The `MPL_TOKEN_METADATA_PROGRAM_ID` import from `@metaplex-foundation/mpl-token-metadata` returns a **PublicKey object**, not a string!

### Evidence from VIP Code:

VIP-Sol-Sniper2 uses **strings directly** (grpcManager.ts:11-14):
```typescript
let accountInclude = dataStreamPrograms
  .filter((program) => program.enabled)
  .map((program) => program.key);  // ← Already strings
```

---

## 🎯 THE FIX

### Location 1: `updateSubscription()` (Line 262)

**Before** (Line 262):
```typescript
owner: [MPL_TOKEN_METADATA_PROGRAM_ID],
```

**After**:
```typescript
owner: [MPL_TOKEN_METADATA_PROGRAM_ID.toString()],
// OR more explicitly:
owner: [new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID).toBase58()],
```

### Location 2: Verify Pool Addresses (Line 237-240)

**Current** (Lines 237-240):
```typescript
const poolAddresses = positions.map(p => p.poolAddress);
const bondingCurveAddresses = Array.from(this.bondingCurveAddresses.values());
```

**Verify**: These should already be base58 strings, but we should add validation:
```typescript
// Ensure all addresses are base58 strings (not PublicKey objects)
const poolAddresses = positions.map(p =>
  typeof p.poolAddress === 'string'
    ? p.poolAddress
    : p.poolAddress.toBase58()
);

const bondingCurveAddresses = Array.from(this.bondingCurveAddresses.values()).map(addr =>
  typeof addr === 'string'
    ? addr
    : addr.toBase58()
);
```

### Location 3: Same fix in `setupSubscription()` (Line 315)

The same issue exists in the initial `setupSubscription()` call at startup.

---

## 📝 IMPLEMENTATION STEPS

### Step 1: Fix `updateSubscription()` Function
- Line 262: Convert `MPL_TOKEN_METADATA_PROGRAM_ID` to string
- Lines 237-240: Add address format validation

### Step 2: Fix `setupSubscription()` Function
- Same changes as Step 1
- Ensure consistency

### Step 3: Test
- Start bot
- Add a position to monitoring
- Verify no "String is the wrong size" error
- Confirm gRPC stream stays active
- Verify real-time price updates work

---

## ✅ EXPECTED RESULTS

### Before Fix:
```
[Position Monitor] Adding 7jKxn5Qp... to real-time tracking
[Position Monitor] Updated subscription: 1 pools + 1 bonding curves
[Position Monitor] Stream error: Error: 3 INVALID_ARGUMENT:
  failed to create filter: String is the wrong size
[Position Monitor] Stream ended - reconnecting in 5 seconds...
```

### After Fix:
```
[Position Monitor] Adding 7jKxn5Qp... to real-time tracking
[Position Monitor] Updated subscription: 1 pools + 1 bonding curves
[Position Monitor] Bonding curve update for 7jKxn5Qp...: $0.00000234
✅ Real-time price updates working (<400ms latency)
```

---

## 📊 TECHNICAL DETAILS

### Why This Error Occurs:

1. **gRPC Protobuf Format**:
   - Yellowstone gRPC uses Protocol Buffers
   - Account addresses must be **base58-encoded strings**
   - Length must be exactly 32 bytes (44 characters in base58)

2. **PublicKey Object**:
   - `MPL_TOKEN_METADATA_PROGRAM_ID` is a `PublicKey` object
   - Has `.toBase58()` method to convert to string
   - Passing object directly → gRPC sees it as `[object Object]` → "wrong size"

3. **Filter Validation**:
   - gRPC server validates filter before accepting subscription
   - Invalid format → immediate `INVALID_ARGUMENT` error
   - Stream disconnects and tries to reconnect (infinite loop)

### Why VIP Doesn't Have This Issue:

- VIP only subscribes to **transactions** (not accounts)
- Uses `accountInclude` in transactions (accepts strings)
- Doesn't subscribe to metadata accounts via `owner` filter

---

## 🎯 SUCCESS CRITERIA

After applying fix:

1. ✅ **No gRPC stream errors** when adding positions
2. ✅ **Subscription stays active** (no reconnect loop)
3. ✅ **Real-time price updates** appear in logs
4. ✅ **Exit signals fire within 1 second** (not 10 seconds)
5. ✅ **Bonding curve updates** every ~400ms

---

## 🔧 ADDITIONAL VERIFICATION

### Check if addresses are properly formatted:

Add debug logging before subscription:
```typescript
console.log('[Position Monitor] Pool addresses:', poolAddresses);
console.log('[Position Monitor] Pool address types:',
  poolAddresses.map(a => typeof a));
console.log('[Position Monitor] Pool address lengths:',
  poolAddresses.map(a => a.length));
console.log('[Position Monitor] Metadata owner:',
  MPL_TOKEN_METADATA_PROGRAM_ID);
console.log('[Position Monitor] Metadata owner type:',
  typeof MPL_TOKEN_METADATA_PROGRAM_ID);
```

**Expected output**:
```
[Position Monitor] Pool addresses: ['Dp8jqsz95ZEvvuyTg4oda3P8SYKTYhYbaqvrtxykPgXE']
[Position Monitor] Pool address types: ['string']
[Position Monitor] Pool address lengths: [44]
[Position Monitor] Metadata owner: metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
[Position Monitor] Metadata owner type: string
```

---

## 📋 FILES TO MODIFY

1. **`src/monitoring/positionMonitor.ts`**
   - Line 262: Fix metadata owner in `updateSubscription()`
   - Lines 237-240: Add address validation
   - Line ~347: Fix metadata owner in `setupSubscription()`
   - Lines ~325-328: Add address validation

**Total**: ~10-15 lines of code changes

---

## ⏱️ ESTIMATED TIME

- **Implementation**: 10-15 minutes
- **Testing**: 5-10 minutes
- **Total**: 20-25 minutes

---

## 🔄 DEPENDENCY

**BLOCKED BY**: Phase 1 test completion
- Must verify SQLite fix works first
- Can't test Position Monitor if bot crashes after 15 min
- Phase 2 starts AFTER Phase 1 test passes

---

## 💡 COMPARISON TO VIP

### VIP Approach (Simple):
```typescript
transactions: {
  sniper: {
    accountInclude: accountInclude,  // Strings only
    accountExclude: [],
    accountRequired: [],
  },
}
```

### Sol-Bot Approach (Advanced):
```typescript
accounts: {
  pool_monitor: { account: [...] },      // Real-time pool monitoring
  bonding_curve_monitor: { account: [...] },  // Continuous price updates
  metadata_monitor: { owner: [...] },     // Metadata caching
},
transactions: {
  swap_monitor: { accountInclude: [...] },  // Swap detection
}
```

**Sol-Bot is MORE advanced** (dual monitoring: accounts + transactions)
**But requires proper format conversion** (PublicKey → string)

---

## 📞 READY TO IMPLEMENT

**Status**: Analysis complete, fix identified, ready to code
**Waiting for**: Phase 1 test to complete (20+ min runtime)
**Next action**: Implement fix once Phase 1 passes

---

**Document Created**: 4:10 PM, November 9, 2025
**Phase 1 Test Started**: ~3:58 PM
**Phase 1 Critical Point**: ~4:13 PM (15 minutes)
**Phase 1 Target**: ~4:18 PM (20 minutes)
