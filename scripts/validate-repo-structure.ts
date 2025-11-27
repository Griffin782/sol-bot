/**
 * validate-repo-structure.ts - Repository Structure Validator
 *
 * Checks for common build/config mistakes before deployment:
 * - dist/index.js exists (not dist/src/index.js)
 * - No dist/src/ directory
 * - No .js files under src/
 * - Market Intelligence imports are correct
 * - Safe-Mode Guard is wired
 * - All npm scripts point to existing files
 */

import * as fs from 'fs';
import * as path from 'path';

interface ValidationCheck {
  name: string;
  passed: boolean;
  error?: string;
  details?: string[];
}

const checks: ValidationCheck[] = [];

/**
 * Check if dist/index.js exists at the correct location
 */
function checkDistIndexExists(): void {
  const distIndexPath = path.join(process.cwd(), 'dist', 'index.js');
  const exists = fs.existsSync(distIndexPath);

  checks.push({
    name: 'dist/index.js exists',
    passed: exists,
    error: exists ? undefined : 'dist/index.js not found - run npm run build first',
  });
}

/**
 * Check that dist/src/ directory does NOT exist
 */
function checkNoDistSrc(): void {
  const distSrcPath = path.join(process.cwd(), 'dist', 'src');
  const exists = fs.existsSync(distSrcPath);

  checks.push({
    name: 'No dist/src/ folder',
    passed: !exists,
    error: exists
      ? 'dist/src/ directory exists - indicates wrong tsconfig.json rootDir setting'
      : undefined,
  });
}

/**
 * Recursively find all .js files in a directory
 */
function findJsFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findJsFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Check that no .js files exist under src/ (only TypeScript source should be there)
 */
function checkNoJsInSrc(): void {
  const srcPath = path.join(process.cwd(), 'src');
  const jsFiles = findJsFiles(srcPath);

  checks.push({
    name: 'No .js files under src/',
    passed: jsFiles.length === 0,
    error: jsFiles.length > 0
      ? `Found ${jsFiles.length} compiled .js files in src/ - should only have TypeScript source`
      : undefined,
    details: jsFiles.length > 0
      ? jsFiles.map(f => path.relative(process.cwd(), f))
      : undefined,
  });
}

/**
 * Check market-intelligence import paths in src/index.ts
 */
function checkMarketIntelligenceImports(): void {
  const indexPath = path.join(process.cwd(), 'src', 'index.ts');

  if (!fs.existsSync(indexPath)) {
    checks.push({
      name: 'Market Intelligence imports',
      passed: false,
      error: 'src/index.ts not found',
    });
    return;
  }

  const content = fs.readFileSync(indexPath, 'utf-8');

  // Check for correct import path (./market-intelligence/)
  const hasCorrectImport = content.includes("from './market-intelligence/");

  // Check for incorrect import path (../market-intelligence/)
  const hasIncorrectImport = content.includes("from '../market-intelligence/");

  checks.push({
    name: 'Market Intelligence imports correct',
    passed: hasCorrectImport && !hasIncorrectImport,
    error: hasIncorrectImport
      ? 'src/index.ts uses ../market-intelligence/ (should be ./market-intelligence/)'
      : !hasCorrectImport
      ? 'src/index.ts missing market-intelligence imports'
      : undefined,
  });
}

/**
 * Check that SAFE-MODE-GUARD.ts exists and is wired into config
 */
function checkSafeModeGuard(): void {
  const guardPath = path.join(process.cwd(), 'src', 'safety', 'SAFE-MODE-GUARD.ts');
  const guardExists = fs.existsSync(guardPath);

  if (!guardExists) {
    checks.push({
      name: 'Safe-Mode Guard exists',
      passed: false,
      error: 'src/safety/SAFE-MODE-GUARD.ts not found',
    });
    return;
  }

  // Check if UNIFIED-CONTROL imports and uses it
  const unifiedControlPath = path.join(process.cwd(), 'src', 'core', 'UNIFIED-CONTROL.ts');

  if (!fs.existsSync(unifiedControlPath)) {
    checks.push({
      name: 'Safe-Mode Guard wired',
      passed: false,
      error: 'src/core/UNIFIED-CONTROL.ts not found',
    });
    return;
  }

  const unifiedContent = fs.readFileSync(unifiedControlPath, 'utf-8');
  const importsGuard = unifiedContent.includes("from '../safety/SAFE-MODE-GUARD'");
  const usesGuard = unifiedContent.includes('getEffectiveMode');

  checks.push({
    name: 'Safe-Mode Guard wired',
    passed: guardExists && importsGuard && usesGuard,
    error: !importsGuard
      ? 'UNIFIED-CONTROL.ts does not import SAFE-MODE-GUARD'
      : !usesGuard
      ? 'UNIFIED-CONTROL.ts does not use getEffectiveMode()'
      : undefined,
  });
}

/**
 * Check that all npm scripts point to existing files
 */
function checkNpmScriptTargets(): void {
  const packageJsonPath = path.join(process.cwd(), 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    checks.push({
      name: 'npm scripts valid',
      passed: false,
      error: 'package.json not found',
    });
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const scripts = packageJson.scripts || {};

  const missingTargets: string[] = [];

  Object.entries(scripts).forEach(([scriptName, scriptCommand]) => {
    const command = scriptCommand as string;

    // Extract file path from ts-node commands
    const tsNodeMatch = command.match(/ts-node\s+([^\s]+\.ts)/);
    if (tsNodeMatch) {
      const targetPath = path.join(process.cwd(), tsNodeMatch[1]);
      if (!fs.existsSync(targetPath)) {
        missingTargets.push(`${scriptName} → ${tsNodeMatch[1]}`);
      }
    }
  });

  checks.push({
    name: 'npm scripts point to existing files',
    passed: missingTargets.length === 0,
    error: missingTargets.length > 0
      ? `${missingTargets.length} script(s) reference missing files`
      : undefined,
    details: missingTargets.length > 0 ? missingTargets : undefined,
  });
}

/**
 * Run all validation checks
 */
function runAllChecks(): void {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 REPOSITORY STRUCTURE VALIDATION');
  console.log('='.repeat(80) + '\n');

  checkDistIndexExists();
  checkNoDistSrc();
  checkNoJsInSrc();
  checkMarketIntelligenceImports();
  checkSafeModeGuard();
  checkNpmScriptTargets();

  // Print results
  let allPassed = true;

  checks.forEach(check => {
    const icon = check.passed ? '✅' : '❌';
    console.log(`${icon} ${check.name}`);

    if (!check.passed) {
      allPassed = false;
      if (check.error) {
        console.log(`   Error: ${check.error}`);
      }
      if (check.details) {
        check.details.forEach(detail => {
          console.log(`      - ${detail}`);
        });
      }
    }
  });

  console.log('\n' + '='.repeat(80));

  if (allPassed) {
    console.log('✅ validate-repo-structure: ALL CHECKS PASSED\n');
    process.exit(0);
  } else {
    const failedCount = checks.filter(c => !c.passed).length;
    console.log(`❌ validate-repo-structure FAILED: ${failedCount} check(s) failed\n`);
    process.exit(1);
  }
}

// Run validation
runAllChecks();
