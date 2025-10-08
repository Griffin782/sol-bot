# 🆘 SOL-BOT Troubleshooting Guide

**Version:** 8.20 Enhanced  
**Last Updated:** August 27, 2025  
**Target Audience:** All Users

---

## 🚨 **EMERGENCY PROCEDURES**

### **Bot Acting Erratically - IMMEDIATE ACTIONS**
1. **STOP TRADING IMMEDIATELY**: Press `Ctrl+C` to terminate
2. **Check wallet balances** before restarting
3. **Review recent logs** in `/logs/` directory
4. **Backup current state** using emergency backup script
5. **Contact support** if funds are at risk

### **Suspected Security Breach**
1. **IMMEDIATELY STOP BOT**: Terminate all processes
2. **Move funds** to cold storage wallet
3. **Change all API keys** and RPC endpoints
4. **Review transaction logs** for unauthorized trades
5. **Scan system** for malware/keyloggers

---

## 🚀 **STARTUP ISSUES**

### **Bot Won't Start**

#### **Error: "Cannot find module"**
```bash
Error: Cannot find module '@solana/web3.js'
```
**SOLUTION:**
```bash
# Reinstall dependencies
npm install
# Or force clean install
rm -rf node_modules package-lock.json
npm install
```

#### **Error: "RPC endpoint not responding"**
```bash
Error: RPC endpoint https://api.mainnet-beta.solana.com failed
```
**SOLUTION:**
1. Check RPC endpoint status in `masterConfig.ts`
2. Try backup RPC endpoints:
```typescript
rpc: {
  primaryEndpoint: "https://solana-api.projectserum.com",
  backupEndpoints: [
    "https://api.mainnet-beta.solana.com",
    "https://rpc.ankr.com/solana"
  ]
}
```

#### **Error: "Wallet not found"**
```bash
Error: Wallet file not found at ./wallets/wallet1.json
```
**SOLUTION:**
1. Verify wallet file exists and has correct permissions
2. Check `walletRotation.wallets` array in config
3. Ensure wallet files are properly encrypted
```bash
# Check wallet files
ls -la wallets/
# Fix permissions if needed
chmod 600 wallets/*.json
```

#### **Error: "Insufficient SOL balance"**
```bash
Error: Wallet balance 0.001 SOL below minimum 0.01 SOL
```
**SOLUTION:**
1. Fund wallet with minimum 0.01 SOL
2. Adjust `initialPool.minSolBalance` if needed
3. Check transaction fees haven't depleted balance

### **Configuration Loading Issues**

#### **Error: "Invalid configuration format"**
**SOLUTION:**
1. Validate JSON syntax in config files
2. Check for missing commas or brackets
3. Use config validation script:
```bash
npm run validate-config
```

#### **Error: "Parameter out of range"**
**SOLUTION:**
Check these common parameter ranges:
```typescript
// Common valid ranges
slippageTolerance: 0.5-15.0    // 0.5% to 15%
maxPositionSizeUSD: 10-1000    // $10 to $1000
sessionTargets.profitTarget: 0.05-5.0  // 5% to 500%
```

---

## 💰 **TRADING EXECUTION PROBLEMS**

### **Bot Not Executing Trades**

#### **Issue: Bot detects tokens but doesn't trade**
**DIAGNOSIS STEPS:**
1. Check entry criteria in logs
2. Verify wallet has sufficient balance
3. Check market conditions against filters

**COMMON CAUSES:**
- Market cap too high/low
- Liquidity requirements not met
- Risk limits already reached
- Session targets already achieved

**SOLUTIONS:**
1. Lower entry thresholds temporarily:
```typescript
entryFilters: {
  minLiquidity: 5000,        // Lower from 10000
  maxMarketCapUSD: 500000,   // Increase from 100000
  minVolume24h: 1000         // Lower from 5000
}
```

#### **Issue: Trades executing at bad prices**
**CAUSES:**
- Slippage tolerance too high
- Network congestion
- Token experiencing high volatility

**SOLUTIONS:**
1. Reduce slippage tolerance:
```typescript
slippageTolerance: 2.0  // Down from 5.0+
```
2. Enable MEV protection:
```typescript
mevProtection: {
  enabled: true,
  priorityFee: 0.001
}
```

