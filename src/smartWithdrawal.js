/**
 * Smart Withdrawal Manager for SOL-BOT
 * Maintains $7K security threshold while ensuring accurate tax compliance
 */

const fs = require('fs');
const path = require('path');

class SmartWithdrawalManager {
  constructor() {
    this.POOL_THRESHOLD = 7000;  // Security threshold
    this.TAX_RATE = 0.40;
    this.withdrawalLog = path.join('wallets', 'withdrawals.jsonl');
  }

  parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const parts = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current.trim());
      return parts;
    });
  }

  calculateWithdrawal(currentPoolValue, totalInvested, totalProfit) {
    console.log(`\n=== Withdrawal Analysis ===`);
    console.log(`Current Pool: $${currentPoolValue.toFixed(2)}`);
    console.log(`Total Invested: $${totalInvested.toFixed(2)}`);
    console.log(`Total Profit: $${totalProfit.toFixed(2)}`);
    console.log(`Threshold: $${this.POOL_THRESHOLD}`);

    // Only withdraw if pool exceeds threshold
    if (currentPoolValue <= this.POOL_THRESHOLD) {
      console.log(`✓ Pool below threshold - no withdrawal needed`);
      return null;
    }

    // Can't withdraw if no profit
    if (totalProfit <= 0) {
      console.log(`✗ No profit to withdraw`);
      return null;
    }

    // Calculate how much to withdraw (excess above threshold)
    const excessAmount = currentPoolValue - this.POOL_THRESHOLD;
    const profitToWithdraw = Math.min(totalProfit, excessAmount);
    
    const taxAmount = profitToWithdraw * this.TAX_RATE;
    const hardwareAmount = profitToWithdraw * (1 - this.TAX_RATE);

    console.log(`\n💰 Withdrawal Triggered:`);
    console.log(`   Withdrawing: ${profitToWithdraw.toFixed(2)}`);
    console.log(`   To Hardware (60%): ${hardwareAmount.toFixed(2)}`);
    console.log(`   To Taxes (40%): ${taxAmount.toFixed(2)}`);
    console.log(`   Keeping in Pool: ${(currentPoolValue - profitToWithdraw).toFixed(2)}`);

    return {
      timestamp: new Date().toISOString(),
      poolBefore: parseFloat(currentPoolValue.toFixed(2)),
      toHardware: parseFloat(hardwareAmount.toFixed(2)),
      toTaxes: parseFloat(taxAmount.toFixed(2)),
      keepTrading: parseFloat((currentPoolValue - profitToWithdraw).toFixed(2)),
      totalWithdrawn: parseFloat(profitToWithdraw.toFixed(2)),
      profit: parseFloat(totalProfit.toFixed(2)),
      trigger: 'POOL_THRESHOLD_EXCEEDED',
      threshold: this.POOL_THRESHOLD
    };
  }

  async analyzePool() {
    const poolPath = path.join('data', 'pool_transactions.csv');
    
    if (!fs.existsSync(poolPath)) {
      console.error('❌ pool_transactions.csv not found');
      return null;
    }

    const poolData = fs.readFileSync(poolPath, 'utf8');
    const transactions = this.parseCSV(poolData);
    
    let totalBuys = 0;
    let totalSells = 0;
    let lastPoolValue = 0;
    
    transactions.forEach(row => {
      if (!row || row.length < 7) return;
      
      const [timestamp, type, amount, poolValue] = row;
      
      if (type === 'trade_execution' && parseFloat(amount) < 0) {
        totalBuys += Math.abs(parseFloat(amount));
      }
      
      if (type === 'profit_return' && parseFloat(amount) > 0) {
        totalSells += parseFloat(amount);
      }
      
      if (poolValue && !isNaN(parseFloat(poolValue))) {
        lastPoolValue = parseFloat(poolValue);
      }
    });

    const totalProfit = totalSells - totalBuys;
    const currentPoolValue = lastPoolValue || (totalBuys + totalProfit);
    
    return this.calculateWithdrawal(currentPoolValue, totalBuys, totalProfit);
  }

  async checkAndWithdraw() {
    const withdrawal = await this.analyzePool();
    
    if (withdrawal) {
      // Create wallets directory if it doesn't exist
      const walletsDir = path.join('wallets');
      if (!fs.existsSync(walletsDir)) {
        fs.mkdirSync(walletsDir);
      }
      
      // Log the withdrawal
      fs.appendFileSync(this.withdrawalLog, JSON.stringify(withdrawal) + '\n');
      console.log('\n✅ Withdrawal logged to wallets/withdrawals.jsonl');
      
      return withdrawal;
    }
    
    return null;
  }
}

// Run if called directly
if (require.main === module) {
  const manager = new SmartWithdrawalManager();
  manager.checkAndWithdraw().then(result => {
    if (!result) {
      console.log('\n📊 No withdrawal needed at this time');
    }
  });
}

module.exports = SmartWithdrawalManager;