# DEEP VERIFICATION PROMPT TEMPLATE

Use this prompt when you need to verify if something is ACTUALLY integrated, not just superficially complete.

---

## 🎯 TEMPLATE FOR CLAUDE CODE

Copy and customize this prompt:

```
DEEP INTEGRATION VERIFICATION

I need you to verify if [SYSTEM_NAME] is ACTUALLY integrated, not just superficially.

Follow this 6-layer verification:

**Layer 1: Code Exists**
- Find the file: [filename]
- Verify it compiles
- Count lines of code

**Layer 2: Code Imported**  
- Search: grep -rn "import.*[filename]\|require.*[filename]" src/
- List all files that import it
- Show line numbers

**Layer 3: Code Called**
- For each import location, verify the function is CALLED
- Don't just check imports, check actual invocations
- Show where it's called: grep -rn "functionName(" src/

**Layer 4: Controls Behavior**
- Trace execution from call to result
- Check if OTHER code overrides it
- Look for: hardcoded values, env vars, old implementations
- Which one actually runs?

**Layer 5: No Bypass Exists**
- Search for bypasses:
  - process.env reads: grep -rn "process.env" [main-file]
  - Hardcoded values: grep -rn "const.*=.*[value]" [main-file]
  - Old implementations: grep -rn "old\|legacy\|deprecated" src/
- Does ANY code path skip the new system?

**Layer 6: No Workarounds**
- Search for red flags:
  - grep -rn "FORCE\|OVERRIDE\|IGNORE\|HACK\|FIXME\|TODO" src/
  - grep -rn "// Had to.*because\|// Workaround" src/
  - grep -rn "= false.*force\|= true.*force" src/
- Why do these workarounds exist?

**Required Output:**

Create: DEEP-VERIFICATION-[SYSTEM].md

Include:
1. Layer-by-layer results (pass/fail for each)
2. Execution path diagram (expected vs actual)
3. All workarounds found (with explanations)
4. Integration status (complete/partial/broken)
5. Required fixes (if incomplete)
6. Evidence (grep outputs, line numbers, code snippets)

**Critical:** If ANY layer fails, status is INCOMPLETE.
Don't say "mostly integrated" - it either is or isn't.
```

---

## 🔍 EXAMPLE: Verify Config System

```
DEEP INTEGRATION VERIFICATION

I need you to verify if UNIFIED-CONTROL.ts is ACTUALLY the single source of truth for configuration.

Documentation claims:
- "UNIFIED-CONTROL.ts is single source of truth" (PROJECT-STATUS.md)
- "Step 5: Unified Test Mode - COMPLETE ✅" (claude-ai.txt)

Follow this 6-layer verification:

**Layer 1: Code Exists**
- Find: src/core/UNIFIED-CONTROL.ts
- Verify it compiles
- Count lines of code

**Layer 2: Code Imported**
- Search: grep -rn "UNIFIED-CONTROL\|getCurrentMode\|MASTER_SETTINGS" src/
- List all files that import it
- Show line numbers

**Layer 3: Code Called**
- For each import location, verify functions are CALLED
- Search: grep -rn "getCurrentMode()\|MASTER_SETTINGS\." src/
- Show actual invocation lines

**Layer 4: Controls Behavior**
- Check if index.ts reads config values directly:
  - grep -n "process.env" index.ts
  - grep -n "const.*MODE.*=.*" index.ts
- Which wins: UNIFIED-CONTROL or direct reads?
- Trace: Where does TEST_MODE/IS_TEST_MODE come from?

**Layer 5: No Bypass Exists**
- Search: grep -rn "process.env.TEST_MODE\|TEST_MODE.*=.*true\|TEST_MODE.*=.*false" src/
- Does index.ts bypass UNIFIED-CONTROL?
- Do any files read .env directly?

**Layer 6: No Workarounds**
- Search: grep -rn "FORCE.*MODE\|IGNORE.*mode\|override.*test" src/
- Check secure-pool-system.ts for forced values
- Why do workarounds exist?

**Required Output:**

Create: DEEP-VERIFICATION-CONFIG-SYSTEM.md

Show me:
1. Is UNIFIED-CONTROL actually used? (Yes/No with evidence)
2. Execution path: .env → index.ts → where?
3. Does it use UNIFIED-CONTROL or bypass it?
4. All workarounds found
5. TRUE integration status
6. Fixes needed if incomplete

Be brutally honest. If it's not fully integrated, say so with evidence.
```

---

## 🎯 EXAMPLE: Verify Exit System

