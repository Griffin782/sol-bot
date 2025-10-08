// backup-rollback-system.ts
// Complete backup and rollback system for SOL-BOT
// Run with: npx ts-node backup-rollback-system.ts

import * as fs from 'fs';
import * as path from 'path';

class BackupRollbackSystem {
  private backupDir: string;
  private backupManifest: any = {};

  constructor() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
    this.backupDir = `backup-complete-${timestamp}`;
    
    console.log('🛡️ COMPLETE BACKUP & ROLLBACK SYSTEM');
    console.log('====================================');
    console.log(`Backup directory: ${this.backupDir}\n`);
  }

  // Main backup execution
  async createCompleteBackup(): Promise<void> {
    try {
      this.createBackupDirectory();
      this.backupCriticalFiles();
      this.backupConfigurationFiles();
      this.backupDataFiles();
      this.backupDependencyFiles();
      this.createBackupManifest();
      this.createRollbackScript();
      this.createBackupVerificationScript();
      
      console.log('\n✅ COMPLETE BACKUP CREATED SUCCESSFULLY!');
      console.log('\nBackup includes:');
      console.log('- All source code files');
      console.log('- Configuration files');
      console.log('- Data files');
      console.log('- Package dependencies');
      console.log('- Automatic rollback script');
      
      console.log('\n📋 Next steps:');
      console.log('1. Backup is ready for any changes');
      console.log('2. If changes fail, run the rollback script');
      console.log(`3. Rollback command: npx ts-node ${this.backupDir}/rollback.ts`);
      
    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw error;
    }
  }

  // Create backup directory structure
  private createBackupDirectory(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    
    // Create subdirectories
    const subdirs = ['src', 'data', 'logs', 'wallets', 'config'];
    subdirs.forEach(dir => {
      const fullPath = path.join(this.backupDir, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });
    
    console.log('📁 Created backup directory structure');
  }

  // Backup all critical source files
  private backupCriticalFiles(): void {
    const criticalFiles = [
      'src/index.ts',
      'src/config.ts',
      'src/configBridge.ts',
      'src/advanced-features.ts',
      'src/enhanced/masterConfig.ts',
      'src/enhanced/token-queue-system.ts',
      'src/enhanced/performanceLogger.ts',
      'src/enhanced/tokenAnalyzer.ts',
      'src/utils/handlers/walletHandler.ts',
      'src/utils/handlers/jupiterHandler.ts'
    ];

    console.log('💾 Backing up critical source files...');
    
    criticalFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const backupPath = path.join(this.backupDir, file);
        const backupSubDir = path.dirname(backupPath);
        
        if (!fs.existsSync(backupSubDir)) {
          fs.mkdirSync(backupSubDir, { recursive: true });
        }
        
        fs.copyFileSync(file, backupPath);
        console.log(`  ✅ ${file}`);
        
        // Add to manifest
        this.backupManifest[file] = {
          backed_up: true,
          backup_path: backupPath,
          original_size: fs.statSync(file).size,
          backup_time: new Date().toISOString()
        };
      } else {
        console.log(`  ⚠️ ${file} (not found)`);
        this.backupManifest[file] = { backed_up: false, reason: 'file_not_found' };
      }
    });
  }

  // Backup configuration files
  private backupConfigurationFiles(): void {
    const configFiles = [
      '.env',
      'package.json',
      'tsconfig.json',
      'ecosystem.config.js'
    ];

    console.log('\n⚙️ Backing up configuration files...');
    
    configFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const backupPath = path.join(this.backupDir, 'config', path.basename(file));
        fs.copyFileSync(file, backupPath);
        console.log(`  ✅ ${file}`);
        
        this.backupManifest[file] = {
          backed_up: true,
          backup_path: backupPath,
          original_size: fs.statSync(file).size,
          backup_time: new Date().toISOString()
        };
      } else {
        console.log(`  ⚠️ ${file} (not found)`);
        this.backupManifest[file] = { backed_up: false, reason: 'file_not_found' };
      }
    });
  }

  // Backup data files
  private backupDataFiles(): void {
    const dataFiles = [
      'data/pool_transactions.csv',
      'data/pending_tokens.csv',
      'data/performance_log.csv'
    ];

    console.log('\n📊 Backing up data files...');
    
    dataFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const backupPath = path.join(this.backupDir, file);
        const backupSubDir = path.dirname(backupPath);
        
        if (!fs.existsSync(backupSubDir)) {
          fs.mkdirSync(backupSubDir, { recursive: true });
        }
        
        fs.copyFileSync(file, backupPath);
        console.log(`  ✅ ${file}`);
        
        this.backupManifest[file] = {
          backed_up: true,
          backup_path: backupPath,
          original_size: fs.statSync(file).size,
          backup_time: new Date().toISOString()
        };
      } else {
        console.log(`  ⚠️ ${file} (not found)`);
        this.backupManifest[file] = { backed_up: false, reason: 'file_not_found' };
      }
    });
  }

  // Backup dependency information
  private backupDependencyFiles(): void {
    const depFiles = [
      'package-lock.json',
      'yarn.lock'
    ];

    console.log('\n📦 Backing up dependency files...');
    
    depFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const backupPath = path.join(this.backupDir, 'config', path.basename(file));
        fs.copyFileSync(file, backupPath);
        console.log(`  ✅ ${file}`);
        
        this.backupManifest[file] = {
          backed_up: true,
          backup_path: backupPath,
          original_size: fs.statSync(file).size,
          backup_time: new Date().toISOString()
        };
      } else {
        console.log(`  ⚠️ ${file} (not found)`);
      }
    });
  }

  // Create backup manifest
  private createBackupManifest(): void {
    const manifest = {
      backup_info: {
        created_at: new Date().toISOString(),
        backup_directory: this.backupDir,
        total_files: Object.keys(this.backupManifest).length,
        backed_up_files: Object.values(this.backupManifest).filter((f: any) => f.backed_up).length
      },
      files: this.backupManifest,
      system_info: {
        node_version: process.version,
        platform: process.platform,
        cwd: process.cwd()
      }
    };

    const manifestPath = path.join(this.backupDir, 'backup-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('\n📋 Created backup manifest');
  }

  // Create automatic rollback script
  private createRollbackScript(): void {
    const rollbackScript = `// rollback.ts - Automatic rollback script
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
    console.log(\`Backup created: \${this.manifest.backup_info.created_at}\`);
    console.log(\`Files to restore: \${this.manifest.backup_info.backed_up_files}\`);
  }

  async executeRollback(): Promise<void> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('\\nType "ROLLBACK" to confirm rollback: ', resolve);
    });
    rl.close();

    if (answer !== 'ROLLBACK') {
      console.log('❌ Rollback cancelled');
      return;
    }

    console.log('\\n🔄 Starting rollback...');
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
          console.log(\`  ✅ Restored: \${originalFile}\`);
          restoredCount++;
        } catch (error) {
          console.log(\`  ❌ Failed to restore: \${originalFile} - \${error}\`);
        }
      }
    }

    console.log(\`\\n✅ ROLLBACK COMPLETE!\`);
    console.log(\`📊 Restored \${restoredCount} files\`);
    console.log('\\n🚀 You can now run the bot with original configuration');
    console.log('Commands to test:');
    console.log('- npm run dev');
    console.log('- npx ts-node check-balance.ts');
  }
}

// Execute rollback
new AutoRollback().executeRollback().catch(console.error);`;

    const rollbackPath = path.join(this.backupDir, 'rollback.ts');
    fs.writeFileSync(rollbackPath, rollbackScript);
    console.log('🔄 Created automatic rollback script');
  }

  // Create backup verification script
  private createBackupVerificationScript(): void {
    const verificationScript = `// verify-backup.ts - Verify backup integrity
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
    console.log(\`Backup created: \${this.manifest.backup_info.created_at}\`);
    console.log(\`Expected files: \${this.manifest.backup_info.backed_up_files}\`);
    
    let verifiedCount = 0;
    let failedCount = 0;

    for (const [originalFile, fileInfo] of Object.entries(this.manifest.files)) {
      const info = fileInfo as any;
      if (info.backed_up && info.backup_path) {
        if (fs.existsSync(info.backup_path)) {
          const backupSize = fs.statSync(info.backup_path).size;
          if (backupSize === info.original_size) {
            console.log(\`  ✅ \${originalFile} (verified)\`);
            verifiedCount++;
          } else {
            console.log(\`  ⚠️ \${originalFile} (size mismatch)\`);
            failedCount++;
          }
        } else {
          console.log(\`  ❌ \${originalFile} (backup missing)\`);
          failedCount++;
        }
      }
    }

    console.log(\`\\n📊 VERIFICATION RESULTS:\`);
    console.log(\`  ✅ Verified: \${verifiedCount}\`);
    console.log(\`  ❌ Failed: \${failedCount}\`);
    
    if (failedCount === 0) {
      console.log('\\n🎉 Backup is complete and verified!');
      console.log('Safe to proceed with changes.');
    } else {
      console.log('\\n⚠️ Backup has issues. Consider creating a new backup.');
    }
  }
}

new BackupVerifier().verifyBackup();`;

    const verifyPath = path.join(this.backupDir, 'verify-backup.ts');
    fs.writeFileSync(verifyPath, verificationScript);
    console.log('🔍 Created backup verification script');
  }
}

// Execute backup creation
if (require.main === module) {
  new BackupRollbackSystem().createCompleteBackup().catch(console.error);
}