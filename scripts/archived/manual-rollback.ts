// manual-rollback.ts
// Quick manual rollback to restore working files
// Run with: npx ts-node manual-rollback.ts

import * as fs from 'fs';
import * as path from 'path';

class ManualRollback {
  
  constructor() {
    console.log('🔄 MANUAL ROLLBACK');
    console.log('==================');
    console.log('Restoring files from backup directory...\n');
  }

  async executeRollback(): Promise<void> {
    const backupDir = 'backup-complete-2025-09-08T11-16';
    
    if (!fs.existsSync(backupDir)) {
      console.log('❌ Backup directory not found:', backupDir);
      console.log('Available backups:');
      const dirs = fs.readdirSync('.').filter(d => d.startsWith('backup-'));
      dirs.forEach(d => console.log('  -', d));
      return;
    }

    console.log('📁 Found backup directory:', backupDir);
    
    // Define the file mappings (backup location -> restore location)
    const filesToRestore = [
      {
        backup: path.join(backupDir, 'src', 'index.ts'),
        restore: 'src/index.ts'
      },
      {
        backup: path.join(backupDir, 'src', 'enhanced', 'masterConfig.ts'),
        restore: 'src/enhanced/masterConfig.ts'
      },
      {
        backup: path.join(backupDir, 'src', 'config.ts'),
        restore: 'src/config.ts'
      },
      {
        backup: path.join(backupDir, 'src', 'configBridge.ts'),
        restore: 'src/configBridge.ts'
      }
    ];

    let restoredCount = 0;
    let errorCount = 0;

    for (const file of filesToRestore) {
      try {
        if (fs.existsSync(file.backup)) {
          // Create directory if it doesn't exist
          const restoreDir = path.dirname(file.restore);
          if (!fs.existsSync(restoreDir)) {
            fs.mkdirSync(restoreDir, { recursive: true });
          }

          // Copy the file
          fs.copyFileSync(file.backup, file.restore);
          console.log(`✅ Restored: ${file.restore}`);
          restoredCount++;
        } else {
          console.log(`⚠️ Backup not found: ${file.backup}`);
        }
      } catch (error) {
        console.log(`❌ Failed to restore ${file.restore}:`, error);
        errorCount++;
      }
    }

    console.log(`\n📊 ROLLBACK SUMMARY:`);
    console.log(`  ✅ Restored: ${restoredCount} files`);
    console.log(`  ❌ Errors: ${errorCount} files`);

    if (errorCount === 0) {
      console.log('\n🎉 ROLLBACK SUCCESSFUL!');
      console.log('Your bot is back to the working state before changes.');
      console.log('\nYou can now:');
      console.log('1. Test the bot: npm run dev');
      console.log('2. Apply the clean fix if needed');
    } else {
      console.log('\n⚠️ Some files could not be restored.');
      console.log('Check the errors above.');
    }
  }
}

// Execute rollback
new ManualRollback().executeRollback().catch(console.error);