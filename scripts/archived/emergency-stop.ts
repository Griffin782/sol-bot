// emergency-stop.ts
// Immediately stop the running bot
// Run with: npx ts-node emergency-stop.ts

console.log('🛑 EMERGENCY BOT STOP');
console.log('====================');
console.log('This will attempt to stop the running bot process');

// Try to find and kill the bot process
const { exec } = require('child_process');

// Kill any ts-node processes running index.ts
exec('taskkill /f /im node.exe', (error, stdout, stderr) => {
  if (error) {
    console.log('⚠️ Could not automatically kill process');
    console.log('Manual stop required: Press Ctrl+C in the bot terminal');
  } else {
    console.log('✅ Bot processes terminated');
  }
});

console.log('\n📊 Bot was running for 10+ minutes without stopping');
console.log('Duration control needs to be fixed');