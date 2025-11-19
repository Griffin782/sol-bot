// configBridge.ts - Central config import hub
import { masterConfig } from './enhanced/masterConfig';

// Type assertion to avoid TypeScript errors
const config = masterConfig as any;

// ============ POOL SETTINGS ============
export const INITIAL_POOL = config.pool?.initialPool || 85;
export const TARGET_POOL = config.pool?.targetPool || 1701.75;
export const POSITION_SIZE = config.pool?.positionSize || 0.089;
export const MAX_CONCURRENT = config.pool?.maxConcurrentPositions || 5;
export const MIN_POOL_BALANCE = config.pool?.minPoolBalance || 50;

// ============ TRADING SETTINGS ============
export const BUY_AMOUNT_SOL = config.trading?.buyAmountSol || 0.089;
export const SLIPPAGE = config.trading?.slippage || 15;
export const PRIORITY_FEE = config.trading?.priorityFee || 0.00005;
export const GAS_FEE = config.trading?.gasFee || 0.00001;
export const MIN_LIQUIDITY = config.trading?.minLiquidity || 5000;
export const MIN_MARKET_CAP = config.trading?.minMarketCap || 5000;
export const MAX_MARKET_CAP = config.trading?.maxMarketCap || 75000;

// ============ EXIT STRATEGY ============
export const TAKE_PROFIT_1 = config.exitStrategy?.takeProfit1 || 2.0;
export const TAKE_PROFIT_1_PERCENT = config.exitStrategy?.takeProfit1Percent || 30;
export const TAKE_PROFIT_2 = config.exitStrategy?.takeProfit2 || 4.0;
export const TAKE_PROFIT_2_PERCENT = config.exitStrategy?.takeProfit2Percent || 30;
export const TAKE_PROFIT_3 = config.exitStrategy?.takeProfit3 || 6.0;
export const TAKE_PROFIT_3_PERCENT = config.exitStrategy?.takeProfit3Percent || 25;
export const STOP_LOSS = config.exitStrategy?.stopLoss || -0.5;
export const MOONBAG_PERCENT = config.exitStrategy?.moonbagPercent || 15;
export const TRAILING_STOP = config.exitStrategy?.trailingStop || true;
export const TRAILING_STOP_TRIGGER = config.exitStrategy?.trailingStopTrigger || 3.0;
export const TRAILING_STOP_PERCENT = config.exitStrategy?.trailingStopPercent || 20;

// ============ RISK MANAGEMENT ============
export const MAX_TRADES_PER_MINUTE = config.risk?.maxTradesPerMinute || 10;
export const MAX_DAILY_LOSS = config.risk?.maxDailyLoss || -500;
export const MAX_POSITION_SIZE_USD = config.risk?.maxPositionSize || 50;
export const MIN_PROFIT_TO_CONTINUE = config.risk?.minProfitToContinue || 0.1;
export const COOLDOWN_AFTER_LOSS = config.risk?.cooldownAfterLoss || 30;

// ============ TAX SETTINGS ============
export const TAX_RESERVE_PERCENT = config.tax?.reservePercent || 0.40;
export const TAX_WALLET = config.tax?.taxWallet || null;
export const AUTO_WITHDRAW_TAX = config.tax?.autoWithdraw || false;

// ============ BOT SETTINGS ============
export const BOT_DURATION = config.bot?.duration || 0;
export const TEST_MODE = process.env.TEST_MODE === 'true' || config.bot?.testMode || false;
export const MONITORING_INTERVAL = config.bot?.monitoringInterval || 1000;
export const HEALTH_CHECK_INTERVAL = config.bot?.healthCheckInterval || 60000;

// ============ SECURE POOL ============
export const SECURE_RPC = config.securePool?.rpcUrl || process.env.RPC_URL;
export const WITHDRAWAL_THRESHOLD = config.securePool?.withdrawalThreshold || 10680;
export const RESERVE_AMOUNT = config.securePool?.reserveAmount || 1000;

// ============ 5X DETECTION ============
export const ENABLE_5X_DETECTION = config.detection5x?.enabled || true;
export const VOLUME_SPIKE_THRESHOLD = config.detection5x?.volumeSpikeThreshold || 3.0;
export const HOLDER_GROWTH_THRESHOLD = config.detection5x?.holderGrowthThreshold || 2.0;
export const EXTENDED_HOLD_MULTIPLIER = config.detection5x?.extendedHoldMultiplier || 1.5;

// ============ WHALE TRACKING ============
export const WHALE_WALLET_SIZE = config.whaleTracking?.minWhaleSize || 10000;
export const WHALE_SELL_THRESHOLD = config.whaleTracking?.sellThreshold || 0.1;
export const FOLLOW_WHALE_BUYS = config.whaleTracking?.followBuys || true;
export const FOLLOW_WHALE_SELLS = config.whaleTracking?.followSells || true;

// ============ EXPORT FULL CONFIG ============
export const CONFIG = config;

// ============ VALIDATION ============
console.log('🔧 CONFIG BRIDGE INITIALIZED:');
console.log('  ✅ Target Pool: $' + TARGET_POOL);
console.log('  ✅ Position Size: ' + POSITION_SIZE + ' SOL');
console.log('  ✅ Test Mode: ' + TEST_MODE);
console.log('  ✅ Tax Reserve: ' + TAX_RESERVE_PERCENT + '%');
console.log('  ✅ Take Profits: ' + TAKE_PROFIT_1 + 'x, ' + TAKE_PROFIT_2 + 'x, ' + TAKE_PROFIT_3 + 'x');
console.log('  ✅ Max Trades/Min: ' + MAX_TRADES_PER_MINUTE);

// Critical validation
if (!config || !config.pool) {
  console.error('❌ CRITICAL ERROR: masterConfig not loading!');
  console.error('Check src/enhanced/masterConfig.ts exports');
  process.exit(1);
}

export default CONFIG;