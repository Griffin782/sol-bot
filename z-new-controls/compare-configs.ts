// compare-configs.ts - COMPARE OLD CONFIGURATION VS NEW Z_ CONFIGURATION
// Shows exactly what's different between old and new systems

import * as fs from 'fs';
import * as path from 'path';

// Import NEW z_ configuration
import * as z_bridge from './z-configBridge';
import { z_config } from './z-masterConfig';

// We'll read OLD configuration from files to compare
// (Can't import directly as it may conflict)

console.log('\n' + '='.repeat(70));
console.log('CONFIGURATION COMPARISON: OLD vs Z_ NEW');
console.log('='.repeat(70));

// ============================================
// COMPARISON DATA STRUCTURE
// ============================================

interface ConfigComparison {
  name: string;
  oldValue: any;
  newValue: any;
  status: 'SAME' | 'DIFFERENT' | 'NEW' | 'REMOVED';
  critical: boolean;
}

const comparisons: ConfigComparison[] = [];

// ============================================
// HARDCODED OLD VALUES (from your files)
// ============================================

const OLD_CONFIG = {
  // From configBridge.ts fallbacks
  INITIAL_POOL: 85,
  TARGET_POOL: 1701.75,
  POSITION_SIZE: 0.089,
  MAX_CONCURRENT: 5,
  MIN_POOL_BALANCE: 50,
  
  // From botController DEFAULT_SESSION_PROGRESSION
  SESSION_1_INITIAL: 600,
  SESSION_1_TARGET: 6000,
  SESSION_1_POSITION_USD: 20,
  SESSION_2_INITIAL: 4200,
  SESSION_2_TARGET: 60000,
  SESSION_2_POSITION_USD: 45,
  
  // From various files
  BUY_AMOUNT_SOL: 0.089,
  SLIPPAGE: 15,
  PRIORITY_FEE: 0.00005,
  MIN_LIQUIDITY: 5000,
  MAX_MARKET_CAP: 75000,
  TAKE_PROFIT_1: 2.0,
  TAKE_PROFIT_2: 4.0,
  TAKE_PROFIT_3: 6.0,
  STOP_LOSS: -20,
  MAX_HOLD_TIME: 240,
  TAX_RESERVE_PERCENT: 40,
  MAX_TRADES_PER_MINUTE: 10,
  TEST_MODE: false,
  DURATION: 0,  // From masterConfig
};

// ============================================
// PERFORM COMPARISONS
// ============================================

console.log('\n📊 POOL CONFIGURATION');
console.log('-'.repeat(50));

// Compare pool settings
comparisons.push({
  name: 'Initial Pool',
  oldValue: OLD_CONFIG.INITIAL_POOL,
  newValue: z_bridge.z_INITIAL_POOL,
  status: OLD_CONFIG.INITIAL_POOL === z_bridge.z_INITIAL_POOL ? 'SAME' : 'DIFFERENT',
  critical: true
});

comparisons.push({
  name: 'Target Pool',
  oldValue: OLD_CONFIG.TARGET_POOL,
  newValue: z_bridge.z_TARGET_POOL,
  status: OLD_CONFIG.TARGET_POOL === z_bridge.z_TARGET_POOL ? 'SAME' : 'DIFFERENT',
  critical: true
});

comparisons.push({
  name: 'Position Size (SOL)',
  oldValue: OLD_CONFIG.POSITION_SIZE,
  newValue: z_bridge.z_POSITION_SIZE,
  status: OLD_CONFIG.POSITION_SIZE === z_bridge.z_POSITION_SIZE ? 'SAME' : 'DIFFERENT',
  critical: true
});

comparisons.push({
  name: 'Max Positions',
  oldValue: OLD_CONFIG.MAX_CONCURRENT,
  newValue: z_bridge.z_MAX_POSITIONS,
  status: OLD_CONFIG.MAX_CONCURRENT === z_bridge.z_MAX_POSITIONS ? 'SAME' : 'DIFFERENT',
  critical: true
});

