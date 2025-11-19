# Usage Examples

**Purpose**: Step-by-step instructions for using the systematic analysis system on specific issues

---

## Example 1: Paper Trading Not Working

**Symptom**: Bot configured for paper trading (TEST_MODE/PAPER mode) but not executing any trades

**Goal**: Find where configuration breaks or is ignored

### Files to Analyze (In Order)

#### Step 1: Analyze UNIFIED-CONTROL.ts

**Why**: This is where trading mode is defined

**What to Check**:
1. Line 272: `currentMode: TradingMode.PAPER` or `TradingMode.LIVE`
2. Does `MASTER_SETTINGS` export correctly?
3. Does `getCurrentMode()` function work?
4. Is `TradingMode` enum properly defined?

**Use Generic Prompt**:
```
Copy GENERIC-FILE-ANALYSIS-PROMPT.md
Replace [FILENAME] with: src/core/UNIFIED-CONTROL.ts
Run analysis
```

**Expected Findings**:
- ✅ currentMode set correctly
- ✅ MASTER_SETTINGS exports all settings
- ✅ getCurrentMode() returns currentMode
- ✅ TradingMode enum has PAPER and LIVE values

**Potential Issues**:
- ❌ Line 272 hardcoded to wrong mode
- ❌ MASTER_SETTINGS not exported
- ❌ getCurrentMode() not exported

**Record In**: ANALYSIS-TRACKING-SHEET.md under "File 1"

---

#### Step 2: Analyze CONFIG-BRIDGE.ts

**Why**: This translates UNIFIED-CONTROL settings to legacy variable names

**What to Check**:
1. Does it import from UNIFIED-CONTROL correctly?
2. Line 57: How is `TEST_MODE` derived?
3. Does it export `TEST_MODE` correctly?
4. Are there any overrides or hardcoded values?

**Use Generic Prompt**:
```
Copy GENERIC-FILE-ANALYSIS-PROMPT.md
Replace [FILENAME] with: src/core/CONFIG-BRIDGE.ts
Run analysis
```

**Expected Findings**:
- ✅ Imports MASTER_SETTINGS from UNIFIED-CONTROL
- ✅ TEST_MODE = (MASTER_SETTINGS.currentMode === TradingMode.PAPER)
- ✅ Exports TEST_MODE to index.ts

**Potential Issues**:
- ❌ Wrong import path
- ❌ TEST_MODE always true or false (hardcoded)
- ❌ Not exported properly

**Cross-File Verification**:
- Check: Does UNIFIED-CONTROL actually export what CONFIG-BRIDGE imports?
- Check: Does anything else import TEST_MODE from CONFIG-BRIDGE?

**Record In**: ANALYSIS-TRACKING-SHEET.md under "File 2"

---

#### Step 3: Analyze index.ts (Main Bot Controller)

**Why**: This is where TEST_MODE should control behavior

**What to Check**:
1. Line 3 (or near): Does it import TEST_MODE from CONFIG-BRIDGE?
2. Line 850: `if (TEST_MODE)` or `if (false)`?
3. Are there other test mode checks?
4. Does it call jupiterHandler with test mode parameter?

**Use Generic Prompt**:
```
Copy GENERIC-FILE-ANALYSIS-PROMPT.md
Replace [FILENAME] with: src/index.ts
Run analysis
```

**Expected Findings**:
- ✅ Imports TEST_MODE from CONFIG-BRIDGE
- ✅ Line 850 uses TEST_MODE (not hardcoded)
- ✅ All test mode checks use TEST_MODE variable
- ✅ Passes test mode to trade execution functions

**Potential Issues**:
- ❌ Imports TEST_MODE but never uses it
- ❌ Line 850 has `if (false)` instead of `if (TEST_MODE)`
- ❌ Some checks use TEST_MODE, others hardcoded
- ❌ jupiterHandler doesn't receive test mode info

**Record In**: ANALYSIS-TRACKING-SHEET.md under "File 3"

---

#### Step 4: Analyze jupiterHandler.ts

**Why**: This is where actual trades execute - must respect test mode

**What to Check**:
1. Does it import TEST_MODE or receive it as parameter?
2. In `swapToken()` function: Is there test mode check?
3. Are there hardcoded overrides?
4. Does it check .env for TEST_MODE (bypassing config)?

