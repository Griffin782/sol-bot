// ============================================
// BACKUP MANAGER - Version Control & Rollback
// ============================================

import * as fs from 'fs';
import * as path from 'path';

export interface BackupEntry {
  timestamp: Date;
  version: string;
  description: string;
  files: {
    original: string;
    backup: string;
    size: number;
    checksum?: string;
  }[];
  reason: string;
  success: boolean;
}

export interface RollbackPoint {
  id: string;
  timestamp: Date;
  version: string;
  description: string;
  files: string[];
  critical: boolean;
}

export class BackupManager {
  private backupDir = './src/backup-old';
  private versionsDir = './src/backup-old/versions';
  private rollbackPointsFile = './src/backup-old/rollback_points.json';
  private backupHistory: BackupEntry[] = [];
  private rollbackPoints: RollbackPoint[] = [];

  constructor() {
    this.initializeBackupSystem();
    this.loadBackupHistory();
    this.loadRollbackPoints();
  }

  private initializeBackupSystem(): void {
    const dirs = [
      this.backupDir,
      this.versionsDir,
      `${this.versionsDir}/critical`,
      `${this.versionsDir}/daily`,
      `${this.versionsDir}/config`,
      `${this.versionsDir}/trading`
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Create backup registry
    const registryFile = path.join(this.backupDir, 'backup_registry.json');
    if (!fs.existsSync(registryFile)) {
      fs.writeFileSync(registryFile, JSON.stringify({
        created: new Date(),
        totalBackups: 0,
        lastBackup: null,
        autoBackup: true,
        retentionDays: 30
      }, null, 2));
    }

    console.log('🔄 Backup system initialized');
  }

  public backupCriticalFiles(reason: string = 'Scheduled backup'): string {
    const criticalFiles = [
      './src/index.ts',
      './src/config.ts',
      './src/configBridge.ts',
      './src/enhanced/masterConfig.ts',
      './src/enhanced/token-queue-system.ts',
      './src/security/securityManager.ts',
      './src/security/securityIntegration.ts',
      './package.json',
      './tsconfig.json'
    ];

    return this.createBackup(criticalFiles, 'critical', reason, true);
  }

  public backupTradingData(reason: string = 'Trading data backup'): string {
    const tradingFiles = [
      './data/trading_log.json',
      './data/pool_transactions.csv',
      './data/pending_tokens.csv',
      './data/whale_exits.jsonl',
      './wallets/pending/wallet-pool.json',
      './wallets/rotation_history.json'
    ].filter(file => fs.existsSync(file));

    return this.createBackup(tradingFiles, 'trading', reason, false);
  }

  public backupConfigFiles(reason: string = 'Configuration backup'): string {
    const configFiles = [
      './dist/data/security_config.json',
      './src/enhanced/masterConfig.ts',
      './src/config.ts'
    ].filter(file => fs.existsSync(file));

    return this.createBackup(configFiles, 'config', reason, false);
  }

  private createBackup(
    files: string[], 
    category: string, 
    reason: string, 
    critical: boolean
  ): string {
    const timestamp = new Date();
    const version = this.generateVersionString(timestamp);
    const backupId = `${category}_${version}`;
    const targetDir = path.join(this.versionsDir, category, backupId);

    try {
      // Create backup directory
      fs.mkdirSync(targetDir, { recursive: true });

      const backupEntry: BackupEntry = {
        timestamp,
        version,
        description: `${category} backup`,
        files: [],
        reason,
        success: false
      };

      // Copy each file
      for (const filePath of files) {
        if (!fs.existsSync(filePath)) {
          console.log(`⚠️ Skipping missing file: ${filePath}`);
          continue;
        }

        const fileName = path.basename(filePath);
        const backupPath = path.join(targetDir, fileName);
        const stats = fs.statSync(filePath);

        // Copy file
        fs.copyFileSync(filePath, backupPath);

        backupEntry.files.push({
          original: filePath,
          backup: backupPath,
          size: stats.size,
          checksum: this.calculateFileChecksum(filePath)
        });
      }

      backupEntry.success = true;
      this.backupHistory.push(backupEntry);

      // Create rollback point if critical
      if (critical) {
        this.createRollbackPoint(backupId, timestamp, version, `Critical backup: ${reason}`, files, true);
      }

      // Save backup metadata
      const metadataFile = path.join(targetDir, '_backup_metadata.json');
      fs.writeFileSync(metadataFile, JSON.stringify(backupEntry, null, 2));

      this.saveBackupHistory();
      this.saveRollbackPoints();

      console.log(`✅ BACKUP CREATED: ${backupId}`);
      console.log(`   📁 Location: ${targetDir}`);
      console.log(`   📄 Files: ${backupEntry.files.length}`);
      console.log(`   📊 Size: ${this.formatBytes(backupEntry.files.reduce((sum, f) => sum + f.size, 0))}`);
      console.log(`   🔒 Critical: ${critical ? 'YES' : 'NO'}`);

      return backupId;

    } catch (error) {
      console.error(`❌ Backup failed: ${error}`);
      return '';
    }
  }

  public createRollbackPoint(
    id: string,
    timestamp: Date,
    version: string,
    description: string,
    files: string[],
    critical: boolean = false
  ): void {
    const rollbackPoint: RollbackPoint = {
      id,
      timestamp,
      version,
      description,
      files,
      critical
    };

    this.rollbackPoints.push(rollbackPoint);
    this.saveRollbackPoints();

    console.log(`📍 Rollback point created: ${id} (${critical ? 'CRITICAL' : 'standard'})`);
  }

  public listRollbackPoints(): RollbackPoint[] {
    return this.rollbackPoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public rollbackToPoint(rollbackId: string, confirm: boolean = false): boolean {
    const rollbackPoint = this.rollbackPoints.find(rp => rp.id === rollbackId);
    if (!rollbackPoint) {
      console.error(`❌ Rollback point not found: ${rollbackId}`);
      return false;
    }

    if (!confirm) {
      console.log(`⚠️ ROLLBACK CONFIRMATION REQUIRED`);
      console.log(`   🆔 Point: ${rollbackPoint.id}`);
      console.log(`   📅 Created: ${rollbackPoint.timestamp.toLocaleString()}`);
      console.log(`   📝 Description: ${rollbackPoint.description}`);
      console.log(`   📄 Files: ${rollbackPoint.files.length}`);
      console.log(`   🔒 Critical: ${rollbackPoint.critical ? 'YES' : 'NO'}`);
      console.log(`\nTo confirm rollback, call: rollbackToPoint('${rollbackId}', true)`);
      return false;
    }

    try {
      // Create pre-rollback backup
      const preRollbackId = this.backupCriticalFiles(`Pre-rollback backup before ${rollbackId}`);
      
      // Find backup directory
      const backupPath = this.findBackupPath(rollbackPoint.id);
      if (!backupPath) {
        console.error(`❌ Backup files not found for rollback point: ${rollbackId}`);
        return false;
      }

      // Restore files
      let restoredCount = 0;
      for (const originalFile of rollbackPoint.files) {
        const fileName = path.basename(originalFile);
        const backupFile = path.join(backupPath, fileName);
        
        if (fs.existsSync(backupFile)) {
          // Create directory if it doesn't exist
          const dir = path.dirname(originalFile);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          fs.copyFileSync(backupFile, originalFile);
          restoredCount++;
          console.log(`   ✅ Restored: ${originalFile}`);
        } else {
          console.log(`   ⚠️ Backup file not found: ${backupFile}`);
        }
      }

      console.log(`\n🔄 ROLLBACK COMPLETED`);
      console.log(`   📍 Rollback point: ${rollbackId}`);
      console.log(`   📄 Files restored: ${restoredCount}/${rollbackPoint.files.length}`);
      console.log(`   💾 Pre-rollback backup: ${preRollbackId}`);
      console.log(`   ⏰ Timestamp: ${new Date().toLocaleString()}`);

      return true;

    } catch (error) {
      console.error(`❌ Rollback failed: ${error}`);
      return false;
    }
  }

  private findBackupPath(backupId: string): string | null {
    const categories = ['critical', 'daily', 'config', 'trading'];
    
    for (const category of categories) {
      const categoryPath = path.join(this.versionsDir, category);
      if (fs.existsSync(categoryPath)) {
        const backupPath = path.join(categoryPath, backupId);
        if (fs.existsSync(backupPath)) {
          return backupPath;
        }
      }
    }
    
    return null;
  }

  public cleanupOldBackups(retentionDays: number = 30): void {
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
    let deletedCount = 0;
    let freedSpace = 0;

    console.log(`🧹 Cleaning up backups older than ${retentionDays} days...`);

    const processDirectory = (dir: string) => {
      if (!fs.existsSync(dir)) return;

      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory() && stats.mtime < cutoffDate) {
          // Check if this is a critical backup
          const metadataFile = path.join(itemPath, '_backup_metadata.json');
          let isCritical = false;

          if (fs.existsSync(metadataFile)) {
            try {
              const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
              // Keep critical backups for longer
              if (this.rollbackPoints.some(rp => rp.id === item && rp.critical)) {
                continue;
              }
            } catch (error) {
              // Continue with deletion if metadata is corrupted
            }
          }

          // Calculate directory size
          const dirSize = this.calculateDirectorySize(itemPath);
          freedSpace += dirSize;

          // Remove directory
          fs.rmSync(itemPath, { recursive: true, force: true });
          deletedCount++;
          console.log(`   🗑️ Deleted: ${item} (${this.formatBytes(dirSize)})`);
        }
      }
    };

    // Process all backup categories
    ['critical', 'daily', 'config', 'trading'].forEach(category => {
      const categoryPath = path.join(this.versionsDir, category);
      processDirectory(categoryPath);
    });

    // Clean up rollback points for deleted backups
    const originalCount = this.rollbackPoints.length;
    this.rollbackPoints = this.rollbackPoints.filter(rp => {
      const backupPath = this.findBackupPath(rp.id);
      return backupPath !== null;
    });

    if (this.rollbackPoints.length < originalCount) {
      this.saveRollbackPoints();
    }

    console.log(`✅ Cleanup completed:`);
    console.log(`   🗑️ Deleted backups: ${deletedCount}`);
    console.log(`   💾 Space freed: ${this.formatBytes(freedSpace)}`);
  }

