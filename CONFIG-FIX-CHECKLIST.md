# Configuration Fix Checklist

**Quick reference for fixing configuration conflicts**
**Estimated time:** 10-15 minutes for critical fixes

---

## ✅ CRITICAL FIXES (Do These Now)

### Fix 1: Remove Hardcoded Test Mode Override
**File:** `src/secure-pool-system.ts`
**Time:** 5 minutes

```typescript
// ❌ FIND AND REMOVE Line 10:
let IS_TEST_MODE = false;

// ❌ FIND AND REMOVE Line 14:
export function setTestMode(testMode: boolean): void {
  IS_TEST_MODE = false; // FORCE LIVE MODE  ← DELETE THIS LINE
}

// ✅ REPLACE THE ENTIRE SECTION WITH:
import { getCurrentMode, TradingMode } from './core/UNIFIED-CONTROL';

export function isTestMode(): boolean {
  return getCurrentMode() === TradingMode.PAPER;
}
```

**Verification:**
```powershell
Select-String -Pattern "IS_TEST_MODE = false" -Path src\secure-pool-system.ts
# Should return: NO RESULTS after fix
```

---

### Fix 2: Update Documentation
**File:** `CLAUDE.md`
**Time:** 3 minutes

```markdown
# FIND THIS SECTION (around lines 230-240):
z-masterConfig.ts PRIMARY config (line 143) - BEING USED
index.ts loads from ../z-new-controls/z-masterConfig

# REPLACE WITH:
UNIFIED-CONTROL.ts is PRIMARY config (accessed via CONFIG-BRIDGE.ts)
Configuration flow: index.ts → CONFIG-BRIDGE → UNIFIED-CONTROL → MASTER_SETTINGS

# ALSO UPDATE PROJECT STRUCTURE SECTION:
sol-bot-main/
├── src/
│   ├── core/
│   │   ├── UNIFIED-CONTROL.ts    # ⭐ PRIMARY CONFIG
│   │   └── CONFIG-BRIDGE.ts      # Compatibility layer
│   ├── index.ts                  # Main controller
│   └── enhanced/
│       └── masterConfig.ts       # ❌ DEPRECATED (throws error)
```

**Verification:**
```powershell
Select-String -Pattern "z-masterConfig.*PRIMARY" -Path CLAUDE.md
# Should return: NO RESULTS after fix
```

---

### Fix 3: Clean Up .env File
**File:** `.env`
**Time:** 2 minutes

```bash
# REMOVE these commented-out lines:
# WALLET_ADDRESS=EmKj5PB2V6QHQ3uD2NkwGSEum3C5z61p8ehWAGyMcBUV
# PRIVATE_KEY=[11,33,87,87,124,184,...]

# KEEP only the active wallet:
WALLET_ADDRESS=EKJCUUxKPmSdqAzkV3W58zt3UDpygzbDrB3SZtWsujxL
PRIVATE_KEY="52MCJKPrjuDtp7BfH11PoLkCXqiPaCDUdqZ4MdpeUtX6CcENRS3bgPRumwGhdfUMxYEszPYkwmwpv16uuyGfn9tU"
```

**Verification:**
```powershell
Select-String -Pattern "^\s*# WALLET_ADDRESS" -Path .env
# Should return: NO RESULTS after cleanup
```

---

## 🧪 VERIFICATION TESTS

### Test 1: Configuration Loading
```powershell
# Start the bot and look for these messages:
npm run dev

# Expected output:
# ✅ "🌉 [CONFIG-BRIDGE] Backward compatibility layer loaded"
# ✅ "BUY_AMOUNT: 0.06865 SOL (15 USD)"
# ✅ "MODE: CONSERVATIVE"
# ✅ "All values controlled by UNIFIED-CONTROL-ENHANCED.ts"
```

### Test 2: No Hardcoded Overrides
```powershell
# Check for hardcoded values
Select-String -Pattern "BUY_AMOUNT\s*=\s*[0-9]" -Path src\index.ts
# Expected: NO RESULTS ✅

Select-String -Pattern "IS_TEST_MODE = false" -Path src\secure-pool-system.ts
# Expected: NO RESULTS ✅

Select-String -Pattern "setTimeout.*recentBuys" -Path src\index.ts
# Expected: NO RESULTS ✅
```

### Test 3: Dead Code Not Imported
```powershell
# Check z-masterConfig not imported
Select-String -Pattern "z-new-controls" -Path src\ -Recurse
# Expected: NO RESULTS ✅

# Check enhanced/masterConfig not imported
Select-String -Pattern "import.*enhanced/masterConfig" -Path src\ -Recurse
# Expected: NO RESULTS ✅
```

### Test 4: UNIFIED-CONTROL is Active
```powershell
# Check imports from UNIFIED-CONTROL
Select-String -Pattern "import.*UNIFIED-CONTROL" -Path src\ -Recurse
# Expected: MULTIPLE RESULTS showing imports ✅

# Should see imports in:
# - src/index.ts
# - src/botController.ts
# - src/secure-pool-system.ts
# - src/config.ts
# - And others...
```

---

## 📋 OPTIONAL CLEANUP (Do Later)

