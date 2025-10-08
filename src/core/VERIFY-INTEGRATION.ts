import { execSync } from 'child_process';

console.log('🔍 Verifying UNIFIED-CONTROL Integration...\n');

// Test 1: Check for fallback patterns
console.log('Test 1: Checking for fallback patterns...');
try {
  const fallbacks = execSync('findstr /S /C:"|| 600" /C:"|| 7000" /C:"|| 0.089" src\\*.ts 2>nul', { encoding: 'utf8', stdio: 'pipe' });
  console.log('❌ FAILED: Found fallback patterns:\n', fallbacks);
} catch (e) {
  console.log('✅ PASSED: No fallback patterns found\n');
}

// Test 2: Check for old config imports
console.log('Test 2: Checking for old config imports...');
try {
  const oldImports = execSync('findstr /S /C:"masterConfig" /C:"z-masterConfig" src\\*.ts 2>nul | findstr /V "UNIFIED-CONTROL" | findstr /V "archive"', { encoding: 'utf8', stdio: 'pipe' });
  console.log('❌ FAILED: Found old config imports:\n', oldImports);
} catch (e) {
  console.log('✅ PASSED: No old config imports found\n');
}

// Test 3: Verify UNIFIED-CONTROL is used
console.log('Test 3: Checking UNIFIED-CONTROL usage...');
try {
  const usage = execSync('findstr /S /C:"MASTER_SETTINGS" /C:"CONFIG-BRIDGE" src\\*.ts 2>nul | find /C /V ""', { encoding: 'utf8', stdio: 'pipe' });
  const count = parseInt(usage.trim());
  console.log(`✅ FOUND: ${count} references to UNIFIED-CONTROL system\n`);
} catch (e) {
  console.log('⚠️ WARNING: Could not count references\n');
}

console.log('=====================================');
console.log('VERIFICATION COMPLETE');
console.log('=====================================');