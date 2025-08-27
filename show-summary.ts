// show-summary.ts - Display session summary without stopping bot
import * as fs from 'fs';
import * as path from 'path';

async function displaySessionSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 CURRENT SESSION SUMMARY (Bot Still Running)');
  console.log('='.repeat(60));
  
  try {
    // Read pool transactions
    if (fs.existsSync('./data/pool_transactions.csv')) {
      const csv = fs.readFileSync('./data/pool_transactions.csv', 'utf8');
      const lines = csv.split('\n').filter(l => l.length > 0);
      
      // Find last pool status
      let currentPool = 600; // default
      let totalTrades = 0;
      
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes('pool_status') || lines[i].includes('trade_execution')) {
          const parts = lines[i].split(',');
          if (parts[4]) {
            currentPool = parseFloat(parts[4]) || currentPool;
            if (parts[5]) {
              totalTrades = parseInt(parts[5]) || totalTrades;
            }
            break;
          }
        }
      }
      
      const pnl = currentPool - 600;
      const roi = ((pnl / 600) * 100).toFixed(2);
      
      console.log(`\n   💰 POOL STATUS:`);
      console.log(`   ├─ Initial: $600.00`);
      console.log(`   ├─ Current: $${currentPool.toFixed(2)}`);
      console.log(`   ├─ P&L: ${pnl >= 0 ? '🟢' : '🔴'} $${Math.abs(pnl).toFixed(2)}`);
      console.log(`   ├─ ROI: ${roi}%`);
      console.log(`   └─ Total Trades: ${totalTrades}`);
    } else {
      console.log('   ⚠️ No pool transaction file found');
    }
    
    // Read pending tokens for token stats
    if (fs.existsSync('./data/pending_tokens.csv')) {
      const csv = fs.readFileSync('./data/pending_tokens.csv', 'utf8');
      const lines = csv.split('\n').filter(l => l.length > 0);
      
      let bought = 0;
      let rejected = 0;
      let poolDepleted = 0;
      
      lines.forEach(line => {
        if (line.includes(',bought,')) bought++;
        if (line.includes(',rejected,')) rejected++;
        if (line.includes(',pool_depleted,')) poolDepleted++;
      });
      
      const total = bought + rejected;
      const successRate = total > 0 ? ((bought / total) * 100).toFixed(1) : '0.0';
      
      console.log(`\n   🎯 TOKEN STATS:`);
      console.log(`   ├─ Tokens Bought: ${bought}`);
      console.log(`   ├─ Tokens Rejected: ${rejected}`);
      console.log(`   ├─ Pool Depleted: ${poolDepleted}`);
      console.log(`   └─ Success Rate: ${successRate}%`);
    }
    
    // Read recent trades
    if (fs.existsSync('./data/pool_transactions.csv')) {
      const csv = fs.readFileSync('./data/pool_transactions.csv', 'utf8');
      const lines = csv.split('\n').filter(l => l.includes('trade_execution') || l.includes('profit_return') || l.includes('loss_return'));
      const recent = lines.slice(-5);
      
      if (recent.length > 0) {
        console.log(`\n   📈 LAST 5 TRADES:`);
        recent.forEach(line => {
          const parts = line.split(',');
          const time = new Date(parts[0]).toLocaleTimeString();
          const type = parts[1];
          const amount = parseFloat(parts[2]) || 0;
          const notes = parts[6] || '';
          
          if (type === 'trade_execution') {
            console.log(`   ├─ ${time}: BUY | -$${Math.abs(amount).toFixed(2)}`);
          } else if (type === 'profit_return') {
            const profit = notes.match(/P&L: \+?\$?([\d.-]+)/);
            if (profit) {
              console.log(`   ├─ ${time}: SELL | 🟢 +$${profit[1]}`);
            }
          } else if (type === 'loss_return') {
            const loss = notes.match(/P&L: \$?-([\d.-]+)/);
            if (loss) {
              console.log(`   ├─ ${time}: SELL | 🔴 -$${loss[1]}`);
            }
          }
        });
      }
    }
    
    // Check wallet rotation history
    if (fs.existsSync('./wallets/rotation_history.json')) {
      try {
        const history = JSON.parse(fs.readFileSync('./wallets/rotation_history.json', 'utf8'));
        if (history.length > 0) {
          const totalProfit = history.reduce((sum: number, w: any) => sum + (w.profitKept || 0), 0);
          const totalTax = history.reduce((sum: number, w: any) => sum + (w.taxReserve || 0), 0);
          
          console.log(`\n   💼 WALLET ROTATION HISTORY:`);
          console.log(`   ├─ Sessions Completed: ${history.length}`);
          console.log(`   ├─ Lifetime Profit: $${totalProfit.toFixed(2)}`);
          console.log(`   └─ Tax Reserved: $${totalTax.toFixed(2)}`);
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    }
    
    // Performance metrics
    if (fs.existsSync('./data/performance_log.csv')) {
      const csv = fs.readFileSync('./data/performance_log.csv', 'utf8');
      const lines = csv.split('\n').filter(l => l.includes('5x_detected'));
      
      if (lines.length > 0) {
        console.log(`\n   💎 5X+ OPPORTUNITIES: ${lines.length} detected`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📁 Data files location:');
    console.log('   • data/pool_transactions.csv');
    console.log('   • data/pending_tokens.csv');
    console.log('   • wallets/rotation_history.json');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ Error reading data files:', error);
    console.log('\n   Make sure the bot has run at least once to generate data files.');
    console.log('='.repeat(60) + '\n');
  }
}

// Run immediately
displaySessionSummary().catch(console.error);