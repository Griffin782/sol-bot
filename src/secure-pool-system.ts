// ============================================
// SECURE POOL CONFIGURATION WITH AUTO-WITHDRAWALS
// ============================================
import axios from 'axios';
import * as fs from 'fs';  // ADD THIS LINE

// ADD THESE LINES - Global variables that will be set by index.ts
let IS_TEST_MODE = false;

// Export a function to set the test mode
export function setTestMode(testMode: boolean): void {
  IS_TEST_MODE = testMode;
}


interface SecurePoolConfig {
  sessionNumber: number;
  tradingPoolMin: number;      // Minimum to keep trading
  tradingPoolMax: number;      // Trigger withdrawal at this amount
  withdrawToHardware: number;  // Amount to secure
  withdrawForTaxes: number;    // Tax reserve (40%)
  keepInWallet: number;        // Continue trading with this
  sessionNetTarget: number;    // Total to accumulate (secured)
  positionSizeUSD: number;     // USD per trade
}

const SECURE_SESSIONS: SecurePoolConfig[] = [
  { 
    sessionNumber: 1,
    tradingPoolMin: 600,
    tradingPoolMax: 7000,
    withdrawToHardware: 5000,
    withdrawForTaxes: 2000,
    keepInWallet: 600,
    sessionNetTarget: 6000,
    positionSizeUSD: 15  // $15 per trade
  },
  { 
    sessionNumber: 2,
    tradingPoolMin: 1200,
    tradingPoolMax: 7000,
    withdrawToHardware: 5000,
    withdrawForTaxes: 2000,
    keepInWallet: 1200,
    sessionNetTarget: 24000,
    positionSizeUSD: 45  // $30 per trade (doubled)
  },
  { 
    sessionNumber: 3,
    tradingPoolMin: 2000,
    tradingPoolMax: 7000,
    withdrawToHardware: 5000,
    withdrawForTaxes: 2000,
    keepInWallet: 2000,
    sessionNetTarget: 100000,
    positionSizeUSD: 45  // $30 per trade
  },
  { 
    sessionNumber: 4,
    tradingPoolMin: 3000,
    tradingPoolMax: 7000,
    withdrawToHardware: 4000,
    withdrawForTaxes: 2000,
    keepInWallet: 3000,
    sessionNetTarget: 200000,
    positionSizeUSD: 45  // $30 per trade
  }
];

// Global tracking
export let currentSecureSession = SECURE_SESSIONS[0];
let totalSecuredProfit = 0;
let withdrawalCount = 0;
let currentSOLPrice = 170; // Default fallback price
let lastPriceUpdate = 0;

// Hardware wallet configuration
const HARDWARE_WALLET_ADDRESS = "j8aDebcuR3uURqZ7BbvrcZnd3ZmikV2U3RAHGYhs9Nj"; // TODO: Add your hardware wallet
const TAX_RESERVE_ADDRESS = "DBHRvYWH2KgjgqdjJ9wTnLE8YAQTX9hZpoJjxWuvsRZr"; // TODO: Add your tax reserve wallet
const HARDWARE_WALLET_ADDRESS_FAKE = "kb9....uN3K-fake"; // Placeholder for test mode
const TAX_RESERVE_ADDRESS_FAKE = "b3RD....3hWv-fake"; // Placeholder for test mode

// ============================================
// SOL PRICE FETCHING
// ============================================
async function updateSOLPrice(): Promise<number> {
  try {
    // Try multiple sources for redundancy
    const sources = [
      {
        name: 'CoinGecko',
        url: 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
        parser: (data: any) => data.solana.usd
      },
      {
        name: 'Jupiter',
        url: 'https://price.jup.ag/v4/price?ids=SOL',
        parser: (data: any) => data.data.SOL.price
      },
      {
        name: 'Binance',
        url: 'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT',
        parser: (data: any) => parseFloat(data.price)
      }
    ];

    for (const source of sources) {
      try {
        const response = await axios.get(source.url, { timeout: 5000 });
        const price = source.parser(response.data);
        
        if (price && price > 0) {
          currentSOLPrice = price;
          lastPriceUpdate = Date.now();
          console.log(`💵 SOL Price Updated: $${price.toFixed(2)} (from ${source.name})`);
          return price;
        }
      } catch (error) {
        // Try next source
        continue;
      }
    }

    // If all sources fail, use last known price
    console.log(`⚠️ Using cached SOL price: $${currentSOLPrice.toFixed(2)}`);
    return currentSOLPrice;
    
  } catch (error) {
    console.error(`❌ Price fetch error:`, error);
    return currentSOLPrice; // Fallback to last known price
  }
}

