// cleanup-duration-duplicates.ts
// Remove all duplicate duration controls and add one clean version
// Run with: npx ts-node cleanup-duration-duplicates.ts

import * as fs from 'fs';

class CleanupDurationDuplicates {
  
  constructor() {
    console.log('🧹 CLEANING UP DURATION CONTROL DUPLICATES');
    console.log('==========================================');
    console.log('Removing all duration controls and adding one clean version\n');
  }

  async run(): Promise<void> {
    try {
      this.createBackup();
      this.removeAllDurationControls();
      this.addSingleCleanDurationControl();
      this.verifyCleanup();
      
      console.log('\n✅ CLEANUP COMPLETE!');
      console.log('Single masterConfig-based duration control added');
      console.log('\nTest: npm run dev (should use 1-hour duration from masterConfig)');
      
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

  removeAllDurationControls(): void {
    const filePath = 'src/index.ts';
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ index.ts not found');
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove ALL duration control sections
    content = content.replace(/\/\/ =+\s*\n\/\/ .*DURATION CONTROL[\s\S]*?\/\/ =+\s*\n/g, '');
    
    // Remove any standalone setTimeout calls related to duration
    content = content.replace(/setTimeout\(\s*\(\)\s*=>\s*\{[\s\S]*?process\.exit\(0\)[\s\S]*?\},\s*[^)]*\);?\s*/g, '');
    
    // Remove any BOT_START_TIME or RUNTIME_MS variable declarations
    content = content.replace(/const\s+BOT_START_TIME\s*=[\s\S]*?;\s*/g, '');
    content = content.replace(/const\s+RUNTIME_MS\s*=[\s\S]*?;\s*/g, '');
    content = content.replace(/const\s+countdownInterval\s*=[\s\S]*?}\),\s*\d+\);\s*/g, '');
    
    // Remove any orphaned lines
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Removed all duration control duplicates');
  }

  addSingleCleanDurationControl(): void {
    const filePath = 'src/index.ts';
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Ensure masterConfig import exists
    if (!content.includes('import { masterConfig }')) {
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
    
    // Add single, clean duration control
    const cleanDurationControl = `
// ============================================
// DURATION CONTROL (from masterConfig)
// ============================================
const botStartTime = Date.now();
const runtimeMs = masterConfig.runtime.duration * 1000;
const durationMinutes = Math.floor(masterConfig.runtime.duration / 60);

console.log(\`⏰ Bot will run for: \${masterConfig.runtime.duration} seconds (\${durationMinutes} minutes)\`);

// Auto-stop timer
setTimeout(() => {
  console.log(\`\\n⏰ \${durationMinutes}-MINUTE DURATION REACHED - STOPPING BOT\`);
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
    console.log(\`⏰ Auto-stop in: \${remainingMin} minutes\`);
  }
}, 5000);

console.log('✅ Duration control active');
// ============================================

`;

    // Find safe insertion point
    const insertPoint = content.indexOf('console.log("Starting') || 
                       content.indexOf('console.log("✅') || 
                       content.indexOf('// Enhanced features') ||
                       content.indexOf('// Global Variables') ||
                       500;
    
    content = content.slice(0, insertPoint) + cleanDurationControl + content.slice(insertPoint);

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Added single clean duration control');
  }

  verifyCleanup(): void {
    const filePath = 'src/index.ts';
    const content = fs.readFileSync(filePath, 'utf8');
    
    console.log('\n📋 VERIFICATION:');
    
    // Count duration control sections
    const durationSections = (content.match(/DURATION CONTROL/g) || []).length;
    console.log(`  Duration control sections: ${durationSections}`);
    
    // Check for duplicate variables
    const botStartTimeCount = (content.match(/const\s+[a-zA-Z_]*START_TIME/g) || []).length;
    const runtimeMsCount = (content.match(/const\s+[a-zA-Z_]*RUNTIME[_]*MS/g) || []).length;
    const countdownCount = (content.match(/const\s+[a-zA-Z_]*countdown[a-zA-Z_]*/g) || []).length;
    
    console.log(`  BOT_START_TIME variables: ${botStartTimeCount}`);
    console.log(`  RUNTIME_MS variables: ${runtimeMsCount}`);
    console.log(`  Countdown variables: ${countdownCount}`);
    
    // Check for masterConfig usage
    const usesMasterConfig = content.includes('masterConfig.runtime.duration');
    console.log(`  Uses masterConfig: ${usesMasterConfig ? '✅' : '❌'}`);
    
    if (durationSections === 1 && botStartTimeCount <= 1 && runtimeMsCount <= 1 && usesMasterConfig) {
      console.log('\n🎉 SUCCESS: Clean single duration control added');
      console.log('📊 Will use masterConfig setting: 3600 seconds (1 hour)');
    } else {
      console.log('\n⚠️ Issues may remain - check the verification results above');
    }
  }
}

// Run the cleanup
if (require.main === module) {
  new CleanupDurationDuplicates().run().catch(console.error);
}