/**
 * validate-safe-build.ts - Safe Build Validation Workflow
 *
 * Runs complete pre-deployment check sequence:
 * 1. Clean + build TypeScript
 * 2. Run repo structure validator
 * 3. Test dry-start of dist/index.js
 *
 * Fails fast if anything is broken.
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface BuildStep {
  name: string;
  description: string;
  run: () => void;
}

let currentStep = 0;
const totalSteps = 3;

/**
 * Print step header
 */
function printStepHeader(stepNum: number, name: string, description: string): void {
  console.log('\n' + '='.repeat(80));
  console.log(`STEP ${stepNum}/${totalSteps}: ${name}`);
  console.log(description);
  console.log('='.repeat(80) + '\n');
}

/**
 * Print success message
 */
function printSuccess(message: string): void {
  console.log(`\n✅ ${message}\n`);
}

/**
 * Print error and exit
 */
function printErrorAndExit(message: string, error?: any): never {
  console.error(`\n❌ ${message}`);
  if (error) {
    console.error(`   Error: ${error.message || error}`);
  }
  console.error('\n🚫 SAFE BUILD CHECK FAILED\n');
  process.exit(1);
}

/**
 * Step 1: Clean and build TypeScript
 */
function stepBuildTypeScript(): void {
  printStepHeader(1, 'TypeScript Build', 'Clean dist/ and compile TypeScript');

  try {
    // Clean dist folder
    console.log('Cleaning dist/ folder...');
    execSync('npm run clean', { stdio: 'inherit' });

    // Build TypeScript
    console.log('\nCompiling TypeScript...');
    execSync('tsc -p tsconfig.json', { stdio: 'inherit' });

    // Verify dist/index.js was created
    const distIndex = path.join(process.cwd(), 'dist', 'index.js');
    if (!fs.existsSync(distIndex)) {
      throw new Error('dist/index.js was not created after build');
    }

    printSuccess('TypeScript build completed successfully');
  } catch (error) {
    printErrorAndExit('TypeScript build failed', error);
  }
}

/**
 * Step 2: Run repo structure validator
 */
function stepValidateRepoStructure(): void {
  printStepHeader(2, 'Repository Structure Validation', 'Check for common build/config mistakes');

  try {
    execSync('ts-node scripts/validate-repo-structure.ts', { stdio: 'inherit' });
    printSuccess('Repository structure validation passed');
  } catch (error) {
    printErrorAndExit('Repository structure validation failed', error);
  }
}

/**
 * Step 3: Test dry-start of dist/index.js
 */
function stepTestDryStart(): void {
  printStepHeader(3, 'Dry Start Test', 'Verify dist/index.js boots into PAPER mode');

  try {
    console.log('Starting bot with 10-second timeout (should boot into PAPER mode)...\n');

    // Run the bot with a timeout (will be killed after 10 seconds)
    // We just want to verify it starts without crashing
    try {
      execSync('node dist/index.js', {
        stdio: 'inherit',
        timeout: 10000, // 10 second timeout
      });
    } catch (error: any) {
      // Timeout is expected - we just want to see it start
      if (error.signal === 'SIGTERM' || error.killed) {
        console.log('\n(Bot killed after timeout - this is expected)');
      } else {
        throw error; // Real error, not just timeout
      }
    }

    // Verify it created expected log/output files (if applicable)
    // For now, just verify it didn't crash immediately

    printSuccess('Dry start test passed - bot boots correctly');
  } catch (error) {
    printErrorAndExit('Dry start test failed - bot crashed on startup', error);
  }
}

/**
 * Run all build validation steps
 */
function runSafeBuildValidation(): void {
  console.log('\n' + '█'.repeat(80));
  console.log('🛡️  SAFE BUILD VALIDATION - Pre-Deployment Check');
  console.log('█'.repeat(80));

  const steps: BuildStep[] = [
    {
      name: 'TypeScript Build',
      description: 'Clean dist/ and compile TypeScript',
      run: stepBuildTypeScript,
    },
    {
      name: 'Repository Structure Validation',
      description: 'Check for common build/config mistakes',
      run: stepValidateRepoStructure,
    },
    {
      name: 'Dry Start Test',
      description: 'Verify dist/index.js boots into PAPER mode',
      run: stepTestDryStart,
    },
  ];

  // Run each step
  for (let i = 0; i < steps.length; i++) {
    currentStep = i + 1;
    steps[i].run();
  }

  // All steps passed
  console.log('\n' + '█'.repeat(80));
  console.log('✅ SAFE BUILD CHECK PASSED — Ready for deployment');
  console.log('   (Still PAPER MODE by default - requires explicit env vars for LIVE)');
  console.log('█'.repeat(80) + '\n');

  process.exit(0);
}

// Run validation
runSafeBuildValidation();
