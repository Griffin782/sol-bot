# gRPC Stress Test Session Recovery
**Date**: November 3, 2025
**Status**: Session crashed - CLI buffer overflow

## What Happened

The Claude Code session crashed with an "Invalid string length" error during a gRPC capacity stress test. This is a **CLI limitation**, not a system failure.

### Error Details
```
ERROR Invalid string length

file:///C:/Users/Administrator/AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/cli.js:727:2805
```

**Root Cause**: The load test generated too much console output for the Claude Code CLI to buffer. The CLI has string length limits that were exceeded during the multi-phase stress test.

---

## What Was Being Tested

The load test script (`scripts/load-test-positions.ts`) was designed to find the maximum number of positions the bot can monitor simultaneously via gRPC.

### Test Phases

| Phase | Target Positions | Expected CPU | Duration |
|-------|------------------|--------------|----------|
| Phase 1 | 200 positions | 10-15% | 5 minutes |
| Phase 2 | 500 positions | 30-40% | 5 minutes |
| Phase 3 | 1,000 positions | 60-70% | 10 minutes |
| Phase 4 | 1,500 positions | 80-90% | 10 minutes |

### What It Tests

1. **Position Monitoring Capacity**
   - Add simulated positions in batches
   - Monitor gRPC update throughput
   - Track CPU, memory, processing time

2. **Performance Metrics**
   - Updates per second
   - Average processing time per update
   - Peak processing time
   - Memory usage
   - CPU utilization
   - Error rate

3. **Failure Points**
   - Identifies when system becomes overloaded
   - Processing time > 50ms = warning
   - Sustained CPU > 80% = critical
   - Determines maximum safe capacity

---

## Current System Status

### Running Processes
✅ **4 Node.js processes detected** - Load test may still be running or completed

### Expected Behavior
The test should:
1. Generate positions in batches of 50
2. Monitor for 5-10 minutes per phase
3. Display metrics every 10 seconds
4. Save results to JSON file when complete
5. Stop if system becomes overloaded

### Files to Check
- **Load test report**: `load-test-report-[timestamp].json` (not found yet)
- **Test script**: `scripts/load-test-positions.ts` (verified exists)
- **Capacity guide**: `GRPC-CAPACITY-GUIDE.md` (verified exists)
- **Monitor script**: `scripts/monitor-grpc-capacity.ts` (expected to exist)

---

## Recovery Actions

### 1. Check Test Status

**Check if test is still running:**
```powershell
# In PowerShell:
Get-Process node | Select-Object Id, CPU, WorkingSet
```

**Check for test output files:**
```powershell
Get-ChildItem -Filter "load-test-report-*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
```

### 2. If Test Is Running

**Let it complete** - The test may still be collecting data even though the CLI crashed. Check back in 10-30 minutes to see if:
- JSON report was generated
- Node processes have exited
- Console output is available

**Monitor from terminal:**
```powershell
# Open new PowerShell terminal
cd C:\Users\Administrator\Desktop\IAM\sol-bot-main
npm run scripts:load-test  # If script exists
```

### 3. If Test Crashed

**Restart with output limits:**
The test needs modification to prevent CLI buffer overflow:

```typescript
// In scripts/load-test-positions.ts, reduce console output:

// Change line ~193 (display interval):
const monitorInterval = setInterval(() => {
  const currentMetrics = capacityMonitor.getMetrics(this.positionMonitor!);
  // Instead of: capacityMonitor.displayMetrics(currentMetrics);
  // Use minimal output:
  console.log(`[${new Date().toLocaleTimeString()}] ${currentMetrics.activePositions} pos | ${currentMetrics.updatesPerSecond.toFixed(0)} upd/s | ${currentMetrics.avgProcessingTimeMs.toFixed(1)}ms avg`);
}, 10000);
```

---

## Known Capacity Limits (from GRPC-CAPACITY-GUIDE.md)

### Conservative Recommendations

| Server Type | Safe Capacity | Notes |
|-------------|---------------|-------|
| **Basic Tier (100 r/s)** | **150-200 positions** | Production ready |
| **t3.medium (AWS)** | **150-180 positions** | 2 vCPU |
| **t3.large (AWS)** | **250-300 positions** | 4 vCPU |
| **Gaming PC** | **200-250 positions** | i7/Ryzen 7 |
| **Workstation** | **300-400 positions** | i9/Ryzen 9 |

### Key Metrics to Watch

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Avg Processing | < 10ms | 10-30ms | > 50ms |
| Update Lag | < 50ms | 50-150ms | > 200ms |
| Memory Growth | Stable | +10MB/hr | +50MB/hr |
| CPU Usage | < 60% | 60-80% | > 80% |

---

## Previous Session Context

### From SESSION-SUMMARY-2025-11-01.md

**Last completed work (November 1, 2025):**
1. ✅ Baseline recorder verified at 100%
2. ✅ Paper-mode sell failures fixed
3. ✅ All critical systems production-ready
4. ✅ Market Intelligence system functional

