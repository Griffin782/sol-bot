import * as fs from 'fs';
import * as path from 'path';

interface FileAnalysis {
  fileName: string;
  extension: string;
  filePath: string;
  size: number;
  lastModified: Date;
  isRecentlyModified: boolean;
  lineCount?: number;
  firstFewLines: string[];
  dataType: string;
  estimatedPurpose: string;
}

interface FolderAnalysis {
  folderName: string;
  path: string;
  files: FileAnalysis[];
  totalSize: number;
  activeFiles: FileAnalysis[];
  inactiveFiles: FileAnalysis[];
  estimatedPurpose: string;
}

interface AnalysisReport {
  scanDate: Date;
  folders: FolderAnalysis[];
  patterns: {
    duplicateData: string[];
    totalSecuredReferences: FileAnalysis[];
    walletRotationFiles: FileAnalysis[];
    sessionFiles: FileAnalysis[];
  };
  recommendations: {
    filesToDelete: string[];
    filesToConsolidate: string[];
    criticalFiles: string[];
  };
}

class DataFolderAnalyzer {
  private readonly foldersToScan = ['./data/', './wallets/', './tax-compliance/'];
  private readonly reportPath = './data-analysis-report.md';
  
  constructor() {
    console.log('🔍 Data Folder Analyzer initialized');
    console.log(`📁 Target folders: ${this.foldersToScan.join(', ')}`);
  }

  async analyze(): Promise<AnalysisReport> {
    console.log('\n🚀 Starting comprehensive data analysis...\n');
    
    const report: AnalysisReport = {
      scanDate: new Date(),
      folders: [],
      patterns: {
        duplicateData: [],
        totalSecuredReferences: [],
        walletRotationFiles: [],
        sessionFiles: []
      },
      recommendations: {
        filesToDelete: [],
        filesToConsolidate: [],
        criticalFiles: []
      }
    };

    for (const folderPath of this.foldersToScan) {
      console.log(`📂 Analyzing folder: ${folderPath}`);
      
      if (!fs.existsSync(folderPath)) {
        console.log(`   ⚠️  Folder does not exist: ${folderPath}`);
        continue;
      }

      const folderAnalysis = await this.analyzeFolderRecursively(folderPath);
      report.folders.push(folderAnalysis);
      
      console.log(`   ✅ Completed analysis of ${folderPath}`);
      console.log(`   📊 Found ${folderAnalysis.files.length} files, total size: ${this.formatBytes(folderAnalysis.totalSize)}`);
      console.log(`   🟢 Active files: ${folderAnalysis.activeFiles.length}`);
      console.log(`   🔴 Inactive files: ${folderAnalysis.inactiveFiles.length}\n`);
    }

    console.log('🔍 Detecting patterns across all folders...');
    this.detectPatterns(report);
    
    console.log('💡 Generating recommendations...');
    this.generateRecommendations(report);
    
    console.log('📝 Writing analysis report...');
    await this.writeReport(report);
    
    console.log('✅ Analysis complete! Report saved to:', this.reportPath);
    
    return report;
  }

  private async analyzeFolderRecursively(folderPath: string): Promise<FolderAnalysis> {
    const folderAnalysis: FolderAnalysis = {
      folderName: path.basename(folderPath),
      path: folderPath,
      files: [],
      totalSize: 0,
      activeFiles: [],
      inactiveFiles: [],
      estimatedPurpose: ''
    };

    const items = fs.readdirSync(folderPath);
    
    for (const item of items) {
      const itemPath = path.join(folderPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        console.log(`   📁 Scanning subdirectory: ${item}`);
        const subFolderAnalysis = await this.analyzeFolderRecursively(itemPath);
        folderAnalysis.files.push(...subFolderAnalysis.files);
        folderAnalysis.totalSize += subFolderAnalysis.totalSize;
      } else {
        console.log(`   📄 Analyzing file: ${item}`);
        const fileAnalysis = await this.analyzeFile(itemPath, stats);
        folderAnalysis.files.push(fileAnalysis);
        folderAnalysis.totalSize += fileAnalysis.size;
        
        if (fileAnalysis.isRecentlyModified) {
          folderAnalysis.activeFiles.push(fileAnalysis);
        } else {
          folderAnalysis.inactiveFiles.push(fileAnalysis);
        }
      }
    }

    folderAnalysis.estimatedPurpose = this.estimateFolderPurpose(folderAnalysis);
    
    return folderAnalysis;
  }

