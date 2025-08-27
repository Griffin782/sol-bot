// create-wallet.ts - Creates a NEW wallet
import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';

console.log('?? CREATING NEW WALLET...\n');

const keypair = Keypair.generate();
const publicKey = keypair.publicKey.toBase58();
const privateKey = Buffer.from(keypair.secretKey).toString('base64');

console.log('?? YOUR NEW WALLET ADDRESS:');
console.log(publicKey);
console.log('\n?? PRIVATE KEY:');
console.log(privateKey);

// Save to .env
const envContent = `WALLET_ADDRESS=${publicKey}
PRIVATE_KEY=${privateKey}
TEST_MODE=false`;

fs.writeFileSync('.env', envContent);
console.log('\n? Saved to .env');

console.log('\n?? NEXT: Send 0.59 SOL to the address above');