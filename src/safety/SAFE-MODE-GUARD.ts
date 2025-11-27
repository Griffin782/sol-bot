/**
 * SAFE-MODE-GUARD.ts - Absolute Safety Enforcement
 *
 * PURPOSE: Make it IMPOSSIBLE to accidentally run LIVE trading.
 *
 * SAFETY RULES:
 * - ALWAYS defaults to PAPER mode
 * - LIVE mode requires ALL of these to be true:
 *   1) process.env.ALLOW_LIVE_TRADING === "true"
 *   2) process.env.I_UNDERSTAND_THE_RISK === "YES"
 *   3) MASTER_SETTINGS.allowLiveTrading === true (config flag)
 *   4) CLI flag --live is passed
 *
 * - If ANY safety check fails → force PAPER mode
 * - Log clear warnings when safety checks block LIVE mode
 */

import * as dotenv from 'dotenv';
dotenv.config();

export type TradingMode = 'PAPER' | 'LIVE' | 'MICRO' | 'CONSERVATIVE' | 'PRODUCTION';

export interface SafeModeCheck {
  check: string;
  passed: boolean;
  reason: string;
}

export interface SafeModeResult {
  rawMode: TradingMode;
  effectiveMode: TradingMode;
  rawUseRealMoney: boolean;
  effectiveUseRealMoney: boolean;
  safetyChecks: SafeModeCheck[];
  allChecksPassed: boolean;
  warning: string | null;
}

/**
 * Check if --live flag is present in command line arguments
 */
function hasLiveFlag(): boolean {
  return process.argv.includes('--live');
}

/**
 * Perform all safety checks for LIVE mode
 */
function performSafetyChecks(configAllowsLive: boolean): SafeModeCheck[] {
  const checks: SafeModeCheck[] = [];

  // Check 1: Environment variable ALLOW_LIVE_TRADING
  checks.push({
    check: 'ENV: ALLOW_LIVE_TRADING',
    passed: process.env.ALLOW_LIVE_TRADING === 'true',
    reason: process.env.ALLOW_LIVE_TRADING === 'true'
      ? 'Environment allows live trading'
      : 'Set ALLOW_LIVE_TRADING=true in .env to enable'
  });

  // Check 2: Environment variable I_UNDERSTAND_THE_RISK
  checks.push({
    check: 'ENV: I_UNDERSTAND_THE_RISK',
    passed: process.env.I_UNDERSTAND_THE_RISK === 'YES',
    reason: process.env.I_UNDERSTAND_THE_RISK === 'YES'
      ? 'Risk acknowledgment confirmed'
      : 'Set I_UNDERSTAND_THE_RISK=YES in .env to confirm'
  });

  // Check 3: Config flag allowLiveTrading
  checks.push({
    check: 'CONFIG: allowLiveTrading',
    passed: configAllowsLive,
    reason: configAllowsLive
      ? 'Configuration allows live trading'
      : 'Set MASTER_SETTINGS.allowLiveTrading = true in UNIFIED-CONTROL.ts'
  });

  // Check 4: CLI flag --live
  checks.push({
    check: 'CLI: --live flag',
    passed: hasLiveFlag(),
    reason: hasLiveFlag()
      ? 'CLI flag --live detected'
      : 'Pass --live flag when starting bot'
  });

  return checks;
}

/**
 * Get effective trading mode after applying safety rules
 */
export function getEffectiveMode(
  rawMode: TradingMode,
  configAllowsLive: boolean = false
): SafeModeResult {
  // If raw mode is already PAPER, no checks needed
  if (rawMode === 'PAPER') {
    return {
      rawMode,
      effectiveMode: 'PAPER',
      rawUseRealMoney: false,
      effectiveUseRealMoney: false,
      safetyChecks: [],
      allChecksPassed: true,
      warning: null
    };
  }

  // Raw mode wants to use real money - perform safety checks
  const safetyChecks = performSafetyChecks(configAllowsLive);
  const allChecksPassed = safetyChecks.every(check => check.passed);

  if (allChecksPassed) {
    // All checks passed - allow requested mode
    return {
      rawMode,
      effectiveMode: rawMode,
      rawUseRealMoney: true,
      effectiveUseRealMoney: true,
      safetyChecks,
      allChecksPassed: true,
      warning: null
    };
  }

  // Safety checks failed - force PAPER mode
  const failedChecks = safetyChecks.filter(check => !check.passed);
  const warning = `LIVE trading requested but ${failedChecks.length} safety check(s) failed. Forcing PAPER mode.`;

  return {
    rawMode,
    effectiveMode: 'PAPER',
    rawUseRealMoney: true,
    effectiveUseRealMoney: false,
    safetyChecks,
    allChecksPassed: false,
    warning
  };
}

/**
 * Get effective useRealMoney flag after applying safety rules
 */
export function getEffectiveUseRealMoney(
  rawUseRealMoney: boolean,
  configAllowsLive: boolean = false
): boolean {
  if (!rawUseRealMoney) {
    return false; // Already safe
  }

  // Raw wants to use real money - check safety
  const safetyChecks = performSafetyChecks(configAllowsLive);
  const allChecksPassed = safetyChecks.every(check => check.passed);

  return allChecksPassed; // Only allow real money if all checks pass
}

/**
 * Log safety check results with clear formatting
 */
export function logSafeModeStatus(result: SafeModeResult): void {
  console.log('\n' + '='.repeat(80));
  console.log('🔒 SAFE MODE GUARD - Trading Mode Validation');
  console.log('='.repeat(80));

  console.log(`\n📊 Mode Status:`);
  console.log(`   Raw mode requested: ${result.rawMode}`);
  console.log(`   Effective mode: ${result.effectiveMode}`);
  console.log(`   Raw useRealMoney: ${result.rawUseRealMoney}`);
  console.log(`   Effective useRealMoney: ${result.effectiveUseRealMoney}`);

  if (result.safetyChecks.length > 0) {
    console.log(`\n🛡️  Safety Checks (${result.allChecksPassed ? 'ALL PASSED' : 'FAILED'}):`);

    result.safetyChecks.forEach(check => {
      const icon = check.passed ? '✅' : '❌';
      console.log(`   ${icon} ${check.check}`);
      console.log(`      ${check.reason}`);
    });
  }

  if (result.warning) {
    console.log(`\n⚠️  WARNING: ${result.warning}`);
    console.log(`\n🔒 FORCED TO PAPER MODE - No real money will be used.`);
  }

  if (result.effectiveMode === 'PAPER') {
    console.log(`\n✅ SAFE MODE ACTIVE - Paper trading only (simulated trades)`);
  } else {
    console.log(`\n⚡ LIVE MODE ACTIVE - Real money trading enabled`);
    console.log(`   ⚠️  All safety checks passed - proceed with caution!`);
  }

  console.log('='.repeat(80) + '\n');
}

/**
 * Emergency override to force PAPER mode (for system errors/emergencies)
 */
export function forceEmergencyPaperMode(reason: string): SafeModeResult {
  console.error(`\n🚨 EMERGENCY PAPER MODE ACTIVATED`);
  console.error(`   Reason: ${reason}`);
  console.error(`   All trading forced to PAPER mode for safety.\n`);

  return {
    rawMode: 'LIVE',
    effectiveMode: 'PAPER',
    rawUseRealMoney: true,
    effectiveUseRealMoney: false,
    safetyChecks: [],
    allChecksPassed: false,
    warning: `EMERGENCY: ${reason}`
  };
}
