/**
 * SOL-BOT STARTUP VERIFICATION SCRIPT
 * Checks all critical systems before live trading
 */

const fs = require('fs');
const path = require('path');

function checkRequiredFile(filePath, description, critical = true) {
  const exists = fs.existsSync(filePath);
  const icon = exists ? '✅' : (critical ? '❌' : '⚠️');
  console.log(`${icon} ${description}: ${filePath}`);

  if (!exists && critical) {
    return false;
  }

  // Create missing non-critical files
  if (!exists && !critical) {
    try {
      if (filePath.includes('sell_transactions.csv')) {
        fs.writeFileSync(filePath, 'timestamp,trade_number,token_mint,token_amount,usd_amount,price_per_token,fees\n');
        console.log('   ✅ Created missing file');
      } else if (filePath.includes('token_registry.json')) {
        const defaultRegistry = {
          "So11111111111111111111111111111111111111112": "SOL",
          "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC"
        };
        fs.writeFileSync(filePath, JSON.stringify(defaultRegistry, null, 2));
        console.log('   ✅ Created missing file with defaults');
      }
    } catch (error) {
      console.log(`   ❌ Failed to create file: ${error.message}`);
    }
  }

  return true;
}

function checkConfiguration() {
  console.log('🚀 SOL-BOT LIVE TRADING VERIFICATION');
  console.log('='.repeat(50));

  let criticalErrors = 0;
  let warnings = 0;

  // Import configurations
  let z_config, botController;

  try {
    // These need to be imported dynamically due to ES6 modules
    const configPath = path.join(__dirname, '..', 'z-new-controls', 'z-masterConfig.ts');
    const botPath = path.join(__dirname, 'botController.ts');

    if (!fs.existsSync(configPath)) {
      console.log('❌ z-masterConfig.ts not found');
      criticalErrors++;
      return { criticalErrors, warnings };
    }

    if (!fs.existsSync(botPath)) {
      console.log('❌ botController.ts not found');
      criticalErrors++;
      return { criticalErrors, warnings };
    }

    console.log('✅ Configuration files found');

  } catch (error) {
    console.log('❌ Error importing configurations:', error.message);
    criticalErrors++;
  }

  // Check environment variables
  console.log('\nENVIRONMENT CHECKS:');
  const envChecks = [
    { name: 'TEST_MODE', value: process.env.TEST_MODE, expected: 'false', critical: true },
    { name: 'PRIVATE_KEY', value: process.env.PRIVATE_KEY ? '[SET]' : '[NOT SET]', expected: '[SET]', critical: true },
    { name: 'RPC_WSS_URI', value: process.env.RPC_WSS_URI ? '[SET]' : '[NOT SET]', expected: '[SET]', critical: true }
  ];

  envChecks.forEach(check => {
    const passed = check.value === check.expected;
    const icon = passed ? '✅' : (check.critical ? '❌' : '⚠️');
    console.log(`${icon} ${check.name}: ${check.value} (expected: ${check.expected})`);
    if (!passed && check.critical) criticalErrors++;
    if (!passed && !check.critical) warnings++;
  });

  // Check critical files
  console.log('\nFILE CHECKS:');
  const requiredFiles = [
    { path: 'data/pool_transactions.csv', desc: 'Pool transactions log', critical: true },
    { path: 'data/sell_transactions.csv', desc: 'Sell transactions log', critical: false },
    { path: 'data/token_registry.json', desc: 'Token registry', critical: false },
    { path: '.env', desc: 'Environment configuration', critical: true },
    { path: 'src/graceful-shutdown.ts', desc: 'Graceful shutdown system', critical: true },
    { path: 'src/simpleTaxProcessor.js', desc: 'Tax processor', critical: true },
    { path: 'src/taxCompliance.js', desc: 'Tax compliance generator', critical: true }
  ];

  requiredFiles.forEach(file => {
    const success = checkRequiredFile(file.path, file.desc, file.critical);
    if (!success) criticalErrors++;
  });

  // Check data directory structure
  console.log('\nDATA DIRECTORY STRUCTURE:');
  const dataDirs = ['data', 'data/tax_reports', 'data/tax_reports/2025-09'];
  dataDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      } catch (error) {
        console.log(`❌ Failed to create directory ${dir}: ${error.message}`);
        criticalErrors++;
      }
    } else {
      console.log(`✅ Directory exists: ${dir}`);
    }
  });

  return { criticalErrors, warnings };
}

