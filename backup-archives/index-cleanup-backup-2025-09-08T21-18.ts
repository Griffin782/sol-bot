// index.ts - SOL-BOT v5.0 with Pool Integration, Wallet Rotation & Tax Management
// MUST BE FIRST - Config Bridge Import
import * as CFG from './configBridge';
import { botController, getCurrentSessionInfo, getCurrentTradingParams, getActiveConfidenceLevel, shouldPauseTrading, logTradeResult } from './botController';
import { masterConfig } from './enhanced/masterConfig';


console.log('🔧 ADDING 3-MINUTE AUTO-STOP TIMER');
const BOT_START_TIME = Date.now();
const MAX_RUNTIME_MS = 180 * 1000; // 3 minutes

// Force exit after 3 minutes - no exceptions
 1000);

console.log('✅ Duration control active - 3 minute timer started\n');
// ============================================


console.log('🔧 Setting up duration control from masterConfig');
console.log(`⏰ Bot will run for: ${masterConfig.runtime.duration} seconds (${Math.floor(masterConfig.runtime.duration/60)} minutes)`);

const BOT_START_TIME = Date.now();
const RUNTIME_MS = masterConfig.runtime.duration * 1000;

// Auto-stop based on masterConfig setting
setTimeout(() => {
  const durationMinutes = Math.floor(masterConfig.runtime.duration / 60);
  console.log(`\n⏰ ${durationMinutes}-MINUTE DURATION REACHED - STOPPING BOT`);
  console.log('📊 Session complete - masterConfig duration control active');
  process.exit(0);
}, RUNTIME_MS);

// Show periodic countdown
const countdownInterval = setInterval(() => {
  const elapsed = Date.now() - BOT_START_TIME;
  const remaining = Math.max(0, RUNTIME_MS - elapsed);
  const remainingMinutes = Math.floor(remaining / 60000);
  
  if (remaining <= 0) {
    clearInterval(countdownInterval);
    return;
  }
  
  // Show countdown every 5 minutes for long sessions, every minute for short ones
  const interval = masterConfig.runtime.duration > 600 ? 300000 : 60000; // 5 min or 1 min
  const showCountdown = masterConfig.runtime.duration > 600 ? 
    (remainingMinutes % 5 === 0 && remaining % 60000 < 5000) :
    (remaining % 60000 < 5000);
    
  if (showCountdown && remainingMinutes > 0) {
    console.log(`⏰ Auto-stop in: ${remainingMinutes} minutes`);
  }
}, 5000);

console.log('✅ MasterConfig duration control active');
// ============================================

// ============================================
// CONFIG-BASED DURATION CONTROL
// ============================================
console.log('🔧 Setting up duration control from masterConfig');
console.log(`⏰ Bot will run for: ${masterConfig.runtime.duration} seconds (${Math.floor(masterConfig.runtime.duration/60)} minutes)`);

const BOT_START_TIME = Date.now();
const RUNTIME_MS = masterConfig.runtime.duration * 1000;

// Auto-stop based on masterConfig setting
setTimeout(() => {
  const durationMinutes = Math.floor(masterConfig.runtime.duration / 60);
  console.log(`\n⏰ ${durationMinutes}-MINUTE DURATION REACHED - STOPPING BOT`);
  console.log('📊 Session complete - masterConfig duration control active');
  process.exit(0);
}, RUNTIME_MS);

// Show periodic countdown
const countdownInterval = setInterval(() => {
  const elapsed = Date.now() - BOT_START_TIME;
  const remaining = Math.max(0, RUNTIME_MS - elapsed);
  const remainingMinutes = Math.floor(remaining / 60000);
  
  if (remaining <= 0) {
    clearInterval(countdownInterval);
    return;
  }
  
  // Show countdown every 5 minutes for long sessions, every minute for short ones
  const interval = masterConfig.runtime.duration > 600 ? 300000 : 60000; // 5 min or 1 min
  const showCountdown = masterConfig.runtime.duration > 600 ? 
    (remainingMinutes % 5 === 0 && remaining % 60000 < 5000) :
    (remaining % 60000 < 5000);
    
  if (showCountdown && remainingMinutes > 0) {
    console.log(`⏰ Auto-stop in: ${remainingMinutes} minutes`);
  }
}, 5000);

console.log('✅ MasterConfig duration control active');
// ============================================
}