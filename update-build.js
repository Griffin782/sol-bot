/**
 * UPDATE-BUILD.JS - Compilation Script with Timestamp Tracking
 *
 * This script:
 * 1. Updates BUILD_TIMESTAMP in build-tracker.ts
 * 2. Updates COMPONENT_VERSIONS for all key files
 * 3. Runs TypeScript compiler
 * 4. Reports compilation success/failure
 * 5. Verifies JavaScript files were updated
 *
 * Usage:
 *   node update-build.js
 *   node update-build.js --no-compile (just update timestamps)
 *   node update-build.js --verify-only (check without building)
 *
 * Generated: November 12, 2025
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_DIR = __dirname;
const BUILD_TRACKER_PATH = path.join(BASE_DIR, 'src/core/build-tracker.ts');

// Key files to track
const COMPONENT_FILES = [
  'src/index.ts',
  'src/core/UNIFIED-CONTROL.ts',
  'src/core/TOKEN-QUALITY-FILTER.ts',
  'src/utils/vip-token-check.ts',
  'src/emergency-safety-wrapper.ts',
  'src/monitoring/positionMonitor.ts',
  'src/trading/buyExecutor.ts',
  'src/trading/sellExecutor.ts',
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getCurrentTimestamp() {
  return Date.now();
}

function getFileModificationTime(filePath) {
  try {
    const fullPath = path.join(BASE_DIR, filePath);
    const stats = fs.statSync(fullPath);
    return stats.mtimeMs;
  } catch (error) {
    console.warn(`⚠️  Could not get modification time for ${filePath}`);
    return getCurrentTimestamp();
  }
}

function readBuildTracker() {
  try {
    return fs.readFileSync(BUILD_TRACKER_PATH, 'utf8');
  } catch (error) {
    console.error(`❌ Could not read build-tracker.ts:`, error.message);
    return null;
  }
}

function writeBuildTracker(content) {
  try {
    fs.writeFileSync(BUILD_TRACKER_PATH, content, 'utf8');
    return true;
  } catch (error) {
    console.error(`❌ Could not write build-tracker.ts:`, error.message);
    return false;
  }
}

// ============================================================================
// TIMESTAMP UPDATE FUNCTIONS
// ============================================================================

function updateBuildTimestamp(content) {
  const timestamp = getCurrentTimestamp();
  const pattern = /export const BUILD_TIMESTAMP = \d+;/;

  if (pattern.test(content)) {
    return content.replace(pattern, `export const BUILD_TIMESTAMP = ${timestamp};`);
  }

  console.warn('⚠️  Could not find BUILD_TIMESTAMP pattern');
  return content;
}

function updateComponentVersions(content) {
  console.log('\n📦 Updating component versions...');

  const componentTimestamps = {};

  for (const component of COMPONENT_FILES) {
    const basename = path.basename(component);
    const modTime = getFileModificationTime(component);
    componentTimestamps[basename] = modTime;

    console.log(`   ${basename.padEnd(30)} ${new Date(modTime).toLocaleString()}`);
  }

  // Build the new COMPONENT_VERSIONS object
  const versionsObject = JSON.stringify(componentTimestamps, null, 2)
    .split('\n')
    .map(line => '  ' + line)
    .join('\n');

  const pattern = /export const COMPONENT_VERSIONS = \{[\s\S]*?\};/;

  if (pattern.test(content)) {
    const newVersions = `export const COMPONENT_VERSIONS = ${versionsObject};`;
    return content.replace(pattern, newVersions);
  }

  console.warn('⚠️  Could not find COMPONENT_VERSIONS pattern');
  return content;
}

function updateTimestamps() {
  console.log('\n' + '='.repeat(70));
  console.log('🕐 UPDATING TIMESTAMPS');
  console.log('='.repeat(70));

  let content = readBuildTracker();
  if (!content) return false;

  // Update BUILD_TIMESTAMP
  content = updateBuildTimestamp(content);
  console.log(`✅ BUILD_TIMESTAMP updated to ${getCurrentTimestamp()}`);

  // Update COMPONENT_VERSIONS
  content = updateComponentVersions(content);
  console.log('✅ COMPONENT_VERSIONS updated');

  // Write back to file
  if (writeBuildTracker(content)) {
    console.log('✅ build-tracker.ts updated successfully');
    return true;
  }

  return false;
}

// ============================================================================
// COMPILATION FUNCTIONS
// ============================================================================

function runTypeScriptCompiler() {
  console.log('\n' + '='.repeat(70));
  console.log('🔨 RUNNING TYPESCRIPT COMPILER');
  console.log('='.repeat(70));

  try {
    console.log('\n⏳ Compiling TypeScript files...\n');

    // Run tsc with output
    execSync('npx tsc', {
      cwd: BASE_DIR,
      stdio: 'inherit',
    });

    console.log('\n✅ TypeScript compilation successful');
    return true;
  } catch (error) {
    console.error('\n❌ TypeScript compilation failed');
    console.error('Error code:', error.status);
    return false;
  }
}

// ============================================================================
// VERIFICATION FUNCTIONS
// ============================================================================

function verifyCompiledFiles() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 VERIFYING COMPILED FILES');
  console.log('='.repeat(70));

  const filesToCheck = [
    { ts: 'src/index.ts', js: 'dist/src/index.js' },
    { ts: 'src/core/UNIFIED-CONTROL.ts', js: 'dist/src/core/UNIFIED-CONTROL.js' },
    { ts: 'src/core/TOKEN-QUALITY-FILTER.ts', js: 'dist/src/core/TOKEN-QUALITY-FILTER.js' },
    { ts: 'src/core/build-tracker.ts', js: 'dist/src/core/build-tracker.js' },
  ];

  let allUpToDate = true;

  console.log('\n📋 Checking compiled files...\n');

  for (const { ts, js } of filesToCheck) {
    const tsPath = path.join(BASE_DIR, ts);
    const jsPath = path.join(BASE_DIR, js);

    // Check if files exist
    if (!fs.existsSync(tsPath)) {
      console.log(`   ⚠️  ${ts} - Source not found`);
      continue;
    }

    if (!fs.existsSync(jsPath)) {
      console.log(`   ❌ ${js} - Not compiled`);
      allUpToDate = false;
      continue;
    }

    // Compare modification times
    const tsStats = fs.statSync(tsPath);
    const jsStats = fs.statSync(jsPath);

    const tsTime = tsStats.mtimeMs;
    const jsTime = jsStats.mtimeMs;

    const isUpToDate = jsTime >= tsTime;
    const timeDiff = Math.abs(jsTime - tsTime);
    const timeDiffSec = Math.floor(timeDiff / 1000);

    if (isUpToDate) {
      console.log(`   ✅ ${path.basename(js).padEnd(35)} (${timeDiffSec}s newer)`);
    } else {
      console.log(`   ❌ ${path.basename(js).padEnd(35)} (${timeDiffSec}s older - STALE!)`);
      allUpToDate = false;
    }
  }

  console.log('\n' + (allUpToDate ? '✅' : '⚠️ ') + ' Verification: ' + (allUpToDate ? 'All files up-to-date' : 'Some files are stale'));

  return allUpToDate;
}

function displayBuildSummary(success) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 BUILD SUMMARY');
  console.log('='.repeat(70));

  if (success) {
    console.log('\n✅ BUILD SUCCESSFUL\n');
    console.log('   Timestamps updated ✓');
    console.log('   TypeScript compiled ✓');
    console.log('   Files verified ✓');
    console.log('\n📋 Next steps:');
    console.log('   1. Test the bot: npm run dev');
    console.log('   2. Check logs: tail -f complete-bot-log.txt');
    console.log('   3. Verify quality filter: Look for [QUALITY-FILTER-DEBUG] messages');
  } else {
    console.log('\n⚠️  BUILD COMPLETED WITH WARNINGS\n');
    console.log('   Some files may not be up-to-date');
    console.log('   Review errors above and try rebuilding');
    console.log('\n📋 Troubleshooting:');
    console.log('   1. Check for TypeScript errors: npx tsc --noEmit');
    console.log('   2. Clean build: rm -rf dist && node update-build.js');
    console.log('   3. Check file permissions');
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const noCompile = args.includes('--no-compile');
  const verifyOnly = args.includes('--verify-only');

  console.log('\n' + '='.repeat(70));
  console.log('🔨 UPDATE-BUILD.JS - Compilation Script');
  console.log('='.repeat(70));

  if (verifyOnly) {
    console.log('\n📋 VERIFY-ONLY MODE - Checking file status without building\n');
    const isUpToDate = verifyCompiledFiles();
    process.exit(isUpToDate ? 0 : 1);
  }

  let success = true;

  // Step 1: Update timestamps
  if (!updateTimestamps()) {
    console.error('❌ Failed to update timestamps');
    success = false;
  }

  // Step 2: Compile TypeScript (unless --no-compile)
  if (!noCompile) {
    if (!runTypeScriptCompiler()) {
      console.error('❌ Compilation failed');
      success = false;
    }
  } else {
    console.log('\n⏭️  Skipping compilation (--no-compile flag)');
  }

  // Step 3: Verify compiled files
  if (!noCompile) {
    if (!verifyCompiledFiles()) {
      console.warn('⚠️  Some files are not up-to-date');
      success = false;
    }
  }

  // Step 4: Display summary
  displayBuildSummary(success);

  process.exit(success ? 0 : 1);
}

// Export functions for testing
module.exports = {
  updateTimestamps,
  runTypeScriptCompiler,
  verifyCompiledFiles,
  displayBuildSummary,
  main,
};

// Run if called directly
if (require.main === module) {
  main();
}

