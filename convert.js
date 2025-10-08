const { Keypair } = require('@solana/web3.js');

// Your base64 key
const base64Key = 'g6CCyJsCzCyAQjMiEWyOfwWHIE4QR+KpwOR+qp7insNPKnLvRVXVLXefwxtahJoDacj/rnviZ5lji6CfNWWEDQ==';
const buffer = Buffer.from(base64Key, 'base64');
const keypair = Keypair.fromSecretKey(buffer);

console.log('Copy this entire line to your .env file:');
console.log('PRIVATE_KEY=[' + Array.from(keypair.secretKey).toString() + ']');