# Detailed Fix Plan - Sol-Bot Production Readiness
**Date**: November 7, 2025
**Goal**: Fix all blocking issues and achieve production-ready status
**Estimated Time**: 4-8 hours for critical fixes

---

## 🎯 OVERVIEW

This plan addresses **3 critical blocking issues** and outlines the path to production readiness:

1. **REGRESSION**: Zero buys issue returned (TokenAccountNotFoundError)
2. **STABILITY**: SQLite transaction error crashes bot after 15 minutes
3. **MONITORING**: Claude Code crashes when monitoring bot

**Success Metrics**:
- ✅ Test mode: 100% buy rate sustained for 8+ hours
- ✅ Live mode: 10 micro trades execute correctly
- ✅ Production mode: Confidence to deploy with real money

---

## 🚨 PHASE 1: EMERGENCY VERIFICATION & FIX (30 minutes)

### Critical Issue: Nov 6 Fixes May Have Been Reverted

**Evidence**: Latest log shows TokenAccountNotFoundError returned (0/11 tokens bought)

### Step 1.1: Verify Retry Logic (5 minutes)

**File to Check**: `src/utils/handlers/tokenHandler.ts`

**Expected Code** (lines 26-103):
```typescript
export async function getTokenAuthorities(
  tokenMint: string,
  connection: Connection
): Promise<{ freezeAuthority: string | null; mintAuthority: string | null }> {
  const mint = new PublicKey(tokenMint);

  // VIP2 RETRY LOGIC: RPC needs time to index accounts after gRPC detection
  const delays = [200, 100, 100]; // ms between attempts
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= delays.length + 1; attempt++) {
    try {
      const info = await connection.getAccountInfo(mint);
      // ... parse and return authorities
      return {
        freezeAuthority: freezeAuth ? freezeAuth.toString() : null,
        mintAuthority: mintAuth ? mintAuth.toString() : null
      };
    } catch (error) {
      lastError = error as Error;
      if (attempt <= delays.length) {
        const delay = delays[attempt - 1];
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError;
}
```

**Action**:
```bash
# Read the file to check
cat src/utils/handlers/tokenHandler.ts | grep -A 30 "getTokenAuthorities"
```

**If Missing**: Restore from `SESSION-SUMMARY-2025-11-06.md` or restore backup

---

### Step 1.2: Verify RPC Configuration (5 minutes)

**File to Check**: `.env`

**Expected Configuration**:
```bash
# Line 17 - PRIMARY RPC (Helius)
RPC_HTTPS_URI=https://mainnet.helius-rpc.com/?api-key=YOUR-KEY-HERE

# Lines 55-56 - QuickNode MUST BE COMMENTED OUT
# RPC_OVERRIDE_QUICKNODE=https://blissful-holy-spree.solana-mainnet.quiknode.pro/6931...
# ^^^ THIS MUST HAVE # IN FRONT
```

**Action**:
```bash
# Check current RPC settings
cat .env | grep -E "(RPC_HTTPS_URI|RPC_OVERRIDE)"
```

**If Wrong**: Comment out lines 55-56, ensure line 17 has Helius RPC

---

### Step 1.3: Verify Jupiter Polling Removed (5 minutes)

**File to Check**: `src/index.ts`

**Expected**: Lines 959-1013 should NOT contain `monitorPositions()` function

**Action**:
```bash
# Check if monitorPositions function exists
cat src/index.ts | grep -n "monitorPositions"
```

**Expected Result**: Should only find:
- Comments mentioning it was removed
- NO function definition
- NO `.then(monitorPositions)` calls

**If Found**: Remove the function and calls again

---

### Step 1.4: Quick Test (10 minutes)

**Action**: Run bot for 60 seconds, check buy rate

```bash
npm run dev
# Watch for:
# - "Authority checks passed" messages
# - Paper trading buy confirmations
# - NO "TokenAccountNotFoundError" errors
```

**Success Criteria**:
- At least 1 token detected
- Authority checks pass
- Paper trade executes
- No TokenAccountNotFoundError

**If Fails**: Debug RPC connection, check Helius API key validity

---

### Step 1.5: Emergency Rollback Plan (5 minutes)

**If all verification fails**, create script to restore Nov 6 state:

**File**: `scripts/emergency-restore-nov6-fixes.sh`
```bash
#!/bin/bash

echo "🚨 EMERGENCY: Restoring November 6 fixes..."

# Backup current state
git stash save "Pre-Nov6-restore-$(date +%Y%m%d-%H%M%S)"

# Restore retry logic
cat << 'EOF' > src/utils/handlers/tokenHandler.ts
// [Full retry logic code from Nov 6]
EOF

# Comment out QuickNode in .env
sed -i '55s/^/# /' .env
sed -i '56s/^/# /' .env

# Verify
echo "✅ Fixes restored. Run: npm run dev"
```

