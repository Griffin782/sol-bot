# SOL-BOT v5.0 - DEPENDENCY TRUTH MAP

**Generated:** October 29, 2025
**Analysis Date:** Post-recovery phase after production failures
**Purpose:** Complete truth about what's actually used vs. what exists

---

## EXECUTIVE SUMMARY

### Project Statistics
- **Total TypeScript files:** 4,105 files (including backups)
- **Active source files (src/):** ~75 files
- **Actually imported/used:** ~45 files
- **Dead/standalone code:** ~15 files
- **Backup/duplicate files:** 4,030+ files (98% of project!)
- **Documentation contradictions:** 3 major conflicts identified

### Critical Findings
1. **PARTIAL-EXIT-SYSTEM.ts is PRIMARY** - Directly imported by index.ts
2. **automated-reporter.ts is SECONDARY** - Only imported by token-queue-system.ts
3. **z-masterConfig.ts is DEAD CODE** - Never imported, contradicts documentation
4. **Market Intelligence is OPTIONAL** - Can be disabled, non-critical path
5. **Massive backup pollution** - 98% of files are backups/duplicates

---

## MAIN ENTRY POINT ANALYSIS

### src/index.ts (2,068 lines)
**Status:** ACTIVE - Primary bot entry point

#### Direct Imports (Core Systems - 37 imports)
```typescript
// Configuration (UNIFIED system)
✅ './core/CONFIG-BRIDGE'           → BUY_AMOUNT, MAX_TRADES, POSITION_SIZE, TEST_MODE
✅ './core/UNIFIED-CONTROL'         → getMaxTrades, MASTER_SETTINGS
✅ './botController'                → Session management, trading params

// Trading Execution
✅ './utils/handlers/jupiterHandler'     → swapToken, unSwapToken, getCurrentTokenPrice
✅ './utils/handlers/sniperooHandler'    → buyToken
✅ './utils/handlers/tokenHandler'       → Token validation
✅ './utils/handlers/signatureHandler'   → getMintFromSignature
✅ './utils/handlers/rugCheckHandler'    → getRugCheckConfirmed

// Exit Systems (CRITICAL)
✅ './core/PARTIAL-EXIT-SYSTEM'     → PartialExitManager, ExitResult [LINE 27]
✅ './secure-pool-system'           → Pool management

// Market Intelligence (OPTIONAL)
✅ '../market-intelligence/handlers/market-recorder'  → MarketRecorder [LINE 25]
✅ '../market-intelligence/config/mi-config'          → Config [LINE 26]

// Security & Safety
✅ './security/securityIntegration' → Trading permission checks
✅ './emergency-safety-wrapper'     → EmergencySafetyWrapper
✅ './core/TOKEN-QUALITY-FILTER'    → enforceQualityFilter
✅ './utils/vip-token-check'        → vipTokenCheck

// Database & Tracking
✅ './tracker/db'                   → Position CRUD operations
✅ './types'                        → Type definitions
✅ './utils/managers/logManager'    → logEngine

// Tax & Compliance
✅ '../tax-compliance/taxTracker'   → recordTrade, TaxableTransaction

// Enhanced Features (Dynamically loaded)
✅ './enhanced/token-queue-system'  → TokenQueueManager (require)
✅ './enhanced/performanceLogger'   → PerformanceLogger (require)
✅ './enhanced/tokenAnalyzer'       → TokenAnalyzer (require)
✅ './advanced-features'            → AdvancedBotManager

// Utilities
✅ './utils/managers/websocketManager' → WebSocketManager
✅ './utils/managers/grpcManager'      → gRPC subscription
✅ './utils/rateLimiter'               → heliusLimiter
✅ './utils/simple-jupiter-validator'  → validateJupiterSetup
✅ './utils/env-validator'             → validateEnv
✅ './config'                          → Legacy config bridge
```

