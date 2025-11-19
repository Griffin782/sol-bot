# SOL-BOT v5.0 Project Memory

## 🚨 CRITICAL CONTEXT
@RECENT_CHATS_CONTEXT.md

## 🧑‍💻 USER PROFILE
- **Skill Level**: Novice coder with good concepts
- **Needs**: Exact file locations, line numbers, "find this/replace with" format
- **Environment**: Windows PowerShell, VS Code
- **Current Crisis**: -99.8% ROI due to config import failures

## 🚨 CRITICAL CONTEXT
@RECENT_CHATS_CONTEXT.md

## 🧑‍💻 USER PROFILE
- **Skill Level**: Novice coder with good concepts
- **Needs**: Exact file locations, line numbers, "find this/replace with" format
- **Environment**: Windows PowerShell, VS Code
- **Current Crisis**: -99.8% ROI due to config import failures

## 🔴 CRITICAL ARCHITECTURE TRUTH (Updated 2025-11-05)

**SOL-BOT IS NOW 100% ON-CHAIN OPERATION:**

### **System Architecture:**
```
✅ Token Detection → gRPC (Yellowstone/Triton) on-chain stream
✅ Price Monitoring → gRPC transaction parsing (<400ms real-time)
✅ Position Tracking → gRPC real-time subscriptions
✅ Trade Execution → PumpSwap SDK (direct on-chain transactions)
⚠️ Fallback Only → Jupiter API (if PumpSwap fails)
✅ SOL Price → CoinGecko API (1 call at startup)
```

### **What Each System Does:**

| System | Purpose | Usage | File Location |
|--------|---------|-------|---------------|
| **gRPC** | Token detection, price monitoring, tracking | Continuous | `src/index.ts`, `src/monitoring/positionMonitor.ts` |
| **PumpSwap SDK** | Trade execution (buy/sell) PRIMARY | Per trade | `src/utils/handlers/pumpswapHandler.ts` |
| **Jupiter API** | Trade execution FALLBACK ONLY | If PumpSwap fails | `src/utils/handlers/jupiterHandler.ts` |
| **CoinGecko** | SOL/USD price | 1 call at startup | `src/botController.ts` |

