import * as fs from 'fs';
import * as path from 'path';

export interface TaxableTransaction {
  timestamp: string;
  type: 'buy' | 'sell' | 'swap';
  tokenMint?: string;
  amount?: number;
  entryPrice?: number;
  exitPrice?: number;
  profit?: number;
  signature?: string;
  success?: boolean;
}

export interface TaxRecord extends TaxableTransaction {
  id: string;
  taxOwed?: number;
  netProfit?: number;
  notes?: string;
}

const TAX_RATE = 0.40;  // 40% tax reserve

export async function recordTrade(transaction: TaxableTransaction): Promise<void> {
  try {
    // Create directories if they don't exist
    const taxDir = path.join(__dirname, '..', '2025');
    const dataDir = './data';
    
    if (!fs.existsSync(taxDir)) {
      fs.mkdirSync(taxDir, { recursive: true });
    }
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Calculate tax if profit exists
    let taxOwed = 0;
    let netProfit = 0;
    if (transaction.profit && transaction.profit > 0) {
      taxOwed = transaction.profit * TAX_RATE;
      netProfit = transaction.profit - taxOwed;
    }
    
    // Create complete tax record
    const taxRecord: TaxRecord = {
      ...transaction,
      id: `${transaction.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taxOwed,
      netProfit,
      notes: `Recorded ${transaction.type} trade`
    };
    
    // 1. Update DAILY tax file (for IRS compliance)
    const date = new Date().toISOString().split('T')[0];
    const dailyFile = path.join(taxDir, `daily-${date}.json`);
    
    let dailyData = {
      date,
      totalTransactions: 0,
      buys: 0,
      sells: 0,
      totalVolume: 0,
      totalFees: 0,
      realizedGains: 0,
      unrealizedGains: 0,
      taxOwed: 0,
      transactions: [] as TaxRecord[]
    };
    
    if (fs.existsSync(dailyFile)) {
      dailyData = JSON.parse(fs.readFileSync(dailyFile, 'utf8'));
    }
    
    // Update daily statistics
    dailyData.totalTransactions++;
    if (transaction.type === 'buy') dailyData.buys++;
    if (transaction.type === 'sell') {
      dailyData.sells++;
      if (transaction.profit) {
        dailyData.realizedGains += transaction.profit;
        dailyData.taxOwed += taxOwed;
      }
    }
    dailyData.totalVolume += transaction.amount || 0;
    dailyData.transactions.push(taxRecord);
    
    fs.writeFileSync(dailyFile, JSON.stringify(dailyData, null, 2));
    
    // 2. Update MASTER tax records (for complete history)
    const masterFile = path.join(dataDir, 'tax_records.json');
    let masterData: TaxRecord[] = [];
    
    if (fs.existsSync(masterFile)) {
      const data = fs.readFileSync(masterFile, 'utf8');
      masterData = data.trim() ? JSON.parse(data) : [];
    }
    
    masterData.push(taxRecord);
    fs.writeFileSync(masterFile, JSON.stringify(masterData, null, 2));
    
    console.log(`📊 Tax recorded: ${transaction.type} - ${transaction.tokenMint?.slice(0,8) || 'N/A'}`);
    if (taxOwed > 0) {
      console.log(`   💰 Profit: $${transaction.profit?.toFixed(2)} | Tax Reserved: $${taxOwed.toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to record tax data:', error);
    throw error;
  }
}

export function getTaxRecords(): TaxRecord[] {
  const masterFile = './data/tax_records.json';
  if (!fs.existsSync(masterFile)) return [];
  try {
    const data = fs.readFileSync(masterFile, 'utf8');
    return data.trim() ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function getDailyTaxSummary(date?: string): any {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const dailyFile = path.join(__dirname, '..', '2025', `daily-${targetDate}.json`);
  
  if (!fs.existsSync(dailyFile)) {
    return null;
  }
  
  return JSON.parse(fs.readFileSync(dailyFile, 'utf8'));
}

export function generateForm8949CSV(year: number): string {
  // Simple implementation for now
  return `Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Gain/Loss\n`;
}

export function getTaxSummary(): any {
  return {
    totalTrades: 0,
    totalProfit: 0,
    totalTaxOwed: 0
  };
}