#### Indirect Imports (via dependencies)
```typescript
// Through token-queue-system.ts
✅ './enhanced/automated-reporter'  → WhaleWatcher (indirect)

// Through botController
✅ './core/UNIFIED-CONTROL'         → MASTER_SETTINGS (re-import)

// Through CONFIG-BRIDGE
✅ './core/UNIFIED-CONTROL'         → All configuration (re-import)
```

#### Dynamic Requires (Runtime loaded)
```typescript
Line 157: require("./enhanced/token-queue-system")  → TokenQueueManager
Line 159: require("./enhanced/performanceLogger")   → PerformanceLogger
Line 161: require("./enhanced/tokenAnalyzer")       → TokenAnalyzer
Line 1202: await import('./core/FORCE-TRADE-LIMIT') → Trade counter
```

---

## CORE SYSTEMS DEPENDENCY CHAINS

### 1. EXIT SYSTEMS (PRIMARY vs SECONDARY)

#### PARTIAL-EXIT-SYSTEM.ts ⭐ PRIMARY
```
Status: ACTIVELY USED
Import chain: index.ts → PARTIAL-EXIT-SYSTEM.ts
Usage: Line 27 (import), Lines 216-1767 (usage throughout)

Purpose:
- Manages tiered profit-taking (25% at 2x, 4x, 6x, moonbag)
- Tracks position states and remaining balances
- Triggers exit callbacks for actual selling
- Direct integration with monitorPositions() loop

Dependencies:
- @solana/web3.js (PublicKey)
- NO other internal dependencies (standalone class)

Files: 1
Lines: ~600
Circular deps: None
```

#### automated-reporter.ts (WhaleWatcher) - SECONDARY
```
Status: USED (but indirect)
Import chain: index.ts → token-queue-system.ts → automated-reporter.ts
Usage: Only by TokenQueueManager for whale monitoring

Purpose:
- Whale activity detection
- Queue-based exit signals
- Tiered exit support for queue system
- NOT directly used by main index.ts

Dependencies:
- @solana/web3.js (Connection)
- fs (for logging)
- NO other internal dependencies

Files: 1
Lines: ~800
Circular deps: None

⚠️ WARNING COMMENT IN FILE:
Lines 2-20: Claims to be "ACTIVELY USED - DO NOT DELETE"
Explains relationship with PARTIAL-EXIT-SYSTEM
Both can coexist (different monitoring approaches)
```

**Truth:** Both systems are active but serve different purposes:
- PARTIAL-EXIT-SYSTEM: Direct position monitoring
- automated-reporter: Queue-based monitoring for TokenQueueManager

---

### 2. CONFIGURATION SYSTEMS

#### UNIFIED-CONTROL.ts ⭐ SINGLE SOURCE OF TRUTH
```
Status: ACTIVELY USED
Import chain:
- index.ts → CONFIG-BRIDGE → UNIFIED-CONTROL
- index.ts → botController → UNIFIED-CONTROL
- index.ts → secure-pool-system → UNIFIED-CONTROL

Purpose: Master configuration with enforced values
File: src/core/UNIFIED-CONTROL.ts
Lines: ~600

Key exports:
- MASTER_SETTINGS (complete configuration object)
- TradingMode enum (PAPER, LIVE, MICRO, CONSERVATIVE, PRODUCTION)
- Getter functions (getMaxTrades, getPositionSizeSOL, etc.)
- Configuration enforcer for override protection

Dependencies: fs, path (no internal deps)
```

#### CONFIG-BRIDGE.ts - COMPATIBILITY LAYER
```
Status: ACTIVELY USED
Import chain: index.ts → CONFIG-BRIDGE (line 3)

Purpose: Bridge legacy variable names to UNIFIED-CONTROL
File: src/core/CONFIG-BRIDGE.ts
Lines: 367

Exports legacy variables:
- BUY_AMOUNT → getPositionSizeSOL()
- POSITION_SIZE → getPositionSizeSOL()
- MAX_TRADES → getMaxTrades()
- TEST_MODE → getCurrentMode() === TradingMode.PAPER

Also exports legacy objects:
- config (old config.ts structure)
- masterConfig (old enhanced/masterConfig.ts structure)
- z_config (old z-masterConfig.ts structure)

Dependencies:
✅ './UNIFIED-CONTROL' (primary source)
```

