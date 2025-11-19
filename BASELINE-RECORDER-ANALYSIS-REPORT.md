# BASELINE RECORDER SYSTEMATIC ANALYSIS REPORT
Generated: 2025-11-04

---

## PHASE 1: FILE METADATA

**File Location:** `C:\Users\Administrator\Desktop\IAM\sol-bot-main\market-intelligence\standalone-recorder.ts`

**File Purpose:** Standalone Market Observer that runs 24/7 independently of the trading bot to record ALL market activity for baseline data.

**File Size:** 362 lines of code (13,620 bytes)

**Last Modified:** November 2, 2025 at 17:36

**Dependencies Count:** 4 imports
- `MarketRecorder` from './handlers/market-recorder'
- `getMarketIntelligenceConfig` from './config/mi-config'
- `Connection, PublicKey` from '@solana/web3.js'
- `WebSocket` from 'ws'
- `validateEnv` from '../src/utils/env-validator'

**Exports Count:** 1 export
- `runStandaloneRecorder` function

---

## PHASE 2: LINE-BY-LINE ANALYSIS

### Section A: IMPORTS (Lines 1-10)

**Line 6:** `import { MarketRecorder } from './handlers/market-recorder';`
- ✅ Used: Line 117 (initialization), Lines 208, 262, 322 (recorder operations)
- ✅ Source exists: `market-intelligence/handlers/market-recorder.ts`
- ✅ No issues

**Line 7:** `import { getMarketIntelligenceConfig } from './config/mi-config';`
- ✅ Used: Line 87 (config spread)
- ✅ Source exists: `market-intelligence/config/mi-config.ts`
- ✅ No issues

**Line 8:** `import { Connection, PublicKey } from '@solana/web3.js';`
- ✅ Used: Lines 116 (Connection), 197 (PublicKey validation)
- ✅ Source exists: NPM package
- ✅ No issues

**Line 9:** `import WebSocket from 'ws';`
- ✅ Used: Lines 67, 149 (WebSocket connection)
- ✅ Source exists: NPM package
- ⚠️ **ISSUE IDENTIFIED:** Should be using gRPC instead (see Section C)

**Line 10:** `import { validateEnv } from '../src/utils/env-validator';`
- ✅ Used: Line 82 (environment validation)
- ✅ Source exists: `src/utils/env-validator.ts`
- ✅ No issues

---

### Section B: CRITICAL CONFIGURATION SECTION (Lines 85-113)

#### 1. **detection_source setting (Line 90)**
```typescript
detection_source: 'websocket' as const,
```

**Current value:** `'websocket'`
**Expected value:** Should be `'grpc'`
**Why hardcoded?** Historical implementation - file was created before gRPC integration

**Comparison to main bot's config:**
- Main bot uses: `UNIFIED-CONTROL.ts` Line 408: `method: 'grpc'`
- Main bot config: `DATA_STREAM_METHOD = 'grpc'` (src/index.ts Line 183)
- Baseline recorder uses: `detection_source: 'websocket'` (hardcoded)

**❌ CRITICAL MISMATCH:** Baseline recorder is using WebSocket while main bot uses gRPC. This means they are NOT detecting tokens the same way!

---

#### 2. **record_all_tokens setting (Line 91)**
```typescript
record_all_tokens: true,
```

**Current value:** `true`
**Is this being respected?** ✅ YES - Line 339 in mi-config.ts:
```typescript
if (config.recording.record_all_tokens) return true;  // Baseline mode: record EVERYTHING
```

**✅ NO ISSUE HERE** - The fix from November 2nd is working correctly. The `shouldRecordToken()` function checks this flag FIRST before checking score thresholds.

---

#### 3. **Config spreading (Line 87)**
```typescript
const baselineConfig = {
  ...getMarketIntelligenceConfig(),
  recording: {
    enabled: true,
    detection_source: 'websocket' as const,
    // ... other properties
  },
  scoring: {
    enabled: true,
    min_score_to_track: 0,
    // ... other properties
  }
}
```

