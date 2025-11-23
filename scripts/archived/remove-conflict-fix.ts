// remove-conflict-fix.ts
// Remove the conflicting masterConfig import from index.ts
// Run with: npx ts-node remove-conflict-fix.ts

import * as fs from 'fs';

class RemoveConflictFix {
  
  constructor() {
    console.log('🔧 REMOVING IMPORT CONFLICTS');
    console.log('============================');
    console.log('Removing conflicting masterConfig import from index.ts\n');
  }

  async run(): Promise<void> {
    try {
      this.createBackup();
      this.removeConflictingImports();
      this.verifyNoConflicts();
      
      console.log('\n✅ CONFLICTS REMOVED!');
      console.log('\nTest: npm run dev (should work without TypeScript errors)');
      
    } catch (error) {
      console.error('❌ Fix failed:', error);
    }
  }

  createBackup(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
    const backupFile = `index-backup-${timestamp}.ts`;
    
    if (fs.existsSync('src/index.ts')) {
      fs.copyFileSync('src/index.ts', backupFile);
      console.log(`📁 Backup created: ${backupFile}`);
    }
  }

  removeConflictingImports(): void {
    const filePath = 'src/index.ts';
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ index.ts not found');
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove the conflicting masterConfig import
    content = content.replace(/import\s*\{\s*masterConfig\s*\}\s*from\s*['"]\.\/enhanced\/masterConfig['"];\s*\n?/g, '');
    
    // Also remove any duplicate imports
    content = content.replace(/import\s*\{\s*config\s*as\s*masterConfig\s*\}\s*from\s*['"]\.\/enhanced\/masterConfig['"];\s*\n?/g, '');
    
    // Remove any other masterConfig imports that might be causing conflicts
    const lines = content.split('\n');
    const cleanedLines = lines.filter(line => {
      const trimmed = line.trim();
      // Remove lines that import masterConfig
      if (trimmed.includes('import') && trimmed.includes('masterConfig') && trimmed.includes('./enhanced/masterConfig')) {
        console.log(`🗑️ Removing conflicting line: ${trimmed}`);
        return false;
      }
      return true;
    });
    
    content = cleanedLines.join('\n');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Removed conflicting masterConfig imports');
  }

  verifyNoConflicts(): void {
    const filePath = 'src/index.ts';
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for remaining conflicts
    const lines = content.split('\n');
    let conflictCount = 0;
    
    lines.forEach((line, index) => {
      if (line.includes('import') && line.includes('masterConfig')) {
        console.log(`⚠️ Potential conflict at line ${index + 1}: ${line.trim()}`);
        conflictCount++;
      }
    });
    
    if (conflictCount === 0) {
      console.log('✅ No import conflicts detected');
    } else {
      console.log(`⚠️ ${conflictCount} potential conflicts remain`);
    }
    
    // Check if duration control exists
    if (content.includes('DURATION CONTROL')) {
      console.log('✅ Duration control timer is present');
    } else {
      console.log('⚠️ Duration control not found - may need to re-add');
    }
  }
}

// Run the conflict removal
if (require.main === module) {
  new RemoveConflictFix().run().catch(console.error);
}