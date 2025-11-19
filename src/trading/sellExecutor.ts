/**
 * Sell Executor - Phase 4 Modularization Step 3
 * Handles all token sell logic including simulation mode
 */

import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { LogEngineType } from "../utils/managers/logManager";
import { TokenAccountInfo } from "../utils/handlers/walletTokenHandler";
import { sharedState } from "../core/sharedState";
import { pumpswapSell } from "../utils/handlers/pumpswapHandler";
import { unSwapToken } from "../utils/handlers/jupiterHandler";
import { enhancedBuySellLogger } from "../monitoring/enhancedBuySellLogger";
import { getWalletAddress } from "../utils/handlers/walletHandler";
import { shortenAddress } from "../utils/func";
import { NewPositionRecord } from "../types";
import { deletePositionByWalletAndMint, getPositionByMint, updatePartialExit } from "../tracker/db";

export class SellExecutor {
  private getCurrentTime(): string {
    const now = new Date();
    return now.toTimeString().split(" ")[0]; // returns "HH:MM:SS"
  }

  constructor(
    private config: {
      BUY_PROVIDER: string; // Provider is used for both buy and sell
      SIM_MODE: boolean;
      WSOL_MINT: string;
    },
    private logEngine: LogEngineType
  ) {}

  /**
   * PHASE 4 - SOL-BOT INTEGRATION: Execute partial or full sell
   * Implements sol-bot's exact tiered exit logic (83.7% win rate)
   *
   * @param returnedMint - Token mint address to sell
   * @param sellPercent - Percentage of ORIGINAL position to sell (25, 50, 75, or 100)
   * @param tierName - Tier identifier (e.g., "TIER 1", "TIER 2") for tracking
   * @param reason - Human-readable exit reason (e.g., "📈 TIER 1: Taking 25% at 509% gain (2x)")
   */
  async executePartialSell(
    returnedMint: string,
    sellPercent: number,
    tierName: string = "",
    reason: string = "manual"
  ): Promise<boolean> {
    if (!returnedMint) return false;

    // Validate sell percent
    if (sellPercent <= 0 || sellPercent > 100) {
      this.logEngine.writeLog(
        `❌ ${this.getCurrentTime()}`,
        `Invalid sell percent: ${sellPercent}% (must be 1-100)`,
        "red"
      );
      return false;
    }

    // Get wallet address
    const walletAddress = getWalletAddress();
    if (!walletAddress) {
      this.logEngine.writeLog(
        `❌ ${this.getCurrentTime()}`,
        `Wallet address not available`,
        "red"
      );
      return false;
    }

    // Get position from database
    const positions = await getPositionByMint(returnedMint);
    if (positions.length === 0) {
      this.logEngine.writeLog(
        `❌ ${this.getCurrentTime()}`,
        `Position not found: ${shortenAddress(returnedMint)}`,
        "red"
      );
      return false;
    }

    const position = positions[0];

    // Phase 4: SOL-BOT LOGIC - Calculate based on ORIGINAL position, not remaining
    const originalTokens = position.init_tokens;
    const remainingTokens = (position as any).remainingTokens ?? originalTokens;
    const tokensToSell = Math.floor(originalTokens * (sellPercent / 100));

    // Validate we have enough tokens to sell
    if (tokensToSell > remainingTokens) {
      this.logEngine.writeLog(
        `⚠️ ${this.getCurrentTime()}`,
        `Adjusted sell: ${tokensToSell} requested but only ${remainingTokens} remaining`,
        "yellow"
      );
      // Sell what we have left
      const adjustedToSell = remainingTokens;
      if (adjustedToSell <= 0) {
        this.logEngine.writeLog(
          `❌ ${this.getCurrentTime()}`,
          `No tokens left to sell for ${shortenAddress(returnedMint)}`,
          "red"
        );
        return false;
      }
    }

    // Log sell intent
    this.logEngine.writeLog(
      `💰 ${this.getCurrentTime()}`,
      `${this.config.SIM_MODE ? "[PAPER TRADE] " : ""}Selling ${sellPercent}% of ${shortenAddress(returnedMint)} (${tokensToSell} tokens)`,
      "blue"
    );
    this.logEngine.writeLog(
      `📊 ${this.getCurrentTime()}`,
      `Reason: ${reason}`,
      "white"
    );

    // Handle simulation mode
    if (this.config.SIM_MODE) {
      // Simulate the sell
      if (sellPercent === 100 || remainingTokens - tokensToSell <= 0) {
        // Full exit - remove from database
        await deletePositionByWalletAndMint(walletAddress, returnedMint);
        this.logEngine.writeLog(
          `✅ ${this.getCurrentTime()}`,
          `[PAPER TRADE] Position closed: ${shortenAddress(returnedMint)}`,
          "green"
        );
      } else {
        // Phase 4: Partial exit - update remainingTokens and executedTiers
        const newRemainingTokens = remainingTokens - tokensToSell;

        await updatePartialExit(walletAddress, returnedMint, newRemainingTokens, tierName);

        this.logEngine.writeLog(
          `✅ ${this.getCurrentTime()}`,
          `[PAPER TRADE] ${tierName ? tierName + ' executed: ' : ''}${sellPercent}% sold, ${newRemainingTokens} tokens remaining`,
          "green"
        );
      }

      // Log to CSV
      const sellAmountSOL = (position.init_sol * (sellPercent / 100)) / LAMPORTS_PER_SOL;
      await enhancedBuySellLogger.logSell(returnedMint, sellAmountSOL);

      // Remove from handled mints if full exit
      if (sellPercent === 100) {
        sharedState.removeHandledMint(returnedMint);
      }

      return true;
    }

    // LIVE MODE: Execute actual sell
    let result = false;

    // Try PumpSwap first if configured
    if (this.config.BUY_PROVIDER === "pumpswap") {
      this.logEngine.writeLog(
        `${this.getCurrentTime()}`,
        `Attempting PumpSwap sell...`,
        "blue"
      );
      const pumpswapResult = await pumpswapSell(returnedMint, this.config.WSOL_MINT, tokensToSell);

      if (pumpswapResult) {
        result = true;
        this.logEngine.writeLog(
          `✅ ${this.getCurrentTime()}`,
          `Sold ${sellPercent}% using PumpSwap SDK`,
          "green"
        );
      } else {
        this.logEngine.writeLog(
          `${this.getCurrentTime()}`,
          `PumpSwap unavailable, falling back to Jupiter...`,
          "yellow"
        );
      }
    }

    // Use Jupiter (either as primary or fallback)
    if (!result) {
      const sellResult = await unSwapToken(this.config.WSOL_MINT, returnedMint, tokensToSell, this.logEngine);

      if (!sellResult.success) {
        this.logEngine.writeLog(
          `❌ ${this.getCurrentTime()}`,
          `Sell failed: ${sellResult.error || "Jupiter API error"}`,
          "red"
        );
        return false;
      }

      result = true;
      this.logEngine.writeLog(
        `✅ ${this.getCurrentTime()}`,
        `Sold ${sellPercent}% using Jupiter Swap API`,
        "green"
      );
      if (sellResult.solReceived && sellResult.tokensSold) {
        this.logEngine.writeLog(
          `📊 ${this.getCurrentTime()}`,
          `Received: ${sellResult.solReceived.toFixed(6)} SOL for ${sellResult.tokensSold.toLocaleString()} tokens`,
          "white"
        );
      }
    }

    // Log the sell
    const sellAmountSOL = (position.init_sol * (sellPercent / 100)) / LAMPORTS_PER_SOL;
    await enhancedBuySellLogger.logSell(returnedMint, sellAmountSOL);

    // Update or remove position
    if (sellPercent === 100 || remainingTokens - tokensToSell <= 0) {
      // Full exit - remove from database
      await deletePositionByWalletAndMint(walletAddress, returnedMint);
      sharedState.removeHandledMint(returnedMint);

      this.logEngine.writeLog(
        `✅ ${this.getCurrentTime()}`,
        `Position closed: ${shortenAddress(returnedMint)}`,
        "green"
      );
    } else {
      // Phase 4: Partial exit - update remainingTokens and executedTiers
      const newRemainingTokens = remainingTokens - tokensToSell;

      await updatePartialExit(walletAddress, returnedMint, newRemainingTokens, tierName);

      this.logEngine.writeLog(
        `✅ ${this.getCurrentTime()}`,
        `${tierName ? tierName + ' executed: ' : ''}${sellPercent}% sold, ${newRemainingTokens} tokens remaining`,
        "green"
      );
    }

    return true;
  }