**Analysis:**
- ✅ Spreading works correctly - merges default config from `getMarketIntelligenceConfig()`
- ✅ Properties are properly overridden - `recording` and `scoring` objects replace defaults
- ⚠️ **POTENTIAL ISSUE:** Deep nested objects might not merge as expected (JavaScript shallow spread issue)

**Verification of spread behavior:**
```javascript
// Default config from getMarketIntelligenceConfig():
recording: {
  enabled: true,
  detection_source: 'websocket',  // ← Default value
  record_all_tokens: true,
  // ... 10 other properties
}

// Baseline override:
recording: {
  enabled: true,
  detection_source: 'websocket',  // ← Hardcoded override
  record_all_tokens: true,
  // ... 10 other properties (all explicitly set)
}
```

**✅ NO ISSUE HERE** - All `recording` properties are explicitly set in baseline config, so spread behavior is correct.

---

### Section C: WEBSOCKET CONNECTION LOGIC (Lines 144-180)

**Line 144:** `async function connectWebSocket(wssUri: string)`

**Why is this using WebSocket instead of gRPC?**
1. ❌ **Historical reason:** File was created before gRPC integration in main bot
2. ❌ **Not updated:** When main bot switched to gRPC, standalone-recorder was not updated
3. ❌ **Documentation gap:** No migration guide was created for MI system

**Comparison to main bot's gRPC connection:**

**Main bot (src/index.ts Lines 1218-1237):**
```typescript
async function startGrpcListener(): Promise<void> {
  globalGrpcClient = new Client(GRPC_HTTP_URI, GRPC_AUTH_TOKEN, { skipPreflight: true });
  globalGrpcStream = await globalGrpcClient.subscribe();
  const request = createSubscribeRequest(DATA_STREAM_PROGRAMS, DATA_STREAM_WALLETS, DATA_STREAM_MODE);

  await sendSubscribeRequest(globalGrpcStream, request);

  globalGrpcStream.on("data", async (data: SubscribeUpdate) => {
    // Process gRPC messages
  });
}
```

**Baseline recorder (Lines 144-180):**
```typescript
async function connectWebSocket(wssUri: string) {
  ws = new WebSocket(wssUri);

  ws.on('open', () => {
    ws?.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'logsSubscribe',
      params: [
        { mentions: ['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'] }  // Pump.fun only
      ]
    }));
  });

  ws.on('message', async (data) => {
    // Process WebSocket messages
  });
}
```

**❌ CRITICAL DIFFERENCES:**

| Aspect | Main Bot (gRPC) | Baseline (WebSocket) |
|--------|-----------------|---------------------|
| **Protocol** | gRPC (Yellowstone) | WebSocket (Solana RPC) |
| **Connection** | `Client.subscribe()` | `new WebSocket()` |
| **Programs** | Multiple configurable | Hardcoded Pump.fun only |
| **Message format** | `SubscribeUpdate` | JSON-RPC logs |
| **Token detection** | Transaction-based | Log-based |
| **Reliability** | Higher (enterprise) | Lower (public RPC) |

---

## PHASE 3: ROOT CAUSE ANALYSIS

### CRITICAL QUESTIONS:

#### 1. **Why WebSocket?**

**Answer:**
- ❌ Created before gRPC integration (November 2, 2025)
- ❌ Main bot switched to gRPC after MI system was built
- ❌ No one updated standalone-recorder to match

**Technical reason for using WebSocket:**
- None - WebSocket is INFERIOR to gRPC for this use case
- WebSocket uses public RPC (rate limits, instability)
- gRPC uses dedicated infrastructure (faster, more reliable)

**Should it be updated to use gRPC?**
- ✅ **YES - CRITICAL** for consistency and reliability

---

#### 2. **Does baseline match bot's detection?**

**Main bot detection:**
```typescript
// From UNIFIED-CONTROL.ts Line 408-411
dataStream: {
  method: 'grpc',
  mode: 'program',
  programs: [
    {
      name: 'Pump.fun',
      key: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
      enabled: true,
      log_discriminator: 'Create'
    },
    {
      name: 'Raydium',
      key: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
      enabled: false,  // Disabled by default
      log_discriminator: 'initialize2'
    }
  ]
}

// From src/index.ts Line 1224
const request = createSubscribeRequest(
  DATA_STREAM_PROGRAMS,      // All enabled programs
  DATA_STREAM_WALLETS,
  DATA_STREAM_MODE
);
```

