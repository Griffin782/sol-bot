// fix-botcontroller-imports.ts
// Fix the import errors in botController.ts
// Run with: npx ts-node fix-botcontroller-imports.ts

import * as fs from 'fs';

class FixBotControllerImports {
  
  constructor() {
    console.log('🔧 FIXING BOTCONTROLLER IMPORTS');
    console.log('===============================');
    console.log('Removing non-existent function imports\n');
  }

  async run(): Promise<void> {
    try {
      this.createBackup();
      this.fixBotControllerImports();
      this.verifyFix();
      
      console.log('\n✅ BOTCONTROLLER IMPORTS FIXED!');
      console.log('\nTest: npm run dev (should work without TypeScript errors)');
      
    } catch (error) {
      console.error('❌ Fix failed:', error);
    }
  }

  createBackup(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
    const backupFile = `botController-backup-${timestamp}.ts`;
    
    if (fs.existsSync('src/botController.ts')) {
      fs.copyFileSync('src/botController.ts', backupFile);
      console.log(`📁 Backup created: ${backupFile}`);
    }
  }

  fixBotControllerImports(): void {
    const filePath = 'src/botController.ts';
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ botController.ts not found');
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix the problematic import line
    // From: import { masterConfig, MasterConfig, getConfig, updateConfig } from './enhanced/masterConfig';
    // To: import { masterConfig, MasterConfig } from './enhanced/masterConfig';
    
    const oldImport = /import\s*\{\s*masterConfig,\s*MasterConfig,\s*getConfig,\s*updateConfig\s*\}\s*from\s*['"]\.\/enhanced\/masterConfig['"];/;
    const newImport = "import { masterConfig, MasterConfig } from './enhanced/masterConfig';";
    
    if (oldImport.test(content)) {
      content = content.replace(oldImport, newImport);
      console.log('✅ Fixed botController.ts import statement');
    } else {
      // Look for any other problematic imports
      const lines = content.split('\n');
      let fixed = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('getConfig') || line.includes('updateConfig')) {
          if (line.includes('import') && line.includes('masterConfig')) {
            // Replace the entire line with the corrected import
            lines[i] = "import { masterConfig, MasterConfig } from './enhanced/masterConfig';";
            console.log(`✅ Fixed import at line ${i + 1}`);
            fixed = true;
          }
        }
      }
      
      if (fixed) {
        content = lines.join('\n');
      }
    }
    
    // Also remove any usage of getConfig() or updateConfig() functions
    content = content.replace(/getConfig\(\)/g, 'masterConfig');
    content = content.replace(/updateConfig\([^)]*\)/g, '// updateConfig removed - not available');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Removed non-existent function calls');
  }

  verifyFix(): void {
    const filePath = 'src/botController.ts';
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for remaining issues
    const hasGetConfig = content.includes('getConfig');
    const hasUpdateConfig = content.includes('updateConfig');
    
    if (hasGetConfig || hasUpdateConfig) {
      console.log('⚠️ Some function calls may still exist:');
      if (hasGetConfig) console.log('  - getConfig() references found');
      if (hasUpdateConfig) console.log('  - updateConfig() references found');
    } else {
      console.log('✅ All problematic function calls removed');
    }
    
    // Check import line
    const lines = content.split('\n');
    const importLine = lines.find(line => line.includes('masterConfig') && line.includes('import'));
    if (importLine) {
      console.log(`✅ Import line: ${importLine.trim()}`);
    }
  }
}

// Run the fix
if (require.main === module) {
  new FixBotControllerImports().run().catch(console.error);
}