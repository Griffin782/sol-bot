/**
 * Balance Checker - Ensures wallet has sufficient SOL before trading
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export interface BalanceInfo {
  address: string;
  balanceSOL: number;
  balanceLamports: number;
  hasSufficientBalance: boolean;
  minimumRequired: number;
}

export async function checkWalletBalance(
  walletAddress: string,
  minimumSOL: number = 0.01
): Promise<BalanceInfo> {
  const rpcEndpoint = process.env.QUICKNODE_RPC_ENDPOINT ||
                      process.env.RPC_HTTPS_URI ||
                      'https://api.mainnet-beta.solana.com';

  const connection = new Connection(rpcEndpoint, 'confirmed');
  const publicKey = new PublicKey(walletAddress);

  const balanceLamports = await connection.getBalance(publicKey);
  const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;

  return {
    address: walletAddress,
    balanceSOL: balanceSOL,
    balanceLamports: balanceLamports,
    hasSufficientBalance: balanceSOL >= minimumSOL,
    minimumRequired: minimumSOL
  };
}

export async function logBalance(walletAddress: string): Promise<void> {
  console.log("\n💰 Checking Wallet Balance...");
  console.log("=".repeat(60));

  try {
    const balance = await checkWalletBalance(walletAddress, 0.1);

    console.log(`Wallet: ${balance.address}`);
    console.log(`Balance: ${balance.balanceSOL.toFixed(6)} SOL`);
    console.log(`Status: ${balance.hasSufficientBalance ? '✅ Sufficient' : '❌ Insufficient'}`);

    if (!balance.hasSufficientBalance) {
      console.log(`\n⚠️  WARNING: Balance below recommended minimum (${balance.minimumRequired} SOL)`);
      console.log("   Add SOL to this wallet before trading!");
    }

    console.log("=".repeat(60) + "\n");

  } catch (error: any) {
    console.error("❌ Failed to check balance:", error.message);
  }
}
