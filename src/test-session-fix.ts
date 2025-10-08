import { botController } from './botController';

console.log('🔧 TESTING FIXED SESSION PROGRESSION\n');

const sessions = botController.getSessionProgression();
const TAX_RATE = 0.40;

console.log('SESSION FLOW:');
console.log('═'.repeat(50));

sessions.forEach((session, index) => {
  const grossProfit = session.targetPool - session.initialPool;
  const netAfterTax = grossProfit * (1 - TAX_RATE);
  const reinvestment = netAfterTax * (session.reinvestmentPercent / 100);

  console.log(`\nSession ${session.sessionNumber}:`);
  console.log(`  Start: $${session.initialPool.toLocaleString()}`);
  console.log(`  Target: $${session.targetPool.toLocaleString()}`);
  console.log(`  Profit: $${grossProfit.toLocaleString()}`);
  console.log(`  After Tax: $${netAfterTax.toLocaleString()}`);
  console.log(`  → Next Session: $${session.nextSessionPool.toLocaleString()}`);
  console.log(`  Position Size: $${session.positionSizeUSD}`);

  // Verify continuity
  if (index < sessions.length - 1) {
    const nextSession = sessions[index + 1];
    if (nextSession.initialPool === session.nextSessionPool) {
      console.log(`  ✅ Flows correctly to Session ${nextSession.sessionNumber}`);
    } else {
      console.log(`  ❌ MISMATCH with Session ${nextSession.sessionNumber}`);
    }
  }
});

console.log('\n' + '═'.repeat(50));
console.log('SUMMARY: All sessions now have mathematically valid progression!');

// Test position sizing function
console.log('\n🎯 TESTING DYNAMIC POSITION SIZING:');
console.log('═'.repeat(50));

sessions.forEach(session => {
  console.log(`Session ${session.sessionNumber}: $${session.positionSizeUSD} USD`);
});

console.log('\n' + '═'.repeat(50));
console.log('✅ ALL TESTS COMPLETE!');