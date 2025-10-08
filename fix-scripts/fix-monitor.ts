#!/usr/bin/env node
// fix-monitor.ts - Fix live monitor issues

import * as fs from 'fs';

console.log('📊 FIXING LIVE MONITOR SYSTEM');
console.log('='.repeat(50));

// Create enhanced monitor with debug logging
const enhancedMonitor = `
// Enhanced live monitor with debug logging
import * as fs from 'fs';

console.log('[MONITOR_DEBUG] Monitor starting...');

function calculateWinRate(): number {
  console.log('[MONITOR_DEBUG] Calculating win rate...');
  
  try {
    const filename = 'data/performance_log.csv';
    console.log('[MONITOR_DEBUG] Reading file:', filename);
    
    if (!fs.existsSync(filename)) {
      console.log('[MONITOR_DEBUG] Performance log not found, creating...');
      fs.writeFileSync(filename, 'timestamp,token,result,profit\\n');
      return 0;
    }
    
    const content = fs.readFileSync(filename, 'utf8');
    console.log('[MONITOR_DEBUG] File content:', content.slice(0, 100));
    
    const lines = content.split('\\n').filter(line => line.trim());
    const trades = lines.slice(1); // Skip header
    
    if (trades.length === 0) {
      console.log('[MONITOR_DEBUG] No trades found');
      return 0;
    }
    
    const wins = trades.filter(line => {
      const cols = line.split(',');
      return cols[2] === 'profit' || parseFloat(cols[3]) > 0;
    }).length;
    
    const winRate = (wins / trades.length) * 100;
    console.log('[MONITOR_DEBUG] Calculated win rate:', winRate);
    
    return winRate;
  } catch (error) {
    console.error('[MONITOR_DEBUG] Win rate calculation error:', error);
    return 0;
  }
}

// Monitor file changes
function monitorFiles(): void {
  const filesToMonitor = [
    'data/performance_log.csv',
    'data/wallet_history.json', 
    'data/tax_records.json',
    'data/5x_events.jsonl'
  ];
  
  filesToMonitor.forEach(file => {
    if (fs.existsSync(file)) {
      console.log('[MONITOR_DEBUG] Monitoring:', file);
      fs.watchFile(file, (curr, prev) => {
        console.log('[MONITOR_DEBUG] File changed:', file, 'Size:', curr.size);
      });
    } else {
      console.log('[MONITOR_DEBUG] File not found for monitoring:', file);
    }
  });
}

setInterval(() => {
  const winRate = calculateWinRate();
  console.log(\`📊 Current Win Rate: \${winRate.toFixed(1)}%\`);
}, 30000);

monitorFiles();
`;

fs.writeFileSync('src/enhanced-monitor.ts', enhancedMonitor);
console.log('✅ Created enhanced monitor with debug logging');

console.log('\n✅ Monitor fixes applied!');