#### enhanced/masterConfig.ts - LEGACY
```
Status: REFERENCED but not imported
Import chain: NONE (dead code)

File found at: src/enhanced/masterConfig.ts
Lines: ~800

⚠️ CONTRADICTION:
- File exists and has configuration
- Contains 7 references to "z_masterConfig" (lines with z_ prefix)
- NOT imported by index.ts
- NOT imported by any active code
- CONFIG-BRIDGE provides compatibility layer without importing it

Evidence of non-use:
- grep for "from.*enhanced/masterConfig" → No results in src/
- CONFIG-BRIDGE re-creates structure without importing
```

#### z-masterConfig.ts ❌ DEAD CODE
```
Status: NOT USED (documentation contradiction)
Location: z-new-controls/z-masterConfig.ts

Documentation claims (from CLAUDE.md):
"z-masterConfig.ts PRIMARY config (line 143) - BEING USED"
"index.ts loads from ../z-new-controls/z-masterConfig"

ACTUAL TRUTH:
❌ NOT imported by index.ts
❌ NOT imported by any src/ file
❌ grep "z-new-controls" in src/ → NO RESULTS
❌ Only referenced in:
   - src/core/UNIFIED-CONTROL.ts (comment only)
   - src/utils/configValidator.ts (unused file)
   - src/core/VERIFY-INTEGRATION.ts (standalone test)
   - Documentation files

Contradiction severity: HIGH
User was told this is primary config, but it's never imported!
```

**Configuration Truth:**
```
ACTUAL FLOW:
index.ts → CONFIG-BRIDGE → UNIFIED-CONTROL → MASTER_SETTINGS

DOCUMENTED FLOW (WRONG):
index.ts → z-masterConfig.ts (DOES NOT EXIST IN CODE)
```

---

### 3. MARKET INTELLIGENCE SYSTEM

#### market-recorder.ts - OPTIONAL
```
Status: USED but can be disabled
Import chain: index.ts → market-recorder.ts (line 25)

Controlled by: process.env.MI_ENABLED !== 'false'
Code: Lines 724-748 in index.ts

Purpose:
- Records bot trading sessions to SQLite database
- Tracks token detections and outcomes
- Generates market intelligence reports
- Standalone recording (non-critical to bot operation)

Dependencies:
- @solana/web3.js (Connection)
- Database likely in ../market-intelligence/
- Config from mi-config.ts

Usage pattern:
if (marketRecorder?.isRecording()) {
  marketRecorder.onTokenDetected(...).catch(err =>
    console.log('⚠️ MI recording error (non-critical):', err)
  );
}

Error handling: Non-critical errors are caught and logged
Bot continues if MI fails
```

#### standalone-recorder.ts
```
Status: NOT FOUND in src/ (possibly in market-intelligence/)
Mentioned in task description but not imported by main bot
Likely a standalone tool for manual market analysis
```

**Market Intelligence Truth:**
- Optional feature, not core functionality
- Can be completely disabled without breaking bot
- Errors are non-blocking
- Used for post-analysis, not trading decisions

---

## DEAD CODE ANALYSIS

### Files That Exist But Are NEVER Imported

#### 1. Standalone Tools (Intentional)
```
✓ src/live-monitor.ts              → Separate monitoring console
✓ src/live-monitor-backup.ts       → Backup of monitor
✓ src/monitoring/csv-monitor.ts    → CSV file monitor
✓ src/enhanced/analyze-trading-session.ts → Post-trade analysis tool
✓ src/test-session-fix.ts          → One-time testing script
✓ src/enhanced/token-detection-test.ts → Testing tool
```

