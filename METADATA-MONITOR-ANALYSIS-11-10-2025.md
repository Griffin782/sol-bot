# Metadata Monitor Analysis - November 10, 2025

## CRASH ANALYSIS FROM 11.09 SESSION

### Critical Issue: metadata_monitor Causing Infinite Reconnect Loop

**From Chat History (Lines 1061-1475):**
- Bot crashed after **6 minutes** (not 15 minutes as expected with SQLite)
- Cause: Position Monitor gRPC error creating infinite reconnect loop
- Error: `3 INVALID_ARGUMENT: failed to create filter: String is the wrong size`
- 954 errors logged before crash
- Memory leak: 842MB log file, heap exhausted

### Why This Matters:
The metadata_monitor was **incorrectly implemented** in sol-bot's Position Monitor. It tried to subscribe to ALL accounts owned by the Metaplex Metadata Program, which:
1. **Yellowstone gRPC doesn't support** (too broad)
2. Causes "String is the wrong size" error
3. Creates infinite reconnect loop → memory leak → crash

---

## VIP vs SNIPESPACE: METADATA APPROACHES

### VIP SOLANA TOKEN SNIPER 2

**Location:** `VIP-SolanaTokenSniper2-main/src/utils/managers/grpcManager.ts`

**Approach: TRANSACTION-ONLY SUBSCRIPTION**
```typescript
transactions: {
  sniper: {
    accountInclude: accountInclude,  // Only specific program IDs
    accountExclude: [],
    accountRequired: [],
  },
}
// NO account subscription
// NO metadata monitoring via gRPC
```

**How VIP Handles Metadata:**
1. **Detection:** Subscribe to TRANSACTIONS involving specific programs (Raydium, Pump.fun, etc.)
2. **Metadata Fetching:** On-demand RPC calls when token detected
3. **No Proactive Caching:** Accepts 200-400ms delay for metadata lookups
4. **VIP2 Retry Logic:** 200ms + 100ms + 100ms retries if RPC indexing delayed

**File:** `VIP-SolanaTokenSniper2-main/src/detection/metadataCache.ts`
- Cache exists but only stores AFTER fetching
- No gRPC subscription for metadata
- Simple in-memory Map cache (post-fetch storage)

---

### SNIPESPACE VIP

**Location:** `SnipeSpaceVip-main/src/app/server/managers/grpcManager.ts`

**Approach: TRANSACTION-ONLY SUBSCRIPTION (Same as VIP)**
```typescript
transactions: {
  sniper: {
    accountInclude: accountInclude,  // Program IDs
    accountExclude: [],
    accountRequired: [],
  },
}
```

**How SnipeSpace Handles Metadata:**
1. **Detection:** gRPC transaction stream (like VIP)
2. **Metadata Fetching:** Direct RPC call with retry logic
   - File: `tokenHandler.ts` lines 321-390 (`getTokenMetaData()`)
   - 500ms retry if metadata not found immediately
3. **Manual Buffer Parsing:** Custom metadata parser (lines 31-79)
4. **Position Monitoring:** Polling-based (NOT gRPC real-time)
   - File: `positionsMonitor.ts`
   - Polls every 1 second via database queries
   - **NO gRPC subscription for price updates**

**Key Difference from sol-bot:**
- SnipeSpace does **NOT use gRPC** for position monitoring at all
- Uses interval polling (1s) checking database positions
- Simpler but slower exit signals (~1s latency vs <400ms)

---

## SOL-BOT APPROACH (CURRENT BROKEN STATE)

**Location:** `VIP-Sol-Sniper2/VIP-SolanaTokenSniper2-main/src/monitoring/positionMonitor.ts`

**Attempted Approach: TRANSACTION + ACCOUNT + METADATA SUBSCRIPTION**
```typescript
// Lines 260-264 - THE PROBLEM:
metadata_monitor: {
  account: [],
  owner: [MPL_TOKEN_METADATA_PROGRAM_ID],  // ❌ TOO BROAD!
  filters: [],
}
```

