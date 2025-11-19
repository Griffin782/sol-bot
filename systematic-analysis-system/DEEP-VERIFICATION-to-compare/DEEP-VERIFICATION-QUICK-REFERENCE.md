# DEEP VERIFICATION TOOLBOX - QUICK REFERENCE

## 🎯 WHAT YOU HAVE

**1. Agent:** `deep-integration-tracer.md`
- Install in: `.claude/agents/`
- Runs automatically in Claude Code
- Systematic, comprehensive

**2. Prompt Template:** `DEEP-VERIFICATION-PROMPT-TEMPLATE.md`
- Copy/paste to Claude Code when needed
- Customizable for specific systems
- Quick verification

**3. This Guide:** Decision tree for which to use

---

## 🤔 WHICH ONE SHOULD I USE?

### Use the AGENT when:

✅ **Verifying entire project**
- "Check if all systems are really integrated"
- "Verify everything marked COMPLETE is actually complete"
- Post-integration audit

✅ **Multiple systems to check**
- "Check config, exit system, and safety system"
- Need comprehensive report

✅ **Don't know what to look for**
- "Find all integration issues"
- Let agent do systematic search

✅ **Want reusable verification**
- Need to check same things regularly
- Add to project workflow

**Command:**
```
Use deep-integration-tracer subagent to verify all integrations
```

---

### Use the PROMPT TEMPLATE when:

✅ **Single system verification**
- "Is UNIFIED-CONTROL actually used?"
- "Is PARTIAL-EXIT-SYSTEM really integrated?"

✅ **Specific doubt**
- Documentation says X, behavior shows Y
- Want to verify one claim

✅ **Quick check needed**
- Don't need full audit
- Just verify one thing

✅ **Customizing the check**
- Add specific searches
- Focus on specific files

**How:** Copy template, customize, paste to Claude Code

---

## 🚨 RED FLAG SCENARIOS (Use Immediately)

**Scenario 1: Documentation Says Complete But...**
- Behavior doesn't match docs
- Changes don't take effect
- Old code seems to still run

**→ Use:** Prompt Template (Quick Check version)

---

**Scenario 2: Workarounds Found**
- See "FORCE", "OVERRIDE", "HACK" comments
- Functions ignore parameters
- Code has "temporary fix" notes

**→ Use:** Agent (find ALL workarounds)

---

**Scenario 3: Multiple Config Files**
- Several config files exist
- Unclear which one wins
- Settings scattered

**→ Use:** Agent (map full hierarchy)

---

**Scenario 4: Tests Pass But Bot Fails**
- Tests say it works
- Production shows different behavior
- Superficial checks look good

**→ Use:** Agent (trace execution paths)

---

**Scenario 5: Documentation Conflicts**
- Different docs say different things
- "Complete" in one place, "TODO" in another
- Status unclear

**→ Use:** Agent (reconcile all claims)

---

## 💡 REAL EXAMPLES FROM YOUR BOT

### Example 1: Config System (What We Just Found)

**Red Flag:** 
- Docs said "UNIFIED-CONTROL is single source"
- But index.ts reads .env directly
- secure-pool-system.ts has workaround

**Should Have Used:** Agent (would have caught it)

**What It Would Have Found:**
- Layer 4 FAIL: index.ts bypasses UNIFIED-CONTROL
- Layer 6 FAIL: Workaround in secure-pool-system.ts
- Status: INCOMPLETE (not integrated)

---

### Example 2: Exit Systems (Confusing Dual System)

**Red Flag:**
- Both PARTIAL-EXIT and automated-reporter active
- Documentation confused about which is used
- "Not used" but actually was

**Should Have Used:** Agent

**What It Would Have Found:**
- Both systems imported AND called
- No conflict - different purposes
- Documentation wrong about "not used"

---

### Example 3: Test Coverage (0% on Critical Systems)

**Found by:** test-validator agent ✅
**But missed:** That jupiterHandler bug was already fixed
**Should Also Use:** Deep tracer to verify fixes

---

## 📋 DECISION TREE

