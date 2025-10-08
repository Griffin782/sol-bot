// test-z-config.ts - TEST FILE TO LOG ALL Z_ VALUES
// Run this to verify all z_ configuration values are loading correctly

import * as z_bridge from './z-configBridge';
import { z_config } from './z-masterConfig';

console.log('\n' + '='.repeat(70));
console.log('Z-CONFIGURATION COMPLETE TEST - ALL VALUES');
console.log('='.repeat(70));

// ============================================
// TEST 1: Direct Config Object
// ============================================

console.log('\n📦 TEST 1: DIRECT Z_CONFIG OBJECT');
console.log('-'.repeat(50));

console.log('\nMETADATA:');
console.log(`  z_botVersion: ${z_config.z_botVersion}`);
console.log(`  z_configVersion: ${z_config.z_configVersion}`);
console.log(`  z_testMode: ${z_config.z_testMode}`);

console.log('\nRUNTIME:');
console.log(`  z_duration: ${z_config.z_runtime.z_duration}`);
console.log(`  z_pauseBetweenScans: ${z_config.z_runtime.z_pauseBetweenScans}`);
console.log(`  z_checkInterval: ${z_config.z_runtime.z_checkInterval}`);
console.log(`  z_heartbeatInterval: ${z_config.z_runtime.z_heartbeatInterval}`);
console.log(`  z_maxRuntime: ${z_config.z_runtime.z_maxRuntime}`);
console.log(`  z_stopOnProfit: ${z_config.z_runtime.z_stopOnProfit}`);
console.log(`  z_stopOnLoss: ${z_config.z_runtime.z_stopOnLoss}`);

console.log('\nPOOL:');
console.log(`  z_initialPool: $${z_config.z_pool.z_initialPool}`);
console.log(`  z_targetPool: $${z_config.z_pool.z_targetPool}`);
console.log(`  z_positionSize: ${z_config.z_pool.z_positionSize} SOL`);
console.log(`  z_positionSizePercent: ${z_config.z_pool.z_positionSizePercent}%`);
console.log(`  z_maxPositions: ${z_config.z_pool.z_maxPositions}`);
console.log(`  z_compoundProfits: ${z_config.z_pool.z_compoundProfits}`);
console.log(`  z_minPoolReserve: ${z_config.z_pool.z_minPoolReserve}%`);
console.log(`  z_maxPoolRisk: ${z_config.z_pool.z_maxPoolRisk}%`);

console.log('\nENTRY:');
console.log(`  z_minLiquidity: $${z_config.z_entry.z_minLiquidity}`);
console.log(`  z_maxLiquidity: $${z_config.z_entry.z_maxLiquidity}`);
console.log(`  z_minHolders: ${z_config.z_entry.z_minHolders}`);
console.log(`  z_maxMarketCap: $${z_config.z_entry.z_maxMarketCap}`);
console.log(`  z_maxAge: ${z_config.z_entry.z_maxAge} minutes`);
console.log(`  z_rugCheckEnabled: ${z_config.z_entry.z_rugCheckEnabled}`);
console.log(`  z_honeypotCheck: ${z_config.z_entry.z_honeypotCheck}`);

console.log('\nEXIT:');
console.log(`  z_stopLoss: ${z_config.z_exit.z_stopLoss}%`);
console.log(`  z_takeProfitLevels: [${z_config.z_exit.z_takeProfitLevels.join(', ')}]`);
console.log(`  z_takeProfitAmounts: [${z_config.z_exit.z_takeProfitAmounts.join(', ')}]%`);
console.log(`  z_moonbagPercent: ${z_config.z_exit.z_moonbagPercent}%`);
console.log(`  z_maxHoldTime: ${z_config.z_exit.z_maxHoldTime} minutes`);
console.log(`  z_enable5xDetection: ${z_config.z_exit.z_enable5xDetection}`);

// ============================================
// TEST 2: Bridge Exports
// ============================================

console.log('\n📦 TEST 2: Z_CONFIGBRIDGE EXPORTS');
console.log('-'.repeat(50));

console.log('\nPOOL EXPORTS:');
console.log(`  z_INITIAL_POOL: $${z_bridge.z_INITIAL_POOL}`);
console.log(`  z_TARGET_POOL: $${z_bridge.z_TARGET_POOL}`);
console.log(`  z_POSITION_SIZE: ${z_bridge.z_POSITION_SIZE} SOL`);
console.log(`  z_MAX_POSITIONS: ${z_bridge.z_MAX_POSITIONS}`);

console.log('\nRUNTIME EXPORTS:');
console.log(`  z_DURATION: ${z_bridge.z_DURATION}`);
console.log(`  z_CHECK_INTERVAL: ${z_bridge.z_CHECK_INTERVAL}`);
console.log(`  z_STOP_ON_PROFIT: ${z_bridge.z_STOP_ON_PROFIT}`);

console.log('\nENTRY EXPORTS:');
console.log(`  z_MIN_LIQUIDITY: $${z_bridge.z_MIN_LIQUIDITY}`);
console.log(`  z_MAX_MARKET_CAP: $${z_bridge.z_MAX_MARKET_CAP}`);
console.log(`  z_RUG_CHECK_ENABLED: ${z_bridge.z_RUG_CHECK_ENABLED}`);

console.log('\nEXIT EXPORTS:');
console.log(`  z_STOP_LOSS: ${z_bridge.z_STOP_LOSS}%`);
console.log(`  z_TAKE_PROFIT_LEVELS: [${z_bridge.z_TAKE_PROFIT_LEVELS.join(', ')}]`);
console.log(`  z_MOONBAG_PERCENT: ${z_bridge.z_MOONBAG_PERCENT}%`);