#### **Issue: Exit strategies not triggering**
**DIAGNOSIS:**
1. Check position monitoring logs
2. Verify exit conditions in config
3. Ensure WebSocket connections active

**SOLUTIONS:**
1. Lower exit thresholds:
```typescript
exitStrategies: {
  stopLoss: -0.15,      // Tighter stop loss
  profitTarget: 0.25,   // Lower profit target
  trailingStopTrigger: 0.10  // Earlier trailing activation
}
```

### **Transaction Failures**

#### **Error: "Transaction failed with insufficient funds"**
**SOLUTIONS:**
1. Ensure minimum SOL balance for fees
2. Check priority fee settings
3. Reduce position sizes:
```typescript
maxPositionSizeUSD: 50  // Reduce from higher amount
```

#### **Error: "Slippage tolerance exceeded"**
**SOLUTIONS:**
1. Increase slippage for volatile tokens:
```typescript
slippageTolerance: 8.0  // Increase from 5.0
```
2. Enable dynamic slippage:
```typescript
dynamicSlippage: {
  enabled: true,
  maxSlippage: 15.0,
  volatilityAdjustment: true
}
```

---

## ⚡ **PERFORMANCE & SPEED ISSUES**

### **Slow Token Detection**

#### **Issue: Missing new token launches**
**CAUSES:**
- WebSocket connection delays
- Processing bottlenecks
- Network latency

**SOLUTIONS:**
1. Optimize WebSocket settings:
```typescript
websocket: {
  reconnectDelay: 1000,
  maxReconnectAttempts: 10,
  pingInterval: 30000
}
```
2. Reduce analysis depth for speed:
```typescript
tokenAnalysis: {
  quickScanMode: true,
  skipDetailedAnalysis: false,
  maxAnalysisTime: 2000  // 2 seconds max
}
```

### **High Memory Usage**

#### **Issue: Bot consuming excessive RAM**
**SOLUTIONS:**
1. Enable data cleanup:
```typescript
dataManagement: {
  cleanupInterval: 300000,  // 5 minutes
  maxHistoryEntries: 1000,
  purgeOldData: true
}
```
2. Reduce concurrent operations:
```typescript
performance: {
  maxConcurrentAnalysis: 3,  // Reduce from 5+
  throttleRequests: true
}
```

### **Network Connection Issues**

#### **Issue: Frequent RPC timeouts**
**SOLUTIONS:**
1. Add more backup RPC endpoints
2. Implement RPC rotation:
```typescript
rpc: {
  rotateOnFailure: true,
  maxRetries: 3,
  timeoutMs: 5000
}
```

---

## 🔒 **SECURITY ISSUES**

### **Security Alert Resolution**

#### **Alert: "Unusual trading pattern detected"**
**INVESTIGATION STEPS:**
1. Review recent transaction logs
2. Check for unauthorized API access
3. Verify wallet access patterns
4. Scan for malware

#### **Alert: "Wallet balance discrepancy"**
**IMMEDIATE ACTIONS:**
1. Stop bot immediately
2. Manual wallet balance verification
3. Review all recent transactions
4. Check for duplicate trades

### **API Key Security**

#### **Issue: API keys compromised**
**RECOVERY STEPS:**
1. Immediately revoke all API keys
2. Generate new API keys
3. Update configuration files
4. Review access logs for unauthorized usage

---

## 📊 **DATA & LOGGING ISSUES**

### **Missing Log Files**

#### **Issue: Log files not generating**
**SOLUTIONS:**
1. Check logging configuration:
```typescript
logging: {
  enabled: true,
  level: "info",
  maxFileSize: "10MB",
  maxFiles: 30
}
```
2. Verify file permissions:
```bash
chmod 755 logs/
```

### **Corrupted Data Files**

#### **Issue: CSV/JSON files corrupted**
**RECOVERY:**
1. Check backup files in `./backups/`
2. Use data recovery utility:
```bash
npm run recover-data --date=2025-08-27
```

---

## 🔧 **ADVANCED TROUBLESHOOTING**

### **Performance Profiling**

#### **Enable Debug Mode**
```typescript
debugging: {
  enabled: true,
  level: "verbose",
  performanceMonitoring: true,
  memoryTracking: true
}
```

