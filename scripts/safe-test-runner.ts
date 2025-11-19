import dotenv from 'dotenv';
import { spawn, ChildProcess } from 'child_process';
import { checkWalletBalance } from '../src/utils/balance-checker';
import { Connection, PublicKey } from '@solana/web3.js';

dotenv.config();

// Test configuration
const MAX_DETECTIONS = 5;
const MAX_DURATION_MS = 2 * 60 * 1000; // 2 minutes
const MIN_BALANCE_SOL = 0.005;
const BALANCE_CHECK_INTERVAL_MS = 10 * 1000; // 10 seconds
const MAX_BALANCE_DROP_SOL = 0.001;

interface TestStats {
  tokensDetected: number;
  tokensBlocked: number;
  startBalance: number;
  currentBalance: number;
  startTime: number;
  testMode: boolean;
}

const stats: TestStats = {
  tokensDetected: 0,
  tokensBlocked: 0,
  startBalance: 0,
  currentBalance: 0,
  startTime: Date.now(),
  testMode: false
};

let botProcess: ChildProcess | null = null;
let balanceMonitor: NodeJS.Timeout | null = null;

// Display formatted header
function displayHeader() {
  console.log('\n🧪 SAFE TEST MODE - AUTO-STOP ENABLED');
  console.log('═══════════════════════════════════════');
  console.log(`Balance: ${stats.currentBalance.toFixed(4)} SOL`);
  console.log(`Test Mode: ${stats.testMode ? '✅ ENABLED' : '❌ DISABLED'}`);
  console.log(`Max Detections: ${MAX_DETECTIONS}`);
  console.log(`Max Duration: 2 minutes`);
  console.log(`Balance Protection: Stop if drops > ${MAX_BALANCE_DROP_SOL} SOL`);
  console.log('═══════════════════════════════════════\n');
}

// Display current stats
function displayStats() {
  const elapsed = Math.floor((Date.now() - stats.startTime) / 1000);
  const balanceDrop = stats.startBalance - stats.currentBalance;

  console.log('\n📊 CURRENT STATS:');
  console.log(`   Time Elapsed: ${elapsed}s / 120s`);
  console.log(`   Tokens Detected: ${stats.tokensDetected} / ${MAX_DETECTIONS}`);
  console.log(`   Current Balance: ${stats.currentBalance.toFixed(4)} SOL`);
  console.log(`   Balance Change: ${balanceDrop >= 0 ? '-' : '+'}${Math.abs(balanceDrop).toFixed(4)} SOL`);
}

// Display final summary
function displaySummary(reason: string) {
  const elapsed = Math.floor((Date.now() - stats.startTime) / 1000);
  const balanceDrop = stats.startBalance - stats.currentBalance;

  console.log('\n\n🏁 TEST COMPLETE');
  console.log('═══════════════════════════════════════');
  console.log(`Stop Reason: ${reason}`);
  console.log(`Total Duration: ${elapsed}s`);
  console.log(`Tokens Detected: ${stats.tokensDetected}`);
  console.log(`Starting Balance: ${stats.startBalance.toFixed(4)} SOL`);
  console.log(`Ending Balance: ${stats.currentBalance.toFixed(4)} SOL`);
  console.log(`Balance Change: ${balanceDrop >= 0 ? '-' : '+'}${Math.abs(balanceDrop).toFixed(4)} SOL`);

  if (balanceDrop > 0) {
    console.log(`⚠️  WARNING: Balance decreased by ${balanceDrop.toFixed(4)} SOL`);
  } else if (balanceDrop < 0) {
    console.log(`✅ Balance increased by ${Math.abs(balanceDrop).toFixed(4)} SOL`);
  } else {
    console.log('✅ No balance change');
  }
  console.log('═══════════════════════════════════════\n');
}

// Stop the bot and cleanup
async function stopBot(reason: string) {
  console.log(`\n⏸️  Stopping bot: ${reason}`);

  // Clear balance monitor
  if (balanceMonitor) {
    clearInterval(balanceMonitor);
    balanceMonitor = null;
  }

  // Kill bot process
  if (botProcess) {
    botProcess.kill('SIGTERM');

    // Wait for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (botProcess && !botProcess.killed) {
      console.log('⚠️  Forcing bot shutdown...');
      botProcess.kill('SIGKILL');
    }
  }

  // Get final balance
  try {
    const walletAddress = process.env.WALLET_ADDRESS;
    if (walletAddress) {
      const balanceInfo = await checkWalletBalance(walletAddress, MIN_BALANCE_SOL);
      stats.currentBalance = balanceInfo.balanceSOL;
    }
  } catch (error) {
    console.error('❌ Failed to get final balance:', error);
  }

  displaySummary(reason);
  process.exit(0);
}