**Why This Failed:**
1. **owner: [MPL_TOKEN_METADATA_PROGRAM_ID]** = Subscribe to ALL accounts owned by metadata program
2. Metadata program owns **millions of accounts** (every SPL token metadata)
3. Yellowstone gRPC rejects this: "String is the wrong size" error
4. Bot enters reconnect loop → crashes

**Sol-bot's Hybrid Strategy (When Working):**
1. **Token Detection:** gRPC transaction stream (works ✅)
2. **Position Monitoring:** gRPC account + transaction subscription (broken ❌)
3. **Metadata Caching:** Attempted via gRPC account subscription (broken ❌)

---

## TRANSACTION VS ACCOUNT SUBSCRIPTION: PERFORMANCE COMPARISON

### TRANSACTION SUBSCRIPTION

**What It Monitors:**
- All transactions involving specified accounts/programs
- Examples: Raydium AMM, Pump.fun, Pumpswap programs

**Performance:**
- **Latency:** ~100-300ms (block production time)
- **Bandwidth:** Moderate (only when activity occurs)
- **Scalability:** ✅ Good - Yellowstone efficiently filters transactions
- **Use Case:** Token detection, swap monitoring

**Pros:**
- ✅ Works reliably for monitoring program activity
- ✅ Low latency for new token detection
- ✅ Proven approach (VIP, SnipeSpace both use this)

**Cons:**
- ❌ Only fires when transactions occur
- ❌ For position monitoring: No updates during low-volume periods
- ❌ Must parse transaction data to extract prices

---

### ACCOUNT SUBSCRIPTION (SPECIFIC ACCOUNTS)

**What It Monitors:**
- Specific account addresses (e.g., pool accounts, bonding curves)
- Account state changes (balance updates, data changes)

**Performance:**
- **Latency:** ~100-400ms (block production time)
- **Bandwidth:** Low-Moderate (updates every block if account changes)
- **Scalability:** ✅ Good for <100 accounts
- **Use Case:** Position monitoring, continuous price updates

**Pros:**
- ✅ Continuous updates even with no swaps (bonding curve accounts)
- ✅ Lower latency than polling (updates every block ~400ms)
- ✅ Works for specific account lists

**Cons:**
- ❌ Must know account addresses in advance
- ❌ Can't subscribe to "all accounts owned by program" (too broad)

---

### ACCOUNT SUBSCRIPTION (BY OWNER - BROKEN)

**What Sol-bot Attempted:**
```typescript
owner: [MPL_TOKEN_METADATA_PROGRAM_ID]  // ❌ TOO BROAD
```

**Why This Doesn't Work:**
- **Volume:** Metadata program owns millions of accounts
- **Bandwidth:** Would require streaming ALL metadata updates
- **Yellowstone Limitation:** Rejects overly broad subscriptions
- **Result:** "String is the wrong size" error → infinite reconnect loop

**Speed Comparison (If It Worked):**
- Would be **faster than RPC calls** (real-time updates vs polling)
- BUT: **IMPOSSIBLE** - gRPC won't allow it

---

## HOW MUCH SLOWER IS TRANSACTION-ONLY?