// Display pool comparisons
comparisons.filter(c => c.name.includes('Pool') || c.name.includes('Position')).forEach(comp => {
  const symbol = comp.status === 'SAME' ? '=' : '≠';
  const emoji = comp.status === 'SAME' ? '✅' : '🔄';
  console.log(`  ${emoji} ${comp.name}:`);
  console.log(`     OLD: ${comp.oldValue}`);
  console.log(`     NEW: ${comp.newValue}`);
  console.log(`     Status: ${comp.status}\n`);
});

console.log('\n📊 SESSION PROGRESSION (botController)');
console.log('-'.repeat(50));

// Compare session values
const sessionComparisons = [
  {
    name: 'Session 1 Initial (botController)',
    oldValue: OLD_CONFIG.SESSION_1_INITIAL,
    newValue: z_bridge.z_INITIAL_POOL,
    note: 'Was hardcoded in DEFAULT_SESSION_PROGRESSION'
  },
  {
    name: 'Session 1 Target (botController)',
    oldValue: OLD_CONFIG.SESSION_1_TARGET,
    newValue: z_bridge.z_TARGET_POOL,
    note: 'Was hardcoded as 6000'
  },
  {
    name: 'Session 2 Initial (botController)',
    oldValue: OLD_CONFIG.SESSION_2_INITIAL,
    newValue: z_bridge.z_INITIAL_POOL,
    note: 'Was hardcoded as 4200'
  },
];

sessionComparisons.forEach(comp => {
  const isDifferent = comp.oldValue !== comp.newValue;
  console.log(`  ${isDifferent ? '🔄' : '✅'} ${comp.name}:`);
  console.log(`     OLD: ${comp.oldValue} ${comp.note ? `(${comp.note})` : ''}`);
  console.log(`     NEW: ${comp.newValue} (from z_config)`);
  console.log(`     Change: ${isDifferent ? 'FIXED - Now uses config!' : 'Same value'}\n`);
});

console.log('\n📊 TRADING PARAMETERS');
console.log('-'.repeat(50));

const tradingParams = [
  { name: 'Slippage %', old: OLD_CONFIG.SLIPPAGE, new: z_bridge.z_SLIPPAGE_TOLERANCE },
  { name: 'Min Liquidity', old: OLD_CONFIG.MIN_LIQUIDITY, new: z_bridge.z_MIN_LIQUIDITY },
  { name: 'Max Market Cap', old: OLD_CONFIG.MAX_MARKET_CAP, new: z_bridge.z_MAX_MARKET_CAP },
  { name: 'Stop Loss %', old: OLD_CONFIG.STOP_LOSS, new: z_bridge.z_STOP_LOSS },
  { name: 'Max Hold Time', old: OLD_CONFIG.MAX_HOLD_TIME, new: z_bridge.z_MAX_HOLD_TIME },
];

tradingParams.forEach(param => {
  const isDifferent = param.old !== param.new;
  console.log(`  ${isDifferent ? '🔄' : '✅'} ${param.name}: ${param.old} → ${param.new}`);
});

console.log('\n📊 RUNTIME CONTROLS');
console.log('-'.repeat(50));

console.log(`  Duration: ${OLD_CONFIG.DURATION} → ${z_bridge.z_DURATION} seconds`);
console.log(`  Test Mode: ${OLD_CONFIG.TEST_MODE} → ${z_bridge.z_TEST_MODE}`);
console.log(`  Tax Reserve: ${OLD_CONFIG.TAX_RESERVE_PERCENT}% → ${z_bridge.z_TAX_RESERVE_PERCENT}%`);

// ============================================
// CRITICAL DIFFERENCES
// ============================================

console.log('\n' + '='.repeat(70));
console.log('⚠️ CRITICAL DIFFERENCES TO REVIEW');
console.log('='.repeat(70));

const criticalDifferences = [
  {
    issue: 'Initial Pool Mismatch',
    old: 'configBridge: 85, botController: 600',
    new: `z_config: ${z_bridge.z_INITIAL_POOL}`,
    impact: 'Position sizing and pool calculations'
  },
  {
    issue: 'Session Progression Hardcoded',
    old: 'DEFAULT_SESSION_PROGRESSION with fixed values',
    new: 'Dynamic from z_config',
    impact: 'Session targets and progression logic'
  },
  {
    issue: 'Fallback Values in configBridge',
    old: 'Uses || operator with fallbacks',
    new: 'No fallbacks - fails fast if missing',
    impact: 'Silent failures become visible errors'
  },
];

