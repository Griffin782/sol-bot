#!/usr/bin/env node
// unify-config.ts - Force everything to use z-masterConfig.ts

import * as fs from 'fs';
import * as path from 'path';

console.log('🔧 UNIFYING CONFIGURATION TO z-masterConfig.ts');
console.log('='.repeat(50));

// Files that need to be updated to import only z-masterConfig
const filesToUpdate = [
  'src/index.ts',
  'src/configBridge.ts', 
  'src/botController.ts'
];

// Backup original files
function backupFile(filePath: string): string {
  const backupPath = filePath + '.backup-' + Date.now();
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log(`✅ Backed up: ${filePath} -> ${backupPath}`);
  }
  return backupPath;
}

// Update imports in each file
filesToUpdate.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ File not found: ${filePath}`);
    return;
  }
  
  backupFile(filePath);
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Remove old config imports
  content = content.replace(/import.*from.*['"].\/enhanced\/masterConfig['"];?/g, '');
  content = content.replace(/import.*from.*['"].\/config['"];?/g, '');
  content = content.replace(/import.*from.*['"]./configBridge['"];?/g, '');
  
  // Add z-masterConfig import at top
  if (!content.includes('z-masterConfig')) {
    const firstImport = content.indexOf('import');
    if (firstImport !== -1) {
      content = content.slice(0, firstImport) + 
               `import { z_config } from '../z-new-controls/z-masterConfig';\n` +
               content.slice(firstImport);
    }
  }
  
  // Replace config variable references
  content = content.replace(/masterConfig\.pool\.initialPool/g, 'z_config.z_pool.z_initialPool');
  content = content.replace(/masterConfig\.pool\.targetPool/g, 'z_config.z_pool.z_targetPool');
  content = content.replace(/masterConfig\.pool\.positionSize/g, 'z_config.z_pool.z_positionSize');
  content = content.replace(/masterConfig\.runtime\.duration/g, 'z_config.z_runtime.z_duration');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated: ${filePath}`);
    console.log('   BEFORE: Uses masterConfig/config imports');
    console.log('   AFTER:  Uses z_config from z-masterConfig.ts');
  } else {
    console.log(`ℹ️ No changes needed: ${filePath}`);
  }
});

console.log('\n✅ Configuration unification complete!');
