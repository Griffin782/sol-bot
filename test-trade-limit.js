// Quick test of the trade limit system
const { canTrade, incrementTradeCounter, getTradeCount } = require('./dist/src/core/FORCE-TRADE-LIMIT');

console.log("🧪 Testing Trade Limit System");
console.log("===============================");

// Test initial state
console.log("Initial trade count:", getTradeCount());
console.log("Can trade initially:", canTrade());

// Simulate 19 trades
for (let i = 1; i <= 19; i++) {
  console.log(`\n--- Simulating Trade ${i} ---`);
  console.log("Can trade before increment:", canTrade());
  incrementTradeCounter();
  console.log("Trade count after increment:", getTradeCount());
}

// Test the 20th trade (should still allow)
console.log("\n--- Testing 20th Trade (Limit) ---");
console.log("Can trade at 20th:", canTrade());
incrementTradeCounter();
console.log("Trade count:", getTradeCount());

// Test the 21st trade (should deny and shutdown)
console.log("\n--- Testing 21st Trade (Should Block) ---");
console.log("Can trade after limit:", canTrade());