```
Need verification?
  │
  ├─ Entire project? ────────────► Use AGENT
  │
  ├─ One system? ────────────────► Use PROMPT TEMPLATE
  │
  ├─ Don't know what's wrong? ───► Use AGENT
  │
  ├─ Specific suspicion? ────────► Use PROMPT TEMPLATE (Quick)
  │
  └─ Regular checks? ────────────► Install AGENT
```

---

## 🎯 INSTALLATION & USAGE

### Installing the Agent

```bash
# 1. Create agents directory
mkdir -p .claude/agents

# 2. Copy agent file
cp deep-integration-tracer.md .claude/agents/

# 3. Verify it's there
ls .claude/agents/
```

### Using the Agent

In Claude Code:
```
Use deep-integration-tracer subagent to verify [system name]
```

Or for full project:
```
Use deep-integration-tracer subagent to audit all systems marked COMPLETE
```

### Using the Prompt Template

1. Open: `DEEP-VERIFICATION-PROMPT-TEMPLATE.md`
2. Find: Section for your use case
3. Copy: The template
4. Customize: Replace [SYSTEM_NAME], [filename], etc.
5. Paste: Into Claude Code

---

## ⚡ QUICK COMMANDS

**Full Project Audit:**
```
Use deep-integration-tracer subagent to verify all integrations
```

**Single System (Agent):**
```
Use deep-integration-tracer subagent to verify UNIFIED-CONTROL integration
```

**Single System (Prompt):**
```
[Paste customized prompt from template]
```

**Find All Workarounds:**
```
Use deep-integration-tracer subagent to find all workarounds and explain why they exist
```

---

## 🔑 KEY INSIGHTS

**What Superficial Checks Miss:**

❌ Code exists → But is it called?
❌ Code imported → But does it control behavior?
❌ Tests pass → But do they test the right thing?
❌ Docs say complete → But is old code still running?

**What Deep Verification Catches:**

✅ Execution bypasses (process.env reads)
✅ Workarounds (FORCE, OVERRIDE patterns)
✅ Duplicate systems (old + new coexisting)
✅ False completions (marked done but not integrated)
✅ Documentation lies (claims vs reality)

---

## 📊 SUCCESS METRICS

**Before Deep Verification:**
- Trust documentation
- Assume "complete" means complete
- Debug when things don't work
- Repeat same mistakes

**After Deep Verification:**
- Verify all claims
- Know what's really integrated
- Fix root causes, not symptoms
- Prevent future integration gaps

---

## 🎓 LESSONS LEARNED (From Your Bot)

1. **"Complete" ≠ Integrated**
   - Code can exist without being used
   - Docs can say complete without being true

2. **Workarounds = Red Flags**
   - They indicate incomplete integration
   - They hide the real problem

3. **Superficial Agents Miss Context**
   - They see imports, assume usage
   - They don't trace execution paths
   - They don't understand history

4. **Deep Verification Required**
   - Must trace from entry to execution
   - Must find all bypass paths
   - Must understand why workarounds exist

---

## 💾 SAVE THESE FILES

**In your project:**
- `.claude/agents/deep-integration-tracer.md` (agent)
- `DEEP-VERIFICATION-PROMPT-TEMPLATE.md` (templates)
- This guide (quick reference)

**In your toolbox:**
- Bookmark this guide
- Keep templates handy
- Use before marking things "complete"

---

## ✅ WHEN TO RUN VERIFICATION

**Always run before:**
- Marking any system as "COMPLETE"
- Deploying to production
- Updating documentation
- Claiming integration is done

**Run immediately if:**
- Behavior doesn't match docs
- Changes don't take effect
- Workarounds appear in code
- Multiple people disagree on status
- Tests pass but production fails

**Never skip if:**
- Integration took multiple attempts
- Multiple config files exist
- Documentation conflicts
- Previous integration had issues

---

## 🎯 BOTTOM LINE

**You have TWO tools:**
1. Agent (systematic, comprehensive)
2. Prompt Template (quick, targeted)

**Use them to:**
- Expose false "complete" claims
- Find hidden integration gaps
- Understand workarounds
- Verify actual execution paths

**Result:**
- No more surprises
- Documentation matches reality
- Integration actually complete
- Confidence in your system

---

**Your bot taught us: Superficial checks aren't enough. Always verify DEEP.**