#### 2. Configuration Wizards/Validators (Unused)
```
❌ src/core/AUTO-CONFIG.ts         → Auto-configuration wizard
❌ src/core/BOT-DIAGNOSTIC.ts      → Diagnostic tool
❌ src/core/CONFIG-WIZARD.ts       → Interactive config wizard
❌ src/core/PRE-FLIGHT-CHECK.ts    → Pre-flight validation
❌ src/core/SMART-CONFIG-SYSTEM.ts → Smart config system
❌ src/core/SMART-CONFIG-VALIDATOR.ts → Config validator
❌ src/core/test-smart-config.ts   → Test script
❌ src/core/CONFIG-HISTORY.ts      → Config versioning
❌ src/core/VERIFY-INTEGRATION.ts  → Integration tester
❌ src/utils/configValidator.ts    → Legacy validator
```

#### 3. Legacy/Backup Files (Should be archived)
```
❌ src/enhanced/token-queue-system-8.13-bleeding.ts → Old bleeding-edge version
❌ src/enhanced/token-queue-system.backup.ts       → Backup copy
❌ src/enhanced-monitor.ts         → Old monitor version
❌ src/graceful-shutdown.ts        → Unused shutdown handler
❌ src/secure-transfer-system.ts   → Unused transfer system
❌ src/utils/realTradingHandler.ts → Superseded by jupiterHandler
❌ src/utils/balance-checker.ts    → Utility not imported
❌ src/utils/jupiter-env-validator.ts → Replaced by simple-jupiter-validator
```

#### 4. Documentation Says Dead But Actually Used
```
✅ src/enhanced/automated-reporter.ts
Documentation: "Claims to be actively used"
Reality: IS used (via token-queue-system.ts)
Warning comment exists because it was almost deleted!
```

---

## IMPORT CONFLICTS & CIRCULAR DEPENDENCIES

### Potential Circular Dependencies Checked
```
✓ UNIFIED-CONTROL → (no imports) → Safe
✓ CONFIG-BRIDGE → UNIFIED-CONTROL → Safe (one-way)
✓ botController → UNIFIED-CONTROL → Safe (one-way)
✓ PARTIAL-EXIT-SYSTEM → (only @solana/web3.js) → Safe
✓ token-queue-system → automated-reporter → Safe (one-way)
✓ index.ts → All systems → Safe (no back-imports)
```

**Result:** No circular dependencies found in active code

### Multiple Config File Conflicts
```
CONFLICT: Multiple configuration sources exist
- UNIFIED-CONTROL.ts (ACTIVE - used)
- CONFIG-BRIDGE.ts (ACTIVE - compatibility)
- enhanced/masterConfig.ts (DEAD - not imported)
- z-masterConfig.ts (DEAD - not imported)
- config.ts (LEGACY - used via CONFIG-BRIDGE)

Resolution: All flow through CONFIG-BRIDGE → UNIFIED-CONTROL
Legacy files create confusion but don't cause runtime conflicts
```

---

## DOCUMENTATION CONTRADICTIONS

### 1. z-masterConfig.ts Usage (CRITICAL)
```
CLAUDE.md states:
"z-masterConfig.ts PRIMARY config (line 143) - BEING USED"
"index.ts loads from ../z-new-controls/z-masterConfig"

REALITY:
- File exists: z-new-controls/z-masterConfig.ts ✓
- Imported by index.ts: NO ❌
- Used anywhere in src/: NO ❌
- grep results: 0 imports from z-new-controls/

EXPLANATION:
This was likely true in an older version before UNIFIED-CONTROL
was created. Documentation was never updated after migration.
```

