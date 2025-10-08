#!/usr/bin/env ts-node

// Tax Recording Fix Script v1.0
// Scans codebase for trade executions and generates tax recording fixes

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

// ============================================
// INTERFACES & TYPES
// ============================================
interface TradeLocation {
  lineNumber: number;
  tradeType: 'buy' | 'sell' | 'swap' | 'unknown';
  codeSnippet: string;
  beforeContext: string[];
  afterContext: string[];
  availableData: string[];
  pattern: string;
  confidence: 'high' | 'medium' | 'low';
}

interface FixSuggestion {
  location: TradeLocation;
  importCode: string;
  replaceCode: string;
  findPattern: string;
  replacePattern: string;
}

// ============================================
// TRADE PATTERNS TO DETECT
// ============================================
const TRADE_PATTERNS = [
  // Buy patterns
  { pattern: /buyToken\s*\(/, type: 'buy', confidence: 'high' as const },
  { pattern: /swapToken\s*\(/, type: 'buy' as const, confidence: 'high' as const },
  { pattern: /swapExactSOLForTokens/, type: 'buy' as const, confidence: 'high' as const },
  { pattern: /\.buy\s*\(/, type: 'buy' as const, confidence: 'medium' as const },
  { pattern: /purchase\s*\(/, type: 'buy' as const, confidence: 'medium' as const },
  
  // Sell patterns
  { pattern: /sellToken\s*\(/, type: 'sell' as const, confidence: 'high' as const },
  { pattern: /unSwapToken\s*\(/, type: 'sell' as const, confidence: 'high' as const },
  { pattern: /swapExactTokensForSOL/, type: 'sell' as const, confidence: 'high' as const },
  { pattern: /\.sell\s*\(/, type: 'sell' as const, confidence: 'medium' as const },
  
  // Generic swap patterns
  { pattern: /Jupiter.*swap/, type: 'swap' as const, confidence: 'medium' as const },
  { pattern: /transaction\.send/, type: 'swap' as const, confidence: 'low' as const },
  { pattern: /connection\.sendTransaction/, type: 'swap' as const, confidence: 'low' as const },
  { pattern: /executeTrade\s*\(/, type: 'swap' as const, confidence: 'high' as const },
  
  // Result handling patterns
  { pattern: /result\s*=.*buy/, type: 'buy' as const, confidence: 'medium' as const },
  { pattern: /result\s*=.*sell/, type: 'sell' as const, confidence: 'medium' as const },
  { pattern: /success.*=.*swap/, type: 'swap' as const, confidence: 'medium' as const }
];

// ============================================
// DATA EXTRACTION PATTERNS
// ============================================
const DATA_PATTERNS = [
  { pattern: /(?:returnedMint|mint|tokenMint)\s*[=:]\s*["`']?([A-Za-z0-9]{32,})["`']?/, dataType: 'tokenMint' },
  { pattern: /(?:BUY_AMOUNT|amount|positionSize)\s*[=:]\s*([0-9.]+)/, dataType: 'amount' },
  { pattern: /(?:entryPrice|buyPrice|price)\s*[=:]\s*([0-9.]+)/, dataType: 'entryPrice' },
  { pattern: /(?:exitPrice|sellPrice|currentPrice)\s*[=:]\s*([0-9.]+)/, dataType: 'exitPrice' },
  { pattern: /(?:profit|pnl|gain)\s*[=:]\s*([0-9.-]+)/, dataType: 'profit' },
  { pattern: /(?:signature|txHash|transaction)\s*[=:]\s*["`']?([A-Za-z0-9]{64,})["`']?/, dataType: 'signature' }
];

// ============================================
// MAIN ANALYSIS CLASS
// ============================================
class TaxRecordingFixer {
  private sourceCode: string = '';
  private lines: string[] = [];
  private tradeLocations: TradeLocation[] = [];
  private fixes: FixSuggestion[] = [];

  constructor() {
    console.log(chalk.cyan.bold('🔍 Tax Recording Fix Script Starting...'));
    console.log('=====================================\n');
  }

  // ============================================
  // STEP 1: SCAN SOURCE CODE
  // ============================================
  public scanSourceCode(filePath: string): void {
    console.log(chalk.yellow.bold(`📖 STEP 1: SCANNING ${filePath}`));
    console.log('='.repeat(50));

    try {
      this.sourceCode = fs.readFileSync(filePath, 'utf8');
      this.lines = this.sourceCode.split('\n');
      console.log(`✅ Loaded ${this.lines.length} lines of code`);
      
      this.findTradeLocations();
      
    } catch (error) {
      console.error(chalk.red(`❌ Error reading file: ${error}`));
      return;
    }
  }

  private findTradeLocations(): void {
    console.log(chalk.blue('\n🔎 Searching for trade execution patterns...'));
    
    TRADE_PATTERNS.forEach(patternConfig => {
      console.log(`\n🔍 Looking for pattern: ${chalk.cyan(patternConfig.pattern.source)}`);
      
      this.lines.forEach((line, index) => {
        if (patternConfig.pattern.test(line)) {
          const lineNumber = index + 1;
          console.log(chalk.green(`  ✅ FOUND at line ${lineNumber}: ${line.trim()}`));
          
          const tradeLocation: TradeLocation = {
            lineNumber,
            tradeType: patternConfig.type as 'buy' | 'sell' | 'swap' | 'unknown',
            codeSnippet: line.trim(),
            beforeContext: this.getContextLines(index, -10, 0),
            afterContext: this.getContextLines(index, 1, 10),
            availableData: this.extractAvailableData(index),
            pattern: patternConfig.pattern.source,
            confidence: patternConfig.confidence
          };
          
          this.tradeLocations.push(tradeLocation);
        }
      });
    });
    
    console.log(chalk.yellow.bold(`\n📊 SCAN RESULTS: Found ${this.tradeLocations.length} trade locations`));
  }

  private getContextLines(centerIndex: number, startOffset: number, endOffset: number): string[] {
    const startIndex = Math.max(0, centerIndex + startOffset);
    const endIndex = Math.min(this.lines.length - 1, centerIndex + endOffset);
    
    const context: string[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      context.push(`${(i + 1).toString().padStart(4)}: ${this.lines[i]}`);
    }
    return context;
  }

  private extractAvailableData(lineIndex: number): string[] {
    const availableData: string[] = [];
    const contextRange = 20; // Check 20 lines before and after
    
    const startIndex = Math.max(0, lineIndex - contextRange);
    const endIndex = Math.min(this.lines.length - 1, lineIndex + contextRange);
    
    for (let i = startIndex; i <= endIndex; i++) {
      const line = this.lines[i];
      
      DATA_PATTERNS.forEach(dataPattern => {
        if (dataPattern.pattern.test(line)) {
          if (!availableData.includes(dataPattern.dataType)) {
            availableData.push(dataPattern.dataType);
          }
        }
      });
    }
    
    return availableData;
  }

  // ============================================
  // STEP 2: ANALYZE EACH LOCATION
  // ============================================
  public analyzeTradeLocations(): void {
    console.log(chalk.yellow.bold('\n📋 STEP 2: ANALYZING EACH TRADE LOCATION'));
    console.log('='.repeat(50));

    this.tradeLocations.forEach((location, index) => {
      console.log(chalk.cyan.bold(`\n🔍 ANALYSIS ${index + 1}/${this.tradeLocations.length}`));
      console.log(`📍 Line ${location.lineNumber} | Type: ${chalk.green(location.tradeType)} | Confidence: ${this.getConfidenceColor(location.confidence)(location.confidence)}`);
      console.log(`📝 Pattern: ${chalk.gray(location.pattern)}`);
      console.log(`💼 Available Data: ${chalk.blue(location.availableData.join(', ') || 'None detected')}`);
      
      console.log(chalk.yellow('\n📄 CODE SNIPPET:'));
      console.log(chalk.gray(location.codeSnippet));
      
      console.log(chalk.yellow('\n📄 CONTEXT (10 lines before):'));
      location.beforeContext.slice(-5).forEach(line => {
        console.log(chalk.dim(line));
      });
      
      console.log(chalk.yellow('\n📄 CONTEXT (10 lines after):'));
      location.afterContext.slice(0, 5).forEach(line => {
        console.log(chalk.dim(line));
      });
      
      console.log(chalk.blue('─'.repeat(60)));
    });
  }

  private getConfidenceColor(confidence: string) {
    switch (confidence) {
      case 'high': return chalk.green;
      case 'medium': return chalk.yellow;
      case 'low': return chalk.red;
      default: return chalk.gray;
    }
  }

  // ============================================
  // STEP 3: GENERATE FIXES
  // ============================================
  public generateFixes(): void {
    console.log(chalk.yellow.bold('\n🔧 STEP 3: GENERATING TAX RECORDING FIXES'));
    console.log('='.repeat(50));

    this.tradeLocations.forEach((location, index) => {
      console.log(chalk.cyan.bold(`\n🛠️  FIX ${index + 1}/${this.tradeLocations.length} - Line ${location.lineNumber}`));
      
      const fix = this.generateFixForLocation(location);
      this.fixes.push(fix);
      
      this.displayFix(fix);
    });
    
    console.log(chalk.green.bold(`\n✅ Generated ${this.fixes.length} tax recording fixes`));
  }

  private generateFixForLocation(location: TradeLocation): FixSuggestion {
    // Generate import statement
    const importCode = this.generateImportStatement();
    
    // Generate the tax recording code
    const taxRecordingCode = this.generateTaxRecordingCode(location);
    
    // Create find/replace patterns
    const findPattern = location.codeSnippet;
    const replacePattern = this.createReplacePattern(location, taxRecordingCode);
    
    return {
      location,
      importCode,
      replaceCode: taxRecordingCode,
      findPattern,
      replacePattern
    };
  }

  private generateImportStatement(): string {
    return `// Import tax compliance module
import { recordTrade, TaxableTransaction } from './tax-compliance/taxTracker';`;
  }

  private generateTaxRecordingCode(location: TradeLocation): string {
    const dataMapping = this.createDataMapping(location);
    
    return `
    // 🏦 TAX RECORDING - ${location.tradeType.toUpperCase()} TRANSACTION
    try {
      const taxData: TaxableTransaction = {
        timestamp: new Date().toISOString(),
        type: '${location.tradeType}',
        ${dataMapping}
      };
      
      await recordTrade(taxData);
      console.log(\`📊 Tax recorded: \${taxData.type} - \${taxData.tokenMint?.slice(0,8)}...\`);
    } catch (taxError) {
      console.warn('⚠️ Tax recording failed:', taxError);
      // Don't fail the trade due to tax recording issues
    }`;
  }

  private createDataMapping(location: TradeLocation): string {
    const mappings: string[] = [];
    
    if (location.availableData.includes('tokenMint')) {
      mappings.push('tokenMint: returnedMint || mint || tokenMint');
    } else {
      mappings.push('tokenMint: "unknown" // ⚠️ ADD ACTUAL TOKEN MINT HERE');
    }
    
    if (location.availableData.includes('amount')) {
      mappings.push('amount: BUY_AMOUNT || amount || positionSize');
    } else {
      mappings.push('amount: 0 // ⚠️ ADD ACTUAL TRADE AMOUNT HERE');
    }
    
    if (location.availableData.includes('entryPrice')) {
      mappings.push('entryPrice: entryPrice || buyPrice || price');
    }
    
    if (location.availableData.includes('exitPrice')) {
      mappings.push('exitPrice: exitPrice || sellPrice || currentPrice');
    }
    
    if (location.availableData.includes('profit')) {
      mappings.push('profit: profit || pnl || gain || 0');
    }
    
    if (location.availableData.includes('signature')) {
      mappings.push('signature: signature || txHash || transaction');
    }
    
    // Add success indicator based on result handling
    mappings.push('success: result || success || true');
    
    return mappings.join(',\n        ');
  }

  private createReplacePattern(location: TradeLocation, taxRecordingCode: string): string {
    // This creates the full replacement including the original code plus tax recording
    return `${location.codeSnippet}
${taxRecordingCode}`;
  }

  private displayFix(fix: FixSuggestion): void {
    console.log(chalk.green('📥 IMPORT TO ADD:'));
    console.log(chalk.gray(fix.importCode));
    
    console.log(chalk.green('\n📝 TAX RECORDING CODE:'));
    console.log(chalk.blue(fix.replaceCode));
    
    console.log(chalk.yellow('\n🔍 FIND THIS CODE:'));
    console.log(chalk.red(`"${fix.findPattern}"`));
    
    console.log(chalk.yellow('\n🔄 REPLACE WITH:'));
    console.log(chalk.green(fix.replacePattern));
    
    console.log(chalk.blue('─'.repeat(80)));
  }

  // ============================================
  // STEP 4: GENERATE INSTALLATION INSTRUCTIONS
  // ============================================
  public generateInstallationInstructions(): void {
    console.log(chalk.yellow.bold('\n📋 STEP 4: INSTALLATION INSTRUCTIONS'));
    console.log('='.repeat(50));
    
    console.log(chalk.cyan.bold('1. ADD IMPORT STATEMENT:'));
    console.log(chalk.gray('Add this import at the top of src/index.ts:'));
    console.log(chalk.green(this.generateImportStatement()));
    
    console.log(chalk.cyan.bold('\n2. APPLY EACH FIX:'));
    this.fixes.forEach((fix, index) => {
      console.log(chalk.yellow(`\n📍 FIX ${index + 1} (Line ${fix.location.lineNumber}):`));
      console.log(chalk.red('FIND:'));
      console.log(`  ${fix.findPattern}`);
      console.log(chalk.green('REPLACE WITH:'));
      console.log(`  ${fix.replacePattern.replace(/\n/g, '\n  ')}`);
    });
    
    console.log(chalk.cyan.bold('\n3. CREATE TAX COMPLIANCE MODULE:'));
    console.log(chalk.gray('The fixes reference ./tax-compliance/taxTracker - make sure this exists!'));
  }

  // ============================================
  // STEP 5: CREATE TAX COMPLIANCE MODULE
  // ============================================
  public createTaxComplianceModule(): void {
    console.log(chalk.yellow.bold('\n📦 STEP 5: CREATING TAX COMPLIANCE MODULE'));
    console.log('='.repeat(50));
    
    const taxTrackerCode = this.generateTaxTrackerModule();
    const taxComplianceDir = './tax-compliance';
    
    try {
      if (!fs.existsSync(taxComplianceDir)) {
        fs.mkdirSync(taxComplianceDir, { recursive: true });
        console.log(chalk.green(`✅ Created directory: ${taxComplianceDir}`));
      }
      
      const taxTrackerPath = path.join(taxComplianceDir, 'taxTracker.ts');
      fs.writeFileSync(taxTrackerPath, taxTrackerCode);
      console.log(chalk.green(`✅ Created: ${taxTrackerPath}`));
      
      console.log(chalk.blue('\n📄 TAX TRACKER MODULE PREVIEW:'));
      console.log(chalk.gray(taxTrackerCode.slice(0, 500) + '...\n[truncated]'));
      
    } catch (error) {
      console.error(chalk.red(`❌ Error creating tax module: ${error}`));
    }
  }

  private generateTaxTrackerModule(): string {
    return `// Tax Compliance Module
// Automatically generated by fix-tax-recording.ts

import * as fs from 'fs';
import * as path from 'path';

export interface TaxableTransaction {
  timestamp: string;
  type: 'buy' | 'sell' | 'swap';
  tokenMint?: string;
  amount?: number;
  entryPrice?: number;
  exitPrice?: number;
  profit?: number;
  signature?: string;
  success?: boolean;
}

export interface TaxRecord extends TaxableTransaction {
  id: string;
  taxOwed?: number;
  netProfit?: number;
  notes?: string;
}

const TAX_RECORDS_FILE = './data/tax_records.json';
const TAX_RATE = 0.40; // 40% tax rate

// Ensure data directory exists
const dataDir = path.dirname(TAX_RECORDS_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export async function recordTrade(transaction: TaxableTransaction): Promise<void> {
  try {
    // Calculate tax if profit is available
    let taxOwed = 0;
    let netProfit = 0;
    
    if (transaction.profit && transaction.profit > 0) {
      taxOwed = transaction.profit * TAX_RATE;
      netProfit = transaction.profit - taxOwed;
    }
    
    const taxRecord: TaxRecord = {
      ...transaction,
      id: generateTradeId(),
      taxOwed,
      netProfit,
      notes: \`Auto-recorded \${transaction.type} trade\`
    };
    
    // Load existing records
    let records: TaxRecord[] = [];
    if (fs.existsSync(TAX_RECORDS_FILE)) {
      try {
        const data = fs.readFileSync(TAX_RECORDS_FILE, 'utf8');
        records = data.trim() ? JSON.parse(data) : [];
      } catch {
        records = [];
      }
    }
    
    // Add new record
    records.push(taxRecord);
    
    // Save updated records
    fs.writeFileSync(TAX_RECORDS_FILE, JSON.stringify(records, null, 2));
    
    console.log(\`💾 Tax record saved: \${transaction.type} | \${taxOwed > 0 ? \`Tax: $\${taxOwed.toFixed(2)}\` : 'No tax'}\`);
    
  } catch (error) {
    console.error('❌ Tax recording error:', error);
    throw error;
  }
}

function generateTradeId(): string {
  return \`trade_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
}

export function getTaxSummary(): {
  totalTrades: number;
  totalProfit: number;
  totalTaxOwed: number;
  totalNetProfit: number;
} {
  try {
    if (!fs.existsSync(TAX_RECORDS_FILE)) {
      return { totalTrades: 0, totalProfit: 0, totalTaxOwed: 0, totalNetProfit: 0 };
    }
    
    const data = fs.readFileSync(TAX_RECORDS_FILE, 'utf8');
    const records: TaxRecord[] = data.trim() ? JSON.parse(data) : [];
    
    return records.reduce((summary, record) => ({
      totalTrades: summary.totalTrades + 1,
      totalProfit: summary.totalProfit + (record.profit || 0),
      totalTaxOwed: summary.totalTaxOwed + (record.taxOwed || 0),
      totalNetProfit: summary.totalNetProfit + (record.netProfit || 0)
    }), { totalTrades: 0, totalProfit: 0, totalTaxOwed: 0, totalNetProfit: 0 });
    
  } catch (error) {
    console.error('❌ Error getting tax summary:', error);
    return { totalTrades: 0, totalProfit: 0, totalTaxOwed: 0, totalNetProfit: 0 };
  }
}`;
  }

  // ============================================
  // RUN ALL STEPS
  // ============================================
  public runComplete(): void {
    this.scanSourceCode('./src/index.ts');
    this.analyzeTradeLocations();
    this.generateFixes();
    this.generateInstallationInstructions();
    this.createTaxComplianceModule();
    
    console.log(chalk.green.bold('\n🎉 TAX RECORDING FIX COMPLETE!'));
    console.log('========================================');
    console.log(chalk.cyan('Next steps:'));
    console.log('1. Review the fixes above');
    console.log('2. Apply the import statement');
    console.log('3. Apply each FIND/REPLACE fix');
    console.log('4. Test with the generated test file');
    console.log('5. Run the bot and verify tax recording works');
  }
}

// ============================================
// MAIN EXECUTION
// ============================================
if (require.main === module) {
  const fixer = new TaxRecordingFixer();
  fixer.runComplete();
}

export { TaxRecordingFixer };