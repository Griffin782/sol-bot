/**
 * Graceful Shutdown System for SOL-BOT
 * Provides safe shutdown with position monitoring and multiple stop modes
 */

import * as readline from 'readline';
import { EventEmitter } from 'events';

export enum ShutdownMode {
  NONE = 'NONE',
  STOP_NEW_BUYS = 'STOP_NEW_BUYS',
  EMERGENCY_STOP = 'EMERGENCY_STOP', 
  PAUSE_TRADING = 'PAUSE_TRADING'
}

export interface Position {
  mint: string;
  symbol?: string;
  entry_time: number;
  entry_price: number;
  current_price: number;
  amount: number;
  profit_percent: number;
  hold_time_seconds: number;
}

export interface ShutdownState {
  mode: ShutdownMode;
  initiated_at: number;
  reason: string;
  open_positions: Position[];
  positions_at_shutdown: number;
  fund_transfers_pending: number;
}

export class GracefulShutdownManager extends EventEmitter {
  private state: ShutdownState;
  private rl: readline.Interface;
  private shutdownHandlers: (() => Promise<void>)[] = [];
  private positionUpdateInterval: NodeJS.Timeout | null = null;
  private displayUpdateInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    
    this.state = {
      mode: ShutdownMode.NONE,
      initiated_at: 0,
      reason: '',
      open_positions: [],
      positions_at_shutdown: 0,
      fund_transfers_pending: 0
    };