```
DEEP INTEGRATION VERIFICATION

Verify if PARTIAL-EXIT-SYSTEM.ts is actually integrated and used.

Claims:
- "Partial Exit System - COMPLETE" (multiple docs)
- "4-tier profit taking working"

Follow this 6-layer verification:

**Layer 1: Code Exists**
- Find: src/PARTIAL-EXIT-SYSTEM.ts
- Verify compiles

**Layer 2: Code Imported**
- grep -rn "PARTIAL-EXIT-SYSTEM" src/

**Layer 3: Code Called**
- grep -rn "PartialExitManager\|addPosition\|checkPositions" src/
- Show where instantiated
- Show where methods called

**Layer 4: Controls Behavior**
- Is it the ONLY exit system or are there multiple?
- Check: grep -rn "automated-reporter\|WhaleWatcher" src/
- Which exit system actually runs?
- Do both run? Conflict?

**Layer 5: No Bypass Exists**
- Are there ANY other exit implementations?
- Check for old exit code still present
- Are exits hardcoded anywhere?

**Layer 6: No Workarounds**
- grep -rn "FORCE.*EXIT\|manual.*exit\|hardcoded.*tier" src/
- Are tiers (2x, 4x, 6x) actually used or hardcoded?

Output: DEEP-VERIFICATION-EXIT-SYSTEM.md

Show:
- How many exit systems exist?
- Which one(s) actually run?
- Execution path from position open → tier check → sell
- Do tiers work as documented?
- True integration status
```

---

## 📝 QUICK VERIFICATION (Shortened Version)

For faster checks, use this compact template:

```
QUICK DEEP CHECK: [System Name]

Verify these 3 critical points:

1. ACTUAL USAGE
   grep -rn "[main function](" src/
   → Is it actually called? Where?

2. NO BYPASSES  
   grep -rn "process.env\|hardcoded\|override" [main file]
   → Does anything bypass it?

3. NO WORKAROUNDS
   grep -rn "FORCE\|HACK\|TODO\|FIXME" [related files]
   → Why do workarounds exist?

Output:
- Used: Yes/No (with line numbers)
- Bypassed: Yes/No (with evidence)  
- Workarounds: List them with reasons
- Status: COMPLETE or INCOMPLETE
- Fix needed: [describe if incomplete]

No fluff. Just facts and line numbers.
```

---

## 🎯 WHEN TO USE EACH

**Use AGENT** (`deep-integration-tracer`) when:
- ✅ Verifying entire project status
- ✅ Checking multiple systems
- ✅ Need comprehensive report
- ✅ Want systematic verification

**Use PROMPT TEMPLATE** when:
- ✅ Quick verification of one system
- ✅ Documentation claims seem wrong
- ✅ Behavior doesn't match docs
- ✅ Need immediate answer

**Use QUICK VERSION** when:
- ✅ Just checking if something is actually used
- ✅ Fast bypass detection
- ✅ Workaround hunting
- ✅ Time-sensitive

---

## 🔑 KEY PRINCIPLES

1. **Never trust "COMPLETE" without verification**
2. **Always trace from entry point to actual execution**
3. **Workarounds = Red flags of incomplete work**
4. **Imports ≠ Integration** (must verify calls)
5. **Tests passing ≠ Correct** (old code might still run)
6. **All 6 layers must pass** or it's incomplete

---

## 💡 PROMPTING TIPS

**Be specific:**
❌ "Check if config is integrated"
✅ "Verify index.ts uses UNIFIED-CONTROL, not process.env"

**Demand evidence:**
❌ "Is it working?"
✅ "Show grep results and line numbers proving it's called"

**Ask for execution paths:**
❌ "Does it work?"
✅ "Trace from index.ts line 1 to where config value is used"

**Look for red flags:**
❌ "Any issues?"
✅ "Search for FORCE, OVERRIDE, HACK, TODO in all files"

---

## 📋 SAVED SEARCHES (Add to your toolbox)

```bash
# Find bypasses
grep -rn "process.env\|require.*old.*config" src/

# Find workarounds  
grep -rn "FORCE\|OVERRIDE\|IGNORE\|HACK\|TODO" src/

# Find duplicates
grep -rn "Old.*New\|Legacy.*Modern\|V1.*V2" src/

# Find hardcoded values
grep -rn "const.*=.*0\.\|= true.*FORCE\|= false.*FORCE" src/

# Find commented explanations
grep -rn "// Had to\|// Workaround\|// FIXME" src/

# Find actual function calls
grep -rn "functionName(" src/  # Replace functionName
```

---

## ✅ SUCCESS CHECKLIST

After running verification:

- [ ] Got layer-by-layer results (1-6)
- [ ] Have execution path diagram  
- [ ] Found all workarounds (or confirmed none)
- [ ] Know true integration status
- [ ] Have evidence (line numbers, grep output)
- [ ] Understand what needs fixing (if incomplete)
- [ ] Can explain why documentation was wrong

**If you can't check all boxes, verification isn't complete.**

---

Save this template. Use it whenever docs say "complete" but you have doubts.
