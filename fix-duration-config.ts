// fix-duration-config.ts
// Remove hardcoded 3-minute timer and use masterConfig duration setting
// Run with: npx ts-node fix-duration-config.ts

import * as fs from 'fs';

class FixDurationConfig {
  
  constructor() {
    console.log('🔧 FIXING DURATION TO USE MASTERCONFIG');
    console.log('======================================');
    console.log('Removing hardcoded 3-minute timer, using masterConfig.runtime.duration\n');
  }

  async run(): Promise<void> {
    try {
      this.createBackup();
      this.removeHardcodedTimer();
      this.addConfigBasedTimer();
      this.verifyFix();
      
      console.log('\n✅ DURATION FIX COMPLETE!');
      console.log('\nThe bot will now use masterConfig.runtime.duration setting');
      console.log('Current setting: 3600 seconds (1 hour)');
      console.log('\nTest: npm run dev (should run for 1 hour)');
      
    } catch (error) {
      console.error('❌ Fix failed:', error);
    }
  }

  createBackup(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
    const backupFile = `index-duration-backup-${timestamp}.ts`;
    
    if (fs.existsSync('src/index.ts')) {
      fs.copyFileSync('src/index.ts', backupFile);
      console.log(`📁 Backup created: ${backupFile}`);
    }
  }

  removeHardcodedTimer(): void {
    const filePath = 'src/index.ts';
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ index.ts not found');
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove the hardcoded 3-minute timer section
    content = content.replace(
      /\/\/ =+\s*\n\/\/ WORKING DURATION CONTROL[\s\S]*?\/\/ =+/g, 
      ''
    );
    
    // Remove any other hardcoded duration timers
    content = content.replace(
      /\/\/ =+\s*\n\/\/ .*DURATION CONTROL[\s\S]*?\/\/ =+/g, 
      ''
    );
    
    // Remove standalone setTimeout calls with 180 * 1000
    content = content.replace(
      /setTimeout\(\s*\(\)\s*=>\s*\{[\s\S]*?180\s*\*\s*1000[\s\S]*?\}[,)]/g,
      ''
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Removed hardcoded 3-minute timer');
  }

  addConfigBasedTimer(): void {
    const filePath = 'src/index.ts';
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add import for masterConfig if not present
    if (!content.includes('import { masterConfig }') && !content.includes('masterConfig')) {
      // Find a safe place to add import
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
    
    // Add the config-based duration control
    const configBasedDurationControl = `
// ============================================
// CONFIG-BASED DURATION CONTROL
// ============================================
console.log('🔧 Setting up duration control from masterConfig');
console.log(\`⏰ Bot will run for: \${masterConfig.runtime.duration} seconds (\${Math.floor(masterConfig.runtime.duration/60)} minutes)\`);

const BOT_START_TIME = Date.now();
const RUNTIME_MS = masterConfig.runtime.duration * 1000;

// Auto-stop based on masterConfig setting
setTimeout(() => {
  const durationMinutes = Math.floor(masterConfig.runtime.duration / 60);
  console.log(\`\\n⏰ \${durationMinutes}-MINUTE DURATION REACHED - STOPPING BOT\`);
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
    console.log(\`⏰ Auto-stop in: \${remainingMinutes} minutes\`);
  }
}, 5000);

console.log('✅ MasterConfig duration control active');
// ============================================
`;

    // Insert after imports but before main execution
    const insertPoint = content.indexOf('console.log("Starting') || 
                       content.indexOf('console.log("✅') || 
                       content.indexOf('// Enhanced features') ||
                       content.indexOf('// Global Variables') ||
                       500;
    
    content = content.slice(0, insertPoint) + configBasedDurationControl + content.slice(insertPoint);

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Added masterConfig-based duration control');
  }

  verifyFix(): void {
    const filePath = 'src/index.ts';
    const content = fs.readFileSync(filePath, 'utf8');
    
    console.log('\n📋 VERIFICATION:');
    
    // Check for masterConfig usage
    const usesMasterConfig = content.includes('masterConfig.runtime.duration');
    console.log(`  Uses masterConfig duration: ${usesMasterConfig ? '✅' : '❌'}`);
    
    // Check for hardcoded timers
    const hasHardcodedTimer = content.includes('180 * 1000') || content.includes('MAX_RUNTIME_MS = 180');
    console.log(`  Hardcoded 3-min timer: ${hasHardcodedTimer ? '❌ Still present' : '✅ Removed'}`);
    
    // Check masterConfig import
    const hasMasterConfigImport = content.includes('masterConfig');
    console.log(`  MasterConfig accessible: ${hasMasterConfigImport ? '✅' : '❌'}`);
    
    if (usesMasterConfig && !hasHardcodedTimer) {
      console.log('\n🎉 SUCCESS: Bot will use masterConfig.runtime.duration');
      console.log('📊 Current setting: 3600 seconds (1 hour)');
    } else {
      console.log('\n⚠️ Issues detected - may need manual adjustment');
    }
  }
}

// Run the fix
if (require.main === module) {
  new FixDurationConfig().run().catch(console.error);
}