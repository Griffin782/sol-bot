import { MASTER_SETTINGS } from './UNIFIED-CONTROL';

let globalTradeCounter = 0;
const ABSOLUTE_MAX_TRADES = MASTER_SETTINGS.limits.maxTradesAbsolute;

export function canTrade(): boolean {
  if (globalTradeCounter >= ABSOLUTE_MAX_TRADES) {
    console.log(`🛑 ABSOLUTE LIMIT REACHED: ${globalTradeCounter}/${ABSOLUTE_MAX_TRADES}`);
    console.log("🔴 FORCING SHUTDOWN IN 5 SECONDS...");
    setTimeout(() => {
      console.log("💀 FORCE KILLING BOT - TRADE LIMIT");
      process.exit(0);
    }, 5000);
    return false;
  }
  return true;
}

export function incrementTradeCounter(): void {
  globalTradeCounter++;
  console.log(`📊 Trade Counter: ${globalTradeCounter}/${ABSOLUTE_MAX_TRADES}`);

  // Warning messages
  if (globalTradeCounter === 10) {
    console.log("⚠️ HALFWAY WARNING: 10/20 trades executed");
  }
  if (globalTradeCounter === 15) {
    console.log("⚠️ APPROACHING LIMIT: 15/20 trades");
  }
  if (globalTradeCounter === 18) {
    console.log("🚨 FINAL WARNING: 18/20 trades - 2 remaining!");
  }
}

export function getTradeCount(): number {
  return globalTradeCounter;
}

export function resetTradeCounter(): void {
  globalTradeCounter = 0;
  console.log("🔄 Trade counter reset to 0");
}