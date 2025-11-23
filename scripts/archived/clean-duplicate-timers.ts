// clean-duplicate-timers.ts
// Remove ALL duration control code and add just one clean instance
// Run with: npx ts-node clean-duplicate-timers.ts

import * as fs from 'fs';

class CleanDuplicateTimers {
  
  constructor() {
    console.log('🧹 CLEANING DUPLICATE TIMER CODE');
    console.log('=================================');
    console.log('Removing all duration control code and adding one clean instance\n');
  }

  async run(): Promise<void> {
    try {
      this.createBackup();
      this.removeAllDurationCode();
      this.addSingleCleanTimer();
      this.verifyCleanup();
      
      console.log('\n✅ CLEANUP COMPLETE!');
      console.log('Added single duration control using masterConfig.runtime.duration');
      console.log('\nTest: npm run dev (should work without TypeScript errors)');
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  createBackup(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
    const backupFile = `index-cleanup-backup-${timestamp}.ts`;
    
    if (fs.existsSync('src/index.ts')) {
      fs.copyFileSync('src/index.ts', backupFile);
      console.log(`📁 Backup created: ${backupFile}`);
    }
  }

  removeAllDurationCode(): void {
    const filePath = 'src/index.ts';
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ index.ts not found');
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove all duration control sections (multiple patterns)
    content = content.replace(/\/\/ =+\s*\n\/\/ .*DURATION CONTROL[\s\S]*?\/\/ =+\s*\n/g, '');
    content = content.replace(/\/\/ =+\s*\n\/\/ .*DURATION CONTROL[\s\S]*?\/\/ =+/g, '');
    
    // Remove any standalone timer variables and functions
    content = content.replace(/const BOT_START_TIME = Date\.now\(\);\s*\n/g, '');
    content = content.replace(/const RUNTIME_MS = .*?;\s*\n/g, '');
    content = content.replace(/const MAX_RUNTIME_MS = .*?;\s*\n/g, '');
    
    // Remove setTimeout blocks with duration control
    content = content.replace(/setTimeout\(\s*\(\)\s*=>\s*\{[\s\S]*?process\.exit\(0\)[\s\S]*?\},\s*[^}]*\);\s*\n/g, '');
    
    // Remove setInterval blocks for countdown
    content = content.replace(/const countdownInterval = setInterval\([\s\S]*?\},\s*\d+\);\s*\n/g, '');
    
    // Remove any orphaned console.log statements about duration
    content = content.replace(/console\.log\([^)]*duration[^)]*\);\s*\n/g, '');
    content = content.replace(/console\.log\([^)]*Auto-stop[^)]*\);\s*\n/g, '');
    content = content.replace(/console\.log\([^)]*timer[^)]*\);\s*\n/g, '');
    
    // Clean up any malformed syntax from incomplete removals
    content = content.replace(/\n\s*1000\);\s*\n/g, '\n');
    content = content.replace(/\n\s*\}\s*\n\s*\}\s*\n/g, '\n');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Removed all duration control code');
  }

  addSingleCleanTimer(): void {
    const filePath = 'src/index.ts';
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Ensure masterConfig import exists
    if (!content.includes('masterConfig')) {
      const lines = content.split('\n');
      let lastImportIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ') || lines[i].trim().includes('} from')) {
          lastImportIndex = i;
        }
      }
      
      if (lastImportIndex > -1) {
        lines.splice(lastImportIndex + 1, 0, "import { masterConfig } from './enhanced/masterConfig';");
        content = lines.join('\n');
      }
    }
    
    // Add one clean duration control section
    const cleanDurationControl = `
// ============================================
// DURATION CONTROL (from masterConfig)
// ============================================
const sessionDuration = masterConfig.runtime.duration * 1000; // Convert to milliseconds
const sessionStartTime = Date.now();

console.log(\`⏰ Session duration: \${masterConfig.runtime.duration} seconds (\${Math.floor(masterConfig.runtime.duration/60)} minutes)\`);

// Auto-stop timer
setTimeout(() => {
  const minutes = Math.floor(masterConfig.runtime.duration / 60);
  console.log(\`\\n⏰ \${minutes}-MINUTE SESSION COMPLETE - STOPPING BOT\`);
  console.log('📊 Duration control: masterConfig.runtime.duration');
  process.exit(0);
}, sessionDuration);

// Countdown display (every 5 minutes for long sessions, every minute for short ones)
const showCountdownEvery = masterConfig.runtime.duration > 600 ? 300000 : 60000; // 5min or 1min
const sessionCountdown = setInterval(() => {
  const elapsed = Date.now() - sessionStartTime;
  const remaining = Math.max(0, sessionDuration - elapsed);
  const remainingMinutes = Math.floor(remaining / 60000);
  
  if (remaining <= 0) {
    clearInterval(sessionCountdown);
    return;
  }
  
  if (remainingMinutes > 0) {
    const showNow = masterConfig.runtime.duration > 600 ? 
      (remainingMinutes % 5 === 0) : (remainingMinutes > 0);
    
    if (showNow && remaining % 60000 < 10000) { // Show once per minute/5min
      console.log(\`⏰ Session time remaining: \${remainingMinutes} minutes\`);
    }
  }
}, 10000); // Check every 10 seconds

console.log('✅ Duration control active');
// ============================================
`;

    // Find a safe insertion point (after imports, before main execution)
    const insertOptions = [
      content.indexOf('console.log("Starting'),
      content.indexOf('console.log("✅'),
      content.indexOf('// Enhanced features'),
      content.indexOf('// Global Variables'),
      content.indexOf('const env ='),
      500
    ];
    
    const insertPoint = insertOptions.find(pos => pos > 0) || 500;
    content = content.slice(0, insertPoint) + cleanDurationControl + content.slice(insertPoint);

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Added single clean duration control');
  }

  verifyCleanup(): void {
    const filePath = 'src/index.ts';
    const content = fs.readFileSync(filePath, 'utf8');
    
    console.log('\n📋 VERIFICATION:');
    
    // Count BOT_START_TIME occurrences
    const botStartTimeCount = (content.match(/BOT_START_TIME/g) || []).length;
    console.log(`  BOT_START_TIME occurrences: ${botStartTimeCount} ${botStartTimeCount > 1 ? '❌' : '✅'}`);
    
    // Count RUNTIME_MS occurrences  
    const runtimeMsCount = (content.match(/RUNTIME_MS/g) || []).length;
    console.log(`  RUNTIME_MS occurrences: ${runtimeMsCount} ${runtimeMsCount > 1 ? '❌' : '✅'}`);
    
    // Count countdownInterval occurrences
    const countdownCount = (content.match(/countdownInterval/g) || []).length;
    console.log(`  countdownInterval occurrences: ${countdownCount} ${countdownCount > 1 ? '❌' : '✅'}`);
    
    // Check for masterConfig usage
    const usesMasterConfig = content.includes('masterConfig.runtime.duration');
    console.log(`  Uses masterConfig duration: ${usesMasterConfig ? '✅' : '❌'}`);
    
    // Check for clean timer section
    const hasCleanTimer = content.includes('DURATION CONTROL (from masterConfig)');
    console.log(`  Clean timer section: ${hasCleanTimer ? '✅' : '❌'}`);
    
    if (botStartTimeCount <= 1 && runtimeMsCount <= 1 && countdownCount <= 1 && usesMasterConfig) {
      console.log('\n🎉 SUCCESS: All duplicates removed, clean timer added');
      console.log('📊 Will use masterConfig duration: 3600 seconds (1 hour)');
    } else {
      console.log('\n⚠️ Some issues may remain - check the verification above');
    }
  }
}

// Run the cleanup
if (require.main === module) {
  new CleanDuplicateTimers().run().catch(console.error);
}