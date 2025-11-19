# Generic File Analysis Prompt Template

**Purpose**: Systematic line-by-line file analysis to catch bugs that regular analysis misses

**How to Use**: Copy this entire prompt, replace `[FILENAME]` with the actual file path, and feed to Claude Code.

---

## THE PROMPT (Copy everything below this line)

---

I need you to perform a SYSTEMATIC, LINE-BY-LINE analysis of `[sol-bot-main\market-intelligence\standalone-recorder.ts]`. This is NOT a quick scan. Go slow and thorough.

**Rules**:
1. Analyze EVERY line - no skipping or summarizing
2. Trace EVERY import to its source
3. Check EVERY export to see if anything imports it
4. Map EVERY function call to its definition
5. Report issues immediately when found
6. Do NOT proceed to next phase until current phase is complete

---

## PHASE 1: FILE METADATA

Before analyzing any code, tell me:

1. **File Location**: Full path
2. **File Purpose**: What is this file supposed to do? (Based on name and initial reading)
3. **File Size**: How many lines of code?
4. **Last Modified**: When was this file last changed?
5. **Dependencies Count**: How many imports does this file have?
6. **Exports Count**: How many things does this file export?

**Output Format**:
```
FILE: [full path]
PURPOSE: [brief description]
SIZE: [number] lines
LAST MODIFIED: [date/time if available]
IMPORTS: [count]
EXPORTS: [count]
```

---

## PHASE 2: LINE-BY-LINE ANALYSIS

Go through the file in sections. For each section, report:

### Section A: IMPORTS (Lines 1-[first non-import line])

For EVERY import statement:

**Format**:
```
IMPORT [number]: Line [X]
  - What: [imported item name(s)]
  - From: [source file/package]
  - Type: [default/named/namespace/type-only]
  - Used?: [YES/NO - search file for usage]
  - Source Exists?: [YES/NO/EXTERNAL - check if source file exists]
  - Notes: [any issues found]
```

**Check for**:
- Unused imports (imported but never referenced in file)
- Missing source files (imports from non-existent files)
- Circular dependencies (File A imports File B, File B imports File A)

### Section B: EXPORTS (Search entire file)

For EVERY export statement:

**Format**:
```
EXPORT [number]: Line [X]
  - What: [exported item name]
  - Type: [function/const/class/interface/type]
  - Imported By: [list files that import this, or NONE]
  - Purpose: [what does this do]
  - Notes: [any issues found]
```