**System Status:**
- Configuration: UNIFIED-CONTROL.ts is single source of truth
- Trading Mode: PAPER (line 310)
- Exit Tiers: Configured (2x, 4x, 6x, moonbag)
- Baseline Recorder: Ready for 24/7 operation

---

## What We Were Attempting

The gRPC stress test was part of capacity planning for:

1. **Understanding system limits**
   - How many positions can be monitored simultaneously?
   - What are the bottlenecks? (CPU, memory, gRPC throughput)
   - When does performance degrade?

2. **Production planning**
   - Should we use Basic tier (100 r/s) or upgrade?
   - What server specs are needed?
   - Can current hardware handle target load?

3. **Optimization opportunities**
   - Identify performance bottlenecks
   - Measure overhead of exit strategy checks
   - Determine if code optimization is needed

---

## Next Steps

### Immediate (You Should Do)

1. **Check for test results**
   ```powershell
   Get-ChildItem -Filter "load-test-report-*.json"
   ```

2. **Check if test is still running**
   ```powershell
   Get-Process node
   ```

3. **Review any console output**
   - Check terminal where test was running
   - Look for phase completion messages
   - Note any error messages

### If Test Incomplete

**Option A: Restart with smaller phases**
```typescript
// Modify PHASES in load-test-positions.ts:
const PHASES = [
  { name: "Phase 1", positions: 100, expectedCpu: "5-10%", duration: 180000 },  // 3 min
  { name: "Phase 2", positions: 200, expectedCpu: "10-20%", duration: 180000 }, // 3 min
  { name: "Phase 3", positions: 300, expectedCpu: "20-30%", duration: 300000 }, // 5 min
];
```

**Option B: Use recommended capacity**
Based on GRPC-CAPACITY-GUIDE.md:
- Start with **150 positions** (conservative)
- Monitor for 1 hour
- If stable, increase to **200 positions**
- Stop if metrics degrade

**Option C: Skip stress test**
Use mathematical calculation from guide:
```
Max Positions = (Target CPU% × CPU Cores) / (Updates/sec per position × Processing time per update)

For Basic Tier:
- Target: 80% of available CPU
- Updates per position: 2.5/sec (bonding curves)
- Processing: 2ms per update

Estimated capacity: 150-200 positions
```

---

## Documentation References

**Key Files:**
- `GRPC-CAPACITY-GUIDE.md` - Comprehensive capacity planning
- `scripts/load-test-positions.ts` - The stress test script
- `SESSION-SUMMARY-2025-11-01.md` - Previous session context
- `UNIFIED-CONTROL.ts` (line 310) - Trading mode configuration

**Relevant Context Tags:**
- `GRPC-CAPACITY-TEST` - This recovery
- `GRPC-MIGRATION-PREP` - From CLAUDE.md
- `EXIT-SYSTEM-TIMER-ANALYSIS` - Related to exit checks

---

## System Configuration

**Current Setup:**
- Server: Unknown (need to check)
- gRPC Tier: Basic (100 r/s) - Assumed from guide
- Trading Mode: PAPER (UNIFIED-CONTROL.ts line 310)
- Exit Strategy: Tiered (2x, 4x, 6x, 20x moonbag)

**Test Configuration:**
- Endpoint: `process.env.GRPC_HTTP_URI` or "https://basic.grpc.solanavibestation.com"
- Token: `process.env.GRPC_AUTH_TOKEN`
- SOL Price: $167 (hardcoded in test)

---

## Recommendations

### Short Term

1. **Don't panic** - CLI crash ≠ test failure
2. **Check for results** - Test may have completed
3. **Review capacity guide** - May not need full stress test

### Medium Term

1. **Start conservatively** - Use 150-200 positions
2. **Monitor in production** - Use `monitor-grpc-capacity.ts`
3. **Scale gradually** - Add 50 positions at a time

### Long Term

1. **Implement monitoring** - Track metrics in production
2. **Optimize if needed** - Simplify exit strategy if bottlenecked
3. **Consider upgrade** - If consistently hitting limits

---

## Questions to Answer

1. **Did the test complete?**
   - Check for JSON report file
   - Review node processes

2. **What phase did it reach?**
   - 200 positions? 500? 1,000?
   - Any performance data captured?

3. **What are the actual bottlenecks?**
   - CPU? Memory? Network?
   - Processing time per update?

4. **What's the safe capacity for your hardware?**
   - Use test results if available
   - Otherwise use guide estimates

---

## Status: AWAITING USER INPUT

**Need from you:**
1. Check if test generated results file
2. Check if node processes are still running
3. Let me know if you want to:
   - Wait for results
   - Restart test with modifications
   - Use estimated capacity from guide
   - Something else

---

**Recovery Document Created**: November 3, 2025
**Status**: Awaiting user input on test status