  // LEGACY: 100% exits only - Use executePartialSell() instead
  async executeSell(returnedMint: string, sellPercent: number = 100): Promise<void> {
    if (!returnedMint) return;

    // Redirect to new partial sell method
    if (sellPercent !== 100) {
      this.logEngine.writeLog(
        `⚠️ ${this.getCurrentTime()}`,
        `Redirecting to executePartialSell() for ${sellPercent}% exit`,
        "yellow"
      );
      await this.executePartialSell(returnedMint, sellPercent, "legacy_redirect");
      return;
    }

    /**
     * Log the token mint address
     */
    this.logEngine.writeLog(`${this.getCurrentTime()}`, `Sell instruction initiated`, "white");
    this.logEngine.writeLog(`${this.getCurrentTime()}`, `Token CA extracted successfully`, "green");
    this.logEngine.writeLog(`${this.getCurrentTime()}`, `https://gmgn.ai/sol/token/${returnedMint}`, "white");

    /**
     *  Handle simulation mode sell
     */
    if (this.config.SIM_MODE) {
      const walletAddress = getWalletAddress();
      if (!walletAddress) return;

      // Get position from database
      let position: NewPositionRecord[] = await getPositionByMint(returnedMint);
      if (position.length === 0) {
        this.logEngine.writeLog(`${this.getCurrentTime()}`, `[PAPER TRADE] Position not found for ${shortenAddress(returnedMint)}`, "yellow");
        return;
      }

      const exitPercent = sellPercent; // TEMP: Always 100% (partial exits not implemented)
      this.logEngine.writeLog(`💰 ${this.getCurrentTime()}`, `[PAPER TRADE] Selling ${exitPercent}% of ${shortenAddress(returnedMint)}`, "green");

      // Remove position from database
      await deletePositionByWalletAndMint(walletAddress, returnedMint);
      this.logEngine.writeLog(`✅ ${this.getCurrentTime()}`, `[PAPER TRADE] Position closed: ${shortenAddress(returnedMint)}`, "green");

      // Log sell transaction
      const sellAmountSOL = position[0].init_sol / LAMPORTS_PER_SOL;
      await enhancedBuySellLogger.logSell(returnedMint, sellAmountSOL);

      // Remove from handled mints via sharedState
      sharedState.removeHandledMint(returnedMint);
      return;
    }

    /**
     * Verify token and get amount (LIVE MODE ONLY)
     */
    let position: NewPositionRecord[] = await getPositionByMint(returnedMint);
    if (position.length === 0) {
      this.logEngine.writeLog(`${this.getCurrentTime()}`, `Token not sold. Not found in database.`, "red");
      return;
    }

    /**
     * Make sure we get back 1 position and
     */
    if (position.length > 1 || position[0].init_tokens % 1 !== 0) {
      const synched = await this.syncPositions(returnedMint);
      if (!synched) {
        this.logEngine.writeLog(`${this.getCurrentTime()}`, `Token not sold. Could not sync token.`, "red");
        return;
      }
      position = await getPositionByMint(returnedMint);
      if (position.length > 1 || position[0].init_tokens % 1 !== 0) {
        this.logEngine.writeLog(`${this.getCurrentTime()}`, `Token not sold. Could not sync token.`, "red");
        return;
      }
    }

    /**
     * Perform Swap Transaction
     */
    const SELL_AMOUNT = position[0].init_tokens;
    let result = false;

    // Try PumpSwap first if configured
    if (this.config.BUY_PROVIDER === "pumpswap") {
      this.logEngine.writeLog(`${this.getCurrentTime()}`, `Attempting PumpSwap sell...`, "blue");
      const pumpswapResult = await pumpswapSell(returnedMint, this.config.WSOL_MINT, SELL_AMOUNT);

      if (pumpswapResult) {
        result = true;
        this.logEngine.writeLog(`✅ ${this.getCurrentTime()}`, `Token sold successfully using PumpSwap SDK`, "green");
        await enhancedBuySellLogger.logSell(returnedMint, SELL_AMOUNT / LAMPORTS_PER_SOL);
      } else {
        // PumpSwap failed or not implemented, fall back to Jupiter
        this.logEngine.writeLog(`${this.getCurrentTime()}`, `PumpSwap unavailable, falling back to Jupiter...`, "yellow");
      }
    }

    // Use Jupiter (either as primary provider or as fallback)
    if (!result) {
      this.logEngine.writeLog(`💰 ${this.getCurrentTime()}`, `Selling Token using Jupiter Swap API...`, "green");
      const sellResult = await unSwapToken(this.config.WSOL_MINT, returnedMint, SELL_AMOUNT, this.logEngine);

      if (!sellResult.success) {
        sharedState.removeHandledMint(returnedMint);
        this.logEngine.writeLog(`${this.getCurrentTime()}`, `Token not sold. ${sellResult.error || "Jupiter Swap API failed"}`, "red");
        return;
      }

      result = true;
      this.logEngine.writeLog(`✅ ${this.getCurrentTime()}`, `Token sold successfully using Jupiter Swap API`, "green");
      if (sellResult.solReceived && sellResult.tokensSold) {
        this.logEngine.writeLog(
          `📊 ${this.getCurrentTime()}`,
          `Received: ${sellResult.solReceived.toFixed(6)} SOL for ${sellResult.tokensSold.toLocaleString()} tokens`,
          "white"
        );
      }
      await enhancedBuySellLogger.logSell(returnedMint, SELL_AMOUNT / LAMPORTS_PER_SOL);
    }

    // Remove from handled mints via sharedState
    sharedState.removeHandledMint(returnedMint);
    return;
  }

