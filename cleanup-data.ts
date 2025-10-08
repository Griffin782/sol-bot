import * as fs from 'fs';
import * as path from 'path';
import { DataFolderAnalyzer, AnalysisReport } from './analyze-data-folders';

interface CleanupOptions {
  dryRun: boolean;
  createBackup: boolean;
  backupPath?: string;
  deleteFiles?: string[];
  consolidateGroups?: string[];
  preserveCritical: boolean;
}

interface CleanupResult {
  backupCreated: boolean;
  backupPath?: string;
  filesDeleted: string[];
  filesConsolidated: string[];
  errors: string[];
  spaceFreed: number;
}

class DataCleanup {
  private options: CleanupOptions;
  private result: CleanupResult;

  constructor(options: Partial<CleanupOptions> = {}) {
    this.options = {
      dryRun: options.dryRun ?? true,
      createBackup: options.createBackup ?? true,
      preserveCritical: options.preserveCritical ?? true,
      ...options
    };

    this.result = {
      backupCreated: false,
      filesDeleted: [],
      filesConsolidated: [],
      errors: [],
      spaceFreed: 0
    };

    console.log('🧹 Data Cleanup Tool initialized');
    console.log(`   Mode: ${this.options.dryRun ? '🔍 DRY RUN' : '⚡ LIVE MODE'}`);
    console.log(`   Backup: ${this.options.createBackup ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Preserve Critical: ${this.options.preserveCritical ? '✅ Enabled' : '❌ Disabled'}\n`);
  }

  async cleanup(): Promise<CleanupResult> {
    console.log('🚀 Starting cleanup process...\n');

    try {
      // Step 1: Run analysis to get current state
      console.log('📊 Running fresh analysis...');
      const analyzer = new DataFolderAnalyzer();
      const report = await analyzer.analyze();
      
      // Step 2: Create backup if requested
      if (this.options.createBackup && !this.options.dryRun) {
        await this.createBackup();
      }

      // Step 3: Process deletions
      await this.processFileDeletions(report);

      // Step 4: Process consolidations
      await this.processConsolidations(report);

      // Step 5: Generate cleanup summary
      this.generateCleanupSummary();

      console.log('✅ Cleanup process completed!\n');
      return this.result;

    } catch (error) {
      console.error('❌ Cleanup process failed:', error);
      this.result.errors.push(`Cleanup failed: ${error}`);
      return this.result;
    }
  }

  private async createBackup(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = this.options.backupPath || `./backup-cleanup-${timestamp}`;

    console.log(`📦 Creating backup at: ${backupDir}`);

    try {
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const foldersToBackup = ['./data/', './wallets/', './tax-compliance/'];
      
      for (const folder of foldersToBackup) {
        if (fs.existsSync(folder)) {
          const targetFolder = path.join(backupDir, path.basename(folder));
          console.log(`   📂 Backing up ${folder} to ${targetFolder}`);
          await this.copyFolderRecursive(folder, targetFolder);
        }
      }

      this.result.backupCreated = true;
      this.result.backupPath = backupDir;
      console.log(`✅ Backup created successfully at: ${backupDir}\n`);

    } catch (error) {
      console.error(`❌ Backup creation failed: ${error}`);
      this.result.errors.push(`Backup failed: ${error}`);
      throw error;
    }
  }

