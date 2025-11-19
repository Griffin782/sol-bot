/**
 * Quick Balance Checker
 * Run this before starting the bot to verify wallet has SOL
 */

import * as dotenv from 'dotenv';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

dotenv.config();

async function checkBalance() {
  console.log("💰 Wallet Balance Check");
  console.log("=".repeat(60));
  console.log();

  try {
    // Get wallet from private key
    const privateKey = process.env.PRIVATE_KEY;

    if (!privateKey) {
      console.error("❌ PRIVATE_KEY not found in .env");
      process.exit(1);
    }

    let secretKey: Uint8Array;
    if (privateKey.startsWith('[')) {
      secretKey = new Uint8Array(JSON.parse(privateKey));
    } else {
      secretKey = bs58.decode(privateKey);
    }

    const wallet = Keypair.fromSecretKey(secretKey);
    const walletAddress = wallet.publicKey.toString();

    console.log("📍 Wallet Address:", walletAddress);
    console.log();

    // Connect to RPC
    const rpcEndpoint = process.env.QUICKNODE_RPC_ENDPOINT ||
                        process.env.RPC_HTTPS_URI ||
                        'https://api.mainnet-beta.solana.com';

    console.log("🔗 RPC Endpoint:", rpcEndpoint.substring(0, 50) + "...");
    console.log();

    const connection = new Connection(rpcEndpoint, 'confirmed');

    // Get balance
    const balanceLamports = await connection.getBalance(wallet.publicKey);
    const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;

    console.log("💵 Current Balance:", balanceSOL.toFixed(6), "SOL");
    console.log("💵 In Lamports:", balanceLamports.toLocaleString());
    console.log();

    // Check status
    console.log("📊 Status Check:");

    if (balanceSOL === 0) {
      console.log("❌ EMPTY WALLET - No SOL!");
      console.log("   ⚠️  You must add SOL before trading");
      console.log("   📝 Send SOL to:", walletAddress);
    } else if (balanceSOL < 0.01) {
      console.log("⚠️  LOW BALANCE - Under 0.01 SOL");
      console.log("   Recommended: Add at least 0.1 SOL for trading");
    } else if (balanceSOL < 0.1) {
      console.log("⚠️  MINIMAL BALANCE - Under 0.1 SOL");
      console.log("   Enough for testing, but add more for real trading");
    } else {
      console.log("✅ SUFFICIENT BALANCE");
      console.log(`   You can make approximately ${Math.floor(balanceSOL / 0.001)} micro trades`);
    }

    console.log();
    console.log("=".repeat(60));
    console.log();

    // Trading recommendations
    console.log("💡 Trading Recommendations:");
    console.log(`   Micro trades (0.001 SOL): ~${Math.floor(balanceSOL / 0.001)} trades possible`);
    console.log(`   Small trades (0.01 SOL): ~${Math.floor(balanceSOL / 0.01)} trades possible`);
    console.log(`   Medium trades (0.089 SOL): ~${Math.floor(balanceSOL / 0.089)} trades possible`);
    console.log();

  } catch (error: any) {
    console.error("❌ Error checking balance:", error.message);
    process.exit(1);
  }
}

checkBalance();