  /**
   * Sync positions helper (extracted from index.ts)
   */
  private async syncPositions(returnedMint: string): Promise<boolean> {
    // Import required functions
    const { getWalletTokenBalances } = await import("../utils/handlers/walletTokenHandler");
    const { selectAllPositions, updatePositionTokenAmount } = await import("../tracker/db");

    // Get current wallet using the wallet handler
    const walletAddress: string | null = getWalletAddress();
    if (!walletAddress) {
      return false;
    }

    // Get all token accounts
    const tokenBalances: TokenAccountInfo[] = await getWalletTokenBalances(walletAddress);
    if (tokenBalances.length === 0) {
      return false;
    }

    // Get all stored positions
    const storedPositions: NewPositionRecord[] = await selectAllPositions();
    if (storedPositions.length === 0) {
      return false;
    }

    // Check if each stored position is still present in the token balances
    let synchedMint = false;
    for (const position of storedPositions) {
      // Check if the position's mint exists in token balances
      const matchingToken = tokenBalances.find((balance) => balance.mint === position.mint);

      if (matchingToken) {
        const currentDecimal = matchingToken.decimals;
        let initialTokens = position.init_tokens;
        const currentTokens = Number(matchingToken.amount);

        // Check if the amount matches
        if (initialTokens !== currentTokens) {
          const factor = 10 ** currentDecimal;
          if (initialTokens % 1 !== 0) {
            initialTokens = Math.round(initialTokens * factor);
          }
          const storedSol = position.init_sol;

          // Get new sol amount
          const pricePerToken = storedSol / initialTokens;
          const newSolMount = pricePerToken * currentTokens;

          // Amount has changed
          await updatePositionTokenAmount(walletAddress, position.mint, currentTokens, newSolMount, this.config.BUY_PROVIDER);
        }

        // Check if it was the returned mint
        if (matchingToken.mint === returnedMint) synchedMint = true;
      }
    }

    if (synchedMint) return true;
    return false;
  }
}