**Baseline recorder detection:**
```typescript
// From standalone-recorder.ts Lines 157-169
ws?.send(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'logsSubscribe',
  params: [
    {
      mentions: ['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P']  // Pump.fun ONLY
    },
    {
      commitment: 'confirmed'
    }
  ]
}));
```

**❌ THEY ARE NOT EQUIVALENT:**

| Feature | Main Bot | Baseline |
|---------|----------|----------|
| Pump.fun | ✅ Monitored | ✅ Monitored |
| Raydium | ⚠️ Configurable | ❌ Not monitored |
| Other programs | ⚠️ Configurable | ❌ Not monitored |
| Commitment level | `PROCESSED` | `confirmed` |
| Program filter | Dynamic from config | Hardcoded single program |

**Impact:**
- If main bot enables Raydium, baseline won't see those tokens
- If main bot adds new programs, baseline won't see them
- Different commitment levels mean different detection timing

---

#### 3. **Config spreading issue?**

**Analysis:**
```typescript
const baselineConfig = {
  ...getMarketIntelligenceConfig(),  // Spreads default config
  recording: {
    // This REPLACES entire recording object (not merged)
    enabled: true,
    detection_source: 'websocket',
    // ... all 13 properties explicitly set
  },
  scoring: {
    // This REPLACES entire scoring object (not merged)
    enabled: true,
    min_score_to_track: 0,
    // ... all 8 properties explicitly set
  }
}
```

**✅ NO ISSUE** - Config spreading works correctly because:
1. All nested objects are fully replaced (not partially merged)
2. All properties are explicitly set (no missing defaults)
3. `shouldRecordToken()` correctly checks `record_all_tokens` flag first

**Is there a better way?**
```typescript
// Current approach (GOOD):
const baselineConfig = {
  ...getMarketIntelligenceConfig(),
  recording: { /* full object */ },
  scoring: { /* full object */ }
}

// Alternative (NOT NEEDED):
const config = getMarketIntelligenceConfig();
config.recording.record_all_tokens = true;
config.recording.detection_source = 'websocket';
// ... etc
```

The current approach is fine because it's explicit and clear.

---

## PHASE 4: COMPARISON TO MAIN BOT

### 1. **Detection Method**

**Main bot gRPC setup (src/index.ts Lines 1218-1237):**
```typescript
async function startGrpcListener(): Promise<void> {
  // 1. Create gRPC client
  globalGrpcClient = new Client(GRPC_HTTP_URI, GRPC_AUTH_TOKEN, { skipPreflight: true });

  // 2. Subscribe to stream
  globalGrpcStream = await globalGrpcClient.subscribe();

  // 3. Create subscription request
  const request = createSubscribeRequest(
    DATA_STREAM_PROGRAMS,      // From UNIFIED-CONTROL
    DATA_STREAM_WALLETS,       // From UNIFIED-CONTROL
    DATA_STREAM_MODE           // From UNIFIED-CONTROL
  );

  // 4. Send subscription request
  await sendSubscribeRequest(globalGrpcStream, request);

  // 5. Listen for data
  globalGrpcStream.on("data", async (data: SubscribeUpdate) => {
    if (isSubscribeUpdateTransaction(data)) {
      // Process transaction data
    }
  });
}
```

**Baseline recorder WebSocket setup (Lines 144-235):**
```typescript
async function connectWebSocket(wssUri: string) {
  // 1. Create WebSocket connection
  ws = new WebSocket(wssUri);

  // 2. On connection open, subscribe
  ws.on('open', () => {
    ws?.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'logsSubscribe',
      params: [
        { mentions: ['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'] }
      ]
    }));
  });

  // 3. Listen for messages
  ws.on('message', async (data) => {
    const message = JSON.parse(data.toString());
    const logs = message.params?.result?.value?.logs;

    // Extract mint from logs
    const tokenMint = extractMintFromLogs(logs);

    // Record token
    await recorder.onTokenDetected(...);
  });
}
```