  private async analyzeFile(filePath: string, stats: fs.Stats): Promise<FileAnalysis> {
    const fileName = path.basename(filePath);
    const extension = path.extname(fileName).toLowerCase();
    const isRecentlyModified = (Date.now() - stats.mtime.getTime()) < (24 * 60 * 60 * 1000);
    
    console.log(`     🔬 File: ${fileName} (${this.formatBytes(stats.size)})`);
    console.log(`        📅 Last modified: ${stats.mtime.toISOString()}`);
    console.log(`        ${isRecentlyModified ? '🟢 Recently active' : '🔴 Inactive'}`);

    const fileAnalysis: FileAnalysis = {
      fileName,
      extension,
      filePath,
      size: stats.size,
      lastModified: stats.mtime,
      isRecentlyModified,
      firstFewLines: [],
      dataType: this.determineDataType(extension, fileName),
      estimatedPurpose: ''
    };

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      fileAnalysis.lineCount = lines.length;
      fileAnalysis.firstFewLines = lines.slice(0, 5).map(line => line.substring(0, 100));
      
      console.log(`        📊 Lines: ${fileAnalysis.lineCount}`);
      console.log(`        🎯 Data type: ${fileAnalysis.dataType}`);
      
      if (fileAnalysis.firstFewLines.length > 0) {
        console.log(`        👀 First line preview: ${fileAnalysis.firstFewLines[0].substring(0, 50)}...`);
      }
      
    } catch (error) {
      console.log(`        ⚠️  Could not read file content: ${error}`);
      fileAnalysis.firstFewLines = ['[Unable to read file content]'];
    }

    fileAnalysis.estimatedPurpose = this.estimateFilePurpose(fileAnalysis);
    console.log(`        💡 Estimated purpose: ${fileAnalysis.estimatedPurpose}`);
    
