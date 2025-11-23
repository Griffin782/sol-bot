// verify-trading-history.ts
// Script to analyze your 6-hour trading session data and verify all systems are working correctly

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

interface VerificationResult {
  category: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: any;
}

interface PoolTransactionRecord {
  timestamp: string;
  type: string;
  amount: string;
  poolBefore: string;
  poolAfter: string;
  tradeNumber: string;
  notes?: string;
}

class TradingHistoryVerifier {
  private results: VerificationResult[] = [];
  private dataDir = './data';
  private walletsDir = './wallets';
  
  async runFullVerification(): Promise<void> {
    console.log('🔍 SOL-BOT TRADING HISTORY VERIFICATION');
    console.log('=' .repeat(60));
    console.log('Analyzing 6-hour test session data...\n');
    
    // 1. Check data files exist
    this.verifyDataFiles();
    
    // 2. Analyze pool transactions
    await this.verifyPoolTransactions();
    
    // 3. Check for duplicate trades
    await this.verifyNoDuplicateTrades();
    
    // 4. Verify withdrawal triggers
    await this.verifyWithdrawalLogic();
    
    // 5. Check position sizing
    await this.verifyPositionSizing();
    
    // 6. Verify P&L calculations
    await this.verifyPnLCalculations();
    
    // 7. Check session progression
    await this.verifySessionProgression();
    
    // 8. Verify rate limiting
    await this.verifyRateLimiting();
    
    // 9. Check error patterns
    await this.checkErrorPatterns();
    
    // 10. Generate report
    this.generateReport();
  }
  
  private verifyDataFiles(): void {
    const requiredFiles = [
      'pool_transactions.csv',
      'pending_tokens.csv',
      'performance_log.csv'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(this.dataDir, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        this.results.push({
          category: 'Data Files',
          status: 'PASS',
          message: `${file} exists (${sizeKB} KB)`
        });
      } else {
        this.results.push({
          category: 'Data Files',
          status: 'WARNING',
          message: `${file} not found`
        });
      }
    }
  }
  
