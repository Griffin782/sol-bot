/**
 * RESET FOR LIVE TRADING SCRIPT
 * Archives test data and creates fresh files for live trading
 */

const fs = require('fs');
const path = require('path');

function createArchive() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveDir = `data/archive/${timestamp}`;

  console.log('📁 Creating archive directory...');

  // Create archive directory
  if (!fs.existsSync('data/archive')) {
    fs.mkdirSync('data/archive', { recursive: true });
  }
  fs.mkdirSync(archiveDir, { recursive: true });

  return archiveDir;
}

function archiveFile(filePath, archiveDir, description) {
  if (fs.existsSync(filePath)) {
    try {
      const fileName = path.basename(filePath);
      const destinationPath = path.join(archiveDir, fileName);
      fs.copyFileSync(filePath, destinationPath);
      console.log(`✅ Archived: ${description} → ${destinationPath}`);
      return true;
    } catch (error) {
      console.log(`❌ Failed to archive ${filePath}: ${error.message}`);
      return false;
    }
  } else {
    console.log(`⚠️ File not found (skipping): ${filePath}`);
    return true;
  }
}

function createFreshFile(filePath, content, description) {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content);
    console.log(`✅ Created fresh: ${description}`);
    return true;
  } catch (error) {
    console.log(`❌ Failed to create ${filePath}: ${error.message}`);
    return false;
  }
}

function resetForLiveTrading() {
  console.log('🚀 SOL-BOT LIVE TRADING RESET');
  console.log('='.repeat(50));
  console.log('This will archive test data and create fresh files for live trading.\n');

  // Confirm with user
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Are you sure you want to reset for live trading? (yes/no): ', (answer) => {
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Reset cancelled by user');
      rl.close();
      return;
    }

    rl.close();
    performReset();
  });
}

function performReset() {
  console.log('\n📁 Starting reset process...\n');

  // Create archive
  const archiveDir = createArchive();

  // Files to archive
  const filesToArchive = [
    { path: 'data/pool_transactions.csv', desc: 'Pool transactions' },
    { path: 'data/trading_log.json', desc: 'Trading log' },
    { path: 'data/pending_tokens.csv', desc: 'Pending tokens' },
    { path: 'data/performance_log.csv', desc: 'Performance log' },
    { path: 'data/paper_trading_exits.csv', desc: 'Paper trading exits' },
    { path: 'data/tax_export_2025.csv', desc: 'Tax export (backup only)' },
    { path: 'data/tax_summary_2025.txt', desc: 'Tax summary (backup only)' }
  ];

  // Archive existing files
  console.log('ARCHIVING TEST DATA:');
  let archiveSuccess = true;
  filesToArchive.forEach(file => {
    const success = archiveFile(file.path, archiveDir, file.desc);
    if (!success) archiveSuccess = false;
  });

  if (!archiveSuccess) {
    console.log('\n❌ Some files failed to archive. Check errors above.');
    console.log('Manual backup recommended before proceeding.');
    return;
  }

  // Create fresh files
  console.log('\nCREATING FRESH FILES:');

  const freshFiles = [
    {
      path: 'data/pool_transactions.csv',
      content: 'timestamp,type,amount,pool_value,net_pool,trade_num,description\n',
      desc: 'Pool transactions CSV'
    },
    {
      path: 'data/trading_log.json',
      content: '[]',
      desc: 'Trading log JSON'
    },
    {
      path: 'data/pending_tokens.csv',
      content: 'timestamp,token,status\n',
      desc: 'Pending tokens CSV'
    },
    {
      path: 'data/performance_log.csv',
      content: 'timestamp,metric,value\n',
      desc: 'Performance log CSV'
    }
  ];

  let createSuccess = true;
  freshFiles.forEach(file => {
    const success = createFreshFile(file.path, file.content, file.desc);
    if (!success) createSuccess = false;
  });

  // Preserve important files
  console.log('\nPRESERVING IMPORTANT FILES:');
  const preserveFiles = [
    'data/token_registry.json',
    'data/sell_transactions.csv'
  ];

  preserveFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      console.log(`✅ Preserved: ${filePath}`);
    } else {
      // Create if missing
      if (filePath.includes('sell_transactions.csv')) {
        createFreshFile(
          filePath,
          'timestamp,trade_number,token_mint,token_amount,usd_amount,price_per_token,fees\n',
          'Sell transactions CSV'
        );
      } else if (filePath.includes('token_registry.json')) {
        const defaultRegistry = {
          "So11111111111111111111111111111111111111112": "SOL",
          "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC"
        };
        createFreshFile(
          filePath,
          JSON.stringify(defaultRegistry, null, 2),
          'Token registry JSON'
        );
      }
    }
  });

  // Create session tracking file
  console.log('\nSESSION INITIALIZATION:');
  const sessionData = {
    currentSession: 1,
    startTime: new Date().toISOString(),
    initialPool: 600,
    targetPool: 7000,
    mode: 'live',
    resetFrom: archiveDir
  };

  createFreshFile(
    'data/session.json',
    JSON.stringify(sessionData, null, 2),
    'Session tracking'
  );

  // Summary
  console.log('\n' + '='.repeat(50));
  if (createSuccess && archiveSuccess) {
    console.log('✅ RESET COMPLETE - READY FOR LIVE TRADING');
    console.log('\n📁 TEST DATA ARCHIVED TO:');
    console.log(`   ${archiveDir}`);
    console.log('\n✅ FRESH FILES CREATED:');
    console.log('   • Pool transactions log (empty)');
    console.log('   • Trading log (empty)');
    console.log('   • Performance tracking (empty)');
    console.log('   • Session tracking (initialized)');
    console.log('\n📋 PRESERVED FILES:');
    console.log('   • Token registry (existing mappings)');
    console.log('   • Sell transactions log (for tax continuity)');
    console.log('\n🚨 IMPORTANT REMINDERS:');
    console.log('   1. Verify z_testMode: false in z-masterConfig.ts');
    console.log('   2. Verify TEST_MODE=false in .env file');
    console.log('   3. Run startup-check.js to verify readiness');
    console.log('   4. Test graceful shutdown before live trading');
    console.log('\n▶️ NEXT COMMAND: node src/startup-check.js');
  } else {
    console.log('❌ RESET FAILED');
    console.log('   Review errors above and try again');
    console.log('   Manual file management may be required');
  }
  console.log('='.repeat(50));
}

// Run if called directly
if (require.main === module) {
  resetForLiveTrading();
}

module.exports = { resetForLiveTrading, createArchive, archiveFile, createFreshFile };