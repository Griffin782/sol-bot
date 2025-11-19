#!/usr/bin/env ts-node

/**
 * Critical Fixes Verification Script
 * Verifies all fixes from November 6, 2025 are still in place
 *
 * Run: npm run verify-fixes
 * Or: ts-node scripts/verify-critical-fixes.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface VerificationResult {
  name: string;
  passed: boolean;
  file: string;
  line?: string;
  evidence: string;
  fix?: string;
}

class FixVerifier {
  private results: VerificationResult[] = [];
  private rootDir: string;

  constructor() {
    this.rootDir = path.join(__dirname, '..');
  }

  /**
   * Check 1: Verify VIP2 retry logic exists in tokenHandler.ts
   */
  verifyRetryLogic(): VerificationResult {
    const file = path.join(this.rootDir, 'src', 'utils', 'handlers', 'tokenHandler.ts');
    const result: VerificationResult = {
      name: 'VIP2 Retry Logic',
      passed: false,
      file: 'src/utils/handlers/tokenHandler.ts',
      evidence: '',
      fix: 'Restore retry logic from SESSION-SUMMARY-2025-11-06.md or DETAILED-FIX-PLAN-2025-11-07.md Phase 1'
    };

    try {
      const content = fs.readFileSync(file, 'utf-8');

      // Check for VIP2 retry logic markers
      const hasVIP2Comment = content.includes('VIP2 RETRY LOGIC');
      const hasDelaysArray = content.includes('const delays = [200, 100, 100]');
      const hasRetryLoop = content.includes('for (let attempt = 1; attempt <=');
      const hasGetTokenAuthorities = content.includes('export async function getTokenAuthorities');

      if (hasVIP2Comment && hasDelaysArray && hasRetryLoop && hasGetTokenAuthorities) {
        result.passed = true;
        result.evidence = '✅ Found VIP2 retry logic with delays [200, 100, 100]';

        // Find line number
        const lines = content.split('\n');
        const lineNum = lines.findIndex(l => l.includes('VIP2 RETRY LOGIC')) + 1;
        result.line = `Line ${lineNum}`;
      } else {
        result.evidence = '❌ Missing retry logic components:\n' +
          `  - VIP2 comment: ${hasVIP2Comment ? '✅' : '❌'}\n` +
          `  - Delays array [200,100,100]: ${hasDelaysArray ? '✅' : '❌'}\n` +
          `  - Retry loop: ${hasRetryLoop ? '✅' : '❌'}\n` +
          `  - getTokenAuthorities function: ${hasGetTokenAuthorities ? '✅' : '❌'}`;
      }
    } catch (error) {
      result.evidence = `❌ Error reading file: ${error}`;
    }

    return result;
  }

  /**
   * Check 2: Verify Helius RPC is configured (QuickNode override commented out)
   */
  verifyRPCConfig(): VerificationResult {
    const file = path.join(this.rootDir, '.env');
    const result: VerificationResult = {
      name: 'Helius RPC Configuration',
      passed: false,
      file: '.env',
      evidence: '',
      fix: 'Edit .env lines 55-56: Add # in front of RPC_OVERRIDE_QUICKNODE lines'
    };

    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      // Check for Helius RPC
      const hasHeliusRPC = content.includes('helius-rpc.com') || content.includes('mainnet.helius-rpc.com');

      // Check QuickNode override is commented out (or doesn't exist)
      const quicknodeLines = lines.filter(l =>
        l.includes('RPC_OVERRIDE') &&
        l.includes('quiknode') &&
        !l.trim().startsWith('#')
      );

      const quicknodeCommented = quicknodeLines.length === 0;

      if (hasHeliusRPC && quicknodeCommented) {
        result.passed = true;
        result.evidence = '✅ Helius RPC configured, QuickNode override commented out/absent';
        result.line = 'Lines 17, 55-56';
      } else {
        result.evidence = '❌ RPC configuration issues:\n' +
          `  - Helius RPC found: ${hasHeliusRPC ? '✅' : '❌'}\n` +
          `  - QuickNode override commented: ${quicknodeCommented ? '✅' : '❌ ACTIVE (should be commented)'}\n`;

        if (!quicknodeCommented) {
          result.evidence += `\n  Active QuickNode lines:\n`;
          quicknodeLines.forEach((line, idx) => {
            const lineNum = lines.indexOf(line) + 1;
            result.evidence += `    Line ${lineNum}: ${line.trim()}\n`;
          });
        }
      }
    } catch (error) {
      result.evidence = `❌ Error reading .env: ${error}`;
    }

    return result;
  }

  /**
   * Check 3: Verify Jupiter polling loop removed from index.ts
   */
  verifyJupiterRemoval(): VerificationResult {
    const file = path.join(this.rootDir, 'src', 'index.ts');
    const result: VerificationResult = {
      name: 'Jupiter Polling Removal',
      passed: false,
      file: 'src/index.ts',
      evidence: '',
      fix: 'Remove monitorPositions() function and all .then(monitorPositions) calls (see JUPITER-API-FIX-COMPLETED.md)'
    };

    try {
      const content = fs.readFileSync(file, 'utf-8');

      // Check that monitorPositions function is NOT defined
      const hasMonitorPositions = content.includes('function monitorPositions(') ||
                                   content.includes('async function monitorPositions(') ||
                                   content.includes('const monitorPositions = ');

      // Check that .then(monitorPositions) is NOT called
      const hasThenMonitorPositions = content.includes('.then(monitorPositions)');

      // Check for Jupiter API polling in a loop
      const hasJupiterPriceLoop = content.includes('getCurrentTokenPrice(position.mint)');

      if (!hasMonitorPositions && !hasThenMonitorPositions && !hasJupiterPriceLoop) {
        result.passed = true;
        result.evidence = '✅ Jupiter polling loop removed (no monitorPositions function, no .then calls, no price polling)';
      } else {
        result.evidence = '❌ Jupiter polling still present:\n' +
          `  - monitorPositions function: ${hasMonitorPositions ? '❌ FOUND (should be removed)' : '✅ Not found'}\n` +
          `  - .then(monitorPositions): ${hasThenMonitorPositions ? '❌ FOUND (should be removed)' : '✅ Not found'}\n` +
          `  - getCurrentTokenPrice loop: ${hasJupiterPriceLoop ? '❌ FOUND (should be removed)' : '✅ Not found'}`;
      }
    } catch (error) {
      result.evidence = `❌ Error reading file: ${error}`;
    }

    return result;
  }

  /**
   * Check 4: Verify position size unified in UNIFIED-CONTROL.ts
   */
  verifyPositionSize(): VerificationResult {
    const file = path.join(this.rootDir, 'src', 'core', 'UNIFIED-CONTROL.ts');
    const result: VerificationResult = {
      name: 'Position Size Unification',
      passed: false,
      file: 'src/core/UNIFIED-CONTROL.ts',
      evidence: '',
      fix: 'Ensure sessions scale from MODE_PRESETS (see POSITION-SIZE-UNIFICATION-COMPLETE.md)'
    };

    try {
      const content = fs.readFileSync(file, 'utf-8');

      // Check for MODE_PRESETS base value extraction
      const hasBaseExtraction = content.includes('const basePositionSize') &&
                                 content.includes('MODE_PRESETS[currentMode].positionSizeUSD');

      // Check for session scaling
      const hasSession1Scaling = content.includes('positionSizeUSD: basePositionSize');
      const hasSession2Scaling = content.includes('basePositionSize * 2.25');
      const hasSession3Scaling = content.includes('basePositionSize * 5');
      const hasSession4Scaling = content.includes('basePositionSize * 10');

      if (hasBaseExtraction && hasSession1Scaling && hasSession2Scaling &&
          hasSession3Scaling && hasSession4Scaling) {
        result.passed = true;
        result.evidence = '✅ Position size unified: sessions scale from MODE_PRESETS base value';
        result.line = 'Lines 91-182';
      } else {
        result.evidence = '❌ Position size unification incomplete:\n' +
          `  - Base extraction from MODE_PRESETS: ${hasBaseExtraction ? '✅' : '❌'}\n` +
          `  - Session 1 (1x scaling): ${hasSession1Scaling ? '✅' : '❌'}\n` +
          `  - Session 2 (2.25x scaling): ${hasSession2Scaling ? '✅' : '❌'}\n` +
          `  - Session 3 (5x scaling): ${hasSession3Scaling ? '✅' : '❌'}\n` +
          `  - Session 4 (10x scaling): ${hasSession4Scaling ? '✅' : '❌'}`;
      }
    } catch (error) {
      result.evidence = `❌ Error reading file: ${error}`;
    }

    return result;
  }

  /**
   * Run all verification checks
   */
  async runAll(): Promise<void> {
    console.log('🔍 SOL-BOT Critical Fixes Verification');
    console.log('📅 Verifying fixes from November 6, 2025\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Run all checks
    this.results.push(this.verifyRetryLogic());
    this.results.push(this.verifyRPCConfig());
    this.results.push(this.verifyJupiterRemoval());
    this.results.push(this.verifyPositionSize());

    // Print report
    this.printReport();
  }

  /**
   * Print verification report
   */
  printReport(): void {
    let allPassed = true;

    this.results.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const icon = result.passed ? '✅' : '❌';

      console.log(`${icon} Check ${index + 1}: ${result.name}`);
      console.log(`   File: ${result.file}`);
      if (result.line) {
        console.log(`   Location: ${result.line}`);
      }
      console.log(`   Status: ${status}`);
      console.log(`   ${result.evidence}`);

      if (!result.passed && result.fix) {
        console.log(`   🔧 Fix: ${result.fix}`);
      }

      console.log('');

      if (!result.passed) {
        allPassed = false;
      }
    });

    console.log('═══════════════════════════════════════════════════════════\n');

    if (allPassed) {
      console.log('🎉 ALL CHECKS PASSED! ✅');
      console.log('   All November 6 fixes are in place.');
      console.log('   Bot should have 100% buy rate.\n');
      console.log('📊 Next step: Run test');
      console.log('   Command: npm run dev\n');
      process.exit(0);
    } else {
      const failCount = this.results.filter(r => !r.passed).length;
      console.log(`⚠️  ${failCount} CHECK(S) FAILED! ❌`);
      console.log('   Bot may have 0% buy rate or other issues.');
      console.log('   Review fixes above and restore missing code.\n');
      console.log('📚 Reference Documents:');
      console.log('   - QUICK-ACTION-CARD-2025-11-07.md (immediate fixes)');
      console.log('   - DETAILED-FIX-PLAN-2025-11-07.md (complete guide)');
      console.log('   - SESSION-SUMMARY-2025-11-06.md (original fixes)\n');
      process.exit(1);
    }
  }
}

// Execute verification
const verifier = new FixVerifier();
verifier.runAll().catch(error => {
  console.error('❌ Verification script error:', error);
  process.exit(1);
});
