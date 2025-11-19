# SOL-BOT Configuration Conflict Visualization

## ACTUAL CONFIG FLOW (What Really Happens)

```
┌─────────────────────────────────────────────────────────────────┐
│                         index.ts                                 │
│                      (Bot Entry Point)                           │
│                                                                   │
│  Line 3: import { BUY_AMOUNT, TEST_MODE } from CONFIG-BRIDGE    │
│  Line 4: import { MASTER_SETTINGS } from UNIFIED-CONTROL        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
        ┌──────────────────┐   ┌──────────────────┐
        │ CONFIG-BRIDGE.ts │   │ botController.ts │
        │                  │   │                  │
        │ Line 34:         │   │ Line 7:          │
        │ BUY_AMOUNT =     │   │ import {         │
        │   getPosition... │   │   MASTER_SETTINGS│
        │                  │   │ }                │
        └──────────────────┘   └──────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              │
                              ▼
                ┌──────────────────────────────┐
                │  UNIFIED-CONTROL.ts          │
                │  ⭐ SINGLE SOURCE OF TRUTH   │
                │                               │
                │  Line 310: currentMode =      │
                │    TradingMode.CONSERVATIVE   │
                │                               │
                │  Line 317: positionSizeSOL =  │
                │    0.06865                    │
                │                               │
                │  Line 318: positionSizeUSD =  │
                │    15                         │
                └──────────────────────────────┘
                              │
                              │ SHOULD CONTROL EVERYTHING
                              │
                              ▼
                    ✅ CLEAN (No overrides)


BUT WAIT! There's a conflict...

                              ▼
        ┌─────────────────────────────────────────┐
        │  secure-pool-system.ts                  │
        │  ⚠️ HARDCODED OVERRIDE!                 │
        │                                          │
        │  Line 10: let IS_TEST_MODE = false;     │
        │                                          │
        │  Line 14: export function setTestMode() │
        │           {                              │
        │             IS_TEST_MODE = false; ← 🚨  │
        │           }                              │
        │                                          │
        │  Result: IGNORES UNIFIED-CONTROL mode!  │
        └─────────────────────────────────────────┘
```

---

## DOCUMENTED FLOW (What CLAUDE.md Claims)

```
❌ INCORRECT DOCUMENTATION:

┌─────────────────────────────────────────────────────────┐
│                      index.ts                            │
└─────────────────────────────────────────────────────────┘
                           │
                           │ (claimed but doesn't exist)
                           ▼
           ┌────────────────────────────────┐
           │ z-new-controls/                │
           │   z-masterConfig.ts            │
           │   ❌ "PRIMARY config"          │
           │   ❌ "BEING USED"              │
           │                                 │
           │   Reality: NEVER IMPORTED!     │
           └────────────────────────────────┘

CLAUDE.md Lines ~230-240 state:
"z-masterConfig.ts PRIMARY config (line 143) - BEING USED"
"index.ts loads from ../z-new-controls/z-masterConfig"

Evidence it's wrong:
$ grep "z-new-controls" src/ -r
  → NO RESULTS

This documentation is from an older version before
UNIFIED-CONTROL was created and was never updated.
```

---

## CONFIG FILE STATUS MAP