  public getBackupStats(): any {
    const totalBackups = this.backupHistory.length;
    const totalSize = this.calculateDirectorySize(this.backupDir);
    const criticalBackups = this.rollbackPoints.filter(rp => rp.critical).length;
    const lastBackup = this.backupHistory.length > 0 
      ? this.backupHistory[this.backupHistory.length - 1].timestamp
      : null;

    return {
      totalBackups,
      totalSize: this.formatBytes(totalSize),
      criticalBackups,
      rollbackPoints: this.rollbackPoints.length,
      lastBackup: lastBackup?.toLocaleString(),
      oldestBackup: this.backupHistory.length > 0 
        ? this.backupHistory[0].timestamp.toLocaleString()
        : null
    };
  }

  // Utility methods
  private generateVersionString(timestamp: Date): string {
    return timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }

  private calculateFileChecksum(filePath: string): string {
    // Simple checksum - in production, use crypto.createHash
    const content = fs.readFileSync(filePath);
    return content.length.toString(16);
  }

  private calculateDirectorySize(dirPath: string): number {
    if (!fs.existsSync(dirPath)) return 0;
    
    let size = 0;
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        size += this.calculateDirectorySize(itemPath);
      } else {
        size += stats.size;
      }
    }
    
    return size;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private loadBackupHistory(): void {
    const historyFile = path.join(this.backupDir, 'backup_history.json');
    
    if (fs.existsSync(historyFile)) {
      try {
        const data = fs.readFileSync(historyFile, 'utf-8');
        const rawHistory = JSON.parse(data);
        this.backupHistory = rawHistory.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp)
        }));
      } catch (error) {
        console.log('⚠️ Could not load backup history');
        this.backupHistory = [];
      }
    }
  }

  private saveBackupHistory(): void {
    const historyFile = path.join(this.backupDir, 'backup_history.json');
    fs.writeFileSync(historyFile, JSON.stringify(this.backupHistory, null, 2));
  }

  private loadRollbackPoints(): void {
    if (fs.existsSync(this.rollbackPointsFile)) {
      try {
        const data = fs.readFileSync(this.rollbackPointsFile, 'utf-8');
        const rawPoints = JSON.parse(data);
        this.rollbackPoints = rawPoints.map((point: any) => ({
          ...point,
          timestamp: new Date(point.timestamp)
        }));
      } catch (error) {
        console.log('⚠️ Could not load rollback points');
        this.rollbackPoints = [];
      }
    }
  }

  private saveRollbackPoints(): void {
    fs.writeFileSync(this.rollbackPointsFile, JSON.stringify(this.rollbackPoints, null, 2));
  }
}