# Database Status Checker - Quick Guide

**Created**: October 28, 2025
**Script**: `market-intelligence/check-database-status.ts`
**Command**: `npm run check-db`

---

## 🎯 WHAT IT DOES

Quickly checks the health and statistics of your Market Intelligence databases without needing to know SQL.

---

## 🚀 HOW TO USE

```bash
npm run check-db
```

That's it! No parameters needed.

---

## 📊 WHAT IT SHOWS

### **For Each Database File**:

1. **File Info**:
   - Filename
   - Size in MB
   - Last modified date/time

2. **Token Counts**:
   - Tokens Scored (all detected tokens)
   - Tokens Tracked (tokens bot would buy)
   - Duplicate check status

3. **Decisions**:
   - How many would-buy vs blocked
   - Percentages for each

4. **Time Range**:
   - First token timestamp
   - Last token timestamp
   - Duration (minutes and hours)
   - Rate (tokens per minute)

5. **Top Blocked Reasons**:
   - Why tokens were rejected
   - Count for each reason

6. **Recent Tokens**:
   - Last 5 tokens detected
   - Mint address, name, symbol, score
   - Would-buy status

7. **Health Checks**:
   - Duplicate mints (should be none)
   - Encoding errors (should be none)

---

## 📁 DATABASES CHECKED

### **1. Baseline Recorder** (`data/market-baseline/`)
- Standalone 24/7 market observer
- Format: `baseline-YYYY-MM-DD.db`
- Created by: `npm run mi-baseline`

### **2. Bot Sessions** (`data/bot-sessions/`)
- Bot session performance tracking
- Format: `{type}-session-{ID}.db`
- Created automatically when bot runs

---

## 📋 EXAMPLE OUTPUT

```
📊 MARKET INTELLIGENCE DATABASE STATUS

════════════════════════════════════════════════════════════
📁 BASELINE RECORDER: ./data/market-baseline
════════════════════════════════════════════════════════════

Found 1 database file(s):

────────────────────────────────────────────────────────────
📁 FILE: baseline-2025-10-28.db
📏 SIZE: 2.18 MB
📅 MODIFIED: 10/28/2025, 6:54:44 PM

✅ Tokens Scored: 9,959
📊 Tokens Tracked: 1,234
✅ No Duplicate Mints (clean database)

🎯 DECISIONS:
  ✅ Would Buy: 1,234 (12.4%)
  ❌ Blocked: 8,725 (87.6%)

⏰ TIME RANGE:
  First Token: 10/28/2025, 7:31:42 AM
  Last Token: 10/28/2025, 6:54:29 PM
  Duration: 682 minutes (11.4 hours)
  Rate: 14.6 tokens/minute

⚠️  TOP BLOCKED REASONS:
  • Low liquidity: 3,456
  • Quality filter: 2,345
  • Honeypot check failed: 1,234
  • Insufficient holders: 890
  • Rugpull risk: 800

📝 RECENT TOKENS:
  ✅ 7VZuqpmU... PumpCoin (PUMP) Score: 75 (6:54:29 PM)
  ❌ 9GyynXD5... ScamToken (SCAM) Score: 30 (6:54:27 PM)
  ✅ 8AGbp8UY... MoonShot (MOON) Score: 80 (6:54:27 PM)

✅ No Encoding Errors (all strings clean)
────────────────────────────────────────────────────────────
```

---

## 🔍 WHAT TO LOOK FOR

### **Good Signs** ✅:
- `✅ No Duplicate Mints (clean database)`
- `✅ No Encoding Errors (all strings clean)`
- Steady token rate (10-20 per minute)
- Database size growing over time
- Reasonable would-buy percentage (5-20%)

### **Warning Signs** ⚠️:
- `⚠️  Duplicate Mints Found: X` (duplicate bug still present)
- `⚠️  Encoding Errors Found: X` (unicode/emoji issues)
- Token rate drops to zero (recorder stopped)
- 100% blocked (filters too strict or detection broken)
- 0% blocked (filters not working)

### **Critical Issues** ❌:
- `❌ Directory not found` (no data collected)
- `❌ No database files found` (recorder never ran)
- `❌ Error reading database` (corruption or access issue)

---

## 🧪 VERIFICATION USE CASES

### **After Bug Fixes**:
```bash
npm run check-db
```
Look for:
- ✅ No Duplicate Mints
- ✅ No Encoding Errors

### **Before Comparison**:
```bash
npm run check-db
```
Verify database exists and has data before running:
```bash
npm run mi-compare ./data/bot-sessions/session.db
```

### **Performance Monitoring**:
```bash
npm run check-db
```
Check:
- Token detection rate (tokens/minute)
- Would-buy percentage
- Database size growth

