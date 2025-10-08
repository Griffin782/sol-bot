# 🔄 SOL-BOT Complete Workflow Documentation

**Understanding Every Step from Startup to Shutdown**

---

## 📋 **TABLE OF CONTENTS**

1. [System Overview](#system-overview)
2. [Initialization Sequence](#initialization-sequence)
3. [Token Detection Pipeline](#token-detection-pipeline)
4. [Trading Decision Engine](#trading-decision-engine)
5. [Position Management Lifecycle](#position-management-lifecycle)
6. [Exit Strategy Execution](#exit-strategy-execution)
7. [Session Completion & Wallet Rotation](#session-completion--wallet-rotation)
8. [File System Integration](#file-system-integration)
9. [Error Handling & Recovery](#error-handling--recovery)
10. [Manual Override Procedures](#manual-override-procedures)

---

## 🔎 **SYSTEM OVERVIEW**

### **Core Architecture Components**

```
┌─────────────────────────────────────────────────────────────┐
│                    SOL-BOT SYSTEM                           │
├─────────────────────────────────────────────────────────────┤
│  🎛️  Master Config (masterConfig.ts)                       │
│  🔗  Integration Manager (integrationManager.ts)            │
│  💼  Session Manager (sessionManager.ts)                    │
│  🔄  Wallet Rotator (walletRotator.ts)                     │
│  🛡️  Security Manager (securityManager.ts)                │
│  💾  Backup Manager (backupManager.ts)                     │
├─────────────────────────────────────────────────────────────┤
│  📊  Token Queue System (token-queue-system.ts)            │
│  🐋  Whale Watcher (automated-reporter.ts)                 │
│  📈  Advanced Features (advanced-features.ts)              │
│  🔍  Token Analyzer (tokenAnalyzer.ts)                     │
├─────────────────────────────────────────────────────────────┤
│  🌐  Network Layer (websocketManager.ts, grpcManager.ts)   │
│  💱  DEX Handlers (jupiterHandler.ts, sniperooHandler.ts)  │
│  🔐  Security Layer (Multi-factor, IP filtering)           │
│  📝  Logging & Data (logManager.ts, Tax tracking)          │
└─────────────────────────────────────────────────────────────┘
```

### **Data Flow Overview**

```
Market Data → Token Detection → Analysis → Decision → Execution → Monitoring → Exit
     ↓             ↓              ↓          ↓           ↓            ↓         ↓
WebSocket/     Queue System   Token       Trading    Jupiter/     Position   Whale
GRPC Feed   → Filters →     Analyzer →   Logic →   Sniperoo →  Tracker → Watcher
                                                                           ↓
Tax Records ← Session Data ← Wallet Data ← Performance Data ← Exit Data ←
```

---

## 🚀 **INITIALIZATION SEQUENCE**

### **Step 1: System Startup** (`src/index.ts`)

```typescript
// File: src/index.ts (Lines 1-50)
console.log('🚀 SOL-BOT Starting...');

// 1. Load and validate configuration
import { masterConfig } from './enhanced/masterConfig';
validateConfig(masterConfig); // Ensures all required settings present

// 2. Initialize security system first (CRITICAL)
import { securityManager } from './security/securityManager';
securityManager.initialize();

// 3. Check security clearance
const securityStatus = securityManager.checkSystemSecurity();
if (!securityStatus.allowed) {
    console.log('🚨 SECURITY LOCKDOWN - Trading halted');
    process.exit(1);
}
```

**What happens here:**
- 🔍 **Config validation**: Checks all parameters are valid
- 🛡️ **Security initialization**: Multi-factor security system starts
- 🔐 **IP verification**: Confirms authorized IP address
- 📊 **System health check**: Verifies all components ready

### **Step 2: Network Initialization** (`src/utils/managers/websocketManager.ts`)

```typescript
// File: src/utils/managers/websocketManager.ts (Lines 20-80)
class WebSocketManager {
    async initialize() {
        console.log('🌐 Initializing network connections...');
        
        // 1. Connect to primary RPC
        await this.connectRPC(masterConfig.network.rpcEndpoints[0]);
        
        // 2. Establish WebSocket feeds  
        await this.connectWebSocket(masterConfig.network.wsEndpoints[0]);
        
        // 3. Test GRPC connection
        await this.testGRPCConnection();
        
        // 4. Start heartbeat monitoring
        this.startHeartbeat();
    }
}
```

**Network startup sequence:**
1. **RPC Connection**: Primary endpoint connection (`https://api.mainnet-beta.solana.com`)
2. **WebSocket Feed**: Real-time price/transaction feed
3. **GRPC Setup**: High-speed data streaming (if configured)  
4. **Heartbeat Start**: Network health monitoring every 30 seconds

### **Step 3: Session & Wallet Initialization** (`src/utils/managers/integrationManager.ts`)

```typescript
// File: src/utils/managers/integrationManager.ts (Lines 50-120)
export class IntegrationManager {
    public startTradingSession(initialBalance: number = 1000): string {
        console.log('🎮 Initializing trading session...');
        
        // 1. Create pre-session backup
        const backupId = this.backupManager.backupCriticalFiles('Pre-session backup');
        
        // 2. Start new trading session
        const session = this.sessionManager.startNewSession(initialBalance);
        
        // 3. Get wallet from rotation pool
        const wallet = this.walletRotator.getNextWallet();
        
        // 4. Update environment variables
        process.env.PRIVATE_KEY = wallet.privateKey;
        
        // 5. Initialize tax tracking for session
        this.advancedManager?.initializeSession(session.sessionId);
        
        return wallet.privateKey;
    }
}
```

**Session initialization steps:**
1. **Backup Creation**: `backup-critical_2025-08-27T10-30-00`
2. **Session Start**: `session_1` with $1000 initial balance
3. **Wallet Assignment**: `6pKgx6fP...GC9K` from rotation pool
4. **Environment Update**: `PRIVATE_KEY` set for trading
5. **Tax Tracking**: Automatic transaction recording enabled

### **Step 4: Trading Systems Activation**

```typescript
// File: src/enhanced/token-queue-system.ts (Lines 100-150)
class TokenQueueSystem {
    async initialize() {
        console.log('📊 Starting token detection systems...');
        
        // 1. Initialize token filters
        this.setupTokenFilters(masterConfig.entry);
        
        // 2. Start market data feeds
        this.startMarketDataStream();
        
        // 3. Begin token scanning
        this.startTokenScanning();
        
        // 4. Activate whale monitoring
        this.whaleWatcher.startWhaleMonitoring();
        
        console.log('✅ All trading systems online');
    }
}
```

**Complete initialization output:**
```
🚀 SOL-BOT Starting...
✅ Configuration loaded and validated
🛡️ Security system initialized
🔐 IP address verified: 67.184.226.84 (whitelisted)
🌐 Network connections established
🎮 Trading session started: session_1
💼 Wallet assigned: 6pKgx6fP...GC9K
📊 Token detection systems online
🐋 Whale monitoring activated
✅ SOL-BOT fully operational
```

---

## 🔍 **TOKEN DETECTION PIPELINE**

### **Stage 1: Market Data Ingestion** (`src/utils/managers/grpcManager.ts`)

```typescript
// File: src/utils/managers/grpcManager.ts (Lines 50-100)
export class GrpcManager {
    private processTokenUpdate(update: SubscribeUpdate) {
        // 1. Extract token information
        const tokenMint = this.extractTokenMint(update);
        const priceData = this.extractPriceData(update);
        const liquidityData = this.extractLiquidityData(update);
        
        // 2. Initial filtering
        if (this.passesBasicFilters(tokenMint, priceData)) {
            // 3. Queue for detailed analysis
            this.tokenQueue.addToken({
                mint: tokenMint,
                price: priceData,
                liquidity: liquidityData,
                timestamp: new Date(),
                source: 'GRPC_FEED'
            });
        }
    }
}
```

**Data sources monitored:**
- 🔄 **GRPC Streams**: New token launches, price changes
- 🌐 **WebSocket Feeds**: Real-time DEX transactions
- 🐋 **Whale Tracking**: Large holder movements
- 📈 **Price Feeds**: Jupiter aggregator price data

### **Stage 2: Basic Filtering** (`src/enhanced/token-queue-system.ts`)

```typescript
// File: src/enhanced/token-queue-system.ts (Lines 200-300)
class TokenQueueSystem {
    private passesBasicFilters(tokenData: TokenData): boolean {
        const config = masterConfig.entry;
        
        // 1. Liquidity check
        if (tokenData.liquidity < config.minLiquidity) {
            this.logRejection(tokenData.mint, 'LIQUIDITY_TOO_LOW', tokenData.liquidity);
            return false;
        }
        
        if (tokenData.liquidity > config.maxLiquidity) {
            this.logRejection(tokenData.mint, 'LIQUIDITY_TOO_HIGH', tokenData.liquidity);
            return false;
        }
        
        // 2. Market cap check
        if (tokenData.marketCap < config.minMarketCap) {
            this.logRejection(tokenData.mint, 'MARKET_CAP_TOO_LOW', tokenData.marketCap);
            return false;
        }
        
        // 3. Age check
        const tokenAge = this.calculateTokenAge(tokenData.mint);
        if (tokenAge < config.minAge || tokenAge > config.maxAge) {
            this.logRejection(tokenData.mint, 'AGE_OUT_OF_RANGE', tokenAge);
            return false;
        }
        
        // 4. Blacklist check
        if (this.isBlacklisted(tokenData.mint)) {
            this.logRejection(tokenData.mint, 'BLACKLISTED', 'Security filter');
            return false;
        }
        
        return true;
    }
}
```

**Filtering stages:**
1. **Liquidity Range**: `$10k - $500k` (configurable)
2. **Market Cap Range**: `$50k - $1M` (configurable)
3. **Token Age**: `5 min - 24 hours` (configurable)
4. **Blacklist Check**: Known scam/rug tokens filtered
5. **Holder Count**: `50 - 2000` holders required

**Example filter results:**
```
🔍 Scanning token: EPjFWdd5...
❌ REJECTED: LIQUIDITY_TOO_HIGH ($2,450,000 > $500,000)

🔍 Scanning token: 7xKXtg2...  
❌ REJECTED: AGE_OUT_OF_RANGE (2 minutes < 5 minutes)

🔍 Scanning token: 9WzDXwr...
✅ PASSED basic filters → Queued for analysis
```

### **Stage 3: Detailed Token Analysis** (`src/enhanced/tokenAnalyzer.ts`)

```typescript
// File: src/enhanced/tokenAnalyzer.ts (Lines 100-200)
export class TokenAnalyzer {
    async analyzeToken(tokenMint: string): Promise<TokenAnalysis> {
        console.log(`🔬 Analyzing token: ${tokenMint.slice(0, 8)}...`);
        
        // 1. Fetch comprehensive data
        const tokenData = await this.fetchTokenData(tokenMint);
        const holderData = await this.fetchHolderData(tokenMint);
        const liquidityData = await this.fetchLiquidityData(tokenMint);
        const whaleData = await this.fetchWhaleData(tokenMint);
        
        // 2. Security checks
        const securityResults = await this.runSecurityChecks(tokenMint);
        
        // 3. Technical analysis
        const technicalResults = await this.runTechnicalAnalysis(tokenData);
        
        // 4. Whale activity analysis
        const whaleResults = await this.analyzeWhaleActivity(whaleData);
        
        // 5. Calculate overall score
        const overallScore = this.calculateTokenScore({
            security: securityResults,
            technical: technicalResults,
            whale: whaleResults,
            liquidity: liquidityData
        });
        
        return {
            mint: tokenMint,
            score: overallScore,
            recommendation: this.generateRecommendation(overallScore),
            analysis: {
                security: securityResults,
                technical: technicalResults,
                whale: whaleResults
            }
        };
    }
}
```

**Analysis components:**

**🔒 Security Analysis:**
- **Honeypot Check**: Can tokens be sold?
- **Rug Pull Indicators**: LP locked, team tokens, mint authority
- **Contract Verification**: Known good/bad contract patterns
- **Authority Analysis**: Who controls token supply?

**📊 Technical Analysis:**  
- **Price Action**: Recent price movements and patterns
- **Volume Analysis**: Trading volume trends
- **Momentum Score**: Price momentum calculation
- **RSI Calculation**: Overbought/oversold levels

**🐋 Whale Activity Analysis:**
- **Whale Holdings**: Top holder percentages
- **Whale Behavior**: Recent buy/sell activity  
- **Whale Entry Signals**: Large accumulation detected
- **Distribution Analysis**: Token concentration levels

**Example analysis output:**
```
🔬 Analyzing token: 9WzDXwr...
🔒 Security Score: 85/100
   ✅ Honeypot: SAFE
   ✅ Rug indicators: LOW RISK
   ⚠️  LP Lock: 6 months (moderate)
📊 Technical Score: 72/100
   📈 Price momentum: +15% (1h)
   📊 Volume trend: INCREASING
   🎯 RSI: 45 (neutral)
🐋 Whale Score: 78/100
   👑 Top 10 holders: 35% (good distribution)
   📈 Whale accumulation: DETECTED
   🎯 Entry signal: POSITIVE
🏆 Overall Score: 78/100
💡 Recommendation: BUY (High probability)
```

---

## ⚖️ **TRADING DECISION ENGINE**

### **Decision Process Flow** (`src/enhanced/token-queue-system.ts`)

```typescript
// File: src/enhanced/token-queue-system.ts (Lines 400-500)
class TokenQueueSystem {
    private async makeTradeDecision(analysis: TokenAnalysis): Promise<TradeDecision> {
        console.log(`⚖️ Making trade decision for ${analysis.mint.slice(0, 8)}...`);
        
        // 1. Check if trading allowed
        const systemStatus = await this.integrationManager.checkTradingAllowed();
        if (!systemStatus.allowed) {
            return { action: 'SKIP', reason: systemStatus.reason };
        }
        
        // 2. Check position limits
        const currentPositions = this.getCurrentPositions();
        if (currentPositions.length >= masterConfig.pool.maxPositions) {
            return { action: 'SKIP', reason: 'MAX_POSITIONS_REACHED' };
        }
        
        // 3. Check existing position for this token
        if (this.hasPositionForToken(analysis.mint)) {
            return { action: 'SKIP', reason: 'POSITION_EXISTS' };
        }
        
        // 4. Score-based decision
        if (analysis.score >= masterConfig.entry.requiredMomentum) {
            // 5. Final checks before trade
            const finalChecks = await this.runFinalTradeChecks(analysis);
            if (finalChecks.passed) {
                return { 
                    action: 'BUY',
                    confidence: analysis.score,
                    analysis: analysis
                };
            } else {
                return { 
                    action: 'SKIP', 
                    reason: finalChecks.reason 
                };
            }
        } else {
            return { 
                action: 'SKIP', 
                reason: `SCORE_TOO_LOW (${analysis.score} < ${masterConfig.entry.requiredMomentum})`
            };
        }
    }
}
```

### **Final Trade Checks** (`src/utils/handlers/jupiterHandler.ts`)

```typescript
// File: src/utils/handlers/jupiterHandler.ts (Lines 50-100)
async function runFinalTradeChecks(analysis: TokenAnalysis): Promise<CheckResult> {
    // 1. Current price vs analysis price (staleness check)
    const currentPrice = await getCurrentTokenPrice(analysis.mint);
    const priceDeviation = Math.abs(currentPrice - analysis.price) / analysis.price;
    
    if (priceDeviation > 0.05) { // 5% price change since analysis
        return { passed: false, reason: 'PRICE_STALE' };
    }
    
    // 2. Slippage estimation
    const slippageEstimate = await estimateSlippage(analysis.mint, masterConfig.pool.positionSize);
    if (slippageEstimate > masterConfig.execution.slippageTolerance) {
        return { passed: false, reason: 'SLIPPAGE_TOO_HIGH' };
    }
    
    // 3. Liquidity recheck (may have changed)
    const currentLiquidity = await getCurrentLiquidity(analysis.mint);
    if (currentLiquidity < masterConfig.entry.minLiquidity) {
        return { passed: false, reason: 'LIQUIDITY_DECREASED' };
    }
    
    // 4. Network congestion check
    const networkStatus = await checkNetworkCongestion();
    if (networkStatus.congested && masterConfig.execution.executionSpeed === 'slow') {
        return { passed: false, reason: 'NETWORK_CONGESTED' };
    }
    
    return { passed: true, reason: 'ALL_CHECKS_PASSED' };
}
```

**Decision tree example:**
```
Token: 9WzDXwr... (Score: 78)
├─ System Status: ✅ ACTIVE
├─ Position Limit: ✅ 3/20 positions
├─ Existing Position: ✅ None found
├─ Score Check: ✅ 78 >= 40 (required)
├─ Final Checks:
│  ├─ Price Staleness: ✅ 2.1% deviation (< 5%)
│  ├─ Slippage Estimate: ✅ 3.2% (< 10% limit)
│  ├─ Liquidity Recheck: ✅ $45,680 (> $10k min)
│  └─ Network Status: ✅ Normal congestion
└─ DECISION: 🟢 BUY (Confidence: 78%)
```

### **Trade Execution Workflow** (`src/utils/handlers/sniperooHandler.ts`)

```typescript
// File: src/utils/handlers/sniperooHandler.ts (Lines 150-250)
export async function buyToken(tokenMint: string, analysis: TokenAnalysis): Promise<TradeResult> {
    const tradeId = `trade_${Date.now()}`;
    console.log(`🎯 Executing BUY order: ${tradeId}`);
    console.log(`   Token: ${tokenMint.slice(0, 8)}...`);
    console.log(`   Amount: ${masterConfig.pool.positionSize} SOL`);
    console.log(`   Confidence: ${analysis.score}%`);
    
    try {
        // 1. Pre-execution validation
        await this.validateTradeParameters(tokenMint, masterConfig.pool.positionSize);
        
        // 2. Transaction simulation (if enabled)
        if (masterConfig.execution.simulateFirst) {
            const simulation = await this.simulateTransaction(tokenMint, 'BUY');
            if (!simulation.success) {
                throw new Error(`Simulation failed: ${simulation.error}`);
            }
        }
        
        // 3. Execute trade via Jupiter/Sniperoo
        const transaction = await this.buildBuyTransaction({
            tokenMint: tokenMint,
            inputAmount: masterConfig.pool.positionSize,
            slippage: masterConfig.execution.slippageTolerance,
            priorityFee: masterConfig.execution.priorityFee
        });
        
        // 4. Sign and send transaction
        const signature = await this.sendTransaction(transaction);
        
        // 5. Wait for confirmation
        const confirmation = await this.waitForConfirmation(signature);
        
        if (confirmation.success) {
            console.log(`✅ BUY executed successfully`);
            console.log(`   Signature: ${signature}`);
            console.log(`   Tokens received: ${confirmation.tokensReceived}`);
            console.log(`   Entry price: $${confirmation.entryPrice}`);
            
            // 6. Record trade for position management
            const tradeRecord = {
                tradeId: tradeId,
                tokenMint: tokenMint,
                action: 'BUY',
                amount: masterConfig.pool.positionSize,
                tokensReceived: confirmation.tokensReceived,
                entryPrice: confirmation.entryPrice,
                signature: signature,
                timestamp: new Date(),
                analysis: analysis
            };
            
            // 7. Add to position tracking
            await this.addToPositionTracking(tradeRecord);
            
            // 8. Start whale monitoring for this position
            await this.whaleWatcher.startWhaleMonitoring(
                tokenMint,
                confirmation.entryPrice,
                masterConfig.pool.positionSize
            );
            
            return {
                success: true,
                tradeRecord: tradeRecord
            };
        }
        
    } catch (error) {
        console.log(`❌ BUY execution failed: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}
```

**Trade execution output:**
```
🎯 Executing BUY order: trade_1724774400123
   Token: 9WzDXwr...
   Amount: 0.2 SOL (~$40)
   Confidence: 78%
🔍 Validating trade parameters...
🎭 Simulating transaction...
⚡ Building Jupiter swap transaction...
📡 Broadcasting transaction...
⏱️  Waiting for confirmation...
✅ BUY executed successfully
   Signature: 3Kx7d2vR...
   Tokens received: 1,250,000
   Entry price: $0.000032
   Slippage: 2.1%
🐋 Starting whale monitoring...
📊 Position added to tracking system
```

---

## 📊 **POSITION MANAGEMENT LIFECYCLE**

### **Active Position Monitoring** (`src/enhanced/automated-reporter.ts`)

```typescript
// File: src/enhanced/automated-reporter.ts (Lines 200-350)
class WhaleWatcher {
    async checkExitConditions(tokenMint: string): Promise<void> {
        const entry = this.tokenEntryData.get(tokenMint);
        if (!entry || entry.remainingPosition <= 0) return;

        const holdTimeMinutes = (Date.now() - entry.entryTime.getTime()) / (1000 * 60);
        const exitPrice = await this.getCurrentPrice(tokenMint);
        const currentGain = ((exitPrice - entry.entryPrice) / entry.entryPrice) * 100;
        
        console.log(`📊 POSITION CHECK: ${tokenMint.slice(0, 8)}...`);
        console.log(`   💰 Current gain: ${currentGain.toFixed(1)}%`);
        console.log(`   ⏰ Hold time: ${holdTimeMinutes.toFixed(1)} minutes`);
        console.log(`   📊 Remaining position: ${(entry.remainingPosition * 100).toFixed(0)}%`);
        
        // 1. Check tiered exits first
        const tieredExit = this.evaluateTieredExit(tokenMint, currentGain, entry);
        if (tieredExit.shouldSell) {
            await this.executeTieredExit(tokenMint, tieredExit);
            return;
        }
        
        // 2. Check stop loss
        if (currentGain <= masterConfig.exit.stopLoss) {
            await this.executeStopLoss(tokenMint, currentGain);
            return;
        }
        
        // 3. Check time-based exit
        if (holdTimeMinutes >= masterConfig.exit.maxHoldTime) {
            await this.executeTimeExit(tokenMint, currentGain, holdTimeMinutes);
            return;
        }
        
        // 4. Check whale activity
        await this.checkWhaleActivity(tokenMint);
    }
}
```

### **Tiered Exit System** (`src/enhanced/automated-reporter.ts`)

```typescript
// File: src/enhanced/automated-reporter.ts (Lines 70-140)
private executeTieredExit(tokenMint: string, currentGain: number, entry: TokenEntry) {
    const config = masterConfig.exit.tieredExit;
    if (!config?.enabled) return { shouldSell: false, percentage: 0, reason: 'Tiered exits disabled' };
    
    // Tier 1: 2x (100% gain) - sell 25%
    if (currentGain >= 100 && entry.remainingPosition > 0.75 && (!entry.lastTierExited || entry.lastTierExited < 1)) {
        entry.remainingPosition = 0.75;
        entry.lastTierExited = 1;
        return { 
            shouldSell: true, 
            percentage: 0.25, 
            reason: `📈 TIER 1: Taking 25% at ${currentGain.toFixed(0)}% gain (2x)` 
        };
    }
    
    // Tier 2: 4x (300% gain) - sell another 25%
    if (currentGain >= 300 && entry.remainingPosition > 0.50 && (!entry.lastTierExited || entry.lastTierExited < 2)) {
        entry.remainingPosition = 0.50;
        entry.lastTierExited = 2;
        return { 
            shouldSell: true, 
            percentage: 0.25, 
            reason: `📈 TIER 2: Taking 25% at ${currentGain.toFixed(0)}% gain (4x)` 
        };
    }
    
    // Tier 3: 6x (500% gain) - sell another 25%
    if (currentGain >= 500 && entry.remainingPosition > 0.25 && (!entry.lastTierExited || entry.lastTierExited < 3)) {
        entry.remainingPosition = 0.25;
        entry.lastTierExited = 3;
        return { 
            shouldSell: true, 
            percentage: 0.25, 
            reason: `📈 TIER 3: Taking 25% at ${currentGain.toFixed(0)}% gain (6x)` 
        };
    }
    
    return { shouldSell: false, percentage: 0, reason: 'No tier exit triggered' };
}
```

**Position monitoring cycle:**
```
📊 Position Monitor Cycle (Every 5 seconds)
├─ Active Positions: 7
├─ Position 1: 9WzDXwr... (+15.2%, 12 min hold, 100% remaining)
├─ Position 2: 7Kt8uN... (+103.7%, 45 min hold, 75% remaining) ← Tier 1 executed
├─ Position 3: BxR4m2... (-8.3%, 8 min hold, 100% remaining)
├─ Position 4: 5Qw9xP... (+340%, 78 min hold, 50% remaining) ← Tier 2 executed
├─ Position 5: 3Nf6hL... (+67.9%, 23 min hold, 100% remaining)
├─ Position 6: 8Ky5tM... (-22.1%, 34 min hold, 100% remaining) ← Near stop loss
└─ Position 7: 4Rv7jQ... (+520%, 95 min hold, 25% remaining) ← Moon bag
```

### **Whale Activity Monitoring** (`src/enhanced/automated-reporter.ts`)

```typescript
// File: src/enhanced/automated-reporter.ts (Lines 320-400)
private async simulateWhaleActivity(tokenMint: string): Promise<void> {
    // Simulate whale selling activity
    if (Math.random() > 0.7) return; // 30% chance of whale activity
    
    const whaleCount = Math.floor(Math.random() * 5) + 1;
    const sellPercentages = Array.from({length: whaleCount}, () => Math.random() * 80 + 10);
    const totalSellPercentage = sellPercentages.reduce((sum, pct) => sum + pct, 0) / whaleCount;
    
    console.log(`🐋 WHALE ACTIVITY DETECTED: ${tokenMint.slice(0, 8)}...`);
    console.log(`   Whales selling: ${whaleCount}`);
    console.log(`   Average sell %: ${totalSellPercentage.toFixed(1)}%`);
    
    // Check if whale selling exceeds threshold
    if (whaleCount >= masterConfig.whales.minWhaleCount && 
        totalSellPercentage >= masterConfig.exit.whaleSellPercentage) {
        
        console.log(`🚨 WHALE EXIT THRESHOLD EXCEEDED!`);
        console.log(`   Required: ${masterConfig.whales.minWhaleCount}+ whales selling ${masterConfig.exit.whaleSellPercentage}%+`);
        console.log(`   Detected: ${whaleCount} whales selling ${totalSellPercentage.toFixed(1)}%`);
        
        // Trigger emergency exit
        await this.executeWhaleExit(tokenMint, whaleCount, totalSellPercentage);
    } else {
        console.log(`🟢 Whale activity below exit threshold`);
    }
}
```

---

## 🚪 **EXIT STRATEGY EXECUTION**

### **Exit Decision Matrix** (`src/utils/handlers/jupiterHandler.ts`)

```typescript
// File: src/utils/handlers/jupiterHandler.ts (Lines 200-300)
export async function executeExit(tokenMint: string, exitType: ExitType, percentage: number = 1.0): Promise<ExitResult> {
    const position = await getPosition(tokenMint);
    const currentPrice = await getCurrentTokenPrice(tokenMint);
    const profitLoss = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    
    console.log(`🚪 EXECUTING EXIT: ${exitType}`);
    console.log(`   Token: ${tokenMint.slice(0, 8)}...`);
    console.log(`   Exit %: ${(percentage * 100).toFixed(0)}%`);
    console.log(`   P&L: ${profitLoss > 0 ? '+' : ''}${profitLoss.toFixed(2)}%`);
    console.log(`   Hold time: ${position.holdTimeMinutes.toFixed(1)} minutes`);
    
    try {
        // 1. Calculate tokens to sell
        const tokensToSell = Math.floor(position.tokensHeld * percentage);
        
        // 2. Build sell transaction
        const transaction = await this.buildSellTransaction({
            tokenMint: tokenMint,
            tokenAmount: tokensToSell,
            slippage: masterConfig.execution.slippageTolerance,
            priorityFee: masterConfig.execution.priorityFee
        });
        
        // 3. Execute transaction
        const signature = await this.sendTransaction(transaction);
        const confirmation = await this.waitForConfirmation(signature);
        
        if (confirmation.success) {
            console.log(`✅ EXIT executed successfully`);
            console.log(`   Tokens sold: ${tokensToSell.toLocaleString()}`);
            console.log(`   SOL received: ${confirmation.solReceived.toFixed(4)}`);
            console.log(`   Exit price: $${confirmation.exitPrice.toFixed(8)}`);
            console.log(`   Realized P&L: $${confirmation.realizedPnL.toFixed(2)}`);
            
            // 4. Update position tracking
            await this.updatePosition(tokenMint, {
                tokensRemaining: position.tokensHeld - tokensToSell,
                partialExits: position.partialExits + 1,
                totalRealized: position.totalRealized + confirmation.realizedPnL
            });
            
            // 5. Record for tax tracking
            await this.recordTaxTransaction({
                type: 'SELL',
                tokenAddress: tokenMint,
                amount: tokensToSell,
                pricePerToken: confirmation.exitPrice,
                totalValue: confirmation.solReceived,
                fee: confirmation.transactionFee,
                realizedGain: confirmation.realizedPnL
            });
            
            // 6. Update session metrics
            await this.integrationManager.recordTradeResult(
                tokenMint,
                profitLoss > 0, // success if profitable
                confirmation.realizedPnL,
                position.holdTimeMinutes
            );
            
            // 7. If fully exited, remove from monitoring
            if (percentage >= 1.0 || position.tokensHeld - tokensToSell < 100) {
                await this.removeFromPositionTracking(tokenMint);
                console.log(`📊 Position fully closed and removed from tracking`);
            }
            
            return {
                success: true,
                exitType: exitType,
                profitLoss: profitLoss,
                realizedPnL: confirmation.realizedPnL,
                signature: signature
            };
        }
        
    } catch (error) {
        console.log(`❌ EXIT execution failed: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}
```

### **Exit Type Examples**

**🛑 Stop Loss Exit:**
```
🚪 EXECUTING EXIT: STOP_LOSS
   Token: 9WzDXwr...
   Exit %: 100%
   P&L: -28.3%
   Hold time: 15.2 minutes
✅ EXIT executed successfully
   Tokens sold: 1,250,000
   SOL received: 0.1434 SOL
   Exit price: $0.000023
   Realized P&L: -$11.34
📊 Position fully closed and removed from tracking
```

**📈 Tier 1 Profit Exit:**
```
🚪 EXECUTING EXIT: TIER_1_PROFIT
   Token: 7Kt8uN...
   Exit %: 25%
   P&L: +103.7%
   Hold time: 45.3 minutes
✅ EXIT executed successfully
   Tokens sold: 312,500
   SOL received: 0.0515 SOL
   Exit price: $0.000065
   Realized P&L: +$5.15
📊 75% position remaining - continuing to monitor
```

**🐋 Whale Exit:**
```
🚪 EXECUTING EXIT: WHALE_ACTIVITY
   Token: 4Rv7jQ...
   Exit %: 100%
   P&L: +67.9%
   Hold time: 23.1 minutes
🚨 Emergency exit due to whale selling
   5 whales dumping 45%+ of holdings
✅ EXIT executed successfully
   Realized P&L: +$27.16
📊 Position closed due to whale activity
```

---

## 🔄 **SESSION COMPLETION & WALLET ROTATION**

### **Session Target Achievement** (`src/utils/managers/sessionManager.ts`)

```typescript
// File: src/utils/managers/sessionManager.ts (Lines 100-200)
export class SessionManager {
    public updateSessionMetrics(tradeResult: TradeResult): void {
        if (!this.currentSession) return;

        const session = this.currentSession;
        session.totalTrades++;
        session.currentBalance += tradeResult.pnl;
        session.totalPnL += tradeResult.pnl;

        // Update metrics
        if (tradeResult.success) {
            session.successfulTrades++;
            if (tradeResult.pnl > session.metrics.largestWin) {
                session.metrics.largestWin = tradeResult.pnl;
            }
        }

        // Calculate win rate and other metrics
        session.metrics.winRate = (session.successfulTrades / session.totalTrades) * 100;

        // 🎯 CHECK IF TARGET REACHED
        if (session.currentBalance >= session.initialBalance * 10) { // 10x target
            session.targetReached = true;
            console.log(`🎯 TARGET REACHED!`);
            console.log(`   Initial: $${session.initialBalance}`);
            console.log(`   Current: $${session.currentBalance.toFixed(2)}`);
            console.log(`   ROI: ${((session.currentBalance / session.initialBalance) * 100).toFixed(0)}%`);
            console.log(`   Trades: ${session.totalTrades} (${session.metrics.winRate.toFixed(1)}% win rate)`);
            
            // Trigger session completion
            setTimeout(() => {
                this.completeSession('Target reached (10x)');
            }, 5000); // 5 second delay to complete final trades
        }

        this.saveSession();
    }
}
```

### **Wallet Rotation Process** (`src/utils/managers/walletRotator.ts`)

```typescript
// File: src/utils/managers/walletRotator.ts (Lines 150-220)
export class WalletRotator {
    public archiveWallet(publicKey: string, stats: WalletStats): void {
        const wallet = this.walletPool.find(w => w.publicKey === publicKey);
        if (!wallet) return;

        // Update wallet record
        wallet.status = 'completed';
        wallet.endTime = new Date();
        wallet.totalProfit = stats.totalProfit;
        wallet.totalTrades = stats.totalTrades;
        wallet.currentPool = stats.totalProfit + wallet.initialPool;
        wallet.targetReached = true;

        // Calculate performance metrics
        const roi = ((wallet.currentPool - wallet.initialPool) / wallet.initialPool) * 100;
        const duration = (wallet.endTime.getTime() - wallet.startTime.getTime()) / (1000 * 60 * 60); // hours

        console.log(`📦 ARCHIVING SUCCESSFUL WALLET`);
        console.log(`   Wallet: ${wallet.publicKey.slice(0, 8)}...${wallet.publicKey.slice(-4)}`);
        console.log(`   Initial: $${wallet.initialPool}`);
        console.log(`   Final: $${wallet.currentPool.toFixed(2)}`);
        console.log(`   Profit: $${wallet.totalProfit.toFixed(2)}`);
        console.log(`   ROI: ${roi.toFixed(2)}%`);
        console.log(`   Trades: ${wallet.totalTrades}`);
        console.log(`   Duration: ${duration.toFixed(1)} hours`);

        // Save to completed folder
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `wallet-${wallet.publicKey.slice(0, 8)}-COMPLETED-${timestamp}.json`;
        const filepath = path.join(this.completedDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(wallet, null, 2));

        // Remove from active pool
        this.walletPool = this.walletPool.filter(w => w.publicKey !== publicKey);
        this.saveWalletPool();

        console.log(`✅ Wallet archived successfully: ${filename}`);
    }

    public getNextWallet(): WalletConfig {
        // Find next available wallet
        const availableWallets = this.walletPool
            .filter(w => w.status === 'reserved')
            .sort((a, b) => {
                // Prioritize unused wallets
                if (!a.lastUsed && b.lastUsed) return -1;
                if (a.lastUsed && !b.lastUsed) return 1;
                return 0;
            });

        if (availableWallets.length === 0) {
            console.log('⚠️ No wallets available! Generating new ones...');
            this.generateWalletPool(5);
            return this.getNextWallet();
        }

        const selectedWallet = availableWallets[0];
        selectedWallet.status = 'active';
        selectedWallet.startTime = new Date();
        selectedWallet.lastUsed = new Date();

        console.log(`🔄 ACTIVATING NEW WALLET`);
        console.log(`   Previous wallet archived successfully`);
        console.log(`   New wallet: ${selectedWallet.publicKey.slice(0, 8)}...${selectedWallet.publicKey.slice(-4)}`);
        console.log(`   Pool status: ${this.getWalletPoolStatus().available} wallets remaining`);

        // Update environment
        process.env.PRIVATE_KEY = selectedWallet.privateKey;

        return selectedWallet;
    }
}
```

### **Automatic Session Restart** (`src/utils/managers/integrationManager.ts`)

```typescript
// File: src/utils/managers/integrationManager.ts (Lines 80-140)
export class IntegrationManager {
    public recordTradeResult(tokenAddress: string, success: boolean, pnl: number, holdTimeMinutes: number): void {
        // Update session metrics
        this.sessionManager.updateSessionMetrics({
            success,
            pnl,
            holdTimeMinutes
        });

        // Check if session should be completed
        const session = this.sessionManager.getCurrentSession();
        if (session?.targetReached) {
            console.log(`🎯 Session target reached! Preparing to complete session...`);
            
            // Complete current session
            setTimeout(() => {
                this.completeTradingSession('Target reached (10x)');
                
                // Start new session with fresh wallet after brief delay
                setTimeout(() => {
                    console.log(`🔄 Starting new trading session automatically...`);
                    this.startTradingSession(1000); // Start with $1000 again
                }, 3000);
            }, 2000);
        }
    }

    public completeTradingSession(reason: string = 'Session completed'): void {
        try {
            // 1. Complete current session
            this.sessionManager.completeSession(reason);

            // 2. Create post-session backup
            const backupId = this.backupManager.backupTradingData('Post-session backup');
            console.log(`💾 Post-session backup created: ${backupId}`);

            // 3. Generate session reports
            if (this.advancedManager) {
                this.advancedManager.generateReports();
            }

            console.log(`✅ Trading session completed and archived`);

        } catch (error) {
            console.error(`❌ Error completing session: ${error}`);
        }
    }
}
```

**Session completion flow:**
```
🎯 TARGET REACHED!
   Initial: $1000
   Current: $10,247.83
   ROI: 1025%
   Trades: 47 (68.1% win rate)

📊 TRADING SESSION COMPLETED
   🆔 Session: session_1
   ⏱️ Duration: 4.7 hours
   💰 P&L: $9,247.83 (925% ROI)
   📈 Trades: 47 (68.1% win rate)
   📉 Max Drawdown: 12.3%
   🎯 Target: ✅ REACHED
   📋 Reason: Target reached (10x)

📦 ARCHIVING SUCCESSFUL WALLET
   Wallet: 6pKgx6fP...GC9K
   Initial: $1000
   Final: $10,247.83
   Profit: $9,247.83
   ROI: 924.78%
   Trades: 47
   Duration: 4.7 hours
✅ Wallet archived successfully: wallet-6pKgx6fP-COMPLETED-2025-08-27T14-45-30.json

🔄 ACTIVATING NEW WALLET
   Previous wallet archived successfully
   New wallet: 7gRdFnkL...8Y6Y
   Pool status: 8 wallets remaining

🚀 Starting new trading session automatically...
🎮 Trading session started: session_2
💼 Wallet assigned: 7gRdFnkL...8Y6Y
📊 Target: $1000 → $10000 (10x)
```

---

## 🗂️ **FILE SYSTEM INTEGRATION**

### **Data Flow Architecture**

```
📁 Project Structure & Data Flow:
├── src/
│   ├── index.ts                    🚀 Main entry point
│   ├── enhanced/
│   │   ├── masterConfig.ts         ⚙️ Configuration management
│   │   ├── token-queue-system.ts   🔍 Token detection pipeline
│   │   ├── tokenAnalyzer.ts        🔬 Deep token analysis
│   │   └── automated-reporter.ts   🐋 Whale monitoring & exits
│   ├── utils/managers/
│   │   ├── integrationManager.ts   🔗 System coordination
│   │   ├── sessionManager.ts       🎮 Trading session control
│   │   ├── walletRotator.ts        💼 Multi-wallet management
│   │   ├── backupManager.ts        💾 Version control system
│   │   └── logManager.ts           📝 Centralized logging
│   ├── utils/handlers/
│   │   ├── jupiterHandler.ts       💱 DEX swap execution
│   │   ├── sniperooHandler.ts      ⚡ Trade execution
│   │   ├── tokenHandler.ts         🪙 Token data management
│   │   └── walletHandler.ts        💼 Wallet operations
│   ├── security/
│   │   ├── securityManager.ts      🛡️ Multi-factor security
│   │   └── securityIntegration.ts  🔒 Security integration
│   └── advanced-features.ts        🚀 Advanced trading features
├── data/                          📊 Trading data storage
│   ├── trading_log.json           📈 All trade records
│   ├── pool_transactions.csv      💰 Pool transaction history
│   ├── pending_tokens.csv         ⏳ Token analysis queue
│   └── whale_exits.jsonl          🐋 Whale activity log
├── wallets/                       💼 Wallet management
│   ├── pending/wallet-pool.json   🎱 Available wallets
│   ├── completed/                 ✅ Archived successful wallets
│   └── sessions/                  🎮 Active session data
├── tax-compliance/                📊 Tax reporting system
│   └── 2025/
│       ├── transactions/          💱 All trading transactions
│       ├── reports/               📋 Daily summaries
│       └── form8949/             📝 IRS tax forms
└── docs/                         📚 Documentation system
```

### **Data Persistence Points**

**🔄 Real-time Updates (Every trade):**
- `data/trading_log.json` - Trade execution records
- `wallets/sessions/session_X.json` - Session metrics
- `tax-compliance/2025/transactions/all-transactions.json` - Tax records

**⏱️ Periodic Updates (Every 5-10 minutes):**
- `data/pool_transactions.csv` - Pool balance changes
- `data/whale_exits.jsonl` - Whale activity events
- `wallets/rotation_history.json` - Wallet rotation log

**🎯 Session Milestones:**
- `wallets/completed/wallet-XXXXXXXX-COMPLETED-timestamp.json` - Successful wallet archive
- `wallets/session_X_summary.txt` - Human-readable session summary
- `src/backup-old/versions/critical/` - System state backups

### **File Integration Examples**

**Trade Execution Data Flow:**
```typescript
// 1. Trade decision made (token-queue-system.ts)
const decision = await this.makeTradeDecision(analysis);

// 2. Execute trade (sniperooHandler.ts) 
const result = await buyToken(tokenMint, analysis);

// 3. Record in trading log (logManager.ts)
await this.logTrade({
    timestamp: new Date(),
    action: 'BUY',
    token: tokenMint,
    amount: masterConfig.pool.positionSize,
    price: result.entryPrice
});

// 4. Update session metrics (sessionManager.ts)
this.sessionManager.updateSessionMetrics(result);

// 5. Record for taxes (advanced-features.ts)  
this.taxTracker.recordTransaction({
    type: 'BUY',
    tokenAddress: tokenMint,
    amount: result.tokensReceived,
    pricePerToken: result.entryPrice,
    totalValue: result.solSpent,
    fee: result.transactionFee
});

// 6. Start position monitoring (automated-reporter.ts)
this.whaleWatcher.startWhaleMonitoring(tokenMint, result.entryPrice);
```

---

## 🚨 **ERROR HANDLING & RECOVERY**

### **Network Error Recovery** (`src/utils/managers/websocketManager.ts`)

```typescript
// File: src/utils/managers/websocketManager.ts (Lines 100-150)
export class WebSocketManager {
    private async handleConnectionError(error: Error): Promise<void> {
        console.log(`🚨 Network error detected: ${error.message}`);
        
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts <= masterConfig.runtime.reconnectAttempts) {
            console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${masterConfig.runtime.reconnectAttempts}`);
            
            // Wait before reconnecting
            await new Promise(resolve => setTimeout(resolve, masterConfig.runtime.reconnectDelay));
            
            // Try next RPC endpoint
            await this.rotateToNextRPC();
            
            // Attempt reconnection
            await this.reconnect();
            
        } else {
            console.log(`❌ Max reconnection attempts reached. Enabling emergency mode.`);
            
            // 1. Create emergency backup
            const backupManager = new BackupManager();
            backupManager.backupCriticalFiles('Network failure emergency backup');
            
            // 2. Close all positions safely
            await this.emergencyCloseAllPositions('Network failure');
            
            // 3. Complete session
            const integrationManager = IntegrationManager.getInstance();
            integrationManager.completeTradingSession('Network failure - emergency shutdown');
            
            // 4. Exit safely
            process.exit(1);
        }
    }
    
    private async emergencyCloseAllPositions(reason: string): Promise<void> {
        console.log(`🚨 EMERGENCY: Closing all positions due to ${reason}`);
        
        const positions = await this.getAllActivePositions();
        
        for (const position of positions) {
            try {
                console.log(`🚪 Emergency exit: ${position.tokenMint.slice(0, 8)}...`);
                await executeExit(position.tokenMint, 'EMERGENCY', 1.0);
            } catch (error) {
                console.log(`❌ Failed to close position ${position.tokenMint}: ${error.message}`);
                // Continue with other positions
            }
        }
        
        console.log(`✅ Emergency position closure completed`);
    }
}
```

### **Transaction Failure Handling** (`src/utils/handlers/jupiterHandler.ts`)

```typescript
// File: src/utils/handlers/jupiterHandler.ts (Lines 100-180)
async function executeTradeWithRetry(transaction: Transaction, maxRetries: number = 3): Promise<TradeResult> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`⚡ Transaction attempt ${attempt}/${maxRetries}`);
            
            // 1. Check network conditions
            const networkStatus = await this.checkNetworkHealth();
            if (networkStatus.congested && attempt === 1) {
                console.log(`⚠️ Network congestion detected, increasing priority fee`);
                transaction = await this.adjustPriorityFee(transaction, 1.5);
            }
            
            // 2. Simulate transaction first (if not already done)
            if (masterConfig.execution.simulateFirst && attempt === 1) {
                const simulation = await this.simulateTransaction(transaction);
                if (!simulation.success) {
                    throw new Error(`Simulation failed: ${simulation.error}`);
                }
            }
            
            // 3. Send transaction
            const signature = await this.sendTransaction(transaction);
            
            // 4. Wait for confirmation with timeout
            const confirmation = await Promise.race([
                this.waitForConfirmation(signature),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Confirmation timeout')), 
                              masterConfig.execution.confirmationTimeout)
                )
            ]);
            
            if (confirmation.success) {
                console.log(`✅ Transaction confirmed on attempt ${attempt}`);
                return confirmation;
            }
            
        } catch (error) {
            lastError = error;
            console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
            
            // Wait before retry (exponential backoff)
            if (attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                console.log(`⏳ Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // All attempts failed
    console.log(`❌ Transaction failed after ${maxRetries} attempts`);
    throw new Error(`Transaction failed: ${lastError.message}`);
}
```

### **Security Alert Handling** (`src/security/securityManager.ts`)

```typescript
// File: src/security/securityManager.ts (Lines 300-400)
async triggerEmergencyResponse(reason: string, severity: 'HIGH' | 'CRITICAL'): Promise<void> {
    console.log(`🚨 SECURITY EMERGENCY: ${reason} (${severity})`);
    
    this.emergencyTriggered = true;
    this.systemLocked = true;
    
    if (severity === 'CRITICAL') {
        console.log(`🔒 CRITICAL ALERT - All trading suspended immediately`);
        
        // 1. Halt all trading
        this.tradingHalted = true;
        
        // 2. Create emergency backup
        const backupManager = new BackupManager();
        const backupId = backupManager.backupCriticalFiles(`Emergency: ${reason}`);
        
        // 3. Close positions if hardware wallet flush enabled
        if (this.config.emergency.hardwareWalletFlush.enabled) {
            console.log(`🚨 INITIATING EMERGENCY WALLET FLUSH`);
            await this.executeHardwareWalletFlush(reason);
        }
        
        // 4. Send immediate alerts
        await this.sendEmergencyAlerts({
            type: 'CRITICAL_SECURITY',
            reason: reason,
            timestamp: new Date(),
            actions: ['Trading halted', 'Positions closed', 'Wallet flushed']
        });
        
        // 5. Log security incident
        this.logSecurityEvent({
            timestamp: new Date(),
            eventType: 'EMERGENCY_TRIGGERED',
            sourceIP: 'system',
            details: { reason, severity, backupId },
            severity: 'CRITICAL',
            actionTaken: ['System lockdown', 'Emergency protocols activated']
        });
    }
    
    console.log(`🛡️ Emergency response completed`);
}
```

---

## 🎮 **MANUAL OVERRIDE PROCEDURES**

### **Emergency Stop Procedures**

**🚨 Immediate Emergency Stop:**
```typescript
// File: Manual override commands
import { integrationManager } from './src/utils/managers/integrationManager';

// 1. EMERGENCY STOP ALL TRADING
integrationManager.emergencyStop('Manual override');

// 2. CLOSE ALL POSITIONS IMMEDIATELY
const whaleWatcher = new WhaleWatcher();
await whaleWatcher.forceExitAll('Manual emergency exit');

// 3. COMPLETE CURRENT SESSION
integrationManager.completeTradingSession('Emergency stop');

// 4. CREATE EMERGENCY BACKUP
const backupManager = new BackupManager();
backupManager.backupCriticalFiles('Manual emergency backup');
```

**🔄 Controlled Restart:**
```typescript
// 1. VERIFY SYSTEM STATUS
const healthCheck = integrationManager.performSystemHealthCheck();
console.log('System Health:', healthCheck);

// 2. START NEW SESSION IF HEALTHY
if (healthCheck.healthy) {
    integrationManager.startTradingSession(1000);
} else {
    console.log('🚨 System issues detected - manual intervention required');
}
```

### **Configuration Override**

**⚙️ Runtime Configuration Changes:**
```typescript
// File: Runtime config updates
import { updateConfig } from './src/enhanced/masterConfig';

// 1. EMERGENCY RISK REDUCTION
updateConfig({
    pool: {
        maxPositions: 3,        // Reduce to 3 positions max
        positionSize: 0.05      // Reduce position size to $10
    },
    exit: {
        stopLoss: -15,          // Tighter stop loss
        maxHoldTime: 10         // Shorter hold times
    }
});

// 2. AGGRESSIVE MODE FOR RECOVERY
updateConfig({
    pool: {
        maxPositions: 25,       // Increase opportunities
        maxPoolRisk: 90         // Use more capital
    },
    entry: {
        requiredMomentum: 25    // Lower entry threshold
    }
});
```

### **Session Management Override**

**🎮 Manual Session Control:**
```typescript
// File: Manual session management
import { SessionManager } from './src/utils/managers/sessionManager';

const sessionManager = new SessionManager();

// 1. PAUSE CURRENT SESSION
sessionManager.pauseSession();
console.log('📊 Trading paused - positions maintained');

// 2. RESUME WHEN READY
sessionManager.resumeSession();
console.log('▶️ Trading resumed');

// 3. FORCE SESSION COMPLETION
sessionManager.completeSession('Manual completion');

// 4. START SPECIFIC SESSION SIZE
sessionManager.startNewSession(500); // Start with $500
```

### **Wallet Management Override**

**💼 Manual Wallet Control:**
```typescript
// File: Manual wallet management
import { WalletRotator } from './src/utils/managers/walletRotator';

const walletRotator = new WalletRotator();

// 1. CHECK WALLET STATUS
walletRotator.displayWalletPoolStatus();

// 2. GENERATE MORE WALLETS IF NEEDED
walletRotator.generateWalletPool(10); // Generate 10 new wallets

// 3. FORCE WALLET ROTATION
const nextWallet = walletRotator.getNextWallet();
process.env.PRIVATE_KEY = nextWallet.privateKey;

// 4. RETIRE PROBLEM WALLET
walletRotator.retireWallet('CurrentWalletPublicKey', 'Performance issues');
```

---

## 📊 **MONITORING & DIAGNOSTICS**

### **Real-time Status Display**

**📈 System Dashboard Commands:**
```typescript
// File: Monitoring commands
import { integrationManager } from './src/utils/managers/integrationManager';

// 1. COMPLETE SYSTEM STATUS
integrationManager.displayIntegratedStatus();

// 2. DETAILED HEALTH CHECK
const health = integrationManager.performSystemHealthCheck();

// 3. POSITION MONITORING
const whaleWatcher = new WhaleWatcher();
const status = whaleWatcher.getMonitoringStatus();
console.log('Active positions:', status.activeMonitoringCount);

// 4. PERFORMANCE METRICS
const session = sessionManager.getCurrentSession();
if (session) {
    console.log('Current ROI:', ((session.currentBalance / session.initialBalance) * 100).toFixed(1) + '%');
    console.log('Win rate:', session.metrics.winRate.toFixed(1) + '%');
}
```

### **Log Analysis**

**📝 Key Log Locations:**
- **System logs**: `systemlog.txt` - General bot operation
- **Trading logs**: `data/trading_log.json` - All trade executions
- **Whale activity**: `data/whale_exits.jsonl` - Exit decisions
- **Error logs**: `errors.txt` - Error tracking
- **Session summaries**: `wallets/session_X_summary.txt` - Readable summaries

**🔍 Important Log Patterns:**
```bash
# Monitor for errors
tail -f systemlog.txt | grep "❌"

# Track trading activity  
tail -f data/trading_log.json | grep "BUY\|SELL"

# Watch whale exits
tail -f data/whale_exits.jsonl | grep "EXIT"

# Monitor session progress
tail -f wallets/session_1.json | grep "currentBalance"
```

---

**🎯 Summary: This workflow documentation provides complete visibility into every step of the SOL-BOT operation, from startup initialization through trade execution to session completion. Each process is traceable through specific files and functions, enabling both automated operation and manual intervention when needed.**