// Update SOL price every 60 seconds
async function startPriceUpdater(): Promise<void> {
  await updateSOLPrice(); // Initial fetch
  
  setInterval(async () => {
    await updateSOLPrice();
  }, 60000); // Update every minute
}

// ============================================
// CALCULATE POSITION SIZE IN SOL
// ============================================
export function calculatePositionSizeInSOL(): number {
  // Use masterConfig position size if available
  const masterConfig = require('./enhanced/masterConfig').masterConfig;
  const configPositionSOL = masterConfig?.pool?.positionSize || 0.28;
  
  // Return the config value directly (it's already in SOL)
  return configPositionSOL;
}

// ============================================
// SECURITY WITHDRAWAL FUNCTION
// ============================================

export async function checkForSecureWithdrawal(poolManager: any): Promise<boolean> {
  const currentPool = poolManager.currentPool || 0;
  
  if (currentPool >= currentSecureSession.tradingPoolMax) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔒 SECURITY WITHDRAWAL TRIGGERED`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📊 Session ${currentSecureSession.sessionNumber} | Withdrawal #${withdrawalCount + 1}`);
    console.log(`💰 Current Pool: $${currentPool.toLocaleString()}`);
    console.log(`📤 Withdrawing to Hardware: $${currentSecureSession.withdrawToHardware.toLocaleString()}`);
    console.log(`💸 Withdrawing for Taxes: $${currentSecureSession.withdrawForTaxes.toLocaleString()}`);
    console.log(`♻️ Keeping for Trading: $${currentSecureSession.keepInWallet.toLocaleString()}`);
    
    // Calculate SOL amounts for withdrawal (using current price)
    const solToHardware = currentSecureSession.withdrawToHardware / currentSOLPrice;
    const solToTaxes = currentSecureSession.withdrawForTaxes / currentSOLPrice;
    
    console.log(`\n💎 SOL Amounts (at $${currentSOLPrice.toFixed(2)}/SOL):`);
    console.log(`   To Hardware: ${solToHardware.toFixed(4)} SOL`);
    console.log(`   To Taxes: ${solToTaxes.toFixed(4)} SOL`);
    
    // NEW LINES 156-170 (REPLACE THE OLD if/else block)
    // Try to import the transfer system
    try {
      const transferModule = await import('./secure-transfer-system');
      const integrateTransferSystem = transferModule.integrateTransferSystem;
      
      // Execute the transfer (works in both TEST and LIVE modes)
      const transferSuccess = await integrateTransferSystem(
        poolManager,
        currentSecureSession,
        IS_TEST_MODE
      );
      
      if (!transferSuccess) {
        console.error('❌ Transfer failed - keeping funds in wallet');
        return false;
      }
    } catch (error) {
      console.log('⚠️ Transfer system not available, using basic logging only');
      // Continue without transfer system
    }
    
    // Update tracking
    totalSecuredProfit += currentSecureSession.withdrawToHardware;
    withdrawalCount++;
    
    // Reset pool to minimum
    poolManager.currentPool = currentSecureSession.keepInWallet;
    
    // Log withdrawal
const sessionSecuredProfit = totalSecuredProfit; // Add this line to define it
const withdrawalRecord = {
  timestamp: new Date().toISOString(),
  withdrawalNumber: withdrawalCount,
  session: currentSecureSession.sessionNumber,
  poolBefore: currentPool,
  toHardware: currentSecureSession.withdrawToHardware,
  toTaxes: currentSecureSession.withdrawForTaxes,
  keepTrading: currentSecureSession.keepInWallet,
  totalSecured: totalSecuredProfit,  // Lifetime total
  sessionSecured: sessionSecuredProfit,  // Add this for per-session tracking
  solPrice: currentSOLPrice,
  solToHardware: solToHardware.toFixed(4),
  solToTaxes: solToTaxes.toFixed(4)
};
    
    // Ensure directory exists
    if (!fs.existsSync('./wallets')) {
      fs.mkdirSync('./wallets', { recursive: true });
    }
    
    // Append to withdrawals log
    fs.appendFileSync('./wallets/withdrawals.jsonl', JSON.stringify(withdrawalRecord) + '\n');
    
    console.log(`\n✅ WITHDRAWAL #${withdrawalCount} COMPLETE`);
    console.log(`🔐 Total Secured: $${totalSecuredProfit.toLocaleString()}`);
    console.log(`💸 Total Tax Reserved: $${(withdrawalCount * currentSecureSession.withdrawForTaxes).toLocaleString()}`);
    console.log(`📊 Session ${currentSecureSession.sessionNumber} Progress: $${totalSecuredProfit.toLocaleString()} / $${currentSecureSession.sessionNetTarget.toLocaleString()}`);
    