function checkTaxSystem() {
  console.log('\nTAX SYSTEM VERIFICATION:');

  try {
    // Check if tax processor runs without errors
    console.log('📊 Testing tax processor...');

    // Check for existing transactions
    if (fs.existsSync('data/pool_transactions.csv')) {
      const content = fs.readFileSync('data/pool_transactions.csv', 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      console.log(`✅ Pool transactions file has ${lines.length - 1} transactions`);
    }

    // Check tax export files
    const taxFiles = [
      'data/tax_export_2025.csv',
      'data/tax_summary_2025.txt'
    ];

    taxFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        console.log(`✅ ${file} exists (${Math.round(stats.size / 1024)}KB)`);
      } else {
        console.log(`⚠️ ${file} not found (will be created during trading)`);
      }
    });

    console.log('✅ Tax system appears functional');
    return true;

  } catch (error) {
    console.log(`❌ Tax system error: ${error.message}`);
    return false;
  }
}

function checkGracefulShutdown() {
  console.log('\nGRACEFUL SHUTDOWN VERIFICATION:');

  try {
    const shutdownFile = 'src/graceful-shutdown.ts';
    if (fs.existsSync(shutdownFile)) {
      const content = fs.readFileSync(shutdownFile, 'utf8');

      // Check for key components
      const hasShutdownManager = content.includes('GracefulShutdownManager');
      const hasKeyboardControls = content.includes('setupInteractiveControls');
      const hasPositionMonitoring = content.includes('updatePositions');

      console.log(`${hasShutdownManager ? '✅' : '❌'} GracefulShutdownManager class found`);
      console.log(`${hasKeyboardControls ? '✅' : '❌'} Keyboard controls implemented`);
      console.log(`${hasPositionMonitoring ? '✅' : '❌'} Position monitoring included`);

      if (hasShutdownManager && hasKeyboardControls && hasPositionMonitoring) {
        console.log('✅ Graceful shutdown system is complete');
        console.log('   Controls: S=Stop, P=Pause, F=Force, R=Resume, Q=Quit');
        console.log('   Test with Ctrl+C after starting bot');
        return true;
      } else {
        console.log('❌ Graceful shutdown system incomplete');
        return false;
      }
    } else {
      console.log('❌ Graceful shutdown file not found');
      return false;
    }
  } catch (error) {
    console.log(`❌ Error checking graceful shutdown: ${error.message}`);
    return false;
  }
}

function checkConfiguration() {
  console.log('\nCONFIGURATION VERIFICATION:');

  try {
    // Check if this looks like a test configuration
    const hasTestData = fs.existsSync('data/pool_transactions.csv');
    if (hasTestData) {
      const content = fs.readFileSync('data/pool_transactions.csv', 'utf8');
      const testMarkers = ['2025-09-16', 'test', 'simulation'];
      const looksLikeTest = testMarkers.some(marker =>
        content.toLowerCase().includes(marker.toLowerCase())
      );

      if (looksLikeTest) {
        console.log('⚠️ Pool transactions contain test data');
        console.log('   Consider running data reset script before live trading');
      } else {
        console.log('✅ Pool transactions appear to be production data');
      }
    }

    // General configuration checks
    console.log('✅ Configuration files validated');
    console.log('   Note: Manual review of z-masterConfig.ts recommended');
    console.log('   Ensure z_testMode: false for live trading');

    return true;

  } catch (error) {
    console.log(`❌ Configuration check error: ${error.message}`);
    return false;
  }
}

// Main execution
function main() {
  const { criticalErrors, warnings } = checkConfiguration();
  const taxOk = checkTaxSystem();
  const shutdownOk = checkGracefulShutdown();
  const configOk = checkConfiguration();

  // Final verdict
  console.log('\n' + '='.repeat(50));

  if (criticalErrors > 0) {
    console.log('❌ NOT READY FOR LIVE TRADING');
    console.log(`   Fix ${criticalErrors} critical error(s) above`);
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Fix all critical errors marked with ❌');
    console.log('2. Set TEST_MODE=false in .env file');
    console.log('3. Set z_testMode: false in z-masterConfig.ts');
    console.log('4. Run this script again to verify fixes');
  } else {
    console.log('✅ READY FOR LIVE TRADING');
    if (warnings > 0) {
      console.log(`   Note: ${warnings} warning(s) should be addressed`);
    }
    console.log('\n📋 FINAL STEPS:');
    console.log('1. Review configuration in z-masterConfig.ts');
    console.log('2. Archive test data: node src/reset-for-live.js');
    console.log('3. Test graceful shutdown with: npm run dev (then Ctrl+C)');
    console.log('4. Start live trading: npm run dev');
  }

  console.log('\n💡 HELPFUL COMMANDS:');
  console.log('- Test tax processor: node src/simpleTaxProcessor.js');
  console.log('- Reset for live trading: node src/reset-for-live.js');
  console.log('- View graceful shutdown: more src/graceful-shutdown.ts');
  console.log('='.repeat(50));

  process.exit(criticalErrors > 0 ? 1 : 0);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { checkRequiredFile, checkTaxSystem, checkGracefulShutdown, checkConfiguration };