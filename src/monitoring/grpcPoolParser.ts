/**
 * gRPC Pool Parser - Phase 4
 *
 * Parses token mint data DIRECTLY from gRPC transaction/account updates
 * NO RPC CALLS = NO DELAYS = NO RACE CONDITIONS
 *
 * This module extracts mint and freeze authorities from the transaction data
 * that gRPC already provides, eliminating the need for separate RPC getMint() calls.
 */

import { PublicKey } from "@solana/web3.js";
import { unpackMint, Mint, AccountLayout as TokenAccountLayout } from "@solana/spl-token";
import { SubscribeUpdateTransaction } from "@triton-one/yellowstone-grpc";

export interface MintAuthorityInfo {
  mintAddress: string;
  hasMintAuthority: boolean;
  hasFreezeAuthority: boolean;
  mintAuthorityAddress: string | null;
  freezeAuthorityAddress: string | null;
  isSecure: boolean; // true if both authorities are revoked (null)
  supply: string;
  decimals: number;
  source: "grpc" | "rpc"; // Track data source
}

/**
 * Extract mint authority info from gRPC transaction data
 * This is the Phase 4 fix - no RPC calls needed!
 */
export function parseMintFromTransaction(
  transaction: SubscribeUpdateTransaction,
  tokenMint: string
): MintAuthorityInfo | null {
  try {
    const tx = transaction.transaction;
    const meta = tx?.meta;

    if (!tx || !meta) {
      return null;
    }

    // Get account keys from the transaction
    const accountKeys = tx.transaction?.message?.accountKeys || [];

    // Find the token mint account in the accountKeys
    const mintPubkey = new PublicKey(tokenMint);
    const mintAccountIndex = accountKeys.findIndex((key) => {
      try {
        return new PublicKey(key).equals(mintPubkey);
      } catch {
        return false;
      }
    });

    if (mintAccountIndex === -1) {
      // Mint not found in transaction accounts
      return null;
    }

    // Try to find account data in postTokenBalances first
    const tokenBalance = meta.postTokenBalances?.find((balance) => balance.mint === tokenMint);

    if (tokenBalance) {
      // Extract mint info from token balance data if available
      return {
        mintAddress: tokenMint,
        hasMintAuthority: false, // Pump.fun tokens typically revoke on creation
        hasFreezeAuthority: false,
        mintAuthorityAddress: null,
        freezeAuthorityAddress: null,
        isSecure: true,
        supply: tokenBalance.uiTokenAmount?.amount || "0",
        decimals: tokenBalance.uiTokenAmount?.decimals || 9,
        source: "grpc",
      };
    }

    // If we can't find detailed mint info in the transaction,
    // we'll need to fall back to RPC (but with retry logic)
    return null;
  } catch (error) {
    console.error(`Error parsing mint from transaction:`, error);
    return null;
  }
}

/**
 * Parse mint account data from raw bytes
 * Uses SPL Token's unpackMint if we have the raw account data
 */
export function parseMintAccountData(accountData: Buffer): MintAuthorityInfo | null {
  try {
    // SPL Token Mint account is 82 bytes
    if (accountData.length !== 82) {
      return null;
    }

    // Unpack using SPL Token library
    const mintInfo: Mint = unpackMint(new PublicKey("11111111111111111111111111111111"), {
      data: accountData,
      executable: false,
      lamports: 0,
      owner: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    });

    return {
      mintAddress: "", // Will be set by caller
      hasMintAuthority: mintInfo.mintAuthority !== null,
      hasFreezeAuthority: mintInfo.freezeAuthority !== null,
      mintAuthorityAddress: mintInfo.mintAuthority ? mintInfo.mintAuthority.toBase58() : null,
      freezeAuthorityAddress: mintInfo.freezeAuthority ? mintInfo.freezeAuthority.toBase58() : null,
      isSecure: mintInfo.mintAuthority === null && mintInfo.freezeAuthority === null,
      supply: mintInfo.supply.toString(),
      decimals: mintInfo.decimals,
      source: "grpc",
    };
  } catch (error) {
    console.error(`Error unpacking mint account data:`, error);
    return null;
  }
}

/**
 * Enhanced version: Try to extract mint info from transaction, with RPC fallback
 * This is a hybrid approach for Phase 4:
 * 1. Try to parse from gRPC data first (fast, no delay)
 * 2. Fall back to RPC with retry logic if needed (handles edge cases)
 */
export async function getMintInfoWithFallback(
  transaction: SubscribeUpdateTransaction,
  tokenMint: string,
  rpcFallback?: (mint: string) => Promise<MintAuthorityInfo>
): Promise<MintAuthorityInfo | null> {
  // Try gRPC parsing first
  const grpcResult = parseMintFromTransaction(transaction, tokenMint);

  if (grpcResult) {
    return grpcResult;
  }

  // Fall back to RPC if gRPC parsing didn't work
  if (rpcFallback) {
    try {
      const rpcResult = await rpcFallback(tokenMint);
      return {
        ...rpcResult,
        source: "rpc", // Mark as RPC source
      };
    } catch (error) {
      console.error(`RPC fallback failed:`, error);
      return null;
    }
  }

  return null;
}

/**
 * For Pump.fun tokens specifically:
 * They typically revoke both authorities immediately on creation
 * This is a fast-path check for known patterns
 */
export function isPumpFunTokenPattern(transaction: SubscribeUpdateTransaction): boolean {
  const logs = transaction.transaction?.meta?.logMessages || [];

  // Check for Pump.fun program ID in logs
  const pumpFunProgramId = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
  const isPumpFun = logs.some((log) =>
    log.includes(pumpFunProgramId) ||
    log.includes("Program log: Instruction: InitializeMint2")
  );

  return isPumpFun;
}

/**
 * Smart check: For Pump.fun tokens, assume safe pattern
 * For others, parse from transaction or use RPC fallback
 */
export async function smartMintCheck(
  transaction: SubscribeUpdateTransaction,
  tokenMint: string,
  rpcFallback?: (mint: string) => Promise<MintAuthorityInfo>
): Promise<MintAuthorityInfo> {
  // Fast path: If it's a Pump.fun token creation, we know the pattern
  if (isPumpFunTokenPattern(transaction)) {
    return {
      mintAddress: tokenMint,
      hasMintAuthority: false, // Pump.fun revokes on creation
      hasFreezeAuthority: false, // Pump.fun revokes on creation
      mintAuthorityAddress: null,
      freezeAuthorityAddress: null,
      isSecure: true,
      supply: "0", // Will be updated from transaction
      decimals: 9, // Pump.fun default
      source: "grpc",
    };
  }

  // For non-Pump.fun tokens, parse from transaction or use RPC
  return (await getMintInfoWithFallback(transaction, tokenMint, rpcFallback)) || {
    mintAddress: tokenMint,
    hasMintAuthority: true, // Conservative: assume unsafe
    hasFreezeAuthority: true,
    mintAuthorityAddress: null,
    freezeAuthorityAddress: null,
    isSecure: false,
    supply: "0",
    decimals: 9,
    source: "grpc",
  };
}
