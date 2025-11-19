"use strict";
/**
 * Pool Address Derivation - Phase 4
 *
 * Derives pool/bonding curve addresses for different DEXes
 * Critical for real-time position monitoring
 *
 * DEX-Specific Logic:
 * - Raydium: AMM pool PDA (requires pool ID lookup or derivation)
 * - Pump.fun: Bonding curve PDA (deterministic derivation)
 * - Pumpswap: Pool account PDA (similar to Pump.fun)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROGRAM_IDS = void 0;
exports.derivePumpFunBondingCurve = derivePumpFunBondingCurve;
exports.derivePumpswapPool = derivePumpswapPool;
exports.deriveRaydiumPool = deriveRaydiumPool;
exports.derivePoolAddress = derivePoolAddress;
exports.detectDexFromLogs = detectDexFromLogs;
exports.extractRaydiumPoolFromLogs = extractRaydiumPoolFromLogs;
exports.isPoolDerivationReliable = isPoolDerivationReliable;
var web3_js_1 = require("@solana/web3.js");
/**
 * Program IDs for different DEXes
 */
exports.PROGRAM_IDS = {
    RAYDIUM_AMM_V4: new web3_js_1.PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
    PUMP_FUN: new web3_js_1.PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"),
    PUMPSWAP: new web3_js_1.PublicKey("BSfD6SHZigAfDWSjzD5Q41jw8LmKwtmjskPH9XW1mrRW"), // Pumpswap Program V1
    TOKEN_PROGRAM: new web3_js_1.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    WSOL: new web3_js_1.PublicKey("So11111111111111111111111111111111111111112"),
};
/**
 * Seeds for PDA derivation
 */
var BONDING_CURVE_SEED = "bonding-curve";
var GLOBAL_SEED = "global";
/**
 * Derive Pump.fun bonding curve address
 * This is deterministic and can be calculated offline
 */
function derivePumpFunBondingCurve(tokenMint) {
    try {
        var mintPubkey = new web3_js_1.PublicKey(tokenMint);
        // Derive bonding curve PDA
        // PDA = findProgramAddress([seed, mint], program)
        var bondingCurvePDA = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(BONDING_CURVE_SEED), mintPubkey.toBuffer()], exports.PROGRAM_IDS.PUMP_FUN)[0];
        return {
            poolAddress: bondingCurvePDA.toBase58(),
            dex: "pumpfun",
            tokenMint: tokenMint,
            quoteMint: exports.PROGRAM_IDS.WSOL.toBase58(),
            derivationMethod: "pda",
        };
    }
    catch (error) {
        console.error("[Pool Derivation] Error deriving Pump.fun bonding curve:", error);
        // Return placeholder
        return {
            poolAddress: tokenMint,
            dex: "pumpfun",
            tokenMint: tokenMint,
            quoteMint: exports.PROGRAM_IDS.WSOL.toBase58(),
            derivationMethod: "placeholder",
        };
    }
}
/**
 * Derive Pumpswap pool address
 * Pumpswap uses similar PDA pattern to Pump.fun
 */
function derivePumpswapPool(tokenMint) {
    try {
        console.log("[Pool Derivation] Deriving Pumpswap pool for ".concat(tokenMint));
        var mintPubkey = new web3_js_1.PublicKey(tokenMint);
        // Pumpswap uses similar PDA pattern to Pump.fun
        var poolPDA = web3_js_1.PublicKey.findProgramAddressSync([
            Buffer.from("pumpswap_pool"),
            mintPubkey.toBuffer(),
        ], exports.PROGRAM_IDS.PUMPSWAP)[0];
        console.log("[Pool Derivation] Pumpswap pool: ".concat(poolPDA.toBase58()));
        return {
            poolAddress: poolPDA.toBase58(),
            dex: "pumpswap",
            tokenMint: tokenMint,
            quoteMint: exports.PROGRAM_IDS.WSOL.toBase58(),
            derivationMethod: "pda",
        };
    }
    catch (error) {
        console.error('[Pool Derivation] Pumpswap derivation failed:', error);
        return {
            poolAddress: tokenMint,
            dex: "pumpswap",
            tokenMint: tokenMint,
            quoteMint: exports.PROGRAM_IDS.WSOL.toBase58(),
            derivationMethod: "placeholder",
        };
    }
}
/**
 * Derive Raydium AMM pool address
 *
 * NOTE: Raydium pools are NOT deterministically derived from token mint alone.
 * You need either:
 * 1. The pool ID (from transaction logs when token was detected)
 * 2. API lookup to find pool address
 * 3. On-chain account scanning
 *
 * For now, this returns a placeholder with a note to extract from logs
 */