### For Token Detection (First Stage):
- **Transaction Subscription:** ~100-300ms latency ✅
- **Account Subscription:** Not applicable (don't know addresses yet)
- **Winner:** Transaction subscription (only option that works)

### For Position Monitoring (After Buy):
- **Transaction Only (VIP/SnipeSpace):** Updates only when swaps occur
  - Active token: ~1-5 seconds between updates ✅
  - Dead token: No updates (stuck with stale price) ❌
- **Account + Transaction (sol-bot goal):** Continuous updates
  - Active token: ~400ms updates (every block) ✅✅
  - Dead token: Still updates (bonding curve state) ✅
- **Polling (SnipeSpace):** 1 second interval
  - Always 1s latency ⚠️

### For Metadata Fetching:
- **On-demand RPC (VIP/SnipeSpace):** 200-400ms ⚠️
- **Proactive gRPC Cache (sol-bot attempted):** 0ms (instant) ✅ **BUT DOESN'T WORK** ❌

---

## SNIPESPACE SOLUTION EXTRACTION

### What We Can Learn from SnipeSpace:

**1. They DON'T Use Metadata Caching:**
   - File: `tokenHandler.ts` line 321-390
   - Direct RPC call: `getAccountInfo(metadataPDA)`
   - Retry after 500ms if not found
   - **No gRPC subscription attempt**

**2. Simple Position Monitoring:**
   - File: `positionsMonitor.ts`
   - Polling-based: Check positions every 1 second
   - Query database for open positions
   - Calculate PNL from cached prices
   - **NO gRPC real-time monitoring**

**3. Their Approach:**
```typescript
// Start monitoring every 1s
setInterval(async () => {
  const positions = await getLivePositionsByState();
  // Check TP/SL triggers
  for (const position of positions) {
    if (position.pnl >= takeProfit || position.pnl <= -stopLoss) {
      await closeTokenPosition(position.mint);
    }
  }
}, 1000);  // 1 second interval
```

**Can This Help Sol-Bot?**
- **NO** for position monitoring (sol-bot's gRPC approach is superior when working)
- **YES** for metadata fetching (just use RPC calls, don't cache proactively)

---

## RECOMMENDED SOLUTION FOR SOL-BOT

### FIX 1: Remove metadata_monitor Entirely (URGENT)

**File:** `src/monitoring/positionMonitor.ts` lines 260-264

**REMOVE THIS:**
```typescript
metadata_monitor: {
  account: [],
  owner: [MPL_TOKEN_METADATA_PROGRAM_ID],  // ❌ CAUSES CRASH
  filters: [],
}
```

**Why:**
- Metadata caching via gRPC is **not possible** with Yellowstone
- Causes infinite reconnect loop and crash
- VIP and SnipeSpace both work fine without it

---

### FIX 2: Keep Transaction + Account Monitoring (For Positions)

**KEEP THIS (It Works):**
```typescript
accounts: {
  pool_monitor: {
    account: poolAddresses,  // ✅ Specific addresses (works)
    owner: [],
    filters: [],
  },
  bonding_curve_monitor: {
    account: bondingCurveAddresses,  // ✅ Specific addresses (works)
    owner: [],
    filters: [],
  }
},
transactions: {
  swap_monitor: {
    accountInclude: poolAddresses,  // ✅ Specific addresses (works)
    ...
  },
}
```

**Why:**
- Monitoring **specific** accounts works fine
- Provides continuous price updates for positions
- Superior to polling (SnipeSpace's approach)

---

### FIX 3: Use On-Demand Metadata Fetching (Like VIP/SnipeSpace)

**Current (Broken):**
- Attempt to cache metadata proactively via gRPC
- Doesn't work, causes crash

**Solution:**
- Use RPC calls when metadata needed
- Accept 200-400ms delay
- Use VIP2 retry logic (already implemented)

**File:** `src/detection/metadataCache.ts`
- Keep the cache for **storage** (post-fetch)
- Remove gRPC subscription attempt
- Fetch on-demand via RPC

---

## COMPARISON SUMMARY

| Feature | VIP | SnipeSpace | Sol-Bot (Goal) | Sol-Bot (Current) |
|---------|-----|------------|----------------|-------------------|
| **Token Detection** | gRPC Tx | gRPC Tx | gRPC Tx | gRPC Tx ✅ |
| **Position Monitoring** | Tx Only | Polling (1s) | gRPC Acct+Tx | ❌ Broken |
| **Metadata Fetching** | RPC On-demand | RPC On-demand | gRPC Cache | ❌ Broken |
| **Detection Speed** | ~200ms | ~200ms | ~200ms | ✅ Works |
| **Exit Signal Speed** | 1-5s (active) | 1s (polling) | <400ms (target) | ❌ Crash |
| **Metadata Speed** | 200-400ms | 200-400ms | 0ms (target) | ❌ Crash |
| **Stability** | ✅ Stable | ✅ Stable | ❌ 6min Crash | ❌ Crash |

---

## ARCHITECTURE FLOW COMPARISON

### VIP DETECTION/MONITORING FLOW:
```
1. gRPC Tx Stream (Raydium/Pump programs)
     ↓
2. Parse transaction → Extract mint address
     ↓
3. RPC call → Fetch metadata (200-400ms)
     ↓
4. Check authorities → Buy token
     ↓
5. After buy: Transaction-only monitoring (1-5s updates)
     ↓
6. Exit strategy polls prices → Triggers sell
```

### SNIPESPACE DETECTION/MONITORING FLOW:
```
1. gRPC Tx Stream (Program IDs)
     ↓
2. Parse transaction → Extract mint address
     ↓
3. RPC call → Fetch metadata with 500ms retry
     ↓
4. Security checks (RugCheck API optional)
     ↓
5. Buy token
     ↓
6. Polling monitor (1s interval) → Check positions in DB
     ↓
7. If TP/SL triggered → Sell
```

### SOL-BOT DETECTION/MONITORING FLOW (INTENDED):
```
1. gRPC Tx Stream (Programs) ✅
     ↓
2. Parse transaction → Extract mint address ✅
     ↓
3. gRPC Metadata Cache → Instant lookup (0ms) ❌ BROKEN
     ↓
4. Check authorities → Buy token ✅ (with VIP2 retry)
     ↓
5. gRPC Account + Tx Monitoring (<400ms updates) ❌ BROKEN
     ↓
6. Exit strategy → Triggers sell ✅ (when monitoring works)
```

---

## SNIPESPACE SPECIFIC IMPLEMENTATION DETAILS

### Token Detection:
**File:** `src/app/server/managers/grpcManager.ts`
- Lines 216-237: `createSubscribeRequest()`
- Subscribes to transaction stream only
- `accountInclude`: Array of program IDs to monitor
- Uses `processed` commitment level

### Token Handler:
**File:** `src/app/server/handlers/tokenHandler.ts`
- Lines 81-144: `getTokenAuthorities()` - Authority check (like VIP)
- Lines 321-390: `getTokenMetaData()` - RPC metadata fetch with 500ms retry
- Lines 31-79: `parseTokenMetadata()` - Manual buffer parsing

### Position Monitoring:
**File:** `src/app/server/services/positionsMonitor.ts`
- Lines 41-57: `startAutoSellMonitor()` - Starts 1s interval
- Lines 89-147: `monitorPositions()` - Polls database for positions
- Lines 112-143: Check PNL vs TP/SL, trigger close if needed

**Key Insight:**
- SnipeSpace does NOT use gRPC for position monitoring
- Simple polling approach: Check DB every 1s
- Less efficient but **bulletproof stable**

---

## KEY DIFFERENCES BETWEEN BOTS

### Detection Strategy:
- **VIP & SnipeSpace:** Transaction-only (proven stable)
- **Sol-Bot:** Transaction-only (same, works ✅)

### Position Monitoring:
- **VIP:** Transaction-only (1-5s updates when active)
- **SnipeSpace:** Database polling (1s interval)
- **Sol-Bot:** gRPC Account + Transaction (continuous <400ms) **BUT BROKEN**

### Metadata Approach:
- **VIP & SnipeSpace:** On-demand RPC (200-400ms delay)
- **Sol-Bot:** Attempted proactive gRPC caching **DOESN'T WORK**

### Performance Philosophy:
- **VIP/SnipeSpace:** Prioritize **stability** over absolute speed
- **Sol-Bot:** Attempted to prioritize **speed** → caused instability

---

## SUBSCRIBING TO TRANSACTIONS VS ALL ACCOUNTS: SPEED ANALYSIS

### Transaction Subscription Speed:
**Latency:** ~100-300ms from swap to detection
- Block time: ~400ms
- gRPC stream: ~50-100ms network
- Parse transaction: ~10-50ms
- **Total: ~200ms typical**

### Account Subscription Speed (Specific Accounts):
**Latency:** ~100-400ms from state change to update
- Block time: ~400ms
- gRPC stream: ~50-100ms network
- Account update: Immediate (every block if changed)
- **Total: ~400ms typical**

### Account Subscription (ALL Accounts by Owner):
**Would Be:** Real-time (~400ms like specific accounts)
**Reality:** **DOESN'T WORK** - gRPC rejects it
- Too much bandwidth required
- Yellowstone gRPC limitation
- Results in error: "String is the wrong size"

### Comparison Table:

| Method | Latency | Bandwidth | Yellowstone Support | Use Case |
|--------|---------|-----------|---------------------|----------|
| Transaction Sub | ~200ms | Moderate | ✅ Yes | Token detection |
| Account Sub (Specific) | ~400ms | Low | ✅ Yes | Position monitoring |
| Account Sub (By Owner) | N/A | Extreme | ❌ **NO** | ❌ Impossible |
| RPC Polling | 1000ms+ | Low | ✅ Yes | Fallback only |

---

## FINAL RECOMMENDATIONS

### Immediate Actions:

1. **REMOVE metadata_monitor from Position Monitor** (URGENT)
   - File: `src/monitoring/positionMonitor.ts` lines 260-264
   - This is causing the 6-minute crash

2. **Keep position monitoring with specific accounts** (WORKING)
   - File: Same file, keep pool_monitor and bonding_curve_monitor
   - These subscriptions work fine

3. **Use on-demand metadata fetching** (Like VIP/SnipeSpace)
   - File: `src/utils/handlers/tokenHandler.ts`
   - VIP2 retry logic already implemented ✅
   - Accept 200-400ms delay (trade-off for stability)

### Performance Trade-offs:

**With Fix:**
- ✅ Token detection: ~200ms (no change)
- ✅ Position monitoring: <400ms continuous (RESTORED)
- ⚠️ Metadata fetching: 200-400ms (slower but stable)
- ✅ Bot stability: No crashes ✅

**Alternative (SnipeSpace approach):**
- Use polling for position monitoring (1s interval)
- Simpler but slower exit signals
- **NOT RECOMMENDED** - sol-bot's gRPC monitoring is better

---

## CONTEXT FILE UPDATE SUMMARY

**Files That Need Context Updates:**

1. **METADATA-MONITOR-STATUS.md** - Add "SOLUTION: Remove owner filter"
2. **POSITION-MONITOR-ERROR-ANALYSIS.md** - Update with comparison to SnipeSpace
3. **GRPC-METADATA-CACHE-SOLUTION.md** - Mark as "DEPRECATED - Use RPC instead"

**New Understanding:**
- Metadata caching via gRPC **is not possible** with Yellowstone
- VIP and SnipeSpace both use on-demand RPC fetching
- Sol-bot should follow the same proven approach
- Position monitoring via gRPC **works** (keep it, just remove metadata part)

---

## CONCLUSION

### The metadata_monitor Issue:

**Root Cause:** Attempting to subscribe to ALL accounts owned by metadata program

**Why It Failed:** Yellowstone gRPC doesn't support overly broad subscriptions

**Solution:** Remove the metadata_monitor, use on-demand RPC like VIP/SnipeSpace

**Speed Impact:** Metadata fetching will be 200-400ms slower, but **bot won't crash**

### SnipeSpace as Reference:

**NOT a solution for metadata caching** (they don't cache either)

**Useful insight:** Simple polling approach works but sol-bot's gRPC monitoring is superior

**Key takeaway:** Prioritize stability over marginal speed gains

### Next Steps:

1. ✅ Remove metadata_monitor from Position Monitor (FIX 1)
2. ✅ Test bot runs >20 minutes without crash
3. ✅ Update context files with findings
4. ✅ Document that metadata caching via gRPC is not viable
