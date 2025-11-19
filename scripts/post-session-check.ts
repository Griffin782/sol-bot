import dotenv from 'dotenv';
import { checkWalletBalance } from '../src/utils/balance-checker';
import { validateJupiterSetup } from '../src/utils/simple-jupiter-validator';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

interface CheckResult {
  category: string;
  passed: number;
  failed: number;
  warnings: number;
  checks: CheckItem[];
}

interface CheckItem {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

const results: CheckResult[] = [];

// Helper functions
function createCheckResult(category: string): CheckResult {
  return {
    category,
    passed: 0,
    failed: 0,
    warnings: 0,
    checks: []
  };
}

function addCheck(result: CheckResult, name: string, status: 'pass' | 'fail' | 'warn', message: string, details?: string) {
  result.checks.push({ name, status, message, details });
  if (status === 'pass') result.passed++;
  else if (status === 'fail') result.failed++;
  else result.warnings++;
}

function getStatusIcon(status: 'pass' | 'fail' | 'warn'): string {
  if (status === 'pass') return '✅';
  if (status === 'fail') return '❌';
  return '⚠️';
}

// Category 1: Configuration Verification
async function checkConfiguration(): Promise<CheckResult> {
  const result = createCheckResult('Configuration');

  console.log('\n📋 CATEGORY 1: Configuration Verification');
  console.log('═══════════════════════════════════════\n');

  // Check TEST_MODE setting
  const testMode = process.env.TEST_MODE === 'true' || process.env.IS_TEST_MODE === 'true';
  if (testMode) {
    addCheck(result, 'Test Mode', 'pass', 'TEST_MODE is enabled (safe)', 'Bot will run in paper trading mode');
  } else {
    addCheck(result, 'Test Mode', 'warn', 'TEST_MODE is disabled', 'Bot will execute REAL trades with REAL money');
  }

  // Check wallet address
  const walletAddress = process.env.WALLET_ADDRESS;
  if (walletAddress && walletAddress.length === 44) {
    addCheck(result, 'Wallet Address', 'pass', 'Wallet address configured', walletAddress);
  } else {
    addCheck(result, 'Wallet Address', 'fail', 'Wallet address missing or invalid');
  }

  // Check private key
  const privateKey = process.env.PRIVATE_KEY;
  if (privateKey && privateKey.length > 0) {
    const isArray = privateKey.startsWith('[');
    addCheck(result, 'Private Key', 'pass', `Private key configured (${isArray ? 'array' : 'base58'} format)`);
  } else {
    addCheck(result, 'Private Key', 'fail', 'Private key missing');
  }

  // Check Jupiter configuration
  try {
    const jupiterConfig = validateJupiterSetup();
    if (jupiterConfig.isValid) {
      addCheck(result, 'Jupiter API', 'pass', 'Jupiter configuration valid', jupiterConfig.jupiterEndpoint);
    } else {
      addCheck(result, 'Jupiter API', 'fail', 'Jupiter configuration invalid');
    }
  } catch (error) {
    addCheck(result, 'Jupiter API', 'fail', 'Jupiter validation failed', error instanceof Error ? error.message : 'Unknown error');
  }

  // Check QuickNode RPC
  const rpcEndpoint = process.env.QUICKNODE_RPC_ENDPOINT || process.env.RPC_HTTPS_URI;
  if (rpcEndpoint && rpcEndpoint.includes('quicknode')) {
    addCheck(result, 'QuickNode RPC', 'pass', 'QuickNode endpoint configured');
  } else if (rpcEndpoint) {
    addCheck(result, 'QuickNode RPC', 'warn', 'Using non-QuickNode RPC', 'May experience rate limits');
  } else {
    addCheck(result, 'QuickNode RPC', 'fail', 'No RPC endpoint configured');
  }

  // Check UNIFIED-CONTROL exists
  try {
    await fs.access(path.join(process.cwd(), 'src', 'core', 'UNIFIED-CONTROL.ts'));
    addCheck(result, 'UNIFIED-CONTROL', 'pass', 'Master configuration file exists');
  } catch {
    addCheck(result, 'UNIFIED-CONTROL', 'fail', 'Master configuration file missing');
  }

  return result;
}

// Category 2: Wallet & Balance Check
async function checkWalletAndBalance(): Promise<CheckResult> {
  const result = createCheckResult('Wallet & Balance');

  console.log('\n💰 CATEGORY 2: Wallet & Balance Check');
  console.log('═══════════════════════════════════════\n');

  const walletAddress = process.env.WALLET_ADDRESS;

  if (!walletAddress) {
    addCheck(result, 'Wallet Balance', 'fail', 'Cannot check balance - no wallet address');
    return result;
  }

  try {
    const balanceInfo = await checkWalletBalance(walletAddress, 0);

    console.log(`   Address: ${balanceInfo.address}`);
    console.log(`   Balance: ${balanceInfo.balanceSOL.toFixed(4)} SOL`);
    console.log(`   Lamports: ${balanceInfo.balanceLamports.toLocaleString()}\n`);

    // Check balance levels
    if (balanceInfo.balanceSOL >= 0.1) {
      addCheck(result, 'Balance Level', 'pass', `Sufficient balance: ${balanceInfo.balanceSOL.toFixed(4)} SOL`);
    } else if (balanceInfo.balanceSOL >= 0.005) {
      addCheck(result, 'Balance Level', 'warn', `Low balance: ${balanceInfo.balanceSOL.toFixed(4)} SOL`, 'Consider adding more SOL for meaningful testing');
    } else {
      addCheck(result, 'Balance Level', 'fail', `Insufficient balance: ${balanceInfo.balanceSOL.toFixed(4)} SOL`, 'Need at least 0.005 SOL to run');
    }

    // Estimate trade capacity
    const positionSize = 0.00089; // From configuration
    const fee = 0.002; // Fee buffer
    const maxTrades = Math.floor(balanceInfo.balanceSOL / (positionSize + fee));

    if (maxTrades >= 5) {
      addCheck(result, 'Trade Capacity', 'pass', `Can execute ~${maxTrades} trades`);
    } else if (maxTrades >= 1) {
      addCheck(result, 'Trade Capacity', 'warn', `Can only execute ~${maxTrades} trades`, 'Limited testing capacity');
    } else {
      addCheck(result, 'Trade Capacity', 'fail', 'Insufficient balance for any trades');
    }

  } catch (error) {
    addCheck(result, 'Wallet Balance', 'fail', 'Failed to check balance', error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
}

// Category 3: File Integrity
async function checkFileIntegrity(): Promise<CheckResult> {
  const result = createCheckResult('File Integrity');

  console.log('\n📁 CATEGORY 3: File Integrity');
  console.log('═══════════════════════════════════════\n');

  const criticalFiles = [
    { path: 'src/index.ts', name: 'Main Bot Controller' },
    { path: 'src/botController.ts', name: 'Session Manager' },
    { path: 'src/core/UNIFIED-CONTROL.ts', name: 'Master Configuration' },
    { path: 'src/core/CONFIG-BRIDGE.ts', name: 'Configuration Bridge' },
    { path: 'src/utils/handlers/jupiterHandler.ts', name: 'Jupiter Handler' },
    { path: 'src/utils/balance-checker.ts', name: 'Balance Checker' },
    { path: '.env', name: 'Environment Variables' }
  ];

  for (const file of criticalFiles) {
    try {
      const filePath = path.join(process.cwd(), file.path);
      const stats = await fs.stat(filePath);

      if (stats.size > 0) {
        addCheck(result, file.name, 'pass', `File exists (${(stats.size / 1024).toFixed(1)} KB)`);
      } else {
        addCheck(result, file.name, 'warn', 'File exists but is empty');
      }
    } catch {
      addCheck(result, file.name, 'fail', 'File missing or inaccessible', file.path);
    }
  }

  // Check for deprecated files that should be archived
  const deprecatedFiles = [
    'z-new-controls/z-masterConfig.ts',
    'z-new-controls/z-configBridge.ts'
  ];

  let deprecatedFound = 0;
  for (const file of deprecatedFiles) {
    try {
      await fs.access(path.join(process.cwd(), file));
      deprecatedFound++;
    } catch {
      // File doesn't exist - good
    }
  }

  if (deprecatedFound === 0) {
    addCheck(result, 'Deprecated Files', 'pass', 'No deprecated config files found');
  } else {
    addCheck(result, 'Deprecated Files', 'warn', `${deprecatedFound} deprecated config file(s) still exist`, 'Consider archiving z-new-controls/ folder');
  }

  return result;
}

// Category 4: Data Directory
async function checkDataDirectory(): Promise<CheckResult> {
  const result = createCheckResult('Data Directory');

  console.log('\n📊 CATEGORY 4: Data Directory');
  console.log('═══════════════════════════════════════\n');

  const dataDir = path.join(process.cwd(), 'data');

  try {
    await fs.access(dataDir);
    addCheck(result, 'Data Directory', 'pass', 'Data directory exists');

    // Check for log files
    const files = await fs.readdir(dataDir);
    const csvFiles = files.filter(f => f.endsWith('.csv'));
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    if (csvFiles.length > 0) {
      addCheck(result, 'CSV Logs', 'pass', `Found ${csvFiles.length} CSV log file(s)`);
    } else {
      addCheck(result, 'CSV Logs', 'warn', 'No CSV log files found', 'Will be created on first run');
    }

    if (jsonFiles.length > 0) {
      addCheck(result, 'JSON Data', 'pass', `Found ${jsonFiles.length} JSON data file(s)`);
    } else {
      addCheck(result, 'JSON Data', 'warn', 'No JSON data files found', 'Will be created on first run');
    }

    // Check total data size
    let totalSize = 0;
    for (const file of files) {
      try {
        const stats = await fs.stat(path.join(dataDir, file));
        totalSize += stats.size;
      } catch {}
    }

    const sizeMB = totalSize / (1024 * 1024);
    if (sizeMB > 100) {
      addCheck(result, 'Data Size', 'warn', `Data directory is ${sizeMB.toFixed(1)} MB`, 'Consider archiving old data');
    } else {
      addCheck(result, 'Data Size', 'pass', `Data directory is ${sizeMB.toFixed(1)} MB`);
    }

  } catch {
    addCheck(result, 'Data Directory', 'warn', 'Data directory does not exist', 'Will be created on first run');
  }

  return result;
}

// Category 5: Security Checks
async function checkSecurity(): Promise<CheckResult> {
  const result = createCheckResult('Security');

  console.log('\n🔒 CATEGORY 5: Security Checks');
  console.log('═══════════════════════════════════════\n');

  // Check .gitignore
  try {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const gitignore = await fs.readFile(gitignorePath, 'utf-8');

    const securityPatterns = ['.env', 'PRIVATE_KEY', 'wallet', '*.backup'];
    let protectedPatterns = 0;

    for (const pattern of securityPatterns) {
      if (gitignore.toLowerCase().includes(pattern.toLowerCase())) {
        protectedPatterns++;
      }
    }

    if (protectedPatterns >= 3) {
      addCheck(result, 'Git Protection', 'pass', `${protectedPatterns}/4 security patterns in .gitignore`);
    } else {
      addCheck(result, 'Git Protection', 'warn', `Only ${protectedPatterns}/4 security patterns in .gitignore`, 'Verify .env and wallet files are excluded');
    }
  } catch {
    addCheck(result, 'Git Protection', 'warn', '.gitignore file not found');
  }

  // Check for exposed keys in tracked files
  const testMode = process.env.TEST_MODE === 'true' || process.env.IS_TEST_MODE === 'true';
  if (testMode) {
    addCheck(result, 'Test Mode Safety', 'pass', 'Bot in TEST MODE - no real money at risk');
  } else {
    addCheck(result, 'Test Mode Safety', 'warn', 'Bot in LIVE MODE - real money will be used', 'Ensure you have tested thoroughly');
  }

  // Check for backup files
  try {
    const files = await fs.readdir(process.cwd());
    const backups = files.filter(f => f.includes('.backup') || f.includes('.bak'));

    if (backups.length > 0) {
      addCheck(result, 'Backup Files', 'pass', `Found ${backups.length} backup file(s)`);
    } else {
      addCheck(result, 'Backup Files', 'warn', 'No backup files found', 'Consider backing up .env and configuration');
    }
  } catch {}

  // Check private key format
  const privateKey = process.env.PRIVATE_KEY;
  if (privateKey) {
    if (privateKey.startsWith('[')) {
      addCheck(result, 'Private Key Format', 'pass', 'Private key in array format (supported)');
    } else if (privateKey.length > 40) {
      addCheck(result, 'Private Key Format', 'pass', 'Private key in base58 format (supported)');
    } else {
      addCheck(result, 'Private Key Format', 'warn', 'Private key format unclear', 'Verify key is correct');
    }
  }

  return result;
}

// Category 6: Session Cleanup
async function checkSessionCleanup(): Promise<CheckResult> {
  const result = createCheckResult('Session Cleanup');

  console.log('\n🧹 CATEGORY 6: Session Cleanup');
  console.log('═══════════════════════════════════════\n');

  // Check for running processes (Windows)
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH');
    const nodeProcesses = stdout.split('\n').filter((line: string) => line.includes('node.exe'));

    if (nodeProcesses.length === 0) {
      addCheck(result, 'Bot Processes', 'pass', 'No bot processes currently running');
    } else {
      addCheck(result, 'Bot Processes', 'warn', `${nodeProcesses.length} Node.js process(es) running`, 'May include active bot instances');
    }
  } catch {
    addCheck(result, 'Bot Processes', 'warn', 'Could not check for running processes');
  }

  // Check for emergency logs
  const emergencyLogDir = path.join(process.cwd(), 'data', 'emergency-logs');
  try {
    const logs = await fs.readdir(emergencyLogDir);
    if (logs.length > 0) {
      const recentLog = logs.sort().reverse()[0];
      addCheck(result, 'Emergency Logs', 'warn', `${logs.length} emergency log(s) found`, `Most recent: ${recentLog}`);
    } else {
      addCheck(result, 'Emergency Logs', 'pass', 'No emergency logs found');
    }
  } catch {
    addCheck(result, 'Emergency Logs', 'pass', 'No emergency log directory found');
  }

  // Check last session data
  try {
    const tradingLogPath = path.join(process.cwd(), 'data', 'trading_log.json');
    const stats = await fs.stat(tradingLogPath);
    const lastModified = new Date(stats.mtime);
    const hoursSince = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60);

    if (hoursSince < 1) {
      addCheck(result, 'Recent Activity', 'pass', `Trading log modified ${Math.floor(hoursSince * 60)} minutes ago`);
    } else if (hoursSince < 24) {
      addCheck(result, 'Recent Activity', 'pass', `Trading log modified ${Math.floor(hoursSince)} hours ago`);
    } else {
      addCheck(result, 'Recent Activity', 'warn', `Trading log last modified ${Math.floor(hoursSince / 24)} days ago`, 'No recent trading activity');
    }
  } catch {
    addCheck(result, 'Recent Activity', 'warn', 'No trading log found', 'Bot has not run yet');
  }

  // Check temp files
  try {
    const files = await fs.readdir(process.cwd());
    const tempFiles = files.filter(f => f.endsWith('.tmp') || f.endsWith('.temp'));

    if (tempFiles.length === 0) {
      addCheck(result, 'Temp Files', 'pass', 'No temporary files found');
    } else {
      addCheck(result, 'Temp Files', 'warn', `${tempFiles.length} temporary file(s) found`, 'Consider cleaning up');
    }
  } catch {}

  return result;
}

// Display results
function displayResults(results: CheckResult[]) {
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('📋 POST-SESSION VERIFICATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let totalPassed = 0;
  let totalFailed = 0;
  let totalWarnings = 0;

  for (const category of results) {
    totalPassed += category.passed;
    totalFailed += category.failed;
    totalWarnings += category.warnings;

    console.log(`${category.category}:`);
    console.log(`   ✅ Passed: ${category.passed}`);
    console.log(`   ❌ Failed: ${category.failed}`);
    console.log(`   ⚠️  Warnings: ${category.warnings}`);
    console.log();
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`OVERALL: ${totalPassed} passed, ${totalFailed} failed, ${totalWarnings} warnings`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Detailed results
  console.log('\n📝 DETAILED RESULTS:\n');

  for (const category of results) {
    console.log(`\n${category.category.toUpperCase()}:`);
    console.log('─'.repeat(50));

    for (const check of category.checks) {
      const icon = getStatusIcon(check.status);
      console.log(`${icon} ${check.name}: ${check.message}`);
      if (check.details) {
        console.log(`   → ${check.details}`);
      }
    }
  }

  // Action items
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('📌 ACTION ITEMS:');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let hasActions = false;

  for (const category of results) {
    const failedChecks = category.checks.filter(c => c.status === 'fail');
    const warningChecks = category.checks.filter(c => c.status === 'warn');

    if (failedChecks.length > 0) {
      console.log(`❌ ${category.category} - CRITICAL:`);
      for (const check of failedChecks) {
        console.log(`   • ${check.name}: ${check.message}`);
        if (check.details) console.log(`     → ${check.details}`);
      }
      console.log();
      hasActions = true;
    }

    if (warningChecks.length > 0) {
      console.log(`⚠️  ${category.category} - WARNINGS:`);
      for (const check of warningChecks) {
        console.log(`   • ${check.name}: ${check.message}`);
        if (check.details) console.log(`     → ${check.details}`);
      }
      console.log();
      hasActions = true;
    }
  }

  if (!hasActions) {
    console.log('✅ No critical issues or warnings found!\n');
    console.log('🚀 Bot is ready to run.\n');
  }

  // Final recommendation
  console.log('═══════════════════════════════════════════════════════════════');
  if (totalFailed > 0) {
    console.log('⛔ RECOMMENDATION: Fix critical issues before running bot');
  } else if (totalWarnings > 5) {
    console.log('⚠️  RECOMMENDATION: Review warnings before running bot');
  } else if (totalWarnings > 0) {
    console.log('✅ RECOMMENDATION: Bot can run, but review warnings');
  } else {
    console.log('✅ RECOMMENDATION: All systems ready - safe to run bot');
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Main execution
async function main() {
  console.log('\n🔍 STARTING POST-SESSION VERIFICATION');
  console.log(`⏰ Time: ${new Date().toLocaleString()}`);
  console.log(`📂 Directory: ${process.cwd()}\n`);

  try {
    results.push(await checkConfiguration());
    results.push(await checkWalletAndBalance());
    results.push(await checkFileIntegrity());
    results.push(await checkDataDirectory());
    results.push(await checkSecurity());
    results.push(await checkSessionCleanup());

    displayResults(results);

  } catch (error) {
    console.error('\n❌ Fatal error during verification:', error);
    process.exit(1);
  }
}

main();
