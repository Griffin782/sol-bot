"use strict";
/**
 * Metadata Cache - gRPC Account Subscription for Instant Metadata
 *
 * SOLUTION TO RACE CONDITION:
 * - Subscribe to ALL Metaplex metadata account updates via gRPC
 * - Cache metadata BEFORE tokens are detected
 * - Instant lookups (no RPC queries, no delays, no race conditions)
 *
 * BENEFITS:
 * - No 200ms delay
 * - No retry logic needed
 * - No RPC rate limiting
 * - Metadata available instantly when token detected
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadataCache = exports.MetadataCache = void 0;
var web3_js_1 = require("@solana/web3.js");
var mpl_token_metadata_1 = require("@metaplex-foundation/mpl-token-metadata");
/**
 * Metadata Cache - In-memory cache populated by gRPC subscriptions
 */
var MetadataCache = /** @class */ (function () {
    function MetadataCache() {
        this.cache = new Map();
        this.maxAge = 3600000; // 1 hour (metadata doesn't change)
    }
    /**
     * Derive metadata PDA for a mint address
     */
    MetadataCache.prototype.deriveMetadataPDA = function (mintAddress) {
        var mintPublicKey = new web3_js_1.PublicKey(mintAddress);
        var programId = new web3_js_1.PublicKey(mpl_token_metadata_1.MPL_TOKEN_METADATA_PROGRAM_ID);
        var metadataPDA = web3_js_1.PublicKey.findProgramAddressSync([
            Buffer.from("metadata"),
            programId.toBuffer(),
            mintPublicKey.toBuffer()
        ], programId)[0];
        return metadataPDA.toBase58();
    };
    /**
     * Parse metadata from account data
     * (Same parsing logic as vipTokenCheck, but reusable)
     */
    MetadataCache.prototype.parseMetadata = function (accountData) {
        try {
            // Skip the first byte (key discriminator)
            var offset = 1;
            // Skip update authority (32 bytes) and mint (32 bytes)
            offset += 64;
            // Read name length (first 4 bytes)
            var nameLength = accountData.slice(offset, offset + 4).readUInt32LE(0);
            offset += 4;
            // Read name (up to 32 bytes)
            var name_1 = accountData.slice(offset, offset + nameLength).toString("utf8").trim();
            offset += 32; // Fixed size in the struct
            // Read symbol length
            var symbolLength = accountData.slice(offset, offset + 4).readUInt32LE(0);
            offset += 4;
            // Read symbol (up to 10 bytes)
            var symbol = accountData.slice(offset, offset + symbolLength).toString("utf8").trim();
            return { name: name_1, symbol: symbol };
        }
        catch (error) {
            console.log("\u26A0\uFE0F [METADATA CACHE] Failed to parse metadata: ".concat(error));
            return null;
        }
    };
    /**
     * Add metadata to cache (called by gRPC subscription handler)
     */
    MetadataCache.prototype.set = function (mintAddress, metadata) {
        var metadataPDA = this.deriveMetadataPDA(mintAddress);
        this.cache.set(metadataPDA, {
            name: metadata.name,
            symbol: metadata.symbol,
            timestamp: Date.now()
        });
        console.log("\u2705 [METADATA CACHE] Stored: ".concat(metadata.name, " (").concat(metadata.symbol, ") for ").concat(mintAddress.substring(0, 8), "..."));
    };
    /**
     * Get metadata from cache
     */
    MetadataCache.prototype.get = function (mintAddress) {
        var metadataPDA = this.deriveMetadataPDA(mintAddress);
        var cached = this.cache.get(metadataPDA);
        if (!cached) {
            return null;
        }
        // Check if expired
        var age = Date.now() - cached.timestamp;
        if (age > this.maxAge) {
            this.cache.delete(metadataPDA);
            return null;
        }
        return cached;
    };
    /**
     * Check if metadata exists in cache
     */
    MetadataCache.prototype.has = function (mintAddress) {
        return this.get(mintAddress) !== null;
    };
    /**
     * Clear old entries (run periodically)
     */
    MetadataCache.prototype.cleanup = function () {
        var now = Date.now();
        var removed = 0;
        for (var _i = 0, _a = this.cache.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            if (now - value.timestamp > this.maxAge) {
                this.cache.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            console.log("\uD83E\uDDF9 [METADATA CACHE] Cleaned up ".concat(removed, " expired entries"));
        }
        return removed;
    };
    /**
     * Get cache statistics
     */
    MetadataCache.prototype.getStats = function () {
        var oldestTimestamp = Date.now();
        for (var _i = 0, _a = this.cache.values(); _i < _a.length; _i++) {
            var value = _a[_i];
            if (value.timestamp < oldestTimestamp) {
                oldestTimestamp = value.timestamp;
            }
        }
        return {
            size: this.cache.size,
            oldestAge: Date.now() - oldestTimestamp
        };
    };
    /**
     * Clear all cache entries
     */
    MetadataCache.prototype.clear = function () {
        this.cache.clear();
        console.log("\uD83E\uDDF9 [METADATA CACHE] Cleared all entries");
    };
    return MetadataCache;
}());
exports.MetadataCache = MetadataCache;
// Singleton instance
exports.metadataCache = new MetadataCache();
// Cleanup every 5 minutes
setInterval(function () {
    exports.metadataCache.cleanup();
}, 300000);