**Check for**:
- Dead exports (nothing imports them)
- Duplicate exports (same name exported twice)
- Misnamed exports (name doesn't match actual functionality)

### Section C: CONSTANTS (Top-level const/let/var)

For EVERY top-level variable:

**Format**:
```
CONSTANT [number]: Line [X]
  - Name: [variable name]
  - Value: [initial value or type]
  - Scope: [file-level/block-level]
  - Used?: [YES/NO - search for usage]
  - Modified?: [YES/NO - check if reassigned]
  - Notes: [any issues found]
```

**Check for**:
- Unused constants (declared but never used)
- Hardcoded values (magic numbers that should be config)
- Duplicate declarations (same name declared multiple times)

### Section D: FUNCTIONS (All function declarations)

For EVERY function:

**Format**:
```
FUNCTION [number]: Line [X]
  - Name: [function name]
  - Parameters: [list with types]
  - Return Type: [type]
  - Called By: [list where it's called, or NEVER]
  - Calls: [list functions it calls]
  - Purpose: [what does this do]
  - Notes: [any issues found]
```

**Check for**:
- Unreachable functions (never called anywhere)
- Missing error handling (no try/catch around risky operations)
- Infinite loop potential (recursive calls without exit condition)
- Async issues (missing await, not properly async)

### Section E: SIDE EFFECTS (Code that executes immediately)

For EVERY top-level code that runs on file load:

**Format**:
```
SIDE EFFECT [number]: Line [X]
  - Action: [what happens]
  - Timing: [when does this execute]
  - Dependencies: [what must exist first]
  - Purpose: [why is this here]
  - Notes: [any issues found]
```

**Check for**:
- Order dependencies (code that assumes something loaded first)
- Unconditional execution (runs even when shouldn't)
- Race conditions (depends on timing)

---

## PHASE 3: DEPENDENCY VERIFICATION

For each import found in Phase 2, Section A:

1. **Trace to source**: Open the source file and verify:
   - Does the source file actually export this item?
   - Is the export name spelled correctly?
   - Is the export type correct (default vs named)?

2. **Check reverse dependency**: In source file:
   - Is this export used by ANY file other than [FILENAME]?
   - If only used by [FILENAME], is it necessary?

3. **Report**:
```
DEPENDENCY: [imported item]
  - Source File: [path]
  - Source Exports: [YES/NO]
  - Export Type Matches: [YES/NO]
  - Used by Other Files: [YES/NO - list files]
  - Status: [OK/BROKEN/QUESTIONABLE]
  - Fix Needed: [YES/NO - description if yes]
```

---

## PHASE 4: EXECUTION FLOW MAPPING

Map how this file executes from start to finish:

1. **On File Load**:
   - What happens when Node.js first loads this file?
   - What side effects occur?
   - What gets initialized?

2. **Export Usage**:
   - When another file imports from this file, what happens?
   - Does importing cause side effects?

3. **Function Call Chain**:
   - If function X is called, what functions does it call?
   - Map the entire call chain for main exported functions

**Output Format**:
```
EXECUTION FLOW:

1. FILE LOAD:
   - [Step 1]
   - [Step 2]
   - ...

2. WHEN IMPORTED:
   - [What happens]

3. FUNCTION CALL CHAINS:
   Function: [name]
     → Calls: [function A]
       → Calls: [function B]
         → Calls: [function C]

   [Repeat for other main functions]
```

---

## PHASE 5: ISSUE DETECTION

Based on Phases 1-4, report ALL issues found:

**Format**:
```
ISSUE [number]: [SEVERITY - CRITICAL/HIGH/MEDIUM/LOW]
  - Type: [Dead Code/Broken Import/Logic Error/etc.]
  - Location: Line [X]
  - Description: [what's wrong]
  - Impact: [what this breaks or affects]
  - Fix Required: [what needs to change]
  - Related Files: [other files affected]
```

**Check for**:
1. Dead code (unused imports, unused functions, unused constants)
2. Broken imports (source doesn't exist or doesn't export)
3. Logic errors (functions that can't work as written)
4. Configuration issues (hardcoded values, wrong settings)
5. Missing error handling
6. Race conditions or timing issues
7. Circular dependencies
8. Duplicate code

---

## PHASE 6: INTEGRATION VERIFICATION

For this file to work correctly with other files:

1. **Incoming Dependencies** (Files that import from this file):
   - List ALL files that import from [FILENAME]
   - Verify each import is correct
   - Check if imported items are actually used

2. **Outgoing Dependencies** (Files this file imports from):
   - List ALL files that [FILENAME] imports from
   - Verify each source file exists
   - Check if imports are actually used

3. **Communication Chain**:
   - Map how data/config flows through related files
   - Example: UNIFIED-CONTROL.ts → CONFIG-BRIDGE.ts → index.ts

**Output Format**:
```
INTEGRATION MAP:

INCOMING (Who imports from this file):
  1. [File A] imports [item X] - Status: [OK/BROKEN]
  2. [File B] imports [item Y] - Status: [OK/BROKEN]

OUTGOING (What this file imports):
  1. Imports [item M] from [File C] - Status: [OK/BROKEN]
  2. Imports [item N] from [File D] - Status: [OK/BROKEN]

COMMUNICATION CHAIN:
  [File A] → [FILENAME] → [File B] → [File C]
  Data Flow: [describe what flows through]

INTEGRATION ISSUES:
  - [Issue 1]
  - [Issue 2]
```

---

## PHASE 7: SUMMARY REPORT

Provide a concise summary:

```
FILE ANALYSIS COMPLETE: [FILENAME]

STATISTICS:
  - Total Lines: [number]
  - Imports: [count] ([X] used, [Y] unused)
  - Exports: [count] ([X] used, [Y] dead)
  - Functions: [count] ([X] called, [Y] unreachable)
  - Constants: [count] ([X] used, [Y] unused)
  - Issues Found: [count]

OVERALL HEALTH: [EXCELLENT/GOOD/FAIR/POOR/CRITICAL]

CRITICAL ISSUES:
  1. [Issue 1]
  2. [Issue 2]

FILES TO ANALYZE NEXT:
  1. [File A] - Reason: [imports from this file]
  2. [File B] - Reason: [this file imports from it]

FIXES REQUIRED:
  - [ ] [Fix 1]
  - [ ] [Fix 2]
  - [ ] [Fix 3]
```

---

## PHASE 8: CHECKLIST FOR NEXT FILE

Before moving to next file, confirm:

- [ ] All imports traced to source
- [ ] All exports checked for usage
- [ ] All functions checked for reachability
- [ ] All constants checked for usage
- [ ] All issues documented
- [ ] Integration points verified
- [ ] Next file identified
- [ ] Tracking sheet updated

**Next File**: [filename and reason]

---

**END OF PROMPT**

---

## Usage Notes

1. **Replace [FILENAME]**: Change `[FILENAME]` to actual file path before using
   - Example: `src/core/UNIFIED-CONTROL.ts`

2. **One File at a Time**: Complete all 8 phases for one file before moving to next

3. **Update Tracking Sheet**: After analysis, record findings in ANALYSIS-TRACKING-SHEET.md

4. **Follow the Chain**: The analysis will tell you which file to analyze next

5. **Expected Time**: 20-30 minutes per file (slow is good!)

---

## Example Usage

**Copy this prompt and replace [FILENAME] with**:

**For Paper Trading Issue**:
- Start: `src/core/UNIFIED-CONTROL.ts`
- Then: `src/core/CONFIG-BRIDGE.ts`
- Then: `src/index.ts`
- Then: `src/utils/handlers/jupiterHandler.ts`

**For MI System Issue**:
- Start: `market-intelligence/config/mi-config.ts`
- Then: `market-intelligence/handlers/market-recorder.ts`
- Then: `src/index.ts` (integration points)

---

## What This Catches That Regular Analysis Misses

1. **Unused imports** - Code imported but never used (suggests dead code path)
2. **Dead exports** - Functions exported but nothing imports them
3. **Broken import chains** - File A imports from B, but B doesn't export it
4. **Unreachable code** - Functions that exist but are never called
5. **Hardcoded overrides** - Values that ignore configuration
6. **Integration breaks** - Where file communication breaks down
7. **Silent failures** - Code that fails but doesn't error
8. **Configuration gaps** - Settings that are read but never used

This is why we go SLOW and THOROUGH.