**Use Generic Prompt**:
```
Copy GENERIC-FILE-ANALYSIS-PROMPT.md
Replace [FILENAME] with: src/utils/handlers/jupiterHandler.ts
Run analysis
```

**Expected Findings**:
- ✅ Receives test mode parameter or imports TEST_MODE
- ✅ swapToken() checks test mode before executing
- ✅ In test mode: simulates trade, returns success
- ✅ In live mode: executes real blockchain transaction

**Potential Issues**:
- ❌ No test mode check at all
- ❌ Test mode check exists but always false
- ❌ Checks .env directly (bypasses UNIFIED-CONTROL)
- ❌ Executes real trades regardless of test mode

**Record In**: ANALYSIS-TRACKING-SHEET.md under "File 4"

---

### Expected Outcome

After analyzing these 4 files, you should find:

**The Break Point**: Exact line where configuration stops being respected

**Common Issues**:
1. Line 272 in UNIFIED-CONTROL set to wrong mode
2. CONFIG-BRIDGE not deriving TEST_MODE correctly
3. index.ts has `if (false)` hardcoded at Line 850
4. jupiterHandler doesn't check test mode before executing

**Root Cause Example**:
```
File: src/index.ts, Line 850
Issue: if (false) {  // WAS: if (TEST_MODE)
Impact: Test mode safety checks never run
Fix: Change to: if (TEST_MODE) {
```

---

## Example 2: Market Intelligence System Not Recording

**Symptom**: MI system exists, bot imports MarketRecorder, but no data is recorded

**Goal**: Find where MI system initialization or integration breaks

### Files to Analyze (In Order)

#### Step 1: Analyze mi-config.ts

**Why**: This defines MI system configuration

**What to Check**:
1. Does `getMarketIntelligenceConfig()` function exist?
2. What does it return?
3. Is recording enabled by default?
4. Are database paths correct?

**Use Generic Prompt**:
```
Copy GENERIC-FILE-ANALYSIS-PROMPT.md
Replace [FILENAME] with: market-intelligence/config/mi-config.ts
Run analysis
```

**Expected Findings**:
- ✅ getMarketIntelligenceConfig() exports configuration object
- ✅ recording.enabled = true
- ✅ Database paths defined correctly
- ✅ All required settings present

**Potential Issues**:
- ❌ Function doesn't exist or doesn't export
- ❌ recording.enabled = false
- ❌ Missing required configuration

**Record In**: ANALYSIS-TRACKING-SHEET.md under "File 1"

---

#### Step 2: Analyze market-recorder.ts

**Why**: This is the MI system handler that should record data

**What to Check**:
1. Does `MarketRecorder` class exist?
2. What does constructor require?
3. Does `initialize()` method exist?
4. Does `onTokenDetected()` method exist?
5. What does each method do?

**Use Generic Prompt**:
```
Copy GENERIC-FILE-ANALYSIS-PROMPT.md
Replace [FILENAME] with: market-intelligence/handlers/market-recorder.ts
Run analysis
```

**Expected Findings**:
- ✅ MarketRecorder class exports properly
- ✅ Constructor requires: connection, config
- ✅ initialize() sets up database
- ✅ onTokenDetected() records token data
- ✅ All methods have proper error handling

**Potential Issues**:
- ❌ Class not exported
- ❌ Constructor parameters wrong
- ❌ Missing required methods
- ❌ Methods throw errors silently

**Record In**: ANALYSIS-TRACKING-SHEET.md under "File 2"

---

#### Step 3: Analyze index.ts (Integration Points)

**Why**: This is where MarketRecorder should be initialized and called

**What to Check**:
1. Line 77 (approx): Is MarketRecorder imported?
2. Is `let marketRecorder: MarketRecorder` declared?
3. **CRITICAL**: Where is it initialized?
4. **CRITICAL**: Where is `onTokenDetected()` called?

**Use Generic Prompt**:
```
Copy GENERIC-FILE-ANALYSIS-PROMPT.md
Replace [FILENAME] with: src/index.ts
Run analysis
```

**Expected Findings**:
- ✅ MarketRecorder imported from market-intelligence
- ✅ marketRecorder variable declared
- ✅ Initialized after line 1720 with: `new MarketRecorder(connection, config)`
- ✅ Called in WebSocket message handler for each token

**Potential Issues** (LIKELY ROOT CAUSE):
- ❌ Imported but never initialized (declared but null)
- ❌ No initialization code exists
- ❌ No onTokenDetected() calls exist
- ❌ Dead code - exists but never runs