---

## 🔧 PHASE 2: FIX SQLITE TRANSACTION ERROR (60-90 minutes)

### Critical Issue: Bot crashes after ~15 minutes with transaction errors

### Step 2.1: Locate SQLite Code (15 minutes)

**File to Check**: `src/analysis/marketIntelligenceRecorder.ts` or similar

**Look For**:
```typescript
// Transaction keywords:
db.run("BEGIN TRANSACTION")
db.run("COMMIT")
db.run("ROLLBACK")

// Or using better-sqlite3:
db.prepare("BEGIN").run()
db.transaction(() => { ... })
```

**Action**:
```bash
# Find all SQLite transaction code
grep -rn "BEGIN TRANSACTION\|COMMIT\|ROLLBACK\|db.transaction" src/
grep -rn "sqlite" src/ | grep -i "transaction"
```

**Document**: Which files use SQLite, which methods write data

---

### Step 2.2: Analyze Transaction Pattern (15 minutes)

**Common Patterns That Cause Issues**:

1. **Nested Transactions** (most likely cause):
```typescript
// BAD - creates nested transaction
function writeToken(data) {
  db.transaction(() => {        // Transaction 1
    db.insert(data);
    writeMetadata(data);        // Calls another transaction
  })();
}

function writeMetadata(data) {
  db.transaction(() => {        // Transaction 2 - NESTED!
    db.insert(metadata);
  })();
}
```

2. **Concurrent Writes**:
```typescript
// BAD - multiple simultaneous writes
tokens.forEach(token => {
  writeToken(token);  // All start transactions at once
});
```

3. **Unclosed Transactions**:
```typescript
// BAD - transaction not closed on error
db.run("BEGIN TRANSACTION");
try {
  db.run("INSERT ...");
  // Error occurs here
} catch (error) {
  // ROLLBACK not called!
}
```

**Action**: Identify which pattern exists in codebase

---

### Step 2.3: Implement Transaction Queue (30 minutes)

**Solution**: Serialize all database operations

**File**: Create `src/utils/database-queue.ts`

```typescript
/**
 * Database Write Queue
 * Ensures SQLite writes happen serially (no nested/concurrent transactions)
 */
export class DatabaseQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private db: any;

  constructor(database: any) {
    this.db = database;
  }

  /**
   * Add write operation to queue
   * @param operation - Function that performs database write
   * @returns Promise that resolves when operation completes
   */
  async enqueue<T>(operation: () => T): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queue serially
   */
  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const operation = this.queue.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          console.error('[DB Queue] Operation failed:', error);
          // Continue processing queue even if one operation fails
        }
      }
    }

    this.processing = false;
  }

  /**
   * Get queue stats for monitoring
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      processing: this.processing
    };
  }

  /**
   * Wait for queue to empty (useful for graceful shutdown)
   */
  async flush(): Promise<void> {
    while (this.queue.length > 0 || this.processing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
```

---

### Step 2.4: Integrate Queue (20 minutes)

**File to Modify**: Wherever SQLite writes occur

**Pattern**:
```typescript
import { DatabaseQueue } from '../utils/database-queue';

class MarketIntelligenceRecorder {
  private db: any;
  private dbQueue: DatabaseQueue;

  constructor() {
    this.db = // ... initialize database
    this.dbQueue = new DatabaseQueue(this.db);
  }

  // BEFORE (direct write - can cause nested transactions):
  async recordToken(token: any) {
    this.db.transaction(() => {
      this.db.prepare("INSERT INTO tokens ...").run(token);
    })();
  }

  // AFTER (queued write - always serial):
  async recordToken(token: any) {
    await this.dbQueue.enqueue(() => {
      this.db.transaction(() => {
        this.db.prepare("INSERT INTO tokens ...").run(token);
      })();
    });
  }
}
```

**Key Points**:
- ALL database writes must go through queue
- Even single INSERT statements
- Especially transaction blocks

---

### Step 2.5: Add Transaction Guards (10 minutes)

**Additional Safety**: Prevent transaction nesting at database level

```typescript
class SafeDatabaseWrapper {
  private db: any;
  private inTransaction = false;

  constructor(database: any) {
    this.db = database;
  }

  transaction(fn: () => any) {
    if (this.inTransaction) {
      throw new Error('Cannot start transaction: already in transaction');
    }

    this.inTransaction = true;
    try {
      const result = this.db.transaction(fn)();
      this.inTransaction = false;
      return result;
    } catch (error) {
      this.inTransaction = false;
      throw error;
    }
  }

  // Wrap all db methods through this wrapper
}
```

---

### Step 2.6: Test SQLite Fix (10 minutes)

**Action**: Run extended test

```bash
# Run for 20+ minutes
npm run dev

# Monitor for SQLite errors:
# - "cannot start a transaction within a transaction"
# - "cannot commit - no transaction is active"
# - "cannot rollback - no transaction is active"
```

