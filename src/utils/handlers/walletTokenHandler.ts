import { Connection, PublicKey } from "@solana/web3.js";
import { AccountLayout, TOKEN_PROGRAM_ID, getMint } from "@solana/spl-token";
import { validateEnv } from "../env-validator";

/**
 * Interface for token account information
 */
export interface TokenAccountInfo {
  mint: string;
  address: string;
  amount: string;
  decimals: number;
  uiAmount: number;
}

/**
 * WalletTokenManager class for retrieving token accounts for a wallet
 */
export class WalletTokenManager {
  private connection: Connection;

  constructor(connection?: Connection) {
    const env = validateEnv();
    this.connection = connection || new Connection(env.RPC_HTTPS_URI, "processed");
  }

  /**
   * Get all token accounts for a wallet
   * @param walletAddress The wallet address to check
   * @param minAmount Minimum token amount to include (optional)
   * @returns Array of token account information
   */
  public async getWalletTokenAccounts(walletAddress: string, minAmount: number = 0): Promise<TokenAccountInfo[]> {
    try {
      if (!walletAddress || typeof walletAddress !== "string" || walletAddress.trim() === "") {
        throw new Error("Invalid wallet address");
      }

      const walletPublicKey = new PublicKey(walletAddress);
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(walletPublicKey, {
        programId: TOKEN_PROGRAM_ID,
      });

      const tokenInfoPromises = tokenAccounts.value
        .map((tokenAccount) => {
          const accountInfo = AccountLayout.decode(tokenAccount.account.data);
          const amount = BigInt(accountInfo.amount.toString());

          if (amount === 0n) return null;

          const mintAddress = new PublicKey(accountInfo.mint).toBase58();
          const pubkey = tokenAccount.pubkey.toBase58();

          return (async () => {
            const mintInfo = await getMint(this.connection, new PublicKey(mintAddress));
            const decimals = mintInfo.decimals;
            const uiAmount = Number(amount) / Math.pow(10, decimals);

            return {
              mint: mintAddress,
              address: pubkey,
              amount: amount.toString(),
              decimals,
              uiAmount,
            };
          })();
        })
        .filter(Boolean); // Remove nulls

      const tokenInfos = await Promise.all(tokenInfoPromises as Promise<any>[]);

      return tokenInfos.filter((info) => info.uiAmount >= minAmount);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all tokens with balances for a wallet
   * @param walletAddress The wallet address to check
   * @param minAmount Minimum token amount to include (optional)
   * @returns Array of token account information
   */
  public async getWalletTokenBalances(walletAddress: string, minAmount: number = 0): Promise<TokenAccountInfo[]> {
    try {
      const tokenAccounts = await this.getWalletTokenAccounts(walletAddress, minAmount);

      // Sort by UI amount in descending order
      return tokenAccounts.sort((a, b) => b.uiAmount - a.uiAmount);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if a wallet holds a specific token
   * @param walletAddress The wallet address to check
   * @param mintAddress The token's mint address
   * @returns Token account info if found, null otherwise
   */
  public async getWalletTokenBalance(walletAddress: string, mintAddress: string): Promise<TokenAccountInfo | null> {
    try {
      const tokenAccounts = await this.getWalletTokenAccounts(walletAddress);
      return tokenAccounts.find((account) => account.mint === mintAddress) || null;
    } catch (error) {
      return null;
    }
  }
}

// Create a singleton instance for better performance
const walletTokenManager = new WalletTokenManager();

/**
 * Get all token accounts for a wallet
 * @param walletAddress The wallet address to check
 * @param minAmount Minimum token amount to include (optional)
 * @returns Array of token account information
 */
export async function getWalletTokenAccounts(walletAddress: string, minAmount: number = 0): Promise<TokenAccountInfo[]> {
  return walletTokenManager.getWalletTokenAccounts(walletAddress, minAmount);
}

/**
 * Get all tokens with balances for a wallet
 * @param walletAddress The wallet address to check
 * @param minAmount Minimum token amount to include (optional)
 * @returns Array of token account information
 */
export async function getWalletTokenBalances(walletAddress: string, minAmount: number = 0): Promise<TokenAccountInfo[]> {
  return walletTokenManager.getWalletTokenBalances(walletAddress, minAmount);
}

/**
 * Check if a wallet holds a specific token
 * @param walletAddress The wallet address to check
 * @param mintAddress The token's mint address
 * @returns Token account info if found, null otherwise
 */
export async function getWalletTokenBalance(walletAddress: string, mintAddress: string): Promise<TokenAccountInfo | null> {
  return walletTokenManager.getWalletTokenBalance(walletAddress, mintAddress);
}