**❌ THEY ARE NOT EQUIVALENT:**

| Aspect | Main Bot | Baseline | Impact |
|--------|----------|----------|--------|
| **Data source** | gRPC transactions | WebSocket logs | Different timing |
| **Program filtering** | Transaction filters | Log mentions | Different detection |
| **Message format** | Structured gRPC | JSON-RPC logs | Different parsing |
| **Token extraction** | From transaction | From logs | Different reliability |
| **Connection** | Dedicated gRPC | Public RPC WebSocket | Different reliability |

---

### 2. **Token Processing**

**Main bot token flow:**
```
gRPC transaction
  ↓ isSubscribeUpdateTransaction()
  ↓ Extract token from transaction accounts
  ↓ Safety checks (isTokenSecureAndAllowed)
  ↓ Scoring (token analyzer)
  ↓ Buy decision
  ↓ Record to MarketRecorder (if MI enabled)
```

**Baseline recorder token flow:**
```
WebSocket log message
  ↓ Parse JSON-RPC
  ↓ Extract logs array
  ↓ extractMintFromLogs() - regex parsing
  ↓ Detect program (detectProgram helper)
  ↓ Record to MarketRecorder (all tokens)
```

**❌ NOT THE SAME:**
- Main bot uses **transaction accounts** (reliable)
- Baseline uses **log regex parsing** (fragile)
- Main bot filters **before recording**
- Baseline records **everything** (correct for baseline)

---

### 3. **MarketRecorder Usage**

**Main bot usage (src/index.ts Lines 78, 1906-1924):**
```typescript
// Initialize with session config
const sessionConfig: SessionConfig = {
  session_id: Date.now().toString(),
  session_type: TEST_MODE ? 'paper' : 'live',
  session_start: Date.now(),
  bot_version: '5.0',
};

const miConfig = getMarketIntelligenceConfig(sessionConfig);
marketRecorder = new MarketRecorder(connection, miConfig);
await marketRecorder.initialize();

// Record when token passes checks
if (marketRecorder?.isRecording()) {
  await marketRecorder.onTokenDetected(
    { mint, timestamp, detection_method: 'grpc', detection_program },
    { score, would_buy: true, has_mint_authority, has_freeze_authority }
  );
}
```

**Baseline recorder usage (Lines 115-118, 208-226):**
```typescript
// Initialize with baseline config
const baselineConfig = {
  ...getMarketIntelligenceConfig(),
  recording: { record_all_tokens: true, /* ... */ },
  scoring: { min_score_to_track: 0, /* ... */ }
};

recorder = new MarketRecorder(connection, baselineConfig);
await recorder.initialize();

// Record ALL tokens
if (recorder?.isRecording()) {
  await recorder.onTokenDetected(
    { mint, timestamp, detection_method: 'websocket', detection_program },
    { score: 100, would_buy: true, has_mint_authority: false, has_freeze_authority: false }
  );
}
```

**✅ CONSISTENT USAGE:**
- Both use same `MarketRecorder` class
- Both call same `onTokenDetected()` method
- Main difference is **detection_method** field ('grpc' vs 'websocket')
- Baseline uses `score: 100` to ensure tracking (correct approach)

---

## PHASE 5: SOLUTION DESIGN

### 1. **What needs to change?**

**✅ PRIMARY FIX: Switch from WebSocket to gRPC**
- Replace `connectWebSocket()` with `connectGrpc()`
- Use same gRPC client as main bot
- Use same subscription request logic
- Match program filtering from UNIFIED-CONTROL

**⚠️ SECONDARY FIX: Update config spreading (optional)**
- Consider reading programs from UNIFIED-CONTROL dynamically
- Keep `detection_source: 'grpc'` hardcoded in baseline config
- Ensure baseline continues to record ALL tokens

---

### 2. **How to implement gRPC?**

**Option A: Copy from main bot's implementation (RECOMMENDED)**

**Required imports:**
```typescript
import Client, { SubscribeRequest, SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { ClientDuplexStream } from "@grpc/grpc-js";
import {
  createSubscribeRequest,
  isSubscribeUpdateTransaction,
  sendSubscribeRequest
} from '../src/utils/managers/grpcManager';
import { MASTER_SETTINGS } from '../src/core/UNIFIED-CONTROL';
```

