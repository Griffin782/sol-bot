# Quick Action Card - November 7, 2025
**For**: Novice coder needing exact instructions
**Goal**: Get bot working correctly in test mode ASAP

---

## 🚨 CRITICAL - DO THESE FIRST (30 minutes)

### Issue: TokenAccountNotFoundError Returned (0% buy rate)

**Cause**: Nov 6 fixes may have been reverted

### Action 1: Verify Retry Logic (5 min)

```bash
# Check if retry logic exists
grep -A 20 "VIP2 RETRY LOGIC" src/utils/handlers/tokenHandler.ts
```

**Expected**: Should see retry code with delays [200, 100, 100]

**If Missing**:
1. Open: `src/utils/handlers/tokenHandler.ts`
2. Find function: `getTokenAuthorities`
3. Add this code at the start:

```typescript
// VIP2 RETRY LOGIC: RPC needs time to index accounts after gRPC detection
const delays = [200, 100, 100]; // ms between attempts
let lastError: Error | null = null;

for (let attempt = 1; attempt <= delays.length + 1; attempt++) {
  try {
    // Your existing code here
    return { freezeAuthority, mintAuthority };
  } catch (error) {
    lastError = error as Error;
    if (attempt <= delays.length) {
      await new Promise(resolve => setTimeout(resolve, delays[attempt - 1]));
      continue;
    }
  }
}

throw lastError;
```

---

### Action 2: Fix RPC Configuration (5 min)

```bash
# Check current RPC
grep RPC .env | head -5
```

**Expected**:
```
RPC_HTTPS_URI=https://mainnet.helius-rpc.com/?api-key=YOUR-KEY
# RPC_OVERRIDE_QUICKNODE=... (commented out)
```

**If Wrong**:
1. Open: `.env`
2. Find lines 55-56
3. Add `#` in front of both lines:

```bash
# RPC_OVERRIDE_QUICKNODE=https://blissful-holy-spree.solana-mainnet.quiknode.pro/...
# ^^^ MUST HAVE # IN FRONT
```

---

### Action 3: Quick Test (10 min)

```bash
# Run bot for 60 seconds
npm run dev
```

**Watch for**:
- "Authority checks passed" ✅
- "[PAPER TRADING] Simulated Buy" ✅
- NO "TokenAccountNotFoundError" ❌

**Success**: At least 1 token bought

---

## 🔧 NEXT PRIORITY - SQLite Fix (60-90 min)

### Issue: Bot crashes after 15 minutes

**Symptoms**:
```
Error: SQLITE_ERROR: cannot start a transaction within a transaction
```

### Quick Fix Option (If you want to skip for now)

**Disable Market Intelligence Recorder**:
1. Open: `src/index.ts`
2. Find: Market Intelligence initialization
3. Comment it out:

```typescript
// TEMPORARILY DISABLED - SQLite transaction issue
// const marketRecorder = new MarketIntelligenceRecorder();
// marketRecorder.start();
```

This lets you test without crashes while working on proper fix.

### Proper Fix (See DETAILED-FIX-PLAN-2025-11-07.md Phase 2)

---

## 📊 CREATE LIVE MONITOR (Optional but recommended)

**Why**: So you can watch bot without crashing Claude Code

**Time**: 2-4 hours

**See**: DETAILED-FIX-PLAN-2025-11-07.md Phase 4

**Quick Alternative**: Just watch logs in separate terminal:
```bash
# Terminal 1: Run bot
npm run dev

# Terminal 2: Watch logs
tail -f bot-output.log | grep "PAPER TRADING\|ERROR"
```

---

## ✅ VERIFICATION CHECKLIST

After fixes, verify these work:

### Test Mode (Paper Trading):
- [ ] Bot detects tokens (should see gRPC messages)
- [ ] Authority checks succeed (no TokenAccountNotFoundError)
- [ ] Paper trades execute (see "[PAPER TRADING] Simulated Buy")
- [ ] Position tracking starts (see "Position added to monitoring")
- [ ] Bot runs for 30+ minutes (no SQLite crash)

### Configuration:
- [ ] Position size is $15 (check CONFIG-ENFORCER logs)
- [ ] Mode is PAPER (check logs at startup)
- [ ] RPC is Helius (check .env)
- [ ] Retry logic enabled (check tokenHandler.ts)

---

## 🎯 TODAY'S GOAL

**Minimum**: Get 100% buy rate back (Action 1-3)

**Ideal**: + Fix SQLite crash (disable or proper fix)

**Stretch**: + Create live monitor dashboard

---

## 📞 IF YOU GET STUCK

1. **Check**: `COMPREHENSIVE-PROGRESS-STATUS-REPORT-2025-11-07.md`
   - Complete issue history
   - All test results
   - Known solutions

2. **Check**: `DETAILED-FIX-PLAN-2025-11-07.md`
   - Step-by-step instructions
   - Code examples
   - Troubleshooting

3. **Emergency Restore**: If all else fails, restore from Nov 6:
   ```bash
   git stash save "backup-before-restore-$(date +%Y%m%d-%H%M%S)"
   # Then manually restore files from SESSION-SUMMARY-2025-11-06.md
   ```

---

## 📁 KEY FILES TO KNOW

| File | What It Does | When to Edit |
|------|--------------|--------------|
| `src/core/UNIFIED-CONTROL.ts` | Master config | Change mode/position size |
| `src/utils/handlers/tokenHandler.ts` | Authority checks | Fix retry logic |
| `.env` | API keys & RPC | Change RPC provider |
| `src/index.ts` | Main bot logic | Disable features temporarily |

---

## 🚀 AFTER TESTS PASS

1. Run extended test (60+ minutes)
2. Validate tax recording
3. Review DETAILED-FIX-PLAN-2025-11-07.md Phase 7 for micro live testing

---

**Quick Start Command**:
```bash
# Fix RPC (if needed)
sed -i '55s/^/# /' .env
sed -i '56s/^/# /' .env

# Test bot
npm run dev
```

**Expected**: Tokens detected and bought within 60 seconds

---

**Created**: 2025-11-07
**Priority**: CRITICAL - Fix buy rate immediately
**Time Needed**: 30 minutes minimum, 2-4 hours ideal
