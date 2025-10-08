// ============================================
// SESSION MANAGER - Trading Session Control
// ============================================

import * as fs from 'fs';
import * as path from 'path';
import { WalletRotator } from './walletRotator';

export interface TradingSession {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  initialBalance: number;
  currentBalance: number;
  totalTrades: number;
  successfulTrades: number;
  totalPnL: number;
  maxDrawdown: number;
  wallet: {
    publicKey: string;
    privateKey: string;
  };
  status: 'active' | 'completed' | 'paused';
  targetReached: boolean;
  metrics: {
    winRate: number;
    avgHoldTime: number;
    largestWin: number;
    largestLoss: number;
  };
}

export class SessionManager {
  private currentSession: TradingSession | null = null;
  private walletRotator: WalletRotator;
  private sessionsDir = './wallets/sessions';
  private sessionCounter = 1;

  constructor() {
    this.walletRotator = new WalletRotator();
    
    // Create sessions directory
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
    
    this.loadLastSessionCounter();
  }

  private loadLastSessionCounter(): void {
    try {
      const files = fs.readdirSync(this.sessionsDir);
      const sessionFiles = files.filter(f => f.startsWith('session_') && f.endsWith('.json'));
      
      if (sessionFiles.length > 0) {
        const sessionNumbers = sessionFiles.map(f => {
          const match = f.match(/session_(\d+)\.json/);
          return match ? parseInt(match[1]) : 0;
        });
        this.sessionCounter = Math.max(...sessionNumbers) + 1;
      }
    } catch (error) {
      console.log('⚠️ No previous sessions found, starting from session 1');
    }
  }

  public startNewSession(initialBalance: number = 1000): TradingSession {
    // Complete any active session first
    if (this.currentSession?.status === 'active') {
      this.completeSession('Starting new session');
    }

    // Get next wallet from rotator
    const wallet = this.walletRotator.getNextWallet();
    
    const session: TradingSession = {
      sessionId: `session_${this.sessionCounter}`,
      startTime: new Date(),
      initialBalance,
      currentBalance: initialBalance,
      totalTrades: 0,
      successfulTrades: 0,
      totalPnL: 0,
      maxDrawdown: 0,
      wallet: {
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey
      },
      status: 'active',
      targetReached: false,
      metrics: {
        winRate: 0,
        avgHoldTime: 0,
        largestWin: 0,
        largestLoss: 0
      }
    };

    this.currentSession = session;
    this.sessionCounter++;
    
    // Save initial session state
    this.saveSession();
    
    console.log(`🚀 TRADING SESSION STARTED`);
    console.log(`   📊 Session ID: ${session.sessionId}`);
    console.log(`   🎯 Target: $${initialBalance} → $${initialBalance * 10} (10x)`);
    console.log(`   💼 Wallet: ${session.wallet.publicKey.slice(0, 8)}...`);
    console.log(`   ⏰ Started: ${session.startTime.toLocaleString()}`);

    return session;
  }

  public updateSessionMetrics(
    tradeResult: {
      success: boolean;
      pnl: number;
      holdTimeMinutes: number;
    }
  ): void {
    if (!this.currentSession) return;

    const session = this.currentSession;
    session.totalTrades++;
    session.currentBalance += tradeResult.pnl;
    session.totalPnL += tradeResult.pnl;

    if (tradeResult.success) {
      session.successfulTrades++;
      if (tradeResult.pnl > session.metrics.largestWin) {
        session.metrics.largestWin = tradeResult.pnl;
      }
    } else {
      if (tradeResult.pnl < session.metrics.largestLoss) {
        session.metrics.largestLoss = tradeResult.pnl;
      }
    }

    // Calculate drawdown
    const drawdown = ((session.initialBalance - session.currentBalance) / session.initialBalance) * 100;
    if (drawdown > session.maxDrawdown) {
      session.maxDrawdown = drawdown;
    }

    // Update metrics
    session.metrics.winRate = (session.successfulTrades / session.totalTrades) * 100;
    session.metrics.avgHoldTime = tradeResult.holdTimeMinutes; // Simplified

    // Check if target reached (10x)
    if (session.currentBalance >= session.initialBalance * 10) {
      session.targetReached = true;
      console.log(`🎯 TARGET REACHED! $${session.currentBalance.toFixed(2)} (${((session.currentBalance / session.initialBalance) * 100).toFixed(0)}%)`);
    }

    this.saveSession();
  }