### 2. automated-reporter.ts "DO NOT DELETE" Warning
```
FILE HEADER states:
"⚠️ WARNING: This file IS being used by the bot!"
"Import chain: token-queue-system.ts → automated-reporter"

REALITY:
- Statement is CORRECT ✓
- IS imported by token-queue-system.ts (line 3) ✓
- Warning exists because it was almost deleted before!

This is documentation PREVENTING future confusion,
not documenting current confusion.
```

### 3. PARTIAL-EXIT vs automated-reporter Priority
```
RECENT_CHATS_CONTEXT.md unclear about which is primary

REALITY:
- PARTIAL-EXIT-SYSTEM: Direct position monitoring (PRIMARY)
- automated-reporter: Queue-based monitoring (SECONDARY)
- Both are active, different use cases
- No conflict, complementary systems
```

---

## BACKUP FILE POLLUTION

### Backup Directories Found
```
1. src/backup-old/                           → ~20 old versions
2. src/backup-old/versions/critical/         → Critical backups
3. backup-config-restore-2025-09-08T11-25/   → Root-level backup
4. backup-clean-fix-2025-09-08T17-18/        → Root-level backup
5. backup-complete-2025-09-08T11-16/         → Root-level backup
6. backup-surgical-2025-09-08T17-24/         → Root-level backup
```

### Inline Backup Files
```
src/enhanced/token-queue-system.backup.ts
src/enhanced/token-queue-system-8.13-bleeding.ts
src/live-monitor-backup.ts
src/index.ts.backup-1761592099
src/index.ts.backup-phase2-1761614431
... and many more
```

### Statistics
- Backup directories: ~4,030 files (98% of total)
- Active source files: ~75 files (2% of total)
- Backup ratio: 54:1 (54 backup files per active file!)

---

## DEPENDENCY GRAPH (Visual)

```
index.ts (MAIN ENTRY)
├── CONFIG-BRIDGE.ts
│   └── UNIFIED-CONTROL.ts ⭐ (SINGLE SOURCE OF TRUTH)
│
├── botController.ts
│   └── UNIFIED-CONTROL.ts (re-import)
│
├── PARTIAL-EXIT-SYSTEM.ts ⭐ (PRIMARY EXIT)
│   └── @solana/web3.js (external only)
│
├── token-queue-system.ts (enhanced)
│   └── automated-reporter.ts (WhaleWatcher - SECONDARY EXIT)
│       └── @solana/web3.js (external only)
│
├── market-recorder.ts (OPTIONAL)
│   └── mi-config.ts
│
├── jupiterHandler.ts (trading)
├── sniperooHandler.ts (trading)
├── tokenHandler.ts (validation)
├── rugCheckHandler.ts (validation)
├── TOKEN-QUALITY-FILTER.ts (validation)
├── vip-token-check.ts (validation)
│
├── secure-pool-system.ts
│   └── UNIFIED-CONTROL.ts (re-import)
│
├── security/securityIntegration.ts
├── emergency-safety-wrapper.ts
├── advanced-features.ts
│   └── AdvancedBotManager
│
└── tracker/db.ts (database)

DEAD BRANCHES (not imported):
❌ z-new-controls/z-masterConfig.ts
❌ enhanced/masterConfig.ts (referenced but not imported)
❌ All core/*CONFIG*.ts tools (wizards, validators, etc.)
❌ Backup files (4,030+ files)
```

---

## RECOMMENDATIONS

### Critical Actions

1. **Update Documentation**
   ```
   Fix CLAUDE.md line about z-masterConfig being "PRIMARY config"
   Update to: "UNIFIED-CONTROL.ts is PRIMARY config via CONFIG-BRIDGE.ts"
   Remove references to z-new-controls/ imports
   ```

2. **Archive Dead Code**
   ```
   Move to archive/:
   - z-new-controls/z-masterConfig.ts
   - enhanced/masterConfig.ts (keep for reference, mark as LEGACY)
   - All core/*CONFIG*.ts wizards/validators (unused)
   - All *.backup.ts files
   - All *-bleeding.ts files
   ```