### Archive Dead Config Files
```powershell
# Create archive directory
mkdir archive\config-files\legacy
mkdir archive\config-files\wizards

# Move dead primary configs
Move-Item z-new-controls\z-masterConfig.ts archive\config-files\legacy\
Move-Item src\enhanced\masterConfig.ts archive\config-files\legacy\

# Move unused wizards
Move-Item src\core\AUTO-CONFIG.ts archive\config-files\wizards\
Move-Item src\core\BOT-DIAGNOSTIC.ts archive\config-files\wizards\
Move-Item src\core\CONFIG-WIZARD.ts archive\config-files\wizards\
Move-Item src\core\PRE-FLIGHT-CHECK.ts archive\config-files\wizards\
Move-Item src\core\SMART-CONFIG-SYSTEM.ts archive\config-files\wizards\
Move-Item src\core\SMART-CONFIG-VALIDATOR.ts archive\config-files\wizards\
Move-Item src\core\CONFIG-HISTORY.ts archive\config-files\wizards\
Move-Item src\core\test-smart-config.ts archive\config-files\wizards\
Move-Item src\utils\configValidator.ts archive\config-files\wizards\
```

### Consolidate Backup Files
```powershell
# Create backup archive
mkdir archive\backups\2025-10-30-consolidation

# Move backup directories
Move-Item ARCHIVED-BACKUPS-2025-10-30-0741 archive\backups\2025-10-30-consolidation\

# Move inline backups
Get-ChildItem -Path src\ -Recurse -Filter "*.backup.ts" | Move-Item -Destination archive\backups\2025-10-30-consolidation\
Get-ChildItem -Path src\ -Recurse -Filter "*-bleeding.ts" | Move-Item -Destination archive\backups\2025-10-30-consolidation\
```

---

## 🎯 SUCCESS CHECKLIST

Mark each as complete:

### Critical Fixes
- [ ] secure-pool-system.ts hardcoded override removed
- [ ] CLAUDE.md documentation updated
- [ ] .env commented credentials removed

### Verification Passed
- [ ] Bot starts without config errors
- [ ] UNIFIED-CONTROL messages appear in logs
- [ ] No hardcoded BUY_AMOUNT found
- [ ] No hardcoded IS_TEST_MODE found
- [ ] z-masterConfig not imported

### Optional Cleanup
- [ ] Dead config files archived
- [ ] Backup files consolidated
- [ ] Archive README created

---

## 🚨 TROUBLESHOOTING

### If Bot Won't Start After Changes

**Error: "Cannot find module './core/UNIFIED-CONTROL'"**
```powershell
# Fix: Check file exists
Test-Path src\core\UNIFIED-CONTROL.ts
# Should return: True

# If missing, restore from git:
git checkout src/core/UNIFIED-CONTROL.ts
```

**Error: "IS_TEST_MODE is not defined"**
```powershell
# Fix: Verify you imported getCurrentMode correctly
Select-String -Pattern "getCurrentMode" -Path src\secure-pool-system.ts
# Should show import statement
```

**Error: TypeScript compilation errors**
```powershell
# Fix: Rebuild the project
npm run build

# If errors persist, check:
npx tsc --noEmit
# This shows exact errors
```

### If Config Values Are Wrong

**Position size not matching UNIFIED-CONTROL**
```powershell
# Check UNIFIED-CONTROL line 317-318:
Select-String -Pattern "positionSize" -Path src\core\UNIFIED-CONTROL.ts -Context 2

# Should show:
# positionSizeSOL: 0.06865
# positionSizeUSD: 15
```

**Test mode not changing when you update UNIFIED-CONTROL**
```powershell
# Verify you removed hardcoded override:
Select-String -Pattern "IS_TEST_MODE = false" -Path src\ -Recurse
# Should return: NO RESULTS

# If found, go back to Fix 1
```

---

## 📞 QUICK REFERENCE COMMANDS

### Check for conflicts
```powershell
# All-in-one check
Select-String -Pattern "BUY_AMOUNT\s*=\s*[0-9]|IS_TEST_MODE = false|setTimeout.*recentBuys" -Path src\index.ts,src\secure-pool-system.ts

# Should return: NO RESULTS after fixes
```

### Verify active config
```powershell
# Should use UNIFIED-CONTROL
Select-String -Pattern "import.*UNIFIED-CONTROL" -Path src\index.ts,src\botController.ts,src\config.ts

# Should show imports in all three files
```

### Check documentation
```powershell
# Should mention UNIFIED-CONTROL, not z-masterConfig
Select-String -Pattern "PRIMARY config" -Path CLAUDE.md

# Should return line mentioning UNIFIED-CONTROL
```

---

## ⏱️ TIME ESTIMATES

| Task | Time | Priority |
|------|------|----------|
| Fix secure-pool-system.ts | 5 min | P0 Critical |
| Update CLAUDE.md | 3 min | P0 Critical |
| Clean .env | 2 min | P0 Critical |
| Run verification tests | 5 min | P0 Critical |
| **TOTAL CRITICAL** | **15 min** | **Must do** |
| | | |
| Archive dead configs | 15 min | P2 Optional |
| Consolidate backups | 30 min | P3 Optional |
| **TOTAL OPTIONAL** | **45 min** | **Can wait** |

---

## 📚 RELATED DOCUMENTS

- `CONFIG-RECONCILIATION-REPORT.md` - Full detailed analysis
- `CONFIG-RECONCILIATION-SUMMARY.md` - Executive summary
- `CONFIG-CONFLICT-VISUAL.md` - Visual diagrams
- `DEPENDENCY-TRUTH-MAP.md` - Complete dependency analysis

---

**Last Updated:** October 30, 2025
**Status:** Ready to implement
**Priority:** Fix critical items immediately (15 min)
