/**
 * FIX DEBUG LOGGING - Correct variable names in TOKEN-QUALITY-FILTER.ts
 *
 * This script fixes TypeScript compilation errors caused by incorrect variable names
 * in debug logging statements.
 *
 * Issues to fix:
 * 1. Line 433-437: Uses undefined variables (liquidityScore, holdersScore, etc.)
 *    - Should use breakdown.liquidity, breakdown.holders, etc.
 * 2. Line 439: References undefined MIN_QUALITY_SCORE constant
 *    - Should use hardcoded value 65 (from line 445)
 * 3. Line 596: Uses undefined mintAddress variable
 *    - Should use tokenMint parameter
 *
 * Generated: November 12, 2025
 */

const fs = require('fs');
const path = require('path');

const TARGET_FILE = path.join(__dirname, 'src', 'core', 'TOKEN-QUALITY-FILTER.ts');
const BACKUP_FILE = path.join(__dirname, 'src', 'core', 'TOKEN-QUALITY-FILTER.ts.backup');

console.log('\n════════════════════════════════════════════════════════════');
console.log('🔧 FIX DEBUG LOGGING - TOKEN-QUALITY-FILTER.ts');
console.log('════════════════════════════════════════════════════════════\n');

// Check if file exists
if (!fs.existsSync(TARGET_FILE)) {
  console.error('❌ ERROR: TOKEN-QUALITY-FILTER.ts not found at:');
  console.error(`   ${TARGET_FILE}`);
  process.exit(1);
}

console.log('✅ Found target file');
console.log(`   ${TARGET_FILE}\n`);

// Read the file
let content = fs.readFileSync(TARGET_FILE, 'utf8');
console.log('✅ File read successfully');
console.log(`   Size: ${content.length} bytes\n`);

// Create backup
fs.writeFileSync(BACKUP_FILE, content);
console.log('✅ Backup created');
console.log(`   ${BACKUP_FILE}\n`);

// Track changes
const changes = [];

// ============================================================================
// FIX 1: Lines 433-437 - Correct score variable names
// ============================================================================

const oldDebugBlock1 = `  // Debug logging for score breakdown
  console.log(\`[QUALITY-FILTER-DEBUG] Score Breakdown:\`);
  console.log(\`[QUALITY-FILTER-DEBUG]   Liquidity Score: \${liquidityScore || 0}\`);
  console.log(\`[QUALITY-FILTER-DEBUG]   Holders Score: \${holdersScore || 0}\`);
  console.log(\`[QUALITY-FILTER-DEBUG]   Volume Score: \${volumeScore || 0}\`);
  console.log(\`[QUALITY-FILTER-DEBUG]   Age Score: \${ageScore || 0}\`);
  console.log(\`[QUALITY-FILTER-DEBUG]   Momentum Score: \${momentumScore || 0}\`);
  console.log(\`[QUALITY-FILTER-DEBUG]   Total Score: \${totalScore}\`);
  console.log(\`[QUALITY-FILTER-DEBUG]   Required: \${MIN_QUALITY_SCORE}\`);
  console.log(\`[QUALITY-FILTER-DEBUG]   Result: \${totalScore >= MIN_QUALITY_SCORE ? 'PASS ✅' : 'FAIL ❌'}\`);
  console.log(\`[QUALITY-FILTER-DEBUG] ============================================\`);`;

const newDebugBlock1 = `  // Debug logging for score breakdown (FIXED: Use correct variable names)
  console.log(\`[QUALITY-FILTER-DEBUG] Score Breakdown:\`);
  console.log(\`[QUALITY-FILTER-DEBUG]   Scam Patterns: \${breakdown.scamPatterns || 0}\`);
  console.log(\`[QUALITY-FILTER-DEBUG]   Liquidity: \${breakdown.liquidity || 0}\`);
  console.log(\`[QUALITY-FILTER-DEBUG]   Holders: \${breakdown.holders || 0}\`);
  console.log(\`[QUALITY-FILTER-DEBUG]   Sellable: \${breakdown.sellable || 0}\`);
  console.log(\`[QUALITY-FILTER-DEBUG]   Age: \${breakdown.age || 0}\`);
  console.log(\`[QUALITY-FILTER-DEBUG]   Momentum: \${breakdown.momentum || 0}\`);
  console.log(\`[QUALITY-FILTER-DEBUG]   Total Score: \${totalScore}\`);
  console.log(\`[QUALITY-FILTER-DEBUG]   Required: 65\`);
  console.log(\`[QUALITY-FILTER-DEBUG]   Result: \${totalScore >= 65 ? 'PASS ✅' : 'FAIL ❌'}\`);
  console.log(\`[QUALITY-FILTER-DEBUG] ============================================\`);`;

