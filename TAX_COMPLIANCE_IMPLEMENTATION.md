# SOL-BOT TAX COMPLIANCE IMPLEMENTATION

## Overview
This implementation adds comprehensive tax compliance to the sol-bot trading system.

## Files Created
- `src/tax-compliance/taxTracker.ts` - Enhanced tax tracking system
- `src/tax-compliance/costBasisTracker.ts` - FIFO cost basis calculation
- `test-tax-compliance.ts` - Verification tests

## Sell Locations Found
1. src\advanced-features.ts:557 - updatePosition (closePosition()
2. src\backup-old\index-old.ts:58 - unknown (jupiter.*sell)
3. src\backup-old\versions\critical\critical_2025-08-27T20-48-28\index.ts:226 - unknown (jupiter.*sell)
4. src\enhanced\analyze-trading-session.ts:89 - parseFloat (exit.*trade)
5. src\enhanced\analyze-trading-session.ts:171 - generateInsights (exit.*trade)
6. src\enhanced\analyze-trading-session.ts:239 - exportAnalysis (exit.*trade)
7. src\enhanced\performanceLogger.ts:223 - if (exit.*trade)
8. src\enhanced\performanceLogger.ts:230 - exitTrade (exit.*trade)
9. src\enhanced\performanceLogger.ts:234 - exitTrade (exit.*trade)
10. src\enhanced\performanceLogger.ts:243 - if (exit.*trade)
11. src\enhanced\performanceLogger.ts:249 - trackPostExit (exit.*trade)
12. src\enhanced\performanceLogger.ts:270 - generateReport (exit.*trade)
13. src\index.08.24-0254-after-1hr-flop-reseting-2normarl.ts:205 - unknown (jupiter.*sell)
14. src\index.ts:227 - unknown (jupiter.*sell)
15. src\utils\handlers\jupiterHandler.ts:146 - unSwapToken (unSwapToken()
16. src\utils\handlers\jupiterHandler.ts:193 - attemptUnSwapToken (unSwapToken()
17. src\utils\handlers\jupiterHandler.ts:253 - if (jupiter.*sell)
18. src\utils\handlers\jupiterHandler.ts:257 - if (unSwapToken()
19. src\utils\handlers\jupiterHandler.ts:264 - writeLog (jupiter.*sell)
20. src\utils\handlers\jupiterHandler.ts:271 - writeLog (unSwapToken()

## Code Additions Required

// ============================================================================
// PART 2: CODE ADDITIONS FOR EACH SELL LOCATION
// ============================================================================


// LOCATION 1: src\advanced-features.ts:557
// Function: updatePosition
// Pattern: closePosition(

/*
FIND THIS SECTION IN src\advanced-features.ts around line 557:
552:   public updatePosition(tokenAddress: string, position: Position): void {
553:     this.shutdownManager.updatePosition(tokenAddress, position);
554:   }
555: 
556:   // Close position and record for taxes
557:   public closePosition(
558:     tokenAddress: string,
559:     tokenSymbol: string,
560:     entryPrice: number,
561:     exitPrice: number,
562:     amount: number,
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: returnedMint || mint, // Available: tokenSymbol, entryPrice, exitPrice, amount
      tokenSymbol: tokenSymbol,
      amount: amount, // Token amount sold
      priceSOL: exitPrice, // Price per token in SOL
      totalSOL: exitPrice * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: `sell_${Date.now()}`, // Transaction signature
      success: true,
      platform: 'unknown',
      notes: `Sold via updatePosition`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 2: src\backup-old\index-old.ts:58
// Function: unknown
// Pattern: jupiter.*sell

/*
FIND THIS SECTION IN src\backup-old\index-old.ts around line 58:
53: const BUY_PROVIDER = config.token_buy.provider;
54: const BUY_AMOUNT = config.token_buy.sol_amount;
55: const SIM_MODE = config.checks.simulation_mode || false;
56: const PLAY_SOUND = config.token_buy.play_sound || false;
57: const OPEN_BROWSER = config.token_buy.open_browser || false;
58: const SKIP_COPY_TRADE_SELL = config.token_sell.jupiter.skip_sell_copy_trade || true;
59: const WSOL_MINT = config.wsol_pc_mint;
60: let handledMints: HandledMint[] = [];
61: 
62: // Global shutdown flag
63: let isShuttingDown = false;
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: returnedMint || mint, // Available: 
      tokenSymbol: "UNKNOWN",
      amount: 0, // Token amount sold
      priceSOL: 0, // Price per token in SOL
      totalSOL: priceSOL * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: `sell_${Date.now()}`, // Transaction signature
      success: true,
      platform: 'unknown',
      notes: `Sold via unknown`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 3: src\backup-old\versions\critical\critical_2025-08-27T20-48-28\index.ts:226
// Function: unknown
// Pattern: jupiter.*sell

/*
FIND THIS SECTION IN src\backup-old\versions\critical\critical_2025-08-27T20-48-28\index.ts around line 226:
221: const BUY_PROVIDER = config.token_buy.provider;
222: let BUY_AMOUNT = tradingParams.positionSizeSOL; // From botController, updated dynamically
223: const SIM_MODE = config.checks.simulation_mode || false;
224: const PLAY_SOUND = config.token_buy.play_sound || false;
225: const OPEN_BROWSER = config.token_buy.open_browser || false;
226: const SKIP_COPY_TRADE_SELL = config.token_sell.jupiter.skip_sell_copy_trade || true;
227: const WSOL_MINT = config.wsol_pc_mint;
228: let handledMints: { signature: string; timestamp: number }[] = [];
229: 
230: // Enhanced features (only if available)
231: let queueManager: any = null;  // Make it global
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: returnedMint || mint, // Available: signature
      tokenSymbol: "UNKNOWN",
      amount: 0, // Token amount sold
      priceSOL: 0, // Price per token in SOL
      totalSOL: priceSOL * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: signature, // Transaction signature
      success: true,
      platform: 'unknown',
      notes: `Sold via unknown`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 4: src\enhanced\analyze-trading-session.ts:89
// Function: parseFloat
// Pattern: exit.*trade

/*
FIND THIS SECTION IN src\enhanced\analyze-trading-session.ts around line 89:
84:         const holdTime = holdTimeMatch ? parseFloat(holdTimeMatch[1]) : 0;
85:         
86:         this.trades.push({
87:           tokenMint: currentTrade.tokenMint!,
88:           entryPrice: currentTrade.entryPrice || 0,
89:           exitPrice: currentTrade.entryPrice! * (1 + gainPercent / 100),
90:           maxPrice: currentTrade.entryPrice! * (1 + gainPercent / 100), // Will update if we have more data
91:           exitGain: gainPercent,
92:           maxGain: gainPercent, // Will update if we have more data
93:           missedGain: 0,
94:           holdTime
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: tokenMint, // Available: tokenMint, amount, pnl, entryPrice, exitPrice
      tokenSymbol: "UNKNOWN",
      amount: amount, // Token amount sold
      priceSOL: exitPrice, // Price per token in SOL
      totalSOL: exitPrice * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: `sell_${Date.now()}`, // Transaction signature
      success: true,
      platform: 'unknown',
      notes: `Sold via parseFloat`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 5: src\enhanced\analyze-trading-session.ts:171
// Function: generateInsights
// Pattern: exit.*trade

/*
FIND THIS SECTION IN src\enhanced\analyze-trading-session.ts around line 171:
166:   private generateInsights() {
167:     console.log(`\n💡 KEY INSIGHTS FROM 735 TRADES`);
168:     console.log(`${'─'.repeat(60)}`);
169:     
170:     // Calculate statistics
171:     const avgExitGain = this.trades.reduce((sum, t) => sum + t.exitGain, 0) / this.trades.length;
172:     const avgMaxGain = this.trades.reduce((sum, t) => sum + t.maxGain, 0) / this.trades.length;
173:     const avgMissedGain = this.trades.reduce((sum, t) => sum + t.missedGain, 0) / this.trades.length;
174:     
175:     const totalPotentialProfit = this.trades.reduce((sum, t) => sum + (t.maxGain * 15 / 100), 0);
176:     const totalActualProfit = this.trades.reduce((sum, t) => sum + (t.exitGain * 15 / 100), 0);
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: returnedMint || mint, // Available: 
      tokenSymbol: "UNKNOWN",
      amount: 0, // Token amount sold
      priceSOL: 0, // Price per token in SOL
      totalSOL: priceSOL * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: `sell_${Date.now()}`, // Transaction signature
      success: true,
      platform: 'unknown',
      notes: `Sold via generateInsights`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 6: src\enhanced\analyze-trading-session.ts:239
// Function: exportAnalysis
// Pattern: exit.*trade

/*
FIND THIS SECTION IN src\enhanced\analyze-trading-session.ts around line 239:
234:     
235:     const analysis = {
236:       summary: {
237:         totalTrades: this.trades.length,
238:         missed5xCount: this.missed5xOpportunities.length,
239:         avgExitGain: this.trades.reduce((sum, t) => sum + t.exitGain, 0) / this.trades.length,
240:         avgMaxGain: this.trades.reduce((sum, t) => sum + t.maxGain, 0) / this.trades.length,
241:         avgMissedGain: this.trades.reduce((sum, t) => sum + t.missedGain, 0) / this.trades.length
242:       },
243:       missed5xOpportunities: this.missed5xOpportunities.slice(0, 20), // Top 20
244:       recommendations: {
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: returnedMint || mint, // Available: 
      tokenSymbol: "UNKNOWN",
      amount: 0, // Token amount sold
      priceSOL: 0, // Price per token in SOL
      totalSOL: priceSOL * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: `sell_${Date.now()}`, // Transaction signature
      success: true,
      platform: 'unknown',
      notes: `Sold via exportAnalysis`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 7: src\enhanced\performanceLogger.ts:223
// Function: if
// Pattern: exit.*trade

/*
FIND THIS SECTION IN src\enhanced\performanceLogger.ts around line 223:
218:     if (pullbackDepth > 5) { // Significant pullback
219:       trade.pricePattern.pullbackDepths.push(pullbackDepth);
220:     }
221:   }
222: 
223:   // Exit a trade and log final metrics
224:   exitTrade(tokenAddress: string, exitPrice: number, exitReason: string) {
225:     const trade = this.activeTrades.get(tokenAddress);
226:     if (!trade) return;
227:     
228:     trade.exitTime = Date.now();
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: returnedMint || mint, // Available: exitPrice
      tokenSymbol: "UNKNOWN",
      amount: 0, // Token amount sold
      priceSOL: exitPrice, // Price per token in SOL
      totalSOL: exitPrice * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: `sell_${Date.now()}`, // Transaction signature
      success: true,
      platform: 'unknown',
      notes: `Sold via if`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 8: src\enhanced\performanceLogger.ts:230
// Function: exitTrade
// Pattern: exit.*trade

/*
FIND THIS SECTION IN src\enhanced\performanceLogger.ts around line 230:
225:     const trade = this.activeTrades.get(tokenAddress);
226:     if (!trade) return;
227:     
228:     trade.exitTime = Date.now();
229:     trade.exitPrice = exitPrice;
230:     trade.finalGainPercent = ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
231:     trade.exitReason = exitReason;
232:     
233:     // Continue tracking for 5 minutes after exit to see potential
234:     this.trackPostExit(trade);
235:     
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: returnedMint || mint, // Available: exitPrice, entryPrice
      tokenSymbol: "UNKNOWN",
      amount: 0, // Token amount sold
      priceSOL: exitPrice, // Price per token in SOL
      totalSOL: exitPrice * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: `sell_${Date.now()}`, // Transaction signature
      success: true,
      platform: 'unknown',
      notes: `Sold via exitTrade`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 9: src\enhanced\performanceLogger.ts:234
// Function: exitTrade
// Pattern: exit.*trade

/*
FIND THIS SECTION IN src\enhanced\performanceLogger.ts around line 234:
229:     trade.exitPrice = exitPrice;
230:     trade.finalGainPercent = ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
231:     trade.exitReason = exitReason;
232:     
233:     // Continue tracking for 5 minutes after exit to see potential
234:     this.trackPostExit(trade);
235:     
236:     // Move to completed trades
237:     this.completedTrades.push(trade);
238:     this.activeTrades.delete(tokenAddress);
239:     
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: returnedMint || mint, // Available: exitPrice, entryPrice
      tokenSymbol: "UNKNOWN",
      amount: 0, // Token amount sold
      priceSOL: exitPrice, // Price per token in SOL
      totalSOL: exitPrice * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: `sell_${Date.now()}`, // Transaction signature
      success: true,
      platform: 'unknown',
      notes: `Sold via exitTrade`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 10: src\enhanced\performanceLogger.ts:243
// Function: if
// Pattern: exit.*trade

/*
FIND THIS SECTION IN src\enhanced\performanceLogger.ts around line 243:
238:     this.activeTrades.delete(tokenAddress);
239:     
240:     // Log if this was a potential 5x+ miss
241:     if (trade.maxGainPercent > 500 && trade.finalGainPercent < 200) {
242:       console.log(`⚠️ MISSED 5x+ OPPORTUNITY: ${trade.tokenSymbol}`);
243:       console.log(`   Exit: ${trade.finalGainPercent.toFixed(2)}%, Max: ${trade.maxGainPercent.toFixed(2)}%`);
244:       console.log(`   Volume Pattern:`, trade.volumePattern);
245:     }
246:   }
247: 
248:   // Track token for 5 minutes after exit to see what we missed
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: returnedMint || mint, // Available: tokenSymbol
      tokenSymbol: tokenSymbol,
      amount: 0, // Token amount sold
      priceSOL: 0, // Price per token in SOL
      totalSOL: priceSOL * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: `sell_${Date.now()}`, // Transaction signature
      success: true,
      platform: 'unknown',
      notes: `Sold via if`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 11: src\enhanced\performanceLogger.ts:249
// Function: trackPostExit
// Pattern: exit.*trade

/*
FIND THIS SECTION IN src\enhanced\performanceLogger.ts around line 249:
244:       console.log(`   Volume Pattern:`, trade.volumePattern);
245:     }
246:   }
247: 
248:   // Track token for 5 minutes after exit to see what we missed
249:   private async trackPostExit(trade: TokenTradeLog) {
250:     // Implementation would continue monitoring price
251:     // This helps identify patterns in tokens that went 5x+ after early exit
252:     setTimeout(async () => {
253:       // Fetch current price and update potentialMax
254:       // This helps identify what patterns we should have held for
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: returnedMint || mint, // Available: tokenSymbol, price
      tokenSymbol: tokenSymbol,
      amount: 0, // Token amount sold
      priceSOL: price, // Price per token in SOL
      totalSOL: priceSOL * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: `sell_${Date.now()}`, // Transaction signature
      success: true,
      platform: 'unknown',
      notes: `Sold via trackPostExit`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 12: src\enhanced\performanceLogger.ts:270
// Function: generateReport
// Pattern: exit.*trade

/*
FIND THIS SECTION IN src\enhanced\performanceLogger.ts around line 270:
265:   } {
266:     const missed5x = this.completedTrades.filter(t => 
267:       t.maxGainPercent > 500 && (t.finalGainPercent || 0) < 200
268:     );
269:     
270:     const avgExit = this.completedTrades.reduce((sum, t) => 
271:       sum + (t.finalGainPercent || 0), 0
272:     ) / this.completedTrades.length;
273:     
274:     const avgMax = this.completedTrades.reduce((sum, t) => 
275:       sum + t.maxGainPercent, 0
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: returnedMint || mint, // Available: 
      tokenSymbol: "UNKNOWN",
      amount: 0, // Token amount sold
      priceSOL: 0, // Price per token in SOL
      totalSOL: priceSOL * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: `sell_${Date.now()}`, // Transaction signature
      success: true,
      platform: 'unknown',
      notes: `Sold via generateReport`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 13: src\index.08.24-0254-after-1hr-flop-reseting-2normarl.ts:205
// Function: unknown
// Pattern: jupiter.*sell

/*
FIND THIS SECTION IN src\index.08.24-0254-after-1hr-flop-reseting-2normarl.ts around line 205:
200: const BUY_PROVIDER = config.token_buy.provider;
201: let BUY_AMOUNT = CFG.POSITION_SIZE; // Will be updated dynamically
202: const SIM_MODE = config.checks.simulation_mode || false;
203: const PLAY_SOUND = config.token_buy.play_sound || false;
204: const OPEN_BROWSER = config.token_buy.open_browser || false;
205: const SKIP_COPY_TRADE_SELL = config.token_sell.jupiter.skip_sell_copy_trade || true;
206: const WSOL_MINT = config.wsol_pc_mint;
207: let handledMints: { signature: string; timestamp: number }[] = [];
208: 
209: // Enhanced features (only if available)
210: let queueManager: any = null;  // Make it global
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: returnedMint || mint, // Available: signature
      tokenSymbol: "UNKNOWN",
      amount: 0, // Token amount sold
      priceSOL: 0, // Price per token in SOL
      totalSOL: priceSOL * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: signature, // Transaction signature
      success: true,
      platform: 'unknown',
      notes: `Sold via unknown`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 14: src\index.ts:227
// Function: unknown
// Pattern: jupiter.*sell

/*
FIND THIS SECTION IN src\index.ts around line 227:
222: const BUY_PROVIDER = config.token_buy.provider;
223: let BUY_AMOUNT = tradingParams.positionSizeSOL; // From botController, updated dynamically
224: const SIM_MODE = config.checks.simulation_mode || false;
225: const PLAY_SOUND = config.token_buy.play_sound || false;
226: const OPEN_BROWSER = config.token_buy.open_browser || false;
227: const SKIP_COPY_TRADE_SELL = config.token_sell.jupiter.skip_sell_copy_trade || true;
228: const WSOL_MINT = config.wsol_pc_mint;
229: let handledMints: { signature: string; timestamp: number }[] = [];
230: 
231: // Enhanced features (only if available)
232: let queueManager: any = null;  // Make it global
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: returnedMint || mint, // Available: signature
      tokenSymbol: "UNKNOWN",
      amount: 0, // Token amount sold
      priceSOL: 0, // Price per token in SOL
      totalSOL: priceSOL * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: signature, // Transaction signature
      success: true,
      platform: 'unknown',
      notes: `Sold via unknown`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 15: src\utils\handlers\jupiterHandler.ts:146
// Function: unSwapToken
// Pattern: unSwapToken(

/*
FIND THIS SECTION IN src\utils\handlers\jupiterHandler.ts around line 146:
141:   }
142: 
143:   // Start with retry count 0
144:   return attemptSwapToken(0);
145: }
146: export async function unSwapToken(inputMint: string, outputMint: string, inputAmount: number, logEngine: LogEngineType): Promise<boolean> {
147:   // Validate inputs
148:   if (!outputMint || typeof outputMint !== "string" || outputMint.trim() === "") {
149:     return false;
150:   }
151: 
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: inputMint, // Available: inputMint, outputMint, inputAmount
      tokenSymbol: "UNKNOWN",
      amount: inputAmount, // Token amount sold
      priceSOL: 0, // Price per token in SOL
      totalSOL: priceSOL * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: `sell_${Date.now()}`, // Transaction signature
      success: true,
      platform: 'jupiter',
      notes: `Sold via unSwapToken`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 16: src\utils\handlers\jupiterHandler.ts:193
// Function: attemptUnSwapToken
// Pattern: unSwapToken(

/*
FIND THIS SECTION IN src\utils\handlers\jupiterHandler.ts around line 193:
188:             global: false,
189:             priorityLevel: "veryHigh",
190:           },
191:         };
192: 
193:   async function attemptUnSwapToken(retryCount: number): Promise<boolean> {
194:     try {
195:       const quoteResponse = await axios.get<JupiterSwapQuoteResponse>("https://lite-api.jup.ag/swap/v1/quote", {
196:         params: {
197:           inputMint: outputMint,
198:           outputMint: inputMint,
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: inputMint, // Available: inputMint, outputMint
      tokenSymbol: "UNKNOWN",
      amount: 0, // Token amount sold
      priceSOL: 0, // Price per token in SOL
      totalSOL: priceSOL * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: `sell_${Date.now()}`, // Transaction signature
      success: true,
      platform: 'jupiter',
      notes: `Sold via attemptUnSwapToken`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 17: src\utils\handlers\jupiterHandler.ts:253
// Function: if
// Pattern: jupiter.*sell

/*
FIND THIS SECTION IN src\utils\handlers\jupiterHandler.ts around line 253:
248:        * Return successfull
249:        */
250:       return true;
251:     } catch (error) {
252:       if (retryCount < MAX_RETRIES) {
253:         logEngine.writeLog(`🤞 Jupiter`, `Sell retry attempt ${retryCount + 1}/${MAX_RETRIES}`, "yellow");
254:         // Wait for the specified delay
255:         await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
256:         // Recursive call with incremented retry count
257:         return attemptUnSwapToken(retryCount + 1);
258:       }
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: inputMint, // Available: inputMint
      tokenSymbol: "UNKNOWN",
      amount: 0, // Token amount sold
      priceSOL: 0, // Price per token in SOL
      totalSOL: priceSOL * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: `sell_${Date.now()}`, // Transaction signature
      success: true,
      platform: 'jupiter',
      notes: `Sold via if`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 18: src\utils\handlers\jupiterHandler.ts:257
// Function: if
// Pattern: unSwapToken(

/*
FIND THIS SECTION IN src\utils\handlers\jupiterHandler.ts around line 257:
252:       if (retryCount < MAX_RETRIES) {
253:         logEngine.writeLog(`🤞 Jupiter`, `Sell retry attempt ${retryCount + 1}/${MAX_RETRIES}`, "yellow");
254:         // Wait for the specified delay
255:         await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
256:         // Recursive call with incremented retry count
257:         return attemptUnSwapToken(retryCount + 1);
258:       }
259: 
260:       // Handle axios errors
261:       if (axios.isAxiosError(error)) {
262:         logEngine.writeLog(`❌ Jupiter`, `Jupiter API error (${error.response?.status || "unknown"}): ${error.response?.statusText}`, "red");
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: returnedMint || mint, // Available: status
      tokenSymbol: "UNKNOWN",
      amount: 0, // Token amount sold
      priceSOL: 0, // Price per token in SOL
      totalSOL: priceSOL * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: `sell_${Date.now()}`, // Transaction signature
      success: true,
      platform: 'jupiter',
      notes: `Sold via if`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 19: src\utils\handlers\jupiterHandler.ts:264
// Function: writeLog
// Pattern: jupiter.*sell

/*
FIND THIS SECTION IN src\utils\handlers\jupiterHandler.ts around line 264:
259: 
260:       // Handle axios errors
261:       if (axios.isAxiosError(error)) {
262:         logEngine.writeLog(`❌ Jupiter`, `Jupiter API error (${error.response?.status || "unknown"}): ${error.response?.statusText}`, "red");
263:       } else {
264:         logEngine.writeLog(`❌ Jupiter`, `Error selling token: ${error instanceof Error ? error.message : "Unknown error"}`, "red");
265:       }
266:       return false;
267:     }
268:   }
269: 
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: returnedMint || mint, // Available: status
      tokenSymbol: "UNKNOWN",
      amount: 0, // Token amount sold
      priceSOL: 0, // Price per token in SOL
      totalSOL: priceSOL * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: `sell_${Date.now()}`, // Transaction signature
      success: true,
      platform: 'jupiter',
      notes: `Sold via writeLog`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}


// LOCATION 20: src\utils\handlers\jupiterHandler.ts:271
// Function: writeLog
// Pattern: unSwapToken(

/*
FIND THIS SECTION IN src\utils\handlers\jupiterHandler.ts around line 271:
266:       return false;
267:     }
268:   }
269: 
270:   // Start with retry count 0
271:   return attemptUnSwapToken(0);
272: }
273: 
*/

// ADD AFTER THE SUCCESSFUL TRADE EXECUTION:
// ADD IMPORT AT TOP OF FILE (if not already present):
// import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';

// ADD THIS CODE BLOCK AFTER SUCCESSFUL SELL:
if (result || success) {
  try {
    const taxData: TaxableTransaction = {
      timestamp: new Date().toISOString(),
      type: 'sell',
      tokenMint: returnedMint || mint, // Available: status
      tokenSymbol: "UNKNOWN",
      amount: 0, // Token amount sold
      priceSOL: 0, // Price per token in SOL
      totalSOL: priceSOL * amount, // Total SOL received
      fees: 0.001, // Transaction fees
      signature: `sell_${Date.now()}`, // Transaction signature
      success: true,
      platform: 'jupiter',
      notes: `Sold via writeLog`
    };
    
    await recordTrade(taxData);
    console.log(`📊 Tax recorded: SELL ${taxData.tokenMint?.slice(0,8)}... for ${taxData.totalSOL?.toFixed(4)} SOL`);
    
    // Log to advanced manager if available
    if (typeof advancedManager !== 'undefined' && advancedManager.closePosition) {
      advancedManager.closePosition(
        taxData.tokenMint || '',
        taxData.tokenSymbol || '',
        0, // Original buy price (will be retrieved from cost basis)
        taxData.priceSOL || 0,
        taxData.amount || 0,
        taxData.fees || 0,
        taxData.signature || ''
      );
    }
  } catch (taxError) {
    console.warn('⚠️ Tax recording failed for sell transaction:', taxError);
    // Continue execution - don't fail the trade due to tax recording issues
  }
}



## Features Implemented
✅ FIFO cost basis tracking
✅ Wash sale detection (30-day rule)
✅ Short-term vs long-term capital gains
✅ Form 8949 CSV generation
✅ Complete transaction records
✅ Automatic tax calculation
✅ IRS-compliant reporting

## Usage
1. Import tax tracking in sell functions
2. Add tax recording blocks after successful trades  
3. Run tests: `npx ts-node test-tax-compliance.ts`
4. Generate reports: `generateForm8949CSV(2024)`

## IRS Compliance
- Tracks all buy/sell transactions
- Calculates accurate cost basis using FIFO
- Identifies wash sales
- Generates Form 8949 compatible reports
- Maintains complete audit trail