**New function to replace connectWebSocket:**
```typescript
async function connectGrpc() {
  try {
    console.log('🔌 Connecting to gRPC...');

    // Use same settings as main bot
    const GRPC_HTTP_URI = env.GRPC_HTTP_URI || MASTER_SETTINGS.dataStream.grpc.endpoint;
    const GRPC_AUTH_TOKEN = env.GRPC_AUTH_TOKEN || MASTER_SETTINGS.dataStream.grpc.auth_token;

    // Create gRPC client
    const grpcClient = new Client(GRPC_HTTP_URI, GRPC_AUTH_TOKEN, { skipPreflight: true });
    const grpcStream = await grpcClient.subscribe();

    // Create subscription request (use all enabled programs from UNIFIED-CONTROL)
    const DATA_STREAM_PROGRAMS = MASTER_SETTINGS.dataStream.programs.filter(p => p.enabled);
    const request = createSubscribeRequest(DATA_STREAM_PROGRAMS, [], 'program');

    await sendSubscribeRequest(grpcStream, request);
    console.log('✅ gRPC connected and subscribed');

    // Listen for transactions
    grpcStream.on("data", async (data: SubscribeUpdate) => {
      try {
        messagesReceived++;

        if (!isSubscribeUpdateTransaction(data)) return;

        // Extract token mint from transaction accounts
        const accounts = data.transaction?.transaction?.message?.accountKeys || [];
        const tokenMint = extractMintFromTransaction(accounts);

        if (!tokenMint) return;

        tokensDetected++;

        // Detect which program created this token
        const detectionProgram = detectProgramFromTransaction(data);

        // Record to baseline database
        if (recorder?.isRecording()) {
          await recorder.onTokenDetected(
            {
              mint: tokenMint,
              timestamp: Date.now(),
              detection_method: 'grpc',  // ← Changed from 'websocket'
              detection_program: detectionProgram,
            },
            {
              mint: tokenMint,
              score: 100,
              would_buy: true,
              has_mint_authority: false,
              has_freeze_authority: false,
            }
          );

          console.log(`[${new Date().toLocaleTimeString()}] 🔍 Detected: ${tokenMint.slice(0, 8)}... (${detectionProgram})`);
        }

      } catch (error) {
        // Non-critical message parsing errors
      }
    });

    grpcStream.on('error', (error) => {
      console.error('❌ gRPC error:', error.message);
    });

    grpcStream.on('end', () => {
      console.log('\n⚠️  gRPC stream ended');
      // Implement reconnection logic
    });

  } catch (error) {
    console.error('❌ gRPC connection failed:', error);
    throw error;
  }
}
```

**Helper functions needed:**
```typescript
function extractMintFromTransaction(accounts: any[]): string | null {
  // Extract token mint from transaction accounts
  // (Main bot has this logic in index.ts)
  for (const account of accounts) {
    // Look for SPL Token mint account
    // Return base58 address
  }
  return null;
}

function detectProgramFromTransaction(data: SubscribeUpdate): string {
  // Detect which program created the token
  // Check transaction accounts for program IDs
  const accounts = data.transaction?.transaction?.message?.accountKeys || [];

  for (const account of accounts) {
    if (account.includes('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')) return 'Pump.fun';
    if (account.includes('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8')) return 'Raydium';
  }

  return 'Unknown';
}
```

---

**Option B: Reuse grpcManager.ts functions (CLEANER)**

```typescript
import { createSubscribeRequest, isSubscribeUpdateTransaction, sendSubscribeRequest } from '../src/utils/managers/grpcManager';
import Client, { SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { MASTER_SETTINGS } from '../src/core/UNIFIED-CONTROL';

async function connectGrpc() {
  // Reuse existing grpcManager functions
  const grpcClient = new Client(env.GRPC_HTTP_URI, env.GRPC_AUTH_TOKEN, { skipPreflight: true });
  const grpcStream = await grpcClient.subscribe();

  // Use same programs as main bot
  const DATA_STREAM_PROGRAMS = MASTER_SETTINGS.dataStream.programs.filter(p => p.enabled);
  const request = createSubscribeRequest(DATA_STREAM_PROGRAMS, [], 'program');

  await sendSubscribeRequest(grpcStream, request);

  // Process messages (similar to main bot's startGrpcListener)
  grpcStream.on("data", async (data: SubscribeUpdate) => {
    if (isSubscribeUpdateTransaction(data)) {
      // Handle transaction
    }
  });
}
```