function deriveRaydiumPool(tokenMint, poolIdFromLogs) {
    // If we have pool ID from transaction logs, use it
    if (poolIdFromLogs) {
        return {
            poolAddress: poolIdFromLogs,
            dex: "raydium",
            tokenMint: tokenMint,
            quoteMint: exports.PROGRAM_IDS.WSOL.toBase58(),
            derivationMethod: "lookup",
        };
    }
    // Otherwise, log warning and return placeholder
    console.warn("[Pool Derivation] Raydium pool for ".concat(tokenMint, " requires pool ID from transaction logs. ") +
        "Using token mint as placeholder - real-time monitoring may not work correctly.");
    return {
        poolAddress: tokenMint, // Placeholder
        dex: "raydium",
        tokenMint: tokenMint,
        quoteMint: exports.PROGRAM_IDS.WSOL.toBase58(),
        derivationMethod: "placeholder",
    };
}
/**
 * Smart pool derivation - detects DEX and uses appropriate method
 *
 * @param tokenMint - Token mint address
 * @param detectedDex - DEX detected from transaction logs
 * @param poolIdFromLogs - Pool ID extracted from transaction (for Raydium)
 */
function derivePoolAddress(tokenMint, detectedDex, poolIdFromLogs) {
    if (detectedDex === void 0) { detectedDex = "pumpfun"; }
    switch (detectedDex) {
        case "pumpfun":
            return derivePumpFunBondingCurve(tokenMint);
        case "pumpswap":
            return derivePumpswapPool(tokenMint);
        case "raydium":
            return deriveRaydiumPool(tokenMint, poolIdFromLogs);
        default:
            console.warn("[Pool Derivation] Unknown DEX: ".concat(detectedDex, ", defaulting to Pump.fun"));
            return derivePumpFunBondingCurve(tokenMint);
    }
}
/**
 * Detect which DEX created a token based on transaction logs
 * This helps us know which derivation method to use
 */
function detectDexFromLogs(logs) {
    // Check for Pump.fun
    if (logs.some(function (log) {
        return log.includes(exports.PROGRAM_IDS.PUMP_FUN.toBase58()) ||
            log.includes("Program log: Instruction: InitializeMint2");
    })) {
        return "pumpfun";
    }
    // Check for Raydium
    if (logs.some(function (log) {
        return log.includes(exports.PROGRAM_IDS.RAYDIUM_AMM_V4.toBase58()) ||
            log.includes("initialize2") ||
            log.includes("InitializeInstruction");
    })) {
        return "raydium";
    }
    // Check for Pumpswap (TODO: verify actual log patterns)
    if (logs.some(function (log) {
        return log.includes(exports.PROGRAM_IDS.PUMPSWAP.toBase58());
    })) {
        return "pumpswap";
    }
    return "unknown";
}
/**
 * Extract pool address from Raydium transaction logs
 * Raydium logs often contain the pool ID in initialization
 */
function extractRaydiumPoolFromLogs(logs) {
    try {
        // Look for Raydium pool creation patterns
        for (var _i = 0, logs_1 = logs; _i < logs_1.length; _i++) {
            var log = logs_1[_i];
            // Pattern 1: Pool account in instruction
            if (log.includes('ray_log: ') && log.includes('pool')) {
                var match = log.match(/pool:\s*([A-Za-z0-9]{44})/);
                if (match)
                    return match[1];
            }
            // Pattern 2: Initialize2 instruction
            if (log.includes('Instruction: Initialize2')) {
                var nextLogIndex = logs.indexOf(log) + 1;
                if (nextLogIndex < logs.length) {
                    var match = logs[nextLogIndex].match(/([A-Za-z0-9]{44})/);
                    if (match)
                        return match[1];
                }
            }
        }
        console.log('[Pool Derivation] No Raydium pool found in logs');
        return null;
    }
    catch (error) {
        console.error('[Pool Derivation] Raydium log parsing error:', error);
        return null;
    }
}
/**
 * Helper: Validate pool derivation
 * Returns true if derivation method is reliable
 */
function isPoolDerivationReliable(poolInfo) {
    return poolInfo.derivationMethod === "pda" || poolInfo.derivationMethod === "lookup";
}
