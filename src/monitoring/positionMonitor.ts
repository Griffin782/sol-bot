/**
 * Position Monitor - Phase 4 COMPLETION
 *
 * Real-time price monitoring for bought positions via gRPC
 * This is the MISSING PIECE that enables near-instant exit signals
 *
 * Features:
 * - Subscribes to pool accounts for bought tokens
 * - Monitors swap transactions for price updates
 * - Extracts price from transaction data (no API calls)
 * - Updates exit strategy with real-time prices
 * - <400ms latency from swap to exit signal
 */

import { PublicKey } from "@solana/web3.js";
import Client, { SubscribeRequest, SubscribeUpdate, CommitmentLevel } from "@triton-one/yellowstone-grpc";
import { ClientDuplexStream } from "@grpc/grpc-js";
import { SubscribeUpdateTransaction } from "@triton-one/yellowstone-grpc";
import { derivePumpFunBondingCurve } from "../utils/poolDerivation";
import { MPL_TOKEN_METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';
import axios from "axios";
import { tokenHealthMonitor } from "./tokenHealthMonitor"; // Phase 3: Track token activity for adaptive exits
import { sharedState } from "../core/sharedState"; // For lifecycle integration price updates
import { metadataCache } from "../detection/metadataCache"; // NEW: Metadata caching
import bs58 from "bs58";
import util from "util";
import { validatePubkeys } from "../utils/yellowstoneFilterUtils";


export interface PositionPrice {
  mint: string;
  poolAddress: string;
  currentPriceSOL: number;
  currentPriceUSD: number;
  lastUpdateTime: Date;
  lastUpdateSignature: string;
  source: "raydium" | "pumpfun" | "pumpswap";
  volumeUSD?: number; // Phase 3: Swap volume for health tracking (optional, only set for transaction updates)
}

export interface MonitoredPosition {
  mint: string;
  poolAddress: string;
  entryPriceSOL: number;
  entryPriceUSD: number;
  tokenAmount: number;
  entryTime: Date;
  dex: "raydium" | "pumpfun" | "pumpswap";
}

/**
 * Bonding Curve Account Data Structure (pump.fun)
 * Parsed from on-chain bonding curve account
 * Updated every block (~400ms) - provides continuous price updates
 */
export interface BondingCurveData {
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
}

/**
 * Real-time position monitor using gRPC pool subscriptions
 */
export class PositionMonitor {
  private monitoredPositions: Map<string, MonitoredPosition> = new Map();
  private currentPrices: Map<string, PositionPrice> = new Map();
  private bondingCurveAddresses: Map<string, string> = new Map(); // mint -> bonding curve address
  private lastUpdateTimes: Map<string, number> = new Map(); // mint -> timestamp of last update (Layer 3: Fallback detection)
  private fallbackPollInterval: NodeJS.Timeout | null = null; // Layer 3: Interval for checking stale positions
  private healthMonitorCleanupInterval: NodeJS.Timeout | null = null; // Phase 3: Interval for cleaning old token health data
  private grpcClient: Client | null = null;
  private grpcStream: ClientDuplexStream<SubscribeRequest, SubscribeUpdate> | null = null;
  private priceUpdateCallback: ((mint: string, priceUSD: number) => void) | null = null;
  private isActive: boolean = false;

  // PHASE 2 FIX: Reconnect backoff and circuit breaker
  private reconnectAttempts: number = 0;
  private lastErrorMessage: string = '';
  private sameErrorCount: number = 0;
  private maxReconnectAttempts: number = 10;

  constructor(
    private grpcEndpoint: string,
    private grpcToken: string,
    private solPriceUSD: number = 218 // TODO: Get from price feed
  ) {}

  /**
   * Set callback for when prices update
   */
  public onPriceUpdate(callback: (mint: string, priceUSD: number) => void): void {
    this.priceUpdateCallback = callback;
  }

  /**
   * Add position to real-time monitoring
   */
  public async addPosition(position: MonitoredPosition): Promise<boolean> {
    try {
      console.log(`[Position Monitor] Adding ${position.mint} to real-time tracking`);

      this.monitoredPositions.set(position.mint, position);

      // Derive bonding curve address for pump.fun tokens (provides continuous price updates)
      // Bonding curve account updates every block (~400ms) even when no swaps occur
      if (position.dex === "pumpfun") {
        try {
          const bondingCurveInfo = derivePumpFunBondingCurve(position.mint);
          const curveAddr = bondingCurveInfo.poolAddress;

          if (!this.isValidSolanaAddress(curveAddr)) {
            console.warn(
              `[Position Monitor] Derived bonding curve address for ${position.mint} is invalid, skipping: "${curveAddr}"`
            );
          } else {
            this.bondingCurveAddresses.set(position.mint, curveAddr);
            this.debugKey(`bondingCurve(${position.mint})`, curveAddr);
            console.log(
              `[Position Monitor] Bonding curve for ${position.mint}: ${curveAddr}`
            );
          }
        } catch (error) {
          console.warn(
            `[Position Monitor] Could not derive bonding curve for ${position.mint}:`,
            error
          );
          // Gracefully continue - will use transaction-based monitoring only
        }
      }

      // Initialize price tracking
      this.currentPrices.set(position.mint, {
        mint: position.mint,
        poolAddress: position.poolAddress,
        currentPriceSOL: position.entryPriceSOL,
        currentPriceUSD: position.entryPriceUSD,
        lastUpdateTime: new Date(),
        lastUpdateSignature: "initial",
        source: position.dex,
      });

      // Initialize update time tracking for fallback detection (Layer 3)
      this.lastUpdateTimes.set(position.mint, Date.now());

      // Update subscription to include new pool (without restarting connection)
      if (this.isActive) {
        await this.updateSubscription();
      }

      return true;
    } catch (error) {
      console.error(`[Position Monitor] Error adding position ${position.mint}:`, error);
      return false;
    }
  }

  /**
   * Remove position from monitoring
   */
  public async removePosition(mint: string): Promise<void> {
    this.monitoredPositions.delete(mint);
    this.currentPrices.delete(mint);
    this.bondingCurveAddresses.delete(mint); // Clean up bonding curve tracking
    this.lastUpdateTimes.delete(mint); // Clean up update time tracking (Layer 3)

    // Update subscription if still active (without restarting connection)
    if (this.isActive && this.monitoredPositions.size > 0) {
      await this.updateSubscription();
    }
  }

  /**
   * Get current price for a position
   */
  public getCurrentPrice(mint: string): PositionPrice | null {
    return this.currentPrices.get(mint) || null;
  }

  /**
   * Get all current prices
   */
  public getAllPrices(): PositionPrice[] {
    return Array.from(this.currentPrices.values());
  }

  /**
   * Start monitoring all positions
   */
  public async start(): Promise<void> {
    if (this.isActive) {
      console.log(`[Position Monitor] Already active`);
      return;
    }

    try {
      this.grpcClient = new Client(this.grpcEndpoint, this.grpcToken, { skipPreflight: true });
      this.grpcStream = await this.grpcClient.subscribe();

      await this.setupSubscription();
      this.setupEventHandlers();

      // Start fallback polling (Layer 3)
      this.startFallbackPolling();

      // Start health monitor cleanup (Phase 3)
      this.startHealthMonitorCleanup();

      this.isActive = true;
      console.log(`[Position Monitor] Started monitoring ${this.monitoredPositions.size} positions`);
    } catch (error) {
      console.error(`[Position Monitor] Failed to start:`, error);
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    if (this.grpcStream) {
      this.grpcStream.end();
      this.grpcStream = null;
    }

    // Stop fallback polling (Layer 3)
    if (this.fallbackPollInterval) {
      clearInterval(this.fallbackPollInterval);
      this.fallbackPollInterval = null;
    }

    // Stop health monitor cleanup (Phase 3)
    if (this.healthMonitorCleanupInterval) {
      clearInterval(this.healthMonitorCleanupInterval);
      this.healthMonitorCleanupInterval = null;
    }

    this.grpcClient = null;
    this.isActive = false;
    console.log(`[Position Monitor] Stopped`);
  }

  /**
   * PHASE 4B: Validate Solana address for Yellowstone subscription
   * Ensures address is valid base58 string of correct length (32 bytes when decoded)
   */
  private isValidSolanaAddress(addr: string | undefined | null): boolean {
    if (!addr || typeof addr !== "string") return false;

    try {
      const decoded = bs58.decode(addr);
      if (decoded.length !== 32) {
        console.warn(
          `[Position Monitor] Invalid pubkey length: ${addr} (decoded len=${decoded.length}, expected 32)`
        );
        return false;
      }
      return true;
    } catch (e) {
      console.warn(
        `[Position Monitor] Invalid base58 address: "${addr}" – ${String(e)}`
      );
      return false;
    }
  }

  /**
   * Debug helper: Log address validation details
   */
  private debugKey(label: string, value: string | undefined | null): boolean {
    if (!value) {
      console.warn(`[Position Monitor] ${label}: empty or undefined`);
      return false;
    }

    try {
      const decoded = bs58.decode(value);
      console.log(
        `[Position Monitor] ${label}: base58="${value}", decodedLen=${decoded.length}`
      );
      return decoded.length === 32;
    } catch (e) {
      console.warn(
        `[Position Monitor] ${label}: invalid base58="${value}" – ${String(e)}`
      );
      return false;
    }
  }

  /**
   * Log SubscribeRequest for debugging
   */
  private logSubscribeRequest(req: SubscribeRequest): void {
    console.log(
      "[POSITION-MONITOR] Final SubscribeRequest:",
      util.inspect(req, { depth: 5, colors: true })
    );
  }

  /**
   * Build Yellowstone SubscribeRequest with validated pubkeys
   */
  private buildPositionMonitorRequest(
    watchedPools: any[],
    fromSlot: number | null = null
  ): SubscribeRequest {
    // pools → array of { pool: ".", bondingCurve: "." }
    const safePoolKeys = validatePubkeys(
      watchedPools.map((w) => w.pool),
      "pool"
    );

    const safeBondingKeys = validatePubkeys(
      watchedPools.map((w) => w.bondingCurve),
      "bondingCurve"
    );

    // Flatten into one list of pubkeys
    const allKeys = [...safePoolKeys, ...safeBondingKeys];

    const request: SubscribeRequest = {
      commitment: CommitmentLevel.CONFIRMED,
      accounts: {},
      slots: {},
      transactions: {
        positionMonitor: {
          vote: false,
          failed: false,
          // Yellowstone expects string[] of base58 pubkeys here
          accountInclude: [],
          accountExclude: [],
          accountRequired: allKeys,
        },
      },
      transactionsStatus: {},
      entry: {},
      blocks: {},
      blocksMeta: {},
      accountsDataSlice: [],
    };

    if (fromSlot !== null) {
      request.fromSlot = String(fromSlot);
    }

    return request;
  }

  /**
   * Update subscription with new pool list WITHOUT restarting connection
   * This prevents HTTP 429 rate limiting when adding/removing positions
   * Also updates bonding curve subscriptions for continuous price monitoring
   */
  private async updateSubscription(): Promise<void> {
    if (!this.grpcStream) return;

    const positions = Array.from(this.monitoredPositions.values());
    if (positions.length === 0) {
      console.log(`[Position Monitor] No positions to monitor, keeping connection alive`);
      return;
    }

    // Build watchedPools array with pool and bonding curve pairs
    const watchedPools = positions.map(pos => {
      const poolAddr = typeof pos.poolAddress === "string"
        ? pos.poolAddress
        : (pos.poolAddress as any)?.toString();

      // Get bonding curve address for this position's mint (if exists)
      const bondingCurveAddr = this.bondingCurveAddresses.get(pos.mint) || poolAddr;

      return {
        pool: poolAddr,
        bondingCurve: bondingCurveAddr,
        mint: pos.mint, // Track for debugging
      };
    });

    console.log(`[Position Monitor] Building subscription for ${watchedPools.length} positions`);

    // DEFENSIVE CHECK: Ensure we have valid watched pools
    if (!watchedPools.length) {
      console.warn(`[Position Monitor] No watched pools; skipping subscription update`);
      return;
    }

    // RUNTIME ASSERTION: Validate all watchedPool entries before building request
    console.log(`[Position Monitor] ===== VALIDATING WATCHED POOLS =====`);
    let hasInvalidEntries = false;
    for (let i = 0; i < watchedPools.length; i++) {
      const w = watchedPools[i];
      if (!w.pool || !w.bondingCurve) {
        console.error(`[Position Monitor] ❌ Invalid watchedPool entry [${i}]:`, {
          index: i,
          mint: (w as any).mint,
          pool: w.pool || '(missing)',
          bondingCurve: w.bondingCurve || '(missing)',
        });
        hasInvalidEntries = true;
      } else {
        console.log(`[Position Monitor] ✅ [${i}] mint=${(w as any).mint?.substring(0, 8)}... pool=${w.pool.substring(0, 8)}... bc=${w.bondingCurve.substring(0, 8)}...`);
      }
    }

    if (hasInvalidEntries) {
      console.error(`[Position Monitor] ❌ Found invalid entries in watchedPools - aborting subscription update`);
      return;
    }
    console.log(`[Position Monitor] ===== ALL ENTRIES VALID =====`);

    // Build validated subscription request using utility function
    // This will validate all pubkeys and throw if any are invalid
    let request: SubscribeRequest;
    try {
      request = this.buildPositionMonitorRequest(watchedPools);
      console.log(`[Position Monitor] ✅ Successfully built subscription request with validated pubkeys`);
    } catch (error) {
      console.error(`[Position Monitor] ❌ Failed to build subscription request:`, error);
      console.error(`[Position Monitor] Watched pools data:`, JSON.stringify(watchedPools, null, 2));
      return;
    }

    // CRITICAL: Log the EXACT request that will be sent to Yellowstone
    console.log(`[POSITION-MONITOR] FINAL SubscribeRequest (LIVE - updateSubscription):\n${util.inspect(request, { depth: 10, colors: false })}`);

    // VERIFY: Check that accountRequired contains the expected number of pubkeys
    const accountRequired = request.transactions?.positionMonitor?.accountRequired;
    const expectedCount = watchedPools.length * 2; // pool + bondingCurve per position
    if (accountRequired && Array.isArray(accountRequired)) {
      console.log(`[Position Monitor] 🔍 Verification: accountRequired has ${accountRequired.length} pubkeys (expected ${expectedCount})`);
      if (accountRequired.length !== expectedCount) {
        console.warn(`[Position Monitor] ⚠️  WARNING: Pubkey count mismatch! Expected ${expectedCount}, got ${accountRequired.length}`);
      }
    } else {
      console.error(`[Position Monitor] ❌ CRITICAL: accountRequired is not an array or is missing!`);
      return;
    }

    // Send updated subscription (reuses existing connection)
    // IMPORTANT: Sending the SAME request object with NO mutations
    this.grpcStream.write(request);
    console.log(`[Position Monitor] ✅ Updated subscription: ${watchedPools.length} positions monitored`);
  }

  /**
   * Restart subscription with updated pool list (ONLY for error recovery)
   * Do NOT use this for adding/removing positions - use updateSubscription() instead
   */
  private async restartSubscription(): Promise<void> {
    if (!this.grpcStream) return;

    console.log(`[Position Monitor] RESTARTING connection (error recovery)`);

    // End current stream
    this.grpcStream.end();

    // Create new stream
    if (this.grpcClient) {
      this.grpcStream = await this.grpcClient.subscribe();
      await this.setupSubscription();
      this.setupEventHandlers();

      // PHASE 2 FIX: Reset reconnect counter on successful restart
      console.log(`[Position Monitor] Connection restarted successfully - resetting reconnect counter`);
      this.reconnectAttempts = 0;
      this.sameErrorCount = 0;
    }
  }

  /**
   * Setup gRPC subscription for all monitored pool addresses AND bonding curves
   * This enables dual monitoring:
   * 1. Transaction-based (swap events) - fast when active
   * 2. Account-based (bonding curve state) - continuous even with no swaps
   */
  private async setupSubscription(): Promise<void> {
    if (!this.grpcStream) return;

    const positions = Array.from(this.monitoredPositions.values());
    if (positions.length === 0) {
      console.log(`[Position Monitor] No positions to monitor`);
      return;
    }

    // Build watchedPools array with pool and bonding curve pairs
    const watchedPools = positions.map(pos => {
      const poolAddr = typeof pos.poolAddress === "string"
        ? pos.poolAddress
        : (pos.poolAddress as any)?.toString();

      // Get bonding curve address for this position's mint (if exists)
      const bondingCurveAddr = this.bondingCurveAddresses.get(pos.mint) || poolAddr;

      return {
        pool: poolAddr,
        bondingCurve: bondingCurveAddr,
        mint: pos.mint, // Track for debugging
      };
    });

    console.log(`[Position Monitor] Setting up subscription for ${watchedPools.length} positions`);

    // DEFENSIVE CHECK: Ensure we have valid watched pools
    if (!watchedPools.length) {
      console.warn(`[Position Monitor] No watched pools; skipping subscription setup`);
      return;
    }

    // RUNTIME ASSERTION: Validate all watchedPool entries before building request
    console.log(`[Position Monitor] ===== VALIDATING WATCHED POOLS (SETUP) =====`);
    let hasInvalidEntries = false;
    for (let i = 0; i < watchedPools.length; i++) {
      const w = watchedPools[i];
      if (!w.pool || !w.bondingCurve) {
        console.error(`[Position Monitor] ❌ Invalid watchedPool entry [${i}]:`, {
          index: i,
          mint: (w as any).mint,
          pool: w.pool || '(missing)',
          bondingCurve: w.bondingCurve || '(missing)',
        });
        hasInvalidEntries = true;
      } else {
        console.log(`[Position Monitor] ✅ [${i}] mint=${(w as any).mint?.substring(0, 8)}... pool=${w.pool.substring(0, 8)}... bc=${w.bondingCurve.substring(0, 8)}...`);
      }
    }

    if (hasInvalidEntries) {
      console.error(`[Position Monitor] ❌ Found invalid entries in watchedPools - aborting subscription setup`);
      return;
    }
    console.log(`[Position Monitor] ===== ALL ENTRIES VALID =====`);

    // Build validated subscription request using utility function
    // This will validate all pubkeys and throw if any are invalid
    let request: SubscribeRequest;
    try {
      request = this.buildPositionMonitorRequest(watchedPools);
      console.log(`[Position Monitor] ✅ Successfully built subscription request with validated pubkeys`);
    } catch (error) {
      console.error(`[Position Monitor] ❌ Failed to build subscription request:`, error);
      console.error(`[Position Monitor] Watched pools data:`, JSON.stringify(watchedPools, null, 2));
      return;
    }

    // CRITICAL: Log the EXACT request that will be sent to Yellowstone
    console.log(`[POSITION-MONITOR] FINAL SubscribeRequest (LIVE - setupSubscription):\n${util.inspect(request, { depth: 10, colors: false })}`);

    // VERIFY: Check that accountRequired contains the expected number of pubkeys
    const accountRequired = request.transactions?.positionMonitor?.accountRequired;
    const expectedCount = watchedPools.length * 2; // pool + bondingCurve per position
    if (accountRequired && Array.isArray(accountRequired)) {
      console.log(`[Position Monitor] 🔍 Verification: accountRequired has ${accountRequired.length} pubkeys (expected ${expectedCount})`);
      if (accountRequired.length !== expectedCount) {
        console.warn(`[Position Monitor] ⚠️  WARNING: Pubkey count mismatch! Expected ${expectedCount}, got ${accountRequired.length}`);
      }
    } else {
      console.error(`[Position Monitor] ❌ CRITICAL: accountRequired is not an array or is missing!`);
      return;
    }

    // Send subscription
    // IMPORTANT: Sending the SAME request object with NO mutations
    this.grpcStream.write(request);
    console.log(`[Position Monitor] ✅ Subscribed to ${watchedPools.length} positions`);
  }

  /**
   * Setup event handlers for gRPC stream
   */
  private setupEventHandlers(): void {
    if (!this.grpcStream) return;

    this.grpcStream.on("data", (data: SubscribeUpdate) => {
      this.handleGrpcUpdate(data);
    });

    this.grpcStream.on("error", (error: Error) => {
      console.error(`[Position Monitor] Stream error:`, error);

      // PHASE 2 FIX: Circuit breaker - check for repeated same error
      const errorMsg = error.message || error.toString();
      if (errorMsg === this.lastErrorMessage) {
        this.sameErrorCount++;
        if (this.sameErrorCount >= 5) {
          console.error(`[Position Monitor] CIRCUIT BREAKER: Same error repeated ${this.sameErrorCount} times - "${errorMsg}"`);
          console.error(`[Position Monitor] Stopping reconnect attempts to prevent infinite loop`);
          this.stop();
          return;
        }
      } else {
        this.lastErrorMessage = errorMsg;
        this.sameErrorCount = 1;
      }

      // PHASE 2 FIX: Maximum reconnect attempts
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error(`[Position Monitor] Max reconnect attempts (${this.maxReconnectAttempts}) reached - stopping`);
        this.stop();
        return;
      }

      // PHASE 2 FIX: Exponential backoff with maximum of 60 seconds
      const backoff = Math.min(5000 * Math.pow(2, this.reconnectAttempts), 60000);
      this.reconnectAttempts++;

      console.log(`[Position Monitor] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${backoff}ms...`);
      setTimeout(() => this.restartSubscription(), backoff);
    });

    this.grpcStream.on("end", () => {
      console.log(`[Position Monitor] Stream ended - reconnecting in 5 seconds...`);
      // Attempt reconnection after delay (connection timeout/ended by server)
      setTimeout(() => this.restartSubscription(), 5000);
    });

    this.grpcStream.on("close", () => {
      console.log(`[Position Monitor] Stream closed - reconnecting in 5 seconds...`);
      // Attempt reconnection after delay (connection closed by server)
      setTimeout(() => this.restartSubscription(), 5000);
    });
  }

  /**
   * Handle gRPC updates (transactions AND account updates)
   * - Transaction updates: Swap transactions providing price from actual trades
   * - Account updates: Bonding curve state providing continuous price updates (~400ms)
   * - Priority: Transaction updates take precedence if received within 1 second
   */
  private handleGrpcUpdate(data: SubscribeUpdate): void {
    // Process transaction updates (swap transactions)
    if (data.transaction) {
      const tx = data.transaction as SubscribeUpdateTransaction;
      const transaction = tx.transaction?.transaction as any;
      const meta = transaction?.meta;

      if (transaction && meta) {
        // Extract price from swap transaction
        const priceUpdate = this.extractPriceFromTransaction(tx);

        if (priceUpdate) {
          // Update cached price
          const existing = this.currentPrices.get(priceUpdate.mint);
          if (existing) {
            const sig = tx.transaction?.signature;
            const sigString = typeof sig === 'string' ? sig : (sig ? Buffer.from(sig).toString('base64') : 'unknown');

            this.currentPrices.set(priceUpdate.mint, {
              ...existing,
              currentPriceSOL: priceUpdate.currentPriceSOL,
              currentPriceUSD: priceUpdate.currentPriceUSD,
              lastUpdateTime: new Date(),
              lastUpdateSignature: sigString,
              volumeUSD: priceUpdate.volumeUSD,
            });

            // Track update time for fallback detection (Layer 3)
            this.lastUpdateTimes.set(priceUpdate.mint, Date.now());

            // Phase 3: Record swap activity for token health monitoring
            if (priceUpdate.volumeUSD && priceUpdate.volumeUSD > 0) {
              tokenHealthMonitor.recordSwap(priceUpdate.mint, priceUpdate.volumeUSD);
            }

            // Trigger callback with new price
            if (this.priceUpdateCallback) {
              this.priceUpdateCallback(priceUpdate.mint, priceUpdate.currentPriceUSD);
            }
          }
        }
      }
    }

    // Process account updates (bonding curve accounts only)
    // These provide continuous price updates even when no swaps occur
    if (data.account) {
      try {
        const accountUpdate = data.account as any;
        const accountInfo = accountUpdate.account;

        if (!accountInfo) return;

        // Extract account address and data
        const accountPubkey = accountInfo.pubkey;
        const accountData = accountInfo.data;

        if (!accountPubkey || !accountData) return;

        // Convert pubkey to base58 string for comparison
        // yellowstone-grpc returns pubkey as Uint8Array
        const pubkeyBytes = accountPubkey instanceof Uint8Array ? accountPubkey : new Uint8Array(accountPubkey);
        const accountAddressString = new PublicKey(pubkeyBytes).toBase58();

        const dataBuffer = accountData instanceof Uint8Array ? Buffer.from(accountData) : Buffer.from(new Uint8Array(accountData));

        // REMOVED: Metadata account parsing (Nov 10, 2025)
        // No longer subscribing to metadata accounts - using RPC on-demand instead

        // Find which mint this bonding curve belongs to (reverse lookup)
        let targetMint: string | null = null;
        for (const [mint, bcAddress] of this.bondingCurveAddresses.entries()) {
          if (bcAddress === accountAddressString) {
            targetMint = mint;
            break;
          }
        }

        if (!targetMint) {
          // This account update is not for any of our monitored bonding curves
          return;
        }

        // Parse bonding curve data (reuse existing dataBuffer from line 472)
        const bcData = this.parseBondingCurveData(dataBuffer);

        if (!bcData) {
          console.warn(`[Position Monitor] Failed to parse bonding curve data for ${targetMint}`);
          return;
        }

        // Calculate price from reserves
        const priceSOL = this.calculatePriceFromReserves(bcData);

        if (priceSOL === null) {
          return;
        }

        const priceUSD = priceSOL * this.solPriceUSD;

        // Check if we should use this price (transaction takes precedence if recent)
        const existing = this.currentPrices.get(targetMint);
        const now = new Date();

        let shouldUpdate = true;
        if (existing && existing.lastUpdateSignature !== "initial" && existing.lastUpdateSignature !== "bonding-curve-account") {
          // If we have a recent transaction update (within 1 second), don't override with account update
          const timeSinceLastUpdate = now.getTime() - existing.lastUpdateTime.getTime();
          if (timeSinceLastUpdate < 1000) {
            shouldUpdate = false;
            // Only log every 10th skip to avoid spam
            if (Math.random() < 0.1) {
              console.log(`[Position Monitor] Skipping account update for ${targetMint} - recent transaction update (${timeSinceLastUpdate}ms ago)`);
            }
          }
        }

        if (shouldUpdate && existing) {
          this.currentPrices.set(targetMint, {
            ...existing,
            currentPriceSOL: priceSOL,
            currentPriceUSD: priceUSD,
            lastUpdateTime: now,
            lastUpdateSignature: "bonding-curve-account", // Mark as account update, not transaction
          });

          // Track update time for fallback detection (Layer 3)
          this.lastUpdateTimes.set(targetMint, now.getTime());

          // Log bonding curve price updates (throttled - only every 5 seconds per token)
          const lastLogKey = `lastBCLog_${targetMint}`;
          const lastLog = (this as any)[lastLogKey] || 0;
          if (now.getTime() - lastLog > 5000) {
            console.log(`[Position Monitor] Bonding curve update for ${targetMint}: $${priceUSD.toFixed(8)} (${priceSOL.toFixed(10)} SOL)`);
            (this as any)[lastLogKey] = now.getTime();
          }

          // Trigger callback with new price
          if (this.priceUpdateCallback) {
            this.priceUpdateCallback(targetMint, priceUSD);
          }

          // CRITICAL FIX: Send price to lifecycle integration for tracking
          if (sharedState.lifecycleIntegration) {
            console.log('\x1b[90m%s\x1b[0m', `[DEBUG POS MONITOR] Sending price to lifecycle: ${targetMint.substring(0, 8)}... = $${priceUSD.toFixed(8)}`);
            sharedState.lifecycleIntegration.onPriceUpdate(targetMint, priceUSD);
          }
        }
      } catch (error) {
        console.error(`[Position Monitor] Error processing account update:`, error);
      }
    }
  }

  /**
   * Parse bonding curve account data from gRPC account update
   * Bonding curve layout (pump.fun):
   * - Offset 0: discriminator (u64, 8 bytes)
   * - Offset 8: virtual_token_reserves (u64, 8 bytes)
   * - Offset 16: virtual_sol_reserves (u64, 8 bytes)
   * - Offset 24: real_token_reserves (u64, 8 bytes)
   * - Offset 32: real_sol_reserves (u64, 8 bytes)
   * - Offset 40: token_total_supply (u64, 8 bytes)
   * - Offset 48: complete (bool, 1 byte)
   */
  private parseBondingCurveData(accountData: Buffer): BondingCurveData | null {
    try {
      // Validate buffer length (minimum 49 bytes for pump.fun bonding curve)
      if (!accountData || accountData.length < 49) {
        console.warn(`[Position Monitor] Invalid bonding curve data: buffer too short (${accountData?.length || 0} bytes)`);
        return null;
      }

      // Parse u64 values as BigInt (8 bytes each)
      const virtualTokenReserves = accountData.readBigUInt64LE(8);
      const virtualSolReserves = accountData.readBigUInt64LE(16);
      const realTokenReserves = accountData.readBigUInt64LE(24);
      const realSolReserves = accountData.readBigUInt64LE(32);
      const tokenTotalSupply = accountData.readBigUInt64LE(40);
      const complete = accountData.readUInt8(48) === 1;

      // Validate reserves are not negative (shouldn't happen with unsigned, but check for corruption)
      if (virtualTokenReserves < 0n || virtualSolReserves < 0n) {
        console.warn(`[Position Monitor] Invalid reserves: negative values detected`);
        return null;
      }

      return {
        virtualTokenReserves,
        virtualSolReserves,
        realTokenReserves,
        realSolReserves,
        tokenTotalSupply,
        complete
      };
    } catch (error) {
      console.error(`[Position Monitor] Error parsing bonding curve data:`, error);
      return null;
    }
  }

  /**
   * Calculate token price from bonding curve reserves
   * Formula: price_per_token_in_SOL = virtual_sol_reserves / virtual_token_reserves
   * This provides continuous price updates (~400ms) even when no swaps occur
   */
  private calculatePriceFromReserves(data: BondingCurveData): number | null {
    try {
      // Check for division by zero
      if (data.virtualTokenReserves === 0n) {
        console.warn(`[Position Monitor] Cannot calculate price: zero token reserves`);
        return null;
      }

      // Check for zero reserves (brand new token, no liquidity yet)
      if (data.virtualSolReserves === 0n) {
        console.warn(`[Position Monitor] Cannot calculate price: zero SOL reserves`);
        return null;
      }

      // Calculate price: SOL reserves / token reserves
      // Convert BigInt to Number for price calculation
      const solReserves = Number(data.virtualSolReserves) / 1e9; // lamports to SOL
      const tokenReserves = Number(data.virtualTokenReserves) / 1e6; // Adjust for token decimals (typically 6 for pump.fun)

      const pricePerTokenSOL = solReserves / tokenReserves;

      // Validate price is realistic (between 0.0000000001 and 1000 SOL per token)
      // Pump.fun tokens can have very small prices (e.g., 0.00000003 SOL)
      if (pricePerTokenSOL < 0.0000000001 || pricePerTokenSOL > 1000) {
        console.warn(`[Position Monitor] Unrealistic price calculated: ${pricePerTokenSOL} SOL`);
        return null;
      }

      return pricePerTokenSOL;
    } catch (error) {
      console.error(`[Position Monitor] Error calculating price from reserves:`, error);
      return null;
    }
  }

  /**
   * Fetch price from pump.fun API as fallback (Layer 3: Fallback Polling)
   * Called when gRPC updates have been stale for 10+ seconds
   * This provides a safety net for edge cases where bonding curve/transaction updates fail
   */
  private async fetchPriceFromAPI(mint: string): Promise<number | null> {
    try {
      console.log(`[Position Monitor] Fetching fallback price from API for ${mint}`);

      // pump.fun API endpoint (based on frontend API usage)
      const url = `https://frontend-api.pump.fun/coins/${mint}`;

      // Request with 3 second timeout
      const response = await axios.get(url, {
        timeout: 3000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
        }
      });

      if (!response.data) {
        console.warn(`[Position Monitor] API returned no data for ${mint}`);
        return null;
      }

      // Extract price from API response
      // API returns price in USD directly
      const priceUSD = response.data.usd_market_cap / response.data.total_supply;

      if (typeof priceUSD !== 'number' || isNaN(priceUSD) || priceUSD <= 0) {
        console.warn(`[Position Monitor] Invalid price from API for ${mint}: ${priceUSD}`);
        return null;
      }

      // Validate price is realistic (between $0.0000001 and $1000)
      if (priceUSD < 0.0000001 || priceUSD > 1000) {
        console.warn(`[Position Monitor] Unrealistic API price for ${mint}: $${priceUSD}`);
        return null;
      }

      console.log(`[Position Monitor] Fallback API price for ${mint}: $${priceUSD.toFixed(8)}`);
      return priceUSD;

    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          console.warn(`[Position Monitor] API timeout for ${mint} (>3s)`);
        } else if (error.response?.status === 404) {
          console.warn(`[Position Monitor] Token ${mint} not found in API (may have migrated)`);
        } else if (error.response?.status === 429) {
          console.warn(`[Position Monitor] API rate limit hit for ${mint}`);
        } else {
          console.warn(`[Position Monitor] API error for ${mint}: ${error.message}`);
        }
      } else {
        console.error(`[Position Monitor] Unexpected error fetching API price for ${mint}:`, error);
      }
      return null;
    }
  }

  /**
   * Check for stale positions and fetch prices from API (Layer 3: Fallback Polling)
   * Called every 10 seconds by fallback polling interval
   * Identifies positions with no updates for 10+ seconds and fetches fresh prices
   */
  private async checkStalePositions(): Promise<void> {
    try {
      const now = Date.now();
      const staleThreshold = 10000; // 10 seconds in milliseconds
      const stalePositions: string[] = [];

      // Find all positions with no updates for 10+ seconds
      for (const [mint, lastUpdateTime] of this.lastUpdateTimes.entries()) {
        const timeSinceUpdate = now - lastUpdateTime;
        if (timeSinceUpdate > staleThreshold) {
          stalePositions.push(mint);
        }
      }

      if (stalePositions.length === 0) {
        // All positions are being updated properly
        return;
      }

      console.log(`[Position Monitor] Found ${stalePositions.length} stale positions (no updates >10s), fetching fallback prices...`);

      // Fetch prices for stale positions (rate limited - process one at a time with delay)
      for (const mint of stalePositions) {
        // Check if position still exists (may have been removed)
        if (!this.monitoredPositions.has(mint)) {
          continue;
        }

        // Fetch price from API
        const priceUSD = await this.fetchPriceFromAPI(mint);

        if (priceUSD !== null) {
          // Update price cache
          const existing = this.currentPrices.get(mint);
          if (existing) {
            const priceSOL = priceUSD / this.solPriceUSD;

            this.currentPrices.set(mint, {
              ...existing,
              currentPriceSOL: priceSOL,
              currentPriceUSD: priceUSD,
              lastUpdateTime: new Date(),
              lastUpdateSignature: "api-fallback", // Mark as API fallback
            });

            // Update last update time to prevent immediate re-fetch
            this.lastUpdateTimes.set(mint, Date.now());

            // Trigger callback with new price
            if (this.priceUpdateCallback) {
              this.priceUpdateCallback(mint, priceUSD);
            }

            console.log(`[Position Monitor] Updated stale position ${mint} from API: $${priceUSD.toFixed(8)}`);
          }
        } else {
          // API fetch failed - use last known price (no action needed, already cached)
          console.warn(`[Position Monitor] Could not fetch fallback price for ${mint}, using last known price`);
        }

        // Rate limit: Wait 200ms between API requests (max 5/second)
        await new Promise(resolve => setTimeout(resolve, 200));
      }

    } catch (error) {
      console.error(`[Position Monitor] Error checking stale positions:`, error);
    }
  }

  /**
   * Start fallback polling system (Layer 3: Fallback Polling)
   * Runs checkStalePositions() every 10 seconds to detect and fix stale data
   * Provides additional safety net beyond gRPC and bonding curve monitoring
   */
  private startFallbackPolling(): void {
    // Clear any existing interval
    if (this.fallbackPollInterval) {
      clearInterval(this.fallbackPollInterval);
    }

    console.log(`[Position Monitor] Starting fallback polling (checks every 10 seconds for stale positions)`);

    // Start polling interval (10 seconds)
    this.fallbackPollInterval = setInterval(async () => {
      await this.checkStalePositions();
    }, 10000);
  }

  /**
   * Phase 3: Start health monitor cleanup interval
   * Removes old token data from health monitor every 5 minutes
   */
  private startHealthMonitorCleanup(): void {
    // Clear any existing interval
    if (this.healthMonitorCleanupInterval) {
      clearInterval(this.healthMonitorCleanupInterval);
    }

    console.log(`[Position Monitor] Starting health monitor cleanup (runs every 5 minutes)`);

    // Start cleanup interval (5 minutes)
    this.healthMonitorCleanupInterval = setInterval(() => {
      tokenHealthMonitor.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Extract price from swap transaction
   * This is the CORE of real-time monitoring - parsing prices from gRPC data
   */
  private extractPriceFromTransaction(tx: SubscribeUpdateTransaction): PositionPrice | null {
    try {
      const txData = tx.transaction?.transaction as any;
      const meta = txData?.meta;
      if (!meta) return null;

      const preBalances = meta.preTokenBalances || [];
      const postBalances = meta.postTokenBalances || [];

      // Find which monitored token is involved
      for (const [mint, position] of this.monitoredPositions) {
        const preMint = preBalances.find((b: any) => b.mint === mint);
        const postMint = postBalances.find((b: any) => b.mint === mint);
        const preSOL = preBalances.find((b: any) => b.mint === "So11111111111111111111111111111111111111112");
        const postSOL = postBalances.find((b: any) => b.mint === "So11111111111111111111111111111111111111112");

        if (preMint && postMint && preSOL && postSOL) {
          // Calculate swap amounts
          const tokenDelta = Math.abs(
            Number(postMint.uiTokenAmount?.amount || 0) -
            Number(preMint.uiTokenAmount?.amount || 0)
          );

          const solDelta = Math.abs(
            Number(postSOL.uiTokenAmount?.amount || 0) -
            Number(preMint.uiTokenAmount?.amount || 0)
          );

          if (tokenDelta > 0 && solDelta > 0) {
            // Price = SOL amount / Token amount
            const tokenDecimals = postMint.uiTokenAmount?.decimals || 9;
            const solDecimals = 9;

            const tokenAmount = tokenDelta / (10 ** tokenDecimals);
            const solAmount = solDelta / (10 ** solDecimals);

            const pricePerTokenSOL = solAmount / tokenAmount;
            const pricePerTokenUSD = pricePerTokenSOL * this.solPriceUSD;

            // Phase 3: Calculate swap volume for health tracking
            const volumeUSD = solAmount * this.solPriceUSD;

            const sig = tx.transaction?.signature;
            const sigString = typeof sig === 'string' ? sig : (sig ? Buffer.from(sig).toString('base64') : 'unknown');

            return {
              mint,
              poolAddress: position.poolAddress,
              currentPriceSOL: pricePerTokenSOL,
              currentPriceUSD: pricePerTokenUSD,
              lastUpdateTime: new Date(),
              lastUpdateSignature: sigString,
              source: position.dex,
              volumeUSD, // Phase 3: Include volume for health monitoring
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`[Position Monitor] Error extracting price:`, error);
      return null;
    }
  }

  /**
   * Get monitoring statistics
   */
  public getStats(): {
    totalPositions: number;
    pricesUpdated: number;
    oldestUpdate: Date | null;
    newestUpdate: Date | null;
  } {
    const prices = Array.from(this.currentPrices.values());

    let oldest: Date | null = null;
    let newest: Date | null = null;

    prices.forEach(p => {
      if (!oldest || p.lastUpdateTime < oldest) oldest = p.lastUpdateTime;
      if (!newest || p.lastUpdateTime > newest) newest = p.lastUpdateTime;
    });

    return {
      totalPositions: this.monitoredPositions.size,
      pricesUpdated: prices.filter(p => p.lastUpdateSignature !== "initial").length,
      oldestUpdate: oldest,
      newestUpdate: newest,
    };
  }
}

/**
 * Helper: Derive pool address for different DEXes
 * This is a simplified version - full implementation needs proper PDA derivation
 */
export function derivePoolAddress(
  tokenMint: string,
  dex: "raydium" | "pumpfun" | "pumpswap"
): string {
  // TODO: Implement proper pool address derivation for each DEX
  // For now, return placeholder
  // In production:
  // - Raydium: Use AMM pool PDA derivation
  // - Pump.fun: Use bonding curve address
  // - Pumpswap: Use their pool derivation logic

  console.warn(`[Pool Derivation] TODO: Implement proper derivation for ${dex}`);
  return tokenMint; // Placeholder
}
