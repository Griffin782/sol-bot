import axios from "axios";
import bs58 from "bs58";
import { validateEnv } from "../env-validator";
import { Connection, Keypair, LAMPORTS_PER_SOL, VersionedTransaction } from "@solana/web3.js";
import { JupiterSwapQuoteResponse, JupiterSwapResponse, NewPositionRecord } from "../../types";
import { config } from "../../config";
import { deletePositionsByMint, insertNewPosition } from "../../tracker/db";
import { LogEngineType } from "../managers/logManager";

export async function swapToken(inputMint: string, outputMint: string, inputAmount: number, logEngine: LogEngineType): Promise<boolean> {
  // Validate inputs
  if (!outputMint || typeof outputMint !== "string" || outputMint.trim() === "") {
    return false;
  }

  if (inputAmount <= 0) {
    return false;
  }

  const MAX_RETRIES = 1;
  const RETRY_DELAY = 200;
  const JITO_FEE_SOL = config.token_buy.jupiter.jitoTipSOL || 0.0001;
  const MAX_FEE_SOL = config.token_buy.jupiter.prioFeeMaxSOL || 10000000;
  const JITO_FEE_LAMPORTS = JITO_FEE_SOL * LAMPORTS_PER_SOL; // Convert to lamports
  const MAX_FEE_LAMPORTS = MAX_FEE_SOL * LAMPORTS_PER_SOL; // Convert to lamports
  const SLIPPAGE_BASIS_POINTS = config.token_buy.jupiter.slippageBps || 50;
  const SOL_AMOUNT = inputAmount * LAMPORTS_PER_SOL; // Convert to lamports
  const PRIO_MODE = config.token_buy.jupiter.mode || "jito";
  const WRAP_SOL = config.token_buy.jupiter.wrapAndUnwrapSol || true;

  /**
   * Establish a connection to the Solana
   * Decode the private key from the environment variable
   * Create a Keypair object from the decoded private key
   */
  const env = validateEnv();
  const mainConnection = new Connection(env.RPC_HTTPS_URI, "processed");
  const secretKey = bs58.decode(env.PRIVATE_KEY);
  const wallet = Keypair.fromSecretKey(secretKey);

  /**
   * Set Priority Fee based on the mode
   */
  const prioritizationFeeLamports =
    PRIO_MODE === "jito"
      ? {
          jitoTipLamports: JITO_FEE_LAMPORTS,
        }
      : {
          priorityLevelWithMaxLamports: {
            maxLamports: MAX_FEE_LAMPORTS,
            global: false,
            priorityLevel: "veryHigh",
          },
        };

  async function attemptSwapToken(retryCount: number): Promise<boolean> {
    try {
      const quoteResponse = await axios.get<JupiterSwapQuoteResponse>("https://lite-api.jup.ag/swap/v1/quote", {
        params: {
          inputMint: inputMint, // WSOL
          outputMint: outputMint, // Token CA
          amount: SOL_AMOUNT,
          slippageBps: SLIPPAGE_BASIS_POINTS,
          onlyDirectRoutes: false,
          asLegacyTransaction: false,
          //restrictIntermediateTokens: true, // remove to test
        },
      });

      const swapResponse = await axios.post<JupiterSwapResponse>("https://lite-api.jup.ag/swap/v1/swap", {
        quoteResponse: quoteResponse.data,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: WRAP_SOL,
        dynamicComputeUnitLimit: true,
        skipUserAccountsRpcCalls: true,
        prioritizationFeeLamports: prioritizationFeeLamports,
      });

      const transaction = VersionedTransaction.deserialize(Buffer.from(swapResponse.data.swapTransaction, "base64"));
      transaction.sign([wallet]);

      /**
       *  Check if the transaction simulation was successful returned from dynamicComputeUnitLimit
       */
      if (swapResponse.data.simulationError !== null) {
        throw new Error(`Transaction simulation failed!`);
      }

      /**
       *  Send the transaction to the Solana network
       */
      const signature = await mainConnection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: true,
        maxRetries: 2,
      });

      /**
       * Confirm the transaction
       */
      const confirmation = await mainConnection.confirmTransaction(signature, "processed");
      if (confirmation.value.err) {
        throw new Error(`Transaction confirmation failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      /**
       * Save position
       */
      const newPosition: NewPositionRecord = {
        time: Number(new Date()),
        mint: outputMint,
        provider: "jupiter",
        signer: wallet.publicKey.toString(),
        init_sol: SOL_AMOUNT,
        init_tokens: Number(quoteResponse.data.outAmount),
        init_tx: signature,
      };
      await insertNewPosition(newPosition);

      /**
       * Return successfull
       */
      return true;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        logEngine.writeLog(`🤞 Jupiter`, `Snipe retry attempt ${retryCount + 1}/${MAX_RETRIES}`, "yellow");
        // Wait for the specified delay
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        // Recursive call with incremented retry count
        return attemptSwapToken(retryCount + 1);
      }

      // Handle axios errors
      if (axios.isAxiosError(error)) {
        logEngine.writeLog(`❌ Jupiter`, `Jupiter API error (${error.response?.status || "unknown"})`, "red");
      } else {
        logEngine.writeLog(`❌ Jupiter`, `Error buying token: ${error instanceof Error ? error.message : "Unknown error"}`, "red");
      }
      return false;
    }
  }

  // Start with retry count 0
  return attemptSwapToken(0);
}
export async function unSwapToken(inputMint: string, outputMint: string, inputAmount: number, logEngine: LogEngineType): Promise<boolean> {
  // Validate inputs
  if (!outputMint || typeof outputMint !== "string" || outputMint.trim() === "") {
    return false;
  }

  if (inputAmount <= 0) {
    return false;
  }

  const MAX_RETRIES = 1;
  const RETRY_DELAY = 200;
  const JITO_FEE_SOL = config.token_buy.jupiter.jitoTipSOL || 0.0001;
  const MAX_FEE_SOL = config.token_buy.jupiter.prioFeeMaxSOL || 10000000;
  const JITO_FEE_LAMPORTS = JITO_FEE_SOL * LAMPORTS_PER_SOL; // Convert to lamports
  const MAX_FEE_LAMPORTS = MAX_FEE_SOL * LAMPORTS_PER_SOL; // Convert to lamports
  const SLIPPAGE_BASIS_POINTS = config.token_buy.jupiter.slippageBps || 50;
  const TOKEN_AMOUNT = inputAmount; // Convert to lamports
  const PRIO_MODE = config.token_buy.jupiter.mode || "jito";
  const WRAP_SOL = config.token_buy.jupiter.wrapAndUnwrapSol || true;

  /**
   * Establish a connection to the Solana
   * Decode the private key from the environment variable
   * Create a Keypair object from the decoded private key
   */
  const env = validateEnv();
  const mainConnection = new Connection(env.RPC_HTTPS_URI, "processed");
  const secretKey = bs58.decode(env.PRIVATE_KEY);
  const wallet = Keypair.fromSecretKey(secretKey);

  /**
   * Set Priority Fee based on the mode
   */
  const prioritizationFeeLamports =
    PRIO_MODE === "jito"
      ? {
          jitoTipLamports: JITO_FEE_LAMPORTS,
        }
      : {
          priorityLevelWithMaxLamports: {
            maxLamports: MAX_FEE_LAMPORTS,
            global: false,
            priorityLevel: "veryHigh",
          },
        };

  async function attemptUnSwapToken(retryCount: number): Promise<boolean> {
    try {
      const quoteResponse = await axios.get<JupiterSwapQuoteResponse>("https://lite-api.jup.ag/swap/v1/quote", {
        params: {
          inputMint: outputMint,
          outputMint: inputMint,
          amount: TOKEN_AMOUNT,
          slippageBps: SLIPPAGE_BASIS_POINTS,
          onlyDirectRoutes: false,
          asLegacyTransaction: false,
          //restrictIntermediateTokens: true, // remove to test
        },
      });

      const swapResponse = await axios.post<JupiterSwapResponse>("https://lite-api.jup.ag/swap/v1/swap", {
        quoteResponse: quoteResponse.data,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: WRAP_SOL,
        dynamicComputeUnitLimit: true,
        skipUserAccountsRpcCalls: true,
        prioritizationFeeLamports: prioritizationFeeLamports,
      });

      const transaction = VersionedTransaction.deserialize(Buffer.from(swapResponse.data.swapTransaction, "base64"));
      transaction.sign([wallet]);

      /**
       *  Check if the transaction simulation was successful returned from dynamicComputeUnitLimit
       */
      if (swapResponse.data.simulationError !== null) {
        throw new Error(`Transaction simulation failed!`);
      }

      /**
       *  Send the transaction to the Solana network
       */
      const signature = await mainConnection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: true,
        maxRetries: 2,
      });

      /**
       * Confirm the transaction
       */
      const confirmation = await mainConnection.confirmTransaction(signature, "processed");
      if (confirmation.value.err) {
        throw new Error(`Transaction confirmation failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      /**
       * Delete position
       */
      await deletePositionsByMint(inputMint);

      /**
       * Return successfull
       */
      return true;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        logEngine.writeLog(`🤞 Jupiter`, `Sell retry attempt ${retryCount + 1}/${MAX_RETRIES}`, "yellow");
        // Wait for the specified delay
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        // Recursive call with incremented retry count
        return attemptUnSwapToken(retryCount + 1);
      }

      // Handle axios errors
      if (axios.isAxiosError(error)) {
        logEngine.writeLog(`❌ Jupiter`, `Jupiter API error (${error.response?.status || "unknown"}): ${error.response?.statusText}`, "red");
      } else {
        logEngine.writeLog(`❌ Jupiter`, `Error selling token: ${error instanceof Error ? error.message : "Unknown error"}`, "red");
      }
      return false;
    }
  }

  // Start with retry count 0
  return attemptUnSwapToken(0);
}
