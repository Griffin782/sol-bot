// VIP-Token-Check.ts - Fast, reliable token validation using on-chain data only
// Extracted from VIP-SolanaTokenSniper for Sol-bot integration
// No external API dependencies - works immediately for new tokens

import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { MPL_TOKEN_METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';
import { validateEnv } from './env-validator';

// Simple scam word list - can be expanded
const BLOCK_NAMES = ['pump', 'scam', 'rug', 'fake', 'test', 'shit'];
const BLOCK_SYMBOLS = ['SCAM', 'RUG', 'FAKE', 'TEST'];

interface TokenAuthorityStatus {
  hasMintAuthority: boolean;
  hasFreezeAuthority: boolean;
  isSecure: boolean;
}

interface VipCheckConfig {
  allowMintAuthority: boolean;
  allowFreezeAuthority: boolean;
  blockNames: string[];
  blockSymbols: string[];
  allowNames: string[];
  allowSymbols: string[];
}

// Default configuration - can be overridden
const DEFAULT_CONFIG: VipCheckConfig = {
  allowMintAuthority: false,      // Block tokens with mint authority
  allowFreezeAuthority: false,    // Block tokens with freeze authority
  blockNames: BLOCK_NAMES,
  blockSymbols: BLOCK_SYMBOLS,
  allowNames: [],                 // Empty = allow all
  allowSymbols: []               // Empty = allow all
};

export class VipTokenChecker {
  private connection: Connection;
  private config: VipCheckConfig;

  constructor(config: Partial<VipCheckConfig> = {}) {
    const env = validateEnv();
    this.connection = new Connection(env.RPC_HTTPS_URI, 'confirmed');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a token's mint and freeze authorities are still enabled
   * @param mintAddress The token's mint address (contract address)
   * @returns Promise<TokenAuthorityStatus> Authority status information
   */
  public async getTokenAuthorities(mintAddress: string): Promise<TokenAuthorityStatus> {
    try {
      const tokenPublicKey = new PublicKey(mintAddress);
      const mintInfo = await getMint(this.connection, tokenPublicKey);

      const hasMintAuthority = mintInfo.mintAuthority !== null;
      const hasFreezeAuthority = mintInfo.freezeAuthority !== null;

      return {
        hasMintAuthority,
        hasFreezeAuthority,
        isSecure: !hasMintAuthority && !hasFreezeAuthority
      };
    } catch (error) {
      console.log(`⚠️ [VIP-CHECK] Error getting token authorities: ${error}`);
      return {
        hasMintAuthority: true,   // Assume dangerous if we can't check
        hasFreezeAuthority: true,
        isSecure: false
      };
    }
  }

  /**
   * Fast token security and allowlist check using only on-chain data
   * @param mintAddress The token's mint address
   * @returns Promise<boolean> indicating if the token passes security checks
   */
  public async isTokenSecureAndAllowed(mintAddress: string): Promise<boolean> {
    try {
      console.log(`🔍 [VIP-CHECK] Checking token: ${mintAddress.slice(0, 8)}...`);

      // Check Names and symbols using direct metadata parsing
      const mintPublicKey = new PublicKey(mintAddress);
      const programId = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);

      // Compute the metadata PDA
      const [metadataPDA] = PublicKey.findProgramAddressSync([
        Buffer.from("metadata"),
        programId.toBuffer(),
        mintPublicKey.toBuffer()
      ], programId);

      // Fetch the account data
      const accountInfo = await this.connection.getAccountInfo(metadataPDA);
      if (!accountInfo) {
        console.log(`⚠️ [VIP-CHECK] Token metadata not found`);
        return false;
      }

      let name = '';
      let symbol = '';

      try {
        // Manual parsing of metadata - no external API needed!
        let offset = 1;  // Skip the first byte (key)

        // Skip update authority (32 bytes) and mint (32 bytes)
        offset += 64;

        // Read name length (first 4 bytes are the size of the string)
        const nameLength = accountInfo.data.slice(offset, offset + 4).readUInt32LE(0);
        offset += 4;

        // Read name (up to 32 bytes)
        name = accountInfo.data.slice(offset, offset + nameLength).toString("utf8");
        offset += 32; // Fixed size in the struct

        // Read symbol length
        const symbolLength = accountInfo.data.slice(offset, offset + 4).readUInt32LE(0);
        offset += 4;

        // Read symbol (up to 10 bytes)
        symbol = accountInfo.data.slice(offset, offset + symbolLength).toString("utf8");

        console.log(`✅ [VIP-CHECK] Token ${name} (${symbol}) metadata parsed successfully`);
      } catch (metadataError) {
        console.log(`⚠️ [VIP-CHECK] Error parsing metadata, allowing trade anyway`);
        // Don't block trade just because metadata parsing failed
        name = '';
        symbol = '';
      }

      // Check if token name or symbol contains any blocked substrings
      const nameLower = name.toLowerCase();
      const symbolLower = symbol.toLowerCase();

      // Filter out empty strings from the lists
      const validBlockNames = this.config.blockNames.filter(name => name && name.trim() !== "");
      const validBlockSymbols = this.config.blockSymbols.filter(symbol => symbol && symbol.trim() !== "");
      const validAllowNames = this.config.allowNames.filter(name => name && name.trim() !== "");
      const validAllowSymbols = this.config.allowSymbols.filter(symbol => symbol && symbol.trim() !== "");

      // Check blocked lists (partial matching)
      const isNameBlocked = validBlockNames.some(blockedName =>
        nameLower.includes(blockedName.toLowerCase())
      );
      const isSymbolBlocked = validBlockSymbols.some(blockedSymbol =>
        symbolLower.includes(blockedSymbol.toLowerCase())
      );

      if (isNameBlocked || isSymbolBlocked) {
        console.log(`🚫 [VIP-CHECK] Token name or symbol contains blocked word`);
        return false;
      }

      // Check allowed lists (partial matching)
      if (validAllowNames.length > 0) {
        const isNameAllowed = validAllowNames.some(allowedName =>
          nameLower.includes(allowedName.toLowerCase())
        );
        if (!isNameAllowed) {
          console.log(`🚫 [VIP-CHECK] Token name not in allowed list`);
          return false;
        }
      }

      if (validAllowSymbols.length > 0) {
        const isSymbolAllowed = validAllowSymbols.some(allowedSymbol =>
          symbolLower.includes(allowedSymbol.toLowerCase())
        );
        if (!isSymbolAllowed) {
          console.log(`🚫 [VIP-CHECK] Token symbol not in allowed list`);
          return false;
        }
      }

      // Check Authorities - this is the critical security check
      const authorityStatus = await this.getTokenAuthorities(mintAddress);

      // Token is secure if:
      // 1. It has no mint authority OR mint authority is allowed in config
      // 2. It has no freeze authority OR freeze authority is allowed in config
      const authorityCheckPassed = (
        (!authorityStatus.hasMintAuthority || this.config.allowMintAuthority) &&
        (!authorityStatus.hasFreezeAuthority || this.config.allowFreezeAuthority)
      );

      if (!authorityCheckPassed) {
        console.log(`🚫 [VIP-CHECK] Token failed authority checks`);
        console.log(`   Mint Authority: ${authorityStatus.hasMintAuthority} (allowed: ${this.config.allowMintAuthority})`);
        console.log(`   Freeze Authority: ${authorityStatus.hasFreezeAuthority} (allowed: ${this.config.allowFreezeAuthority})`);
        return false;
      }

      console.log(`✅ [VIP-CHECK] Token passed all security checks`);
      return true;

    } catch (error) {
      console.log(`⚠️ [VIP-CHECK] Error checking token, blocking for safety: ${error}`);
      return false; // Consider token insecure if there's an error
    }
  }

  /**
   * Quick mode check - only authorities, no name/symbol filtering
   * Fastest possible check for high-speed trading
   */
  public async quickSecurityCheck(mintAddress: string): Promise<boolean> {
    try {
      console.log(`⚡ [VIP-CHECK] Quick check: ${mintAddress.slice(0, 8)}...`);

      const authorityStatus = await this.getTokenAuthorities(mintAddress);

      const passed = (
        (!authorityStatus.hasMintAuthority || this.config.allowMintAuthority) &&
        (!authorityStatus.hasFreezeAuthority || this.config.allowFreezeAuthority)
      );

      if (passed) {
        console.log(`⚡ [VIP-CHECK] Quick check PASSED`);
      } else {
        console.log(`⚡ [VIP-CHECK] Quick check FAILED - dangerous authorities`);
      }

      return passed;
    } catch (error) {
      console.log(`⚠️ [VIP-CHECK] Quick check error, blocking: ${error}`);
      return false;
    }
  }
}

// Factory function for easy integration
export function createVipChecker(config?: Partial<VipCheckConfig>): VipTokenChecker {
  return new VipTokenChecker(config);
}

// Legacy function for direct replacement of enforceQualityFilter
export async function vipTokenCheck(
  mintAddress: string,
  config?: Partial<VipCheckConfig>
): Promise<boolean> {
  const checker = new VipTokenChecker(config);
  return checker.isTokenSecureAndAllowed(mintAddress);
}

// Quick check for speed-critical situations
export async function vipQuickCheck(
  mintAddress: string,
  config?: Partial<VipCheckConfig>
): Promise<boolean> {
  const checker = new VipTokenChecker(config);
  return checker.quickSecurityCheck(mintAddress);
}