### **NEVER Assume:**
- ❌ "Bot uses Jupiter API for price monitoring" (WRONG - uses gRPC)
- ❌ "Bot uses Jupiter API for trade execution" (WRONG - uses PumpSwap SDK)
- ❌ "Jupiter API is primary system" (WRONG - it's fallback only)

### **Complete Architecture Document:**
See: `11.05-Sol-Bot-uses-gRPC-for-all-ONCHAIN_ACTIVITY.md`

---

## 📁 PROJECT STRUCTURE

sol-bot-main/
├── src/
│   ├── index.ts                 # Main controller (imports from CONFIG-BRIDGE → UNIFIED-CONTROL)
│   ├── config.ts                # Config (provider: "pumpswap" for on-chain trading)
│   ├── core/                    # Core configuration system
│   │   ├── UNIFIED-CONTROL.ts   # 🚨 PRIMARY CONFIG - SINGLE SOURCE OF TRUTH!
│   │   ├── CONFIG-BRIDGE.ts     # Backward compatibility layer
│   │   └── PARTIAL-EXIT-SYSTEM.ts # Exit tier logic
│   ├── monitoring/              # Real-time monitoring
│   │   └── positionMonitor.ts   # gRPC price monitoring (<400ms)
│   ├── trading/                 # Trade execution
│   │   └── sellExecutor.ts      # PumpSwap SDK with Jupiter fallback
│   ├── utils/handlers/          # Handler functions
│   │   ├── pumpswapHandler.ts   # PRIMARY: On-chain direct swaps
│   │   └── jupiterHandler.ts    # FALLBACK: API-based swaps
│   ├── enhanced/
│   │   ├── masterConfig.ts      # ❌ DEPRECATED - Throws error pointing to UNIFIED-CONTROL
│   │   ├── token-queue-system.ts # Pool manager
│   │   ├── automated-reporter.ts # WhaleWatcher (secondary exit system)
│   │   └── performanceLogger.ts # 5x+ tracking
│   ├── z-new-controls/          # ❌ ARCHIVED (moved to ARCHIVED-BACKUPS folder)
│   ├── tax-compliance/          # Tax reporting
│   ├── wallets/                 # Wallet management
├── data/                        # Output CSV files
└── .env                         # Environment variables

# User is novice coder - needs exact file locations and line numbers
# Always use "find this/replace with" format for code changes

## ⚙️ CONFIGURATION SYSTEM (Updated Oct 30, 2025)

**Current Architecture:**
- ✅ **UNIFIED-CONTROL.ts** - Single source of truth (16 imports, 191 function calls verified)
- ✅ **CONFIG-BRIDGE.ts** - Backward compatibility layer (exports from UNIFIED-CONTROL)
- ❌ **z-masterConfig.ts** - DEPRECATED/DEAD CODE (0 imports, kept for reference only)
- ❌ **masterConfig.ts** - DEPRECATED (throws error pointing to UNIFIED-CONTROL)

**How to Change Settings:**
1. Edit `src/core/UNIFIED-CONTROL.ts` only (Line 272 for trading mode)
2. All components automatically read from UNIFIED-CONTROL
3. No need to edit multiple config files
4. No hardcoded overrides (verified Oct 30, 2025)

**Historical Issues (RESOLVED):**
- ❌ OLD: Config import failures caused -99.8% ROI
- ❌ OLD: Hardcoded values overrode configs
- ❌ OLD: 462 duplicate tokens due to broken protection
- ✅ NOW: UNIFIED-CONTROL working correctly, all issues fixed

## 📊 EXIT SYSTEM REFERENCE (Added 2025-10-27)

**For future gRPC migration:** See `EXIT-SYSTEM-ANALYSIS.md`

### Quick Context Tags:
- `EXIT-SYSTEM-TIMER-ANALYSIS` - Complete timer-based exit analysis
- `TIERED-EXIT-REFERENCE` - Tier system explanation (2x, 4x, 6x, 20x)
- `AUG-25-SESSION-SUCCESS` - Why August 25 test session worked
- `GRPC-MIGRATION-PREP` - Prerequisites for VIP2 gRPC integration

### Key Finding:
August 25 session (83.7% win rate, 2,430 trades) succeeded because:
1. **Quality token selection** (filtered 7,473 → 2,430)
2. **Tokens rose steadily** over 10-30 minutes (not flash pumps)
3. **Timer checks caught them** at scheduled intervals
4. **Tiered exits (2x/4x/6x)** gave multiple opportunities

### Critical for Migration:
- Current timer system WORKS (don't break it)
- gRPC should COMPLEMENT (not replace) timers
- Partial exits may not be implemented (verify first)
- Success was entry criteria, not exit timing
- Keep scheduled checks as safety fallback

**Read full analysis before migrating gRPC from VIP2!**
- 🔍 COMPREHENSIVE BOT SYSTEM AUDIT - Find ALL Bugs at Once

**Copy-paste to Claude Code:**

---

## 🎯 MISSION

Analyze the ENTIRE sol-bot system and find EVERY bug, issue, and problem.

Don't fix anything yet. Just find EVERYTHING wrong.

This is NOT whack-a-mole. This is comprehensive analysis.

---

## 📋 SYSTEMATIC AUDIT CHECKLIST

### **Phase 1: Trade Execution Path (CRITICAL)**

Trace COMPLETE flow from detection to buy:

1. **Token Detection:**
   - WebSocket receives token → ✅/❌
   - Token parsed correctly → ✅/❌
   - Mint address extracted → ✅/❌

2. **Safety Checks:**
   - Safety function called → ✅/❌
   - Checks actually execute → ✅/❌
   - Blocks scams correctly → ✅/❌
   - Can be bypassed → ✅/❌

3. **Rate Limiting:**
   - Counter increments when → ❓ (before or after trade?)
   - Counts what exactly → ❓ (detections, attempts, or completed trades?)
   - Test mode affects counter → ✅/❌
   - Resets properly → ✅/❌

4. **Buy Decision:**
   - Scoring function runs → ✅/❌
   - Score compared to threshold → ✅/❌
   - Buy approved if score high enough → ✅/❌
   - Test mode vs live mode logic → ✅/❌

5. **Trade Execution:**
   - swapToken() called → ✅/❌
   - Jupiter API hit → ✅/❌
   - Transaction submitted → ✅/❌
   - Success/failure returned → ✅/❌
   - Counter updated AFTER success → ✅/❌

6. **Position Tracking:**
   - Token added to positions → ✅/❌
   - Database updated → ✅/❌
   - Pool balance adjusted → ✅/❌

---

### **Phase 2: Configuration System**

Check ALL config files and their relationships:

1. **Config Files:**
   ```
   /mnt/project/config.ts
   /mnt/project/z-masterConfig.ts
   /mnt/project/masterConfig09_15_25.ts
   /mnt/project/enhanced/masterConfig.ts
   /mnt/project/CONFIG-BRIDGE.ts
   /mnt/project/UNIFIED-CONTROL.ts
   ```

2. **For EACH setting, document:**
   - Position size: [values from each file]
   - Min score: [values from each file]
   - Max trades: [values from each file]
   - Test mode: [values from each file]
   - Which file wins? [final value used]

3. **Conflicts:**
   - List EVERY setting with multiple values
   - Show which value actual[Pasted text #1 +180 lines]