### **Troubleshooting**:
```bash
npm run check-db
```
Diagnose:
- Why recorder stopped (last token timestamp)
- Why no tokens tracked (blocked reasons)
- Database corruption (error messages)

---

## 💡 QUICK TIPS

### **Run After Each Session**:
```bash
# After bot session
npm run check-db
```
Quickly see what was recorded.

### **Compare Before/After**:
```bash
# Before changes
npm run check-db > before.txt

# Make changes, run recorder

# After changes
npm run check-db > after.txt

# Compare
diff before.txt after.txt
```

### **Monitor Growth**:
```bash
# Every hour
watch -n 3600 npm run check-db
```

---

## 🔧 WHAT IT DOESN'T DO

**Does NOT**:
- Modify databases (read-only)
- Fix errors (diagnostic only)
- Compare sessions (use `npm run mi-compare` instead)
- Show live data (shows what's in database)
- Require database to be closed (can check while recorder runs)

---

## 📊 INTERPRETING RESULTS

### **Token Scored Count**:
- **High (10k+)**: Good data collection
- **Low (< 1k)**: Short session or detection issues
- **Zero**: Recorder not working

### **Tokens Tracked Count**:
- **5-20% of scored**: Healthy filtering
- **< 5%**: Very strict filters (may miss opportunities)
- **> 30%**: Filters too loose (may include garbage)
- **Zero**: Quality filter rejecting everything

### **Token Rate**:
- **10-20 per minute**: Normal Solana activity
- **< 5 per minute**: Low activity period or detection issues
- **> 30 per minute**: High activity or catching up

### **Would-Buy Percentage**:
- **5-15%**: Good balance (selective but catching opportunities)
- **< 5%**: Too strict (missing good tokens)
- **> 25%**: Too loose (including low-quality tokens)

---

## 🎓 ADVANCED USAGE

### **Check Specific Directory**:
Edit the script (lines 11-12) to change directories:
```typescript
const baselineDir = './path/to/your/baseline';
const sessionDir = './path/to/your/sessions';
```

### **Customize Output**:
Modify the script to show/hide sections:
- Comment out sections you don't need
- Add custom SQL queries
- Adjust output formatting

### **Export to File**:
```bash
npm run check-db > database-status.txt
```

### **Scheduled Checks**:
```bash
# Windows Task Scheduler
# Run: npm run check-db >> daily-log.txt

# Or cron (Linux/Mac)
0 */6 * * * cd /path/to/bot && npm run check-db >> logs/db-status.log
```

---

## 🐛 TROUBLESHOOTING

### **"Directory not found"**:
- Recorder hasn't been run yet
- Wrong working directory
- Data deleted/moved

**Fix**: Run `npm run mi-baseline` first

### **"No database files found"**:
- Recorder started but crashed immediately
- Database creation failed
- Wrong directory

**Fix**: Check recorder logs, ensure write permissions

### **"Error reading database"**:
- Database corrupted
- File locked by another process
- Permission issues

**Fix**: Stop recorder, check file permissions, restore backup

### **"tokens_scored table not found"**:
- Incomplete database
- Schema creation failed
- Wrong database file

**Fix**: Delete and recreate database

---

## 📁 FILES RELATED

- **Script**: `market-intelligence/check-database-status.ts`
- **Package.json**: Added `"check-db"` script
- **Data Locations**:
  - `data/market-baseline/` (baseline recorder)
  - `data/bot-sessions/` (bot sessions)

---

## 🔄 WORKFLOW INTEGRATION

### **Typical Daily Workflow**:

1. **Morning**: Check overnight data
   ```bash
   npm run check-db
   ```

2. **After bot session**: Verify recording
   ```bash
   npm run check-db
   ```

3. **Before comparison**: Confirm data exists
   ```bash
   npm run check-db
   npm run mi-compare ./data/bot-sessions/session.db
   ```

4. **Troubleshooting**: Diagnose issues
   ```bash
   npm run check-db
   # Review output for errors
   ```

---

## ✅ SUCCESS INDICATORS

When everything is working well, you should see:
- ✅ Multiple database files
- ✅ Growing file sizes
- ✅ No duplicate mints
- ✅ No encoding errors
- ✅ Reasonable token rates
- ✅ Balanced would-buy percentages
- ✅ Recent tokens showing up

---

**Quick Reference**:
```bash
npm run check-db           # Check all databases
npm run mi-baseline        # Start baseline recorder
npm run mi-compare [db]    # Compare session to baseline
npm run mi-analysis [db]   # Analyze daily data
```

---

**Created**: October 28, 2025
**Version**: 1.0
**Status**: ✅ Ready for use