```
┌─────────────────────────────────────────────────────────────┐
│                    CONFIGURATION FILES                       │
│                                                              │
│  ✅ ACTIVE                                                   │
│  ├─ UNIFIED-CONTROL.ts      [Single source of truth]       │
│  ├─ CONFIG-BRIDGE.ts        [Compatibility layer]          │
│  ├─ config.ts               [Legacy wrapper]               │
│  └─ botController.ts        [Session management]           │
│                                                              │
│  ❌ DEAD CODE (Never imported)                              │
│  ├─ z-masterConfig.ts       [Docs claim primary!]          │
│  ├─ enhanced/masterConfig.ts [Throws error on import]      │
│  ├─ AUTO-CONFIG.ts          [Unused wizard]                │
│  ├─ BOT-DIAGNOSTIC.ts       [Unused diagnostic]            │
│  ├─ CONFIG-WIZARD.ts        [Unused wizard]                │
│  ├─ PRE-FLIGHT-CHECK.ts     [Unused validator]             │
│  ├─ SMART-CONFIG-SYSTEM.ts  [Unused system]                │
│  └─ ... 8 more config files [All unused]                   │
│                                                              │
│  ⚠️ OVERRIDE FILES (Break unified system)                   │
│  └─ secure-pool-system.ts   [Hardcodes test mode]          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## TEST MODE CONFIGURATION CONFLICTS

```
┌──────────────────────────────────────────────────────────────────┐
│                   TEST MODE CONTROL CHAOS                         │
│                                                                   │
│  5 DIFFERENT TEST MODE VARIABLES EXIST:                          │
│                                                                   │
│  1️⃣ UNIFIED-CONTROL.ts                                          │
│     Line 310: currentMode = TradingMode.CONSERVATIVE             │
│     ✅ SHOULD BE: The single source of truth                     │
│     Status: Active but overridden                                │
│                                                                   │
│  2️⃣ CONFIG-BRIDGE.ts                                            │
│     Line 57: TEST_MODE = getCurrentMode() === TradingMode.PAPER  │
│     ✅ CORRECT: Derives from UNIFIED-CONTROL                     │
│     Status: Working as intended                                  │
│                                                                   │
│  3️⃣ index.ts                                                    │
│     Line 220: IS_TEST_MODE = TEST_MODE                           │
│     ✅ CORRECT: Alias for backward compatibility                 │
│     Status: Working as intended                                  │
│                                                                   │
│  4️⃣ secure-pool-system.ts                                       │
│     Line 10: IS_TEST_MODE = false                                │
│     ❌ WRONG: Hardcoded, ignores UNIFIED-CONTROL                 │
│     Status: CONFLICT - Needs removal                             │
│                                                                   │
│  5️⃣ secure-pool-system.ts                                       │
│     Line 14: setTestMode() { IS_TEST_MODE = false; }            │
│     ❌ WRONG: Forces false regardless of parameter               │
│     Status: CONFLICT - Needs removal                             │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

RESULT: When you set TradingMode.PAPER in UNIFIED-CONTROL,
        secure-pool-system.ts still thinks it's LIVE mode!
```

---

## POSITION SIZING FLOW (Fixed ✅)

```
┌──────────────────────────────────────────────────────────────┐
│                 POSITION SIZE CONFIGURATION                   │
│                                                               │
│  UNIFIED-CONTROL.ts (Line 317-318)                          │
│  ┌────────────────────────────────────────┐                 │
│  │ positionSizeSOL: 0.06865               │                 │
│  │ positionSizeUSD: 15                    │                 │
│  └────────────────────────────────────────┘                 │
│                     │                                         │
│                     │ getPositionSizeSOL()                   │
│                     │ getPositionSizeUSD()                   │
│                     ▼                                         │
│  CONFIG-BRIDGE.ts (Line 34-36)                              │
│  ┌────────────────────────────────────────┐                 │
│  │ BUY_AMOUNT = getPositionSizeSOL()      │                 │
│  │ POSITION_SIZE = getPositionSizeSOL()   │                 │
│  │ POSITION_SIZE_USD = getPositionSizeUSD()│                │
│  └────────────────────────────────────────┘                 │
│                     │                                         │
│                     │ import                                  │
│                     ▼                                         │
│  index.ts (Line 3)                                           │
│  ┌────────────────────────────────────────┐                 │
│  │ import { BUY_AMOUNT, POSITION_SIZE }   │                 │
│  └────────────────────────────────────────┘                 │
│                     │                                         │
│                     │ Line 753: const positionSize = ...     │
│                     ▼                                         │
│  ✅ Uses correct value from UNIFIED-CONTROL                 │
│                                                               │
│  PREVIOUS ISSUE (NOW FIXED):                                 │
│  ❌ Line ~320: BUY_AMOUNT = 0.089 ← REMOVED                 │
│                                                               │
│  VERIFICATION:                                                │
│  $ grep "BUY_AMOUNT\s*=\s*[0-9]" src/index.ts               │
│    → NO RESULTS ✅                                           │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## EXIT STRATEGY CONFIGURATION (Clean ✅)

