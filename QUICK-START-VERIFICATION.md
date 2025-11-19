# Quick Start - Market Intelligence Verification

**Date**: October 29, 2025
**Purpose**: Verify MI fixes are working correctly
**Time Required**: 10 minutes

---

## 🚀 QUICK VERIFICATION (3 Steps)

### **Step 1: Restart Recorder**

```bash
npm run mi-baseline
```

### **Step 2: Watch for Success Messages** ⏱️ (30 seconds)

Look for these lines during startup:

```
✅ Recorder initialized successfully
🎯 Min Score: 0 (records all tokens)

🔧 BASELINE CONFIG VERIFICATION:
   min_score_to_track: 0
   block_keywords: NONE (accepts all)
   min_liquidity: 0
   ⚠️  This configuration should track EVERY token detected!

✅ WebSocket connected
📊 Monitoring all market activity...
```

**If you see these** → ✅ Configuration is correct, proceed to Step 3

**If you DON'T see "NONE (accepts all)"** → ❌ Stop and check standalone-recorder.ts backup

### **Step 3: Check Database After 5-10 Minutes**

```bash
npm run check-db
```

**Look For**:
```
📊 Tokens Tracked: [NUMBER]
📈 Tracking Ratio: 95-100% (should be ~100%)
```

---

## ✅ SUCCESS = All These Are True

1. ✅ Config shows "NONE (accepts all)"
2. ✅ You see token detections: `🔍 Detected: [mint]...`
3. ✅ Tracking ratio is 95-100%
4. ✅ No warnings about low tracking ratio
5. ✅ Database shows: Tokens Tracked ≈ Tokens Detected

---

## ❌ FAILURE = Any Of These

1. ❌ Tracking ratio < 50%
2. ❌ "Blocked: X%" shows high percentage
3. ❌ Config shows keywords listed (not "NONE")
4. ❌ Warnings: "Low tracking ratio!"

---

## 🔧 IF VERIFICATION FAILS

**Stop Recorder**:
```bash
# Press Ctrl+C
```

**Restore Backup**:
```bash
cp market-intelligence/standalone-recorder.ts.backup market-intelligence/standalone-recorder.ts
```

**Check Backup Was Applied**:
```bash
# Look at lines 86-113 in standalone-recorder.ts
# Should see: min_score_to_track: 0
```

**Contact Support**:
Provide output from:
```bash
npm run check-db > mi-status.txt
```

---

## 📊 EXPECTED STATS (Every Minute)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 STATS [2:45:30 PM]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️  Runtime: 10 minutes
📨 Messages: 623 (10.4/s)
🔍 Tokens Detected: 89 (8.9/min)
💾 Database Tokens: 892
📊 Tokens Tracked: 892
📈 Tracking Ratio: 100.0% (should be ~100%)  ← Should be ~100%
⚡ Active Positions: 892
📝 Database Writes: 1,784
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🎯 AFTER SUCCESS

**Leave Recorder Running**:
- Collects baseline market data 24/7
- Compare bot performance later
- Runs independently from trading bot

**Commands**:
```bash
# Check status anytime
npm run check-db

# Compare bot session (after trading)
npm run mi-compare ./data/bot-sessions/session.db

# Analyze daily data
npm run mi-analysis ./data/market-baseline/baseline-2025-10-29.db
```

---

## 📁 DOCUMENTATION

**Full Details**: [MI-COMPREHENSIVE-FIXES-COMPLETE.md](MI-COMPREHENSIVE-FIXES-COMPLETE.md)

**Troubleshooting**: See "TROUBLESHOOTING" section in MI-COMPREHENSIVE-FIXES-COMPLETE.md

**Session Summary**: [OCT-29-SESSION-SUMMARY.md](OCT-29-SESSION-SUMMARY.md)

---

**Quick Reference**:
```bash
npm run mi-baseline      # Start recorder
npm run check-db         # Check status
Ctrl+C                   # Stop recorder
```