  private async copyFolderRecursive(source: string, target: string): Promise<void> {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    const items = fs.readdirSync(source);

    for (const item of items) {
      const sourcePath = path.join(source, item);
      const targetPath = path.join(target, item);
      const stats = fs.statSync(sourcePath);

      if (stats.isDirectory()) {
        await this.copyFolderRecursive(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }

  private async processFileDeletions(report: AnalysisReport): Promise<void> {
    console.log('🗑️  Processing file deletions...');

    const filesToDelete = this.options.deleteFiles || report.recommendations.filesToDelete;
    const criticalFiles = new Set(report.recommendations.criticalFiles);

    if (filesToDelete.length === 0) {
      console.log('   ℹ️  No files identified for deletion');
      return;
    }

    console.log(`   📋 ${filesToDelete.length} files marked for deletion`);

    for (const filePath of filesToDelete) {
      try {
        // Safety check: don't delete critical files unless explicitly overridden
        if (this.options.preserveCritical && criticalFiles.has(filePath)) {
          console.log(`   🔒 SKIPPING critical file: ${filePath}`);
          continue;
        }

        if (!fs.existsSync(filePath)) {
          console.log(`   ⚠️  File not found: ${filePath}`);
          continue;
        }

        const stats = fs.statSync(filePath);
        const fileSize = stats.size;

        if (this.options.dryRun) {
          console.log(`   🔍 [DRY RUN] Would delete: ${filePath} (${this.formatBytes(fileSize)})`);
          this.result.spaceFreed += fileSize;
        } else {
          console.log(`   🗑️  Deleting: ${filePath} (${this.formatBytes(fileSize)})`);
          fs.unlinkSync(filePath);
          this.result.filesDeleted.push(filePath);
          this.result.spaceFreed += fileSize;
        }

      } catch (error) {
        const errorMsg = `Failed to delete ${filePath}: ${error}`;
        console.error(`   ❌ ${errorMsg}`);
        this.result.errors.push(errorMsg);
      }
    }

    console.log(`   📊 Deletion summary: ${this.options.dryRun ? 'Would delete' : 'Deleted'} ${this.options.dryRun ? filesToDelete.length : this.result.filesDeleted.length} files`);
    console.log(`   💾 Space ${this.options.dryRun ? 'would be' : ''} freed: ${this.formatBytes(this.result.spaceFreed)}\n`);
  }

  private async processConsolidations(report: AnalysisReport): Promise<void> {
    console.log('🔄 Processing data consolidations...');

    const consolidateGroups = this.options.consolidateGroups || report.recommendations.filesToConsolidate;

    if (consolidateGroups.length === 0) {
      console.log('   ℹ️  No file groups identified for consolidation');
      return;
    }

    console.log(`   📋 ${consolidateGroups.length} file groups marked for consolidation`);

    for (const group of consolidateGroups) {
      try {
        console.log(`   🔍 Analyzing group: ${group}`);
        
        // Parse the group string to extract file paths
        const colonIndex = group.indexOf(':');
        if (colonIndex === -1) continue;
        
        const groupName = group.substring(0, colonIndex);
        const filesStr = group.substring(colonIndex + 1);
        const filePaths = filesStr.split(',').map(p => p.trim());

        if (filePaths.length < 2) {
          console.log(`   ⚠️  Group ${groupName} has less than 2 files, skipping`);
          continue;
        }

        // Find the newest/largest file to keep as primary
        let primaryFile = '';
        let primaryStats: fs.Stats | null = null;

        for (const filePath of filePaths) {
          if (!fs.existsSync(filePath)) continue;
          
          const stats = fs.statSync(filePath);
          if (!primaryStats || stats.mtime > primaryStats.mtime || stats.size > primaryStats.size) {
            primaryFile = filePath;
            primaryStats = stats;
          }
        }

        if (!primaryFile) {
          console.log(`   ⚠️  No valid files found in group ${groupName}`);
          continue;
        }

        console.log(`   📌 Primary file for ${groupName}: ${primaryFile}`);

        if (this.options.dryRun) {
          console.log(`   🔍 [DRY RUN] Would consolidate ${filePaths.length} files in group: ${groupName}`);
          console.log(`   🔍 [DRY RUN] Would keep: ${primaryFile}`);
          filePaths.forEach(fp => {
            if (fp !== primaryFile) {
              console.log(`   🔍 [DRY RUN] Would remove: ${fp}`);
            }
          });
        } else {
          // In live mode, we would implement actual consolidation logic here
          // For now, just log what would happen
          console.log(`   ⚠️  [LIVE MODE] Consolidation logic not implemented yet for safety`);
          console.log(`   💡 Manual action required: Review and consolidate group ${groupName}`);
        }

        this.result.filesConsolidated.push(group);

      } catch (error) {
        const errorMsg = `Failed to consolidate group ${group}: ${error}`;
        console.error(`   ❌ ${errorMsg}`);
        this.result.errors.push(errorMsg);
      }
    }

    console.log(`   📊 Consolidation summary: ${this.options.dryRun ? 'Would process' : 'Processed'} ${consolidateGroups.length} groups\n`);
  }

  private generateCleanupSummary(): void {
    console.log('📋 Cleanup Summary');
    console.log('==================');
    console.log(`Mode: ${this.options.dryRun ? '🔍 DRY RUN' : '⚡ LIVE MODE'}`);
    console.log(`Backup Created: ${this.result.backupCreated ? '✅' : '❌'}`);
    if (this.result.backupPath) {
      console.log(`Backup Location: ${this.result.backupPath}`);
    }
    console.log(`Files ${this.options.dryRun ? 'to be deleted' : 'deleted'}: ${this.options.dryRun ? 'N/A' : this.result.filesDeleted.length}`);
    console.log(`Groups ${this.options.dryRun ? 'to be consolidated' : 'consolidated'}: ${this.result.filesConsolidated.length}`);
    console.log(`Space ${this.options.dryRun ? 'to be freed' : 'freed'}: ${this.formatBytes(this.result.spaceFreed)}`);
    console.log(`Errors encountered: ${this.result.errors.length}`);
    
    if (this.result.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.result.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    if (this.options.dryRun) {
      console.log('\n💡 This was a DRY RUN. To execute changes, run with dryRun: false');
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Public methods for different cleanup modes
  async dryRunCleanup(): Promise<CleanupResult> {
    this.options.dryRun = true;
    return this.cleanup();
  }

  async liveCleanup(): Promise<CleanupResult> {
    this.options.dryRun = false;
    return this.cleanup();
  }

  async cleanupWithOptions(options: Partial<CleanupOptions>): Promise<CleanupResult> {
    this.options = { ...this.options, ...options };
    return this.cleanup();
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--live');
  const createBackup = !args.includes('--no-backup');
  
  console.log('🎯 Starting Data Cleanup');
  console.log('=========================\n');
  
  const cleanup = new DataCleanup({
    dryRun: isDryRun,
    createBackup: createBackup,
    preserveCritical: true
  });
  
  try {
    if (isDryRun) {
      console.log('🔍 Running in DRY RUN mode - no files will be modified');
      console.log('💡 Add --live flag to execute actual cleanup');
      console.log('💡 Add --no-backup flag to skip backup creation\n');
    } else {
      console.log('⚡ Running in LIVE MODE - files will be modified!');
      console.log('⚠️  Ensure you have reviewed the dry run results first\n');
    }
    
    const result = await cleanup.cleanup();
    
    console.log('\n🎉 Cleanup Complete!');
    console.log('=====================');
    
    if (result.errors.length > 0) {
      console.log('⚠️  Some errors occurred during cleanup');
      process.exit(1);
    } else {
      console.log('✅ Cleanup completed successfully');
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DataCleanup, CleanupOptions, CleanupResult };