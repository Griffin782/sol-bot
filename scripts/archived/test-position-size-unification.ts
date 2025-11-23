/**
 * Test script to verify position size unification
 * Checks that all components use the same position size value
 */

import {
  MASTER_SETTINGS,
  getPositionSizeSOL,
  getPositionSizeUSD
} from './src/core/UNIFIED-CONTROL';
import { POSITION_SIZE, POSITION_SIZE_USD } from './src/core/CONFIG-BRIDGE';

console.log('🧪 Testing Position Size Unification\n');
console.log('='.repeat(60));

// Test 1: MASTER_SETTINGS base values (should match MODE_PRESETS internally)
console.log('\n📊 Base Position Size (MASTER_SETTINGS.pool):');
console.log(`   positionSizeUSD: $${MASTER_SETTINGS.pool.positionSizeUSD}`);
console.log(`   positionSizeSOL: ${MASTER_SETTINGS.pool.positionSizeSOL} SOL`);


// Test 2: CONFIG-BRIDGE exports
console.log('\n📊 CONFIG-BRIDGE Exports:');
console.log(`   POSITION_SIZE: ${POSITION_SIZE} SOL`);
console.log(`   POSITION_SIZE_USD: $${POSITION_SIZE_USD}`);

// Test 3: Getter functions
console.log('\n📊 Getter Functions:');
console.log(`   getPositionSizeSOL(): ${getPositionSizeSOL()} SOL`);
console.log(`   getPositionSizeUSD(): $${getPositionSizeUSD()}`);

// Test 4: Session Progression
console.log('\n📊 Session Progression (Should scale from base):');
const baseValue = MASTER_SETTINGS.pool.positionSizeUSD;
MASTER_SETTINGS.sessions.forEach((session, idx) => {
  const expectedScale = idx === 0 ? 1 : idx === 1 ? 2.25 : idx === 2 ? 5 : 10;
  const expected = baseValue * expectedScale;
  const match = session.positionSizeUSD === expected ? '✅' : '❌';
  console.log(`   Session ${session.sessionNumber}: $${session.positionSizeUSD} ${match} (expected: $${expected})`);
});

// Test 5: Unification Check
console.log('\n🔍 Unification Check:');
console.log('='.repeat(60));
const checks = [
  { name: 'MASTER_SETTINGS.pool.positionSizeUSD', value: MASTER_SETTINGS.pool.positionSizeUSD },
  { name: 'CONFIG-BRIDGE.POSITION_SIZE_USD', value: POSITION_SIZE_USD },
  { name: 'getPositionSizeUSD()', value: getPositionSizeUSD() },
  { name: 'Session 1 positionSizeUSD', value: MASTER_SETTINGS.sessions[0].positionSizeUSD }
];

let allMatch = true;
checks.forEach(check => {
  const match = check.value === baseValue;
  if (!match) allMatch = false;
  console.log(`${match ? '✅' : '❌'} ${check.name}: $${check.value} ${match ? '(matches)' : `(expected $${baseValue})`}`);
});

// Test 7: Session Scaling Check
console.log('\n🔍 Session Scaling Check:');
console.log('='.repeat(60));

const scalingChecks = [
  { session: 1, scale: 1, expected: baseValue * 1 },
  { session: 2, scale: 2.25, expected: baseValue * 2.25 },
  { session: 3, scale: 5, expected: baseValue * 5 },
  { session: 4, scale: 10, expected: baseValue * 10 }
];

let allScalingMatch = true;
scalingChecks.forEach(check => {
  const actual = MASTER_SETTINGS.sessions[check.session - 1].positionSizeUSD;
  const match = actual === check.expected;
  if (!match) allScalingMatch = false;
  console.log(`${match ? '✅' : '❌'} Session ${check.session}: $${actual} ${match ? '(correct)' : `(expected $${check.expected})`} [${check.scale}x scaling]`);
});

// Final Result
console.log('\n' + '='.repeat(60));
if (allMatch && allScalingMatch) {
  console.log('✅ POSITION SIZE UNIFICATION: SUCCESS');
  console.log('   All components use $' + baseValue + ' as the base position size');
  console.log('   All sessions scale correctly from the base');
  console.log('   Single source of truth: MODE_PRESETS.PAPER.positionSizeUSD');
  console.log('\n💡 To change position size, edit MODE_PRESETS in UNIFIED-CONTROL.ts');
  process.exit(0);
} else {
  console.log('❌ POSITION SIZE UNIFICATION: FAILED');
  console.log('   Some components are not using the unified value');
  console.log('   Review the checks above to see which values differ');
  process.exit(1);
}
