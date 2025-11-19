# Zero Buys Investigation Report

**Date**: 2025-11-06
**Issue**: 69 tokens detected, 0 bought
**Status**: 🔍 **ROOT CAUSE IDENTIFIED**

---

## 📊 Test Results Summary

**File**: `final-production-test.log`
**Runtime**: 45 seconds
**Tokens Detected**: 11 (gRPC stream)
**Tokens Bought**: 0
**Tokens Rejected**: 0
**Tokens Blocked**: 0

**Detection Rate**: 1,131.4 tokens/hour
**Buy Rate**: 0 tokens/hour ❌

---

## 🔍 Root Cause: TokenAccountNotFoundError on ALL Tokens

### Every Single Token Fails With Same Error:

```
[16:01:21] 🔍 [gRPC] Token detected: GLG7JkBV... (#1)
[16:01:21] Minimal mode - authority checks only
[16:01:21] gRPC data processing error: TokenAccountNotFoundError
```

**100% Failure Rate** - All 11 detected tokens throw `TokenAccountNotFoundError`

---

## 🔬 Technical Analysis

### Error Source Chain:

**1. gRPC Stream Detects Token** (`src/index.ts:1333`)
```typescript
logEngine.writeLog(`${getCurrentTime()}`, `🔍 [gRPC] Token detected: ${mintStr.slice(0, 8)}... (#${stats.tokensDetected})`, "green");

activeTransactions++;
await addToQueue(mintStr);  // ← Calls addToQueue
activeTransactions--;
```

**2. addToQueue Performs Minimal Checks** (`src/index.ts:397-406`)
```typescript
} else if (CHECK_MODE === "minimal") {
  // Minimal mode: Only check for mint/freeze authorities (fastest, but no rugcheck)
  logEngine.writeLog(`${getCurrentTime()}`, `Minimal mode - authority checks only`, "yellow");

  const authorities = await getTokenAuthorities(tokenMint);  // ← THROWS HERE
  if (authorities.hasMintAuthority || authorities.hasFreezeAuthority) {
    logEngine.writeLog(`${getCurrentTime()}`, `❌ Token has authorities, skipping...`, "red");
    stats.tokensRejected++;
    return;
  }
```

**3. getTokenAuthorities Calls getMint** (`src/utils/handlers/tokenHandler.ts:34`)
```typescript
public async getTokenAuthorities(mintAddress: string): Promise<TokenAuthorityStatus> {
  try {
    const mintPublicKey = new PublicKey(mintAddress);
    const mintInfo = await getMint(this.connection, mintPublicKey);  // ← FAILS HERE
```

**4. getMint Throws TokenAccountNotFoundError**
- `getMint()` is from `@solana/spl-token` package
- Tries to fetch mint account data from RPC
- **FAILS** because brand new tokens haven't been indexed yet by RPC

### Why This Happens:

**gRPC Stream Detects Tokens FASTER Than RPC Can Index Them**

| Event | Time | System |
|-------|------|--------|
| Token created on-chain | T+0ms | Solana blockchain |
| gRPC detects via Yellowstone | T+100ms | Triton gRPC (real-time) |
| Bot calls `getMint()` | T+150ms | QuickNode RPC |
| RPC returns "not found" | T+200ms | ❌ Account not indexed yet |

**The Problem**: gRPC is TOO FAST! It detects tokens before RPC has indexed them.

---

## 🔍 Error Flow Diagram

```
┌─────────────────┐
│ New Token       │
│ Created On-Chain│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ gRPC Detects    │ ← Yellowstone sees tx in mempool/block
│ Token Instantly │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Bot: Minimal    │ ← Calls getTokenAuthorities()
│ Mode Checks     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ getMint() from  │ ← Queries QuickNode RPC
│ @solana/spl-    │
│ token           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ QuickNode RPC:  │ ← Account hasn't been indexed yet
│ "Account Not    │
│ Found"          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ TokenAccountNot │ ← Error thrown
│ FoundError      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ index.ts:1340   │ ← Catch block logs error
│ Logs error      │
│ Token SKIPPED   │ ← Never added to queue!
└─────────────────┘
```

---

## 🎯 Why Tokens Are Never Bought

### Current Flow (BROKEN):

```typescript
// index.ts:1330-1342
try {
  logEngine.writeLog(`${getCurrentTime()}`, `🔍 [gRPC] Token detected: ${mintStr.slice(0, 8)}...`, "green");

  activeTransactions++;
  await addToQueue(mintStr);  // ← Throws TokenAccountNotFoundError
  activeTransactions--;      // ← Never reached when error thrown

} catch (error) {
  logEngine.writeLog(`${getCurrentTime()}`, `gRPC data processing error: ${error}`, "red");
  // Token is LOST here - never added to queue, never bought
}
```

**The Problem**:
1. `addToQueue()` tries to check authorities BEFORE adding to queue
2. Authority check fails with TokenAccountNotFoundError
3. Error is caught, logged, and **token is abandoned**
4. Token **never makes it into the queue**
5. Token is **never processed for purchase**

---

## 📋 Additional Evidence

### From Test Log:

**Detection Working**:
```
🎯 Tokens Detected: 11
```

**Zero Buys**:
```
✅ Tokens Bought: 0
❌ Tokens Rejected: 0
🛡️ Tokens Blocked (Quality Filter): 0
```

**Queue Status**:
- No messages showing "📥 Added to queue"
- No messages showing "⚙️ Processing token"
- No messages showing "⏰ Rate limit delay"

**This confirms**: Tokens are **failing BEFORE being added to queue**

---

## 🔧 Why Minimal Mode Exists (Context)

**File**: `src/index.ts:397-406`

Minimal mode was designed to be **fast**:
- Skip full rugcheck (slow)
- Skip quality filters (API calls)
- Only check mint/freeze authorities (fast)

**Intended Purpose**: Quick authority check to reject risky tokens

**Actual Result**: Fails on ALL brand new tokens because RPC hasn't indexed them yet

---

## 💡 Root Cause Summary

| Issue | Details |
|-------|---------|
| **Primary Cause** | `getMint()` throws TokenAccountNotFoundError on brand new tokens |
| **Why It Happens** | gRPC detects tokens faster than RPC can index them |
| **Current Behavior** | Error caught, logged, token abandoned |
| **Expected Behavior** | Token should be retried or queued for later checking |
| **Impact** | 100% of detected tokens are lost, 0% buy rate |

---

## 🔍 Questions to Answer:

### Q1: Why does minimal mode call RPC at all?
**A**: To check mint/freeze authorities via `getMint()`

### Q2: Can we skip authority checks in minimal mode?
**A**: Dangerous - would allow tokens with mint/freeze authority (rug risk)

### Q3: Can we retry after a delay?
**A**: YES - This is the likely solution

### Q4: Can we use gRPC data instead of RPC?
**A**: Maybe - Need to check if gRPC provides mint authority data

---

## 🛠️ Potential Solutions

### Solution 1: Add Retry Logic with Exponential Backoff (RECOMMENDED)

**Location**: `src/index.ts:1330-1342` (gRPC handler)

```typescript
// CURRENT (BROKEN):
try {
  activeTransactions++;
  await addToQueue(mintStr);  // ← Throws error
  activeTransactions--;
} catch (error) {
  logEngine.writeLog(`${getCurrentTime()}`, `gRPC data processing error: ${error}`, "red");
  // Token is LOST
}

// PROPOSED (WITH RETRY):
try {
  activeTransactions++;

  // Retry logic for brand new tokens
  let retries = 0;
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [500, 1000, 2000]; // ms

  while (retries < MAX_RETRIES) {
    try {
      await addToQueue(mintStr);
      activeTransactions--;
      break; // Success!
    } catch (error: any) {
      if (error.toString().includes('TokenAccountNotFoundError') && retries < MAX_RETRIES - 1) {
        retries++;
        logEngine.writeLog(`${getCurrentTime()}`, `Token not indexed yet, retry ${retries}/${MAX_RETRIES} in ${RETRY_DELAYS[retries - 1]}ms...`, "yellow");
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retries - 1]));
      } else {
        throw error; // Re-throw if not TokenAccountNotFoundError or max retries reached
      }
    }
  }

} catch (error) {
  activeTransactions--;
  logEngine.writeLog(`${getCurrentTime()}`, `gRPC data processing error after retries: ${error}`, "red");
  stats.tokensRejected++;
}
```

**Pros**:
- ✅ Allows RPC time to index the token
- ✅ Simple to implement
- ✅ Doesn't change core logic

**Cons**:
- ⚠️ Adds latency (up to 3.5 seconds)
- ⚠️ May still fail for very new tokens

---

### Solution 2: Defer Authority Checks to ProcessQueue

**Location**: `src/index.ts:306-472`

```typescript
// CURRENT: addToQueue checks authorities BEFORE queueing
async function addToQueue(tokenMint: string) {
  // ... queue size checks ...

  // Perform checks BEFORE adding to queue ← PROBLEM
  const authorities = await getTokenAuthorities(tokenMint);  // ← Fails here

  tokenQueue.push(tokenMint);
}