**Record In**: ANALYSIS-TRACKING-SHEET.md under "File 3"

---

### Expected Outcome

After analyzing these 3 files, you should find:

**The Integration Gap**: MarketRecorder code exists but is never wired up to bot

**Expected Root Cause**:
```
File: src/index.ts, Line 77
Issue: let marketRecorder: MarketRecorder | undefined;
Problem: Declared but NEVER initialized
Impact: MI system exists but never instantiates or runs
```

**Missing Code**:
```typescript
// Around line 1720 in index.ts - MISSING:
const miConfig = getMarketIntelligenceConfig();
if (miConfig.recording.enabled) {
  console.log('📊 Initializing Market Intelligence...');
  marketRecorder = new MarketRecorder(connection, miConfig);
  await marketRecorder.initialize();
}

// In WebSocket message handler - MISSING:
if (marketRecorder) {
  await marketRecorder.onTokenDetected(tokenData, analysisResult);
}
```

---

## Time Estimates

### Paper Trading Analysis
- File 1 (UNIFIED-CONTROL.ts): 20 minutes
- File 2 (CONFIG-BRIDGE.ts): 15 minutes
- File 3 (index.ts): 30 minutes (large file)
- File 4 (jupiterHandler.ts): 25 minutes
- Cross-verification: 10 minutes
- **Total**: ~2 hours

### MI System Analysis
- File 1 (mi-config.ts): 15 minutes
- File 2 (market-recorder.ts): 25 minutes
- File 3 (index.ts integration): 20 minutes
- Cross-verification: 10 minutes
- **Total**: ~1.5 hours

---

## Success Criteria

### Paper Trading
✅ **Success**: Found exact line where TEST_MODE is ignored
✅ **Success**: Identified all hardcoded test mode bypasses
✅ **Success**: Documented complete config flow from UNIFIED-CONTROL to trade execution
✅ **Success**: Can now fix with confidence

### MI System
✅ **Success**: Found why marketRecorder never initializes
✅ **Success**: Identified all missing integration code
✅ **Success**: Documented required changes to make MI system work
✅ **Success**: Can now implement with confidence

---

## Tips for Successful Analysis

1. **Don't Rush**: 20-30 minutes per file is normal
2. **Don't Skip**: Every import, every export matters
3. **Don't Assume**: Verify actual code, not expected behavior
4. **Don't Guess**: Trace actual paths, find actual breaks
5. **Do Record**: Update tracking sheet after each file
6. **Do Verify**: Cross-check between files
7. **Do Question**: If something seems wrong, investigate deeper
8. **Do Document**: Future you will thank present you

---

## Common Findings

### Paper Trading Issues Often Caused By:
1. Line 272 in UNIFIED-CONTROL set to LIVE instead of PAPER
2. CONFIG-BRIDGE has hardcoded `TEST_MODE = false`
3. index.ts has `if (false)` instead of `if (TEST_MODE)` at Line 850
4. jupiterHandler ignores test mode and always trades live
5. .env file has `TEST_MODE=true` but code reads from wrong source

### MI System Issues Often Caused By:
1. marketRecorder declared but never initialized
2. MarketRecorder imported but no `new MarketRecorder()` call exists
3. onTokenDetected() never called in token detection code
4. mi-config.ts has recording.enabled = false
5. Database initialization fails silently

---

## What This Method Catches

Regular analysis misses these because it scans quickly. Systematic analysis catches:

- ✅ Declared variables that are never used
- ✅ Imported functions that are never called
- ✅ Exported items that nothing imports
- ✅ Functions that exist but are unreachable
- ✅ Configuration that is read but overridden
- ✅ Integration code that is partially implemented
- ✅ Hardcoded values that bypass configuration
- ✅ Silent failures in initialization

**This is why we go slow.**

---

## Next Steps After Analysis

Once you've completed the systematic analysis and found the root cause:

1. **Review Findings**: Read through your tracking sheet
2. **Verify Root Cause**: Confirm with a second pass if needed
3. **Create Fix Plan**: Document exact code changes required
4. **Implement Fixes**: Make changes one at a time
5. **Test After Each Fix**: Don't compound problems
6. **Update Documentation**: Record what was wrong and how you fixed it

**Remember**: The systematic analysis itself is the fix. Once you know EXACTLY where the break is, the fix is usually simple.
