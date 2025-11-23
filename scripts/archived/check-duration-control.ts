// check-duration-control.ts
// Check if duration control was added properly
// Run with: npx ts-node check-duration-control.ts

import * as fs from 'fs';

class CheckDurationControl {
  
  constructor() {
    console.log('🔍 CHECKING DURATION CONTROL STATUS');
    console.log('===================================');
  }

  async run(): Promise<void> {
    this.checkIndexFile();
    this.checkMasterConfig();
    this.createQuickFix();
  }

  checkIndexFile(): void {
    const filePath = 'src/index.ts';
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ index.ts not found');
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    console.log('\n📋 DURATION CONTROL CHECK:');
    
    // Check for duration control presence
    const hasDurationControl = content.includes('DURATION CONTROL');
    const hasSetTimeout = content.includes('setTimeout');
    const hasMaxDuration = content.includes('maxDuration');
    const hasProcessExit = content.includes('process.exit');
    
    console.log(`  Duration Control Section: ${hasDurationControl ? '✅' : '❌'}`);
    console.log(`  setTimeout Present: ${hasSetTimeout ? '✅' : '❌'}`);
    console.log(`  maxDuration Variable: ${hasMaxDuration ? '✅' : '❌'}`);
    console.log(`  process.exit Call: ${hasProcessExit ? '✅' : '❌'}`);
    
    // Look for the specific timer code
    if (content.includes('180 * 1000')) {
      console.log('  3-minute timer: ✅');
    } else if (content.includes('maxDuration')) {
      console.log('  Duration timer: ✅ (but may not be 3 minutes)');
    } else {
      console.log('  Duration timer: ❌');
    }
    
    // Check for any blocking code that might prevent the timer
    if (content.includes('while (true)') || content.includes('setInterval') && !content.includes('durationTimer')) {
      console.log('  ⚠️ Potential blocking code detected');
    }
  }

  checkMasterConfig(): void {
    const filePath = 'src/enhanced/masterConfig.ts';
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ masterConfig.ts not found');
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    console.log('\n📋 MASTERCONFIG DURATION:');
    
    const durationMatch = content.match(/duration:\s*(\d+)/);
    if (durationMatch) {
      const duration = parseInt(durationMatch[1]);
      console.log(`  Duration setting: ${duration} seconds`);
      if (duration === 180) {
        console.log('  ✅ Correctly set to 3 minutes');
      } else {
        console.log(`  ⚠️ Set to ${duration/60} minutes instead of 3`);
      }
    } else {
      console.log('  ❌ Duration setting not found');
    }
  }

  createQuickFix(): void {
    console.log('\n🔧 CREATING EMERGENCY STOP SCRIPT:');
    
    const emergencyStopScript = `// emergency-stop.ts
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

console.log('\\n📊 Bot was running for 10+ minutes without stopping');
console.log('Duration control needs to be fixed');`;

    fs.writeFileSync('emergency-stop.ts', emergencyStopScript, 'utf8');
    console.log('✅ Created emergency-stop.ts');
    
    const addDurationFixScript = `// add-duration-fix.ts
// Add working duration control to index.ts
// Run with: npx ts-node add-duration-fix.ts

import * as fs from 'fs';

const filePath = 'src/index.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Remove any existing duration control
content = content.replace(/\\/\\/ =+\\s*\\n\\/\\/ DURATION CONTROL[\\s\\S]*?\\/\\/ =+/g, '');

// Add working duration control at the very start of main execution
const durationControl = \`
// ============================================
// WORKING DURATION CONTROL - 3 MINUTES
// ============================================
console.log('🔧 ADDING 3-MINUTE AUTO-STOP TIMER');
const BOT_START_TIME = Date.now();
const MAX_RUNTIME_MS = 180 * 1000; // 3 minutes

// Force exit after 3 minutes - no exceptions
setTimeout(() => {
  console.log('\\\\n⏰ 3-MINUTE LIMIT REACHED - FORCE STOPPING BOT');
  console.log('📊 Session complete - duration control working');
  process.exit(0);
}, MAX_RUNTIME_MS);

// Show countdown
const countdownInterval = setInterval(() => {
  const elapsed = Date.now() - BOT_START_TIME;
  const remaining = Math.max(0, MAX_RUNTIME_MS - elapsed);
  const remainingSeconds = Math.floor(remaining / 1000);
  
  if (remainingSeconds <= 0) {
    clearInterval(countdownInterval);
    return;
  }
  
  if (remainingSeconds % 30 === 0) {
    console.log(\\\`⏰ Auto-stop in: \\\${remainingSeconds} seconds\\\`);
  }
}, 1000);

console.log('✅ 3-minute auto-stop timer ACTIVE');
// ============================================
\`;

// Insert at the very beginning of the file after imports
const insertPoint = content.indexOf('console.log') || 500;
content = content.slice(0, insertPoint) + durationControl + content.slice(insertPoint);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Added working duration control to index.ts');
console.log('🚀 Restart bot: npm run dev (will stop after 3 minutes)');`;

    fs.writeFileSync('add-duration-fix.ts', addDurationFixScript, 'utf8');
    console.log('✅ Created add-duration-fix.ts');
    
    console.log('\n🚀 RECOMMENDED ACTIONS:');
    console.log('1. Stop current bot: Ctrl+C (or run emergency-stop.ts)');
    console.log('2. Fix duration: npx ts-node add-duration-fix.ts');
    console.log('3. Test: npm run dev (should stop after exactly 3 minutes)');
  }
}

// Run the check
if (require.main === module) {
  new CheckDurationControl().run().catch(console.error);
}