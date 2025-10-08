/**
 * SIMPLE TAX PROCESSOR FOR SOL-BOT
 * No external dependencies required - uses only Node.js built-in modules
 */

const fs = require('fs');
const path = require('path');

// Simple CSV parser (no external dependencies)
function parseCSV(text) {
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

console.log('📊 SOL-BOT Tax Processor Starting...\n');

try {
  // Read pool_transactions.csv
  const poolTransPath = path.join('data', 'pool_transactions.csv');
  console.log(`Reading ${poolTransPath}...`);
  
  const poolTransData = fs.readFileSync(poolTransPath, 'utf8');
  const poolTrans = parseCSV(poolTransData);
  
  console.log(`✓ Found ${poolTrans.length} pool transactions\n`);
  
  // Process transactions
  const transactions = [];
  const tokenRegistry = {};
  let buyCount = 0;
  let sellCount = 0;
  let totalBuyAmount = 0;
  let totalSellAmount = 0;
  
  poolTrans.forEach(row => {
    if (!row || row.length < 7) return;
    
    const [timestamp, type, amount, poolValue, netPool, tradeNum, description] = row;
    
    // Process BUY transactions
    if (type === 'trade_execution' && parseFloat(amount) < 0) {
      buyCount++;
      const buyAmount = Math.abs(parseFloat(amount));
      totalBuyAmount += buyAmount;
      
      // Extract token from description
      let tokenSymbol = 'TOKEN' + buyCount;
      const match = description?.match(/Trade #\d+ executed: ([A-Za-z0-9]+)/);
      if (match) {
        tokenSymbol = match[1].substring(0, 6).toUpperCase();
        tokenRegistry[match[1]] = tokenSymbol;
      }
      
      transactions.push({
        date: new Date(timestamp).toISOString().split('T')[0],
        time: new Date(timestamp).toISOString().split('T')[1].split('.')[0],
        txHash: 'SIM_' + Date.now() + '_' + (tradeNum || buyCount),
        type: 'BUY',
        buyAmount: buyAmount.toFixed(2),
        buyCurrency: 'USD',
        sellAmount: '0',
        sellCurrency: tokenSymbol,
        fee: '0.00025',
        feeCurrency: 'SOL',
        tradeId: `SOL-${tradeNum || buyCount}`
      });
    }
    
    // Process SELL transactions
    if (type === 'profit_return' && parseFloat(amount) > 0) {
      sellCount++;
      const sellAmount = parseFloat(amount);
      totalSellAmount += sellAmount;
      
      // Extract token from description
      let tokenSymbol = 'TOKEN' + sellCount;
      const match = description?.match(/^([A-Za-z0-9]+)/);
      if (match) {
        tokenSymbol = match[1].substring(0, 6).toUpperCase();
        tokenRegistry[match[1]] = tokenSymbol;
      }

    // Then update your report to include:

      transactions.push({
        date: new Date(timestamp).toISOString().split('T')[0],
        time: new Date(timestamp).toISOString().split('T')[1].split('.')[0],
        txHash: 'SIM_' + Date.now() + '_' + (tradeNum || sellCount),
        type: 'SELL',
        buyAmount: '0',
        buyCurrency: tokenSymbol,
        sellAmount: sellAmount.toFixed(2),
        sellCurrency: 'USD',
        fee: '0.00025',
        feeCurrency: 'SOL',
        tradeId: `SOL-${tradeNum || sellCount}`
      });
    }
  });
  
// Calculate trading period ONCE, in the right place
const firstTrans = poolTrans[1]; // Skip header
const lastTrans = poolTrans[poolTrans.length - 1];
const tradingPeriod = `${new Date(firstTrans[0]).toLocaleDateString()} to ${new Date(lastTrans[0]).toLocaleDateString()}`;

  // Calculate summary
  const netPnL = totalSellAmount - totalBuyAmount;
  const taxReserve = netPnL * 0.4;
  const totalFees = (buyCount + sellCount) * 0.0425;
  const actualNetProfit = netPnL - totalFees;
  
  console.log('═══════════════════════════════════════');
  console.log('         TAX SUMMARY RESULTS');
  console.log(`    Period: ${tradingPeriod}`);
  console.log('═══════════════════════════════════════');
  console.log(`Buy Transactions:  ${buyCount}`);
  console.log(`Sell Transactions: ${sellCount}`);
  console.log(`Total Invested:    $${totalBuyAmount.toFixed(2)}`);
  console.log(`Total Received:    $${totalSellAmount.toFixed(2)}`);
  console.log(`Gross Profit:        $${netPnL.toFixed(2)}`);
  console.log(`Tax Reserve (40%): $${taxReserve.toFixed(2)}`);
  console.log(`Net After Fees:    $${actualNetProfit.toFixed(2)}`);
  console.log(`Net After Tax:     $${(actualNetProfit - taxReserve).toFixed(2)}`);
  console.log('═══════════════════════════════════════\n');
  
  // Write token registry
  const registryPath = path.join('data', 'token_registry.json');
  fs.writeFileSync(registryPath, JSON.stringify(tokenRegistry, null, 2));
  console.log(`✓ Created ${registryPath}`);
  
  // Write tax export CSV
  const csvHeader = 'Date,Time,Type,Buy Amount,Buy Currency,Sell Amount,Sell Currency,Fee,Fee Currency,Exchange,Trade ID,Tx Hash\n';
  const csvRows = transactions.map(tx => 
    `${tx.date},${tx.time || '00:00:00'},${tx.type},${tx.buyAmount},${tx.buyCurrency},${tx.sellAmount},${tx.sellCurrency},${tx.fee},${tx.feeCurrency},Jupiter,${tx.tradeId},${tx.txHash || 'LEGACY'}`
  ).join('\n');
  
  const exportPath = path.join('data', 'tax_export_2025.csv');
  fs.writeFileSync(exportPath, csvHeader + csvRows);
  console.log(`✓ Created ${exportPath}`);
  
  // Write summary report
  const report = `SOL-BOT TAX SUMMARY REPORT
Generated: ${new Date().toISOString()}
Trading Period: ${tradingPeriod} 
=====================================

TRADING ACTIVITY
----------------
Buy Transactions:  ${buyCount}
Sell Transactions: ${sellCount}
Total Transactions: ${transactions.length}

FINANCIAL SUMMARY
-----------------
Total Invested:    $${totalBuyAmount.toFixed(2)}
Total Received:    $${totalSellAmount.toFixed(2)}
Gross Profit/Loss:   $${netPnL.toFixed(2)}
Tax Reserve (40%): $${taxReserve.toFixed(2)}
Net After Tax:     $${(netPnL - taxReserve).toFixed(2)}

FILES GENERATED
---------------
1. token_registry.json - Token mappings
2. tax_export_2025.csv - For tax services
3. tax_summary_2025.txt - This report

COMPATIBLE WITH
---------------
• CoinTracker
• Koinly
• TurboTax
• RP2 (Open Source)

Wallet: EmKj5PB2V6QHQ3uD2NkwGSEum3C5z61p8ehWAGyMcBUV
=====================================`;
  
  const summaryPath = path.join('data', 'tax_summary_2025.txt');
  fs.writeFileSync(summaryPath, report);
  console.log(`✓ Created ${summaryPath}`);
  
  console.log('\n✅ Tax compliance files created successfully!');
  console.log('\n📋 Next Steps:');
  console.log('1. Check your /data folder for the generated files');
  console.log('2. Upload tax_export_2025.csv to your tax service');
  console.log('3. Keep tax_summary_2025.txt for your records\n');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.log('\nMake sure you have these files in your /data folder:');
  console.log('- pool_transactions.csv');
  console.log('- paper_trading.csv (optional)');
  console.log('- pending_tokens.csv (optional)\n');
}