    return fileAnalysis;
  }

  private determineDataType(extension: string, fileName: string): string {
    const extMap: { [key: string]: string } = {
      '.json': 'JSON Data',
      '.jsonl': 'JSON Lines Data',
      '.csv': 'CSV Data',
      '.txt': 'Text Data',
      '.md': 'Markdown Documentation',
      '.ts': 'TypeScript Code',
      '.js': 'JavaScript Code',
      '.log': 'Log File'
    };

    if (extMap[extension]) {
      return extMap[extension];
    }

    if (fileName.includes('log')) return 'Log File';
    if (fileName.includes('config')) return 'Configuration';
    if (fileName.includes('backup')) return 'Backup File';
    
    return 'Unknown';
  }

  private estimateFilePurpose(file: FileAnalysis): string {
    const name = file.fileName.toLowerCase();
    const content = file.firstFewLines.join(' ').toLowerCase();

    if (name.includes('trading') || content.includes('trade') || content.includes('buy') || content.includes('sell')) {
      return 'Trading Data/History';
    }
    if (name.includes('whale') || content.includes('whale')) {
      return 'Whale Activity Tracking';
    }
    if (name.includes('pool') || content.includes('pool')) {
      return 'Pool Transaction Data';
    }
    if (name.includes('wallet') || name.includes('rotation') || content.includes('wallet')) {
      return 'Wallet Management';
    }
    if (name.includes('session') || content.includes('session')) {
      return 'Session Tracking';
    }
    if (name.includes('tax') || name.includes('compliance')) {
      return 'Tax/Compliance Records';
    }
    if (name.includes('security') || content.includes('security')) {
      return 'Security Configuration';
    }
    if (name.includes('final') || name.includes('state')) {
      return 'State/Status Tracking';
    }
    if (name.includes('pending') || content.includes('pending')) {
      return 'Pending Operations';
    }
    if (name.includes('transfer') || content.includes('transfer')) {
      return 'Transfer Records';
    }
    if (name.includes('withdrawal') || content.includes('withdrawal')) {
      return 'Withdrawal Records';
    }
    if (name.includes('summary')) {
      return 'Summary/Report';
    }
    
    return 'General Data Storage';
  }

  private estimateFolderPurpose(folder: FolderAnalysis): string {
    const name = folder.folderName.toLowerCase();
    
    if (name === 'data') {
      return 'Main data storage - trading logs, transaction records, and core application data';
    }
    if (name === 'wallets') {
      return 'Wallet management - rotation history, session summaries, and wallet operations';
    }
    if (name === 'tax-compliance') {
      return 'Tax and compliance documentation and records';
    }
    
    const purposes = folder.files.map(f => f.estimatedPurpose);
    const uniquePurposes = [...new Set(purposes)];
    
    return `Mixed purpose: ${uniquePurposes.slice(0, 3).join(', ')}`;
  }

  private detectPatterns(report: AnalysisReport): void {
    console.log('🔍 Detecting data patterns...');
    
    const allFiles = report.folders.flatMap(f => f.files);
    
    console.log('   🔍 Looking for "Total Secured" references...');
    report.patterns.totalSecuredReferences = allFiles.filter(file => {
      const content = file.firstFewLines.join(' ').toLowerCase();
      const hasReference = content.includes('total secured') || content.includes('totalsecured');
      if (hasReference) {
        console.log(`     ✓ Found in: ${file.filePath}`);
      }
      return hasReference;
    });

    console.log('   🔍 Looking for wallet rotation files...');
    report.patterns.walletRotationFiles = allFiles.filter(file => {
      const isWalletFile = file.fileName.toLowerCase().includes('rotation') || 
                          file.fileName.toLowerCase().includes('wallet') ||
                          file.estimatedPurpose.includes('Wallet');
      if (isWalletFile) {
        console.log(`     ✓ Found: ${file.filePath}`);
      }
      return isWalletFile;
    });

    console.log('   🔍 Looking for session files...');
    report.patterns.sessionFiles = allFiles.filter(file => {
      const isSessionFile = file.fileName.toLowerCase().includes('session') ||
                           file.estimatedPurpose.includes('Session');
      if (isSessionFile) {
        console.log(`     ✓ Found: ${file.filePath}`);
      }
      return isSessionFile;
    });

    console.log('   🔍 Looking for duplicate data patterns...');
    const fileGroups = new Map<string, FileAnalysis[]>();
    
    allFiles.forEach(file => {
      const key = this.generateDuplicateKey(file);
      if (!fileGroups.has(key)) {
        fileGroups.set(key, []);
      }
      fileGroups.get(key)!.push(file);
    });

    fileGroups.forEach((files, key) => {
      if (files.length > 1) {
        console.log(`     ⚠️  Potential duplicates for ${key}:`);
        files.forEach(f => console.log(`        - ${f.filePath}`));
        report.patterns.duplicateData.push(`${key}: ${files.map(f => f.filePath).join(', ')}`);
      }
    });

    console.log(`   📊 Pattern detection complete:`);
    console.log(`      - Total Secured references: ${report.patterns.totalSecuredReferences.length}`);
    console.log(`      - Wallet rotation files: ${report.patterns.walletRotationFiles.length}`);
    console.log(`      - Session files: ${report.patterns.sessionFiles.length}`);
    console.log(`      - Duplicate data groups: ${report.patterns.duplicateData.length}`);
  }

  private generateDuplicateKey(file: FileAnalysis): string {
    const baseName = file.fileName.replace(/[-_]\d+/, '').replace(/\.(backup|orig|old)/, '');
    return `${file.dataType}-${baseName}`;
  }

  private generateRecommendations(report: AnalysisReport): void {
    console.log('💡 Generating recommendations...');
    
    const allFiles = report.folders.flatMap(f => f.files);
    
    console.log('   🗑️  Identifying files that can be safely deleted...');
    const potentialDeletes = allFiles.filter(file => {
      const isOld = !file.isRecentlyModified && (Date.now() - file.lastModified.getTime()) > (30 * 24 * 60 * 60 * 1000);
      const isBackup = file.fileName.includes('backup') || file.fileName.includes('orig');
      const isSmallAndOld = file.size < 1000 && isOld;
      
      const shouldDelete = (isBackup && isOld) || isSmallAndOld;
      
      if (shouldDelete) {
        console.log(`     🗑️  ${file.filePath} - ${isBackup ? 'old backup' : 'small and old'}`);
      }
      
      return shouldDelete;
    });
    
    report.recommendations.filesToDelete = potentialDeletes.map(f => f.filePath);

    console.log('   🔄 Identifying files for consolidation...');
    if (report.patterns.duplicateData.length > 0) {
      report.recommendations.filesToConsolidate = report.patterns.duplicateData;
      report.patterns.duplicateData.forEach(group => {
        console.log(`     🔄 ${group}`);
      });
    }

    console.log('   🔒 Identifying critical files...');
    const criticalFiles = allFiles.filter(file => {
      const isCritical = file.isRecentlyModified || 
                        file.fileName.includes('final') ||
                        file.fileName.includes('state') ||
                        file.estimatedPurpose.includes('Tax') ||
                        file.estimatedPurpose.includes('Security') ||
                        file.size > 1000000; // Files larger than 1MB
      
      if (isCritical) {
        console.log(`     🔒 ${file.filePath} - ${file.isRecentlyModified ? 'recently active' : 'important data'}`);
      }
      
      return isCritical;
    });
    
    report.recommendations.criticalFiles = criticalFiles.map(f => f.filePath);

    console.log(`   📊 Recommendations summary:`);
    console.log(`      - Files to delete: ${report.recommendations.filesToDelete.length}`);
    console.log(`      - File groups to consolidate: ${report.recommendations.filesToConsolidate.length}`);
    console.log(`      - Critical files to preserve: ${report.recommendations.criticalFiles.length}`);
  }

  private async writeReport(report: AnalysisReport): Promise<void> {
    const md = this.generateMarkdownReport(report);
    fs.writeFileSync(this.reportPath, md, 'utf8');
  }

  private generateMarkdownReport(report: AnalysisReport): string {
    let md = `# Data Analysis Report\n\n`;
    md += `**Generated:** ${report.scanDate.toISOString()}\n\n`;
    md += `## Executive Summary\n\n`;
    
    const totalFiles = report.folders.reduce((sum, f) => sum + f.files.length, 0);
    const totalSize = report.folders.reduce((sum, f) => sum + f.totalSize, 0);
    const activeFiles = report.folders.reduce((sum, f) => sum + f.activeFiles.length, 0);
    
    md += `- **Total Files Analyzed:** ${totalFiles}\n`;
    md += `- **Total Data Size:** ${this.formatBytes(totalSize)}\n`;
    md += `- **Active Files (modified in last 24h):** ${activeFiles}\n`;
    md += `- **Inactive Files:** ${totalFiles - activeFiles}\n\n`;

    md += `## Folder Analysis\n\n`;
    
    report.folders.forEach(folder => {
      md += `### ${folder.folderName}\n\n`;
      md += `**Path:** \`${folder.path}\`\n\n`;
      md += `**Purpose:** ${folder.estimatedPurpose}\n\n`;
      md += `**Statistics:**\n`;
      md += `- Files: ${folder.files.length}\n`;
      md += `- Total Size: ${this.formatBytes(folder.totalSize)}\n`;
      md += `- Active Files: ${folder.activeFiles.length}\n`;
      md += `- Inactive Files: ${folder.inactiveFiles.length}\n\n`;

      if (folder.files.length > 0) {
        md += `**Files:**\n\n`;
        md += `| File | Size | Last Modified | Status | Purpose |\n`;
        md += `|------|------|---------------|--------|----------|\n`;
        
        folder.files.forEach(file => {
          const status = file.isRecentlyModified ? '🟢 Active' : '🔴 Inactive';
          md += `| ${file.fileName} | ${this.formatBytes(file.size)} | ${file.lastModified.toISOString().split('T')[0]} | ${status} | ${file.estimatedPurpose} |\n`;
        });
        
        md += `\n`;
      }
    });

    md += `## Pattern Analysis\n\n`;
    
    md += `### Total Secured References\n`;
    if (report.patterns.totalSecuredReferences.length > 0) {
      md += `Found ${report.patterns.totalSecuredReferences.length} files containing "Total Secured" references:\n\n`;
      report.patterns.totalSecuredReferences.forEach(file => {
        md += `- \`${file.filePath}\`\n`;
      });
    } else {
      md += `No files found containing "Total Secured" references.\n`;
    }
    md += `\n`;

    md += `### Wallet Rotation Files\n`;
    if (report.patterns.walletRotationFiles.length > 0) {
      md += `Found ${report.patterns.walletRotationFiles.length} wallet-related files:\n\n`;
      report.patterns.walletRotationFiles.forEach(file => {
        md += `- \`${file.filePath}\` - ${file.estimatedPurpose}\n`;
      });
    } else {
      md += `No wallet rotation files found.\n`;
    }
    md += `\n`;

    md += `### Session Files\n`;
    if (report.patterns.sessionFiles.length > 0) {
      md += `Found ${report.patterns.sessionFiles.length} session-related files:\n\n`;
      report.patterns.sessionFiles.forEach(file => {
        md += `- \`${file.filePath}\` - ${file.estimatedPurpose}\n`;
      });
    } else {
      md += `No session files found.\n`;
    }
    md += `\n`;

    md += `### Duplicate Data Detection\n`;
    if (report.patterns.duplicateData.length > 0) {
      md += `Found ${report.patterns.duplicateData.length} groups of potentially duplicate data:\n\n`;
      report.patterns.duplicateData.forEach(group => {
        md += `- ${group}\n`;
      });
    } else {
      md += `No duplicate data patterns detected.\n`;
    }
    md += `\n`;

    md += `## Recommendations\n\n`;
    
    md += `### Files Safe to Delete\n`;
    if (report.recommendations.filesToDelete.length > 0) {
      md += `The following ${report.recommendations.filesToDelete.length} files can potentially be safely deleted:\n\n`;
      report.recommendations.filesToDelete.forEach(filePath => {
        md += `- \`${filePath}\`\n`;
      });
      md += `\n⚠️ **Warning:** Review these files manually before deletion.\n`;
    } else {
      md += `No files identified for safe deletion.\n`;
    }
    md += `\n`;

    md += `### Files for Consolidation\n`;
    if (report.recommendations.filesToConsolidate.length > 0) {
      md += `The following file groups should be reviewed for consolidation:\n\n`;
      report.recommendations.filesToConsolidate.forEach(group => {
        md += `- ${group}\n`;
      });
    } else {
      md += `No files identified for consolidation.\n`;
    }
    md += `\n`;

    md += `### Critical Files to Preserve\n`;
    md += `The following ${report.recommendations.criticalFiles.length} files are critical and should be preserved:\n\n`;
    report.recommendations.criticalFiles.forEach(filePath => {
      md += `- \`${filePath}\`\n`;
    });
    md += `\n`;

    md += `## Next Steps\n\n`;
    md += `1. Review the duplicate data groups and consolidate where appropriate\n`;
    md += `2. Backup critical files before making any changes\n`;
    md += `3. Use the cleanup script (\`cleanup-data.ts\`) to safely remove identified files\n`;
    md += `4. Consider implementing automated archiving for old backup files\n`;
    md += `5. Set up monitoring for actively used data files\n\n`;

    return md;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

async function main() {
  console.log('🎯 Starting Data Folder Analysis');
  console.log('================================\n');
  
  const analyzer = new DataFolderAnalyzer();
  
  try {
    const report = await analyzer.analyze();
    
    console.log('\n🎉 Analysis Complete!');
    console.log('====================');
    console.log(`📊 Analyzed ${report.folders.length} folders`);
    console.log(`📄 Total files: ${report.folders.reduce((sum, f) => sum + f.files.length, 0)}`);
    console.log(`💾 Total size: ${report.folders.reduce((sum, f) => sum + f.totalSize, 0)} bytes`);
    console.log(`📝 Report saved to: data-analysis-report.md`);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DataFolderAnalyzer, FileAnalysis, FolderAnalysis, AnalysisReport };