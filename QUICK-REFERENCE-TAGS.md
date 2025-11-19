# SOL-BOT Quick Reference Tags

## 🔍 How to Use This System

When you need to recall specific information in future conversations with Claude Code, use these **exact search phrases**:

---

## 📊 EXIT SYSTEM & TRADING ANALYSIS

### Primary Tags:
- `EXIT-SYSTEM-TIMER-ANALYSIS` - Complete analysis of timer-based exit system
- `TIERED-EXIT-REFERENCE` - Explanation of 2x/4x/6x/20x tier system
- `AUG-25-SESSION-SUCCESS` - Why August 25 test worked (83.7% win rate)
- `GRPC-MIGRATION-PREP` - Prerequisites for VIP2 gRPC integration

### Related Files:
- `EXIT-SYSTEM-ANALYSIS.md` - Full comprehensive analysis
- `SOL-BOT Trading Session Analysis Report 8.31.pdf` - Original session data
- `CLAUDE.md` (lines 48-72) - Quick reference section

### When to Use:
- Before migrating gRPC from VIP2
- When debugging exit timing issues
- Understanding why test session succeeded
- Planning exit system improvements

---

## 🎯 KEY INSIGHTS TO RECALL

### Exit System:
```
"Show me EXIT-SYSTEM-TIMER-ANALYSIS"
- Timer-based checks: 30s, 1m, 2m, 3m, 5m, 10m, 15m, 30m, 45m
- NOT real-time price monitoring
- Code location: automated-reporter.ts:216-229
```

### Success Formula:
```
"Show me AUG-25-SESSION-SUCCESS analysis"
- 83.7% win rate from quality token selection
- Tokens rose steadily (10-30 min), not flash pumps
- Timer checks caught exits at tier targets
- 89.7% of 5x+ trades used scheduled tier exits
```

### Migration Planning:
```
"Show me GRPC-MIGRATION-PREP checklist"
- Keep timer system (don't break it)
- Add gRPC as complement, not replacement
- Verify partial exits work first
- Use hybrid approach (timers + gRPC triggers)
```

---

## 💡 BEST PRACTICES FOR FUTURE SESSIONS

### Starting a New Session:
1. Ask Claude: "Read EXIT-SYSTEM-ANALYSIS.md"
2. Provide context: "We're migrating gRPC from VIP2"
3. Reference tags: "Review GRPC-MIGRATION-PREP"

### During Development:
- Use exact file:line references from analysis
- Compare with current code state
- Check if partial exits now implemented

### Before Testing:
- Verify checklist items in EXIT-SYSTEM-ANALYSIS.md
- Review verification commands (grep patterns)
- Confirm timer vs gRPC hybrid approach

---

## 📁 DOCUMENT HIERARCHY

```
CLAUDE.md (project memory)
  ├── Quick reference to tags
  └── Points to detailed docs

EXIT-SYSTEM-ANALYSIS.md (comprehensive)
  ├── Full technical analysis
  ├── Code locations
  ├── Migration strategy
  └── Verification checklist

QUICK-REFERENCE-TAGS.md (this file)
  └── How to recall information
```

---

## 🔑 EXAMPLE PROMPTS FOR CLAUDE

### Good Prompts:
```
"Load EXIT-SYSTEM-TIMER-ANALYSIS and review the migration checklist"

"Reference TIERED-EXIT-REFERENCE - how do the tier targets work?"

"Show me the AUG-25-SESSION-SUCCESS analysis - why did it work?"

"I'm ready to migrate gRPC - show me GRPC-MIGRATION-PREP"
```

### Less Effective:
```
"How does the exit system work?" (too vague)
"Remind me about that timer thing" (no specific tag)
"What was that analysis about?" (no context)
```

---

## 🎯 UPDATING THIS SYSTEM

When adding new reference material:

1. **Create the document** with detailed analysis
2. **Add search tags** at the top in ALL CAPS with hyphens
3. **Update CLAUDE.md** with quick reference
4. **Update this file** with new tags and usage

### Tag Naming Convention:
- Use: `SYSTEM-FEATURE-PURPOSE` format
- Example: `EXIT-SYSTEM-TIMER-ANALYSIS`
- All caps, hyphens for spaces
- Descriptive and searchable

---

**Created:** 2025-10-27
**Purpose:** Enable easy context recall in future Claude Code sessions