// Check if session target reached
if (totalSecuredProfit >= currentSecureSession.sessionNetTarget) {
  console.log(`\n🎯 SESSION ${currentSecureSession.sessionNumber} TARGET REACHED!`);
  console.log(`   Lifetime Secured: $${totalSecuredProfit.toLocaleString()}`);
  
  // Move to next session if available
  if (currentSecureSession.sessionNumber < SECURE_SESSIONS.length) {
    const nextIndex = currentSecureSession.sessionNumber; // This is CORRECT (Session 1 → index 1 for Session 2)
    currentSecureSession = SECURE_SESSIONS[nextIndex];
    
    console.log(`\n📈 ADVANCING TO SESSION ${currentSecureSession.sessionNumber}`);
    console.log(`   New Trading Range: $${currentSecureSession.tradingPoolMin} - $${currentSecureSession.tradingPoolMax}`);
    console.log(`   New Position Size: $${currentSecureSession.positionSizeUSD} (${(currentSecureSession.positionSizeUSD / currentSOLPrice).toFixed(4)} SOL)`);
    
    // Update pool manager with new position size
    poolManager.positionSize = currentSecureSession.positionSizeUSD;
    poolManager.positionSizeSOL = currentSecureSession.positionSizeUSD / currentSOLPrice;
    
    // DON'T reset totalSecuredProfit - it tracks lifetime!
  } else {
    console.log(`\n🏆 ALL SESSIONS COMPLETE! Continuing Session 4 indefinitely...`);
  }
}
    
    console.log(`${'='.repeat(60)}\n`);
    
    return true;
  }
  
  return false;
}

// ============================================
// ENHANCED STATUS DISPLAY
// ============================================
export function displaySecurePoolStatus(): void {
  const solPositionSize = calculatePositionSizeInSOL();
  const timeSinceUpdate = Date.now() - lastPriceUpdate;
  const priceAge = timeSinceUpdate < 60000 ? 'Fresh' : `${Math.floor(timeSinceUpdate / 60000)}m old`;
  
  console.log(`\n🔒 SECURE TRADING STATUS:`);
  console.log(`   Session: ${currentSecureSession.sessionNumber}`);
  console.log(`   Position Size: $${currentSecureSession.positionSizeUSD} (${solPositionSize} SOL)`);
  console.log(`   SOL Price: $${currentSOLPrice.toFixed(2)} (${priceAge})`);
  console.log(`   Withdrawal Trigger: $${currentSecureSession.tradingPoolMax.toLocaleString()}`);
  console.log(`   Total Secured: $${totalSecuredProfit.toLocaleString()}`);
  console.log(`   Withdrawals Made: ${withdrawalCount}`);
  console.log(`   Session Target: $${currentSecureSession.sessionNetTarget.toLocaleString()}`);
  console.log(`   Progress: ${((totalSecuredProfit / currentSecureSession.sessionNetTarget) * 100).toFixed(1)}%`);
}

// ============================================
// INTEGRATION FUNCTIONS
// ============================================

// Call this in your main startup
export async function initializeSecurePool(): Promise<void> {
  console.log(`\n🔒 Initializing Secure Pool System...`);
  
  // Start price updater
  await startPriceUpdater();
  
  // Load withdrawal history if exists
  if (fs.existsSync('./wallets/withdrawals.jsonl')) {
    const lines = fs.readFileSync('./wallets/withdrawals.jsonl', 'utf8').split('\n').filter(l => l);
    if (lines.length > 0) {
      const lastWithdrawal = JSON.parse(lines[lines.length - 1]);
      withdrawalCount = lastWithdrawal.withdrawalNumber;
      totalSecuredProfit = lastWithdrawal.totalSecured;
      
      // Determine current session based on history
      for (let i = SECURE_SESSIONS.length - 1; i >= 0; i--) {
        if (totalSecuredProfit >= SECURE_SESSIONS[i].sessionNetTarget) {
          currentSecureSession = SECURE_SESSIONS[Math.min(i + 1, SECURE_SESSIONS.length - 1)];
          break;
        }
      }
      
      console.log(`   Loaded ${withdrawalCount} previous withdrawals`);
      console.log(`   Total Secured: $${totalSecuredProfit.toLocaleString()}`);
      console.log(`   Current Session: ${currentSecureSession.sessionNumber}`);
    }
  }
  
  console.log(`   Position Size: $${currentSecureSession.positionSizeUSD}`);
  console.log(`   SOL Price: $${currentSOLPrice.toFixed(2)}`);
  console.log(`   Position in SOL: ${calculatePositionSizeInSOL()}`);
  console.log(`✅ Secure Pool System Ready\n`);
}
