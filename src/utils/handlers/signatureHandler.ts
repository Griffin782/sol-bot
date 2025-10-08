import { heliusLimiter } from '../rateLimiter';
import { Connection } from "@solana/web3.js";
import { validateEnv } from "../env-validator";
import { config } from "../../config";

// Constants
const WSOL_MINT = config.wsol_pc_mint;

interface returnedMintData {
  tokenMint: string;
  isSell: boolean;
}

/**
 * SignatureHandler class optimized for speed
 */
export class SignatureHandler {
  private connection: Connection;

  constructor(connection?: Connection) {
    const env = validateEnv();
    this.connection = connection || new Connection(env.RPC_HTTPS_URI, "confirmed");
  }

  /**
   * Get the mint address from a transaction signature - optimized for speed
   * @param signature Transaction signature
   * @returns Promise resolving to mint address or null
   */
  public async getMintFromSignature(signature: string, isTokenSell: boolean | undefined): Promise<returnedMintData | null> {
    if (!signature || typeof signature !== "string" || signature.trim() === "") {
      return null; // Invalid signature, return null immediately
    }

    try {
      // Fetch transaction with minimal options
      await heliusLimiter.waitIfNeeded();  // ADD THIS LIN
      let tx = await this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });

      // Quick validation with retry
      if (!tx?.meta) {
        // Wait 200ms and try one more time
        await new Promise((resolve) => setTimeout(resolve, 200));
        tx = await this.connection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });

        // If still no meta data, return null
        if (!tx?.meta) return null;
      }

      // Get token balances - prefer postTokenBalances as they're more likely to contain the new token
      const tokenBalances = tx.meta.postTokenBalances || tx.meta.preTokenBalances;
      if (!tokenBalances?.length) return null;

      // Fast path: If we have exactly 2 token balances, one is likely WSOL and the other is the token
      let returnedMint;
      if (tokenBalances.length === 2) {
        const mint1 = tokenBalances[0].mint;
        const mint2 = tokenBalances[1].mint;

        // If mint1 is WSOL, return mint2 (unless it's also WSOL)
        if (mint1 === WSOL_MINT) {
          returnedMint = mint2 === WSOL_MINT ? null : mint2;
        }

        // If mint2 is WSOL, return mint1
        if (mint2 === WSOL_MINT) {
          returnedMint = mint1;
        }

        // If neither is WSOL, return the first one
        returnedMint = mint1;
      } else {
        // For more than 2 balances, find the first non-WSOL mint
        for (const balance of tokenBalances) {
          if (balance.mint !== WSOL_MINT) {
            returnedMint = balance.mint;
          }
        }
      }

      /**
       *  Verify if a mint was found
       */
      if (!returnedMint) return null;

      /**
       *  Verify token flow direction if undefined
       */
      if (isTokenSell === undefined) {
        if (tx.meta.postTokenBalances && tx.meta.preTokenBalances) {
          const pre = tx.meta.preTokenBalances.find((b) => b.mint === returnedMint);
          const post = tx.meta.postTokenBalances.find((b) => b.mint === returnedMint);
          if (pre?.uiTokenAmount?.amount && post?.uiTokenAmount?.amount) {
            isTokenSell = Number(post.uiTokenAmount.amount) < Number(pre.uiTokenAmount.amount);
            return {
              isSell: isTokenSell,
              tokenMint: returnedMint,
            };
          }
        }
        return null;
      } else {
        return {
          isSell: isTokenSell,
          tokenMint: returnedMint,
        };
      }
    } catch (error) {
      // Minimal error logging for speed
      return null;
    }
  }
}

// Create a singleton instance for better performance
const signatureHandler = new SignatureHandler();

/**
 * Get the mint address from a transaction signature (optimized for speed)
 * @param signature Transaction signature
 * @returns Mint address or null
 */
export async function getMintFromSignature(signature: string, isTokenSell: boolean | undefined): Promise<returnedMintData | null> {
  return signatureHandler.getMintFromSignature(signature, isTokenSell);
}
