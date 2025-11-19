/**
 * Shared State Manager
 * Centralized state to avoid breaking global dependencies during modularization
 * Phase 4 - Modularization Step 1
 */

import { PositionMonitor } from "../monitoring/positionMonitor";
import { ExitStrategyEngine } from "../strategies/exitStrategy";
import { GrpcTokenDetection } from "../detection/grpcTokenDetection";
import { LifecycleIntegration } from "../monitoring/lifecycleIntegration";
import { HandledMint } from "../types";

export class SharedState {
  private static instance: SharedState;

  // Core systems
  public positionMonitor: PositionMonitor | null = null;
  public exitStrategyEngine: ExitStrategyEngine | null = null;
  public tokenDetector: GrpcTokenDetection | null = null;
  public lifecycleIntegration: LifecycleIntegration | null = null;

  // State tracking
  public handledMints: HandledMint[] = [];
  public cachedSolPrice: number = 218; // Fallback
  public activeTransactions: number = 0;

  private constructor() {
    console.log('[SharedState] Instance created');
  }

  static getInstance(): SharedState {
    if (!SharedState.instance) {
      SharedState.instance = new SharedState();
    }
    return SharedState.instance;
  }

  initialize(
    positionMonitor: PositionMonitor | null,
    exitStrategyEngine: ExitStrategyEngine | null,
    tokenDetector: GrpcTokenDetection | null
  ): void {
    this.positionMonitor = positionMonitor;
    this.exitStrategyEngine = exitStrategyEngine;
    this.tokenDetector = tokenDetector;
    console.log('[SharedState] Initialized with all dependencies');
    console.log(`[SharedState] - Position Monitor: ${positionMonitor ? 'Active' : 'Null'}`);
    console.log(`[SharedState] - Exit Strategy: ${exitStrategyEngine ? 'Active' : 'Null'}`);
    console.log(`[SharedState] - Token Detector: ${tokenDetector ? 'Active' : 'Null'}`);
  }

  updateSolPrice(price: number): void {
    this.cachedSolPrice = price;
    console.log(`[SharedState] SOL price updated: $${price}`);
  }

  incrementTransactions(): void {
    this.activeTransactions++;
  }

  decrementTransactions(): void {
    this.activeTransactions--;
  }

  addHandledMint(mint: string, provider: string): void {
    this.handledMints.push({ mint, provider });
  }

  isHandled(mint: string): boolean {
    return this.handledMints.some((item) => item.mint === mint);
  }

  removeHandledMint(mint: string): void {
    this.handledMints = this.handledMints.filter((item) => item.mint !== mint);
  }
}

// Export singleton instance
export const sharedState = SharedState.getInstance();
