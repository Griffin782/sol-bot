// index.ts - SOL-BOT v5.0 with Pool Integration, Wallet Rotation & Tax Management
// MUST BE FIRST - Config Bridge Import
import * as CFG from './configBridge';
import { botController, getCurrentSessionInfo, getCurrentTradingParams, getActiveConfidenceLevel, shouldPauseTrading, logTradeResult } from './botController';
import { masterConfig } from './enhanced/masterConfig';

console.log('🔧 ADDING 3-MINUTE AUTO-STOP TIMER');
const MAX_RUNTIME_MS = 180 * 1000; // 3 minutes

// Force exit after 3 minutes - no exceptions
 1000);

console.log('✅ Duration control active - 3 minute timer started\n');
// ============================================

console.log('🔧 Setting up duration control from masterConfig');
console.log(`⏰ Bot will run for: ${masterConfig.runtime.duration} seconds (${Math.floor(masterConfig.runtime.duration/60)} minutes)`);

// Auto-stop based on masterConfig setting
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

console.log('🔧 Setting up duration control from masterConfig');
console.log(`⏰ Bot will run for: ${masterConfig.runtime.duration} seconds (${Math.floor(masterConfig.runtime.duration/60)} minutes)`);

// Auto-stop based on masterConfig setting
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
// DURATION CONTROL (from masterConfig)
// ============================================
const botStartTime = Date.now();
const runtimeMs = masterConfig.runtime.duration * 1000;
const durationMinutes = Math.floor(masterConfig.runtime.duration / 60);

console.log(`⏰ Bot will run for: ${masterConfig.runtime.duration} seconds (${durationMinutes} minutes)`);

// Auto-stop timer
setTimeout(() => {
  console.log(`\n⏰ ${durationMinutes}-MINUTE DURATION REACHED - STOPPING BOT`);
  console.log('📊 Session complete - masterConfig duration control');
  process.exit(0);
}, runtimeMs);

// Countdown timer (every 5 minutes for long sessions, every minute for short)
const countdownFreq = masterConfig.runtime.duration > 600 ? 300000 : 60000;
const durationCountdown = setInterval(() => {
  const elapsed = Date.now() - botStartTime;
  const remaining = Math.max(0, runtimeMs - elapsed);
  const remainingMin = Math.floor(remaining / 60000);
  
  if (remaining <= 0) {
    clearInterval(durationCountdown);
    return;
  }
  
  if (remaining % countdownFreq < 5000 && remainingMin > 0) {
    console.log(`⏰ Auto-stop in: ${remainingMin} minutes`);
  }
}, 5000);

console.log('✅ Duration control active');
// ============================================

}