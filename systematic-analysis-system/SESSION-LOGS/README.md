# Session Logs Folder

**Purpose**: Store individual analysis session records

---

## How to Use This Folder

When starting a new systematic analysis session:

1. **Copy** `../ANALYSIS-TRACKING-SHEET.md` to this folder
2. **Rename** to: `session-[YYYY-MM-DD]-[issue-name].md`
   - Example: `session-2025-10-31-paper-trading.md`
   - Example: `session-2025-11-01-mi-system.md`
3. **Fill in** as you analyze each file
4. **Save** after completing each file analysis
5. **Keep** for future reference

---

## Naming Convention

Format: `session-[DATE]-[ISSUE].md`

**Examples**:
- `session-2025-10-31-paper-trading.md` - Paper trading not working analysis
- `session-2025-10-31-mi-system.md` - MI system initialization analysis
- `session-2025-11-01-config-migration.md` - Config.ts migration analysis
- `session-2025-11-01-exit-system.md` - Partial exit system analysis

---

## What to Save

Each session file should contain:

- **Session metadata** (date, issue, analyst, duration)
- **Files analyzed** (with per-file statistics)
- **Issues found** (with severity and location)
- **Dead code identified** (unused imports, unreachable functions)
- **Integration verification** (cross-file dependencies)
- **Root cause analysis** (what's actually wrong)
- **Fix plan** (specific code changes needed)
- **Session summary** (findings and next steps)

---

## Session Lifecycle

### Before Starting
- [ ] Copy ANALYSIS-TRACKING-SHEET.md template
- [ ] Rename with date and issue name
- [ ] Fill in session overview section
- [ ] Identify files to analyze

### During Analysis
- [ ] Complete analysis for File 1
- [ ] Update tracking sheet File 1 section
- [ ] Complete analysis for File 2
- [ ] Update tracking sheet File 2 section
- [ ] Continue for all files in chain
- [ ] Update cross-file verification section

### After Completing Chain
- [ ] Fill in root cause analysis
- [ ] Create fix plan with specific changes
- [ ] Write session summary
- [ ] Mark checklist as complete
- [ ] Save final version

### After Implementing Fixes
- [ ] Add "RESOLVED" to filename
- [ ] Example: `session-2025-10-31-paper-trading-RESOLVED.md`
- [ ] Document what was fixed and test results

---

## Example Session Files

This folder will contain files like:

```
SESSION-LOGS/
├── README.md (this file)
├── session-2025-10-31-paper-trading.md (in progress)
├── session-2025-10-31-paper-trading-RESOLVED.md (completed)
├── session-2025-11-01-mi-system.md (in progress)
├── session-2025-11-01-mi-system-RESOLVED.md (completed)
└── [future sessions...]
```

---

## Session Status

| Status | Meaning | Filename Suffix |
|--------|---------|----------------|
| In Progress | Analysis ongoing | `.md` |
| Complete | Analysis done, fixes pending | `-COMPLETE.md` |
| Resolved | Fixes implemented and tested | `-RESOLVED.md` |
| Abandoned | Analysis stopped, issue deferred | `-ABANDONED.md` |

---

## Tips

1. **Don't delete sessions** - Keep as historical record
2. **Be thorough** - Future you will thank present you
3. **Update frequently** - Save after each file
4. **Cross-reference** - Link related sessions
5. **Document surprises** - Note unexpected findings

---

## Current Sessions

*None yet - this folder is empty and ready for your first analysis*

**To start**:
1. Copy `../ANALYSIS-TRACKING-SHEET.md`
2. Rename to `session-[today's date]-[your issue].md`
3. Begin systematic analysis

---

**Last Updated**: 2025-10-31
**Next Action**: Start your first systematic analysis session
