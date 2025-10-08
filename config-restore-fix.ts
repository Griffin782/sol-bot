// config-restore-fix.ts
// This script fixes the configuration import chain to restore working bot
// Run with: npx ts-node config-restore-fix.ts

import * as fs from 'fs';
import * as path from 'path';

class ConfigurationRestoreFix {
  
  constructor() {
    console.log('🔧 CONFIGURATION RESTORE FIX');
    console.log('=============================');
    console.log('Goal: Restore bot to working state before modifications\n');
  }

  // Main execution
  async run(): Promise<void> {
    try {
      this.createBackup();
      this.fixMasterConfigImports();
      this.fixIndexTsConfigChain();
      this.fixConfigBridge();
      this.setTestConfiguration();
      this.generateVerificationScript();
      
      console.log('\n✅ CONFIGURATION RESTORE COMPLETE!');
      console.log('\nNext steps:');
      console.log('1. Run: npx ts-node verify-config-fix.ts');
      console.log('2. Run: npm run dev');
      console.log('3. Should see duration controls working');
      
    } catch (error) {
      console.error('❌ Fix failed:', error);
    }
  }

  // 1. Create backup before making changes
  createBackup(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
    const backupDir = `backup-config-restore-${timestamp}`;
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    
    const filesToBackup = [
      'src/index.ts',
      'src/enhanced/masterConfig.ts',
      'src/configBridge.ts'
    ];
    
    filesToBackup.forEach(file => {
      if (fs.existsSync(file)) {
        const backupPath = path.join(backupDir, file.replace(/[\/\\]/g, '_'));
        fs.copyFileSync(file, backupPath);
        console.log(`📁 Backed up: ${file}`);
      }
    });
    
    console.log(`🛡️ Backup created: ${backupDir}\n`);
  }

  // 2. Fix masterConfig.ts to ensure proper exports
  fixMasterConfigImports(): void {
    const filePath = 'src/enhanced/masterConfig.ts';
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ masterConfig.ts not found');
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Ensure proper export at the bottom
    const exportCode = `
// Ensure proper module exports
export default config;
export const masterConfig = config;

// Auto-log on import to verify loading
console.log('🔧 masterConfig.ts loaded:', {
  initialPool: config.pool.initialPool,
  targetPool: config.pool.targetPool,
  duration: config.runtime.duration
});`;

    // Remove existing exports and add the corrected ones
    content = content.replace(/export default config;[\s\S]*?(?=\n\n|$)/g, '');
    content = content + exportCode;

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Fixed masterConfig.ts exports');
  }

