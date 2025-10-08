import { heliusLimiter } from '../rateLimiter';
import { Connection, PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import { config } from "../../config";
import { validateEnv } from "../env-validator";
import { MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { logEngine } from "../managers/logManager";
import { differenceInSeconds } from "date-fns";

/**
 * TokenCheckManager class for verifying token security properties
 */
export class TokenCheckManager {
  private connection: Connection;

  constructor(connection?: Connection) {
    const env = validateEnv();
    this.connection = connection || new Connection(env.RPC_HTTPS_URI, "confirmed");
  }

  /**
   * Check if a token's mint and freeze authorities are still enabled
   * @param mintAddress The token's mint address (contract address)
   * @returns Object containing authority status and details
   */
  public async getTokenAuthorities(mintAddress: string): Promise<TokenAuthorityStatus> {
    try {
      // Validate mint address
      if (!mintAddress || typeof mintAddress !== "string" || mintAddress.trim() === "") {
        throw new Error("Invalid mint address");
      }

      const mintPublicKey = new PublicKey(mintAddress);
      const mintInfo = await getMint(this.connection, mintPublicKey);

      // Check if mint authority exists (is not null)
      const hasMintAuthority = mintInfo.mintAuthority !== null;

      // Check if freeze authority exists (is not null)
      const hasFreezeAuthority = mintInfo.freezeAuthority !== null;

      // Get the addresses as strings if they exist
      const mintAuthorityAddress = mintInfo.mintAuthority ? mintInfo.mintAuthority.toBase58() : null;
      const freezeAuthorityAddress = mintInfo.freezeAuthority ? mintInfo.freezeAuthority.toBase58() : null;

      return {
        mintAddress: mintAddress,
        hasMintAuthority,
        hasFreezeAuthority,
        mintAuthorityAddress,
        freezeAuthorityAddress,
        isSecure: !hasMintAuthority && !hasFreezeAuthority,
        details: {
          supply: mintInfo.supply.toString(),
          decimals: mintInfo.decimals,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get the creation time of a token using its metadata account
   * @param mintAddress The token's mint address
   * @returns Promise with the creation timestamp in seconds, or null if not found
   */
  public async getTokenCreationTime(mintAddress: string): Promise<boolean> {
    const minAgeSeconds = config.checks.settings.min_token_age_seconds || 0;
    const maxAgeSeconds = config.checks.settings.max_token_age_seconds || 0;
    const signatureHistory = config.checks.settings.signature_history || 10;
    if (minAgeSeconds === 0 && maxAgeSeconds === 0) return true;

    /** Helper function */
    function isBetween(num: number) {
      const aboveMin = minAgeSeconds > 0 ? num >= minAgeSeconds : true;
      const belowMax = maxAgeSeconds > 0 ? num <= maxAgeSeconds : true;
      return aboveMin && belowMax;
    }

    try {
      // Validate mint address
      if (!mintAddress || typeof mintAddress !== "string" || mintAddress.trim() === "") {
        throw new Error("Invalid mint address");
      }

      // Create public key
      const mintPublicKey = new PublicKey(mintAddress);

      // First try to get the metadata account creation time
      try {
        // Compute the metadata PDA
        const programId = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);
        const [metadataPDA] = PublicKey.findProgramAddressSync([Buffer.from("metadata"), programId.toBuffer(), mintPublicKey.toBuffer()], programId);

        // Get the signatures for the metadata account
        await heliusLimiter.waitIfNeeded();  // ADD THIS LINE
        const metadataSignatures = await this.connection.getSignaturesForAddress(metadataPDA, { limit: signatureHistory });
        if (metadataSignatures.length > 0) {
          // Get the oldest signature (last in the array)
          const oldestMetadataTx = metadataSignatures[metadataSignatures.length - 1];
          const metadataBlockTime = await this.connection.getBlockTime(oldestMetadataTx.slot);

          if (metadataBlockTime) {
            // Check actual seconds
            const date = new Date(metadataBlockTime * 1000);
            const now = new Date();
            const secondsAgo = differenceInSeconds(now, date);
            logEngine.writeLog(
              `🔎 Token Age`,
              `Found metadata creation time: ${new Date(metadataBlockTime * 1000).toISOString()} - ${secondsAgo} seconds ago.`,
              "green"
            );
            if (isBetween(secondsAgo)) return true;
            return false;
          }
        }
      } catch (metadataError: any) {
        logEngine.writeLog(`🔎 Token Age`, `Error getting metadata creation time: ${metadataError.message || String(metadataError)}`, "yellow");
        // Continue to try mint account if metadata fails
      }

      // Fallback to mint account creation time
      const mintSignatures = await this.connection.getSignaturesForAddress(mintPublicKey, { limit: signatureHistory });
      if (mintSignatures.length === 0) {
        logEngine.writeLog(`🔎 Token Age`, `No transactions found for token`, "red");
        return false;
      }

      // Find the earliest transaction (oldest slot)
      const oldestMintTx = mintSignatures[mintSignatures.length - 1];
      const mintBlockTime = await this.connection.getBlockTime(oldestMintTx.slot);

      if (!mintBlockTime) {
        logEngine.writeLog(`🔎 Token Age`, `Could not get block time for token`, "red");
        return false;
      }

      // Check actual seconds
      const dateMint = new Date(mintBlockTime * 1000);
      const nowMint = new Date();
      const secondsAgoMint = differenceInSeconds(nowMint, dateMint);
      logEngine.writeLog(`🔎 Token Age`, `Found mint creation time: ${new Date(mintBlockTime * 1000).toISOString()} - ${secondsAgoMint} seconds ago.`, "green");
      if (isBetween(secondsAgoMint)) return true;
      return false;
    } catch (error: any) {
      logEngine.writeLog(`🔎 Token Age`, `Error getting token creation time: ${error.message || String(error)}`, "red");
      return false;
    }
  }

  /**
   * Simplified check that returns only whether the token passes security checks
   * based on the configuration settings
   * @param mintAddress The token's mint address
   * @returns Boolean indicating if the token passes security checks
   */
  public async isTokenSecureAndAllowed(mintAddress: string): Promise<boolean> {
    try {
      // Check Names and symbols
      const allowNames = config.checks.settings.allow_names;
      const allowSymbols = config.checks.settings.allow_symbols;
      const blockNames = config.checks.settings.block_names;
      const blockSymbols = config.checks.settings.block_symbols;

      // Compute the metadata PDA
      const mintPublicKey = new PublicKey(mintAddress);
      const programId = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);
      // Compute the metadata PDA
      const [metadataPDA] = PublicKey.findProgramAddressSync([Buffer.from("metadata"), programId.toBuffer(), mintPublicKey.toBuffer()], programId);

      // Fetch the account data
      const accountInfo = await this.connection.getAccountInfo(metadataPDA);
      if (!accountInfo) {
        logEngine.writeLog(`🔎 Security`, `Token metadata not found`, "red");
        return false;
      }

      try {
        // Manual parsing of metadata
        // Skip the first byte (key)
        let offset = 1;

        // Skip update authority (32 bytes) and mint (32 bytes)
        offset += 64;

        // Read name length (first 4 bytes are the size of the string)
        const nameLength = accountInfo.data.slice(offset, offset + 4).readUInt32LE(0);
        offset += 4;

        // Read name (up to 32 bytes)
        const name = accountInfo.data.slice(offset, offset + nameLength).toString("utf8");
        offset += 32; // Fixed size in the struct

        // Read symbol length
        const symbolLength = accountInfo.data.slice(offset, offset + 4).readUInt32LE(0);
        offset += 4;

        // Read symbol (up to 10 bytes)
        const symbol = accountInfo.data.slice(offset, offset + symbolLength).toString("utf8");
        logEngine.writeLog(`🔎 Security`, `Token ${name} (${symbol}) metadata parsed successfully.`, "green");

        // Check if token name or symbol contains any blocked substrings
        const nameLower = name.toLowerCase();
        const symbolLower = symbol.toLowerCase();

        // Filter out empty strings from the lists
        const validBlockNames = blockNames.filter((name) => name && name.trim() !== "");
        const validBlockSymbols = blockSymbols.filter((symbol) => symbol && symbol.trim() !== "");
        const validAllowNames = allowNames.filter((name) => name && name.trim() !== "");
        const validAllowSymbols = allowSymbols.filter((symbol) => symbol && symbol.trim() !== "");

        // Check blocked lists (partial matching)
        const isNameBlocked = validBlockNames.some((blockedName) => nameLower.includes(blockedName.toLowerCase()));
        const isSymbolBlocked = validBlockSymbols.some((blockedSymbol) => symbolLower.includes(blockedSymbol.toLowerCase()));
        if (isNameBlocked || isSymbolBlocked) {
          logEngine.writeLog(`🔎 Security`, `Token name or symbol contains a blocked substring`, "red");
          return false;
        }

        // Check allowed lists (partial matching)
        if (validAllowNames.length > 0) {
          const isNameAllowed = validAllowNames.some((allowedName) => nameLower.includes(allowedName.toLowerCase()));
          if (!isNameAllowed) {
            logEngine.writeLog(`🔎 Security`, `Token name does not contain any allowed substring`, "red");
            return false;
          }
        }
        if (validAllowSymbols.length > 0) {
          const isSymbolAllowed = validAllowSymbols.some((allowedSymbol) => symbolLower.includes(allowedSymbol.toLowerCase()));
          if (!isSymbolAllowed) {
            logEngine.writeLog(`🔎 Security`, `Token symbol does not contain any allowed substring`, "red");
            return false;
          }
        }
      } catch (metadataError) {
        logEngine.writeLog(`🔎 Security`, `Error parsing metadata`, "red");
        return false;
      }

      // Check Authorities
      const allowMintAuthority = config.checks.settings.allow_mint_authority;
      const allowFreezeAuthority = config.checks.settings.allow_freeze_authority;
      const authorityStatus = await this.getTokenAuthorities(mintAddress);

      // Token is secure if:
      // 1. It has no mint authority OR mint authority is allowed in config
      // 2. It has no freeze authority OR freeze authority is allowed in config
      return (!authorityStatus.hasMintAuthority || allowMintAuthority) && (!authorityStatus.hasFreezeAuthority || allowFreezeAuthority);
    } catch (error) {
      return false; // Consider token insecure if there's an error
    }
  }
}

/**
 * Interface for token authority check results
 */
export interface TokenAuthorityStatus {
  mintAddress: string;
  hasMintAuthority: boolean;
  hasFreezeAuthority: boolean;
  mintAuthorityAddress: string | null;
  freezeAuthorityAddress: string | null;
  isSecure: boolean;
  details: {
    supply: string;
    decimals: number;
  };
}

// Create a singleton instance for better performance
const tokenCheckManager = new TokenCheckManager();

/**
 * Check if a token's mint and freeze authorities are still enabled
 * @param mintAddress The token's mint address
 * @returns Object containing authority status and details
 */
export async function getTokenAuthorities(mintAddress: string): Promise<TokenAuthorityStatus> {
  return tokenCheckManager.getTokenAuthorities(mintAddress);
}

/**
 * Check if a token passes security checks based on configuration
 * @param mintAddress The token's mint address
 * @returns Boolean indicating if the token passes security checks
 */
export async function isTokenSecureAndAllowed(mintAddress: string): Promise<boolean> {
  return tokenCheckManager.isTokenSecureAndAllowed(mintAddress);
}

/**
 * Get the creation time of a token using its metadata account
 * @param mintAddress The token's mint address
 * @returns Promise with the creation timestamp in seconds, or null if not found
 */
export async function getTokenCreationTime(mintAddress: string): Promise<boolean> {
  return tokenCheckManager.getTokenCreationTime(mintAddress);
}
