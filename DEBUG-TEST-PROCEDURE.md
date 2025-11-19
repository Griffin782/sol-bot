# DEBUG TEST PROCEDURE - Baseline Recorder

**Date:** November 4, 2025
**Issue:** Only tracking 3.7% of tokens (1 out of 27)
**Goal:** Find EXACTLY where the other 26 tokens are being rejected

---

## ✅ DEBUG LOGGING ADDED

### What Was Added:

**File:** `market-intelligence/handlers/market-recorder.ts`

**Logging Points:**
1. **Lines 335-341**: Before shouldRecordToken() check
   - Shows score, min_score, baseline mode, decision
2. **Lines 359-366**: Entry to startTrackingToken()
   - Shows if token is in memory
3. **Lines 379-384**: Database check decision
   - Shows if baseline mode, whether DB check will run
4. **Lines 413-417**: Successful tracking
   - Shows token added to memory, counter incremented
5. **Line 470**: Final success message

---

## 🧪 TEST PROCEDURE (Windows PowerShell)

### Step 1: Stop Running Recorder (If Any)
```powershell
# Find the process
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Select-Object Id, ProcessName, StartTime

# Kill baseline recorder process
# Replace [PID] with actual process ID from above
Stop-Process -Id [PID] -Force
```

### Step 2: Delete Old Database (Fresh Start)
```powershell
# Remove old database file (Windows syntax)
Remove-Item .\data\market-baseline\baseline-2025-11-04.db -ErrorAction SilentlyContinue

# Verify it's deleted
Get-ChildItem .\data\market-baseline\
```

### Step 3: Start Baseline Recorder with Debug Logs
```powershell
npm run mi-baseline
```

### Step 4: Watch for Debug Output

**Expected output for SUCCESSFUL tracking:**
```
🔍 [DEBUG] Token AbCdEfGh:
   - Score: 45
   - Min Score Required: 0
   - Baseline Mode: true
   - record_all_tokens: true
   - shouldRecordToken() returned: true
   - Decision: ✅ WILL TRACK

📊 [START_TRACKING] Token AbCdEfGh - ENTERED startTrackingToken()
✅ [IN-MEMORY CHECK] Token AbCdEfGh not in memory - continuing...
🔍 [DB CHECK] Baseline Mode: true
🔍 [DB CHECK] Will SKIP database duplicate check
📊 [BASELINE MODE] Token AbCdEfGh - SKIPPING database duplicate check
✅ [TRACKING] Token AbCdEfGh added to in-memory tracking set
✅ [TRACKING] tokens_tracked counter incremented to: 1
📊 Recorded: ABC (Score: 45) [No price tracking]
✅ [SUCCESS] Token AbCdEfGh SUCCESSFULLY TRACKED - END OF FUNCTION
```

**Expected output for REJECTED token:**
```
🔍 [DEBUG] Token XyZ12345:
   - Score: 35
   - Min Score Required: 0
   - Baseline Mode: true
   - record_all_tokens: true
   - shouldRecordToken() returned: false  ← ❌ THE PROBLEM
   - Decision: ❌ REJECTED

⏭️  Token XyZ12345 REJECTED by shouldRecordToken()
```

### Step 5: Let Run for 3-5 Minutes

Watch the terminal output carefully. For EACH token, you'll see either:
- ✅ Full tracking flow (all the way to "SUCCESSFULLY TRACKED")
- ❌ Rejection at shouldRecordToken()

### Step 6: Stop and Check Final Stats
```powershell
# Press Ctrl+C to stop

# Final stats will show:
📊 FINAL STATISTICS:
   Tokens Detected: 27
   Tokens Tracked: ?  ← WHAT IS THIS NUMBER?
```

### Step 7: Check Database
```powershell
node scripts/analyze-session-db.js .\data\market-baseline\baseline-2025-11-04.db
```

---

## 🔍 WHAT TO LOOK FOR

### Scenario 1: Rejected by shouldRecordToken()
**Log shows:**
```
shouldRecordToken() returned: false
Decision: ❌ REJECTED
```
**Problem:** The `shouldRecordToken()` function in mi-config.ts is still filtering
**Location:** `market-intelligence/config/mi-config.ts:345-363`

### Scenario 2: Rejected by In-Memory Check
**Log shows:**
```
[IN-MEMORY CHECK] Token already in memory - REJECTED
```
**Problem:** Token appearing multiple times too quickly
**This is NORMAL** - same token shouldn't be tracked twice in same session