// Monitor balance
async function monitorBalance() {
  try {
    const walletAddress = process.env.WALLET_ADDRESS;
    if (!walletAddress) {
      console.error('❌ No wallet address configured');
      return;
    }

    const balanceInfo = await checkWalletBalance(walletAddress, MIN_BALANCE_SOL);
    stats.currentBalance = balanceInfo.balanceSOL;

    const balanceDrop = stats.startBalance - stats.currentBalance;

    if (balanceDrop > MAX_BALANCE_DROP_SOL) {
      await stopBot(`Balance dropped by ${balanceDrop.toFixed(4)} SOL (limit: ${MAX_BALANCE_DROP_SOL} SOL)`);
    }

  } catch (error) {
    console.error('❌ Balance check failed:', error);
  }
}

// Main execution
async function main() {
  console.log('\n🔍 PRE-FLIGHT CHECKS...\n');

  // Check 1: TEST_MODE must be true
  const testMode = process.env.TEST_MODE === 'true' || process.env.IS_TEST_MODE === 'true';
  stats.testMode = testMode;

  if (!testMode) {
    console.error('❌ SAFETY CHECK FAILED: TEST_MODE is not enabled!');
    console.error('   This script only works in test mode.');
    console.error('   Set TEST_MODE=true in your .env file\n');
    process.exit(1);
  }
  console.log('✅ Test mode enabled');

  // Check 2: Wallet balance must be >= MIN_BALANCE_SOL
  const walletAddress = process.env.WALLET_ADDRESS;
  if (!walletAddress) {
    console.error('❌ SAFETY CHECK FAILED: No wallet address configured\n');
    process.exit(1);
  }

  try {
    const balanceInfo = await checkWalletBalance(walletAddress, MIN_BALANCE_SOL);
    stats.startBalance = balanceInfo.balanceSOL;
    stats.currentBalance = balanceInfo.balanceSOL;

    if (!balanceInfo.hasSufficientBalance) {
      console.error(`❌ SAFETY CHECK FAILED: Insufficient balance`);
      console.error(`   Current: ${balanceInfo.balanceSOL.toFixed(4)} SOL`);
      console.error(`   Required: ${MIN_BALANCE_SOL.toFixed(4)} SOL\n`);
      process.exit(1);
    }
    console.log(`✅ Balance check passed: ${balanceInfo.balanceSOL.toFixed(4)} SOL`);

  } catch (error) {
    console.error('❌ SAFETY CHECK FAILED: Could not check wallet balance');
    console.error(error);
    process.exit(1);
  }

  console.log('\n✅ All pre-flight checks passed!\n');

  // Display header
  displayHeader();

  // Setup Ctrl+C handler
  process.on('SIGINT', async () => {
    console.log('\n\n⚠️  Emergency stop triggered (Ctrl+C)');
    await stopBot('User interrupted (Ctrl+C)');
  });

  // Setup time-based auto-stop
  setTimeout(async () => {
    await stopBot(`Maximum duration reached (${MAX_DURATION_MS / 1000}s)`);
  }, MAX_DURATION_MS);

  // Start balance monitoring
  balanceMonitor = setInterval(monitorBalance, BALANCE_CHECK_INTERVAL_MS);

  console.log('🚀 Starting bot...\n');

  // Start the bot process
  botProcess = spawn('npx', ['ts-node', 'src/index.ts'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: true
  });

  botProcess.on('exit', async (code) => {
    console.log(`\n⚠️  Bot process exited with code ${code}`);
    await stopBot(`Bot process exited (code: ${code})`);
  });

  botProcess.on('error', async (error) => {
    console.error('\n❌ Bot process error:', error);
    await stopBot(`Bot process error: ${error.message}`);
  });

  // Monitor bot output for token detections (optional enhancement)
  // Note: This requires parsing bot output, which depends on bot's logging format
}

// Run the script
main().catch(async (error) => {
  console.error('\n❌ Fatal error:', error);
  await stopBot(`Fatal error: ${error.message}`);
});
