## Fix: Add trade limit check before executing trades
File: src/index.ts
Code:
```typescript
import { getMaxTrades } from './core/UNIFIED-CONTROL';

// Add before trade execution:
const maxTrades = getMaxTrades();
if (totalTrades >= maxTrades) {
  console.log("Trade limit reached, starting shutdown...");
  await shutdownWithReport();
  return;
}
```