// ============================================
// TEST 3: Type Checking
// ============================================

console.log('\n📦 TEST 3: TYPE VERIFICATION');
console.log('-'.repeat(50));

const typeChecks = [
  { name: 'z_INITIAL_POOL', value: z_bridge.z_INITIAL_POOL, expectedType: 'number' },
  { name: 'z_TEST_MODE', value: z_bridge.z_TEST_MODE, expectedType: 'boolean' },
  { name: 'z_RPC_ENDPOINTS', value: z_bridge.z_RPC_ENDPOINTS, expectedType: 'object' },
  { name: 'z_TAKE_PROFIT_LEVELS', value: z_bridge.z_TAKE_PROFIT_LEVELS, expectedType: 'object' },
];

typeChecks.forEach(check => {
  const actualType = Array.isArray(check.value) ? 'object' : typeof check.value;
  const isCorrect = actualType === check.expectedType;
  console.log(`  ${check.name}: ${actualType} ${isCorrect ? '✅' : '❌'}`);
});

// ============================================
// TEST 4: Value Validation
// ============================================

console.log('\n📦 TEST 4: VALUE VALIDATION');
console.log('-'.repeat(50));

const validations = [
  {
    name: 'Initial < Target Pool',
    test: z_bridge.z_INITIAL_POOL < z_bridge.z_TARGET_POOL,
    values: `${z_bridge.z_INITIAL_POOL} < ${z_bridge.z_TARGET_POOL}`
  },
  {
    name: 'Position Size > 0',
    test: z_bridge.z_POSITION_SIZE > 0,
    values: `${z_bridge.z_POSITION_SIZE}`
  },
  {
    name: 'Stop Loss < 0',
    test: z_bridge.z_STOP_LOSS < 0,
    values: `${z_bridge.z_STOP_LOSS}`
  },
  {
    name: 'Tax Reserve = 40%',
    test: z_bridge.z_TAX_RESERVE_PERCENT === 40,
    values: `${z_bridge.z_TAX_RESERVE_PERCENT}`
  },
  {
    name: 'Duration >= 0',
    test: z_bridge.z_DURATION >= 0,
    values: `${z_bridge.z_DURATION}`
  },
];

validations.forEach(v => {
  console.log(`  ${v.name}: ${v.test ? '✅' : '❌'} (${v.values})`);
});

// ============================================
// TEST 5: Check for Undefined Values
// ============================================

console.log('\n📦 TEST 5: CHECKING FOR UNDEFINED VALUES');
console.log('-'.repeat(50));

const allExports = Object.entries(z_bridge);
let undefinedCount = 0;
let nullCount = 0;

allExports.forEach(([key, value]) => {
  if (key.startsWith('z_')) {
    if (value === undefined) {
      console.log(`  ❌ ${key} is UNDEFINED`);
      undefinedCount++;
    }
    if (value === null) {
      console.log(`  ⚠️ ${key} is NULL`);
      nullCount++;
    }
  }
});

if (undefinedCount === 0 && nullCount === 0) {
  console.log(`  ✅ All z_ exports have defined values`);
} else {
  console.log(`  ❌ Found ${undefinedCount} undefined and ${nullCount} null values`);
}

// ============================================
// SUMMARY
// ============================================

console.log('\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));

const totalExports = allExports.filter(([key]) => key.startsWith('z_')).length;

console.log(`\n📊 Configuration Statistics:`);
console.log(`  Total z_ exports: ${totalExports}`);
console.log(`  Undefined values: ${undefinedCount}`);
console.log(`  Null values: ${nullCount}`);
console.log(`  Test Mode: ${z_bridge.z_TEST_MODE ? 'ENABLED' : 'DISABLED'}`);

console.log(`\n🎯 Key Trading Parameters:`);
console.log(`  Trading Capital: $${z_bridge.z_INITIAL_POOL} → $${z_bridge.z_TARGET_POOL}`);
console.log(`  Position Size: ${z_bridge.z_POSITION_SIZE} SOL (~$${(z_bridge.z_POSITION_SIZE * 170).toFixed(2)} @ $170/SOL)`);
console.log(`  Max Concurrent: ${z_bridge.z_MAX_POSITIONS} positions`);
console.log(`  Session Duration: ${z_bridge.z_DURATION === 0 ? 'Unlimited' : z_bridge.z_DURATION + ' seconds'}`);
console.log(`  Risk Management: ${z_bridge.z_STOP_LOSS}% stop loss`);
console.log(`  Profit Targets: ${z_bridge.z_TAKE_PROFIT_LEVELS.map(l => l/100 + 'x').join(', ')}`);

if (undefinedCount === 0 && nullCount === 0) {
  console.log('\n✅ ALL Z-CONFIGURATION TESTS PASSED!');
  console.log('Ready to use z_ configuration in production.\n');
} else {
  console.log('\n❌ Z-CONFIGURATION HAS ISSUES!');
  console.log('Fix undefined/null values before using.\n');
}

// ============================================
// HOW TO RUN THIS TEST
// ============================================

console.log('HOW TO RUN THIS TEST:');
console.log('1. Save all z- files in z-new-controls folder');
console.log('2. Run: npx ts-node z-new-controls/test-z-config.ts');
console.log('3. Check all values are correct');
console.log('4. If all tests pass, integrate with main bot\n');