if (content.includes(oldDebugBlock1)) {
  content = content.replace(oldDebugBlock1, newDebugBlock1);
  changes.push({
    location: 'Lines 431-441 (inside getTokenQualityScore)',
    description: 'Fixed score variable names',
    details: [
      '❌ liquidityScore → ✅ breakdown.liquidity',
      '❌ holdersScore → ✅ breakdown.holders',
      '❌ volumeScore → ✅ breakdown.sellable (removed, no volume tracking)',
      '❌ ageScore → ✅ breakdown.age',
      '❌ momentumScore → ✅ breakdown.momentum',
      '❌ MIN_QUALITY_SCORE → ✅ 65 (hardcoded threshold)',
      '✨ Added breakdown.scamPatterns (was missing)'
    ]
  });
  console.log('✅ FIX 1: Corrected score variable names (lines 431-441)');
} else {
  console.log('⚠️  FIX 1: Pattern not found - may already be fixed');
}

// ============================================================================
// FIX 2: Line 596 - Correct mintAddress variable name
// ============================================================================

const oldDebugBlock2 = `  console.log(\`[QUALITY-FILTER-DEBUG] ============================================\`);
  console.log(\`[QUALITY-FILTER-DEBUG] Checking token: \${mintAddress}\`);
  console.log(\`[QUALITY-FILTER-DEBUG] Timestamp: \${new Date().toISOString()}\`);`;

const newDebugBlock2 = `  console.log(\`[QUALITY-FILTER-DEBUG] ============================================\`);
  console.log(\`[QUALITY-FILTER-DEBUG] Checking token: \${tokenMint}\`);
  console.log(\`[QUALITY-FILTER-DEBUG] Timestamp: \${new Date().toISOString()}\`);`;

if (content.includes(oldDebugBlock2)) {
  content = content.replace(oldDebugBlock2, newDebugBlock2);
  changes.push({
    location: 'Line 596 (inside enforceQualityFilter)',
    description: 'Fixed token address variable name',
    details: [
      '❌ mintAddress → ✅ tokenMint',
      '(tokenMint is the function parameter name)'
    ]
  });
  console.log('✅ FIX 2: Corrected token variable name (line 596)');
} else {
  console.log('⚠️  FIX 2: Pattern not found - may already be fixed');
}

// ============================================================================
// Save the fixed file
// ============================================================================

if (changes.length > 0) {
  fs.writeFileSync(TARGET_FILE, content);
  console.log('\n✅ File saved successfully');
  console.log(`   ${TARGET_FILE}\n`);
} else {
  console.log('\n⚠️  No changes made - file may already be fixed\n');
}

// ============================================================================
// Summary Report
// ============================================================================

console.log('════════════════════════════════════════════════════════════');
console.log('📋 CHANGES SUMMARY');
console.log('════════════════════════════════════════════════════════════\n');

if (changes.length === 0) {
  console.log('No changes were needed. File may already be fixed.\n');
} else {
  changes.forEach((change, index) => {
    console.log(`${index + 1}. ${change.location}`);
    console.log(`   ${change.description}`);
    change.details.forEach(detail => {
      console.log(`   ${detail}`);
    });
    console.log('');
  });
}

console.log('════════════════════════════════════════════════════════════');
console.log('✅ COMPLETE');
console.log('════════════════════════════════════════════════════════════\n');

console.log('Next steps:');
console.log('1. Run TypeScript compiler: npx tsc --noEmit');
console.log('2. Verify no compilation errors');
console.log('3. If errors persist, check the backup:');
console.log(`   ${BACKUP_FILE}\n`);

console.log('To restore from backup:');
console.log(`   copy "${BACKUP_FILE}" "${TARGET_FILE}"\n`);