**Success Criteria**:
- No SQLite errors
- Bot runs for 20+ minutes
- All tokens recorded correctly

**If Fails**: Check logs for which code path triggers nested transaction

---

## 💻 PHASE 3: FIX CLAUDE CODE CRASH (30-60 minutes)

### Critical Issue: Claude Code crashes when monitoring bot due to high output

### Step 3.1: Implement Output Throttling (20 minutes)

**File**: Create `src/utils/output-throttle.ts`

```typescript
/**
 * Output Throttle System
 * Prevents buffer overflow by rate-limiting console output
 */
export class OutputThrottle {
  private lastLog: Map<string, number> = new Map();
  private minInterval: number;
  private suppressedCount: Map<string, number> = new Map();

  constructor(minIntervalMs = 1000) {
    this.minInterval = minIntervalMs;
  }

  /**
   * Rate-limited console.log
   * @param key - Unique key for this log type
   * @param message - Message to log
   */
  log(key: string, message: string) {
    const now = Date.now();
    const last = this.lastLog.get(key) || 0;
    const suppressed = this.suppressedCount.get(key) || 0;

    if (now - last >= this.minInterval) {
      if (suppressed > 0) {
        console.log(`[${suppressed} similar messages suppressed]`);
        this.suppressedCount.set(key, 0);
      }
      console.log(message);
      this.lastLog.set(key, now);
    } else {
      this.suppressedCount.set(key, suppressed + 1);
    }
  }

  /**
   * Rate-limited console.error
   */
  error(key: string, message: string, error?: Error) {
    const now = Date.now();
    const last = this.lastLog.get(key) || 0;

    if (now - last >= this.minInterval) {
      console.error(message, error || '');
      this.lastLog.set(key, now);
    }
  }

  /**
   * Get throttle statistics
   */
  getStats() {
    let totalSuppressed = 0;
    this.suppressedCount.forEach(count => totalSuppressed += count);

    return {
      uniqueKeys: this.lastLog.size,
      totalSuppressed,
      interval: this.minInterval
    };
  }
}

// Singleton instance
export const throttle = new OutputThrottle(1000); // 1 log per second per key
```

---

### Step 3.2: Apply Throttling to High-Frequency Logs (20 minutes)

**Files to Modify**: Any file with logs in loops

**Pattern**:
```typescript
import { throttle } from './utils/output-throttle';

// BEFORE (logs every iteration):
for (const token of tokens) {
  console.log(`Processing token ${token.mint}...`);
  // ... processing
}

// AFTER (throttled to 1/second):
for (const token of tokens) {
  throttle.log('token-processing', `Processing token ${token.mint}...`);
  // ... processing
}
```

**High-Frequency Log Locations**:
1. `src/index.ts` - Token detection loop
2. `src/monitoring/positionMonitor.ts` - Price update loop
3. `src/analysis/marketIntelligenceRecorder.ts` - Recording loop
4. Any `for` or `while` loops with console.log

**Action**:
```bash
# Find all console.log in loops
grep -rn "for\|while" src/ | grep -A 5 "console.log"

# Replace with throttled versions
```

---

### Step 3.3: Add CPU Monitoring (15 minutes)

**File**: Modify `src/utils/process-cleanup.ts` (or create if missing)

```typescript
/**
 * CPU Monitor
 * Detects runaway processes and triggers pause
 */
export class CPUMonitor {
  private threshold: number;
  private checkInterval: number;
  private monitorId: NodeJS.Timeout | null = null;
  private pauseCallback: ((duration: number) => void) | null = null;

  constructor(thresholdMs = 500, checkIntervalMs = 1000) {
    this.threshold = thresholdMs;
    this.checkInterval = checkIntervalMs;
  }

  start() {
    let lastUsage = process.cpuUsage();

    this.monitorId = setInterval(() => {
      const currentUsage = process.cpuUsage();
      const diff = {
        user: (currentUsage.user - lastUsage.user) / 1000, // to ms
        system: (currentUsage.system - lastUsage.system) / 1000
      };

      const totalCPU = diff.user + diff.system;

      if (totalCPU > this.threshold) {
        console.error(`⚠️ CPU usage high: ${totalCPU.toFixed(0)}ms`);

        if (this.pauseCallback) {
          console.log('🛑 Pausing detection for 5 seconds...');
          this.pauseCallback(5000);
        }
      }

      lastUsage = currentUsage;
    }, this.checkInterval);
  }

  onHighCPU(callback: (duration: number) => void) {
    this.pauseCallback = callback;
  }

  stop() {
    if (this.monitorId) {
      clearInterval(this.monitorId);
      this.monitorId = null;
    }
  }
}
```

