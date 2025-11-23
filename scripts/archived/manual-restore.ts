// manual-restore.ts
// Manually restore files from backup with correct paths
// Run with: npx ts-node manual-restore.ts

import * as fs from 'fs';
import * as path from 'path';

class ManualRestore {
  
  constructor() {
    console.log('🔄 MANUAL FILE RESTORE');
    console.log('======================');
  }

  async run(): Promise<void> {
    const backupDir = 'backup-complete-2025-09-08T11-16';
    
    if (!fs.existsSync(backupDir)) {
      console.log('❌ Backup directory not found');
      this.listAvailableBackups();
      return;
    }

    console.log(`📁 Found backup: ${backupDir}`);
    this.restoreKeyFiles(backupDir);
  }

  restoreKeyFiles(backupDir: string): void {
    // Map of backup location to restore location
    const filesToRestore = [
      { from: `${backupDir}/src/index.ts`, to: 'src/index.ts' },
      { from: `${backupDir}/src/enhanced/masterConfig.ts`, to: 'src/enhanced/masterConfig.ts' },
      { from: `${backupDir}/src/config.ts`, to: 'src/config.ts' },
      { from: `${backupDir}/src/configBridge.ts`, to: 'src/configBridge.ts' }
    ];

    let restored = 0;
    let failed = 0;

    filesToRestore.forEach(file => {
      try {
        if (fs.existsSync(file.from)) {
          // Ensure target directory exists
          const targetDir = path.dirname(file.to);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          fs.copyFileSync(file.from, file.to);
          console.log(`✅ Restored: ${file.to}`);
          restored++;
        } else {
          console.log(`⚠️ Not found: ${file.from}`);
          failed++;
        }
      } catch (error) {
        console.log(`❌ Failed: ${file.to} - ${error}`);
        failed++;
      }
    });

    console.log(`\n📊 RESTORE SUMMARY:`);
    console.log(`  ✅ Restored: ${restored} files`);
    console.log(`  ❌ Failed: ${failed} files`);

    if (restored > 0) {
      console.log('\n🎉 Key files restored! Try: npm run dev');
    }
  }

  listAvailableBackups(): void {
    console.log('\n📋 Available backups:');
    try {
      const items = fs.readdirSync('.');
      const backups = items.filter(item => 
        item.startsWith('backup-') && fs.statSync(item).isDirectory()
      );
      
      if (backups.length > 0) {
        backups.forEach(backup => console.log(`  - ${backup}`));
        console.log(`\n💡 Update the backupDir variable to use one of these`);
      } else {
        console.log('  No backup directories found');
      }
    } catch (error) {
      console.log(`  Error listing backups: ${error}`);
    }
  }
}

// Run manual restore
new ManualRestore().run().catch(console.error);