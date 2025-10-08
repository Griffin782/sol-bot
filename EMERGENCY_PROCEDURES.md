# SOL-BOT Emergency Procedures

## 🚨 IMMEDIATE STOP PROCEDURES

### **Emergency Stop (Under 30 seconds)**
1. **Press `Ctrl+C` in the terminal** running the bot
2. **Wait for "Graceful shutdown complete!" message**
3. **Check wallet balance**: `solana balance EmKj5PB2V6QHQ3uD2NkwGSEum3C5z61p8ehWAGyMcBUV`
4. **Kill any stuck processes**: `taskkill /f /im node.exe` (Windows)
5. **Verify no trades pending**: Check latest transaction on Solscan

### **Nuclear Stop (If Ctrl+C fails)**
1. **Close terminal window completely**
2. **Open Task Manager** (`Ctrl+Shift+Esc`)
3. **End all Node.js processes**
4. **Restart terminal**
5. **Check wallet immediately** for any pending transactions

---

## 🔄 ROLLBACK PROCEDURES

### **Config Rollback (Broken settings)**
1. **Copy backup config**: `copy "z-new-controls\z-masterConfig.ts.backup" "z-new-controls\z-masterConfig.ts"`
2. **Reset test mode**: Change line 143 to `z_testMode: true,`
3. **Clear corrupted data**: `del data\*.csv` and `del data\*.json`
4. **Rebuild**: `npm run build`
5. **Test with**: `npm run dev:test5`

### **Full System Rollback (Everything broken)**
1. **Stop bot**: `Ctrl+C` and verify shutdown
2. **Restore from backup**: `xcopy "backup-complete-2025-09-08T11-16\*" "." /E /Y`
3. **Reset environment**: `copy ".env.backup" ".env"`
4. **Clear node modules**: `rmdir node_modules /s` then `npm install`
5. **Test basic function**: `npm run dev:test5`

---

## 🔍 ISSUE DIAGNOSIS

### **Quick Health Check (2 minutes)**
1. **Check bot status**: Look for `✅ Graceful shutdown complete` in console
2. **Check wallet balance**: `solana balance EmKj5PB2V6QHQ3uD2NkwGSEum3C5z61p8ehWAGyMcBUV`
3. **Check recent trades**: Open `data/trading_log.json` for last 5 entries
4. **Check errors**: `findstr "ERROR\|FAILED\|429" console.log`
5. **Check config**: Verify `z_testMode: false` in z-masterConfig.ts

### **Common Error Patterns**

#### **🚫 "429 Rate Limit" Errors**
**Symptoms**: `Request failed with status code 429`
**Quick Fix**:
1. **Stop bot** (`Ctrl+C`)
2. **Wait 10 minutes** for rate limit reset
3. **Increase delays**: Change `5000` to `10000` in rate limit sections
4. **Restart with limits**: `npm run dev:test5`

#### **💰 "Insufficient Balance" Errors**
**Symptoms**: `balance < 0.1 * LAMPORTS_PER_SOL`
**Quick Fix**:
1. **Check actual balance**: `solana balance`
2. **If low**: Transfer more SOL to wallet
3. **If showing wrong**: Restart bot (RPC cache issue)
4. **If stuck trades**: Check Solscan for pending transactions

#### **🔧 "Config Import" Errors**
**Symptoms**: `Cannot find module`, using fallback values
**Quick Fix**:
1. **Check file exists**: `dir z-new-controls\z-masterConfig.ts`
2. **Fix import path**: Verify `../z-new-controls/z-masterConfig` in imports
3. **Rebuild TypeScript**: `npm run build`
4. **Clear TypeScript cache**: `del *.tsbuildinfo`

#### **🛡️ "Quality Filter" Errors**
**Symptoms**: All tokens blocked, no trades
**Quick Fix**:
1. **Lower threshold**: Change `totalScore >= 65` to `>= 50` in TOKEN-QUALITY-FILTER.ts
2. **Check API access**: Test internet connectivity
3. **Disable temporarily**: Comment out quality filter calls
4. **Check scam list**: Remove overly broad patterns

---

## 🚑 RECOVERY PROCEDURES