#### **Generate Performance Report**
```bash
npm run performance-report
# Output: ./reports/performance-YYYY-MM-DD.json
```

### **Database Issues**

#### **SQLite Database Corruption**
**RECOVERY:**
```bash
# Backup current database
cp ./data/trading.db ./data/trading.db.backup

# Run integrity check
sqlite3 ./data/trading.db "PRAGMA integrity_check;"

# Rebuild if corrupted
npm run rebuild-database
```

### **WebSocket Connection Debugging**

#### **Enable WebSocket Logging**
```typescript
websocket: {
  debugging: true,
  logLevel: "verbose",
  connectionMonitoring: true
}
```

---

## 🚨 **ERROR CODE REFERENCE**

### **Critical Errors (1000-1999)**
- **1001**: Wallet initialization failure
- **1002**: RPC connection critical failure
- **1003**: Security breach detected
- **1004**: Insufficient funds for operation
- **1005**: Configuration validation failure

### **Trading Errors (2000-2999)**
- **2001**: Token analysis timeout
- **2002**: Trade execution failure
- **2003**: Position monitoring failure
- **2004**: Exit strategy trigger failure
- **2005**: Slippage tolerance exceeded

### **Network Errors (3000-3999)**
- **3001**: WebSocket connection lost
- **3002**: RPC endpoint timeout
- **3003**: API rate limit exceeded
- **3004**: Network congestion detected
- **3005**: MEV attack detected

### **Data Errors (4000-4999)**
- **4001**: Database corruption detected
- **4002**: Log file write failure
- **4003**: Backup creation failure
- **4004**: Data export failure
- **4005**: CSV generation error

---

## 🛠️ **DIAGNOSTIC TOOLS**

### **Health Check Script**
```bash
npm run health-check
```
**Checks:**
- Configuration validity
- Wallet accessibility
- RPC endpoint status
- Database integrity
- Log file permissions

### **Connection Test**
```bash
npm run test-connections
```
**Tests:**
- All RPC endpoints
- WebSocket connections
- DEX API access
- Database connectivity

### **Performance Benchmark**
```bash
npm run benchmark
```
**Measures:**
- Token detection speed
- Trade execution time
- Memory usage patterns
- Network latency

---

## 📞 **GETTING HELP**

### **Before Contacting Support**

1. **Run diagnostic tools**:
```bash
npm run full-diagnostic
```

2. **Collect relevant logs**:
```bash
# Last 100 lines of main log
tail -100 logs/trading.log

# Error logs only
grep "ERROR" logs/trading.log | tail -50
```

3. **Document your issue**:
- Error message (exact text)
- Configuration settings used
- Steps to reproduce
- System specifications
- Recent changes made

### **Log Analysis Tips**

#### **Important Log Patterns**
```bash
# Search for critical errors
grep -E "(ERROR|CRITICAL|FATAL)" logs/*.log

# Check trading activity
grep "TRADE" logs/trading.log | tail -20

# Monitor WebSocket issues
grep "WebSocket" logs/network.log

# Review exit strategy triggers
grep "EXIT" logs/trading.log
```

### **Emergency Contact Information**

**Critical Issues (Funds at Risk):**
- Stop bot immediately
- Secure wallet funds
- Document all evidence
- Contact support with full diagnostic report

---

## ⚡ **QUICK FIX CHECKLIST**

### **Bot Not Working - 5-Minute Checklist**
- [ ] Check RPC endpoint status
- [ ] Verify wallet balance > 0.01 SOL
- [ ] Confirm WebSocket connection active
- [ ] Check recent error logs
- [ ] Validate configuration syntax
- [ ] Test network connectivity
- [ ] Verify API keys haven't expired
- [ ] Check system memory usage
- [ ] Confirm database accessibility
- [ ] Review recent configuration changes

### **Performance Issues - Quick Fixes**
- [ ] Reduce concurrent operations
- [ ] Clear old log files
- [ ] Restart WebSocket connections
- [ ] Optimize configuration parameters
- [ ] Check system resources
- [ ] Update RPC endpoints
- [ ] Clean database cache
- [ ] Reduce analysis depth
- [ ] Enable performance mode
- [ ] Monitor memory leaks

---

**🚨 Remember: When in doubt, stop the bot and preserve capital. It's better to miss opportunities than lose funds to unresolved issues.**