```
┌───────────────────────────────────────────────────────────────┐
│                    EXIT TIER SYSTEM                            │
│                                                                │
│  PARTIAL-EXIT-SYSTEM.ts (Lines 63-92)                        │
│  ┌─────────────────────────────────────────────────┐         │
│  │ DEFAULT_EXIT_TIERS = [                          │         │
│  │   { name: "Tier 1", multiplier: 2, % 25 },     │         │
│  │   { name: "Tier 2", multiplier: 4, % 25 },     │         │
│  │   { name: "Tier 3", multiplier: 6, % 25 },     │         │
│  │   { name: "Tier 4", multiplier: ∞, % 25 }      │         │
│  │ ]                                                │         │
│  └─────────────────────────────────────────────────┘         │
│                          │                                     │
│                          │ import (Line 27)                   │
│                          ▼                                     │
│  index.ts                                                     │
│  ┌─────────────────────────────────────────────────┐         │
│  │ import { PartialExitManager } from              │         │
│  │   './core/PARTIAL-EXIT-SYSTEM'                  │         │
│  └─────────────────────────────────────────────────┘         │
│                          │                                     │
│                          │ Used in monitorPositions()         │
│                          ▼                                     │
│  ✅ Tiered exits working correctly                            │
│     - 25% at 2x                                               │
│     - 25% at 4x                                               │
│     - 25% at 6x                                               │
│     - 25% moonbag (never sells)                               │
│                                                                │
│  COMPLEMENTARY SYSTEM:                                         │
│  automated-reporter.ts                                         │
│  └─ Queue-based whale monitoring (secondary)                  │
│                                                                │
│  STATUS: ✅ No conflicts, both systems active                 │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

---

## DUPLICATE PROTECTION STATUS (Fixed ✅)

```
┌────────────────────────────────────────────────────────┐
│           DUPLICATE PROTECTION SYSTEM                   │
│                                                         │
│  index.ts (Lines 275-276)                              │
│  ┌──────────────────────────────────────┐             │
│  │ const recentBuys = new Set<string>()│             │
│  │ const BUY_COOLDOWN = Infinity        │             │
│  └──────────────────────────────────────┘             │
│                  │                                      │
│                  │ When token detected:                │
│                  ▼                                      │
│  ┌──────────────────────────────────────┐             │
│  │ if (recentBuys.has(token)) {         │             │
│  │   return; // Skip duplicate          │             │
│  │ }                                     │             │
│  │ recentBuys.add(token);               │             │
│  └──────────────────────────────────────┘             │
│                  │                                      │
│                  │ BUY_COOLDOWN = Infinity means:      │
│                  ▼                                      │
│  ✅ Token NEVER removed from recentBuys               │
│     Guarantees: No duplicate purchases                 │
│                                                         │
│  PREVIOUS ISSUE (NOW FIXED):                           │
│  ❌ setTimeout(() => recentBuys.delete(token),        │
│               BUY_COOLDOWN)                            │
│     This would have allowed re-buying after timeout   │
│                                                         │
│  VERIFICATION:                                          │
│  $ grep "recentBuys.delete" src/index.ts              │
│    → NO RESULTS ✅                                     │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

## BACKUP FILE POLLUTION