### **After Bot Crash**
1. **Check crash logs**: Look for last error message in console
2. **Verify wallet safety**: `solana balance` and check Solscan
3. **Clear temporary files**: `del temp\*` and `del logs\*.tmp`
4. **Restart with test mode**: Set `z_testMode: true` for safety
5. **Run diagnostics**: `npm run dev:test5` and monitor first 5 trades

### **After Bad Trades (Lost money)**
1. **STOP IMMEDIATELY**: `Ctrl+C` and verify shutdown
2. **Analyze what happened**: Check `data/trading_log.json` for failed trades
3. **Enable test mode**: Set `z_testMode: true` in z-masterConfig.ts
4. **Adjust filters**: Increase quality thresholds, add scam patterns
5. **Paper trade first**: Run `npm run dev:test5` to verify fixes

### **After Config Corruption**
1. **Backup current state**: `copy z-new-controls\z-masterConfig.ts corrupted-config.ts`
2. **Restore known good config**: Use backup from `backup-complete-2025-09-08T11-16`
3. **Reset to safe defaults**:
   - `z_testMode: true`
   - `z_positionSize: 0.01` (tiny amounts)
   - `z_duration: 60` (1 minute tests)
4. **Rebuild and test**: `npm run build` then `npm run dev:test5`
5. **Gradually restore settings**: Increase position size only after successful tests

---

## ⚡ QUICK REFERENCE COMMANDS

### **Emergency Commands**
```bash
# Stop bot gracefully
Ctrl+C

# Force stop all node processes
taskkill /f /im node.exe

# Check wallet balance
solana balance EmKj5PB2V6QHQ3uD2NkwGSEum3C5z61p8ehWAGyMcBUV

# Safe restart with 5 trades
npm run dev:test5

# Enable test mode
# Edit z-masterConfig.ts line 143: z_testMode: true,
```

### **Recovery Commands**
```bash
# Full rebuild
npm run clean && npm install && npm run build

# Reset to test mode and small amounts
# Edit z-masterConfig.ts:
# z_testMode: true,
# z_positionSize: 0.01,

# Clear corrupted data
del data\*.csv && del data\*.json

# Restore from backup
xcopy "backup-complete-2025-09-08T11-16\*" "." /E /Y
```

### **Diagnostic Commands**
```bash
# Check for errors
findstr "ERROR\|FAILED\|429\|CRASH" *.log

# Check recent trades
type data\trading_log.json | findstr "timestamp" | tail -5

# Check wallet transactions
# Visit: https://solscan.io/account/EmKj5PB2V6QHQ3uD2NkwGSEum3C5z61p8ehWAGyMcBUV

# Test config loading
npm run check-config
```

---

## 🛡️ PREVENTION CHECKLIST

### **Before Starting Live Trading**
- [ ] Set `z_testMode: false` ONLY after successful test runs
- [ ] Verify wallet has sufficient SOL (minimum 1 SOL)
- [ ] Check quality filter is enabled and working
- [ ] Run `npm run dev:test5` successfully first
- [ ] Have backup of working config files

### **During Trading**
- [ ] Monitor console for 429 errors
- [ ] Check wallet balance every hour
- [ ] Watch for excessive token rejections
- [ ] Verify trades are actually executing (not just logging)
- [ ] Keep terminal window visible for immediate stop if needed

### **Daily Maintenance**
- [ ] Review trading_log.json for performance
- [ ] Check token_quality_checks.csv for filter effectiveness
- [ ] Backup current config files
- [ ] Clear old log files to save space
- [ ] Verify wallet security (no unauthorized access)

---

## 📱 Emergency Contacts & Resources

### **Immediate Help**
- **Solana RPC Status**: https://status.solana.com/
- **Jupiter API Status**: Check their Discord/Twitter
- **Wallet Explorer**: https://solscan.io/account/EmKj5PB2V6QHQ3uD2NkwGSEum3C5z61p8ehWAGyMcBUV

### **If All Else Fails**
1. **Stop bot completely**
2. **Secure wallet** (transfer SOL to hardware wallet if needed)
3. **Document the issue** (screenshots, error messages)
4. **Restore from backup** (use backup-complete-2025-09-08T11-16)
5. **Start over with test mode** until issue resolved

**Remember: It's better to lose trading time than lose actual SOL. When in doubt, stop and diagnose.**