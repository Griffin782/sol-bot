// rollback.ts - Automatic rollback script
// Run with: npx ts-node rollback.ts

import * as fs from 'fs';
import * as path from 'path';

class AutoRollback {
  private manifest: any;
  
  constructor() {
    console.log('🔄 AUTOMATIC ROLLBACK SYSTEM');
    console.log('=============================');
    console.log('WARNING: This will restore all files to their backed-up state');
    console.log('Any changes made after backup will be LOST');
    
    // Load manifest
    this.manifest = JSON.parse(fs.readFileSync('./backup-manifest.json', 'utf8'));
    console.log(`Backup created: ${this.manifest.backup_info.created_at}`);
    console.log(`Files to restore: ${this.manifest.backup_info.backed_up_files}`);
  }

  async executeRollback(): Promise<void> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('\nType "ROLLBACK" to confirm rollback: ', resolve);
    });
    rl.close();

    if (answer !== 'ROLLBACK') {
      console.log('❌ Rollback cancelled');
      return;
    }

    console.log('\n🔄 Starting rollback...');
    let restoredCount = 0;

    for (const [originalFile, fileInfo] of Object.entries(this.manifest.files)) {
      const info = fileInfo as any;
      if (info.backed_up && info.backup_path) {
        try {
          // Create directory if needed
          const originalDir = path.dirname(originalFile as string);
          if (!fs.existsSync(originalDir)) {
            fs.mkdirSync(originalDir, { recursive: true });
          }

          // Copy back from backup
          fs.copyFileSync(info.backup_path, originalFile as string);
          console.log(`  ✅ Restored: ${originalFile}`);
          restoredCount++;
        } catch (error) {
          console.log(`  ❌ Failed to restore: ${originalFile} - ${error}`);
        }
      }
    }

    console.log(`\n✅ ROLLBACK COMPLETE!`);
    console.log(`📊 Restored ${restoredCount} files`);
    console.log('\n🚀 You can now run the bot with original configuration');
    console.log('Commands to test:');
    console.log('- npm run dev');
    console.log('- npx ts-node check-balance.ts');
  }
}

// Execute rollback
new AutoRollback().executeRollback().catch(console.error);