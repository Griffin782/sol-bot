// start-with-z.ts - Run existing bot with z-configuration control
import * as z_bridge from './z-new-controls/z-configBridge';
import { resetSessionTracking } from './src/secure-pool-system';
import { initializeSecurePool } from './src/secure-pool-system';
import { z_config } from './z-new-controls/z-masterConfig';

// During startup
async function startBot() {
  // Initialize secure pool
  await initializeSecurePool();
  
  // Check if we should reset session tracking
  if (z_config.z_resetSessionOnStart) {
    resetSessionTracking();
  }
  
  console.log('='.repeat(60));
  console.log('🚀 STARTING FULL BOT WITH Z-CONFIGURATION CONTROL');
  console.log('='.repeat(60));
  console.log(`Duration Control: ${z_bridge.z_DURATION} seconds`);
  console.log(`Initial Pool: $${z_bridge.z_INITIAL_POOL}`);
  console.log(`Target Pool: $${z_bridge.z_TARGET_POOL}`);
  console.log(`Position Size: ${z_bridge.z_POSITION_SIZE} SOL`);
  console.log(`Test Mode: ${z_bridge.z_TEST_MODE ? 'ENABLED' : 'DISABLED'}`);
  console.log('='.repeat(60));

  // Set duration control
  const startTime = Date.now();
  let shutdownInitiated = false;

  if (z_bridge.z_DURATION > 0) {
    console.log(`\n⏰ Bot will automatically stop after ${z_bridge.z_DURATION} seconds\n`);
    
    // Primary shutdown timer
    setTimeout(() => {
      if (!shutdownInitiated) {
        shutdownInitiated = true;
        const runtime = Math.floor((Date.now() - startTime) / 1000);
        console.log('\n' + '='.repeat(60));
        console.log('⏰ Z-CONFIGURATION DURATION REACHED');
        console.log(`Runtime: ${runtime} seconds`);
        console.log('Shutting down gracefully...');
        console.log('='.repeat(60));
        
        // Give 2 seconds for cleanup then force exit
        setTimeout(() => process.exit(0), 2000);
      }
    }, z_bridge.z_DURATION * 1000);
    
    // Progress logger every 20 seconds
    setInterval(() => {
      if (!shutdownInitiated) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = z_bridge.z_DURATION - elapsed;
        console.log(`⏱️ Duration Progress: ${elapsed}/${z_bridge.z_DURATION} seconds (${remaining}s remaining)`);
      }
    }, 20000);
  }

  // Import and start your existing bot
  console.log('\nStarting trading bot...\n');
  require('./src/index');
}

// Call the startBot function
startBot().catch(error => {
  console.error('Error starting bot:', error);
  process.exit(1);
});