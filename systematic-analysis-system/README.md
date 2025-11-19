# Systematic File Analysis System

**Created**: 2025-10-31
**Purpose**: Slow, detailed, thorough file-by-file analysis to catch bugs that regular analysis misses

## Why This System Exists

Despite multiple "deep analyses" and reports saying "all is good", issues persist with:
- Paper trading not executing
- Market Intelligence system not initializing
- Configuration settings being overlooked

**The Problem**: Regular analysis rushes through 20 files in a minute, missing subtle bugs like:
- Unused imports that suggest dead code paths
- Exports that nothing imports (dead code)
- Import chains that break silently
- Functions that exist but are never called
- Configuration values that are read but never used

**The Solution**: This systematic approach analyzes ONE file at a time with full tracking and verification.

---

## System Components

### 1. GENERIC-FILE-ANALYSIS-PROMPT.md
The core prompt template. Use this to analyze any file by just inserting the filename.

**What it does**:
- Phase 1: File Metadata (purpose, dependencies, exports)
- Phase 2: Line-by-Line Analysis (every import, constant, function, side effect)
- Phase 3: Dependency Verification (trace where imports come from)
- Phase 4: Execution Flow Mapping (how code executes)
- Phase 5: Issue Detection (dead code, broken chains)
- Phase 6: Integration Verification (cross-file communication)
- Phase 7: Summary Report
- Phase 8: Checklist for Next File

### 2. CONFIGURATION-FILE-TREE.md
Visual map of how configuration changes flow through 6 files:
```
UNIFIED-CONTROL.ts → CONFIG-BRIDGE.ts → index.ts → config.ts → mi-config.ts → market-recorder.ts
```

Start with File A (UNIFIED-CONTROL.ts) and work through sequentially.

### 3. ANALYSIS-TRACKING-SHEET.md
Template for recording findings after each file analysis.

**Tracks**:
- Files analyzed (with status)
- Issues found per file
- Cross-file dependencies verified
- Integration points checked
- Files requiring fixes

### 4. USAGE-EXAMPLES.md
Two specific use cases:
1. **Paper Trading Issue**: Which files to analyze and in what order
2. **MI System Issue**: Which files to analyze and in what order

---

## How to Use This System

### Step 1: Choose Your Issue
- Paper trading not working? Start with UNIFIED-CONTROL.ts
- MI system not initializing? Start with mi-config.ts

### Step 2: Open Analysis Tracking Sheet
Copy `ANALYSIS-TRACKING-SHEET.md` to `SESSION-LOGS/session-[date]-[issue].md`

### Step 3: Analyze First File
Use the generic prompt from `GENERIC-FILE-ANALYSIS-PROMPT.md`:
1. Replace `[FILENAME]` with actual file path
2. Feed to Claude Code
3. Record findings in tracking sheet
4. Mark file as COMPLETE

### Step 4: Follow the Chain
The analysis will identify which file to analyze next based on imports/exports.

### Step 5: Go Slow
**DO NOT** rush through multiple files automatically. Analyze one file, update tracking, verify findings, then move to next.

---

## Expected Results

After analyzing all files in a chain, you will have:
- ✅ Complete dependency map
- ✅ All dead code identified
- ✅ All broken import chains found
- ✅ All integration points verified
- ✅ Root cause of bugs located (not just symptoms)

---

## Example Session

**Issue**: Paper trading not executing despite TEST_MODE configuration

**Files to Analyze** (in order):
1. src/core/UNIFIED-CONTROL.ts (where TEST_MODE is defined)
2. src/core/CONFIG-BRIDGE.ts (how TEST_MODE is exported)
3. src/index.ts (how TEST_MODE is imported and used)
4. src/utils/handlers/jupiterHandler.ts (where trades execute)

**Time Investment**: ~20-30 minutes per file (slow and thorough)

**Outcome**: Find the exact line where TEST_MODE configuration breaks or is ignored

---

## Files in This System

| File | Purpose | When to Use |
|------|---------|-------------|
| README.md | Overview (you are here) | Start here to understand system |
| GENERIC-FILE-ANALYSIS-PROMPT.md | Core prompt template | Every file analysis |
| CONFIGURATION-FILE-TREE.md | Visual file flow map | Planning analysis order |
| ANALYSIS-TRACKING-SHEET.md | Session tracking template | Recording findings |
| USAGE-EXAMPLES.md | Specific issue walkthroughs | Paper trading or MI issues |
| SESSION-LOGS/ | Folder for actual sessions | After each analysis session |

---

## Important Notes

1. **This is NOT fast** - Expect 20-30 minutes per file
2. **This is thorough** - You will find issues regular analysis misses
3. **This requires patience** - Don't skip steps or rush
4. **This works** - Slow analysis catches bugs that fast analysis misses

---

## Next Steps

1. Read USAGE-EXAMPLES.md for your specific issue
2. Copy ANALYSIS-TRACKING-SHEET.md to SESSION-LOGS/
3. Use GENERIC-FILE-ANALYSIS-PROMPT.md for first file
4. Record findings and proceed to next file

**Remember**: The goal is to find the overlooked bug that's causing ongoing issues. Speed is the enemy. Thoroughness is your friend.
