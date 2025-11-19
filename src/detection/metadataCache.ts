/**
 * Metadata Cache - Post-Fetch Storage for Token Metadata
 *
 * UPDATED Nov 10, 2025:
 * - gRPC subscription approach was NOT viable (Yellowstone limitation)
 * - Now using on-demand RPC fetching with VIP2 retry logic
 * - This cache stores metadata AFTER fetching (not proactive caching)
 *
 * PURPOSE:
 * - Store fetched metadata to avoid repeated RPC calls
 * - Provide quick lookups for already-seen tokens
 * - Helper functions for metadata parsing and PDA derivation
 *
 * NOTE: Metadata is fetched on-demand when tokens detected
 * See tokenHandler.ts for VIP2 retry logic (200ms + 100ms + 100ms)
 */

import { PublicKey } from '@solana/web3.js';
import { MPL_TOKEN_METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';

export interface CachedMetadata {
  name: string;
  symbol: string;
  timestamp: number;
}

/**
 * Metadata Cache - In-memory cache populated by RPC fetches (post-detection)
 */
export class MetadataCache {
  private cache: Map<string, CachedMetadata> = new Map();
  private maxAge: number = 3600000; // 1 hour (metadata doesn't change)

  /**
   * Derive metadata PDA for a mint address
   */
  public deriveMetadataPDA(mintAddress: string): string {
    const mintPublicKey = new PublicKey(mintAddress);
    const programId = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);

    const [metadataPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("metadata"),
      programId.toBuffer(),
      mintPublicKey.toBuffer()
    ], programId);

    return metadataPDA.toBase58();
  }

  /**
   * Parse metadata from account data
   * (Same parsing logic as vipTokenCheck, but reusable)
   */
  public parseMetadata(accountData: Buffer): { name: string; symbol: string } | null {
    try {
      // Skip the first byte (key discriminator)
      let offset = 1;

      // Skip update authority (32 bytes) and mint (32 bytes)
      offset += 64;

      // Read name length (first 4 bytes)
      const nameLength = accountData.slice(offset, offset + 4).readUInt32LE(0);
      offset += 4;

      // Read name (up to 32 bytes)
      const name = accountData.slice(offset, offset + nameLength).toString("utf8").trim();
      offset += 32; // Fixed size in the struct

      // Read symbol length
      const symbolLength = accountData.slice(offset, offset + 4).readUInt32LE(0);
      offset += 4;

      // Read symbol (up to 10 bytes)
      const symbol = accountData.slice(offset, offset + symbolLength).toString("utf8").trim();

      return { name, symbol };
    } catch (error) {
      console.log(`⚠️ [METADATA CACHE] Failed to parse metadata: ${error}`);
      return null;
    }
  }

  /**
   * Add metadata to cache (called after RPC fetch in tokenHandler)
   */
  public set(mintAddress: string, metadata: { name: string; symbol: string }): void {
    const metadataPDA = this.deriveMetadataPDA(mintAddress);

    this.cache.set(metadataPDA, {
      name: metadata.name,
      symbol: metadata.symbol,
      timestamp: Date.now()
    });

    console.log(`✅ [METADATA CACHE] Stored: ${metadata.name} (${metadata.symbol}) for ${mintAddress.substring(0, 8)}...`);
  }

  /**
   * Get metadata from cache
   */
  public get(mintAddress: string): CachedMetadata | null {
    const metadataPDA = this.deriveMetadataPDA(mintAddress);
    const cached = this.cache.get(metadataPDA);

    if (!cached) {
      return null;
    }

    // Check if expired
    const age = Date.now() - cached.timestamp;
    if (age > this.maxAge) {
      this.cache.delete(metadataPDA);
      return null;
    }

    return cached;
  }

  /**
   * Check if metadata exists in cache
   */
  public has(mintAddress: string): boolean {
    return this.get(mintAddress) !== null;
  }

  /**
   * Clear old entries (run periodically)
   */
  public cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.maxAge) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🧹 [METADATA CACHE] Cleaned up ${removed} expired entries`);
    }

    return removed;
  }

  /**
   * Get cache statistics
   */
  public getStats(): { size: number; oldestAge: number } {
    let oldestTimestamp = Date.now();

    for (const value of this.cache.values()) {
      if (value.timestamp < oldestTimestamp) {
        oldestTimestamp = value.timestamp;
      }
    }

    return {
      size: this.cache.size,
      oldestAge: Date.now() - oldestTimestamp
    };
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.cache.clear();
    console.log(`🧹 [METADATA CACHE] Cleared all entries`);
  }
}

// Singleton instance
export const metadataCache = new MetadataCache();

// Cleanup every 5 minutes
setInterval(() => {
  metadataCache.cleanup();
}, 300000);
