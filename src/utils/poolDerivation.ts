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

import { PublicKey } from "@solana/web3.js";

/**
 * Program IDs for different DEXes
 */
export const PROGRAM_IDS = {
  RAYDIUM_AMM_V4: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
  PUMP_FUN: new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"),
  PUMPSWAP: new PublicKey("BSfD6SHZigAfDWSjzD5Q41jw8LmKwtmjskPH9XW1mrRW"), // Pumpswap Program V1
  TOKEN_PROGRAM: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  WSOL: new PublicKey("So11111111111111111111111111111111111111112"),
};

/**
 * Seeds for PDA derivation
 */
const BONDING_CURVE_SEED = "bonding-curve";
const GLOBAL_SEED = "global";

export interface PoolInfo {
  poolAddress: string;
  dex: "raydium" | "pumpfun" | "pumpswap";
  tokenMint: string;
  quoteMint: string; // Usually WSOL
  derivationMethod: "pda" | "lookup" | "placeholder";
}

/**
 * Derive Pump.fun bonding curve address
 * This is deterministic and can be calculated offline
 */
export function derivePumpFunBondingCurve(tokenMint: string): PoolInfo {
  try {
    const mintPubkey = new PublicKey(tokenMint);

    // Derive bonding curve PDA
    // PDA = findProgramAddress([seed, mint], program)
    const [bondingCurvePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(BONDING_CURVE_SEED), mintPubkey.toBuffer()],
      PROGRAM_IDS.PUMP_FUN
    );

    return {
      poolAddress: bondingCurvePDA.toBase58(),
      dex: "pumpfun",
      tokenMint,
      quoteMint: PROGRAM_IDS.WSOL.toBase58(),
      derivationMethod: "pda",
    };
  } catch (error) {
    console.error(`[Pool Derivation] Error deriving Pump.fun bonding curve:`, error);
    // Return placeholder
    return {
      poolAddress: tokenMint,
      dex: "pumpfun",
      tokenMint,
      quoteMint: PROGRAM_IDS.WSOL.toBase58(),
      derivationMethod: "placeholder",
    };
  }
}

/**
 * Derive Pumpswap pool address
 * Pumpswap uses similar PDA pattern to Pump.fun
 */
export function derivePumpswapPool(tokenMint: string): PoolInfo {
  try {
    console.log(`[Pool Derivation] Deriving Pumpswap pool for ${tokenMint}`);

    const mintPubkey = new PublicKey(tokenMint);

    // Pumpswap uses similar PDA pattern to Pump.fun
    const [poolPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pumpswap_pool"),
        mintPubkey.toBuffer(),
      ],
      PROGRAM_IDS.PUMPSWAP
    );

    console.log(`[Pool Derivation] Pumpswap pool: ${poolPDA.toBase58()}`);

    return {
      poolAddress: poolPDA.toBase58(),
      dex: "pumpswap",
      tokenMint,
      quoteMint: PROGRAM_IDS.WSOL.toBase58(),
      derivationMethod: "pda",
    };
  } catch (error) {
    console.error('[Pool Derivation] Pumpswap derivation failed:', error);
    return {
      poolAddress: tokenMint,
      dex: "pumpswap",
      tokenMint,
      quoteMint: PROGRAM_IDS.WSOL.toBase58(),
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
export function deriveRaydiumPool(tokenMint: string, poolIdFromLogs?: string): PoolInfo {
  // If we have pool ID from transaction logs, use it
  if (poolIdFromLogs) {
    return {
      poolAddress: poolIdFromLogs,
      dex: "raydium",
      tokenMint,
      quoteMint: PROGRAM_IDS.WSOL.toBase58(),
      derivationMethod: "lookup",
    };
  }

  // Otherwise, log warning and return placeholder
  console.warn(
    `[Pool Derivation] Raydium pool for ${tokenMint} requires pool ID from transaction logs. ` +
    `Using token mint as placeholder - real-time monitoring may not work correctly.`
  );

  return {
    poolAddress: tokenMint, // Placeholder
    dex: "raydium",
    tokenMint,
    quoteMint: PROGRAM_IDS.WSOL.toBase58(),
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
export function derivePoolAddress(
  tokenMint: string,
  detectedDex: "raydium" | "pumpfun" | "pumpswap" = "pumpfun",
  poolIdFromLogs?: string
): PoolInfo {
  switch (detectedDex) {
    case "pumpfun":
      return derivePumpFunBondingCurve(tokenMint);

    case "pumpswap":
      return derivePumpswapPool(tokenMint);

    case "raydium":
      return deriveRaydiumPool(tokenMint, poolIdFromLogs);

    default:
      console.warn(`[Pool Derivation] Unknown DEX: ${detectedDex}, defaulting to Pump.fun`);
      return derivePumpFunBondingCurve(tokenMint);
  }
}

/**
 * Detect which DEX created a token based on transaction logs
 * This helps us know which derivation method to use
 */
export function detectDexFromLogs(logs: string[]): "raydium" | "pumpfun" | "pumpswap" | "unknown" {
  // Check for Pump.fun
  if (logs.some(log =>
    log.includes(PROGRAM_IDS.PUMP_FUN.toBase58()) ||
    log.includes("Program log: Instruction: InitializeMint2")
  )) {
    return "pumpfun";
  }

  // Check for Raydium
  if (logs.some(log =>
    log.includes(PROGRAM_IDS.RAYDIUM_AMM_V4.toBase58()) ||
    log.includes("initialize2") ||
    log.includes("InitializeInstruction")
  )) {
    return "raydium";
  }

  // Check for Pumpswap (TODO: verify actual log patterns)
  if (logs.some(log =>
    log.includes(PROGRAM_IDS.PUMPSWAP.toBase58())
  )) {
    return "pumpswap";
  }

  return "unknown";
}

/**
 * Extract pool address from Raydium transaction logs
 * Raydium logs often contain the pool ID in initialization
 */
export function extractRaydiumPoolFromLogs(logs: string[]): string | null {
  try {
    // Look for Raydium pool creation patterns
    for (const log of logs) {
      // Pattern 1: Pool account in instruction
      if (log.includes('ray_log: ') && log.includes('pool')) {
        const match = log.match(/pool:\s*([A-Za-z0-9]{44})/);
        if (match) return match[1];
      }

      // Pattern 2: Initialize2 instruction
      if (log.includes('Instruction: Initialize2')) {
        const nextLogIndex = logs.indexOf(log) + 1;
        if (nextLogIndex < logs.length) {
          const match = logs[nextLogIndex].match(/([A-Za-z0-9]{44})/);
          if (match) return match[1];
        }
      }
    }

    console.log('[Pool Derivation] No Raydium pool found in logs');
    return null;
  } catch (error) {
    console.error('[Pool Derivation] Raydium log parsing error:', error);
    return null;
  }
}

/**
 * Helper: Validate pool derivation
 * Returns true if derivation method is reliable
 */
export function isPoolDerivationReliable(poolInfo: PoolInfo): boolean {
  return poolInfo.derivationMethod === "pda" || poolInfo.derivationMethod === "lookup";
}
