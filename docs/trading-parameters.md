# 🎛️ SOL-BOT Trading Parameters Manual

**Complete Configuration Guide for masterConfig.ts**

---

## 📋 **TABLE OF CONTENTS**

1. [Basic Parameters (Start Here)](#basic-parameters-start-here)
2. [Pool & Position Management](#pool--position-management)
3. [Entry Criteria & Filters](#entry-criteria--filters)
4. [Exit Strategies & Risk Management](#exit-strategies--risk-management)
5. [Whale Tracking Configuration](#whale-tracking-configuration)
6. [Execution & Network Settings](#execution--network-settings)
7. [Performance & Optimization](#performance--optimization)
8. [Advanced Parameters](#advanced-parameters)
9. [Configuration Examples](#configuration-examples)
10. [Parameter Optimization Guide](#parameter-optimization-guide)

---

## 🚨 **CRITICAL SAFETY FIRST**

**Before changing ANY parameter:**
1. **Always backup your configuration**: `npm run backup-config`
2. **Start with test mode**: Set `testMode: true`
3. **Use small amounts initially**: Start with `initialPool: 100`
4. **Monitor closely**: Watch first 10 trades before increasing size

---

## 📊 **BASIC PARAMETERS (START HERE)**

### **Essential Settings Every User Must Configure**

```typescript
// Core Safety Settings
testMode: true,           // 🚨 ALWAYS start with true!
initialPool: 100,         // 💰 Start small ($100)
targetPool: 200,          // 🎯 Conservative 2x target
positionSize: 0.05,       // 📊 Small position (~$10)
stopLoss: -30,            // 🛑 30% maximum loss per trade
maxPositions: 5,          // 🔢 Limit concurrent trades
```

### **Parameter Explanations:**

#### **🔧 testMode: boolean**
**What it does:** Enables paper trading (no real money)
- `true`: Simulates trades, no real transactions
- `false`: Live trading with real money

**Recommended values:**
- **Beginners**: `true` for first 100 trades
- **Experienced**: `false` after testing strategy

**⚠️ WARNING:** Never set to `false` until you're profitable in test mode!

#### **💰 initialPool: number**  
**What it does:** Starting capital in USD for each trading session
- Bot starts each session with this amount
- When target reached, starts new session with fresh wallet

**Recommended values:**
- **Learning**: `50-100` (minimize losses while learning)
- **Conservative**: `500-1000` (stable growth)
- **Aggressive**: `2000+` (experienced traders only)

**Performance impact:** Higher pools = larger positions = higher profits/losses

**Real example:**
```typescript
initialPool: 1000,  // Start each session with $1000
targetPool: 10000,  // Try to reach $10,000 (10x target)
// If successful: Archive wallet, start new $1000 session
```

#### **🎯 targetPool: number**
**What it does:** Session completion goal - when reached, starts new session
- Automatic wallet rotation when achieved
- Resets to initialPool with new wallet

**Recommended values:**
- **Conservative**: 2-3x initialPool (`initialPool * 2`)
- **Moderate**: 5x initialPool (`initialPool * 5`)
- **Aggressive**: 10x initialPool (`initialPool * 10`)

**Performance impact:**
- Lower targets = more frequent wins = steady growth
- Higher targets = rare wins = feast or famine

---

## 💼 **POOL & POSITION MANAGEMENT**

### **Position Sizing - The Most Critical Setting**

```typescript
pool: {
  // Basic Settings
  initialPool: 1000,         // Starting capital per session
  targetPool: 10000,         // Session completion goal (10x)
  minPoolReserve: 5,         // Keep 5% as reserve (don't trade)
  maxPoolRisk: 80,           // Use max 80% of pool for trading
  compoundProfits: true,     // Reinvest profits into position size
  
  // Position Sizing (MOST IMPORTANT)
  positionSize: 0.2,         // SOL per trade (~$40 at $200/SOL)
  dynamicSizing: true,       // Adjust size based on pool growth
  minPositionSize: 0.05,     // Minimum SOL per trade (~$10)
  maxPositionSize: 0.5,      // Maximum SOL per trade (~$100)
  positionSizePercent: 5,    // Alternative: 5% of current pool
  
  // Risk Management
  maxPositions: 20,          // Maximum concurrent trades
  maxPerToken: 1,            // Maximum positions per token
  diversificationRequired: false, // Force different tokens
}
```

### **Parameter Deep-Dive:**

#### **📈 positionSize vs positionSizePercent**
**Two ways to size positions:**

**Fixed Size (`positionSize`):**
```typescript
positionSize: 0.2,  // Always trade 0.2 SOL (~$40)
dynamicSizing: false,
```
- **Pros**: Predictable losses, simple to understand
- **Cons**: Doesn't grow with profits
- **Best for**: Beginners, consistent strategies

**Percentage-Based (`positionSizePercent`):**
```typescript
positionSizePercent: 5,  // Always trade 5% of current pool
dynamicSizing: true,
```
- **Pros**: Grows with profits, compounds returns
- **Cons**: Losses get bigger as you grow
- **Best for**: Experienced traders, growth strategies

#### **🔢 maxPositions: number**
**What it does:** Limits concurrent trades to prevent overexposure

**Recommended values:**
- **Conservative**: `3-5` positions
- **Moderate**: `10-15` positions  
- **Aggressive**: `20-30` positions

**Performance impact:**
- **Too low**: Miss opportunities, slow growth
- **Too high**: Hard to monitor, risk concentration

**Real example:**
```typescript
// Conservative Setup
initialPool: 1000,
positionSize: 0.1,      // $20 per trade
maxPositions: 5,        // Max $100 at risk
// Risk: 10% of pool maximum

// Aggressive Setup  
initialPool: 1000,
positionSizePercent: 8,  // 8% per trade
maxPositions: 15,       // Could risk 120% of pool!
maxPoolRisk: 80,        // Limits total risk to 80%
```

#### **🛡️ minPoolReserve: number**
**What it does:** Percentage of pool to keep as cash reserve
- Never trades this portion
- Safety buffer for market downturns

**Recommended values:**
- **Aggressive**: `0-5%` (trade everything)
- **Moderate**: `10-15%` (balanced approach)
- **Conservative**: `20-25%` (safety first)

---

## 🎯 **ENTRY CRITERIA & FILTERS**

### **Token Selection Parameters**

```typescript
entry: {
  // Liquidity Requirements
  minLiquidity: 10000,       // Min $10k liquidity
  maxLiquidity: 500000,      // Max $500k liquidity
  
  // Market Cap Filters  
  minMarketCap: 50000,       // Min $50k market cap
  maxMarketCap: 1000000,     // Max $1M market cap
  
  // Community Size
  minHolders: 50,            // Min 50 holders
  maxHolders: 2000,          // Max 2000 holders
  
  // Token Age (minutes since creation)
  minAge: 5,                 // Min 5 minutes old
  maxAge: 1440,              // Max 24 hours old (1440 min)
  
  // Activity Requirements
  minVolume24h: 25000,       // Min $25k daily volume
  minTransactions: 100,      // Min 100 transactions
  
  // Price Action Filters
  minPriceChange: -20,       // Can buy dips up to -20%
  maxPriceChange: 100,       // Avoid tokens up >100%
  requiredMomentum: 40,      // Momentum score 0-100
  
  // Whale Activity
  minWhaleCount: 2,          // Min 2 whales holding
  minWhaleBuyVolume: 10000,  // Min $10k whale buying
  whaleEntrySignal: false,   // Don't require whale signal
  
  // Safety Checks (ALWAYS KEEP TRUE)
  honeypotCheck: true,       // Check for honeypot scams
  rugCheck: true,            // Check for rug pull signs
  blacklistCheck: true,      // Check blacklisted tokens
  maxSlippage: 10,           // Max 10% slippage allowed
}
```

### **Parameter Optimization:**

#### **💧 Liquidity Range (minLiquidity / maxLiquidity)**
**What it does:** Filters tokens by available liquidity

**Strategy-based recommendations:**

**Scalping Strategy:**
```typescript
minLiquidity: 5000,   // Lower minimum for more opportunities
maxLiquidity: 100000, // Lower maximum for higher volatility
```
- **Pros**: More volatile, faster moves
- **Cons**: Higher slippage, risky exits

**Swing Trading Strategy:**  
```typescript
minLiquidity: 25000,   // Higher minimum for stability
maxLiquidity: 1000000, // Higher maximum for safer exits
```
- **Pros**: Safer entries/exits, lower slippage
- **Cons**: Less volatile, slower moves

#### **🏠 Market Cap Range (minMarketCap / maxMarketCap)**
**What it does:** Filters by token valuation

**Risk/Reward profiles:**

**High Risk, High Reward:**
```typescript
minMarketCap: 10000,   // $10k minimum (very early)
maxMarketCap: 100000,  // $100k maximum (pre-pump)
```
- **Potential**: 10x-100x gains possible
- **Risk**: 90%+ of trades may fail

**Moderate Risk/Reward:**
```typescript
minMarketCap: 100000,  // $100k minimum (some traction)  
maxMarketCap: 1000000, // $1M maximum (established)
```
- **Potential**: 2x-10x gains possible
- **Risk**: 60-70% win rate achievable

#### **👥 Holder Count (minHolders / maxHolders)**
**What it does:** Community size indicator

**Optimization by strategy:**

**Early Entry (Risky):**
```typescript
minHolders: 10,    // Very early tokens
maxHolders: 200,   // Before mainstream adoption
```

**Established Entry (Safer):**
```typescript  
minHolders: 100,   // Some community built
maxHolders: 1000,  // Before too mainstream
```

#### **⏰ Token Age (minAge / maxAge)**
**What it does:** How long since token creation

**Strategy considerations:**

**Sniper Strategy (High Risk):**
```typescript
minAge: 0,     // Trade immediately at launch  
maxAge: 60,    // Within first hour only
```
- **Pros**: Catch earliest pumps
- **Cons**: Higher scam risk, technical issues

**Momentum Strategy (Balanced):**
```typescript
minAge: 30,    // Wait 30 minutes for stability
maxAge: 720,   // Within first 12 hours  
```
- **Pros**: Avoid immediate technical issues
- **Cons**: Miss some early opportunities

#### **📈 Price Action Filters**

**minPriceChange / maxPriceChange:**
**What they do:** Current price movement percentage

**Dip Buying Strategy:**
```typescript
minPriceChange: -30,  // Buy dips up to -30%
maxPriceChange: 10,   // Avoid pumped tokens
```

**Momentum Strategy:**
```typescript  
minPriceChange: 5,    // Only buy upward momentum
maxPriceChange: 50,   // But not too pumped
```

**Break-even Strategy:**
```typescript
minPriceChange: -10,  // Small dips okay
maxPriceChange: 20,   // Moderate pumps okay  
```

---

## 🚪 **EXIT STRATEGIES & RISK MANAGEMENT**

### **Stop Loss & Take Profit Configuration**

```typescript
exit: {
  // Basic Profit/Loss Levels
  stopLoss: -30,             // Stop loss at -30%
  takeProfit1: 50,           // First profit target at +50%
  takeProfit1Size: 30,       // Sell 30% of position at TP1
  takeProfit2: 150,          // Second profit target at +150%  
  takeProfit2Size: 40,       // Sell 40% at TP2 (70% total sold)
  takeProfit3: 300,          // Final target at +300%
  // Remaining 30% sold at TP3 or stop loss
  
  // Trailing Stops
  trailingStop: true,        // Enable trailing stop loss
  trailingStopActivation: 25, // Start trailing after +25% profit
  trailingStopDistance: 15,   // Trail 15% below peak
  
  // Time-Based Exits  
  maxHoldTime: 45,           // Max 45 minutes per trade
  minHoldTime: 2,            // Min 2 minutes (avoid panic)
  
  // Whale Activity Exits
  whaleSellPercentage: 30,   // Exit if 30% of whales sell
  whaleSellVolume: 15000,    // Exit if whales sell $15k+
  panicSellThreshold: 5,     // Exit if 5+ whales sell quickly
  
  // Market Condition Exits
  volumeDropExit: 60,        // Exit if volume drops 60%
  liquidityDropExit: 40,     // Exit if liquidity drops 40%
  
  // Advanced: Tiered Exit System
  tieredExit: {
    enabled: true,
    tiers: [
      { gain: 100, sell: 0.25 }, // Sell 25% at 2x (100% gain)
      { gain: 300, sell: 0.25 }, // Sell 25% at 4x (300% gain)  
      { gain: 500, sell: 0.25 }, // Sell 25% at 6x (500% gain)
    ],
    moonBag: {
      percentage: 0.25,        // Keep 25% as "moon bag"
      exitConditions: {
        megaMoonTarget: 2000,   // Sell moon bag at 20x
        timeDegradation: {
          enabled: true,
          after60min: 800,      // Sell at 8x after 1 hour
          after90min: 600,      // Sell at 6x after 1.5 hours
        }
      }
    }
  }
}
```

### **Exit Strategy Optimization:**

#### **🛑 Stop Loss Configuration**
**Most critical parameter for capital protection**

**Conservative (Recommended for beginners):**
```typescript
stopLoss: -20,  // Risk only 20% per trade
```
- **Max daily loss**: 5-10% of portfolio
- **Win rate needed**: 40% for profitability
- **Best for**: Learning, capital preservation

**Moderate (Balanced approach):**
```typescript
stopLoss: -30,  // Risk 30% per trade  
```
- **Max daily loss**: 10-15% of portfolio
- **Win rate needed**: 50% for profitability
- **Best for**: Most traders, balanced growth

**Aggressive (High risk/reward):**
```typescript
stopLoss: -50,  // Risk 50% per trade
```
- **Max daily loss**: 20%+ of portfolio
- **Win rate needed**: 60%+ for profitability
- **Best for**: Experienced traders only

#### **🎯 Take Profit Strategy**

**Quick Profit Strategy:**
```typescript
takeProfit1: 25,      // Take profits early and often
takeProfit1Size: 50,  // Sell half position quickly
takeProfit2: 50,      // Second target nearby
takeProfit2Size: 50,  // Sell remaining half
```
- **Pros**: High win rate, consistent profits
- **Cons**: Miss big runners, lower upside

**Swing Strategy:**
```typescript
takeProfit1: 100,     // Wait for substantial moves
takeProfit1Size: 30,  // Take partial profits  
takeProfit2: 300,     // Hold for bigger moves
takeProfit2Size: 40,  // Reduce risk gradually
takeProfit3: 1000,    // Moon shot target
```
- **Pros**: Catch big moves, higher upside
- **Cons**: Lower win rate, more volatility

#### **🏃‍♂️ Trailing Stop Configuration**
**Automatically moves stop loss up with profits**

**Conservative Trailing:**
```typescript
trailingStop: true,
trailingStopActivation: 15,  // Start trailing after +15%
trailingStopDistance: 10,    // Trail 10% below peak
```
- **Effect**: Locks in profits quickly
- **Risk**: May exit early on volatile moves

**Aggressive Trailing:**
```typescript
trailingStop: true, 
trailingStopActivation: 50,  // Wait for bigger move
trailingStopDistance: 25,    // Allow more volatility
```
- **Effect**: Rides trends longer
- **Risk**: May give back more profits

#### **⏰ Time-Based Exits**
**Prevents getting stuck in dead positions**

**Scalping Setup:**
```typescript
maxHoldTime: 15,     // Exit after 15 minutes max
minHoldTime: 1,      // Can exit immediately if needed
```

**Swing Setup:**
```typescript
maxHoldTime: 120,    // Hold up to 2 hours
minHoldTime: 5,      // Give trades time to work
```

### **🐋 Whale Activity Parameters**

#### **whaleSellPercentage: number**
**What it does:** Exit when X% of whale holders sell
- Detects when major holders are dumping
- Triggers emergency exit to avoid crash

**Configuration by market cap:**

**Small Cap Tokens (<$100k):**
```typescript
whaleSellPercentage: 20,  // Very sensitive to whale moves
```

**Mid Cap Tokens ($100k-$1M):**
```typescript 
whaleSellPercentage: 35,  // Less sensitive, more stable
```

#### **whaleSellVolume: number**
**What it does:** Exit when whales sell more than X USD
- Absolute dollar threshold for whale selling
- Complements percentage-based threshold

**Recommended values:**
- **Small positions**: `5000` ($5k whale selling triggers exit)
- **Large positions**: `25000` ($25k whale selling triggers exit)

---

## 🐋 **WHALE TRACKING CONFIGURATION**

### **Whale Detection & Following**

```typescript
whales: {
  // Whale Identification
  enabled: true,             // Enable whale tracking
  minWhaleBalance: 10000,    // Min $10k balance = whale
  whalePercentOfSupply: 1,   // Or 1%+ of token supply
  trackingInterval: 10000,   // Check every 10 seconds
  
  // Whale Signal Strength  
  buySignalStrength: 1.5,    // 1.5x weight for whale buys
  sellSignalStrength: 2.0,   // 2x weight for whale sells
  followWhales: false,       // Don't automatically copy whales
  inverseWhales: false,      // Don't trade against whales
  
  // Whale Alerts
  alertOnWhaleBuy: true,     // Alert when whale buys
  alertOnWhaleSell: true,    // Alert when whale sells  
  alertThreshold: 5000,      // Min $5k for whale alerts
  
  // Exit Trigger Configuration
  baseThreshold: 30,         // Base % of whales selling to exit
  volumeThreshold: 10000,    // Min $10k whale sell volume
  panicSellMultiplier: 1.5,  // 1.5x urgency in panic conditions
  confidenceRequirement: 0.7, // 70% confidence required
}
```

### **Whale Strategy Optimization:**

#### **👑 Whale Definition (minWhaleBalance)**
**What it does:** Minimum balance to be considered a whale

**Strategy considerations:**

**Small Cap Focus:**
```typescript
minWhaleBalance: 5000,   // $5k+ is whale (more sensitive)
```
- **Pros**: Detect smaller influencers
- **Cons**: More false signals from retail

**Large Cap Focus:**
```typescript  
minWhaleBalance: 50000,  // $50k+ is whale (less sensitive)  
```
- **Pros**: Only track major players
- **Cons**: Miss medium-sized influencers

#### **📊 Signal Strength Weighting**
**How much to trust whale activities**

**Whale Following Strategy:**
```typescript
buySignalStrength: 2.0,   // Strong buy signal from whales
sellSignalStrength: 1.5,  // Moderate sell signal weight
followWhales: true,       // Copy whale entries
```

**Whale Contrarian Strategy:**
```typescript
buySignalStrength: 0.5,   // Ignore whale buys  
sellSignalStrength: 3.0,  // Strong sell signal
inverseWhales: true,      // Trade opposite of whales
```

---

## ⚡ **EXECUTION & NETWORK SETTINGS**

### **Transaction Execution Parameters**

```typescript
execution: {
  // Transaction Fees & Speed
  priorityFee: 100000,       // 0.0001 SOL priority fee
  maxRetries: 3,             // Retry failed transactions 3x
  confirmationTimeout: 30000, // 30 second timeout
  simulateFirst: true,       // Test transaction first
  
  // Slippage Protection  
  slippageTolerance: 5,      // Max 5% slippage
  mevProtection: true,       // Enable MEV protection
  privateTransaction: false,  // Use public mempool
  
  // Order Types
  useMarketOrders: true,     // Use market orders
  useLimitOrders: false,     // Don't use limit orders  
  limitOrderOffset: 0.5,     // 0.5% limit order offset
  
  // Speed vs Cost Trade-off
  executionSpeed: 'fast',    // 'slow'|'normal'|'fast'|'ultra'
  maxGasPrice: 0.01,         // Max 0.01 SOL gas price
}
```

### **Network Configuration**

```typescript
network: {
  // RPC Endpoints (Order by preference)
  rpcEndpoints: [
    "https://api.mainnet-beta.solana.com",
    "https://solana-api.projectserum.com",
    // Add paid RPC endpoints for better performance
  ],
  
  // WebSocket Endpoints
  wsEndpoints: [
    "wss://api.mainnet-beta.solana.com",
  ],
  
  // RPC Management
  rpcRotation: true,         // Rotate between RPCs
  maxRpcRequests: 1000,      // Max requests per RPC
  rpcCooldown: 60000,        // 1 minute cooldown
  
  // Rate Limiting
  requestsPerSecond: 10,     // Max 10 requests/second
  batchRequests: true,       // Batch RPC requests  
  maxBatchSize: 10,          // Max 10 requests per batch
}
```

### **Performance Optimization:**

#### **🚀 priorityFee Configuration**
**What it does:** Extra fee paid for transaction priority

**Speed vs Cost trade-offs:**

**Economy Mode:**
```typescript
priorityFee: 10000,     // 0.00001 SOL (~$0.002)
executionSpeed: 'slow',
```
- **Pros**: Very low fees
- **Cons**: Slow execution, may miss opportunities

**Standard Mode:**
```typescript
priorityFee: 100000,    // 0.0001 SOL (~$0.02)
executionSpeed: 'normal',
```
- **Pros**: Good balance of speed and cost
- **Best for**: Most users

**High Performance Mode:**
```typescript
priorityFee: 1000000,   // 0.001 SOL (~$0.20)
executionSpeed: 'fast',
```
- **Pros**: Fast execution, higher success rate
- **Cons**: Higher fees reduce profits
- **Best for**: High-frequency trading

#### **🛡️ slippageTolerance Configuration**
**What it does:** Maximum price movement accepted during trade

**Market condition considerations:**

**Stable Market Conditions:**
```typescript
slippageTolerance: 2,   // Very tight slippage control
```
- **Pros**: Get expected prices
- **Cons**: More failed transactions

**Volatile Market Conditions:**
```typescript
slippageTolerance: 10,  // Allow more slippage
```
- **Pros**: Higher transaction success rate
- **Cons**: Worse entry/exit prices

---

## 📈 **PERFORMANCE & OPTIMIZATION**

### **Performance Targets & Risk Limits**

```typescript
performance: {
  // Win Rate Targets
  targetWinRate: 60,         // Aim for 60% win rate
  minAcceptableWinRate: 45,  // Stop if below 45%
  
  // Profit Targets
  dailyProfitTarget: 10,     // 10% daily profit goal
  weeklyProfitTarget: 50,    // 50% weekly profit goal  
  stopOnDailyTarget: false,  // Keep trading after daily goal
  
  // Risk Management (CRITICAL)
  maxDailyLoss: 20,          // Max 20% daily loss when profitable
  maxInitialPoolLoss: 50,    // Max 50% loss when below initial
  maxWeeklyLoss: 30,         // Max 30% weekly loss
  maxConsecutiveLosses: 10,  // Stop after 10 losses in a row
  
  // Advanced Risk Management
  dynamicLossLimits: {
    enabled: true,
    breakEvenProtection: true, // Tighten stops when break-even
    tiers: [
      { poolLevel: 90, maxLoss: 40 },  // 40% max loss when down 10%
      { poolLevel: 100, maxLoss: 15 }, // 15% max loss when break-even
      { poolLevel: 110, maxLoss: 10 }, // 10% max loss when up 10%
      { poolLevel: 150, maxLoss: 8 },  // 8% max loss when up 50%
    ]
  },
  
  // Trading Modes
  aggressiveMode: false,     // Enable aggressive trading
  profitProtectionLevel: 50, // Protect 50% of profits
  
  // Auto-Optimization  
  autoOptimize: false,       // Don't auto-change settings
  optimizationInterval: 24,  // Check every 24 hours
  backtestBeforeApply: true, // Test changes first
}
```

### **Risk Management Deep-Dive:**

#### **🎯 Win Rate Targets**
**Critical for strategy evaluation**

**Performance benchmarks by strategy:**

**Scalping Strategy:**
```typescript
targetWinRate: 70,        // High win rate expected
minAcceptableWinRate: 60, // Stop if below 60%
```
- **Logic**: Many small wins, few big losses
- **Risk**: Strategy breaks if win rate drops

**Swing Strategy:**
```typescript  
targetWinRate: 50,        // Moderate win rate acceptable
minAcceptableWinRate: 35, // More tolerance for losses
```
- **Logic**: Fewer wins but bigger when they hit
- **Flexibility**: Can handle losing streaks

#### **💰 Daily/Weekly Targets**

**Conservative Approach:**
```typescript
dailyProfitTarget: 5,     // 5% daily target
weeklyProfitTarget: 25,   // 25% weekly target
stopOnDailyTarget: true,  // Stop when goal reached
```
- **Philosophy**: Consistent small gains compound
- **Risk**: May miss big opportunities

**Growth Approach:**
```typescript
dailyProfitTarget: 15,    // 15% daily target  
weeklyProfitTarget: 75,   // 75% weekly target
stopOnDailyTarget: false, // Keep going for more
```
- **Philosophy**: Maximize profitable periods
- **Risk**: Give back gains on bad days

#### **🚫 Loss Limits (MOST IMPORTANT)**

**maxDailyLoss vs maxInitialPoolLoss:**

**Learning Phase Configuration:**
```typescript
maxDailyLoss: 30,         // Allow 30% loss when profitable
maxInitialPoolLoss: 80,   // Allow 80% loss when learning
maxConsecutiveLosses: 20, // Allow long learning streaks
```
- **Logic**: Learning requires accepting losses
- **Protection**: Still prevents total wipeout

**Production Phase Configuration:**
```typescript
maxDailyLoss: 10,         // Strict 10% daily limit
maxInitialPoolLoss: 25,   // Never lose more than 25%
maxConsecutiveLosses: 5,  // Stop after 5 losses
```
- **Logic**: Protect capital once profitable
- **Goal**: Preserve gains, minimize drawdowns

#### **📊 Dynamic Loss Limits**
**Adjusts risk based on current profit/loss**

**How it works:**
```typescript
// When pool = $900 (90% of initial $1000):
{ poolLevel: 90, maxLoss: 40 }  // Can lose 40% more ($360)

// When pool = $1000 (break-even):  
{ poolLevel: 100, maxLoss: 15 } // Can only lose 15% more ($150)

// When pool = $1500 (50% profit):
{ poolLevel: 150, maxLoss: 8 }  // Can only lose 8% more ($120)
```

**Benefits:**
- **Protects profits**: Tighter stops when winning
- **Allows learning**: Looser stops when losing
- **Prevents blowups**: Never risk more than you can afford

---

## 🔧 **ADVANCED PARAMETERS**

### **Machine Learning & Social Signals**

```typescript
advanced: {
  // AI/ML Features (Experimental)
  useML: false,              // Enable ML predictions
  mlConfidenceThreshold: 75, // Min 75% ML confidence to trade
  
  // Arbitrage Detection
  arbitrageEnabled: false,   // Look for arbitrage opportunities
  minArbProfit: 2,          // Min 2% arbitrage profit
  
  // Market Making (Advanced)
  marketMakingEnabled: false, // Provide liquidity
  spreadTarget: 1,           // Target 1% spread
  
  // Social Sentiment (Experimental)
  twitterTracking: false,    // Track Twitter mentions
  discordTracking: false,    // Track Discord activity  
  socialScoreWeight: 0.1,    // 10% weight for social signals
}
```

### **Filter Configuration**

```typescript
filters: {
  // Token Filtering
  blacklistedTokens: [
    "TokenAddressHere123...",  // Known scam tokens
  ],
  whitelistedTokens: [
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  ],
  
  // DEX Filtering  
  blacklistedDexes: [
    "ScamDEX",               // Avoid certain DEXes
  ],
  preferredDexes: [
    "Raydium",               // Prefer major DEXes
    "Orca",
  ],
  
  // Developer Filtering
  blacklistedDevs: [
    "KnownScammerAddress...", // Known bad actors
  ],
  trustedDevs: [
    "TrustedDevAddress...",   // Known good developers
  ],
}
```

---

## 📋 **CONFIGURATION EXAMPLES**

### **🎯 Beginner Configuration**
**Safe learning setup with minimal risk**

```typescript
{
  // Safety First
  testMode: true,            // Paper trading only
  initialPool: 100,          // Small learning amount
  targetPool: 150,           // Conservative 50% target
  
  // Conservative Position Sizing
  positionSize: 0.02,        // Very small positions (~$4)
  maxPositions: 3,           // Limited concurrent trades
  
  // Strict Risk Management
  stopLoss: -15,             // Tight stop loss
  takeProfit1: 25,           // Quick profit taking
  takeProfit1Size: 75,       // Sell most position quickly
  
  // Conservative Entry Criteria
  minLiquidity: 50000,       // Only liquid tokens
  maxMarketCap: 500000,      // Avoid too early/risky
  minHolders: 100,           // Established community
  
  // Tight Risk Limits
  maxDailyLoss: 10,          // Max 10% daily loss
  maxConsecutiveLosses: 3,   // Stop after 3 losses
  
  // Simple Whale Settings  
  whaleSellPercentage: 20,   // Very sensitive to whale moves
}
```

### **⚖️ Moderate Configuration**  
**Balanced risk/reward for experienced beginners**

```typescript
{
  // Balanced Approach
  testMode: false,           // Live trading (after testing)
  initialPool: 500,          // Moderate amount
  targetPool: 2500,          // 5x target
  
  // Dynamic Position Sizing
  positionSizePercent: 4,    // 4% per trade
  dynamicSizing: true,       // Compound profits
  maxPositions: 8,           // Moderate diversification
  
  // Balanced Risk/Reward
  stopLoss: -25,             // Moderate stop loss
  takeProfit1: 50,           // 50% first target
  takeProfit1Size: 40,       // Partial profit taking
  takeProfit2: 150,          // 150% second target
  
  // Moderate Entry Criteria
  minLiquidity: 20000,       // Reasonable liquidity
  maxMarketCap: 2000000,     // Broader market cap range
  minAge: 10,                // Avoid brand new tokens
  
  // Balanced Risk Management
  maxDailyLoss: 15,          // 15% max daily loss
  maxConsecutiveLosses: 6,   // Allow some streaks
  
  // Whale Settings
  whaleSellPercentage: 30,   // Moderate whale sensitivity
}
```

### **🚀 Aggressive Configuration**
**High risk/reward for experienced traders**

```typescript
{
  // Aggressive Growth  
  testMode: false,           // Live trading
  initialPool: 2000,         // Larger amount
  targetPool: 20000,         // 10x target
  
  // Aggressive Position Sizing
  positionSizePercent: 8,    // 8% per trade
  maxPoolRisk: 90,           // Use 90% of pool
  maxPositions: 15,          // High diversification
  
  // High Risk/Reward
  stopLoss: -40,             // Wide stop loss
  takeProfit1: 100,          // Higher profit targets
  takeProfit1Size: 25,       // Small partial profit
  takeProfit2: 300,          // Much higher second target
  takeProfit3: 1000,         // Moon shot target
  
  // Aggressive Entry Criteria
  minLiquidity: 10000,       // Lower liquidity for volatility
  maxAge: 30,                // Focus on very new tokens
  minPriceChange: -10,       // Buy dips
  maxPriceChange: 100,       // Ride momentum
  
  // Higher Risk Tolerance
  maxDailyLoss: 25,          // Allow bigger losses
  maxConsecutiveLosses: 10,  // Longer losing streaks
  
  // Aggressive Whale Settings
  whaleSellPercentage: 40,   // Less sensitive to whales
}
```

---

## 🎯 **PARAMETER OPTIMIZATION GUIDE**

### **📊 Performance Metrics to Track**

**Key Performance Indicators (KPIs):**
1. **Win Rate**: % of profitable trades
2. **Average Win**: Average profit per winning trade  
3. **Average Loss**: Average loss per losing trade
4. **Profit Factor**: (Total Wins) / (Total Losses)
5. **Maximum Drawdown**: Largest peak-to-trough loss
6. **Sharpe Ratio**: Risk-adjusted returns

### **🔄 Optimization Process**

**Step 1: Baseline Testing**
1. Run bot for 100 trades with default settings
2. Record all performance metrics
3. Identify biggest loss drivers
4. Identify biggest profit drivers

**Step 2: Single Parameter Testing**  
1. Change ONE parameter at a time
2. Test for 50 trades minimum
3. Compare to baseline performance
4. Keep changes that improve metrics

**Step 3: Strategy Cohesion**
1. Ensure parameters work together logically
2. Test complete configuration for 100+ trades
3. Validate improved performance vs baseline

**Example Optimization Sequence:**
```typescript
// Week 1: Test stop loss levels
stopLoss: -20 → Test 50 trades → Record metrics
stopLoss: -25 → Test 50 trades → Compare
stopLoss: -30 → Test 50 trades → Choose best

// Week 2: Test position sizing  
positionSize: 0.1 → Test 50 trades
positionSize: 0.15 → Test 50 trades  
positionSize: 0.2 → Test 50 trades

// Week 3: Test take profit levels
takeProfit1: 30 → Test
takeProfit1: 50 → Test
takeProfit1: 75 → Test

// Week 4: Test combined best settings
// Validate improved performance
```

### **⚠️ Common Optimization Mistakes**

**🚫 Don't Do This:**
1. **Over-optimization**: Changing too many parameters at once
2. **Insufficient testing**: Less than 50 trades per test
3. **Curve fitting**: Optimizing for past results only
4. **Ignoring drawdowns**: Focusing only on profits
5. **Parameter conflicts**: Settings that contradict each other

**✅ Do This Instead:**
1. **One change at a time**: Isolate parameter effects
2. **Adequate sample size**: 50-100 trades minimum  
3. **Forward testing**: Test on new market conditions
4. **Risk-adjusted metrics**: Consider drawdowns and volatility
5. **Logical consistency**: Ensure parameters align with strategy

### **📈 Parameter Relationships**

**Correlated Parameters (change together):**
- `stopLoss` ↔ `takeProfit`: Wider stops need higher targets
- `positionSize` ↔ `maxPositions`: Larger size needs fewer positions
- `minLiquidity` ↔ `slippageTolerance`: Lower liquidity needs higher slippage
- `maxHoldTime` ↔ `takeProfit`: Longer holds need higher targets

**Example Coherent Strategy:**
```typescript
// Scalping Strategy - All parameters aligned
{
  stopLoss: -15,           // Tight stops
  takeProfit1: 25,         // Quick profits  
  maxHoldTime: 10,         // Short holds
  positionSize: 0.1,       // Smaller size for frequency
  maxPositions: 20,        // Many concurrent trades
  slippageTolerance: 8,    // Higher slippage for speed
  executionSpeed: 'fast',  // Fast execution priority
}

// Swing Strategy - All parameters aligned  
{
  stopLoss: -35,           // Wide stops
  takeProfit1: 100,        // Bigger targets
  maxHoldTime: 120,        // Longer holds  
  positionSize: 0.3,       // Larger size per trade
  maxPositions: 8,         // Fewer concurrent trades
  slippageTolerance: 5,    // Tighter slippage acceptable
  executionSpeed: 'normal', // Speed less critical
}
```

---

## 🎭 **TRADING STYLE CONFIGURATIONS**

### **⚡ Day Trading / Scalping**
**Quick in-and-out trades, high frequency**

```typescript
// Optimized for speed and volume
runtime: { duration: 14400 },    // 4 hours max
pool: {
  positionSize: 0.08,             // Smaller positions
  maxPositions: 25,               // Many concurrent
},
exit: {
  stopLoss: -12,                  // Tight stops
  takeProfit1: 20,                // Quick profits
  takeProfit1Size: 80,            // Sell most quickly
  maxHoldTime: 8,                 // Very short holds
},
entry: {
  minLiquidity: 100000,           // Need good liquidity
  maxAge: 120,                    // Focus on active tokens
},
execution: {
  priorityFee: 200000,            // Pay for speed
  executionSpeed: 'ultra',        // Maximum speed
}
```

### **📈 Swing Trading**
**Medium-term holds, ride trends**

```typescript
// Optimized for trend following
runtime: { duration: 0 },        // Run continuously  
pool: {
  positionSize: 0.25,             // Larger positions
  maxPositions: 12,               // Focused portfolio
},
exit: {
  stopLoss: -25,                  // Allow volatility
  takeProfit1: 75,                // Higher targets
  takeProfit1Size: 30,            // Partial profits
  takeProfit2: 200,               // Let winners run
  maxHoldTime: 180,               // 3 hour holds
  trailingStop: true,             // Trail profits
},
entry: {
  requiredMomentum: 60,           // Strong momentum only
  minVolume24h: 50000,            // Active tokens
},
```

### **🎯 Value/Dip Buying**
**Buy undervalued tokens on dips**

```typescript
// Optimized for buying weakness
entry: {
  minPriceChange: -40,            // Buy big dips
  maxPriceChange: -5,             // Only dips, no pumps
  minLiquidity: 75000,            // Need good liquidity
  rsiOversold: 25,                // Very oversold
  useRSI: true,
},
exit: {
  stopLoss: -30,                  // Room for volatility  
  takeProfit1: 50,                // Reasonable rebound
  takeProfit1Size: 50,            // Half position
  takeProfit2: 150,               // Full recovery
  maxHoldTime: 240,               // Longer patience
},
performance: {
  targetWinRate: 70,              // High win rate strategy
  maxConsecutiveLosses: 4,        // Should work consistently
}
```

### **🌙 Moon Shot Hunting**  
**High risk/reward, looking for 10x+ moves**

```typescript
// Optimized for explosive growth
entry: {
  minMarketCap: 5000,             // Very early tokens
  maxMarketCap: 50000,            // Before discovery
  minAge: 0,                      // Launch sniping
  maxAge: 60,                     // First hour only
  minHolders: 10,                 // Very early
  maxHolders: 200,                // Before mainstream
},
exit: {
  stopLoss: -60,                  // Wide stops for volatility
  takeProfit1: 200,               // 3x first target
  takeProfit1Size: 20,            // Small profit taking
  takeProfit2: 500,               // 6x second target  
  takeProfit2Size: 30,            // More profit taking
  takeProfit3: 2000,              // 20x moon target
  // Keep 50% for potential 50x+
  maxHoldTime: 480,               // 8 hours patience
},
performance: {
  targetWinRate: 30,              // Low win rate acceptable
  maxConsecutiveLosses: 20,       // Long losing streaks expected
  maxDailyLoss: 50,               // High risk tolerance
}
```

---

## 🚨 **CRITICAL SAFETY REMINDERS**

### **⛔ Never Change These Without Understanding:**
1. **testMode**: Always test first!
2. **stopLoss**: Your main capital protection
3. **maxDailyLoss**: Prevents account blowups
4. **maxInitialPoolLoss**: Final safety net
5. **honeypotCheck/rugCheck**: Scam protection

### **📊 Always Monitor These Metrics:**
1. **Win rate**: Should match your strategy expectations
2. **Average loss size**: Should be close to your stop loss
3. **Maximum drawdown**: Largest losing streak
4. **Daily P&L**: Track daily performance trends
5. **Position size**: Ensure risk management working

### **🔄 Regular Optimization Schedule:**
- **Daily**: Check key metrics, adjust if major issues
- **Weekly**: Review parameter performance, small adjustments
- **Monthly**: Comprehensive strategy review and optimization
- **Quarterly**: Major strategy changes if needed

---

**📝 Remember: The best configuration is the one you understand completely and can execute consistently. Start simple, learn from results, and optimize gradually based on data, not emotions.**