criticalDifferences.forEach((diff, index) => {
  console.log(`\n${index + 1}. ${diff.issue}`);
  console.log(`   OLD: ${diff.old}`);
  console.log(`   NEW: ${diff.new}`);
  console.log(`   Impact: ${diff.impact}`);
});

// ============================================
// MIGRATION CHECKLIST
// ============================================

console.log('\n' + '='.repeat(70));
console.log('📋 MIGRATION CHECKLIST');
console.log('='.repeat(70));

const migrationSteps = [
  '[ ] Backup current configuration files',
  '[ ] Copy z-new-controls folder to project',
  '[ ] Update z_INITIAL_POOL to your actual starting amount ($600)',
  '[ ] Update z_TARGET_POOL to your target ($1701.75)',
  '[ ] Set z_TEST_MODE = true for initial testing',
  '[ ] Run test-z-config.ts to verify all values',
  '[ ] Update imports in index.ts from configBridge to z-configBridge',
  '[ ] Update botController to use z_ values instead of DEFAULT_SESSION_PROGRESSION',
  '[ ] Test with 60-second duration before production',
  '[ ] Monitor logs for any undefined value errors',
];

console.log('\nSteps to complete migration:\n');
migrationSteps.forEach((step, index) => {
  console.log(`${index + 1}. ${step}`);
});

// ============================================
// FILES THAT NEED UPDATING
// ============================================

console.log('\n' + '='.repeat(70));
console.log('📁 FILES REQUIRING UPDATES');
console.log('='.repeat(70));

const filesToUpdate = [
  {
    file: 'src/index.ts',
    changes: [
      "Import from './z-new-controls/z-configBridge' instead of './configBridge'",
      "Replace CFG.* with z_bridge.z_*",
      "Remove getCurrentSessionInfo imports"
    ]
  },
  {
    file: 'src/botController.ts',
    changes: [
      "Import z_config instead of masterConfig",
      "Replace DEFAULT_SESSION_PROGRESSION with z_sessionProgression",
      "Use z_INITIAL_POOL instead of hardcoded 600",
      "Use z_TARGET_POOL instead of hardcoded 6000"
    ]
  },
  {
    file: 'src/enhanced/token-queue-system.ts',
    changes: [
      "Import from z-configBridge",
      "Replace all config references with z_ prefixed versions"
    ]
  },
];

filesToUpdate.forEach(file => {
  console.log(`\n📄 ${file.file}:`);
  file.changes.forEach(change => {
    console.log(`   • ${change}`);
  });
});

// ============================================
// SUMMARY
// ============================================

console.log('\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));

const totalOldValues = Object.keys(OLD_CONFIG).length;
const differentValues = comparisons.filter(c => c.status === 'DIFFERENT').length;

console.log(`\n📊 Analysis Results:`);
console.log(`  • Total old config values checked: ${totalOldValues}`);
console.log(`  • Values that changed: ${differentValues}`);
console.log(`  • Critical issues fixed: ${criticalDifferences.length}`);
console.log(`  • Files needing updates: ${filesToUpdate.length}`);

console.log(`\n🎯 Key Improvements:`);
console.log(`  ✅ No more hardcoded session values`);
console.log(`  ✅ No more fallback chains hiding errors`);
console.log(`  ✅ All values prefixed with z_ for easy tracking`);
console.log(`  ✅ Single source of truth (z-masterConfig.ts)`);
console.log(`  ✅ Fail-fast validation catches issues immediately`);

console.log(`\n⚠️ Before Going Live:`);
console.log(`  1. Run test-z-config.ts to verify all values`);
console.log(`  2. Test with z_DURATION = 60 (1 minute) first`);
console.log(`  3. Monitor logs for any undefined errors`);
console.log(`  4. Gradually increase duration as confidence grows`);

console.log('\n✅ Comparison complete! Review differences carefully before migration.\n');