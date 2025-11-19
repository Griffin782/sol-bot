/**
 * CONFIG INTEGRITY TEST for sol-bot-main
 * Tests whether configuration values are properly being used throughout the codebase
 *
 * This script:
 * 1. Verifies correct functions are being called (enforceQualityFilter vs vipTokenCheck)
 * 2. Checks that safety wrappers are active (not commented out)
 * 3. Validates configuration settings are being read
 * 4. Detects hardcoded bypasses (if false, metadata errors allow trades, etc.)
 * 5. Generates detailed integrity report
 *
 * Generated: November 12, 2025
 * Project: sol-bot-main
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION INTEGRITY TESTS
// ============================================================================

const INTEGRITY_TESTS = [
  {
    id: 'INT-001',
    name: 'Quality Filter Function Usage',
    description: 'Verify bot is using enforceQualityFilter (comprehensive) not vipTokenCheck (weak)',
    critical: true,
    tests: [
      {
        name: 'enforceQualityFilter IS being called',
        file: 'src/index.ts',
        pattern: /await enforceQualityFilter\(/,
        expected: true,
        critical: true,
        failureMessage: '❌ Bot is NOT using comprehensive quality filter!',
      },
      {
        name: 'vipTokenCheck is NOT being called',
        file: 'src/index.ts',
        pattern: /await vipTokenCheck\(/,
        expected: false,
        critical: true,
        failureMessage: '❌ Bot is using weak 6-word filter instead of comprehensive filter!',
      },
      {
        name: 'enforceQualityFilter import exists',
        file: 'src/index.ts',
        pattern: /import.*enforceQualityFilter.*TOKEN-QUALITY-FILTER/,
        expected: true,
        critical: true,
      },
    ],
  },
  {
    id: 'INT-002',
    name: 'Safety Wrapper Status',
    description: 'Verify emergency safety wrapper is ACTIVE (not commented out)',
    critical: true,
    tests: [
      {
        name: 'Safety wrapper IS active (geyser path)',
        file: 'src/index.ts',
        pattern: /const safetyResult = await safetyWrapper\.safeTradeWrapper\(/,
        expected: true,
        critical: true,
        failureMessage: '❌ Safety wrapper is commented out in geyser path!',
      },
      {
        name: 'Safety wrapper check IS enforced (geyser)',
        file: 'src/index.ts',
        pattern: /if \(!safetyResult\.success\) \{[\s\S]{0,200}return;/,
        expected: true,
        critical: true,
        failureMessage: '❌ Safety wrapper success check is missing!',
      },
      {
        name: 'No "TEMPORARILY BYPASS" comments',
        file: 'src/index.ts',
        pattern: /TEMPORARILY BYPASS|TEMP.*BYPASS/i,
        expected: false,
        critical: true,
        failureMessage: '❌ Found BYPASS comments in code!',
      },
    ],
  },
  {
    id: 'INT-003',
    name: 'Metadata Error Handling',
    description: 'Verify metadata parsing errors BLOCK trades (not allow them)',
    critical: true,
    tests: [
      {
        name: 'Metadata errors do NOT allow trades',
        file: 'src/utils/vip-token-check.ts',
        pattern: /allowing trade anyway/i,
        expected: false,
        critical: true,
        failureMessage: '❌ Metadata errors allow trades instead of blocking!',
      },
      {
        name: 'Metadata errors return false (block trade)',
        file: 'src/utils/vip-token-check.ts',
        pattern: /catch.*metadataError[\s\S]{0,200}return false/,
        expected: true,
        critical: true,
        failureMessage: '❌ Metadata errors do not block trades!',
      },
    ],
  },
  {
    id: 'INT-004',
    name: 'No if(false) Bypasses',
    description: 'Verify no hardcoded if(false) statements that bypass logic',
    critical: true,
    tests: [
      {
        name: 'No if(false) in index.ts',
        file: 'src/index.ts',
        pattern: /if\s*\(\s*false\s*\)\s*\{/,
        expected: false,
        critical: true,
        failureMessage: '❌ Found if(false) bypass in index.ts!',
      },
      {
        name: 'No if(false) in tokenHandler.ts',
        file: 'src/utils/handlers/tokenHandler.ts',
        pattern: /if\s*\(\s*false\s*\)\s*\{/,
        expected: false,
        critical: true,
      },
      {
        name: 'No if(false) in token-queue-system.ts',
        file: 'src/enhanced/token-queue-system.ts',
        pattern: /if\s*\(\s*false\s*\)\s*\{/,
        expected: false,
        critical: true,
      },
    ],
  },
  {
    id: 'INT-005',
    name: 'Configuration Settings',
    description: 'Verify proper configuration in UNIFIED-CONTROL',
    critical: false,
    tests: [
      {
        name: 'Quality filter is enabled in config',
        file: 'src/core/UNIFIED-CONTROL.ts',
        pattern: /qualityFilterEnabled:\s*true/,
        expected: true,
        critical: false,
      },
      {
        name: 'Minimum quality score is set',
        file: 'src/core/TOKEN-QUALITY-FILTER.ts',
        pattern: /MIN_QUALITY_SCORE\s*=\s*\d+/,
        expected: true,
        critical: false,
      },
      {
        name: 'Block words list exists and is substantial',
        file: 'src/core/TOKEN-QUALITY-FILTER.ts',
        pattern: /INSTANT_BLOCK_WORDS.*\[[\s\S]{200,}/,
        expected: true,
        critical: false,
        failureMessage: 'Block words list is too small or missing',
      },
    ],
  },
  {
    id: 'INT-006',
    name: 'Configuration Integration',
    description: 'Verify configuration settings are actually being read',
    critical: true,
    tests: [
      {
        name: 'qualityFilterEnabled is checked before filtering',
        file: 'src/index.ts',
        pattern: /qualityFilterEnabled|MASTER_SETTINGS\.entry\.qualityFilterEnabled/,
        expected: true,
        critical: false,
        failureMessage: 'Configuration toggle is not being checked',
      },
    ],
  },
];

// ============================================================================
// TEST RUNNER
// ============================================================================

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

function runTest(test, baseDir) {
  const filePath = path.join(baseDir, test.file);
  const content = readFile(filePath);

  if (!content) {
    return {
      pass: false,
      message: `Could not read file: ${test.file}`,
      critical: test.critical,
    };
  }

  const matches = content.match(test.pattern);
  const found = matches && matches.length > 0;

  const pass = found === test.expected;

  let message = test.name;
  if (pass) {
    message += ' ✅';
  } else {
    message += ' ❌';
    if (test.failureMessage) {
      message += ` - ${test.failureMessage}`;
    } else if (test.expected) {
      message += ' (expected to find pattern, but not found)';
    } else {
      message += ' (expected NOT to find pattern, but found it)';
    }
  }

  return {
    pass,
    message,
    critical: test.critical,
    file: test.file,
    expected: test.expected,
    found,
  };
}

function runIntegrityTest(integrityTest, baseDir) {
  console.log(`\n[${integrityTest.id}] ${integrityTest.name}`);
  console.log(`   Description: ${integrityTest.description}`);
  if (integrityTest.critical) {
    console.log(`   🚨 CRITICAL TEST`);
  }

  const results = {
    total: integrityTest.tests.length,
    passed: 0,
    failed: 0,
    critical_failed: 0,
    details: [],
  };

  for (const test of integrityTest.tests) {
    const result = runTest(test, baseDir);
    results.details.push(result);

    if (result.pass) {
      results.passed++;
      console.log(`   ✅ ${result.message}`);
    } else {
      results.failed++;
      if (result.critical) {
        results.critical_failed++;
        console.log(`   🚨 ${result.message} [CRITICAL FAILURE]`);
      } else {
        console.log(`   ⚠️  ${result.message}`);
      }
    }
  }

  return results;
}

// ============================================================================
// BYPASS DETECTOR
// ============================================================================

function detectKnownBypasses(baseDir) {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 SCANNING FOR KNOWN BYPASSES');
  console.log('='.repeat(70));

  const bypasses = [
    {
      name: 'vipTokenCheck usage (should be enforceQualityFilter)',
      file: 'src/index.ts',
      pattern: /await vipTokenCheck\(/g,
      severity: 'CRITICAL',
    },
    {
      name: 'Commented safety wrapper',
      file: 'src/index.ts',
      pattern: /\/\/.*safetyWrapper\.safeTradeWrapper/g,
      severity: 'CRITICAL',
    },
    {
      name: 'Metadata errors allow trades',
      file: 'src/utils/vip-token-check.ts',
      pattern: /allowing trade anyway/g,
      severity: 'CRITICAL',
    },
    {
      name: 'if(false) bypass patterns',
      file: 'src/index.ts',
      pattern: /if\s*\(\s*false\s*\)/g,
      severity: 'HIGH',
    },
    {
      name: 'BYPASS comments',
      file: 'src/index.ts',
      pattern: /\/\/.*BYPASS|TEMP.*BYPASS/gi,
      severity: 'MEDIUM',
    },
  ];

  let foundBypasses = 0;
  let criticalBypasses = 0;

  for (const bypass of bypasses) {
    const filePath = path.join(baseDir, bypass.file);
    const content = readFile(filePath);

    if (!content) {
      console.log(`   ⚠️  Could not read ${bypass.file}`);
      continue;
    }

    const matches = content.match(bypass.pattern);

    if (matches && matches.length > 0) {
      foundBypasses++;
      if (bypass.severity === 'CRITICAL') {
        criticalBypasses++;
      }

      console.log(`\n   🚨 [${bypass.severity}] ${bypass.name}`);
      console.log(`      File: ${bypass.file}`);
      console.log(`      Occurrences: ${matches.length}`);

      if (bypass.severity === 'CRITICAL') {
        console.log(`      ⚠️  THIS IS A CRITICAL SECURITY ISSUE`);
      }
    } else {
      console.log(`   ✅ No ${bypass.name}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`📊 Bypasses Found: ${foundBypasses}`);
  console.log(`🚨 Critical Bypasses: ${criticalBypasses}`);

  return { total: foundBypasses, critical: criticalBypasses };
}

// ============================================================================
// CONFIGURATION VALIDATOR
// ============================================================================

function validateConfiguration(baseDir) {
  console.log('\n' + '='.repeat(70));
  console.log('🔒 VALIDATING CONFIGURATION');
  console.log('='.repeat(70));

  const checks = [
    {
      name: 'TOKEN-QUALITY-FILTER.ts exists',
      file: 'src/core/TOKEN-QUALITY-FILTER.ts',
      checkExists: true,
    },
    {
      name: 'UNIFIED-CONTROL.ts exists',
      file: 'src/core/UNIFIED-CONTROL.ts',
      checkExists: true,
    },
    {
      name: 'emergency-safety-wrapper.ts exists',
      file: 'src/emergency-safety-wrapper.ts',
      checkExists: true,
    },
  ];

  let allPassed = true;

  for (const check of checks) {
    const filePath = path.join(baseDir, check.file);
    const exists = fs.existsSync(filePath);

    if (exists === check.checkExists) {
      console.log(`✅ ${check.name}`);
    } else {
      allPassed = false;
      console.log(`❌ ${check.name} - File ${exists ? 'exists' : 'missing'}`);
    }
  }

  return allPassed;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 CONFIG INTEGRITY TEST - sol-bot-main');
  console.log('   Testing configuration usage and detecting bypasses');
  console.log('='.repeat(70));

  const baseDir = __dirname;

  // Step 1: Validate configuration files exist
  const configValid = validateConfiguration(baseDir);

  // Step 2: Detect known bypasses
  const bypassResults = detectKnownBypasses(baseDir);

  // Step 3: Run integrity tests
  console.log('\n' + '='.repeat(70));
  console.log('🧪 RUNNING INTEGRITY TESTS');
  console.log('='.repeat(70));

  const allResults = {
    total: 0,
    passed: 0,
    failed: 0,
    critical_failed: 0,
  };

  for (const integrityTest of INTEGRITY_TESTS) {
    const results = runIntegrityTest(integrityTest, baseDir);

    allResults.total += results.total;
    allResults.passed += results.passed;
    allResults.failed += results.failed;
    allResults.critical_failed += results.critical_failed;
  }

  // Step 4: Final summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(70));

  console.log(`\n✅ Tests passed: ${allResults.passed}/${allResults.total}`);
  console.log(`❌ Tests failed: ${allResults.failed}/${allResults.total}`);

  if (allResults.critical_failed > 0) {
    console.log(`🚨 CRITICAL FAILURES: ${allResults.critical_failed}`);
  }

  if (bypassResults.critical > 0) {
    console.log(`🚨 CRITICAL BYPASSES DETECTED: ${bypassResults.critical}`);
  }

  console.log('\n' + '='.repeat(70));

  const overallPass = configValid &&
                      allResults.critical_failed === 0 &&
                      bypassResults.critical === 0;

  if (overallPass) {
    console.log('✅ INTEGRITY TEST PASSED');
    console.log('   Configuration is properly used throughout the codebase');
    console.log('   No critical bypasses detected');
  } else {
    console.log('⚠️  INTEGRITY TEST FAILED');

    if (!configValid) {
      console.log('   ❌ Configuration files missing or invalid');
    }
    if (allResults.critical_failed > 0) {
      console.log(`   ❌ ${allResults.critical_failed} critical integrity checks failed`);
    }
    if (bypassResults.critical > 0) {
      console.log(`   ❌ ${bypassResults.critical} critical bypasses detected`);
    }

    console.log('\n📋 RECOMMENDED ACTIONS:');
    console.log('   1. Review BYPASS_DETECTOR_RESULTS.md for details');
    console.log('   2. Run: node bypass-fixes.js --dry-run');
    console.log('   3. Apply fixes: node bypass-fixes.js --force');
    console.log('   4. Re-run this test to verify');
  }

  console.log('='.repeat(70) + '\n');

  // Return exit code
  return overallPass ? 0 : 1;
}

// ============================================================================
// EXPORT AND EXECUTION
// ============================================================================

// Run if called directly
if (require.main === module) {
  const exitCode = main();
  process.exit(exitCode);
}

// Export for use as module
module.exports = {
  INTEGRITY_TESTS,
  runIntegrityTest,
  validateConfiguration,
  detectKnownBypasses,
  main,
};
