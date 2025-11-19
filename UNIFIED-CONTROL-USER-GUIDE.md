# 📘 UNIFIED-CONTROL.ts - Complete User Guide

**For Novice Coders**: This guide explains every setting you can change in `src/core/UNIFIED-CONTROL.ts` and what each change does to your bot's behavior.

**Last Updated**: October 28, 2025

---

## 🎯 WHAT IS UNIFIED-CONTROL.ts?

### **The Simple Answer**:
This is your bot's **master control panel**. It's the ONLY file that controls all bot settings. Think of it like a car's dashboard - everything you need to adjust is here.

### **Why It Exists**:
Your project used to have **5 different config files** that fought with each other:
- `z-masterConfig.ts` (your settings)
- `config.ts` (bot's default settings)
- `botController.ts` (session settings)
- `.env` (environment variables)
- `secure-pool-system.ts` (pool management)

**The Problem**: You'd set position size to $0.20 in one file, but bot would use $20 from another file (100x bigger!). This caused massive losses.

**The Solution**: UNIFIED-CONTROL.ts **replaced all of them**. Now there's only ONE place to change settings.

---

## 🚨 IMPORTANT: OLD FILES NO LONGER USED

**You can ignore these files** (they don't control the bot anymore):
- ❌ `z-masterConfig.ts` - Historical record only
- ❌ `config.ts` - No longer loaded
- ❌ `botController.ts` - Replaced by UNIFIED-CONTROL
- ❌ `.env` TEST_MODE - Now controlled here

**Only this file matters**: ✅ `src/core/UNIFIED-CONTROL.ts`

---

## 🎮 QUICK START: THE 3 MOST IMPORTANT SETTINGS

### **1. Trading Mode (Line 272)**
**Location**: `currentMode: TradingMode.PAPER`

**What It Does**: Controls whether bot uses real money or paper trading

**Your Options**:
```typescript
// Line 272 - Change this one line:

currentMode: TradingMode.PAPER          // Safe testing - NO real trades
currentMode: TradingMode.MICRO          // Tiny real trades ($0.15 per trade)
currentMode: TradingMode.CONSERVATIVE   // Your intended size ($0.20 per trade)
currentMode: TradingMode.LIVE           // Synonym for CONSERVATIVE
currentMode: TradingMode.PRODUCTION     // Large trades ($15 per trade)
```

**Impact**:
- PAPER: Zero risk, tests logic only
- MICRO: Learn with pennies ($0.15 trades)
- CONSERVATIVE: Your original plan ($0.20 trades)
- PRODUCTION: Large real trades ($15 trades)

**Recommendation**: Start with PAPER, then MICRO, then CONSERVATIVE

---

### **2. Position Size (Lines 279-280)**
**Location**: Inside `pool:` section

**What It Does**: How much money bot spends per trade

```typescript
// Lines 279-280
positionSizeSOL: 0.06865,   // Amount in SOL
positionSizeUSD: 15,        // Amount in USD (~$15)
```

**⚠️ WARNING**: These are overridden by your Trading Mode (line 272)
- If you set PAPER mode → uses PAPER preset ($15)
- If you set MICRO mode → uses MICRO preset ($0.15)
- If you set CONSERVATIVE → uses CONSERVATIVE preset ($0.20)

**How to Change Safely**:

**Option A: Use a preset mode (easiest)**
```typescript
// Line 272
currentMode: TradingMode.MICRO  // Automatically sets $0.15 per trade
```

**Option B: Edit the preset itself (advanced)**
```typescript
// Lines 38-47 - Edit MICRO preset directly
MICRO: {
  positionSizeSOL: 0.0006866,
  positionSizeUSD: 0.15,        // CHANGE THIS to your desired amount
  maxTrades: 50,
  duration: 300,
  useRealMoney: true,
  simulation: false,
  riskLevel: 'very_low',
  description: 'Micro trades with real SOL'
}
```

**Impact**:
- Larger = More profit potential, more loss potential
- Smaller = Safer, slower growth
- Rule of thumb: Never risk more than 5% of your wallet per trade

---

### **3. Trade Limits (Lines 289-290)**
**Location**: Inside `limits:` section

**What It Does**: Maximum number of trades before bot auto-stops

```typescript
// Lines 289-290
maxTradesPerSession: 50,   // Stops after 50 trades in one session
maxTradesAbsolute: 100,    // Hard limit across ALL sessions
```

**Impact**:
- Prevents runaway trading
- Safety mechanism to stop losses
- Bot will FORCE SHUTDOWN when limit reached

**How to Change**:
```typescript
// Conservative (fewer trades)
maxTradesPerSession: 20,
maxTradesAbsolute: 50,

// Moderate (your current setting)
maxTradesPerSession: 50,
maxTradesAbsolute: 100,

// Aggressive (more trades)
maxTradesPerSession: 100,
maxTradesAbsolute: 200,
```

**⚠️ Warning**: Higher limits = more opportunities BUT also more risk of losses piling up

---

## 📋 ALL AVAILABLE SETTINGS (MASTER_SETTINGS Section)

### **🏦 POOL MANAGEMENT (Lines 275-285)**

Controls your trading capital and position sizing:

```typescript
pool: {
  initialPool: 60,              // LINE 276: Starting wallet ($600)
  currentPool: 60,              // LINE 277: Current balance (updates during trading)
  targetPoolUSD: 100000,        // LINE 278: Your goal ($100,000)
  positionSizeSOL: 0.06865,     // LINE 279: Trade size in SOL
  positionSizeUSD: 15,          // LINE 280: Trade size in USD
  maxPositions: 20,             // LINE 281: Max open trades at once
  compoundProfits: true,        // LINE 282: Reinvest profits? (true/false)
  minPoolReserve: 10,           // LINE 283: Keep $10 minimum in wallet
  maxPoolRisk: 15               // LINE 284: Max 15% of pool at risk
}
```

**What Each Setting Does**:

| Setting | What It Means | Example Change | Impact |
|---------|--------------|----------------|---------|
| **initialPool** | Starting money | Change 60 to 100 | Bot thinks you have $1000 to trade |
| **targetPoolUSD** | Your goal | Change 100000 to 10000 | Bot optimizes for $10k instead of $100k |
| **positionSizeSOL** | Trade size (SOL) | Change 0.06865 to 0.01 | Smaller trades = safer |
| **positionSizeUSD** | Trade size (USD) | Change 15 to 5 | $5 per trade instead of $15 |
| **maxPositions** | Open trades limit | Change 20 to 10 | Can only hold 10 tokens at once |
| **compoundProfits** | Reinvest wins? | Change true to false | Profits sit idle instead of reinvesting |
| **minPoolReserve** | Safety buffer | Change 10 to 50 | Always keeps $50 untouched |
| **maxPoolRisk** | Risk percentage | Change 15 to 5 | Only risk 5% of wallet at once |

**Recommendation for Beginners**:
- Keep `initialPool` accurate to your real wallet
- Start with `positionSizeUSD` at 1-2% of wallet
- Set `maxPositions` to 5-10 to avoid overexposure
- Keep `compoundProfits` true for growth
- Set `minPoolReserve` to cover fees

---

### **⚠️ TRADING LIMITS (Lines 288-297)**

Safety mechanisms to prevent disasters:

```typescript
limits: {
  maxTradesPerSession: 50,      // LINE 289: Stop after 50 trades this session
  maxTradesAbsolute: 100,       // LINE 290: Hard limit (never exceed)
  maxLossUSD: 100,              // LINE 291: Stop if lose $100
  duration: 0,                  // LINE 292: Session time limit (0=unlimited)
  rateLimitDelay: 5000,         // LINE 293: Wait 5 seconds between trades
  pauseBetweenScans: 100,       // LINE 294: 100ms between token scans
  checkInterval: 30000,         // LINE 295: Check positions every 30 seconds
  heartbeatInterval: 60000      // LINE 296: Status update every 60 seconds
}
```

**What Each Setting Does**:

| Setting | What It Means | Example Change | Impact |
|---------|--------------|----------------|---------|
| **maxTradesPerSession** | Trades per run | Change 50 to 20 | Bot stops after 20 trades |
| **maxTradesAbsolute** | Total hard limit | Change 100 to 50 | Safety - never exceed 50 total |
| **maxLossUSD** | Maximum loss | Change 100 to 50 | Stop if lose $50 |
| **duration** | Time limit (min) | Change 0 to 60 | Stop after 60 minutes |
| **rateLimitDelay** | Trade cooldown | Change 5000 to 10000 | Wait 10 sec between trades |
| **pauseBetweenScans** | Scan speed | Change 100 to 500 | Slower scanning = less CPU |
| **checkInterval** | Monitor frequency | Change 30000 to 10000 | Check positions every 10 sec |
| **heartbeatInterval** | Status updates | Change 60000 to 30000 | Status every 30 seconds |

**Recommendation for Beginners**:
- Keep `maxTradesPerSession` at 20-30 for controlled testing
- Set `maxLossUSD` to amount you're comfortable losing
- Use `duration` to limit session time (60-120 minutes)
- Keep `rateLimitDelay` at 5000ms to avoid API bans

---

### **🎯 ENTRY CRITERIA (Lines 300-314)**

Controls WHAT tokens bot will buy:

```typescript
entry: {
  honeypotCheck: true,          // LINE 301: Check if token is scam?
  rugCheck: true,               // LINE 302: Check if dev can steal funds?
  minLiquidity: 10000,          // LINE 303: Require $10k liquidity minimum
  maxLiquidity: 10000000,       // LINE 304: Skip if > $10M liquidity (too big)
  minMarketCap: 0,              // LINE 305: No minimum market cap
  maxMarketCap: 5000000,        // LINE 306: Skip if > $5M market cap
  minHolders: 100,              // LINE 307: Require at least 100 holders
  maxHolders: 10000,            // LINE 308: Skip if > 10k holders (too popular)
  minVolume24h: 50000,          // LINE 309: Require $50k daily volume
  maxAge: 30,                   // LINE 310: Only tokens < 30 minutes old
  blacklistEnabled: true,       // LINE 311: Use scam blacklist?
  qualityFilterEnabled: true,   // LINE 312: Filter out low-quality tokens?
  strictMode: true              // LINE 313: Be very picky?
}
```

**What Each Setting Does**:

| Setting | What It Means | Example Change | Impact |
|---------|--------------|----------------|---------|
| **honeypotCheck** | Scam detection | Change true to false | ⚠️ DANGEROUS - allows scams! |
| **rugCheck** | Rug pull detection | Change true to false | ⚠️ DANGEROUS - dev can steal! |
| **minLiquidity** | Min pool size | Change 10000 to 50000 | Only buy tokens with $50k+ liquidity |
| **maxLiquidity** | Max pool size | Change 10000000 to 100000 | Skip "too big" tokens |
| **minMarketCap** | Min token value | Change 0 to 100000 | Only buy tokens worth $100k+ |
| **maxMarketCap** | Max token value | Change 5000000 to 1000000 | Skip tokens over $1M |
| **minHolders** | Min owners | Change 100 to 250 | Require more holders = safer |
| **maxHolders** | Max owners | Change 10000 to 5000 | Skip very popular tokens |
| **minVolume24h** | Daily trading | Change 50000 to 100000 | Require $100k volume = more liquid |
| **maxAge** | Token age (min) | Change 30 to 10 | Only brand new tokens |
| **blacklistEnabled** | Use scam list? | Change true to false | ⚠️ Allows known scams! |
| **qualityFilterEnabled** | Quality filter? | Change true to false | ⚠️ Allows garbage tokens! |
| **strictMode** | Be picky? | Change true to false | Buys more tokens (riskier) |

**⚠️ CRITICAL SAFETY SETTINGS** (Never disable these):
- `honeypotCheck: true` ← ALWAYS keep true
- `rugCheck: true` ← ALWAYS keep true
- `blacklistEnabled: true` ← ALWAYS keep true
- `qualityFilterEnabled: true` ← ALWAYS keep true

**Recommendation for Beginners**:
- Keep ALL safety checks enabled
- Increase `minLiquidity` to 50000+ for safer tokens
- Increase `minHolders` to 250+ for more proven tokens
- Lower `maxAge` to 10-15 for very fresh tokens
- Keep `strictMode: true` - being picky is GOOD

---

### **🚪 EXIT STRATEGY (Lines 316-326)**

Controls WHEN bot sells your tokens:

```typescript
exit: {
  stopLoss: -80,                      // LINE 318: Sell if lose 80%
  takeProfit: 100,                    // LINE 319: Sell if gain 100% (2x)
  trailingStop: false,                // LINE 320: Use trailing stop?
  trailingStopTrigger: 50,            // LINE 321: Activate at 50% profit
  trailingStopDistance: 20,           // LINE 322: Trail 20% below peak
  moonbagPercent: 25,                 // LINE 323: Keep 25% forever
  takeProfitLevels: [100, 300, 500],  // LINE 324: Sell at 2x, 4x, 6x
  takeProfitPercents: [25, 25, 25]    // LINE 325: Sell 25% at each level
}
```

**⚠️ NOTE**: These settings are OVERRIDDEN by the new Partial Exit System (PARTIAL-EXIT-SYSTEM.ts) which uses:
- Tier 1: 25% at 2x gain
- Tier 2: 25% at 4x gain
- Tier 3: 25% at 6x gain
- Tier 4: 25% moonbag (never sells)

**What Each Setting Does**:

| Setting | What It Means | Example Change | Impact |
|---------|--------------|----------------|---------|
| **stopLoss** | Cut losses at | Change -80 to -50 | Sell when down 50% instead of 80% |
| **takeProfit** | Take profit at | Change 100 to 50 | Sell at 1.5x instead of 2x |
| **trailingStop** | Use trailing stop? | Change false to true | Lock in profits automatically |
| **trailingStopTrigger** | When to activate | Change 50 to 25 | Start trailing at 1.25x instead of 1.5x |
| **trailingStopDistance** | Trail distance | Change 20 to 10 | Tighter stop (10% below peak) |
| **moonbagPercent** | % to never sell | Change 25 to 50 | Keep 50% forever |
| **takeProfitLevels** | Profit targets | Change to [50,100,200] | Sell at 1.5x, 2x, 3x |
| **takeProfitPercents** | % to sell | Change to [50,25,25] | Sell 50% at first level |

**Recommendation for Beginners**:
- Set `stopLoss` to -50 or -60 (don't let losses get huge)
- Use the default Partial Exit System (it's already configured)
- Keep `moonbagPercent` at 25 for "lottery ticket" potential
- Don't change `takeProfitLevels` unless you understand tiered exits

---

### **⚙️ EXECUTION SETTINGS (Lines 329-336)**

Technical settings for how trades execute:

```typescript
execution: {
  slippageTolerance: 5,           // LINE 330: Allow 5% price slippage
  priorityFee: 1000000000,        // LINE 331: Priority fee in lamports
  priorityFeeSOL: 0.001,          // LINE 332: Priority fee in SOL (0.001 SOL)
  maxRetries: 3,                  // LINE 333: Retry failed trades 3 times
  retryDelay: 2000,               // LINE 334: Wait 2 seconds between retries
  confirmationTimeout: 30000      // LINE 335: Wait 30 seconds for confirmation
}
```

**What Each Setting Does**:

| Setting | What It Means | Example Change | Impact |
|---------|--------------|----------------|---------|
| **slippageTolerance** | Price movement % | Change 5 to 10 | Allow 10% price change during trade |
| **priorityFee** | Speed fee (lamports) | Change to 2000000000 | Pay more for faster trades |
| **priorityFeeSOL** | Speed fee (SOL) | Change to 0.002 | Pay 0.002 SOL for speed |
| **maxRetries** | Retry attempts | Change 3 to 5 | Try 5 times if trade fails |
| **retryDelay** | Wait between retries | Change 2000 to 5000 | Wait 5 seconds between tries |
| **confirmationTimeout** | Max wait time | Change 30000 to 60000 | Wait 60 seconds for confirm |

**Recommendation for Beginners**:
- Keep `slippageTolerance` at 5-10% (low slippage = fewer failed trades)
- Don't change priority fees unless trades are failing
- Keep `maxRetries` at 3 (more retries = more chances but slower)

---

### **🎨 QUALITY FILTER (Lines 342-351)**

Filters out scam/garbage tokens:

```typescript
qualityFilter: {
  enabled: true,                  // LINE 343: Enable quality filter?
  minQualityScore: 65,            // LINE 344: Require score of 65+ out of 100
  blockWords: [...],              // LINE 345: Reject tokens with these words
  maxTokenAge: 60,                // LINE 346: Skip tokens > 60 minutes old
  minTokenAge: 2,                 // LINE 347: Skip tokens < 2 minutes old
  requireLiquidity: true,         // LINE 348: Must have liquidity?
  requireHolders: true,           // LINE 349: Must have holders?
  requireVolume: true             // LINE 350: Must have volume?
}
```

**What Each Setting Does**:

| Setting | What It Means | Example Change | Impact |
|---------|--------------|----------------|---------|
| **enabled** | Turn filter on/off | Change true to false | ⚠️ Allows all tokens (dangerous!) |
| **minQualityScore** | Minimum score | Change 65 to 75 | More picky = fewer but better tokens |
| **blockWords** | Banned words | Add 'rocket' | Skip tokens with "rocket" in name |
| **maxTokenAge** | Max age (min) | Change 60 to 30 | Only tokens < 30 min old |
| **minTokenAge** | Min age (min) | Change 2 to 5 | Skip very new tokens (< 5 min) |
| **requireLiquidity** | Must have liquidity | Change true to false | ⚠️ Allows illiquid tokens |
| **requireHolders** | Must have holders | Change true to false | ⚠️ Allows tokens with no holders |
| **requireVolume** | Must have volume | Change true to false | ⚠️ Allows dead tokens |

**Blocked Words (Line 345)**:
```typescript
blockWords: ['pump', 'inu', 'moon', 'safe', 'elon', 'doge', 'shib', 'baby', 'mini', 'floki']
```

**Add Your Own Blocked Words**:
```typescript
blockWords: ['pump', 'inu', 'moon', 'safe', 'elon', 'doge', 'shib', 'baby', 'mini', 'floki',
             'rocket', 'mars', 'lambo', 'pepe', 'wojak']  // Added 5 more
```

**Recommendation for Beginners**:
- Keep `enabled: true` - ALWAYS use the filter
- Set `minQualityScore` to 70-75 for better quality
- Add any scam keywords you notice to `blockWords`
- Keep all `require*` settings as `true`

---

## 🔄 TRADING MODE PRESETS (Lines 27-68)

**What Are Presets?**
Pre-configured settings for different trading styles. When you change `currentMode` on line 272, it automatically loads one of these presets.

### **PAPER Mode (Lines 28-37)** - Testing Only
```typescript
PAPER: {
  positionSizeSOL: 0.06865,     // $15 per trade (paper money)
  positionSizeUSD: 15,
  maxTrades: 50,                // Stop after 50 trades
  duration: 0,                  // No time limit
  useRealMoney: false,          // PAPER TRADING ONLY
  simulation: true,
  riskLevel: 'minimal',
  description: 'Paper trading with microscopic test amounts'
}
```

**When to Use**: Testing new strategies, learning how bot works
**Risk**: Zero (no real money)
**Profit Potential**: Zero (not real)

---

### **MICRO Mode (Lines 38-47)** - Learning with Pennies
```typescript
MICRO: {
  positionSizeSOL: 0.0006866,   // $0.15 per trade
  positionSizeUSD: 0.15,
  maxTrades: 50,
  duration: 300,                // 5 hours max
  useRealMoney: true,           // REAL TRADES
  simulation: false,
  riskLevel: 'very_low',
  description: 'Micro trades with real SOL - learning mode'
}
```

**When to Use**: First real trades, testing with tiny amounts
**Risk**: Very Low ($0.15 per trade = max $7.50 loss if 50 trades fail)
**Profit Potential**: Low but real

**How to Customize**:
```typescript
// Change line 40 to adjust trade size
positionSizeUSD: 0.30,  // Double the trade size to $0.30
```

---

### **CONSERVATIVE Mode (Lines 48-57)** - Your Original Plan
```typescript
CONSERVATIVE: {
  positionSizeSOL: 0.0009,      // $0.20 per trade
  positionSizeUSD: 0.2,
  maxTrades: 0,                 // Unlimited (but see line 290)
  duration: 300,                // 5 minutes max
  useRealMoney: true,
  simulation: false,
  riskLevel: 'low',
  description: 'Conservative trading with your intended position size'
}
```

**When to Use**: After successful MICRO testing, ready for real growth
**Risk**: Low ($0.20 per trade)
**Profit Potential**: Moderate

**How to Customize**:
```typescript
// Change line 50 to adjust trade size
positionSizeUSD: 0.50,  // Increase to $0.50 per trade

// Change line 51 to set trade limit
maxTrades: 100,         // Set max 100 trades instead of unlimited
```

---

### **PRODUCTION Mode (Lines 58-67)** - Large Scale
```typescript
PRODUCTION: {
  positionSizeSOL: 0.06866,     // $15 per trade
  positionSizeUSD: 15,
  maxTrades: 0,                 // Unlimited
  duration: 0,                  // No time limit
  useRealMoney: true,
  simulation: false,
  riskLevel: 'moderate',
  description: 'Full production trading with larger positions'
}
```

**When to Use**: After proven success with CONSERVATIVE, ready to scale
**Risk**: Moderate-High ($15 per trade = significant money)
**Profit Potential**: High

**⚠️ WARNING**: Don't use PRODUCTION mode until you have:
- Successfully run 50+ trades in CONSERVATIVE mode
- Achieved consistent profitability (60%+ win rate)
- Enough capital to support $15 trades comfortably

---

## 📈 SESSION PROGRESSION (Lines 91-188)

**What Is This?**
A strategic plan to grow your money from $600 → $100,000 across 4 sessions.

**How It Works**:
1. **Session 1** ($600 → $7,000): Foundation building, learn patterns
2. **Session 2** ($7,000 → $20,000): Growth phase, scale up
3. **Session 3** ($20,000 → $50,000): Expansion with proven strategy
4. **Session 4** ($50,000 → $100,000): Final push to your goal

**Can You Change This?**
Yes, but it's auto-calculated based on your target. To change your goal:

```typescript
// Line 339 - Change the target value
sessions: calculateSessionProgression(100000),  // Change 100000 to your goal

// Examples:
sessions: calculateSessionProgression(10000),   // $10k goal
sessions: calculateSessionProgression(50000),   // $50k goal
sessions: calculateSessionProgression(250000),  // $250k goal
```

**Impact**: Entire session progression recalculates automatically

**Recommendation**: Keep the default $100k goal until you understand the system

---

## 🛡️ SAFETY SYSTEMS

### **Configuration Enforcer (Lines 402-613)**

**What It Does**:
Acts like a security guard - logs ALL config access and BLOCKS unauthorized changes.

**Why It Matters**:
Prevents other parts of bot code from overriding your settings without permission.

**You Don't Need to Change This** - It's automatic protection

**What It Logs**:
- Every time a setting is read
- Every attempt to change a setting
- Who requested the change
- Whether change was allowed or blocked

**View Logs**:
Bot prints these automatically:
```
📋 [CONFIG-ENFORCER] pool.positionSizeSOL = 0.0009 (by: getPositionSizeSOL)
🚨 [CONFIG-ENFORCER] UNAUTHORIZED OVERRIDE ATTEMPT BLOCKED!
```

---

### **Configuration Validator (Lines 619-658)**

**What It Does**:
Checks your settings for mistakes before bot starts.

**Validates**:
- Position size not too large for your pool
- Stop loss is negative (not positive!)
- Safety checks are enabled
- Trade limits are reasonable

**You Don't Need to Change This** - Automatic validation

**What It Shows**:
```
✅ [UNIFIED-CONTROL] Startup validation passed
⚠️ [UNIFIED-CONTROL] Configuration warnings:
   - Large position size: 0.5 SOL
❌ [UNIFIED-CONTROL] Configuration validation failed:
   - Position size too large: 50 > 10% of 60
```

---

## 🎯 HOW TO MAKE COMMON CHANGES

### **Change 1: Switch from Paper to Real Trading**

```typescript
// Line 272 - Change this:
currentMode: TradingMode.PAPER

// To this:
currentMode: TradingMode.MICRO  // Start with tiny real trades
```

**That's it!** Bot automatically sets position size to $0.15 per trade.

---

### **Change 2: Increase Position Size**

```typescript
// Option A: Switch to larger preset
// Line 272
currentMode: TradingMode.CONSERVATIVE  // $0.20 per trade

// Option B: Edit the preset directly
// Lines 48-57
CONSERVATIVE: {
  positionSizeSOL: 0.0009,
  positionSizeUSD: 0.5,  // Change from 0.2 to 0.5
  // ... rest stays same
}
```

---

### **Change 3: Make Bot More Selective**

```typescript
// Make quality filter stricter
// Line 344
minQualityScore: 75,  // Change from 65 to 75 (fewer but better tokens)

// Require more liquidity
// Line 303
minLiquidity: 50000,  // Change from 10000 to 50000 ($50k minimum)

// Require more holders
// Line 307
minHolders: 250,  // Change from 100 to 250 (more proven tokens)
```

---

### **Change 4: Reduce Risk**

```typescript
// Tighter stop loss
// Line 318
stopLoss: -50,  // Change from -80 to -50 (sell at -50% instead of -80%)

// Lower position size
// Line 49-50 (in CONSERVATIVE preset)
positionSizeSOL: 0.0004,
positionSizeUSD: 0.10,  // Reduce to $0.10 per trade

// Fewer trades
// Line 289
maxTradesPerSession: 20,  // Change from 50 to 20
```

---

### **Change 5: Add Time Limit**

```typescript
// Run for maximum 1 hour
// Line 292
duration: 60,  // Change from 0 to 60 (60 minutes)

// Run for maximum 30 minutes
duration: 30,  // 30 minutes
```

---

### **Change 6: Block Specific Scam Keywords**

```typescript
// Line 345 - Add more words to block
blockWords: [
  'pump', 'inu', 'moon', 'safe', 'elon', 'doge', 'shib', 'baby', 'mini', 'floki',
  // ADD YOUR OWN HERE:
  'rocket', 'mars', 'lambo', 'pepe', 'wojak', 'cum', 'pussy', 'tits'
]
```

---

## 📊 UNDERSTANDING THE CONFLICT SECTION (Lines 190-259)

### **What It Is**:
Historical documentation showing conflicts that existed in your OLD config files.

### **Is z-masterConfig.ts Still Used?**
**NO!** z-masterConfig.ts is NO LONGER read by the bot.

**Why It's Listed**:
The conflict section is a **historical record** showing:
1. What conflicting values existed across different files
2. How those conflicts were resolved
3. Why UNIFIED-CONTROL was created

**Think of it like**: A crime scene report from when your config was a mess. It documents what was broken, not what's currently active.

### **Current State**:
- ✅ **UNIFIED-CONTROL.ts** = Active (bot reads this)
- ❌ **z-masterConfig.ts** = Inactive (historical reference only)
- ❌ **config.ts** = Inactive
- ❌ **botController.ts** = Inactive

**You Can Safely Ignore Lines 190-259** - They're documentation, not active code.

---

## ⚠️ CRITICAL SAFETY RULES

### **Never Disable These**:
```typescript
// ALWAYS keep these as true:
honeypotCheck: true,              // Line 301
rugCheck: true,                   // Line 302
blacklistEnabled: true,           // Line 311
qualityFilterEnabled: true,       // Line 312
requireSafetyChecks: true,        // Line 394
```

**Why**: These protect you from scams, honeypots, and rug pulls

### **Never Set These Too High**:
```typescript
// Don't go crazy with position sizes
positionSizeUSD: 0.2,  // ✅ Safe for $600 wallet
positionSizeUSD: 50,   // ❌ DANGEROUS for $600 wallet (8% per trade!)
```

**Rule of Thumb**: Position size should be 1-3% of your total wallet

### **Never Set Stop Loss Positive**:
```typescript
stopLoss: -50,   // ✅ Correct (negative = loss)
stopLoss: 50,    // ❌ WRONG (would never trigger!)
```

---

## 🚀 RECOMMENDED BEGINNER SETTINGS

Copy these exact settings for safe starting configuration:

```typescript
// Line 272
currentMode: TradingMode.MICRO  // Start small!

// Lines 289-290
maxTradesPerSession: 20,
maxTradesAbsolute: 50,

// Line 292
duration: 60,  // 1 hour max

// Line 303
minLiquidity: 50000,  // $50k minimum liquidity

// Line 307
minHolders: 250,  // At least 250 holders

// Line 318
stopLoss: -50,  // Cut losses at -50%

// Line 344
minQualityScore: 70,  // Be picky
```

---

## 📝 QUICK REFERENCE CHECKLIST

**Before Each Trading Session**:
- [ ] Line 272: Trading mode set correctly (PAPER/MICRO/CONSERVATIVE)?
- [ ] Lines 279-280: Position size appropriate for my wallet?
- [ ] Line 289: Trade limit set to safe amount?
- [ ] Line 292: Time limit set (or 0 for unlimited)?
- [ ] Lines 301-302: Safety checks enabled (honeypot/rug)?
- [ ] Line 318: Stop loss set to reasonable level?

**After Each Trading Session**:
- [ ] Review performance (npm run post-check)
- [ ] Update settings based on results
- [ ] Document what worked / didn't work

---

## 🆘 TROUBLESHOOTING

### **Bot Using Wrong Position Size**:
**Check**: Line 272 (currentMode)
**Fix**: Make sure preset on lines 28-67 has your desired size

### **Bot Not Stopping at Trade Limit**:
**Check**: Lines 289-290 (maxTrades)
**Fix**: Ensure both limits are set correctly

### **Bot Buying Too Many Scams**:
**Check**: Lines 301-313 (entry criteria) and 342-351 (quality filter)
**Fix**: Increase minQualityScore, add more blockWords, enable all safety checks

### **Bot Not Finding Any Tokens**:
**Check**: Lines 303-310 (entry criteria too strict)
**Fix**: Lower minLiquidity, lower minHolders, increase maxAge

---

## 📚 NEXT STEPS

1. **Read this guide completely**
2. **Make small changes one at a time**
3. **Test in PAPER mode first**
4. **Graduate to MICRO mode with real money**
5. **Keep detailed notes on what settings work**
6. **Only move to CONSERVATIVE after proven success**

---

**Remember**: This is your bot's MASTER control panel. Every setting here directly impacts your money. When in doubt, start conservative and adjust slowly!

**Questions?** Read `PROJECT-STATUS.md` and `SYSTEMATIC-COMPLETION-STATUS.md` for current project state.

---

**Last Updated**: October 28, 2025
**File Location**: `src/core/UNIFIED-CONTROL.ts`
**Your Current Mode**: Check line 272 in UNIFIED-CONTROL.ts