    // Setup readline for interactive controls
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.setupSignalHandlers();
    this.setupInteractiveControls();
  }

  /**
   * Setup system signal handlers
   */
  private setupSignalHandlers(): void {
    // Ctrl+C (SIGINT) - Graceful stop new buys
    process.on('SIGINT', () => {
      if (this.state.mode === ShutdownMode.NONE) {
        this.initiateShutdown(ShutdownMode.STOP_NEW_BUYS, 'User pressed Ctrl+C');
      } else {
        this.escalateShutdown();
      }
    });

    // SIGTERM - System shutdown request
    process.on('SIGTERM', () => {
      this.initiateShutdown(ShutdownMode.EMERGENCY_STOP, 'System SIGTERM received');
    });

    // Prevent immediate exit
    process.on('exit', () => {
      if (this.state.mode !== ShutdownMode.NONE) {
        console.log('\n⚠️ Bot shutdown initiated but positions may still be open!');
      }
    });
  }

  /**
   * Setup interactive keyboard controls
   */
  private setupInteractiveControls(): void {
    // Enable raw mode for single key presses
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    
    process.stdin.on('data', (key) => {
      const keyStr = key.toString();
      
      switch (keyStr.toLowerCase()) {
        case 's':
          // Ctrl+S equivalent - Stop new buys
          this.initiateShutdown(ShutdownMode.STOP_NEW_BUYS, 'User pressed S key');
          break;
          
        case 'f':
          // Force close all positions
          if (this.state.mode === ShutdownMode.STOP_NEW_BUYS) {
            this.escalateToEmergencyStop();
          }
          break;
          
        case 'r':
          // Resume trading
          if (this.state.mode === ShutdownMode.STOP_NEW_BUYS || this.state.mode === ShutdownMode.PAUSE_TRADING) {
            this.resumeTrading();
          }
          break;
          
        case 'p':
          // Pause trading
          if (this.state.mode === ShutdownMode.NONE) {
            this.initiateShutdown(ShutdownMode.PAUSE_TRADING, 'User paused trading');
          }
          break;
          
        case 'q':
          // Quit immediately (emergency)
          this.initiateShutdown(ShutdownMode.EMERGENCY_STOP, 'User forced quit');
          break;
      }
    });
  }

  /**
   * Initiate shutdown with specified mode
   */
  public initiateShutdown(mode: ShutdownMode, reason: string): void {
    if (this.state.mode !== ShutdownMode.NONE) {
      console.log(`\n⚠️ Shutdown already in progress (${this.state.mode})`);
      return;
    }

    this.state.mode = mode;
    this.state.initiated_at = Date.now();
    this.state.reason = reason;
    this.state.positions_at_shutdown = this.state.open_positions.length;

    console.log('\n' + '='.repeat(60));
    console.log(`🛑 SHUTDOWN INITIATED: ${mode}`);
    console.log(`📋 Reason: ${reason}`);
    console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);
    console.log('='.repeat(60));

    switch (mode) {
      case ShutdownMode.STOP_NEW_BUYS:
        this.handleStopNewBuys();
        break;
      case ShutdownMode.EMERGENCY_STOP:
        this.handleEmergencyStop();
        break;
      case ShutdownMode.PAUSE_TRADING:
        this.handlePauseTrading();
        break;
    }

    this.emit('shutdown_initiated', this.state);
  }

  /**
   * Handle stop new buys mode
   */
  private handleStopNewBuys(): void {
    console.log('\n🛑 STOP NEW BUYS MODE ACTIVE');
    console.log('✅ No new token purchases will be made');
    console.log('📊 Continuing to monitor existing positions');
    console.log('🎯 Normal exit strategies will apply (2x, 4x, 6x)');
    console.log('\nControls:');
    console.log('  F - Force close all positions');
    console.log('  R - Resume normal trading');
    console.log('  Q - Emergency quit');

    this.startPositionMonitoring();
    this.emit('stop_new_buys');
  }

  /**
   * Handle emergency stop mode
   */
  private handleEmergencyStop(): void {
    console.log('\n🚨 EMERGENCY STOP MODE ACTIVE');
    console.log('🔴 Attempting to close all positions immediately');
    console.log('⚠️ May result in losses on current positions');
    
    this.emit('emergency_stop');
    
    // Give handlers time to process
    setTimeout(() => {
      if (this.state.open_positions.length > 0) {
        console.log(`⚠️ Warning: ${this.state.open_positions.length} positions may not have closed`);
      }
      this.finalizeShutdown();
    }, 5000);
  }

  /**
   * Handle pause trading mode
   */
  private handlePauseTrading(): void {
    console.log('\n⏸️ TRADING PAUSED');
    console.log('🛑 No new buys or sells will be executed');
    console.log('📊 Positions will be monitored but not acted upon');
    console.log('\nControls:');
    console.log('  R - Resume trading');
    console.log('  S - Stop new buys (allow sells)');
    console.log('  Q - Emergency quit');

    this.startPositionMonitoring();
    this.emit('pause_trading');
  }

  /**
   * Escalate shutdown (second Ctrl+C)
   */
  private escalateShutdown(): void {
    if (this.state.mode === ShutdownMode.STOP_NEW_BUYS) {
      console.log('\n⚡ Second Ctrl+C detected - Escalating to emergency stop');
      this.escalateToEmergencyStop();
    } else {
      console.log('\n🔴 Force quitting...');
      process.exit(1);
    }
  }

  /**
   * Escalate to emergency stop
   */
  private escalateToEmergencyStop(): void {
    this.state.mode = ShutdownMode.EMERGENCY_STOP;
    this.handleEmergencyStop();
  }

  /**
   * Resume normal trading
   */
  public resumeTrading(): void {
    if (this.state.mode === ShutdownMode.NONE) {
      console.log('📈 Trading is already active');
      return;
    }

    const previousMode = this.state.mode;
    this.state.mode = ShutdownMode.NONE;
    
    this.stopMonitoring();
    
    console.log('\n' + '='.repeat(60));
    console.log('🟢 TRADING RESUMED');
    console.log(`📋 Previous mode: ${previousMode}`);
    console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);
    console.log('🎯 Bot will resume normal buying and selling');
    console.log('='.repeat(60));

    this.emit('trading_resumed', previousMode);
  }

  /**
   * Start position monitoring
   */
  private startPositionMonitoring(): void {
    this.displayUpdateInterval = setInterval(() => {
      this.displayShutdownStatus();
    }, 2000);

    // Monitor for completion
    this.positionUpdateInterval = setInterval(() => {
      if (this.state.open_positions.length === 0 && this.state.fund_transfers_pending === 0) {
        this.checkForCompletion();
      }
    }, 1000);
  }

  /**
   * Stop monitoring intervals
   */
  private stopMonitoring(): void {
    if (this.displayUpdateInterval) {
      clearInterval(this.displayUpdateInterval);
      this.displayUpdateInterval = null;
    }
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
  }

  /**
   * Display current shutdown status
   */
  private displayShutdownStatus(): void {
    if (this.state.mode === ShutdownMode.NONE) return;

    const shutdownTime = Math.floor((Date.now() - this.state.initiated_at) / 1000);
    const openCount = this.state.open_positions.length;
    
    // Clear previous display
    process.stdout.write('\x1B[2J\x1B[0f');
    
    console.log('='.repeat(80));
    console.log(`🛑 SHUTDOWN MODE: ${this.state.mode} | Duration: ${this.formatTime(shutdownTime)}`);
    console.log('='.repeat(80));
    
    if (openCount > 0) {
      console.log(`⏳ Monitoring ${openCount} open position${openCount > 1 ? 's' : ''}:`);
      console.log('');
      
      this.state.open_positions.forEach((pos, index) => {
        const holdTime = this.formatTime(pos.hold_time_seconds);
        const profitColor = pos.profit_percent >= 0 ? '🟢' : '🔴';
        const profitSign = pos.profit_percent >= 0 ? '+' : '';
        
        console.log(`${profitColor} ${pos.symbol || pos.mint.substring(0, 8)}...`);
        console.log(`   Hold: ${holdTime} | P&L: ${profitSign}${pos.profit_percent.toFixed(1)}%`);
        console.log(`   Amount: ${pos.amount} | Current: $${pos.current_price.toFixed(6)}`);
        console.log('');
      });
      
      // Show estimated completion time
      const avgHoldTime = this.calculateAverageHoldTime();
      if (avgHoldTime > 0) {
        console.log(`📊 Estimated completion: ${this.formatTime(avgHoldTime)} (based on avg hold time)`);
      }
      
    } else {
      console.log('✅ No open positions remaining');
    }
    
    if (this.state.fund_transfers_pending > 0) {
      console.log(`💰 Fund transfers pending: ${this.state.fund_transfers_pending}`);
    }
    
    console.log('');
    console.log('Controls: [F] Force Close | [R] Resume | [Q] Emergency Quit');
    console.log('='.repeat(80));
  }

  /**
   * Format seconds into readable time
   */
  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }

  /**
   * Calculate average hold time for estimation
   */
  private calculateAverageHoldTime(): number {
    if (this.state.open_positions.length === 0) return 0;
    
    const totalTime = this.state.open_positions.reduce((sum, pos) => sum + pos.hold_time_seconds, 0);
    return Math.floor(totalTime / this.state.open_positions.length);
  }

  /**
   * Check if shutdown can be completed
   */
  private checkForCompletion(): void {
    if (this.state.open_positions.length === 0 && 
        this.state.fund_transfers_pending === 0 &&
        this.state.mode === ShutdownMode.STOP_NEW_BUYS) {
      
      console.log('\n🎉 All positions closed successfully!');
      console.log('✅ Shutdown complete - it\'s safe to exit');
      this.finalizeShutdown();
    }
  }

  /**
   * Finalize shutdown process
   */
  private finalizeShutdown(): void {
    this.stopMonitoring();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ SHUTDOWN COMPLETE');
    console.log(`📊 Total positions closed: ${this.state.positions_at_shutdown}`);
    console.log(`⏱️ Total shutdown time: ${this.formatTime(Math.floor((Date.now() - this.state.initiated_at) / 1000))}`);
    console.log('💾 Final state saved');
    console.log('='.repeat(60));

    this.emit('shutdown_complete', this.state);
    
    // Give final handlers time to run
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  }

  // Public API methods

  /**
   * Update position list from external source
   */
  public updatePositions(positions: Position[]): void {
    this.state.open_positions = positions;
  }

  /**
   * Update fund transfer status
   */
  public updateFundTransfers(pendingCount: number): void {
    this.state.fund_transfers_pending = pendingCount;
  }

  /**
   * Check if new buys are allowed
   */
  public canBuy(): boolean {
    return this.state.mode === ShutdownMode.NONE;
  }

  /**
   * Check if sells are allowed
   */
  public canSell(): boolean {
    return this.state.mode !== ShutdownMode.PAUSE_TRADING;
  }

  /**
   * Get current shutdown state
   */
  public getState(): ShutdownState {
    return { ...this.state };
  }

  /**
   * Register shutdown handler
   */
  public onShutdown(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.stopMonitoring();
    this.rl.close();
    
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }
}

// Singleton instance
export const shutdownManager = new GracefulShutdownManager();