**✅ RECOMMENDED:** Option B (reuse existing functions)

---

### 3. **Code changes needed**

**File: `market-intelligence\standalone-recorder.ts`**

**Changes required:**

1. **Add imports (after Line 10):**
```typescript
import Client, { SubscribeRequest, SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { ClientDuplexStream } from "@grpc/grpc-js";
import {
  createSubscribeRequest,
  isSubscribeUpdateTransaction,
  sendSubscribeRequest
} from '../src/utils/managers/grpcManager';
import { MASTER_SETTINGS } from '../src/core/UNIFIED-CONTROL';
```

2. **Update config (Line 90):**
```typescript
// BEFORE:
detection_source: 'websocket' as const,

// AFTER:
detection_source: 'grpc' as const,
```

3. **Replace connectWebSocket function (Lines 144-259) with connectGrpc:**
```typescript
async function connectGrpc(env: ReturnType<typeof validateEnv>) {
  try {
    console.log('🔌 Connecting to gRPC...');
    console.log(`   ${env.GRPC_HTTP_URI.substring(0, 40)}...`);

    // Use same gRPC settings as main bot
    const grpcClient = new Client(
      env.GRPC_HTTP_URI,
      env.GRPC_AUTH_TOKEN,
      { skipPreflight: true }
    );

    const grpcStream = await grpcClient.subscribe();

    // Subscribe to same programs as main bot
    const DATA_STREAM_PROGRAMS = MASTER_SETTINGS.dataStream.programs.filter(p => p.enabled);
    const request = createSubscribeRequest(DATA_STREAM_PROGRAMS, [], 'program');

    await sendSubscribeRequest(grpcStream, request);

    console.log('✅ gRPC connected');
    reconnectAttempts = 0;

    // Log subscribed programs
    const programNames = DATA_STREAM_PROGRAMS.map(p => p.name).join(', ');
    console.log(`📡 Subscribed to programs: ${programNames}`);
    console.log('📊 Monitoring all market activity...\n');
    console.log('━'.repeat(80));
    console.log('Press Ctrl+C to stop gracefully');
    console.log('━'.repeat(80));
    console.log('');

    // Handle incoming data
    grpcStream.on('data', async (data: SubscribeUpdate) => {
      try {
        messagesReceived++;

        if (!isSubscribeUpdateTransaction(data)) return;

        // Extract token mint from transaction
        // (Need to implement proper extraction from gRPC transaction data)
        const tokenMint = extractMintFromGrpcTransaction(data);
        if (!tokenMint) return;

        // Validate mint address
        try {
          new PublicKey(tokenMint);
        } catch {
          return;
        }

        tokensDetected++;

        // Detect program
        const detectionProgram = detectProgramFromGrpcData(data);

        // Record to baseline database
        if (recorder?.isRecording()) {
          await recorder.onTokenDetected(
            {
              mint: tokenMint,
              timestamp: Date.now(),
              detection_method: 'grpc',
              detection_program: detectionProgram,
            },
            {
              mint: tokenMint,
              score: 100,
              would_buy: true,
              has_mint_authority: false,
              has_freeze_authority: false,
            }
          ).catch(err => {
            console.log(`⚠️  Recording error for ${tokenMint.slice(0, 8)}:`, err.message);
          });

          console.log(`[${new Date().toLocaleTimeString()}] 🔍 Detected: ${tokenMint.slice(0, 8)}... (${detectionProgram})`);
        }

      } catch (error) {
        // Non-critical message parsing errors
      }
    });

    grpcStream.on('error', (error) => {
      console.error('❌ gRPC error:', error.message);
    });

    grpcStream.on('end', () => {
      console.log('\n⚠️  gRPC stream ended');

      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = Math.min(5000 * reconnectAttempts, 30000);
        console.log(`🔄 Reconnecting in ${delay/1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(() => connectGrpc(env), delay);
      } else {
        console.error('❌ Max reconnection attempts reached. Exiting...');
        shutdown();
      }
    });

  } catch (error) {
    console.error('❌ gRPC connection failed:', error);
    throw error;
  }
}
```

4. **Update initialize function (Line 136):**
```typescript
// BEFORE:
await connectWebSocket(env.RPC_WSS_URI);

