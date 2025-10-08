// z-index.ts - Test duration control
import * as z_bridge from './z-configBridge';

console.log('🚀 TESTING Z-CONFIGURATION DURATION CONTROL');
console.log(`Will stop after ${z_bridge.z_DURATION} seconds...`);

const startTime = Date.now();

setTimeout(() => {
  console.log(`\n✅ SUCCESS! Stopped after ${z_bridge.z_DURATION} seconds`);
  process.exit(0);
}, z_bridge.z_DURATION * 1000);

setInterval(() => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  console.log(`Running... ${elapsed} seconds`);
}, 10000);