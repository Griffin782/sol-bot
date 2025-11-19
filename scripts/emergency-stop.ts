import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import { checkWalletBalance } from '../src/utils/balance-checker';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const execAsync = promisify(exec);

interface EmergencyLog {
  timestamp: string;
  reason: string;
  walletBalance: number;
  processesKilled: string[];
  balanceChange?: number;
}

// Kill all bot processes
async function killBotProcesses(): Promise<string[]> {
  const killedProcesses: string[] = [];

  try {
    console.log('🔍 Searching for running bot processes...\n');

    // Windows command to find Node.js processes running the bot
    const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH');

    const lines = stdout.split('\n').filter(line => line.includes('node.exe'));

    if (lines.length === 0) {
      console.log('✅ No bot processes found running\n');
      return killedProcesses;
    }

    console.log(`⚠️  Found ${lines.length} Node.js process(es) running`);
    console.log('⏸️  Attempting to stop all Node.js processes...\n');

    // Kill all node.exe processes (forceful approach for emergency stop)
    try {
      await execAsync('taskkill /F /IM node.exe');
      killedProcesses.push('node.exe (all instances)');
      console.log('✅ All Node.js processes terminated\n');
    } catch (killError) {
      console.log('⚠️  Some processes may have already exited\n');
    }

  } catch (error) {
    console.error('❌ Error killing processes:', error);
  }

  return killedProcesses;
}

// Get final wallet balance
async function getFinalBalance(): Promise<number> {
  try {
    const walletAddress = process.env.WALLET_ADDRESS;

    if (!walletAddress) {
      console.error('❌ No wallet address configured');
      return 0;
    }

    console.log('💰 Checking final wallet balance...\n');

    const balanceInfo = await checkWalletBalance(walletAddress, 0);

    console.log('═══════════════════════════════════════');
    console.log('💼 FINAL WALLET STATUS');
    console.log('═══════════════════════════════════════');
    console.log(`Address: ${balanceInfo.address}`);
    console.log(`Balance: ${balanceInfo.balanceSOL.toFixed(4)} SOL`);
    console.log(`        (${balanceInfo.balanceLamports.toLocaleString()} lamports)`);
    console.log('═══════════════════════════════════════\n');

    return balanceInfo.balanceSOL;

  } catch (error) {
    console.error('❌ Failed to get wallet balance:', error);
    return 0;
  }
}

// Create emergency log
async function createEmergencyLog(log: EmergencyLog): Promise<void> {
  try {
    const logsDir = path.join(process.cwd(), 'data', 'emergency-logs');

    // Create directory if it doesn't exist
    await fs.mkdir(logsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logsDir, `emergency-stop-${timestamp}.json`);

    await fs.writeFile(logFile, JSON.stringify(log, null, 2));

    console.log('📝 Emergency log created:');
    console.log(`   ${logFile}\n`);

  } catch (error) {
    console.error('❌ Failed to create emergency log:', error);
  }
}

// Load previous balance if available
async function getPreviousBalance(): Promise<number | null> {
  try {
    const logsDir = path.join(process.cwd(), 'data', 'emergency-logs');
    const files = await fs.readdir(logsDir);

    if (files.length === 0) return null;

    // Get most recent log
    const sortedFiles = files
      .filter(f => f.startsWith('emergency-stop-'))
      .sort()
      .reverse();

    if (sortedFiles.length === 0) return null;

    const lastLogFile = path.join(logsDir, sortedFiles[0]);
    const content = await fs.readFile(lastLogFile, 'utf-8');
    const lastLog: EmergencyLog = JSON.parse(content);

    return lastLog.walletBalance;

  } catch (error) {
    return null;
  }
}

// Main execution
async function main() {
  const startTime = new Date();

  console.log('\n🚨 EMERGENCY STOP INITIATED');
  console.log('═══════════════════════════════════════');
  console.log(`Time: ${startTime.toLocaleString()}`);
  console.log('═══════════════════════════════════════\n');

  // Step 1: Kill all bot processes
  const killedProcesses = await killBotProcesses();

  // Step 2: Get final balance
  const finalBalance = await getFinalBalance();

  // Step 3: Calculate balance change if possible
  const previousBalance = await getPreviousBalance();
  let balanceChange: number | undefined = undefined;

  if (previousBalance !== null) {
    balanceChange = finalBalance - previousBalance;

    console.log('📊 BALANCE COMPARISON');
    console.log('═══════════════════════════════════════');
    console.log(`Previous: ${previousBalance.toFixed(4)} SOL`);
    console.log(`Current:  ${finalBalance.toFixed(4)} SOL`);
    console.log(`Change:   ${balanceChange >= 0 ? '+' : ''}${balanceChange.toFixed(4)} SOL`);

    if (balanceChange < 0) {
      console.log(`⚠️  Loss: ${Math.abs(balanceChange).toFixed(4)} SOL`);
    } else if (balanceChange > 0) {
      console.log(`✅ Gain: ${balanceChange.toFixed(4)} SOL`);
    } else {
      console.log('➖ No change');
    }
    console.log('═══════════════════════════════════════\n');
  }

  // Step 4: Create emergency log
  const emergencyLog: EmergencyLog = {
    timestamp: startTime.toISOString(),
    reason: process.argv[2] || 'Manual emergency stop',
    walletBalance: finalBalance,
    processesKilled: killedProcesses,
    balanceChange: balanceChange
  };

  await createEmergencyLog(emergencyLog);

  // Final summary
  console.log('🏁 EMERGENCY STOP COMPLETE');
  console.log('═══════════════════════════════════════');
  console.log(`Processes Killed: ${killedProcesses.length > 0 ? killedProcesses.join(', ') : 'None'}`);
  console.log(`Final Balance: ${finalBalance.toFixed(4)} SOL`);
  console.log('═══════════════════════════════════════\n');

  console.log('✅ Safe to restart bot when ready\n');
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Fatal error during emergency stop:', error);
  process.exit(1);
});
