import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { parse } from 'csv-parse/sync';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

interface TradeData {
  timestamp: string;
  tokenMint: string;
  action: 'BUY' | 'SELL';
  amount: number;
  price: number;
  profit?: number;
  multiplier?: number;
}

interface PoolTransaction {
  timestamp: string;
  type: string;
  amount: number;
  currentPool: number;
  description: string;
}

class PoolCalculator {
  private trades: TradeData[] = [];
  private poolTransactions: PoolTransaction[] = [];
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  private async question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }

  private loadCSVData(filePath: string): any[] {
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`${colors.yellow}Warning: ${filePath} not found${colors.reset}`);
        return [];
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      return parse(fileContent, {
        columns: true,
        skip_empty_lines: true
      });
    } catch (error) {
      console.log(`${colors.red}Error reading ${filePath}: ${error}${colors.reset}`);
      return [];
    }
  }

  private loadTradeData(): void {
    console.log(`\n${colors.cyan}Loading trade data...${colors.reset}`);
    
    // Try multiple possible file locations
    const possiblePaths = [
      './data/pool_transactions.csv',
      './data/completed_trades.csv',
      './data/performance_log.csv',
      './pool_transactions.csv',
      './completed_trades.csv',
      './performance_log.csv'
    ];

    for (const filePath of possiblePaths) {
      const data = this.loadCSVData(filePath);
      if (data.length > 0) {
        console.log(`${colors.green}✓ Loaded ${data.length} records from ${filePath}${colors.reset}`);
        
        // Parse based on file type
        if (filePath.includes('pool_transactions')) {
          this.poolTransactions = data;
        } else {
          // Convert to trade format
          data.forEach(row => {
            if (row.profit && row.multiplier) {
              this.trades.push({
                timestamp: row.timestamp || new Date().toISOString(),
                tokenMint: row.tokenMint || row.token || 'unknown',
                action: parseFloat(row.profit) > 0 ? 'SELL' : 'BUY',
                amount: parseFloat(row.amount || '15'),
                price: parseFloat(row.price || '0'),
                profit: parseFloat(row.profit || '0'),
                multiplier: parseFloat(row.multiplier || '1')
              });
            }
          });
        }
      }
    }

    // Generate sample data if no real data found
    if (this.trades.length === 0 && this.poolTransactions.length === 0) {
      console.log(`${colors.yellow}No trade data found. Generating sample data for demonstration...${colors.reset}`);
      this.generateSampleData();
    }
  }

  private generateSampleData(): void {
    // Based on your actual performance: 76.9% win rate
    const winRate = 0.769;
    const numTrades = 100;
    
    for (let i = 0; i < numTrades; i++) {
      const isWin = Math.random() < winRate;
      const buyAmount = 15; // $15 per trade
      
      let multiplier = 1;
      let profit = 0;
      
      if (isWin) {
        // Winning trades: 2x to 6x
        const rand = Math.random();
        if (rand < 0.5) multiplier = 2;
        else if (rand < 0.75) multiplier = 3;
        else if (rand < 0.9) multiplier = 4;
        else if (rand < 0.95) multiplier = 5;
        else multiplier = 6;
        
        profit = buyAmount * (multiplier - 1);
      } else {
        // Losing trades: -50% to -100%
        multiplier = 0.5 - (Math.random() * 0.5);
        profit = -buyAmount * (1 - multiplier);
      }
      
      this.trades.push({
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        tokenMint: `token_${i}`,
        action: 'SELL',
        amount: buyAmount,
        price: 0,
        profit: profit,
        multiplier: multiplier
      });
    }
  }

  private calculateReturns(initialPool: number, targetPool: number): {
    finalPool: number;
    totalProfit: number;
    roi: number;
    numTrades: number;
    winRate: number;
    avgMultiplier: number;
    projectedTimeToTarget: number;
  } {
    let currentPool = initialPool;
    let totalProfit = 0;
    let numWins = 0;
    let totalMultiplier = 0;
    let validTrades = 0;
    
    // Position size is typically 1.5% of pool or $15 minimum
    for (const trade of this.trades) {
      if (trade.profit !== undefined) {
        const positionSize = Math.max(15, currentPool * 0.015);
        const scaledProfit = (trade.profit / 15) * positionSize;
        
        currentPool += scaledProfit;
        totalProfit += scaledProfit;
        
        if (trade.profit > 0) numWins++;
        if (trade.multiplier) {
          totalMultiplier += trade.multiplier;
          validTrades++;
        }
        
        // Stop if we hit target
        if (currentPool >= targetPool) break;
      }
    }
    
    const winRate = this.trades.filter(t => t.profit && t.profit > 0).length / this.trades.length;
    const avgMultiplier = validTrades > 0 ? totalMultiplier / validTrades : 1;
    const dailyGrowthRate = totalProfit / initialPool / Math.max(1, this.trades.length / 100);
    const projectedTimeToTarget = dailyGrowthRate > 0 ? 
      Math.log(targetPool / initialPool) / Math.log(1 + dailyGrowthRate) : 999;
    
    return {
      finalPool: currentPool,
      totalProfit: totalProfit,
      roi: (totalProfit / initialPool) * 100,
      numTrades: this.trades.length,
      winRate: winRate,
      avgMultiplier: avgMultiplier,
      projectedTimeToTarget: projectedTimeToTarget
    };
  }

  public async run(): Promise<void> {
    console.log(`${colors.bright}${colors.cyan}
╔════════════════════════════════════════════╗
║     SOL-BOT Pool Calculator v1.0          ║
║   Estimate Returns Based on Past Data     ║
╚════════════════════════════════════════════╝${colors.reset}`);

    // Load trade data
    this.loadTradeData();
    
    console.log(`\n${colors.green}Data Summary:${colors.reset}`);
    console.log(`• Total trades loaded: ${this.trades.length}`);
    console.log(`• Pool transactions: ${this.poolTransactions.length}`);
    
    if (this.trades.length > 0) {
      const wins = this.trades.filter(t => t.profit && t.profit > 0).length;
      console.log(`• Win rate: ${((wins / this.trades.length) * 100).toFixed(1)}%`);
    }

    // Get user inputs
    console.log(`\n${colors.yellow}Enter your simulation parameters:${colors.reset}`);
    
    const initialPoolStr = await this.question(`${colors.cyan}Initial Pool Amount ($): ${colors.reset}`);
    const initialPool = parseFloat(initialPoolStr) || 1000;
    
    const targetPoolStr = await this.question(`${colors.cyan}Target Pool Amount ($): ${colors.reset}`);
    const targetPool = parseFloat(targetPoolStr) || 100000;
    
    const reinvestPercentStr = await this.question(`${colors.cyan}% of Target Pool for next session (0-100): ${colors.reset}`);
    const reinvestPercent = parseFloat(reinvestPercentStr) || 10;

    // Calculate returns
    console.log(`\n${colors.bright}${colors.green}═══════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}CALCULATING PROJECTIONS...${colors.reset}`);
    console.log(`${colors.green}═══════════════════════════════════════${colors.reset}\n`);

    // Session 1 calculations
    const session1 = this.calculateReturns(initialPool, targetPool);
    
    console.log(`${colors.bright}📊 SESSION 1 PROJECTION:${colors.reset}`);
    console.log(`├─ Initial Pool: ${colors.green}$${initialPool.toFixed(2)}${colors.reset}`);
    console.log(`├─ Final Pool: ${colors.bright}${colors.green}$${session1.finalPool.toFixed(2)}${colors.reset}`);
    console.log(`├─ Total Profit: ${session1.totalProfit >= 0 ? colors.green : colors.red}$${session1.totalProfit.toFixed(2)}${colors.reset}`);
    console.log(`├─ ROI: ${session1.roi >= 0 ? colors.green : colors.red}${session1.roi.toFixed(1)}%${colors.reset}`);
    console.log(`├─ Win Rate: ${colors.cyan}${(session1.winRate * 100).toFixed(1)}%${colors.reset}`);
    console.log(`├─ Avg Multiplier: ${colors.cyan}${session1.avgMultiplier.toFixed(2)}x${colors.reset}`);
    console.log(`└─ Est. Days to Target: ${colors.yellow}${session1.projectedTimeToTarget.toFixed(1)} days${colors.reset}`);

    // Tax calculation (40% reserve)
    const taxReserve = session1.totalProfit * 0.4;
    const afterTaxProfit = session1.totalProfit * 0.6;
    
    console.log(`\n${colors.bright}💰 TAX CONSIDERATIONS:${colors.reset}`);
    console.log(`├─ Tax Reserve (40%): ${colors.yellow}$${taxReserve.toFixed(2)}${colors.reset}`);
    console.log(`└─ After-Tax Profit: ${colors.green}$${afterTaxProfit.toFixed(2)}${colors.reset}`);

    // Session 2 calculations (reinvestment)
    const reinvestAmount = (session1.finalPool * reinvestPercent) / 100;
    const session2 = this.calculateReturns(reinvestAmount, targetPool);
    
    console.log(`\n${colors.bright}🔄 SESSION 2 PROJECTION (${reinvestPercent}% Reinvestment):${colors.reset}`);
    console.log(`├─ Reinvest Amount: ${colors.green}$${reinvestAmount.toFixed(2)}${colors.reset}`);
    console.log(`├─ Projected Final: ${colors.bright}${colors.green}$${session2.finalPool.toFixed(2)}${colors.reset}`);
    console.log(`├─ Projected Profit: ${session2.totalProfit >= 0 ? colors.green : colors.red}$${session2.totalProfit.toFixed(2)}${colors.reset}`);
    console.log(`└─ Projected ROI: ${session2.roi >= 0 ? colors.green : colors.red}${session2.roi.toFixed(1)}%${colors.reset}`);

    // Compound projections
    console.log(`\n${colors.bright}📈 COMPOUND GROWTH PROJECTIONS:${colors.reset}`);
    let compoundPool = initialPool;
    for (let i = 1; i <= 5; i++) {
      compoundPool *= (1 + session1.roi / 100);
      console.log(`├─ After ${i} session(s): ${colors.green}$${compoundPool.toFixed(2)}${colors.reset}`);
    }

    // Different initial amounts comparison
    console.log(`\n${colors.bright}🔍 COMPARISON WITH DIFFERENT INITIAL POOLS:${colors.reset}`);
    const testAmounts = [500, 1000, 2500, 5000, 10000];
    
    for (const amount of testAmounts) {
      const result = this.calculateReturns(amount, targetPool);
      const marker = amount === initialPool ? ' ← YOUR CHOICE' : '';
      console.log(`├─ $${amount}: Final ${colors.green}$${result.finalPool.toFixed(2)}${colors.reset} (${result.roi.toFixed(1)}% ROI)${colors.yellow}${marker}${colors.reset}`);
    }

    // Risk assessment
    console.log(`\n${colors.bright}⚠️  RISK ASSESSMENT:${colors.reset}`);
    const riskLevel = initialPool > 5000 ? 'HIGH' : initialPool > 2000 ? 'MEDIUM' : 'LOW';
    const riskColor = riskLevel === 'HIGH' ? colors.red : riskLevel === 'MEDIUM' ? colors.yellow : colors.green;
    console.log(`├─ Risk Level: ${riskColor}${riskLevel}${colors.reset}`);
    console.log(`├─ Max Drawdown Risk: ${colors.red}$${(initialPool * 0.3).toFixed(2)}${colors.reset} (30% typical)`);
    console.log(`└─ Recommended Stop Loss: ${colors.yellow}$${(initialPool * 0.8).toFixed(2)}${colors.reset}`);

    // Save results
    const results = {
      timestamp: new Date().toISOString(),
      initialPool,
      targetPool,
      reinvestPercent,
      session1Results: session1,
      session2Projection: session2,
      taxReserve,
      afterTaxProfit
    };
    
    const resultsPath = './data/pool_calculations.json';
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n${colors.green}✓ Results saved to ${resultsPath}${colors.reset}`);

    this.rl.close();
  }
}

// Run the calculator
const calculator = new PoolCalculator();
calculator.run().catch(error => {
  console.error(`${colors.red}Error: ${error}${colors.reset}`);
  process.exit(1);
});