**Integration** in `src/index.ts`:
```typescript
import { CPUMonitor } from './utils/process-cleanup';

const cpuMonitor = new CPUMonitor(500, 1000);

cpuMonitor.onHighCPU((duration) => {
  // Pause gRPC detection temporarily
  if (globalGrpcStream) {
    globalGrpcStream.pause();
    setTimeout(() => {
      globalGrpcStream?.resume();
      console.log('✅ Detection resumed');
    }, duration);
  }
});

cpuMonitor.start();
```

---

### Step 3.4: Test Monitoring (5 minutes)

**Action**: Monitor bot with throttling enabled

```bash
# Run bot
npm run dev > bot-output.log 2>&1

# In another terminal, monitor log size
watch -n 1 'ls -lh bot-output.log'
```

**Success Criteria**:
- Log file grows slowly (<1MB per minute)
- No excessive repetitive logs
- CPU stays under 100%
- Claude Code can monitor without crashing

---

## 📊 PHASE 4: CREATE LIVE MONITOR DASHBOARD (2-4 hours)

### Goal: Independent monitoring system (not Claude Code)

### Step 4.1: Create HTTP Server (60 minutes)

**File**: Create `src/monitoring/live-monitor-server.ts`

```typescript
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import path from 'path';

/**
 * Live Monitor Server
 * Provides real-time web dashboard for bot monitoring
 */
export class LiveMonitorServer {
  private app: express.Application;
  private server: http.Server;
  private io: SocketIOServer;
  private port: number;
  private stats: any = {
    tokensDetected: 0,
    tokensBought: 0,
    tokensRejected: 0,
    poolBalance: 0,
    winRate: 0,
    recentTrades: [],
    startTime: Date.now(),
    status: 'initializing'
  };

  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIOServer(this.server);
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  private setupRoutes() {
    // Serve static dashboard
    this.app.use(express.static(path.join(__dirname, 'public')));

    // API endpoint for current stats
    this.app.get('/api/stats', (req, res) => {
      res.json(this.stats);
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', uptime: Date.now() - this.stats.startTime });
    });
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`📊 Dashboard connected: ${socket.id}`);

      // Send current stats on connect
      socket.emit('stats', this.stats);

      socket.on('disconnect', () => {
        console.log(`📊 Dashboard disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Update stats and broadcast to all connected clients
   */
  updateStats(updates: Partial<typeof this.stats>) {
    this.stats = { ...this.stats, ...updates };
    this.io.emit('stats', this.stats);
  }

  /**
   * Emit event to dashboard
   */
  emit(event: string, data: any) {
    this.io.emit(event, data);
  }

  /**
   * Start server
   */
  start() {
    this.server.listen(this.port, () => {
      console.log(`📊 Live Monitor: http://localhost:${this.port}`);
    });
  }

  /**
   * Stop server
   */
  stop() {
    this.io.close();
    this.server.close();
  }
}
```

---

### Step 4.2: Create Dashboard HTML (60 minutes)

**File**: Create `src/monitoring/public/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sol-Bot Live Monitor</title>
  <script src="/socket.io/socket.io.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #0f0f0f;
      color: #e0e0e0;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 {
      color: #4CAF50;
      margin-bottom: 20px;
      font-size: 2em;
    }
    .status {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 5px;
      font-weight: bold;
      margin-left: 20px;
    }
    .status.running { background: #4CAF50; color: white; }
    .status.paused { background: #FFC107; color: black; }
    .status.error { background: #f44336; color: white; }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: #1a1a1a;
      padding: 20px;
      border-radius: 10px;
      border: 1px solid #333;
    }
    .card h2 {
      color: #4CAF50;
      font-size: 1.2em;
      margin-bottom: 10px;
    }
    .metric {
      font-size: 2.5em;
      font-weight: bold;
      color: #4CAF50;
      margin: 10px 0;
    }
    .label {
      color: #888;
      font-size: 0.9em;
    }

    .trades-table {
      width: 100%;
      background: #1a1a1a;
      border-radius: 10px;
      overflow: hidden;
    }
    .trades-table h2 {
      color: #4CAF50;
      padding: 20px;
      border-bottom: 1px solid #333;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: #2a2a2a;
      padding: 12px;
      text-align: left;
      color: #4CAF50;
      font-weight: 600;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #333;
    }
    tr:hover { background: #252525; }

    .profit { color: #4CAF50; }
    .loss { color: #f44336; }

    .chart {
      height: 300px;
      background: #1a1a1a;
      border-radius: 10px;
      padding: 20px;
      margin-top: 20px;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .pulse { animation: pulse 2s infinite; }
  </style>
</head>
<body>
  <div class="container">
    <h1>
      🤖 Sol-Bot Live Monitor
      <span class="status running" id="status">RUNNING</span>
    </h1>

    <div class="grid">
      <div class="card">
        <h2>Tokens Detected</h2>
        <div class="metric" id="tokensDetected">0</div>
        <div class="label">Total detected via gRPC</div>
      </div>

      <div class="card">
        <h2>Tokens Bought</h2>
        <div class="metric" id="tokensBought">0</div>
        <div class="label"><span id="buyRate">0%</span> success rate</div>
      </div>

      <div class="card">
        <h2>Pool Balance</h2>
        <div class="metric" id="poolBalance">$0</div>
        <div class="label"><span id="roi">+0%</span> ROI</div>
      </div>

      <div class="card">
        <h2>Win Rate</h2>
        <div class="metric" id="winRate">0%</div>
        <div class="label"><span id="wins">0</span> wins / <span id="total">0</span> trades</div>
      </div>

      <div class="card">
        <h2>Runtime</h2>
        <div class="metric" id="runtime">0:00:00</div>
        <div class="label">Session uptime</div>
      </div>

      <div class="card">
        <h2>Detection Rate</h2>
        <div class="metric" id="detectionRate">0</div>
        <div class="label">tokens per hour</div>
      </div>
    </div>

    <div class="trades-table">
      <h2>Recent Trades (Last 10)</h2>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Token</th>
            <th>Entry</th>
            <th>Current</th>
            <th>P&L</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="tradesBody">
          <tr>
            <td colspan="6" style="text-align: center; color: #888;">
              No trades yet...
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <script>
    const socket = io();

    // Update stats on receive
    socket.on('stats', (data) => {
      document.getElementById('tokensDetected').textContent = data.tokensDetected;
      document.getElementById('tokensBought').textContent = data.tokensBought;
      document.getElementById('poolBalance').textContent = `$${data.poolBalance.toFixed(2)}`;
      document.getElementById('winRate').textContent = `${data.winRate.toFixed(1)}%`;

      const buyRate = data.tokensDetected > 0
        ? (data.tokensBought / data.tokensDetected * 100).toFixed(1)
        : 0;
      document.getElementById('buyRate').textContent = `${buyRate}%`;

      updateTrades(data.recentTrades);
    });

    // Update trades table
    function updateTrades(trades) {
      const tbody = document.getElementById('tradesBody');
      if (trades.length === 0) return;

      tbody.innerHTML = trades.slice(0, 10).map(trade => `
        <tr>
          <td>${new Date(trade.time).toLocaleTimeString()}</td>
          <td>${trade.mint.slice(0, 8)}...</td>
          <td>$${trade.entryPrice.toFixed(6)}</td>
          <td>$${trade.currentPrice.toFixed(6)}</td>
          <td class="${trade.pnl >= 0 ? 'profit' : 'loss'}">
            ${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}%
          </td>
          <td>${trade.status}</td>
        </tr>
      `).join('');
    }

    // Update runtime
    let startTime = Date.now();
    socket.on('stats', (data) => {
      startTime = data.startTime;
    });

    setInterval(() => {
      const elapsed = Date.now() - startTime;
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      document.getElementById('runtime').textContent =
        `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);

    // Connection status
    socket.on('connect', () => {
      document.getElementById('status').textContent = 'CONNECTED';
      document.getElementById('status').className = 'status running';
    });

    socket.on('disconnect', () => {
      document.getElementById('status').textContent = 'DISCONNECTED';
      document.getElementById('status').className = 'status error';
    });
  </script>
</body>
</html>
```

---

### Step 4.3: Integrate with Bot (30 minutes)

**File**: Modify `src/index.ts`

```typescript
import { LiveMonitorServer } from './monitoring/live-monitor-server';

// Initialize at startup
const liveMonitor = new LiveMonitorServer(3000);
liveMonitor.start();

// Update on token detection
function onTokenDetected(mint: string, score: number) {
  liveMonitor.updateStats({
    tokensDetected: ++tokensDetected
  });
  liveMonitor.emit('tokenDetected', { mint, score, time: Date.now() });
}

// Update on token buy
function onTokenBought(mint: string, price: number, amount: number) {
  liveMonitor.updateStats({
    tokensBought: ++tokensBought
  });
  liveMonitor.emit('tokenBought', { mint, price, amount, time: Date.now() });
}

// Update on exit signal
function onExitSignal(mint: string, tier: string, pnl: number) {
  liveMonitor.emit('exitSignal', { mint, tier, pnl, time: Date.now() });
}

// Graceful shutdown
process.on('SIGINT', () => {
  liveMonitor.stop();
  process.exit(0);
});
```

---

### Step 4.4: Install Dependencies (5 minutes)

```bash
npm install express socket.io
npm install --save-dev @types/express
```

---

### Step 4.5: Test Dashboard (5 minutes)

```bash
# Terminal 1: Run bot
npm run dev

# Terminal 2 (or browser): Open dashboard
open http://localhost:3000

# Verify:
# - Dashboard loads
# - Stats update in real-time
# - No crashes
# - Can watch bot without Claude Code
```

---

## 🔄 PHASE 5: SEPARATE BASELINE RECORDER (1 hour)

### Goal: Run baseline 1s recorder independently from bot

### Step 5.1: Create Standalone Script (30 minutes)

**File**: Create `scripts/baseline-1s-recorder.ts`

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import Database from 'better-sqlite3';
import path from 'path';

/**
 * Standalone Baseline 1s Chart Recorder
 * Runs independently to record all new mints for backtesting
 */
class Baseline1sRecorder {
  private db: Database.Database;
  private connection: Connection;
  private running = false;

  constructor() {
    // Initialize database
    const dbPath = path.join(__dirname, '../data/baseline-1s-chart.db');
    this.db = new Database(dbPath);
    this.setupDatabase();

    // Initialize RPC connection
    this.connection = new Connection(process.env.RPC_HTTPS_URI || '');
  }

  private setupDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mints (
        mint TEXT PRIMARY KEY,
        detected_at INTEGER,
        bonding_curve TEXT
      );

      CREATE TABLE IF NOT EXISTS prices (
        mint TEXT,
        timestamp INTEGER,
        price_sol REAL,
        price_usd REAL,
        PRIMARY KEY (mint, timestamp)
      );

      CREATE INDEX IF NOT EXISTS idx_prices_mint ON prices(mint);
      CREATE INDEX IF NOT EXISTS idx_prices_timestamp ON prices(timestamp);
    `);
  }

  async start() {
    this.running = true;
    console.log('📊 Baseline 1s Recorder Started');
    console.log('   Database: data/baseline-1s-chart.db');
    console.log('   Update Interval: 1 second');

    // Subscribe to gRPC for new mints
    // (implement gRPC subscription similar to main bot)

    // Start 1s price update loop
    this.startPriceLoop();
  }

  private async startPriceLoop() {
    while (this.running) {
      const mints = this.getActivePositions();

      for (const mint of mints) {
        try {
          const price = await this.fetchPrice(mint);
          if (price) {
            this.recordPrice(mint, price);
          }
        } catch (error) {
          // Silent fail - don't spam logs
        }
      }

      // Wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private getActivePositions(): string[] {
    // Get all mints detected in last 24 hours
    const stmt = this.db.prepare(`
      SELECT mint FROM mints
      WHERE detected_at > ?
    `);
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    return stmt.all(dayAgo).map((row: any) => row.mint);
  }

  private async fetchPrice(mint: string): Promise<number | null> {
    // Fetch price from RPC or API
    // (implement price fetching logic)
    return null;
  }

  private recordPrice(mint: string, price: number) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO prices (mint, timestamp, price_sol, price_usd)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(mint, Date.now(), price, price * 155); // Assume $155 SOL
  }

  stop() {
    this.running = false;
    this.db.close();
    console.log('📊 Baseline Recorder Stopped');
  }
}

// Run if called directly
if (require.main === module) {
  const recorder = new Baseline1sRecorder();
  recorder.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    recorder.stop();
    process.exit(0);
  });
}
```

---

### Step 5.2: Add NPM Script (5 minutes)

**File**: Modify `package.json`

```json
{
  "scripts": {
    "dev": "ts-node src/index.ts",
    "baseline-recorder": "ts-node scripts/baseline-1s-recorder.ts"
  }
}
```

---

### Step 5.3: Test Independence (10 minutes)

```bash
# Terminal 1: Run baseline recorder
npm run baseline-recorder

# Terminal 2: Run bot
npm run dev

# Verify:
# - Both run simultaneously
# - Bot doesn't crash
# - Baseline records data
# - No conflicts
```

---

### Step 5.4: Document Usage (15 minutes)

**File**: Create `BASELINE-RECORDER-GUIDE.md`

```markdown
# Baseline 1s Chart Recorder Guide

## Purpose

Records ALL new mint launches with 1-second price resolution for:
- Backtesting new algorithms
- Market pattern analysis
- Performance comparison

## Running

### Optional (for market data collection):
```bash
# Terminal 1: Baseline recorder
npm run baseline-recorder
```

### Required (bot):
```bash
# Terminal 2: Bot
npm run dev
```

## Data Location

- Database: `data/baseline-1s-chart.db`
- Tables:
  - `mints`: All detected tokens
  - `prices`: 1-second price history

## Querying Data

```sql
-- Get all tokens from last hour
SELECT * FROM mints
WHERE detected_at > strftime('%s', 'now', '-1 hour') * 1000;

-- Get price chart for specific token
SELECT timestamp, price_sol, price_usd
FROM prices
WHERE mint = 'TOKEN_MINT_ADDRESS'
ORDER BY timestamp;
```

## Notes

- Runs independently from bot
- Own database (no conflicts)
- Optional for bot operation
- Useful for backtesting
```

---

## ✅ PHASE 6: VALIDATION & TESTING (2-3 hours)

### Step 6.1: Validate All Fixes (30 minutes)

**Checklist**:
- [ ] Retry logic verified in tokenHandler.ts
- [ ] RPC configuration using Helius
- [ ] SQLite transaction queue implemented
- [ ] Output throttling applied
- [ ] Live monitor dashboard working
- [ ] Baseline recorder separated

**Action**: Run verification script

```bash
# Create verification script
cat << 'EOF' > scripts/verify-all-fixes.sh
#!/bin/bash

echo "🔍 Verifying All Fixes..."

# Check retry logic
if grep -q "VIP2 RETRY LOGIC" src/utils/handlers/tokenHandler.ts; then
  echo "✅ Retry logic present"
else
  echo "❌ Retry logic missing"
fi

# Check RPC config
if grep -q "helius-rpc.com" .env && ! grep -q "^RPC_OVERRIDE" .env; then
  echo "✅ Helius RPC configured"
else
  echo "❌ RPC configuration incorrect"
fi

# Check SQLite queue
if [ -f "src/utils/database-queue.ts" ]; then
  echo "✅ Database queue created"
else
  echo "❌ Database queue missing"
fi

# Check output throttle
if [ -f "src/utils/output-throttle.ts" ]; then
  echo "✅ Output throttle created"
else
  echo "❌ Output throttle missing"
fi

# Check live monitor
if [ -f "src/monitoring/live-monitor-server.ts" ]; then
  echo "✅ Live monitor created"
else
  echo "❌ Live monitor missing"
fi

echo ""
echo "Verification complete!"
EOF

chmod +x scripts/verify-all-fixes.sh
./scripts/verify-all-fixes.sh
```

---

### Step 6.2: Extended Test Run (90 minutes)

**Goal**: Verify bot runs for 60+ minutes without crashes

**Action**:
```bash
# Terminal 1: Run bot
npm run dev

# Terminal 2: Monitor dashboard
open http://localhost:3000

# Terminal 3: Monitor logs
tail -f bot-output.log | grep -E "ERROR|WARNING|SQLite"
```

**Monitor For**:
- ✅ 100% buy rate maintained
- ✅ No SQLite transaction errors
- ✅ No Claude Code crashes
- ✅ Dashboard updates correctly
- ✅ Memory usage stable
- ✅ CPU usage reasonable

**Success Criteria**:
- Bot runs for 60+ minutes
- 50+ tokens bought
- 100% success rate
- No crashes or errors

---

### Step 6.3: Validate Tax Recording (30 minutes)

**Action**: Check if trades recorded correctly

```bash
# Check tax log
cat data/tax_log.jsonl | jq '.[] | {mint, type, amount, pnl}'

# Verify cost basis
cat data/cost_basis.json | jq '.'

# Check complete transactions
cat data/complete_transactions.json | jq '.[] | {date, pnl, status}'
```

**Success Criteria**:
- All trades logged in tax_log.jsonl
- Cost basis calculated
- P&L computed
- Export format compatible with tax services

---

## 🚀 PHASE 7: MICRO LIVE TESTING (1-2 hours)

**⚠️ WARNING**: This phase involves REAL MONEY. Start small.

### Step 7.1: Switch to MICRO Mode (5 minutes)

**File**: `src/core/UNIFIED-CONTROL.ts` line 313

```typescript
// BEFORE:
currentMode: TradingMode.PAPER,

// AFTER:
currentMode: TradingMode.MICRO,
```

**Position Size**: $0.15 per trade (0.001 SOL)
**Max Trades**: 10

---

### Step 7.2: Pre-Flight Checklist (10 minutes)

**Verify**:
- [ ] Mode set to MICRO ($0.15)
- [ ] Max trades set to 10
- [ ] Emergency stop script ready
- [ ] Wallet has sufficient SOL (~$5)
- [ ] Dashboard running
- [ ] No active issues

---

### Step 7.3: Run Micro Test (30-60 minutes)

**Action**:
```bash
# Terminal 1: Bot
npm run dev

# Terminal 2: Dashboard
open http://localhost:3000

# Terminal 3: Monitor
tail -f bot-output.log
```

**Watch For**:
- Real transaction signatures
- Actual token purchases
- Exit signals trigger
- Sells execute
- P&L calculations

**Emergency Stop**:
```bash
# If things go wrong:
pkill -f "ts-node"

# Or use emergency script:
npm run emergency-stop
```

---

### Step 7.4: Analyze Micro Results (15 minutes)

**Compare**:
| Metric | Paper Mode | Live Micro Mode | Delta |
|--------|------------|-----------------|-------|
| Entry Speed | ??? | ??? | ??? |
| Exit Speed | ??? | ??? | ??? |
| Win Rate | ??? | ??? | ??? |
| Token Quality | ??? | ??? | ??? |

**Questions**:
- Do trades execute as fast as paper mode?
- Are exit signals accurate?
- Is token quality consistent?
- Any unexpected behavior?

---

## 📝 PHASE 8: DOCUMENTATION (30 minutes)

### Step 8.1: Update README (15 minutes)

**File**: Modify `README.md`

Add sections:
- Quick start guide
- Mode selection (PAPER, MICRO, PRODUCTION)
- Dashboard usage
- Troubleshooting common issues

---

### Step 8.2: Create Production Checklist (15 minutes)

**File**: Create `PRODUCTION-READINESS-CHECKLIST.md`

```markdown
# Production Readiness Checklist

## Before Going Live

### Code & Configuration
- [ ] All fixes from Nov 6-7 verified
- [ ] Mode set to PRODUCTION
- [ ] Position size appropriate ($15 default)
- [ ] Max trades configured
- [ ] Emergency stop tested

### Testing
- [ ] Paper mode: 8+ hours stable
- [ ] Micro mode: 10 trades successful
- [ ] Live dashboard working
- [ ] Tax recording validated
- [ ] No memory leaks
- [ ] No CPU issues

### Monitoring
- [ ] Dashboard accessible
- [ ] Log rotation configured
- [ ] Alerts set up (optional)
- [ ] Emergency contact available

### Safety
- [ ] Wallet funded (not too much!)
- [ ] Emergency stop script ready
- [ ] Backup of all data
- [ ] Documentation read

## After Going Live

- [ ] Monitor first 30 minutes closely
- [ ] Check first 10 trades
- [ ] Verify exit signals work
- [ ] Confirm tax recording
- [ ] Review after 24 hours
```

---

## 🎯 SUCCESS CRITERIA

### Phase 1: Emergency Verification ✅
- All Nov 6 fixes verified in code
- 100% buy rate restored
- Quick test (60s) succeeds

### Phase 2: SQLite Fix ✅
- No transaction errors
- Bot runs 20+ minutes
- All data recorded correctly

### Phase 3: Claude Code Fix ✅
- Log output manageable
- CPU usage under 100%
- Dashboard works for monitoring

### Phase 4: Live Dashboard ✅
- Web interface accessible
- Real-time updates working
- No crashes during monitoring

### Phase 5: Baseline Separation ✅
- Runs independently
- No bot interference
- Data recorded correctly

### Phase 6: Extended Testing ✅
- 60+ minutes stable
- 50+ tokens bought
- 100% success rate
- No errors or crashes

### Phase 7: Micro Testing ✅
- 10 real trades execute
- Paper vs live behavior matches
- Exit signals work
- Tax recording validates

---

## 📊 ESTIMATED TIMELINE

| Phase | Task | Time | Complexity |
|-------|------|------|------------|
| 1 | Emergency Verification | 30 min | Low |
| 2 | Fix SQLite Errors | 90 min | Medium |
| 3 | Fix Claude Code Crash | 60 min | Medium |
| 4 | Create Live Dashboard | 180 min | High |
| 5 | Separate Baseline | 60 min | Low |
| 6 | Validation & Testing | 150 min | Medium |
| 7 | Micro Live Testing | 90 min | Low (but REAL $$) |
| 8 | Documentation | 30 min | Low |

**Total**: 11.5 hours (1-2 days of work)

**Critical Path** (minimum for testing):
- Phase 1: 30 min
- Phase 2: 90 min
- Phase 6: 90 min (short test)
- **Total Critical**: 3.5 hours

---

## 🚨 EMERGENCY PROCEDURES

### If Bot Crashes:
1. Save logs: `cp bot-output.log crash-$(date +%Y%m%d-%H%M%S).log`
2. Check error message
3. Consult COMPREHENSIVE-PROGRESS-STATUS-REPORT-2025-11-07.md
4. Restore from known good state if needed

### If Live Trading Goes Wrong:
1. Run emergency stop: `npm run emergency-stop`
2. Check wallet: `solana balance`
3. Review dashboard for last trades
4. Analyze what went wrong before restarting

### If Dashboard Crashes:
1. Bot continues running (independent)
2. Restart dashboard: Refresh http://localhost:3000
3. Check bot logs directly if needed

---

## 📚 NEXT STEPS AFTER COMPLETION

1. **Monitor Production**:
   - First 24 hours: Check every hour
   - First week: Check daily
   - Ongoing: Weekly reviews

2. **Optimize**:
   - Fine-tune position sizes
   - Adjust exit tiers
   - Improve token selection
   - Enhance entry criteria

3. **Scale**:
   - Increase position size gradually
   - Add more sophisticated strategies
   - Implement advanced features

4. **Maintain**:
   - Regular backups
   - Log rotation
   - Performance monitoring
   - Tax compliance updates

---

**Plan Created**: November 7, 2025
**Plan Owner**: User (novice coder - needs exact file locations)
**Estimated Completion**: 1-2 days with focused work
**Priority**: CRITICAL - Bot currently has regression issues
