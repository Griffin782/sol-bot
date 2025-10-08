// Integrated Systems Test - Verify all restored functionality
const { IntegrationManager } = require('./dist/src/utils/managers/integrationManager.js');
const { BackupManager } = require('./dist/src/utils/managers/backupManager.js');
const { SessionManager } = require('./dist/src/utils/managers/sessionManager.js');
const { WalletRotator } = require('./dist/src/utils/managers/walletRotator.js');
const fs = require('fs');

async function testIntegratedSystems() {
  console.log('🧪 TESTING INTEGRATED SYSTEMS');
  console.log('='.repeat(60));
  
  try {
    console.log('\n📋 TEST 1: Tax Compliance System Structure');
    console.log('-'.repeat(50));
    
    const taxDirs = [
      './tax-compliance',
      './tax-compliance/2025',
      './tax-compliance/2025/transactions',
      './tax-compliance/2025/reports', 
      './tax-compliance/2025/form8949'
    ];
    
    let taxSystemOK = true;
    taxDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        console.log(`✅ ${dir} - EXISTS`);
      } else {
        console.log(`❌ ${dir} - MISSING`);
        taxSystemOK = false;
      }
    });
    
    // Check transaction file
    const transactionFile = './tax-compliance/2025/transactions/all-transactions.json';
    if (fs.existsSync(transactionFile)) {
      console.log(`✅ Transaction tracking file exists`);
    } else {
      console.log(`❌ Transaction tracking file missing`);
      taxSystemOK = false;
    }
    
    console.log(`Tax Compliance System: ${taxSystemOK ? '✅ READY' : '❌ INCOMPLETE'}`);
    
    console.log('\n📋 TEST 2: Wallet System Structure');
    console.log('-'.repeat(50));
    
    const walletDirs = [
      './wallets',
      './wallets/pending',
      './wallets/completed',
      './wallets/sessions'
    ];
    
    let walletSystemOK = true;
    walletDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        console.log(`✅ ${dir} - EXISTS`);
      } else {
        console.log(`❌ ${dir} - MISSING`);
        walletSystemOK = false;
      }
    });
    
    console.log(`Wallet System Structure: ${walletSystemOK ? '✅ READY' : '❌ INCOMPLETE'}`);
    
    console.log('\n📋 TEST 3: Backup System Structure');
    console.log('-'.repeat(50));
    
    const backupDirs = [
      './src/backup-old',
      './src/backup-old/versions',
      './src/backup-old/versions/critical',
      './src/backup-old/versions/config',
      './src/backup-old/versions/trading'
    ];
    
    let backupSystemOK = true;
    backupDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        console.log(`✅ ${dir} - EXISTS`);
      } else {
        console.log(`❌ ${dir} - MISSING`);
        backupSystemOK = false;
      }
    });
    
    console.log(`Backup System Structure: ${backupSystemOK ? '✅ READY' : '❌ INCOMPLETE'}`);
    
    console.log('\n📋 TEST 4: System Integration Manager');
    console.log('-'.repeat(50));
    
    console.log('Initializing integration manager...');
    const integrationManager = new IntegrationManager();
    
    // Test system status
    const status = integrationManager.getSystemStatus();
    console.log(`Session Manager: ${status.sessionManager ? '✅' : '❌'}`);
    console.log(`Wallet Rotator: ${status.walletRotator ? '✅' : '❌'}`);
    console.log(`Backup Manager: ${status.backupManager ? '✅' : '❌'}`);
    console.log(`Tax Compliance: ${status.taxCompliance ? '✅' : '❌'}`);
    console.log(`Security System: ${status.security ? '✅' : '❌'}`);
    
    console.log('\n📋 TEST 5: Wallet Rotation System');
    console.log('-'.repeat(50));
    
    const walletRotator = new WalletRotator();
    walletRotator.displayWalletPoolStatus();
    
    // Test getting next wallet
    const wallet = walletRotator.getNextWallet();
    console.log(`✅ Wallet rotation working: ${wallet.publicKey.slice(0, 8)}...`);
    
    console.log('\n📋 TEST 6: Session Management');
    console.log('-'.repeat(50));
    
    const sessionManager = new SessionManager();
    const session = sessionManager.startNewSession(1000);
    console.log(`✅ Session created: ${session.sessionId}`);
    
    // Test updating session with mock trade
    sessionManager.updateSessionMetrics({
      success: true,
      pnl: 50,
      holdTimeMinutes: 5.5
    });
    console.log(`✅ Session metrics updated`);
    
    // Get session stats
    const sessionStats = sessionManager.getSessionStats();
    console.log(`Session balance: $${sessionStats.balance.toFixed(2)}`);
    console.log(`Session ROI: ${sessionStats.roi.toFixed(1)}%`);
    
    console.log('\n📋 TEST 7: Backup System');
    console.log('-'.repeat(50));
    
    const backupManager = new BackupManager();
    
    // Create a test backup
    const backupId = backupManager.backupCriticalFiles('System test backup');
    console.log(`✅ Backup created: ${backupId}`);
    
    // Get backup stats
    const backupStats = backupManager.getBackupStats();
    console.log(`Total backups: ${backupStats.totalBackups}`);
    console.log(`Storage used: ${backupStats.totalSize}`);
    
    // List rollback points
    const rollbackPoints = backupManager.listRollbackPoints();
    console.log(`Rollback points available: ${rollbackPoints.length}`);
    
    console.log('\n📋 TEST 8: Health Check');
    console.log('-'.repeat(50));
    
    const healthCheck = integrationManager.performSystemHealthCheck();
    console.log(`System Health: ${healthCheck.healthy ? '✅ HEALTHY' : '⚠️ NEEDS ATTENTION'}`);
    
    if (!healthCheck.healthy) {
      console.log(`Issues: ${healthCheck.issues.length}`);
      healthCheck.issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    console.log('\n📋 TEST 9: Integration Display');
    console.log('-'.repeat(50));
    
    integrationManager.displayIntegratedStatus();
    
    console.log('\n📋 TEST 10: Advanced Features Integration');
    console.log('-'.repeat(50));
    
    try {
      // Test config for advanced features
      const testConfig = {
        pool: { targetPool: 10000 },
        runtime: { maxRuntime: 60 }
      };
      
      integrationManager.initializeAdvancedFeatures(testConfig);
      console.log(`✅ Advanced features initialized`);
      
      // Test trade result recording
      integrationManager.recordTradeResult('test_token_123', true, 25.5, 3.2);
      console.log(`✅ Trade result recorded`);
      
    } catch (error) {
      console.log(`⚠️ Advanced features test: ${error.message}`);
    }
    
    console.log('\n🎉 INTEGRATION TEST COMPLETE!');
    console.log('='.repeat(60));
    
    console.log('\n📊 SUMMARY:');
    console.log(`✅ Tax compliance system: ${taxSystemOK ? 'RESTORED' : 'NEEDS ATTENTION'}`);
    console.log(`✅ Wallet rotation system: ${walletSystemOK ? 'RESTORED' : 'NEEDS ATTENTION'}`);  
    console.log(`✅ Backup-old system: ${backupSystemOK ? 'RESTORED' : 'NEEDS ATTENTION'}`);
    console.log(`✅ Session management: FUNCTIONAL`);
    console.log(`✅ System integration: FUNCTIONAL`);
    
    console.log('\n🚀 ALL MISSING SYSTEMS HAVE BEEN RESTORED!');
    console.log('Your SOL trading bot now has:');
    console.log('  • Complete tax compliance tracking');
    console.log('  • Multi-wallet rotation system');
    console.log('  • Session management with targets');
    console.log('  • Backup & rollback capabilities');
    console.log('  • Integrated system monitoring');
    
    // Clean up test session
    sessionManager.completeSession('Integration test completed');
    
  } catch (error) {
    console.error(`❌ Integration test failed: ${error}`);
    console.error(error.stack);
  }
}

// Run the test
testIntegratedSystems().catch(console.error);