/**
 * gRPC Token Detection - Finds NEW tokens via gRPC stream
 *
 * ⚠️ PROJECT: VIP-Sol-Sniper2
 * This module is responsible for detecting NEW token launches via gRPC.
 * It maintains its own persistent gRPC connection (separate from positionMonitor).
 *
 * Features:
 * - Subscribes to program accounts or wallet transactions
 * - Detects new token launches in real-time
 * - Extracts mint addresses from transaction data
 * - Uses updateSubscription() pattern (NO restarts for adding/removing subscriptions)
 * - Independent from position monitoring (Stream #1 for NEW tokens)
 *
 * Architecture:
 * - grpcTokenDetection.ts: Finds NEW tokens (this file - Stream #1)
 * - positionMonitor.ts: Monitors OWNED tokens (Stream #2)
 */

import Client, { SubscribeRequest, SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { ClientDuplexStream } from "@grpc/grpc-js";
import { createSubscribeRequest, isSubscribeUpdateTransaction, sendSubscribeRequest } from "../utils/managers/grpcManager";
import { DataStreamPrograms, DataStreamWallets } from "../types";

export interface TokenDetectionConfig {
  grpcEndpoint: string;
  grpcToken: string;
  dataStreamMode: "program" | "wallet";
  dataStreamPrograms: DataStreamPrograms[];
  dataStreamWallets: DataStreamWallets[];
  logDiscriminators: string[];
  wsolMint: string;
}

export interface DetectedToken {
  mint: string;
  isTokenSell: boolean;
  transaction?: any; // Full transaction data for further processing
}

type LogColors = "green" | "red" | "yellow" | "blue" | "white";
type LogFunction = (prefix: string, message: string, color?: LogColors, newline?: boolean, skipConsole?: boolean) => void;

/**
 * gRPC Token Detection Class
 * Maintains independent gRPC stream for finding NEW tokens
 */
export class GrpcTokenDetection {
  private grpcClient: Client | null = null;
  private grpcStream: ClientDuplexStream<SubscribeRequest, SubscribeUpdate> | null = null;
  private isActive: boolean = false;
  private onTokenDetectedCallback: ((token: DetectedToken) => void) | null = null;
  private logFunction: LogFunction;

  // Exponential backoff for reconnection
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private baseReconnectDelay: number = 5000; // 5 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isReconnecting: boolean = false;

  constructor(
    private detectionConfig: TokenDetectionConfig,
    logFn: LogFunction
  ) {
    this.logFunction = logFn;
  }

  /**
   * Set callback for when new token is detected
   */
  public onTokenDetected(callback: (token: DetectedToken) => void): void {
    this.onTokenDetectedCallback = callback;
  }

  /**
   * Start token detection stream
   */
  public async start(): Promise<void> {
    if (this.isActive) {
      this.logFunction(`Token Detection`, `Already active`, "yellow");
      return;
    }

    try {
      this.logFunction(`✅ Starting Sniper via gRPC...`, ``, "white");
      this.logFunction(`🟡 Config`, `Token detection stream mode: ${this.detectionConfig.dataStreamMode}`, "yellow");

      // Create gRPC client and stream
      this.grpcClient = new Client(
        this.detectionConfig.grpcEndpoint,
        this.detectionConfig.grpcToken,
        { skipPreflight: true }
      );
      this.grpcStream = await this.grpcClient.subscribe();

      // Setup initial subscription
      await this.setupSubscription();
      this.setupEventHandlers();

      this.isActive = true;
      this.logFunction(`${this.getCurrentTime()}`, `Geyser connection and subscription established`, "green");
    } catch (error) {
      this.logFunction(`${this.getCurrentTime()}`, `Failed to start token detection: ${error}`, "red");
      throw error;
    }
  }

  /**
   * Stop token detection stream
   */
  public stop(): void {
    if (this.grpcStream) {
      this.grpcStream.end();
      this.grpcStream = null;
    }

    this.grpcClient = null;
    this.isActive = false;
    this.logFunction(`${this.getCurrentTime()}`, `Token detection stopped`, "yellow");
  }

  /**
   * Update subscription WITHOUT restarting connection
   * Currently not used for token detection (we subscribe to program accounts)
   * But included for future extensibility (e.g., dynamic program list updates)
   */
  private async updateSubscription(): Promise<void> {
    if (!this.grpcStream) return;

    const request = createSubscribeRequest(
      this.detectionConfig.dataStreamPrograms,
      this.detectionConfig.dataStreamWallets,
      this.detectionConfig.dataStreamMode
    );

    // Send updated subscription (reuses existing connection)
    this.grpcStream.write(request);
    this.logFunction(`${this.getCurrentTime()}`, `Subscription updated`, "blue");
  }

  /**
   * Setup initial gRPC subscription
   */
  private async setupSubscription(): Promise<void> {
    if (!this.grpcStream) return;

    const request = createSubscribeRequest(
      this.detectionConfig.dataStreamPrograms,
      this.detectionConfig.dataStreamWallets,
      this.detectionConfig.dataStreamMode
    );

    await sendSubscribeRequest(this.grpcStream, request);
  }

  /**
   * Setup event handlers for gRPC stream
   */
  private setupEventHandlers(): void {
    if (!this.grpcStream) return;

    this.grpcStream.on("data", (data: SubscribeUpdate) => {
      // Successful data received - reset reconnection attempts
      this.reconnectAttempts = 0;
      this.processGrpcData(data);
    });

    this.grpcStream.on("error", (error: Error) => {
      const errorMsg = error.toString();

      // Detect rate limiting (429 error)
      const isRateLimited = errorMsg.includes('429') || errorMsg.includes('Too Many Requests');

      if (isRateLimited) {
        this.logFunction(`${this.getCurrentTime()}`, `🚨 RATE LIMIT DETECTED (429): ${error}`, "red");
        // Use longer delay for rate limits (start at 30 seconds)
        this.scheduleReconnect(30000);
      } else {
        this.logFunction(`${this.getCurrentTime()}`, `Stream error: ${error}`, "red");
        this.scheduleReconnect();
      }
    });

    this.grpcStream.on("end", () => {
      this.logFunction(`${this.getCurrentTime()}`, `Stream ended - will reconnect with backoff...`, "red");
      this.scheduleReconnect();
    });

    this.grpcStream.on("close", () => {
      this.logFunction(`${this.getCurrentTime()}`, `Stream closed - will reconnect with backoff...`, "red");
      this.scheduleReconnect();
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(overrideDelay?: number): void {
    // Prevent multiple simultaneous reconnection attempts
    if (this.isReconnecting) {
      return;
    }

    // Check if max attempts reached
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logFunction(
        `${this.getCurrentTime()}`,
        `❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached. Stopping retries.`,
        "red"
      );
      this.isActive = false;
      return;
    }

    this.isReconnecting = true;

    // Clear any existing timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Calculate delay with exponential backoff
    // 5s → 10s → 20s → 40s → 80s → 160s (capped at 5 minutes)
    const exponentialDelay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
    const cappedDelay = Math.min(exponentialDelay, 300000); // Max 5 minutes
    const delay = overrideDelay || cappedDelay;

    this.reconnectAttempts++;

    this.logFunction(
      `${this.getCurrentTime()}`,
      `⏳ Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${(delay/1000).toFixed(0)}s...`,
      "yellow"
    );

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.restartSubscription();
        this.isReconnecting = false;
      } catch (error) {
        this.logFunction(`${this.getCurrentTime()}`, `Reconnection failed: ${error}`, "red");
        this.isReconnecting = false;
        // Try again with next backoff level
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Restart subscription (ONLY for error recovery)
   * Do NOT use this for normal operations - use updateSubscription() instead
   */
  private async restartSubscription(): Promise<void> {
    if (!this.grpcClient) return;

    this.logFunction(`${this.getCurrentTime()}`, `🔄 RESTARTING token detection connection (attempt ${this.reconnectAttempts})`, "yellow");

    // End current stream
    if (this.grpcStream) {
      this.grpcStream.end();
    }

    // Create new stream
    this.grpcStream = await this.grpcClient.subscribe();
    await this.setupSubscription();
    this.setupEventHandlers();

    this.logFunction(`${this.getCurrentTime()}`, `✅ Reconnection successful`, "green");
  }

  /**
   * Process gRPC data updates
   * Extracted from index.ts processGrpcData()
   */
  private async processGrpcData(data: SubscribeUpdate): Promise<void> {
    if (!isSubscribeUpdateTransaction(data) || !data.filters.includes("sniper")) {
      return;
    }

    const transaction = data.transaction?.transaction;
    const meta = transaction?.meta;
    let isTokenSell: boolean | null = null;

    if (!transaction || !meta) {
      return;
    }

    const tokenBalances = meta.postTokenBalances || meta.preTokenBalances;
    if (!tokenBalances?.length) return;

    // Determine if this is a token sell or buy based on stream mode
    if (this.detectionConfig.dataStreamMode === "program" && this.detectionConfig.dataStreamPrograms.length > 0) {
      if (!meta.logMessages.some((msg: string) =>
        this.detectionConfig.logDiscriminators.some((discriminator) => msg.includes(discriminator))
      )) {
        return;
      }
      isTokenSell = false;
    } else if (this.detectionConfig.dataStreamMode === "wallet" && this.detectionConfig.dataStreamWallets.length > 0) {
      if (!meta.logMessages.some((log: string) =>
        log.includes("Program log: Instruction: Buy") || log.includes("Program log: Instruction: Sell")
      )) {
        if (!meta.logMessages.some((log: string) =>
          log.includes("Program log: Instruction: Swap") || log.includes("Program log: Instruction: SwapV2")
        )) {
          return;
        }
      }
    } else {
      // Invalid state
      return;
    }

    // Extract the token mint from transaction
    this.logFunction(`✅ New token instruction found`, ``, "green");

    const tokenMint = this.getMintFromTokenBalances(tokenBalances);
    if (!tokenMint) {
      this.logFunction(`${this.getCurrentTime()}`, `No valid token CA could be extracted`, "red");
      this.logFunction(`🔎 ${this.getCurrentTime()}`, `Continue looking at the data stream...`, "white");
      return;
    }

    // Check token flow direction for wallet mode
    if (this.detectionConfig.dataStreamMode === "wallet" && this.detectionConfig.dataStreamWallets.length > 0) {
      const logs = meta.logMessages || [];
      const instructionType = logs.find((log: string) =>
        log.includes("Program log: Instruction: Sell") ||
        log.includes("Program log: Instruction: Buy") ||
        log.includes("Program log: Instruction: Swap") ||
        log.includes("Program log: Instruction: SwapV2")
      );

      if (instructionType?.includes("Sell")) {
        isTokenSell = true;
      } else if (instructionType?.includes("Buy")) {
        isTokenSell = false;
      } else if (instructionType?.includes("Swap")) {
        const pre = meta.preTokenBalances.find((b: any) => b.mint === tokenMint);
        const post = meta.postTokenBalances.find((b: any) => b.mint === tokenMint);
        if (pre?.uiTokenAmount?.amount && post?.uiTokenAmount?.amount) {
          isTokenSell = Number(post.uiTokenAmount.amount) < Number(pre.uiTokenAmount.amount);
        } else {
          this.logFunction(
            `❌ ${this.getCurrentTime()}`,
            `Unable to determine token flow: Missing balances for token during swap.`,
            "red"
          );
          return;
        }
      } else {
        this.logFunction(
          `❌ ${this.getCurrentTime()}`,
          `Unrecognized instruction in logs. Unable to determine token flow direction.`,
          "red"
        );
        return;
      }
    } else {
      isTokenSell = false;
    }

    this.logFunction(`✅ ${this.getCurrentTime()}`, `Token CA extracted successfully`, "green");

    // Trigger callback with detected token
    if (this.onTokenDetectedCallback && isTokenSell !== null) {
      this.onTokenDetectedCallback({
        mint: tokenMint,
        isTokenSell,
        transaction: data.transaction // Pass full transaction data
      });
    }
  }

  /**
   * Extract mint address from token balances
   * Extracted from index.ts getMintFromTokenBalances()
   */
  private getMintFromTokenBalances(tokenBalances: any): string | null {
    // Fast path: If we have exactly 2 token balances, one is likely WSOL and the other is the token
    if (tokenBalances.length === 2) {
      const mint1 = tokenBalances[0].mint;
      const mint2 = tokenBalances[1].mint;

      // If mint1 is WSOL, return mint2 (unless it's also WSOL)
      if (mint1 === this.detectionConfig.wsolMint) {
        return mint2 === this.detectionConfig.wsolMint ? null : mint2;
      }

      // If mint2 is WSOL, return mint1
      if (mint2 === this.detectionConfig.wsolMint) {
        return mint1;
      }

      // If neither is WSOL, return the first one
      return mint1;
    }

    // For more than 2 balances, find the first non-WSOL mint
    for (const balance of tokenBalances) {
      if (balance.mint !== this.detectionConfig.wsolMint) {
        return balance.mint;
      }
    }
    return null;
  }

  /**
   * Helper: Get current time
   */
  private getCurrentTime(): string {
    const now = new Date();
    return now.toTimeString().split(" ")[0]; // returns "HH:MM:SS"
  }

  /**
   * Get detection status
   */
  public isRunning(): boolean {
    return this.isActive;
  }
}
