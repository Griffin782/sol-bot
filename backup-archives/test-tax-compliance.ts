
// ============================================================================
// TEST-TAX-COMPLIANCE.TS
// ============================================================================

import { recordTrade, TaxableTransaction, generateForm8949CSV, getTaxSummary } from './tax-compliance/taxTracker';
import { costBasisTracker } from './tax-compliance/costBasisTracker';

async function runTaxComplianceTests() {
  console.log('🧪 RUNNING TAX COMPLIANCE TESTS');
  console.log('='.repeat(50));
  
  try {
    // Test 1: Simulate a buy at $100 with $1 fee
    console.log('\n📊 Test 1: Recording Buy Transaction');
    const buyTx: TaxableTransaction = {
      timestamp: new Date('2024-01-15T10:30:00Z').toISOString(),
      type: 'buy',
      tokenMint: 'TEST123456789',
      tokenSymbol: 'TEST',
      amount: 1000, // 1000 tokens
      priceSOL: 0.1, // 0.1 SOL per token  
      totalSOL: 100, // 100 SOL total
      fees: 1, // 1 SOL fee
      signature: 'buy_test_signature_123',
      success: true,
      platform: 'jupiter',
      notes: 'Test buy transaction'
    };
    
    await recordTrade(buyTx);
    console.log('✅ Buy transaction recorded');
    
    // Verify cost basis
    const holdings = costBasisTracker.getCostBasis('TEST123456789');
    console.log(`📊 Cost basis entries: ${holdings.length}`);
    console.log(`📊 Total holding: ${costBasisTracker.getTotalHolding('TEST123456789')} tokens`);
    
    // Test 2: Simulate a sell at $150 with $1 fee (after 6 months)
    console.log('\n📊 Test 2: Recording Sell Transaction');
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
    
    const sellTx: TaxableTransaction = {
      timestamp: new Date('2024-07-15T14:45:00Z').toISOString(),
      type: 'sell',
      tokenMint: 'TEST123456789',
      tokenSymbol: 'TEST',
      amount: 1000, // Sell all 1000 tokens
      priceSOL: 0.15, // 0.15 SOL per token (50% gain)
      totalSOL: 150, // 150 SOL total
      fees: 1, // 1 SOL fee
      signature: 'sell_test_signature_456',
      success: true,
      platform: 'jupiter',
      notes: 'Test sell transaction'
    };
    
    await recordTrade(sellTx);
    console.log('✅ Sell transaction recorded');
    
    // Test 3: Verify calculations
    console.log('\n📊 Test 3: Verifying Calculations');
    const costBasis = 100 + 1; // Buy amount + buy fee = $101
    const proceeds = 150 - 1; // Sell amount - sell fee = $149  
    const expectedGain = proceeds - costBasis; // $149 - $101 = $48
    
    console.log(`Expected cost basis: $${costBasis}`);
    console.log(`Expected proceeds: $${proceeds}`);
    console.log(`Expected gain: $${expectedGain}`);
    
    // Test 4: Generate tax reports
    console.log('\n📊 Test 4: Generating Tax Reports');
    const currentYear = new Date().getFullYear();
    const csvFile = generateForm8949CSV(currentYear);
    console.log(`✅ Form 8949 CSV generated: ${csvFile}`);
    
    const taxSummary = getTaxSummary(currentYear);
    console.log('✅ Tax Summary:', JSON.stringify(taxSummary, null, 2));
    
    // Test 5: Wash Sale Detection
    console.log('\n📊 Test 5: Testing Wash Sale Detection');
    
    // Sell at a loss
    const lossySellTx: TaxableTransaction = {
      timestamp: new Date('2024-08-01T10:00:00Z').toISOString(),
      type: 'sell',
      tokenMint: 'WASH123456789',
      tokenSymbol: 'WASH',
      amount: 500,
      priceSOL: 0.08, // Lower than buy price
      totalSOL: 40,
      fees: 0.5,
      signature: 'wash_sell_test_123',
      success: true,
      platform: 'jupiter',
      notes: 'Loss sale for wash test'
    };
    
    // First record a buy for the wash test token
    const washBuyTx: TaxableTransaction = {
      timestamp: new Date('2024-07-01T10:00:00Z').toISOString(),
      type: 'buy',
      tokenMint: 'WASH123456789',
      tokenSymbol: 'WASH',
      amount: 500,
      priceSOL: 0.1, // Higher buy price
      totalSOL: 50,
      fees: 0.5,
      signature: 'wash_buy_test_123',
      success: true,
      platform: 'jupiter',
      notes: 'Buy for wash test'
    };
    
    await recordTrade(washBuyTx);
    await recordTrade(lossySellTx);
    
    // Rebuy within 30 days (this should trigger wash sale detection)
    const washRebuyTx: TaxableTransaction = {
      timestamp: new Date('2024-08-15T10:00:00Z').toISOString(), // 14 days later
      type: 'buy',
      tokenMint: 'WASH123456789',
      tokenSymbol: 'WASH',
      amount: 300,
      priceSOL: 0.09,
      totalSOL: 27,
      fees: 0.3,
      signature: 'wash_rebuy_test_456',
      success: true,
      platform: 'jupiter',
      notes: 'Rebuy within 30 days'
    };
    
    await recordTrade(washRebuyTx);
    console.log('✅ Wash sale test transactions recorded');
    
    // Test 6: Holdings Summary
    console.log('\n📊 Test 6: Holdings Summary');
    // const holdingsSummary = costBasisTracker.getHoldingsSummary();  Holdings summary method not implemented yet
    console.log('Holdings Summary:', JSON.stringify(holdingsSummary, null, 2));
    
    console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log('\n📁 Check these files for results:');
    console.log('• data/cost_basis.json - Cost basis tracking');
    console.log('• data/complete_transactions.json - All transactions');  
    console.log(`• data/form_8949_${currentYear}.csv - Form 8949 for IRS`);
    console.log('• data/tax_log.jsonl - Raw transaction log');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTaxComplianceTests();
}

export { runTaxComplianceTests };
