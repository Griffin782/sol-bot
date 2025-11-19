# Analysis Tracking Sheet

**Session Date**: [YYYY-MM-DD]
**Issue Being Investigated**: [Paper Trading / MI System / Other]
**Analyst**: [Your Name]
**Session Start Time**: [HH:MM]

---

## Session Overview

**Goal**: [What are you trying to find/fix?]

**Files to Analyze** (in order):
1. [ ] [Filename 1]
2. [ ] [Filename 2]
3. [ ] [Filename 3]
4. [ ] [Filename 4]

**Expected Completion**: [Date/Time]

---

## Per-File Analysis Record

### File 1: [Filename]

**Analysis Start**: [HH:MM]
**Analysis Complete**: [HH:MM]
**Duration**: [minutes]

#### Statistics
- Total Lines: [number]
- Imports: [count] ([X] used, [Y] unused)
- Exports: [count] ([X] used, [Y] dead)
- Functions: [count] ([X] called, [Y] unreachable)
- Constants: [count] ([X] used, [Y] unused)

#### Health: [EXCELLENT/GOOD/FAIR/POOR/CRITICAL]

#### Critical Issues Found
1. [Issue 1 - Severity: CRITICAL/HIGH/MEDIUM/LOW]
   - Location: Line [X]
   - Description: [what's wrong]
   - Impact: [what this breaks]
   - Fix Required: [what needs to change]

2. [Issue 2 - Severity]
   - Location: Line [X]
   - Description:
   - Impact:
   - Fix Required:

#### Dead Code Found
- [ ] Unused Import: [item] from [source] (Line [X])
- [ ] Dead Export: [item] (Line [X])
- [ ] Unreachable Function: [name] (Line [X])
- [ ] Unused Constant: [name] (Line [X])

#### Integration Points Verified
- [✅/❌] Imports from [File A]: Status [OK/BROKEN]
- [✅/❌] Exports to [File B]: Status [OK/BROKEN]
- [✅/❌] Calls functions in [File C]: Status [OK/BROKEN]

#### Next File Recommendation
**Analyze Next**: [Filename]
**Reason**: [why this file next - import chain, export usage, etc.]

#### Notes
[Any additional observations, questions, or concerns]

---

### File 2: [Filename]

**Analysis Start**: [HH:MM]
**Analysis Complete**: [HH:MM]
**Duration**: [minutes]

#### Statistics
- Total Lines: [number]
- Imports: [count] ([X] used, [Y] unused)
- Exports: [count] ([X] used, [Y] dead)
- Functions: [count] ([X] called, [Y] unreachable)
- Constants: [count] ([X] used, [Y] unused)

#### Health: [EXCELLENT/GOOD/FAIR/POOR/CRITICAL]

#### Critical Issues Found
1. [Issue 1]
2. [Issue 2]

#### Dead Code Found
- [ ] [Item 1]
- [ ] [Item 2]

#### Integration Points Verified
- [✅/❌] [Verification 1]
- [✅/❌] [Verification 2]

#### Next File Recommendation
**Analyze Next**: [Filename]
**Reason**: [why]

#### Notes
[Observations]

---

### File 3: [Filename]

[Repeat same structure]

---

## Cross-File Verification

After analyzing 2+ files, verify integration between them:

### Integration Check 1: [File A] → [File B]

**Export from File A**: [item name]
- Line in File A: [X]
- Exported as: [type - default/named]

**Import in File B**: [item name]
- Line in File B: [Y]
- Imported as: [type - default/named]

**Status**: [✅ OK / ❌ BROKEN]
**Issue**: [If broken, describe mismatch]

---

### Integration Check 2: [File B] → [File C]

[Repeat structure]

---

## Dependency Map

Visual representation of how files connect:

```
[File A] → [File B] → [File C]
   ↓          ↓
[File D]   [File E]

Legend:
→ : imports from
✅: verified working
❌: broken connection
⚠️: questionable connection
```

---

## Issues Requiring Fixes

Consolidated list of all issues found across all files:

### CRITICAL Priority

**Issue 1**: [Description]
- **Files Affected**: [List]
- **Root Cause**: [What's actually wrong]
- **Fix Required**: [Specific code changes needed]
- **Related Issues**: [List other related issues]
- **Status**: [NOT STARTED / IN PROGRESS / FIXED]

**Issue 2**: [Description]
- **Files Affected**:
- **Root Cause**:
- **Fix Required**:
- **Status**:

### HIGH Priority

**Issue 3**: [Description]
[Same structure]

### MEDIUM Priority

**Issue 4**: [Description]
[Same structure]

### LOW Priority

**Issue 5**: [Description]
[Same structure]

---

## Dead Code Summary

Consolidated list of dead code that can be safely removed:

### Unused Imports (Can Remove)
1. File: [name], Line: [X], Import: [item] from [source]
2. File: [name], Line: [X], Import: [item] from [source]

### Dead Exports (Nothing Imports These)
1. File: [name], Line: [X], Export: [item]
2. File: [name], Line: [X], Export: [item]

### Unreachable Functions (Never Called)
1. File: [name], Line: [X], Function: [name]
2. File: [name], Line: [X], Function: [name]

### Unused Constants (Declared But Never Used)
1. File: [name], Line: [X], Constant: [name]
2. File: [name], Line: [X], Constant: [name]

**Total Dead Code Lines**: [count]
**Potential Size Reduction**: [percentage]%

---

## Root Cause Analysis

After analyzing all files in the chain, identify the root cause:

### The Bug

**What's Happening**: [Describe the observed behavior]

**What Should Happen**: [Describe expected behavior]

**Root Cause**: [What's actually wrong in the code]

**Evidence**:
1. [Finding from File A]
2. [Finding from File B]
3. [Finding from File C]

**Why This Wasn't Found Before**: [What made this hard to catch]

---

## Fix Plan

Specific steps to fix the identified issues:

### Fix 1: [Issue Name]

**Files to Modify**:
1. [File A] - [what to change]
2. [File B] - [what to change]

**Code Changes Required**:

**In File A, Line X**:
```typescript
// FIND THIS:
[current code]

// REPLACE WITH:
[fixed code]
```

**In File B, Line Y**:
```typescript
// FIND THIS:
[current code]

// REPLACE WITH:
[fixed code]
```

**Testing Steps**:
1. [Test step 1]
2. [Test step 2]
3. [Verification criteria]

**Rollback Plan**: [How to undo if fix breaks something]

---

### Fix 2: [Issue Name]

[Same structure]

---

## Session Summary

**Session End Time**: [HH:MM]
**Total Duration**: [hours] hours [minutes] minutes

**Files Analyzed**: [count]
**Issues Found**: [count]
  - Critical: [count]
  - High: [count]
  - Medium: [count]
  - Low: [count]

**Dead Code Found**: [count] items

**Root Cause Identified**: [YES/NO]
**Fix Plan Created**: [YES/NO]

**Overall Assessment**: [Summary of findings]

**Next Steps**:
1. [Action item 1]
2. [Action item 2]
3. [Action item 3]

**Questions/Blockers**:
- [Question 1]
- [Question 2]

---

## Appendix: Detailed Notes

### Additional Observations
[Anything that doesn't fit above categories but seems relevant]

### Code Patterns Noticed
[Recurring patterns, good or bad]

### Architecture Notes
[Insights about overall system design]

### Performance Concerns
[Any performance issues noticed during analysis]

---

## Checklist Before Closing Session

Before marking this session complete, verify:

- [ ] All planned files analyzed
- [ ] All imports traced to source
- [ ] All exports checked for usage
- [ ] All integration points verified
- [ ] All issues documented with severity
- [ ] Root cause identified (if possible)
- [ ] Fix plan created (if root cause found)
- [ ] Tracking sheet saved to SESSION-LOGS/
- [ ] Ready for next session or ready to implement fixes

**Status**: [COMPLETE / IN PROGRESS / BLOCKED]

---

## Template Usage Instructions

1. **Copy this template** to SESSION-LOGS/ folder
2. **Rename** to: `session-[YYYY-MM-DD]-[issue-name].md`
   - Example: `session-2025-10-31-paper-trading.md`
3. **Fill in** each section as you complete analysis
4. **Don't skip** sections - thoroughness is the goal
5. **Update** after each file analysis
6. **Review** before closing session

**Remember**: This is your evidence trail. Be detailed. Future you (or others) will thank you for thorough documentation.
