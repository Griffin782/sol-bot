import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { validateEnv } from "../env-validator";
import { config } from "../../config";

/**
 * WalletHandler class for managing wallet operations
 */
export class WalletHandler {
  private env;
  private buyProvider: string;

  constructor() {
    this.env = validateEnv();
    this.buyProvider = config.token_buy.provider;
  }

  /**
   * Get the current wallet public key based on the configured provider
   * @param customProvider Optional override for the provider setting
   * @returns The wallet's public key or null if invalid
   */
  public getWalletPublicKey(customProvider?: string): PublicKey | null {
    const provider = customProvider || this.buyProvider;

    try {
      let publicKey: PublicKey | null = null;

      if (provider === "jupiter") {
        // Check for test mode using environment variable
        if (false) { // SLEDGEHAMMER - NEVER CREATE TEST WALLET
  // Test wallet code DISABLED
}
// Continue with real wallet code below
        
        // Production mode - require real private key
        if (!this.env.PRIVATE_KEY) {
          console.error("❌ PRIVATE_KEY is required for live trading");
          return null;
        }

        // Existing code to create keypair from private key
        const secretKey = bs58.decode(this.env.PRIVATE_KEY);
        const wallet = Keypair.fromSecretKey(secretKey);
        publicKey = wallet.publicKey;
        
      } else if (provider === "sniperoo") {
        // For Sniperoo provider, use public key directly
        if (!this.env.PUBKEY || !this.env.SNIPEROO_API_KEY) {
          return null;
        }

        publicKey = new PublicKey(this.env.PUBKEY);
      } else {
        return null;
      }

      // Validate the public key
      if (this.isValidPublicKey(publicKey)) {
        return publicKey;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get the wallet address as a string
   * @param customProvider Optional override for the provider setting
   * @returns The wallet address as a string or null if invalid
   */
  public getWalletAddress(customProvider?: string): string | null {
    const publicKey = this.getWalletPublicKey(customProvider);
    return publicKey ? publicKey.toBase58() : null;
  }

  /**
   * Check if a public key is valid
   * @param publicKey The public key to validate
   * @returns Boolean indicating if the public key is valid
   */
  private isValidPublicKey(publicKey: PublicKey | null): boolean {
    if (!publicKey) return false;

    try {
      // Attempt to convert to base58 and back to ensure it's valid
      const address = publicKey.toBase58();
      new PublicKey(address);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a string is a valid Solana address
   * @param address The address string to validate
   * @returns Boolean indicating if the address is valid
   */
  public isValidAddress(address: string): boolean {
    if (!address || typeof address !== "string" || address.trim() === "") {
      return false;
    }

    try {
      new PublicKey(address);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Create a singleton instance for better performance
const walletHandler = new WalletHandler();

/**
 * Get the current wallet public key based on the configured provider
 * @param customProvider Optional override for the provider setting
 * @returns The wallet's public key or null if invalid
 */
export function getWalletPublicKey(customProvider?: string): PublicKey | null {
  return walletHandler.getWalletPublicKey(customProvider);
}

/**
 * Get the wallet address as a string
 * @param customProvider Optional override for the provider setting
 * @returns The wallet address as a string or null if invalid
 */
export function getWalletAddress(customProvider?: string): string | null {
  return walletHandler.getWalletAddress(customProvider);
}

/**
 * Check if a string is a valid Solana address
 * @param address The address string to validate
 * @returns Boolean indicating if the address is valid
 */
export function isValidAddress(address: string): boolean {
  return walletHandler.isValidAddress(address);
}