// AFTER:
await connectGrpc(env);
```

5. **Add helper functions (after Line 53):**
```typescript
// Helper to extract mint from gRPC transaction
function extractMintFromGrpcTransaction(data: SubscribeUpdate): string | null {
  try {
    const accounts = data.transaction?.transaction?.message?.accountKeys || [];

    // Look for SPL Token mint account
    // (Implementation depends on transaction structure)
    for (const account of accounts) {
      // Extract base58 address
      // Validate it's a token mint
      // Return if valid
    }

    return null;
  } catch {
    return null;
  }
}

// Helper to detect program from gRPC transaction
function detectProgramFromGrpcData(data: SubscribeUpdate): string {
  try {
    const accounts = data.transaction?.transaction?.message?.accountKeys || [];

    for (const account of accounts) {
      const accountStr = account.toString();
      if (accountStr.includes('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')) return 'Pump.fun';
      if (accountStr.includes('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8')) return 'Raydium';
    }

    return 'Unknown';
  } catch {
    return 'Unknown';
  }
}
```

6. **Update shutdown function (Line 317):**
```typescript
// BEFORE:
if (ws) {
  console.log('📡 Closing WebSocket connection...');
  ws.close();
}

// AFTER:
if (grpcStream) {
  console.log('📡 Closing gRPC stream...');
  grpcStream.end();
}
```

---

## SUMMARY: ROOT CAUSE EXPLANATION

### **Why is baseline using WebSocket instead of gRPC?**

**Simple answer:** Historical artifact - the file was never updated when the main bot switched to gRPC.

**Timeline:**
1. ✅ November 2, 2025: Market Intelligence system created with WebSocket
2. ✅ Main bot already using gRPC (switched earlier)
3. ❌ standalone-recorder.ts was never updated to match
4. ❌ Documentation never mentioned the mismatch

**Impact:**
- ❌ Baseline detects different tokens than main bot
- ❌ Different timing (WebSocket vs gRPC latency)
- ❌ Different reliability (public RPC vs dedicated gRPC)
- ❌ Baseline only monitors Pump.fun (main bot configurable)
- ❌ Comparison analysis will be INVALID

**Solution:** Convert standalone-recorder.ts to use gRPC (matching main bot)

---

## CRITICAL FINDINGS SUMMARY

1. **✅ Config spreading works correctly** - `record_all_tokens` flag is properly respected
2. **✅ shouldRecordToken() fix is working** - November 2nd fix verified functional
3. **❌ CRITICAL: Detection method mismatch** - WebSocket vs gRPC is the ROOT CAUSE
4. **❌ CRITICAL: Program filtering mismatch** - Baseline only monitors Pump.fun
5. **❌ CRITICAL: Commitment level mismatch** - `confirmed` vs `PROCESSED`
6. **⚠️ Token extraction method differs** - Log regex vs transaction accounts

**PRIMARY FIX REQUIRED:** Convert standalone-recorder.ts from WebSocket to gRPC to match main bot's detection system.

**ESTIMATED EFFORT:** ~30 minutes to implement, ~15 minutes to test

**RISK LEVEL:** Low - All gRPC infrastructure already exists in main bot, just needs to be reused

---

## NEXT STEPS

1. ✅ **Analysis complete** - All phases completed
2. ⏳ **Await user decision** - Should I implement the gRPC conversion?
3. ⏳ **Testing plan** - Run baseline recorder with gRPC for 1 hour
4. ⏳ **Verification** - Compare detection counts between main bot and baseline

**END OF REPORT**
