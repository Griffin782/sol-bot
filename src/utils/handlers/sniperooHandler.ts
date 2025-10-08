import axios from "axios";
import { validateEnv } from "../env-validator";
import { config } from "../../config";
import { NewPositionRecord, SniperooSwapResponse } from "../../types";
import { insertNewPosition } from "../../tracker/db";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { LogEngineType } from "../managers/logManager";

/**
 * Buys a token using the Sniperoo API
 * @param tokenAddress The token's mint address
 * @param inputAmount Amount of SOL to spend
 * @returns Boolean indicating if the purchase was successful
 */
export async function buyToken(tokenAddress: string, inputAmount: number, logEngine: LogEngineType): Promise<boolean> {
  // Rate limit protection - Jupiter API requirement
  console.log("⏱️ Rate limit delay: 5 seconds...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  const MAX_RETRIES = 5;
  const RETRY_DELAY = 200;
  const env = validateEnv();

  const SELL_ENABLED = config.token_sell.sniperoo.enabled || true;
  const SELL_STRATEGY = config.token_sell.sniperoo.strategy || "simple";
  let SELL_SL = Math.abs(config.token_sell.sniperoo.stop_loss_config.stopLoss) || 15;
  let SELL_TP = config.token_sell.sniperoo.stop_loss_config.takeProfitLevels?.[0] || 50;
  const TRAIL_TARGETS = [
    {
      multiplier: 2,
      sellPercentage: 25,
      trailingStopLossAfter: 15,
    },
    {
      multiplier: 4,
      sellPercentage: 25,
      trailingStopLossAfter: 20,
    },
    {
      multiplier: 6,
      sellPercentage: 25,
      trailingStopLossAfter: 25,
  }
];

const strategyObject =
  SELL_STRATEGY === "simple"
    ? {
        strategyName: "simple",
        profitPercentage: SELL_TP,
        stopLossPercentage: SELL_SL,
      }
    : {
        strategyName: "grid",
        stopLossType: "trailing",
        stopLossPercentage: SELL_SL,
        profitTargets: TRAIL_TARGETS,
      };

  // Helper function to attempt the API call
  async function attemptBuyToken(retryCount: number): Promise<boolean> {
    try {
      // Validate inputs
      if (!tokenAddress || typeof tokenAddress !== "string" || tokenAddress.trim() === "") {
        return false;
      }

      if (inputAmount <= 0) {
        return false;
      }

      // Prepare request body
      const requestBody = {
        walletAddresses: [env.PUBKEY],
        tokenAddress: tokenAddress,
        inputAmount: inputAmount,
        autoSell: {
          enabled: SELL_ENABLED,
          strategy: strategyObject,
        },
      };

      // Make API request using axios
      const response: SniperooSwapResponse = await axios.post("https://api.sniperoo.app/trading/buy-token?toastFrontendId=0", requestBody, {
        headers: {
          Authorization: `Bearer ${env.SNIPEROO_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const newPosition: NewPositionRecord = {
        time: Number(new Date()),
        mint: tokenAddress,
        provider: "sniperoo",
        signer: env.PUBKEY,
        init_sol: inputAmount * LAMPORTS_PER_SOL,
        init_tokens: Number(response.data.purchases[0].tokenAmount),
        init_tx: response.data.purchases[0].txSignature,
      };

      await insertNewPosition(newPosition);

      // Axios automatically throws an error for non-2xx responses,
      // so if we get here, the request was successful
      return true;
    } catch (error) {
      // Check if it's the specific error we want to retry
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 400 &&
        error.response?.data?.code_error === "INTERNAL_SERVER_ERROR" &&
        error.response?.data?.message?.includes("Transaction failed due to an unknown reason")
      ) {
        // If we haven't exceeded max retries, try again
        if (retryCount < MAX_RETRIES) {
          logEngine.writeLog(`🤞 Sniperoo`, `Snipe retry attempt ${retryCount + 1}/${MAX_RETRIES}`, "yellow");
          // Wait for the specified delay
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
          // Recursive call with incremented retry count
          return attemptBuyToken(retryCount + 1);
        }
      }

      // Handle axios errors
      if (axios.isAxiosError(error)) {
        logEngine.writeLog(
          `❌ Sniperoo`,
          `Sniperoo API error (${error.response?.status || "unknown"}): ${error.response?.statusText || "No further information provided."}`,
          "red"
        );
      } else {
        logEngine.writeLog(`❌ Sniperoo`, `Error buying token: ${error instanceof Error ? error.message : "Unknown error"}`, "red");
      }
      return false;
    }
  }

  // Start with retry count 0
  return attemptBuyToken(0);
}