```
PROJECT FILE BREAKDOWN:

  4,105 Total Files
    │
    ├─── 75 Active Files (2%)
    │    └─ Actual bot code
    │
    └─── 4,030 Backup Files (98%)
         ├─ ARCHIVED-BACKUPS-2025-10-30-0741/
         ├─ backup-config-restore-2025-09-08T11-25/
         ├─ backup-clean-fix-2025-09-08T17-18/
         ├─ backup-complete-2025-09-08T11-16/
         ├─ backup-surgical-2025-09-08T17-24/
         ├─ src/backup-old/
         ├─ *.backup.ts files
         └─ *-bleeding.ts files

RATIO: 54 backup files for every 1 active file!

RECOMMENDATION: Consolidate all backups into archive/
                Reduces project size by 98%
```

---

## THE FIX (What Needs to Change)

```
BEFORE:                              AFTER:
┌─────────────────────┐             ┌─────────────────────┐
│ UNIFIED-CONTROL     │             │ UNIFIED-CONTROL     │
│ currentMode: PAPER  │             │ currentMode: PAPER  │
└─────────────────────┘             └─────────────────────┘
         │                                   │
         │ Should control                    │ Controls everything
         │ everything but...                 ▼
         ▼                           ┌─────────────────────┐
┌─────────────────────┐             │ secure-pool-system  │
│ secure-pool-system  │             │ Uses UNIFIED-CONTROL│
│ IS_TEST_MODE=false  │             │ (no hardcode)       │
│ ❌ HARDCODED!       │             │ ✅ FIXED            │
└─────────────────────┘             └─────────────────────┘
         │                                   │
         ▼                                   ▼
  ⚠️ TEST_MODE ignored              ✅ TEST_MODE respected

REQUIRED CHANGES:
1. Remove Line 10: let IS_TEST_MODE = false;
2. Remove Line 14: IS_TEST_MODE = false; in setTestMode()
3. Import getCurrentMode() from UNIFIED-CONTROL
4. Use getCurrentMode() === TradingMode.PAPER

TIME TO FIX: 5 minutes
```

---

## VERIFICATION FLOWCHART

```
START: Configuration Reconciliation
  │
  ├─ Check 1: Hardcoded overrides removed?
  │   $ grep "IS_TEST_MODE = false" src/
  │   Expected: NO RESULTS
  │   Status: ⚠️ FOUND IN secure-pool-system.ts
  │
  ├─ Check 2: Documentation accurate?
  │   CLAUDE.md mentions z-masterConfig?
  │   Expected: NO (should mention UNIFIED-CONTROL)
  │   Status: ❌ STILL MENTIONS z-masterConfig
  │
  ├─ Check 3: Dead code archived?
  │   z-masterConfig.ts exists in src/?
  │   Expected: NO (should be in archive/)
  │   Status: ⚠️ STILL IN z-new-controls/
  │
  ├─ Check 4: Position sizing clean?
  │   $ grep "BUY_AMOUNT\s*=\s*[0-9]" src/index.ts
  │   Expected: NO RESULTS
  │   Status: ✅ CLEAN
  │
  ├─ Check 5: Duplicate protection working?
  │   BUY_COOLDOWN = Infinity?
  │   Expected: YES
  │   Status: ✅ WORKING
  │
  └─ Check 6: Exit tiers configured?
      PARTIAL-EXIT-SYSTEM has 4 tiers?
      Expected: YES (2x, 4x, 6x, moonbag)
      Status: ✅ CONFIGURED

OVERALL STATUS: ⚠️ 2 critical fixes needed
                ✅ 4 systems working correctly
```

---

## QUICK REFERENCE: File Status Legend

```
✅ ACTIVE     - File is imported and used at runtime
⚠️ CONFLICT   - File overrides unified config
❌ DEAD CODE  - File exists but never imported
📦 ARCHIVE    - Should be moved to archive/
🚨 CRITICAL   - Needs immediate attention
```

---

**For Detailed Analysis:** See `CONFIG-RECONCILIATION-REPORT.md`
**For Quick Summary:** See `CONFIG-RECONCILIATION-SUMMARY.md`
