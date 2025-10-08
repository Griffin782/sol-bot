// ============================================
// WALLET ROTATOR - Multi-Wallet Management
// ============================================

import * as fs from 'fs';
import * as path from 'path';
import { Keypair } from '@solana/web3.js';

export interface WalletConfig {
  privateKey: string;
  publicKey: string;
  status: 'active' | 'completed' | 'reserved' | 'retired';
  initialPool: number;
  currentPool: number;
  targetReached: boolean;
  startTime: Date;
  endTime?: Date;
  totalProfit?: number;
  totalTrades?: number;
  createdAt: Date;
  lastUsed?: Date;
  sessionHistory: string[];
}

export interface WalletStats {
  publicKey: string;
  totalProfit: number;
  roi: number;
  totalTrades: number;
  sessionId: string;
}

export class WalletRotator {
  private walletPool: WalletConfig[] = [];
  private activeWallet: WalletConfig | null = null;
  private walletDir = './wallets';
  private completedDir = './wallets/completed';
  private pendingDir = './wallets/pending';
  private rotationHistory: any[] = [];

  constructor() {
    // Create directories if they don't exist
    [this.walletDir, this.completedDir, this.pendingDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    this.loadWalletPool();
    this.loadRotationHistory();
  }

  private loadWalletPool(): void {
    const poolFile = path.join(this.pendingDir, 'wallet-pool.json');
    
    if (fs.existsSync(poolFile)) {
      const data = fs.readFileSync(poolFile, 'utf-8');
      const rawPool = JSON.parse(data);
      
      // Convert date strings back to Date objects
      this.walletPool = rawPool.map((wallet: any) => ({
        ...wallet,
        startTime: new Date(wallet.startTime),
        endTime: wallet.endTime ? new Date(wallet.endTime) : undefined,
        createdAt: wallet.createdAt ? new Date(wallet.createdAt) : new Date(),
        lastUsed: wallet.lastUsed ? new Date(wallet.lastUsed) : undefined,
        sessionHistory: wallet.sessionHistory || []
      }));
      
      console.log(`📊 Loaded ${this.walletPool.length} wallets from pool`);
      this.displayWalletPoolStatus();
    } else {
      console.log('⚠️ No wallet pool found. Creating new pool...');
      this.generateWalletPool(5); // Generate 5 wallets by default
    }
  }

  private loadRotationHistory(): void {
    const historyFile = './wallets/rotation_history.json';
    
    if (fs.existsSync(historyFile)) {
      const data = fs.readFileSync(historyFile, 'utf-8');
      this.rotationHistory = JSON.parse(data);
      console.log(`📚 Loaded rotation history: ${this.rotationHistory.length} entries`);
    } else {
      this.rotationHistory = [];
    }
  }

  private saveWalletPool(): void {
    const poolFile = path.join(this.pendingDir, 'wallet-pool.json');
    fs.writeFileSync(poolFile, JSON.stringify(this.walletPool, null, 2));
  }

  private saveRotationHistory(): void {
    const historyFile = './wallets/rotation_history.json';
    fs.writeFileSync(historyFile, JSON.stringify(this.rotationHistory, null, 2));
  }

  public generateWalletPool(count: number): void {
    const newWallets: WalletConfig[] = [];
    
    for (let i = 0; i < count; i++) {
      const keypair = Keypair.generate();
      const wallet: WalletConfig = {
        privateKey: Buffer.from(keypair.secretKey).toString('base64'),
        publicKey: keypair.publicKey.toBase58(),
        status: 'reserved',
        initialPool: 1000, // Default $1000 per wallet
        currentPool: 1000,
        targetReached: false,
        startTime: new Date(),
        createdAt: new Date(),
        sessionHistory: []
      };
      newWallets.push(wallet);
    }
    
    this.walletPool = [...this.walletPool, ...newWallets];
    this.saveWalletPool();
    console.log(`✅ Generated ${count} new wallets for rotation pool`);
    this.displayWalletPoolStatus();
  }

  public getNextWallet(): WalletConfig {
    // Find the best available wallet (unused or least recently used)
    const availableWallets = this.walletPool
      .filter(w => w.status === 'reserved')
      .sort((a, b) => {
        // Prioritize never-used wallets
        if (!a.lastUsed && b.lastUsed) return -1;
        if (a.lastUsed && !b.lastUsed) return 1;
        if (!a.lastUsed && !b.lastUsed) return 0;
        
        // Then sort by least recently used
        return a.lastUsed!.getTime() - b.lastUsed!.getTime();
      });
    
    if (availableWallets.length === 0) {
      console.log('⚠️ No available wallets in pool! Generating more...');
      this.generateWalletPool(3);
      return this.getNextWallet();
    }
    
    const selectedWallet = availableWallets[0];
    selectedWallet.status = 'active';
    selectedWallet.startTime = new Date();
    selectedWallet.lastUsed = new Date();
    this.activeWallet = selectedWallet;
    
    // Record rotation
    this.rotationHistory.push({
      timestamp: new Date(),
      action: 'wallet_activated',
      walletId: selectedWallet.publicKey.slice(0, 8),
      fullPublicKey: selectedWallet.publicKey,
      previousSessions: selectedWallet.sessionHistory.length
    });
    
    this.saveWalletPool();
    this.saveRotationHistory();
    
    console.log(`🔄 WALLET ROTATION ACTIVATED`);
    console.log(`   💼 Wallet: ${selectedWallet.publicKey.slice(0, 8)}...${selectedWallet.publicKey.slice(-4)}`);
    console.log(`   📊 Previous sessions: ${selectedWallet.sessionHistory.length}`);
    console.log(`   💰 Initial Pool: $${selectedWallet.initialPool}`);
    console.log(`   🆔 Full Key: ${selectedWallet.publicKey}`);
    
    return selectedWallet;
  }

  public archiveWallet(publicKey: string, stats: WalletStats): void {
    const wallet = this.walletPool.find(w => w.publicKey === publicKey);
    if (!wallet) return;

    wallet.status = 'completed';
    wallet.endTime = new Date();
    wallet.totalProfit = stats.totalProfit;
    wallet.totalTrades = stats.totalTrades;
    wallet.currentPool = stats.totalProfit + wallet.initialPool;
    wallet.targetReached = true;
    wallet.sessionHistory.push(stats.sessionId);

    // Save to completed folder with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `wallet-${wallet.publicKey.slice(0, 8)}-COMPLETED-${timestamp}.json`;
    const filepath = path.join(this.completedDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(wallet, null, 2));
    
    // Record rotation
    this.rotationHistory.push({
      timestamp: new Date(),
      action: 'wallet_completed',
      walletId: wallet.publicKey.slice(0, 8),
      fullPublicKey: wallet.publicKey,
      finalBalance: wallet.currentPool,
      profit: wallet.totalProfit,
      roi: ((wallet.currentPool - wallet.initialPool) / wallet.initialPool) * 100,
      sessionCount: wallet.sessionHistory.length
    });
    
    // Remove from active pool
    this.walletPool = this.walletPool.filter(w => w.publicKey !== publicKey);
    this.saveWalletPool();
    this.saveRotationHistory();
    
    console.log(`📦 WALLET ARCHIVED SUCCESSFULLY`);
    console.log(`   📄 File: ${filename}`);
    console.log(`   💰 Final Balance: $${wallet.currentPool?.toFixed(2)}`);
    console.log(`   📈 Total Profit: $${wallet.totalProfit?.toFixed(2)}`);
    console.log(`   🎯 ROI: ${(((wallet.currentPool || 0) - wallet.initialPool) / wallet.initialPool * 100).toFixed(2)}%`);
    console.log(`   📊 Sessions: ${wallet.sessionHistory.length}`);
    
    // Update environment to next wallet if needed
    if (this.activeWallet?.publicKey === publicKey) {
      this.activeWallet = null;
    }
  }

  public retireWallet(publicKey: string, reason: string): void {
    const wallet = this.walletPool.find(w => w.publicKey === publicKey);
    if (!wallet) return;

    wallet.status = 'retired';
    wallet.endTime = new Date();
    
    this.rotationHistory.push({
      timestamp: new Date(),
      action: 'wallet_retired',
      walletId: wallet.publicKey.slice(0, 8),
      reason: reason,
      sessionsCompleted: wallet.sessionHistory.length
    });
    
    this.saveWalletPool();
    this.saveRotationHistory();
    
    console.log(`🚫 Wallet retired: ${wallet.publicKey.slice(0, 8)}... (${reason})`);
  }

  public getWalletPoolStatus(): {
    total: number;
    available: number;
    active: number;
    completed: number;
    retired: number;
  } {
    return {
      total: this.walletPool.length,
      available: this.walletPool.filter(w => w.status === 'reserved').length,
      active: this.walletPool.filter(w => w.status === 'active').length,
      completed: this.walletPool.filter(w => w.status === 'completed').length,
      retired: this.walletPool.filter(w => w.status === 'retired').length
    };
  }

  public displayWalletPoolStatus(): void {
    const status = this.getWalletPoolStatus();
    
    console.log(`\n💼 WALLET POOL STATUS:`);
    console.log(`   📊 Total wallets: ${status.total}`);
    console.log(`   🟢 Available: ${status.available}`);
    console.log(`   🔵 Active: ${status.active}`);
    console.log(`   ✅ Completed: ${status.completed}`);
    console.log(`   🚫 Retired: ${status.retired}`);
    
    if (this.activeWallet) {
      console.log(`   🎯 Current: ${this.activeWallet.publicKey.slice(0, 8)}...`);
    }
  }

  public getRotationHistory(): any[] {
    return this.rotationHistory;
  }

  public getCompletedWallets(): WalletConfig[] {
    const completedFiles = fs.readdirSync(this.completedDir)
      .filter(f => f.endsWith('.json') && f.includes('COMPLETED'));
    
    return completedFiles.map(file => {
      const data = fs.readFileSync(path.join(this.completedDir, file), 'utf-8');
      return JSON.parse(data);
    });
  }

  public generateRotationReport(): void {
    const completed = this.getCompletedWallets();
    const totalProfit = completed.reduce((sum, w) => sum + (w.totalProfit || 0), 0);
    const avgROI = completed.length > 0 
      ? completed.reduce((sum, w) => sum + (((w.currentPool || w.initialPool) - w.initialPool) / w.initialPool * 100), 0) / completed.length
      : 0;
    
    console.log(`\n📊 WALLET ROTATION REPORT:`);
    console.log(`   🏆 Completed wallets: ${completed.length}`);
    console.log(`   💰 Total profit: $${totalProfit.toFixed(2)}`);
    console.log(`   📈 Average ROI: ${avgROI.toFixed(2)}%`);
    console.log(`   🔄 Rotation events: ${this.rotationHistory.length}`);
    
    if (completed.length > 0) {
      const bestWallet = completed.reduce((best, current) => 
        ((current.totalProfit || 0) > (best.totalProfit || 0)) ? current : best
      );
      console.log(`   🥇 Best performer: ${bestWallet.publicKey.slice(0, 8)}... ($${(bestWallet.totalProfit || 0).toFixed(2)} profit)`);
    }
  }

  public ensureWalletAvailability(): boolean {
    const available = this.walletPool.filter(w => w.status === 'reserved').length;
    
    if (available < 2) {
      console.log(`⚠️ Low wallet availability (${available}). Generating more...`);
      this.generateWalletPool(5);
      return true;
    }
    
    return false;
  }
}