  public completeSession(reason: string = 'Manual completion'): void {
    if (!this.currentSession) return;

    this.currentSession.endTime = new Date();
    this.currentSession.status = 'completed';

    const session = this.currentSession;
    const duration = session.endTime.getTime() - session.startTime.getTime();
    const durationHours = duration / (1000 * 60 * 60);
    const roi = ((session.currentBalance - session.initialBalance) / session.initialBalance) * 100;

    console.log(`\n📊 TRADING SESSION COMPLETED`);
    console.log(`   🆔 Session: ${session.sessionId}`);
    console.log(`   ⏱️ Duration: ${durationHours.toFixed(1)} hours`);
    console.log(`   💰 P&L: $${session.totalPnL.toFixed(2)} (${roi.toFixed(1)}% ROI)`);
    console.log(`   📈 Trades: ${session.totalTrades} (${session.metrics.winRate.toFixed(1)}% win rate)`);
    console.log(`   📉 Max Drawdown: ${session.maxDrawdown.toFixed(1)}%`);
    console.log(`   🎯 Target: ${session.targetReached ? '✅ REACHED' : '❌ Not reached'}`);
    console.log(`   📋 Reason: ${reason}`);

    // Archive completed session
    this.archiveSession();

    // Archive wallet if target was reached
    if (session.targetReached) {
      this.walletRotator.archiveWallet(session.wallet.publicKey, {
        publicKey: session.wallet.publicKey,
        totalProfit: session.totalPnL,
        roi: roi,
        totalTrades: session.totalTrades,
        sessionId: session.sessionId
      });
    }

    this.currentSession = null;
  }

  public getCurrentSession(): TradingSession | null {
    return this.currentSession;
  }

  public shouldContinueTrading(): boolean {
    const session = this.currentSession;
    if (!session) return false;
    if (session.status !== 'active') return false;
    if (session.targetReached) return false;
    
    // Stop if losses exceed 50% of initial balance
    if (session.currentBalance <= session.initialBalance * 0.5) {
      console.log(`🔴 STOP LOSS: Session balance too low ($${session.currentBalance.toFixed(2)})`);
      this.completeSession('Stop loss triggered');
      return false;
    }

    return true;
  }

  public pauseSession(): void {
    if (this.currentSession) {
      this.currentSession.status = 'paused';
      this.saveSession();
      console.log(`⏸️ Session paused: ${this.currentSession.sessionId}`);
    }
  }

  public resumeSession(): void {
    if (this.currentSession) {
      this.currentSession.status = 'active';
      this.saveSession();
      console.log(`▶️ Session resumed: ${this.currentSession.sessionId}`);
    }
  }

  private saveSession(): void {
    if (!this.currentSession) return;
    
    const sessionFile = path.join(this.sessionsDir, `${this.currentSession.sessionId}.json`);
    fs.writeFileSync(sessionFile, JSON.stringify(this.currentSession, null, 2));
  }

  private archiveSession(): void {
    if (!this.currentSession) return;

    // Move to completed directory
    const completedDir = './wallets/completed';
    if (!fs.existsSync(completedDir)) {
      fs.mkdirSync(completedDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveFile = path.join(completedDir, `${this.currentSession.sessionId}_${timestamp}.json`);
    fs.writeFileSync(archiveFile, JSON.stringify(this.currentSession, null, 2));

    // Create summary text file
    this.generateSessionSummary();

    console.log(`📦 Session archived: ${archiveFile}`);
  }

  private generateSessionSummary(): void {
    if (!this.currentSession) return;

    const session = this.currentSession;
    const roi = ((session.currentBalance - session.initialBalance) / session.initialBalance) * 100;
    const duration = session.endTime 
      ? ((session.endTime.getTime() - session.startTime.getTime()) / (1000 * 60 * 60)).toFixed(1)
      : 'N/A';

    const summary = `
TRADING SESSION SUMMARY
=======================

Session ID: ${session.sessionId}
Start Time: ${session.startTime.toLocaleString()}
End Time: ${session.endTime?.toLocaleString() || 'N/A'}
Duration: ${duration} hours

PERFORMANCE
-----------
Initial Balance: $${session.initialBalance.toFixed(2)}
Final Balance: $${session.currentBalance.toFixed(2)}
Total P&L: $${session.totalPnL.toFixed(2)}
ROI: ${roi.toFixed(2)}%
Max Drawdown: ${session.maxDrawdown.toFixed(2)}%

TRADING STATS
-------------
Total Trades: ${session.totalTrades}
Successful Trades: ${session.successfulTrades}
Win Rate: ${session.metrics.winRate.toFixed(1)}%
Largest Win: $${session.metrics.largestWin.toFixed(2)}
Largest Loss: $${session.metrics.largestLoss.toFixed(2)}

WALLET INFO
-----------
Public Key: ${session.wallet.publicKey}
Target Reached: ${session.targetReached ? 'YES' : 'NO'}

Generated: ${new Date().toISOString()}
`;

    const summaryFile = `./wallets/${session.sessionId}_summary.txt`;
    fs.writeFileSync(summaryFile, summary);
  }

  public getSessionStats(): any {
    const session = this.currentSession;
    if (!session) return null;

    const runTimeMinutes = (Date.now() - session.startTime.getTime()) / (1000 * 60);
    const roi = ((session.currentBalance - session.initialBalance) / session.initialBalance) * 100;

    return {
      sessionId: session.sessionId,
      runtime: runTimeMinutes,
      balance: session.currentBalance,
      roi: roi,
      trades: session.totalTrades,
      winRate: session.metrics.winRate,
      targetReached: session.targetReached,
      status: session.status
    };
  }
}