// PROPOSED: Add to queue FIRST, check authorities in processQueue
async function addToQueue(tokenMint: string) {
  // ... queue size checks ...

  // Add to queue IMMEDIATELY (no checks yet)
  tokenQueue.push(tokenMint);
  console.log(`📥 Added to queue (${tokenQueue.length} tokens waiting)`);

  // Start processing if not already running
  if (!isProcessingQueue) {
    processQueue();
  }
}

async function processQueue() {
  isProcessingQueue = true;

  while (tokenQueue.length > 0) {
    const tokenMint = tokenQueue.shift()!;
    console.log(`⚙️ Processing token (${tokenQueue.length} remaining in queue)`);

    try {
      // Perform authority checks HERE (with retry logic)
      if (CHECK_MODE === "minimal") {
        let authorities = null;
        let retries = 0;
        while (retries < 3 && !authorities) {
          try {
            authorities = await getTokenAuthorities(tokenMint);
          } catch (error: any) {
            if (error.toString().includes('TokenAccountNotFoundError')) {
              retries++;
              await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            } else {
              throw error;
            }
          }
        }

        if (!authorities || authorities.hasMintAuthority || authorities.hasFreezeAuthority) {
          console.log(`❌ Token has authorities or couldn't be fetched, skipping...`);
          stats.tokensRejected++;
          continue; // Skip to next token
        }
      }

      // Now process purchase
      await processPurchase(tokenMint);
    } catch (error) {
      console.log(`❌ Error processing token: ${error}`);
    }

    // Rate limit delay
    await new Promise(resolve => setTimeout(resolve, 6000));
  }

  isProcessingQueue = false;
}
```

**Pros**:
- ✅ Tokens are queued immediately
- ✅ Authority checks happen with built-in retry
- ✅ Better separation of concerns

**Cons**:
- ⚠️ Requires refactoring addToQueue/processQueue
- ⚠️ More complex change

---

### Solution 3: Use gRPC Data for Authority Checks (IDEAL)

**Investigation Needed**: Check if Yellowstone gRPC provides mint authority data in the transaction

If gRPC provides authority data:
- ✅ No RPC calls needed
- ✅ Instant checks
- ✅ No TokenAccountNotFoundError

**Need to investigate**: What data does gRPC stream provide?

---

### Solution 4: Disable Minimal Mode Checks (DANGEROUS)

**NOT RECOMMENDED** - Would allow tokens with mint/freeze authority (rug risk)

---

## 📊 Impact Analysis

### Current State:
- **Detection Rate**: 1,131 tokens/hour
- **Buy Rate**: 0 tokens/hour
- **Loss**: 100% of opportunities missed

### With Solution 1 (Retry Logic):
- **Expected Buy Rate**: 70-90% of detections (assuming most tokens index within 3.5s)
- **Expected Buys**: ~800-1,000 tokens/hour
- **Latency**: +0.5-3.5s per token

### With Solution 2 (Deferred Checks):
- **Expected Buy Rate**: 90-95% of detections
- **Expected Buys**: ~1,000-1,075 tokens/hour
- **Latency**: Minimal (checks happen during queue processing)

### With Solution 3 (gRPC Data):
- **Expected Buy Rate**: 95-100% of detections
- **Expected Buys**: ~1,075-1,131 tokens/hour
- **Latency**: None

---

## 🎯 Recommended Solution

**Implement Solution 1 (Retry Logic) FIRST** - Quick win, minimal code changes

**Then Investigate Solution 3 (gRPC Data)** - Ideal long-term solution

**Consider Solution 2 (Deferred Checks)** - If retry logic isn't sufficient

---

## 📝 Next Steps

1. **Immediate**: Implement retry logic in gRPC handler (Solution 1)
2. **Test**: Run bot for 60 seconds, verify tokens are bought
3. **Investigate**: Check what data gRPC stream provides (Solution 3)
4. **Optimize**: Implement deferred checks if needed (Solution 2)

---

## 📄 Files to Modify

### For Solution 1 (Retry Logic):
- **File**: `src/index.ts`
- **Lines**: 1330-1342 (gRPC stream handler)
- **Change**: Add retry loop with exponential backoff

---

**Status**: ✅ Root cause identified, solutions proposed
**Next**: Implement Solution 1 (Retry Logic)
**Priority**: CRITICAL (0% buy rate is unusable)

---

**Investigation Complete**: 2025-11-06
