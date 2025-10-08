// clean-config-fix.ts
// Clean fix that avoids variable name conflicts
// Run with: npx ts-node clean-config-fix.ts

import * as fs from 'fs';
import * as path from 'path';

class CleanConfigFix {
  
  constructor() {
    console.log('🔧 CLEAN CONFIGURATION FIX');
    console.log('===========================');
    console.log('This fix avoids variable conflicts and makes minimal changes\n');
  }

  async run(): Promise<void> {
    try {
      this.createBackup();
      this.fixMasterConfig();
      this.fixIndexTs();
      this.testConfiguration();
      this.createVerification();
      
      console.log('\n✅ CLEAN FIX COMPLETE!');
      console.log('\nNext steps:');
      console.log('1. Run: npx ts-node verify-clean-fix.ts');
      console.log('2. Run: npm run dev');
      console.log('3. Bot should respect duration settings');
      
    } catch (error) {
      console.error('❌ Fix failed:', error);
    }
  }

  // Create small backup
  createBackup(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
    const backupDir = `backup-clean-fix-${timestamp}`;
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    
    const filesToBackup = [
      'src/index.ts',
      'src/enhanced/masterConfig.ts'
    ];
    
    filesToBackup.forEach(file => {
      if (fs.existsSync(file)) {
        const backupPath = path.join(backupDir, file.replace(/[\/\\]/g, '_'));
        fs.copyFileSync(file, backupPath);
        console.log(`📁 Backed up: ${file}`);
      }
    });
    
    console.log(`🛡️ Clean fix backup: ${backupDir}\n`);
  }

  // Fix masterConfig.ts to ensure it exports properly
  fixMasterConfig(): void {
    const filePath = 'src/enhanced/masterConfig.ts';
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ masterConfig.ts not found');
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Set test-safe values
    content = content.replace(/duration: \d+,/, 'duration: 180,'); // 3 minutes
    content = content.replace(/testMode: false,/, 'testMode: true,');
    content = content.replace(/initialPool: \d+,/, 'initialPool: 600,');
    content = content.replace(/targetPool: \d+,/, 'targetPool: 1200,');
    
    // Ensure proper export at the end (remove existing exports first)
    content = content.replace(/export default config;[\s\S]*$/, '');
    
    // Add clean export
    content += `
// Clean export without conflicts
export default config;
export { config as masterConfig };

// Log on import to verify loading
console.log('🔧 masterConfig.ts loaded:', {
  initialPool: config.pool.initialPool,
  targetPool: config.pool.targetPool,
  duration: config.runtime.duration,
  testMode: config.testMode
});
`;

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Fixed masterConfig.ts exports and set test values');
  }

  // Fix index.ts with minimal changes
  fixIndexTs(): void {
    const filePath = 'src/index.ts';
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ index.ts not found');
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add import at the top after existing imports
    if (!content.includes('import { masterConfig }')) {
      // Find the last import line
      const lines = content.split('\n');
      let lastImportIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('} from')) {
          lastImportIndex = i;
        }
      }
      
      if (lastImportIndex > -1) {
        lines.splice(lastImportIndex + 1, 0, "import { masterConfig } from './enhanced/masterConfig';");
        content = lines.join('\n');
      }
    }
    
    // Look for any duration or timeout settings and make them use masterConfig
    // This is safer than rewriting the entire config loading
    
    // Find setTimeout with hardcoded values
    content = content.replace(
      /setTimeout\(\s*\(\)\s*=>\s*\{[\s\S]*?process\.exit\(0\)[\s\S]*?\},\s*\d+\s*\)/g,
      `setTimeout(() => {
        console.log('⏰ Session duration reached - stopping bot');
        console.log('📊 Duration was controlled by masterConfig.runtime.duration');
        process.exit(0);
      }, masterConfig.runtime.duration * 1000)`
    );
    
    // Look for any other duration references
    content = content.replace(/180000/g, 'masterConfig.runtime.duration * 1000'); // 3 minutes in ms
    content = content.replace(/300000/g, 'masterConfig.runtime.duration * 1000'); // 5 minutes in ms
    
    // Add duration logging early in the file
    const runtimeCheck = `
// ============================================
// VERIFY CONFIGURATION IS WORKING
// ============================================
console.log('🔧 Configuration Check:');
console.log('  Duration:', masterConfig.runtime.duration, 'seconds');
console.log('  Initial Pool:', masterConfig.pool.initialPool);
console.log('  Test Mode:', masterConfig.testMode);
console.log('  Bot will stop after:', masterConfig.runtime.duration, 'seconds');
console.log('============================================\\n');
`;

    // Insert after imports but before main logic
    const insertPoint = content.indexOf('// Global Variables') || content.indexOf('const env =') || 500;
    content = content.slice(0, insertPoint) + runtimeCheck + content.slice(insertPoint);

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Fixed index.ts duration controls');
  }

  // Set test configuration values
  testConfiguration(): void {
    console.log('✅ Set test configuration:');
    console.log('  - Duration: 180 seconds (3 minutes)');
    console.log('  - Initial Pool: $600');
    console.log('  - Target Pool: $1200');
    console.log('  - Test Mode: true');
  }

  // Create verification script
  createVerification(): void {
    const verificationScript = `// verify-clean-fix.ts
import { masterConfig } from './src/enhanced/masterConfig';

console.log('🔍 CLEAN FIX VERIFICATION');
console.log('=========================');

console.log('\\n📋 MasterConfig Values:');
console.log(\`  Duration: \${masterConfig.runtime.duration} seconds\`);
console.log(\`  Initial Pool: $\${masterConfig.pool.initialPool}\`);
console.log(\`  Target Pool: $\${masterConfig.pool.targetPool}\`);
console.log(\`  Test Mode: \${masterConfig.testMode}\`);

console.log('\\n✅ EXPECTED BEHAVIOR:');
console.log('  - Bot runs for exactly 3 minutes');
console.log('  - Automatic stop after 180 seconds');
console.log('  - Clear logging of configuration values');
console.log('  - No variable conflicts');

console.log('\\n🚀 Ready to test! Run: npm run dev');`;

    fs.writeFileSync('verify-clean-fix.ts', verificationScript, 'utf8');
    console.log('✅ Created verification script');
  }
}

// Run the clean fix
if (require.main === module) {
  new CleanConfigFix().run().catch(console.error);
}