3. **Consolidate Backups**
   ```
   Create single backup archive:
   - Move all backup-*/ folders to archive/backups/
   - Move all src/backup-old/ to archive/old-versions/
   - Keep only latest working version in src/

   Reduces file count: 4,105 → ~75 active files
   Cleanup ratio: 98% reduction!
   ```

4. **Clarify Exit System Documentation**
   ```
   Document in README:
   - PARTIAL-EXIT-SYSTEM.ts = Primary (direct monitoring)
   - automated-reporter.ts = Secondary (queue monitoring)
   - Both active, different purposes, no conflict
   ```

### Safe Deletions

**Can be safely deleted** (never imported):
- src/core/AUTO-CONFIG.ts
- src/core/BOT-DIAGNOSTIC.ts
- src/core/CONFIG-WIZARD.ts
- src/core/PRE-FLIGHT-CHECK.ts
- src/core/SMART-CONFIG-SYSTEM.ts
- src/core/SMART-CONFIG-VALIDATOR.ts
- src/core/test-smart-config.ts
- src/core/CONFIG-HISTORY.ts
- src/utils/configValidator.ts
- src/utils/jupiter-env-validator.ts
- src/utils/balance-checker.ts
- src/graceful-shutdown.ts
- src/secure-transfer-system.ts

**Keep** (standalone tools - intentional):
- src/live-monitor.ts
- src/monitoring/csv-monitor.ts
- src/enhanced/analyze-trading-session.ts

**Archive** (legacy but might have historical value):
- src/enhanced/masterConfig.ts
- z-new-controls/z-masterConfig.ts

---

## TRUTH SUMMARY

### What Actually Runs
```
1. index.ts (main entry)
2. Configuration: UNIFIED-CONTROL.ts via CONFIG-BRIDGE.ts
3. Exit system: PARTIAL-EXIT-SYSTEM.ts (primary)
4. Queue monitoring: automated-reporter.ts (secondary, via token-queue-system)
5. Market Intelligence: market-recorder.ts (optional, can be disabled)
6. Trading: jupiterHandler.ts + sniperooHandler.ts
7. Validation: Multiple token validation handlers
8. Security: securityIntegration.ts + emergency-safety-wrapper.ts
9. Pool: secure-pool-system.ts
10. Session: botController.ts
```

### What Doesn't Run But Exists
```
1. z-masterConfig.ts (documentation says it runs, but it doesn't)
2. enhanced/masterConfig.ts (exists but never imported)
3. 15+ configuration tools/wizards (dead code)
4. 4,030+ backup files (98% of project!)
5. Multiple *.backup.ts and *-bleeding.ts files
```

### Documentation vs Reality
```
✓ PARTIAL-EXIT-SYSTEM is primary exit: TRUE
✓ automated-reporter is secondary exit: TRUE
✓ UNIFIED-CONTROL is configuration source: TRUE
✓ Market Intelligence is optional: TRUE

❌ z-masterConfig is PRIMARY config: FALSE (never imported)
❌ index.ts loads from z-new-controls: FALSE (no such import)
✓ automated-reporter "DO NOT DELETE": TRUE (correct warning)
```

---

## FINAL METRICS

| Metric | Count | Percentage |
|--------|-------|------------|
| Total files | 4,105 | 100% |
| Active source files | 75 | 1.8% |
| Actually imported | 45 | 1.1% |
| Standalone tools | 15 | 0.4% |
| Dead code | 15 | 0.4% |
| Backup/duplicate files | 4,030 | 98.2% |

**Conclusion:** The bot has a clean 45-file dependency chain, but is buried under 98% backup files. Documentation contains 1 critical contradiction about z-masterConfig that needs immediate correction.

---

**Analysis Complete**
For questions about specific files or dependencies, reference the line numbers and import chains documented above.