### Scenario 3: Rejected by Database Check (SHOULDN'T HAPPEN)
**Log shows:**
```
[DB CHECK] BOT MODE - checking database for duplicates...
```
**Problem:** isBaselineMode is FALSE when it should be TRUE
**Location:** Config not setting `record_all_tokens: true`

### Scenario 4: All Pass but Counter Doesn't Increment
**Log shows:**
```
✅ [SUCCESS] Token SUCCESSFULLY TRACKED
```
**But final stats show only 1 tracked**
**Problem:** Counter or database write failing silently

---

## 📊 EXPECTED RESULTS

### If Fix Works (100% Tracking):
```
Tokens Detected: 27
Tokens Tracked: 27 (or close, some duplicates OK)
Tracking Ratio: ~100%

All tokens show:
✅ [SUCCESS] Token ... SUCCESSFULLY TRACKED
```

### If Fix Doesn't Work (Still Broken):
```
Tokens Detected: 27
Tokens Tracked: 1-2
Tracking Ratio: 3-7%

Most tokens show:
❌ REJECTED by shouldRecordToken()
```

---

## 🐛 DEBUG SCENARIOS

### Debug Scenario A: shouldRecordToken() Returns False

**What to check:**
1. Look at debug log line: `shouldRecordToken() returned: false`
2. Check if `record_all_tokens` is actually `true`
3. Check if `min_score_to_track` is actually `0`

**File to examine:** `market-intelligence/config/mi-config.ts:345-363`

**The function should look like:**
```typescript
export function shouldRecordToken(score: number, config: MarketIntelligenceConfig): boolean {
  if (!config.recording.enabled) return false;

  console.log(`[shouldRecordToken] record_all_tokens: ${config.recording.record_all_tokens}, score: ${score}, min_score: ${config.scoring.min_score_to_track}`);

  // CRITICAL: Check record_all_tokens flag FIRST
  if (config.recording.record_all_tokens) {
    console.log(`[shouldRecordToken] ✅ RECORDING TOKEN (record_all_tokens=true)`);
    return true;  // Baseline mode: record EVERYTHING
  }

  // Bot session logic (filtered)
  if (!config.scoring.enabled) return true;

  const shouldRecord = score >= config.scoring.min_score_to_track;
  console.log(`[shouldRecordToken] ${shouldRecord ? '✅' : '❌'} score ${score} >= min ${config.scoring.min_score_to_track}`);
  return shouldRecord;
}
```

### Debug Scenario B: Config Not Loading Correctly

**What to check:**
1. Look for: `Baseline Mode: false` when it should be `true`
2. Check standalone-recorder.ts config

**File to examine:** `market-intelligence/standalone-recorder.ts:86-113`

**Should show:**
```typescript
const baselineConfig = {
  recording: {
    enabled: true,
    record_all_tokens: true,  // ← MUST BE TRUE
    // ...
  },
  scoring: {
    enabled: true,
    min_score_to_track: 0,    // ← MUST BE 0
    // ...
  }
}
```

### Debug Scenario C: Database Path Wrong

**What to check:**
1. Look for: `Database: ./data/market-intelligence/...` instead of `./data/market-baseline/...`
2. Check if using old database path

**Expected log:**
```
📁 Database: ./data/market-baseline/baseline-2025-11-04.db
📊 Recording: ALL TOKENS (baseline)
```

---

## 📋 VERIFICATION CHECKLIST

After test completes, verify:

- [ ] Database file created: `.\data\market-baseline\baseline-2025-11-04.db`
- [ ] Tracking ratio: ~100% (not 3.7%)
- [ ] Debug logs show: `shouldRecordToken() returned: true` for most tokens
- [ ] Debug logs show: `Baseline Mode: true`
- [ ] Debug logs show: `Will SKIP database duplicate check`
- [ ] Final counter matches tokens detected
- [ ] No `❌ REJECTED` messages for valid tokens

---

## 🔄 IF TEST FAILS AGAIN

### Copy These Logs:
1. **First 3 tokens detected** (full debug output)
2. **Final statistics** (tokens detected vs tracked)
3. **Config check logs** (baseline mode, record_all_tokens)

### What This Will Tell Us:
- **Scenario A**: shouldRecordToken() is the problem → Fix mi-config.ts
- **Scenario B**: Config not loading → Fix standalone-recorder.ts
- **Scenario C**: Database check still running → Fix market-recorder.ts
- **Scenario D**: Something else entirely → Need deeper analysis

---

**Created:** November 4, 2025
**Purpose:** Stop guessing, start debugging with evidence
**Next:** Run test, capture logs, find the REAL problem
