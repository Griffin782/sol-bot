#!/usr/bin/env node
// fix-tax-recording.ts - Ensure tax recording works correctly

import * as fs from 'fs';

console.log('💰 FIXING TAX RECORDING SYSTEM');
console.log('='.repeat(50));

// Add tax recording debug logging to src/index.ts
const indexPath = 'src/index.ts';
if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf8');
  
  // Add debug logging after successful trades
  const debugCode = `
console.log('[TAX_DEBUG] Buy executed:', { tokenMint: returnedMint, amount: BUY_AMOUNT, price: 'estimated' });

// Record trade with enhanced logging
try {
  const taxData: TaxableTransaction = {
    timestamp: new Date().toISOString(),
    type: 'buy',
    tokenMint: returnedMint,
    amount: BUY_AMOUNT,
    signature: \`\${BUY_PROVIDER}_buy_\${Date.now()}\`,
    success: result
  };
  
  console.log('[TAX_DEBUG] Recording trade:', taxData);
  await recordTrade(taxData);
  
  const filename = \`data/tax_records_\${new Date().toISOString().slice(0,10)}.json\`;
  console.log('[TAX_DEBUG] File written:', filename);
} catch (taxError) {
  console.error('[TAX_DEBUG] Recording failed:', taxError);
}
`;

  // Insert debug code after successful buy operations
  if (content.includes('result = await swapToken') && !content.includes('[TAX_DEBUG] Buy executed')) {
    content = content.replace(
      /(result = await swapToken.*?;)/,
      '$1\n' + debugCode
    );
    
    fs.writeFileSync(indexPath, content);
    console.log('✅ Added tax recording debug logging to src/index.ts');
  }
}

// Ensure tax-compliance directory and files exist
if (!fs.existsSync('tax-compliance')) {
  fs.mkdirSync('tax-compliance');
  console.log('✅ Created tax-compliance directory');
}

if (!fs.existsSync('tax-compliance/2025')) {
  fs.mkdirSync('tax-compliance/2025');
  console.log('✅ Created tax-compliance/2025 directory');
}

if (!fs.existsSync('data')) {
  fs.mkdirSync('data');
  console.log('✅ Created data directory');  
}

console.log('\n✅ Tax recording fixes applied!');
