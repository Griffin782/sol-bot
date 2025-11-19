#!/usr/bin/env node
// verify-fixes.ts - Verify all fixes are working

import * as fs from 'fs';

console.log('🔍 VERIFYING FIXES');
console.log('='.repeat(50));

console.log('\n📋 Configuration Checks:');

// Check z-masterConfig is primary
const indexContent = fs.existsSync('src/index.ts') ? fs.readFileSync('src/index.ts', 'utf8') : '';
const usesZConfig = indexContent.includes('z_config') || indexContent.includes('z-masterConfig');
console.log(`   z-masterConfig usage: ${usesZConfig ? '✅' : '❌'}`);

const hasOldImports = indexContent.includes('./enhanced/masterConfig') || indexContent.includes('./config');  
console.log(`   No old config imports: ${!hasOldImports ? '✅' : '❌'}`);

console.log('\n💰 Tax System Checks:');
const hasTaxDebug = indexContent.includes('[TAX_DEBUG]');
console.log(`   Tax debug logging: ${hasTaxDebug ? '✅' : '❌'}`);

const taxDirExists = fs.existsSync('tax-compliance/2025');
console.log(`   Tax directory: ${taxDirExists ? '✅' : '❌'}`);

console.log('\n📊 Monitor Checks:');
const monitorExists = fs.existsSync('src/enhanced-monitor.ts');
console.log(`   Enhanced monitor: ${monitorExists ? '✅' : '❌'}`);

if (monitorExists) {
  const monitorContent = fs.readFileSync('src/enhanced-monitor.ts', 'utf8');
  const hasMonitorDebug = monitorContent.includes('[MONITOR_DEBUG]');
  console.log(`   Monitor debug logging: ${hasMonitorDebug ? '✅' : '❌'}`);
}

console.log('\n✅ Verification complete!');
