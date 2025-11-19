import axios from "axios";
import bs58 from "bs58";
import { validateEnv } from "../env-validator";
import { Connection, Keypair, LAMPORTS_PER_SOL, VersionedTransaction } from "@solana/web3.js";
import { JupiterSwapQuoteResponse, JupiterSwapResponse, NewPositionRecord, SwapResult, SellSwapResult } from "../../types";
import { config } from "../../config";
import { deletePositionsByMint, insertNewPosition } from "../../tracker/db";
import { LogEngineType } from "../managers/logManager";

export async function swapToken(inputMint: string, outputMint: string, inputAmount: number, logEngine: LogEngineType): Promise<SwapResult> {
  // Rate limit protection - optimized for free tier (tested at 100ms)
  const rateDelay = parseInt(process.env.JUPITER_DELAY_MS || '100');
  console.log(`⏱️ Rate limit delay: ${rateDelay}ms...`);
  await new Promise(resolve => setTimeout(resolve, rateDelay));

  console.log("🎯 [SWAP] ENTERED swapToken function - REALLY!");
  console.log("🎯 [SWAP] Provider check:", "jupiter");
  console.log("🚪 SWAPTOKEN FUNCTION ENTRY:");
  console.log("  - inputMint:", inputMint);
  console.log("  - outputMint:", outputMint);
  console.log("  - inputAmount:", inputAmount);

  // Validate inputs
  if (!outputMint || typeof outputMint !== "string" || outputMint.trim() === "") {
    console.log("⛔ SWAPTOKEN EARLY RETURN: Invalid outputMint");
    console.log("❌ [SWAP] Returning false at line 19: Invalid outputMint");
    return { success: false, error: "Invalid outputMint" };
  }

  if (inputAmount <= 0) {
    console.log("⛔ SWAPTOKEN EARLY RETURN: Invalid inputAmount:", inputAmount);
    console.log("❌ [SWAP] Returning false at line 24: Invalid inputAmount");
    return { success: false, error: "Invalid inputAmount" };
  }

  console.log("✅ SWAPTOKEN: Validation passed, proceeding with trade");
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

  // Handle both array and base58 formats
  let secretKey: Uint8Array;
  if (env.PRIVATE_KEY.startsWith('[')) {
    // Array format: [1,2,3,...]
    console.log("🔑 [SWAP] Private key is in array format");
    const keyArray = JSON.parse(env.PRIVATE_KEY);
    secretKey = new Uint8Array(keyArray);
  } else {
    // Base58 format
    console.log("🔑 [SWAP] Private key is in base58 format");
    secretKey = bs58.decode(env.PRIVATE_KEY);
  }

  const wallet = Keypair.fromSecretKey(secretKey);
  console.log("💰 [SWAP] Wallet address:", wallet.publicKey.toString());

  // Check wallet balance before attempting trade
  try {
    const balanceLamports = await mainConnection.getBalance(wallet.publicKey);
    const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;
    console.log(`💰 [SWAP] Wallet balance: ${balanceSOL.toFixed(6)} SOL`);

    if (balanceSOL < 0.01) {
      console.error("❌ [SWAP] Insufficient balance!");
      console.error(`   Current: ${balanceSOL.toFixed(6)} SOL`);
      console.error("   Minimum: 0.01 SOL");
      console.error("   Add SOL to wallet before trading!");
      return { success: false, error: "Insufficient balance (minimum 0.01 SOL)" };
    }

    if (balanceSOL < inputAmount + 0.002) {
      console.error("❌ [SWAP] Insufficient balance for this trade!");
      console.error(`   Required: ${(inputAmount + 0.002).toFixed(6)} SOL (trade + fees)`);
      console.error(`   Available: ${balanceSOL.toFixed(6)} SOL`);
      return { success: false, error: `Insufficient balance (need ${(inputAmount + 0.002).toFixed(6)} SOL)` };
    }
  } catch (error) {
    console.warn("⚠️  [SWAP] Could not check balance, proceeding anyway...");
  }

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

  async function attemptSwapToken(retryCount: number): Promise<SwapResult> {
    try {
      console.log("🌐 [SWAP] Making Jupiter API call...");
      const quoteResponse = await axios.get<JupiterSwapQuoteResponse>(`${process.env.JUPITER_ENDPOINT}/swap/v1/quote`, {
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
      console.log("Response:", quoteResponse.data);

      // Extract token amounts from quote
      const outputTokens = parseInt(quoteResponse.data.outAmount);
      const inputLamports = parseInt(quoteResponse.data.inAmount);
      console.log(`📊 [SWAP] Quote: ${inputLamports / LAMPORTS_PER_SOL} SOL → ${outputTokens} tokens`);

      const swapResponse = await axios.post<JupiterSwapResponse>(`${process.env.JUPITER_ENDPOINT}/swap/v1/swap`, {
        quoteResponse: quoteResponse.data,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: WRAP_SOL,
        dynamicComputeUnitLimit: true,
        skipUserAccountsRpcCalls: true,
        prioritizationFeeLamports: prioritizationFeeLamports,
      });
      console.log("Response:", swapResponse.data);

      const transaction = VersionedTransaction.deserialize(Buffer.from(swapResponse.data.swapTransaction, "base64"));
      transaction.sign([wallet]);

      /**
       *  Check if the transaction simulation was successful returned from dynamicComputeUnitLimit
       */
      //if (swapResponse.data.simulationError !== null) {
       // throw new Error(`Transaction simulation failed!`);
      //}

      /**
       *  Send the transaction to the Solana network
       */
      console.log("📡 [SWAP] Sending transaction to blockchain...");
      const signature = await mainConnection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: true,
        maxRetries: 2,
      });
      console.log("Transaction signature:", signature);

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
       * Return successful with token amounts
       */
      console.log("✅ SWAPTOKEN: Successfully completed trade and saved position");
      console.log("✅ [SWAP] Returning success with token amounts");
      return {
        success: true,
        outputAmount: outputTokens,
        inputAmount: inputLamports / LAMPORTS_PER_SOL,
        txSignature: signature,
        priceImpactPct: quoteResponse.data.priceImpactPct
      };
    } catch (error) {
      console.log("❌ SWAPTOKEN: Error occurred:", error);
      console.error("💥 [SWAP] Error:", error instanceof Error ? error.message : error);
      if (retryCount < MAX_RETRIES) {
        logEngine.writeLog(`🤞 Jupiter`, `Snipe retry attempt ${retryCount + 1}/${MAX_RETRIES}`, "yellow");
        // Wait for the specified delay
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        // Recursive call with incremented retry count
        return attemptSwapToken(retryCount + 1);
      }

      // Handle axios errors
      let errorMessage: string;
      if (axios.isAxiosError(error)) {
        errorMessage = `Jupiter API error (${error.response?.status || "unknown"})`;
        logEngine.writeLog(`❌ Jupiter`, errorMessage, "red");
      } else {
        errorMessage = error instanceof Error ? error.message : "Unknown error";
        logEngine.writeLog(`❌ Jupiter`, `Error buying token: ${errorMessage}`, "red");
      }
      console.log("❌ [SWAP] Returning error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  // Start with retry count 0
  return attemptSwapToken(0);
}
export async function unSwapToken(inputMint: string, outputMint: string, inputAmount: number, logEngine: LogEngineType): Promise<SellSwapResult> {
  // Rate limit protection - optimized for free tier (tested at 100ms)
  const rateDelay = parseInt(process.env.JUPITER_DELAY_MS || '100');
  console.log(`⏱️ Rate limit delay: ${rateDelay}ms...`);
  await new Promise(resolve => setTimeout(resolve, rateDelay));

  // Validate inputs
  if (!outputMint || typeof outputMint !== "string" || outputMint.trim() === "") {
    return { success: false, error: "Invalid outputMint" };
  }

  if (inputAmount <= 0) {
    return { success: false, error: "Invalid inputAmount" };
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

  // Handle both array and base58 formats
  let secretKey: Uint8Array;
  if (env.PRIVATE_KEY.startsWith('[')) {
    // Array format: [1,2,3,...]
    console.log("🔑 [UNSWAP] Private key is in array format");
    const keyArray = JSON.parse(env.PRIVATE_KEY);
    secretKey = new Uint8Array(keyArray);
  } else {
    // Base58 format
    console.log("🔑 [UNSWAP] Private key is in base58 format");
    secretKey = bs58.decode(env.PRIVATE_KEY);
  }

  const wallet = Keypair.fromSecretKey(secretKey);
  console.log("💰 [UNSWAP] Wallet address:", wallet.publicKey.toString());

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

  async function attemptUnSwapToken(retryCount: number): Promise<SellSwapResult> {
    try {
      const quoteResponse = await axios.get<JupiterSwapQuoteResponse>(`${process.env.JUPITER_ENDPOINT}/swap/v1/quote`, {
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

      // Extract swap amounts from quote response
      const tokensSold = parseInt(quoteResponse.data.inAmount);  // Input = tokens being sold
      const solReceived = parseInt(quoteResponse.data.outAmount) / LAMPORTS_PER_SOL;  // Output = SOL received
      console.log(`📊 [UNSWAP] Quote: ${tokensSold} tokens → ${solReceived.toFixed(6)} SOL`);

      const swapResponse = await axios.post<JupiterSwapResponse>(`${process.env.JUPITER_ENDPOINT}/swap/v1/swap`, {
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
       * Return successful with actual swap amounts
       */
      return {
        success: true,
        solReceived,
        tokensSold,
        txSignature: signature,
        priceImpactPct: quoteResponse.data.priceImpactPct
      };
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        logEngine.writeLog(`🤞 Jupiter`, `Sell retry attempt ${retryCount + 1}/${MAX_RETRIES}`, "yellow");
        // Wait for the specified delay
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        // Recursive call with incremented retry count
        return attemptUnSwapToken(retryCount + 1);
      }

      // Handle axios errors
      let errorMessage: string;
      if (axios.isAxiosError(error)) {
        errorMessage = `Jupiter API error (${error.response?.status || "unknown"}): ${error.response?.statusText}`;
        logEngine.writeLog(`❌ Jupiter`, errorMessage, "red");
      } else {
        errorMessage = error instanceof Error ? error.message : "Unknown error";
        logEngine.writeLog(`❌ Jupiter`, `Error selling token: ${errorMessage}`, "red");
      }
      return { success: false, error: errorMessage };
    }
  }

  // Start with retry count 0
  return attemptUnSwapToken(0);
}

/**
 * Get current token price in SOL using Jupiter Price API v2
 * Created: October 28, 2025 (Step 3B)
 * Purpose: Replace random simulation placeholder with real market prices
 *
 * @param tokenMint - Token mint address to get price for
 * @returns Price in SOL per token, or 0 if API fails
 */
// ⚠️ DEPRECATED: Removed export to prevent usage - use gRPC PositionMonitor instead
async function getCurrentTokenPrice_DEPRECATED(tokenMint: string): Promise<number> {
  try {
    // Rate limit protection - same as swap (100ms delay)
    const rateDelay = parseInt(process.env.JUPITER_DELAY_MS || '100');
    await new Promise(resolve => setTimeout(resolve, rateDelay));

    console.log(`💰 [PRICE] Fetching price for ${tokenMint.slice(0, 8)}...`);

    // Call Jupiter Price API v2 via lite-api (free tier, no auth required)
    const jupiterEndpoint = process.env.JUPITER_ENDPOINT || 'https://lite-api.jup.ag';
    const response = await axios.get(`${jupiterEndpoint}/price/v2`, {
      params: {
        ids: tokenMint
      },
      timeout: 5000
    });

    // Extract price from response
    // Response format: { data: { <mint>: { id: string, price: string } } }
    const priceData = response.data?.data?.[tokenMint];

    if (!priceData || !priceData.price) {
      console.warn(`⚠️ [PRICE] No price data for ${tokenMint.slice(0, 8)}`);
      return 0;
    }

    const priceInUSD = parseFloat(priceData.price);

    // Get SOL price in USD to convert
    const solPriceResponse = await axios.get(`${jupiterEndpoint}/price/v2`, {
      params: {
        ids: 'So11111111111111111111111111111111111111112' // Wrapped SOL mint
      },
      timeout: 5000
    });

    const solPriceInUSD = parseFloat(
      solPriceResponse.data?.data?.['So11111111111111111111111111111111111111112']?.price || '0'
    );

    if (solPriceInUSD === 0) {
      console.warn('⚠️ [PRICE] Could not get SOL price for conversion');
      return 0;
    }

    // Convert token price from USD to SOL
    const priceInSOL = priceInUSD / solPriceInUSD;

    console.log(`✅ [PRICE] ${tokenMint.slice(0, 8)}: ${priceInSOL.toFixed(10)} SOL ($${priceInUSD.toFixed(8)})`);

    return priceInSOL;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `❌ [PRICE] Jupiter Price API error (${error.response?.status || 'unknown'}):`,
        error.response?.statusText || error.message
      );
    } else {
      console.error(
        `❌ [PRICE] Error fetching price:`,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    // Return 0 on error - monitoring loop will skip this update
    return 0;
  }
}
