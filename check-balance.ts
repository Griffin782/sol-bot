import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkBalance() {
  const address = 'EmKj5PB2V6QHQ3uD2NkwGSEum3C5z61p8ehWAGyMcBUV';
  console.log('?? Checking wallet:', address);
  
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const publicKey = new PublicKey(address);
  const balance = await connection.getBalance(publicKey);
  const sol = balance / LAMPORTS_PER_SOL;
  const usd = sol * 240; // Update this to current market price
  
  console.log(`?? Balance: ${sol.toFixed(4)} SOL ($${usd.toFixed(2)})`);
  
  if (usd >= 100) {
    console.log('? FUNDS RECEIVED! Ready to start trading!');
    console.log('?? Next: Run npm run dev to start the bot');
    process.exit(0);
  } else if (sol > 0) {
    console.log(`? Received ${sol} SOL but need more...`);
  } else {
    console.log('? Waiting for funds to arrive...');
  }
}

// Check every 30 seconds
async function monitor() {
  while (true) {
    await checkBalance();
    console.log('Checking again in 30 seconds...\n');
    await new Promise(r => setTimeout(r, 30000));
  }
}

monitor();