  // 3. Fix index.ts configuration loading
  fixIndexTsConfigChain(): void {
    const filePath = 'src/index.ts';
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ index.ts not found');
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add masterConfig import at the top (after other imports)
    if (!content.includes('import { masterConfig }')) {
      const importLine = "import { masterConfig } from './enhanced/masterConfig';\n";
      
      // Find where to insert the import (after existing imports)
      const importSectionEnd = content.lastIndexOf("} from");
      if (importSectionEnd > -1) {
        const insertPos = content.indexOf('\n', importSectionEnd) + 1;
        content = content.slice(0, insertPos) + importLine + content.slice(insertPos);
      } else {
        content = importLine + content;
      }
    }
    
    // Find and replace the configuration loading section
    const configLoadingSection = `
// ============================================
// ENHANCED CONFIGURATION LOADING
// ============================================
console.log('🔧 Loading masterConfig...');

// Verify masterConfig is working
if (!masterConfig || !masterConfig.pool) {
  console.error('❌ CRITICAL: masterConfig failed to load!');
  console.error('Bot will use hardcoded fallbacks - THIS IS NOT INTENDED!');
  process.exit(1);
}

console.log('✅ masterConfig loaded successfully:', {
  initialPool: masterConfig.pool.initialPool,
  targetPool: masterConfig.pool.targetPool,
  duration: masterConfig.runtime.duration,
  testMode: masterConfig.testMode
});

// CRITICAL: Override any hardcoded config with masterConfig values
const config = {
  ...require('./config'),
  pool: {
    initialPool: masterConfig.pool.initialPool,
    targetPool: masterConfig.pool.targetPool,
    positionSize: masterConfig.pool.positionSize,
    maxPositions: masterConfig.pool.maxPositions
  },
  runtime: {
    duration: masterConfig.runtime.duration,
    maxRuntime: masterConfig.runtime.maxRuntime,
    pauseBetweenScans: masterConfig.runtime.pauseBetweenScans
  },
  testMode: masterConfig.testMode
};

console.log('🎯 Using configuration values:', {
  initialPool: config.pool.initialPool,
  targetPool: config.pool.targetPool,
  duration: config.runtime.duration,
  testMode: config.testMode
});
`;

    // Replace any existing config loading with the corrected version
    const configPattern = /\/\/ =+\s*\n\/\/ (ENVIRONMENT|CONFIGURATION)[\s\S]*?(?=\/\/ =+|$)/;
    if (configPattern.test(content)) {
      content = content.replace(configPattern, configLoadingSection);
    } else {
      // Insert after imports if no existing config section found
      const insertPos = content.indexOf('// Global Variables') || content.indexOf('const env =') || 500;
      content = content.slice(0, insertPos) + configLoadingSection + '\n\n' + content.slice(insertPos);
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Fixed index.ts configuration loading');
  }

  // 4. Fix configBridge.ts to properly import masterConfig
  fixConfigBridge(): void {
    const filePath = 'src/configBridge.ts';
    
    if (!fs.existsSync(filePath)) {
      console.log('⚠️ configBridge.ts not found, creating...');
      this.createConfigBridge();
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Ensure masterConfig import is correct
    if (!content.includes("import { masterConfig } from './enhanced/masterConfig'")) {
      content = "import { masterConfig } from './enhanced/masterConfig';\n\n" + content;
    }
    
    // Add validation check
    const validationCode = `
// Critical validation - fail fast if masterConfig broken
if (!masterConfig || !masterConfig.pool) {
  console.error('❌ CRITICAL ERROR: masterConfig not loading in configBridge!');
  console.error('Check src/enhanced/masterConfig.ts exports');
  process.exit(1);
}

console.log('🔗 configBridge.ts: masterConfig imported successfully');
`;

    // Insert validation after imports
    const importEnd = content.indexOf('\n\n');
    if (importEnd > -1) {
      content = content.slice(0, importEnd) + validationCode + content.slice(importEnd);
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Fixed configBridge.ts imports');
  }

  // 5. Create configBridge.ts if it doesn't exist
  createConfigBridge(): void {
    const configBridgeCode = `// configBridge.ts - Central config import hub
import { masterConfig } from './enhanced/masterConfig';

// Critical validation - fail fast if masterConfig broken
if (!masterConfig || !masterConfig.pool) {
  console.error('❌ CRITICAL ERROR: masterConfig not loading in configBridge!');
  console.error('Check src/enhanced/masterConfig.ts exports');
  process.exit(1);
}

console.log('🔗 configBridge.ts: masterConfig imported successfully');

// Export masterConfig values with fallbacks (should never be used)
export const INITIAL_POOL = masterConfig.pool?.initialPool || 600;
export const TARGET_POOL = masterConfig.pool?.targetPool || 1701.75;
export const POSITION_SIZE = masterConfig.pool?.positionSize || 0.089;
export const MAX_CONCURRENT = masterConfig.pool?.maxPositions || 5;
export const BOT_DURATION = masterConfig.runtime?.duration || 0;
export const TEST_MODE = masterConfig.testMode || false;

// Log what we're using
console.log('🔧 CONFIG BRIDGE VALUES:', {
  initialPool: INITIAL_POOL,
  targetPool: TARGET_POOL,
  positionSize: POSITION_SIZE,
  duration: BOT_DURATION,
  testMode: TEST_MODE
});

export default masterConfig;`;

    fs.writeFileSync('src/configBridge.ts', configBridgeCode, 'utf8');
    console.log('✅ Created configBridge.ts');
  }

  // 6. Set test configuration values in masterConfig.ts
  setTestConfiguration(): void {
    const filePath = 'src/enhanced/masterConfig.ts';
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ Cannot set test config - masterConfig.ts not found');
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Set test-friendly values
    const testConfigReplacements = [
      // Runtime settings
      { find: /duration: \d+,.*?\/\/ Bot run duration/, replace: 'duration: 180, // 3 minutes for testing' },
      { find: /testMode: false,/, replace: 'testMode: true,' },
      
      // Pool settings  
      { find: /initialPool: \d+,/, replace: 'initialPool: 600,' },
      { find: /targetPool: \d+,/, replace: 'targetPool: 1200,' },
      { find: /positionSize: [\d.]+,/, replace: 'positionSize: 0.089,' },
      { find: /maxPositions: \d+,/, replace: 'maxPositions: 10,' }
    ];

    testConfigReplacements.forEach(({ find, replace }) => {
      content = content.replace(find, replace);
    });

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Set test configuration values');
  }

  // 7. Generate verification script
  generateVerificationScript(): void {
    const verificationScript = `// verify-config-fix.ts - Run this to verify the fix worked
import { masterConfig } from './src/enhanced/masterConfig';

console.log('🔍 CONFIGURATION FIX VERIFICATION');
console.log('==================================');

console.log('\\n📋 MasterConfig Values:');
console.log(\`  Initial Pool: $\${masterConfig.pool.initialPool}\`);
console.log(\`  Target Pool: $\${masterConfig.pool.targetPool}\`);
console.log(\`  Position Size: \${masterConfig.pool.positionSize} SOL\`);
console.log(\`  Duration: \${masterConfig.runtime.duration} seconds\`);
console.log(\`  Test Mode: \${masterConfig.testMode}\`);

// Test import chain
try {
  const configBridge = require('./src/configBridge');
  console.log('\\n🔗 ConfigBridge Import: ✅');
  console.log(\`  Duration from bridge: \${configBridge.BOT_DURATION}\`);
} catch (e) {
  console.log('\\n🔗 ConfigBridge Import: ❌', e.message);
}

// Expected behavior
console.log('\\n✅ EXPECTED BEHAVIOR:');
console.log('  - Bot should run for exactly 3 minutes (180 seconds)');
console.log('  - Pool should start at $600');
console.log('  - Position size should be 0.089 SOL (~$34)');
console.log('  - Should stop automatically after 3 minutes');

console.log('\\n🚀 Ready to test! Run: npm run dev');`;

    fs.writeFileSync('verify-config-fix.ts', verificationScript, 'utf8');
    console.log('✅ Created verification script');
  }
}

// Run the fix
// Run the fix
if (require.main === module) {
  new ConfigurationRestoreFix().run().catch(console.error);
}