  private async verifyPoolTransactions(): Promise<void> {
    const poolFile = path.join(this.dataDir, 'pool_transactions.csv');
    if (!fs.existsSync(poolFile)) {
      this.results.push({
        category: 'Pool Transactions',
        status: 'FAIL',
        message: 'No pool transactions file found'
      });
      return;
    }
    
    try {
      const content = fs.readFileSync(poolFile, 'utf8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true
      }) as PoolTransactionRecord[];
      
      // Analyze transactions
      let totalTrades = 0;
      let profitableTrades = 0;
      let totalProfit = 0;
      let totalLoss = 0;
      let poolValues: number[] = [];
      let duplicateTokens = new Map<string, number>();
      
      for (const record of records) {
        if (record.type === 'TRADE' || record.type === 'BUY') {
          totalTrades++;
          const poolAfter = parseFloat(record.poolAfter);
          const poolBefore = parseFloat(record.poolBefore);
          const pnl = poolAfter - poolBefore;
          
          poolValues.push(poolAfter);
          
          if (pnl > 0) {
            profitableTrades++;
            totalProfit += pnl;
          } else {
            totalLoss += Math.abs(pnl);
          }
          
          // Check for duplicate tokens
          const notes = record.notes || '';
          const tokenMatch = notes.match(/Token: ([A-Za-z0-9]+)/);
          if (tokenMatch) {
            const token = tokenMatch[1];
            duplicateTokens.set(token, (duplicateTokens.get(token) || 0) + 1);
          }
        }
      }
      
      // Calculate metrics
      const winRate = totalTrades > 0 ? (profitableTrades / totalTrades * 100) : 0;
      const avgWin = profitableTrades > 0 ? totalProfit / profitableTrades : 0;
      const avgLoss = (totalTrades - profitableTrades) > 0 ? totalLoss / (totalTrades - profitableTrades) : 0;
      const netPnL = totalProfit - totalLoss;
      
      // Check for duplicates
      const duplicates = Array.from(duplicateTokens.entries())
        .filter(([_, count]) => count > 1)
        .map(([token, count]) => `${token}: ${count} times`);
      
      // Pool growth check
      const initialPool = poolValues[0] || 600;
      const finalPool = poolValues[poolValues.length - 1] || initialPool;
      const growth = ((finalPool - initialPool) / initialPool * 100).toFixed(1);
      
      // Results
      this.results.push({
        category: 'Pool Performance',
        status: netPnL > 0 ? 'PASS' : 'WARNING',
        message: `Net P&L: $${netPnL.toFixed(2)} (${growth}% growth)`,
        details: {
          totalTrades,
          winRate: winRate.toFixed(1) + '%',
          avgWin: '$' + avgWin.toFixed(2),
          avgLoss: '$' + avgLoss.toFixed(2),
          initialPool: '$' + initialPool.toFixed(2),
          finalPool: '$' + finalPool.toFixed(2)
        }
      });
      
      if (duplicates.length > 0) {
        this.results.push({
          category: 'Duplicate Protection',
          status: 'FAIL',
          message: `Found ${duplicates.length} duplicate token purchases`,
          details: duplicates
        });
      } else {
        this.results.push({
          category: 'Duplicate Protection',
          status: 'PASS',
          message: 'No duplicate token purchases detected'
        });
      }
      
      // Check if withdrawals should have triggered
      const maxPool = Math.max(...poolValues);
      if (maxPool >= 7000) {
        this.results.push({
          category: 'Withdrawal Trigger',
          status: 'WARNING',
          message: `Pool reached $${maxPool.toFixed(2)} - withdrawal should have triggered`
        });
      }
      
    } catch (error) {
      this.results.push({
        category: 'Pool Transactions',
        status: 'FAIL',
        message: `Error parsing pool transactions: ${error}`
      });
    }
  }
  
  private async verifyNoDuplicateTrades(): Promise<void> {
    const pendingFile = path.join(this.dataDir, 'pending_tokens.csv');
    if (!fs.existsSync(pendingFile)) return;
    
    try {
      const content = fs.readFileSync(pendingFile, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      const tokenMints = new Map<string, number>();
      
      for (const line of lines.slice(1)) { // Skip header
        const parts = line.split(',');
        if (parts.length > 1) {
          const mint = parts[1]?.trim();
          if (mint) {
            tokenMints.set(mint, (tokenMints.get(mint) || 0) + 1);
          }
        }
      }
      
      const duplicates = Array.from(tokenMints.entries())
        .filter(([_, count]) => count > 1);
      
      if (duplicates.length === 0) {
        this.results.push({
          category: 'Token Queue',
          status: 'PASS',
          message: 'No duplicate tokens in queue'
        });
      } else {
        this.results.push({
          category: 'Token Queue',
          status: 'FAIL',
          message: `${duplicates.length} tokens queued multiple times`,
          details: duplicates.slice(0, 5) // Show first 5
        });
      }
    } catch (error) {
      // Silent fail - not critical
    }
  }
  
  private async verifyWithdrawalLogic(): Promise<void> {
    const withdrawalFile = path.join(this.walletsDir, 'withdrawals.jsonl');
    
    if (fs.existsSync(withdrawalFile)) {
      const lines = fs.readFileSync(withdrawalFile, 'utf8')
        .split('\n')
        .filter(l => l.trim());
      
      if (lines.length > 0) {
        const withdrawals = lines.map(l => JSON.parse(l));
        const totalSecured = withdrawals.reduce((sum, w) => sum + w.toHardware, 0);
        const totalTaxes = withdrawals.reduce((sum, w) => sum + w.toTaxes, 0);
        
        this.results.push({
          category: 'Withdrawals',
          status: 'PASS',
          message: `${withdrawals.length} withdrawals made`,
          details: {
            totalSecured: '$' + totalSecured.toFixed(2),
            totalTaxes: '$' + totalTaxes.toFixed(2),
            count: withdrawals.length
          }
        });
        
        // Verify withdrawal amounts
        for (const w of withdrawals) {
          if (w.toHardware !== 5000 || w.toTaxes !== 2000) {
            this.results.push({
              category: 'Withdrawal Amounts',
              status: 'WARNING',
              message: `Unexpected withdrawal amounts in withdrawal #${w.withdrawalNumber}`,
              details: w
            });
          }
        }
      } else {
        this.results.push({
          category: 'Withdrawals',
          status: 'WARNING',
          message: 'No withdrawals recorded (pool may not have reached $7K)'
        });
      }
    } else {
      this.results.push({
        category: 'Withdrawals',
        status: 'WARNING',
        message: 'No withdrawal history file'
      });
    }
  }
  
  private async verifyPositionSizing(): Promise<void> {
    // Check if position sizes are correct for each session
    const poolFile = path.join(this.dataDir, 'pool_transactions.csv');
    if (!fs.existsSync(poolFile)) return;
    
    try {
      const content = fs.readFileSync(poolFile, 'utf8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true
      }) as PoolTransactionRecord[];
      
      let positionSizes = new Set<number>();
      
      for (const record of records) {
        if (record.type === 'TRADE' || record.type === 'BUY') {
          const amount = Math.abs(parseFloat(record.amount));
          if (amount > 0) {
            positionSizes.add(Math.round(amount * 100) / 100); // Round to 2 decimals
          }
        }
      }
      
      const sizes = Array.from(positionSizes);
      const expectedSizes = [15, 15.13, 30, 30.26]; // With some variance
      
      let correctSizing = true;
      for (const size of sizes) {
        if (!expectedSizes.some(e => Math.abs(size - e) < 1)) {
          correctSizing = false;
        }
      }
      
      this.results.push({
        category: 'Position Sizing',
        status: correctSizing ? 'PASS' : 'WARNING',
        message: `Position sizes used: ${sizes.map(s => '$' + s).join(', ')}`,
        details: {
          expected: '$15 for Session 1, $30 for Sessions 2-4',
          actual: sizes
        }
      });
    } catch (error) {
      // Silent fail
    }
  }
  
  private async verifyPnLCalculations(): Promise<void> {
    const poolFile = path.join(this.dataDir, 'pool_transactions.csv');
    if (!fs.existsSync(poolFile)) return;
    
    try {
      const content = fs.readFileSync(poolFile, 'utf8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true
      }) as PoolTransactionRecord[];
      
      let previousPool = 600; // Starting pool
      let calculationErrors = 0;
      
      for (const record of records) {
        if (record.poolBefore && record.poolAfter) {
          const poolBefore = parseFloat(record.poolBefore);
          const poolAfter = parseFloat(record.poolAfter);
          const amount = parseFloat(record.amount) || 0;
          
          // Check consistency
          if (Math.abs(poolBefore - previousPool) > 0.01 && previousPool !== 600) {
            calculationErrors++;
          }
          
          // Verify P&L calculation
          const expectedAfter = poolBefore + amount;
          if (Math.abs(expectedAfter - poolAfter) > 0.01) {
            calculationErrors++;
          }
          
          previousPool = poolAfter;
        }
      }
      
      this.results.push({
        category: 'P&L Calculations',
        status: calculationErrors === 0 ? 'PASS' : 'WARNING',
        message: calculationErrors === 0 
          ? 'All P&L calculations are consistent'
          : `Found ${calculationErrors} calculation inconsistencies`,
        details: {
          errors: calculationErrors,
          recommendation: calculationErrors > 0 ? 'Review pool calculation logic' : 'OK'
        }
      });
    } catch (error) {
      // Silent fail
    }
  }
  
  private async verifySessionProgression(): Promise<void> {
    // Check if sessions are advancing correctly
    const rotationFile = path.join(this.walletsDir, 'rotation_history.json');
    
    if (fs.existsSync(rotationFile)) {
      const history = JSON.parse(fs.readFileSync(rotationFile, 'utf8'));
      
      if (history.length > 0) {
        const sessions = history.map((h: any) => h.sessionNumber);
        const uniqueSessions = [...new Set(sessions)];
        
        this.results.push({
          category: 'Session Progression',
          status: 'PASS',
          message: `Progressed through sessions: ${uniqueSessions.join(' → ')}`,
          details: {
            totalSessions: uniqueSessions.length,
            currentSession: sessions[sessions.length - 1]
          }
        });
        
        // Verify targets
        for (const record of history) {
          const expectedTargets: any = {
            1: { net: 6000, gross: 10680 },
            2: { net: 24000, gross: 42720 },
            3: { net: 100000, gross: 178160 },
            4: { net: 200000, gross: 306000 }
          };
          
          const expected = expectedTargets[record.sessionNumber];
          if (expected) {
            if (Math.abs(record.netTarget - expected.net) > 1 || 
                Math.abs(record.grossTarget - expected.gross) > 1) {
              this.results.push({
                category: 'Session Targets',
                status: 'FAIL',
                message: `Session ${record.sessionNumber} has incorrect targets`,
                details: {
                  expected,
                  actual: {
                    net: record.netTarget,
                    gross: record.grossTarget
                  }
                }
              });
            }
          }
        }
      }
    } else {
      this.results.push({
        category: 'Session Progression',
        status: 'WARNING',
        message: 'No session rotation history found'
      });
    }
  }
  
  private async verifyRateLimiting(): Promise<void> {
    const poolFile = path.join(this.dataDir, 'pool_transactions.csv');
    if (!fs.existsSync(poolFile)) return;
    
    try {
      const content = fs.readFileSync(poolFile, 'utf8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true
      }) as PoolTransactionRecord[];
      
      // Group trades by minute
      const tradesByMinute = new Map<string, number>();
      
      for (const record of records) {
        if (record.timestamp && (record.type === 'TRADE' || record.type === 'BUY')) {
          const timestamp = new Date(record.timestamp);
          const minuteKey = `${timestamp.getHours()}:${timestamp.getMinutes()}`;
          tradesByMinute.set(minuteKey, (tradesByMinute.get(minuteKey) || 0) + 1);
        }
      }
      
      const maxPerMinute = Math.max(...Array.from(tradesByMinute.values()));
      const avgPerMinute = Array.from(tradesByMinute.values())
        .reduce((a, b) => a + b, 0) / tradesByMinute.size;
      
      this.results.push({
        category: 'Rate Limiting',
        status: maxPerMinute <= 40 ? 'PASS' : 'WARNING',
        message: `Max trades/minute: ${maxPerMinute} (limit: 40)`,
        details: {
          maxPerMinute,
          avgPerMinute: avgPerMinute.toFixed(1),
          totalMinutesActive: tradesByMinute.size
        }
      });
    } catch (error) {
      // Silent fail
    }
  }
  
  private async checkErrorPatterns(): Promise<void> {
    // Look for common error patterns in logs
    const logFiles = ['trading_log.json', 'error_log.txt'];
    let errorPatterns = new Map<string, number>();
    
    for (const file of logFiles) {
      const filePath = path.join(this.dataDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Common error patterns to check
        const patterns = [
          { regex: /wallet.*null/gi, name: 'Wallet null errors' },
          { regex: /duplicate/gi, name: 'Duplicate trade attempts' },
          { regex: /pool.*depleted/gi, name: 'Pool depletion events' },
          { regex: /rate.*limit/gi, name: 'Rate limit hits' },
          { regex: /connection.*closed/gi, name: 'Connection issues' },
          { regex: /insufficient.*balance/gi, name: 'Insufficient balance' },
          { regex: /slippage/gi, name: 'Slippage issues' },
          { regex: /timeout/gi, name: 'Timeout errors' }
        ];
        
        for (const pattern of patterns) {
          const matches = content.match(pattern.regex);
          if (matches) {
            errorPatterns.set(pattern.name, (errorPatterns.get(pattern.name) || 0) + matches.length);
          }
        }
      }
    }
    
    if (errorPatterns.size > 0) {
      const criticalErrors = Array.from(errorPatterns.entries())
        .filter(([name, count]) => count > 10);
      
      if (criticalErrors.length > 0) {
        this.results.push({
          category: 'Error Patterns',
          status: 'WARNING',
          message: `Found ${criticalErrors.length} recurring error types`,
          details: Object.fromEntries(criticalErrors)
        });
      } else {
        this.results.push({
          category: 'Error Patterns',
          status: 'PASS',
          message: 'No critical error patterns detected'
        });
      }
    }
  }
  
  private generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION REPORT');
    console.log('='.repeat(60));
    
    // Group results by status
    const passed = this.results.filter(r => r.status === 'PASS');
    const warnings = this.results.filter(r => r.status === 'WARNING');
    const failed = this.results.filter(r => r.status === 'FAIL');
    
    // Summary
    console.log('\n📈 SUMMARY:');
    console.log(`   ✅ Passed: ${passed.length}`);
    console.log(`   ⚠️  Warnings: ${warnings.length}`);
    console.log(`   ❌ Failed: ${failed.length}`);
    console.log(`   Total Checks: ${this.results.length}`);
    
    // Critical Issues
    if (failed.length > 0) {
      console.log('\n❌ CRITICAL ISSUES (Must Fix Before Live Trading):');
      for (const result of failed) {
        console.log(`\n   ${result.category}:`);
        console.log(`   ${result.message}`);
        if (result.details) {
          console.log(`   Details:`, result.details);
        }
      }
    }
    
    // Warnings
    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS (Should Review):');
      for (const result of warnings) {
        console.log(`\n   ${result.category}:`);
        console.log(`   ${result.message}`);
        if (result.details) {
          console.log(`   Details:`, result.details);
        }
      }
    }
    
    // Passed checks
    console.log('\n✅ PASSED CHECKS:');
    for (const result of passed) {
      console.log(`   ✓ ${result.category}: ${result.message}`);
    }
    
    // Recommendations
    console.log('\n🎯 RECOMMENDATIONS FOR LIVE TRADING:');
    
    const recommendations = [];
    
    if (failed.some(r => r.category === 'Duplicate Protection')) {
      recommendations.push('1. FIX DUPLICATE PROTECTION - Critical for preventing losses');
    }
    
    if (warnings.some(r => r.category === 'Withdrawal Trigger')) {
      recommendations.push('2. Test withdrawal logic with smaller threshold first');
    }
    
    if (failed.some(r => r.category === 'Session Targets')) {
      recommendations.push('3. Verify session target calculations are correct');
    }
    
    if (warnings.some(r => r.category === 'Error Patterns')) {
      recommendations.push('4. Review and fix recurring error patterns');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ System appears ready for live trading!');
      recommendations.push('⚠️  Start with small amounts to verify everything works');
      recommendations.push('📊 Monitor closely for first 24 hours');
    }
    
    recommendations.forEach(r => console.log(`   ${r}`));
    
    // Final Status
    console.log('\n' + '='.repeat(60));
    const overallStatus = failed.length === 0 ? '✅ READY' : '❌ NOT READY';
    console.log(`OVERALL STATUS: ${overallStatus} FOR LIVE TRADING`);
    console.log('='.repeat(60));
    
    // Save report
    const reportPath = './verification_report.json';
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        passed: passed.length,
        warnings: warnings.length,
        failed: failed.length,
        total: this.results.length,
        status: overallStatus
      },
      results: this.results,
      recommendations
    }, null, 2));
    
    console.log(`\n📁 Full report saved to: ${reportPath}`);
  }
}

// Run verification
if (require.main === module) {
  const verifier = new TradingHistoryVerifier();
  verifier.runFullVerification().catch(console.error);
}

export { TradingHistoryVerifier };