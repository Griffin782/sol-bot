// verify-backup.ts - Verify backup integrity
// Run with: npx ts-node verify-backup.ts

import * as fs from 'fs';
import * as path from 'path';

class BackupVerifier {
  private manifest: any;
  
  constructor() {
    this.manifest = JSON.parse(fs.readFileSync('./backup-manifest.json', 'utf8'));
  }

  verifyBackup(): void {
    console.log('🔍 BACKUP VERIFICATION');
    console.log('=======================');
    console.log(`Backup created: ${this.manifest.backup_info.created_at}`);
    console.log(`Expected files: ${this.manifest.backup_info.backed_up_files}`);
    
    let verifiedCount = 0;
    let failedCount = 0;

    for (const [originalFile, fileInfo] of Object.entries(this.manifest.files)) {
      const info = fileInfo as any;
      if (info.backed_up && info.backup_path) {
        if (fs.existsSync(info.backup_path)) {
          const backupSize = fs.statSync(info.backup_path).size;
          if (backupSize === info.original_size) {
            console.log(`  ✅ ${originalFile} (verified)`);
            verifiedCount++;
          } else {
            console.log(`  ⚠️ ${originalFile} (size mismatch)`);
            failedCount++;
          }
        } else {
          console.log(`  ❌ ${originalFile} (backup missing)`);
          failedCount++;
        }
      }
    }

    console.log(`\n📊 VERIFICATION RESULTS:`);
    console.log(`  ✅ Verified: ${verifiedCount}`);
    console.log(`  ❌ Failed: ${failedCount}`);
    
    if (failedCount === 0) {
      console.log('\n🎉 Backup is complete and verified!');
      console.log('Safe to proceed with changes.');
    } else {
      console.log('\n⚠️ Backup has issues. Consider creating a new backup.');
    }
  }
}

new BackupVerifier().verifyBackup();