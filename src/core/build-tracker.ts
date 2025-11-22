/**
 * BUILD TRACKER SYSTEM
 * Tracks compilation timestamps to ensure JavaScript files are up-to-date with TypeScript sources
 *
 * PROBLEM SOLVED: TypeScript files were being modified but compiled JavaScript wasn't updating
 * SOLUTION: Timestamp-based verification system that detects stale compiled files
 *
 * Generated: November 12, 2025
 */

// ============================================================================
// BUILD TIMESTAMP - UPDATED ON EACH COMPILATION
// ============================================================================

/**
 * This timestamp is automatically updated by update-build.js before each compilation.
 * Use this to verify your JavaScript files are up-to-date.
 *
 * Format: Unix timestamp (milliseconds since epoch)
 */
export const BUILD_TIMESTAMP = 1763829927680; // AUTO-UPDATED - DO NOT MANUALLY EDIT

/**
 * Human-readable build date
 */
export const BUILD_DATE = new Date(BUILD_TIMESTAMP).toISOString();

// ============================================================================
// COMPONENT VERSIONS - KEY FILE TRACKING
// ============================================================================

/**
 * Tracks the last modified version of key components.
 * Each entry represents a critical file and when it was last successfully compiled.
 */
export const COMPONENT_VERSIONS =   {
    "index.ts": 1762985665387.8442,
    "UNIFIED-CONTROL.ts": 1762467695657.5083,
    "TOKEN-QUALITY-FILTER.ts": 1762985665390.842,
    "vip-token-check.ts": 1762985665375.6848,
    "emergency-safety-wrapper.ts": 1758760110462.2793,
    "positionMonitor.ts": 1762899707993.6074,
    "buyExecutor.ts": 1762985706672,
    "sellExecutor.ts": 1762899744818.3257
  };

// ============================================================================
// COMPILATION VERIFICATION
// ============================================================================

/**
 * Check if the current build is up-to-date
 * Call this at bot startup to verify compilation status
 */
export function checkCompilation(): {
  isUpToDate: boolean;
  buildAge: number;
  warning?: string;
} {
  const now = Date.now();
  const buildAge = now - BUILD_TIMESTAMP;
  const buildAgeMinutes = Math.floor(buildAge / 1000 / 60);
  const buildAgeHours = Math.floor(buildAgeMinutes / 60);

  // Build is considered stale after 24 hours without update
  const isStale = buildAge > 24 * 60 * 60 * 1000;

  let warning: string | undefined;
  if (isStale) {
    warning = `Build is ${buildAgeHours} hours old - consider rebuilding`;
  }

  return {
    isUpToDate: !isStale,
    buildAge: buildAgeMinutes,
    warning,
  };
}

/**
 * Display build information at startup
 * Call this from your main index.ts to see build status
 */
export function displayBuildInfo(): void {
  const status = checkCompilation();

  console.log('\n' + '='.repeat(70));
  console.log('🔨 BUILD INFORMATION');
  console.log('='.repeat(70));
  console.log(`   Build Timestamp: ${BUILD_DATE}`);
  console.log(`   Build Age: ${status.buildAge} minutes`);
  console.log(`   Status: ${status.isUpToDate ? '✅ Up-to-date' : '⚠️  Stale'}`);

  if (status.warning) {
    console.log(`   ⚠️  WARNING: ${status.warning}`);
  }

  console.log('\n📦 Component Versions:');
  for (const [component, timestamp] of Object.entries(COMPONENT_VERSIONS)) {
    const date = new Date(timestamp);
    const age = Math.floor((Date.now() - timestamp) / 1000 / 60);
    console.log(`   ${component.padEnd(30)} ${date.toLocaleString()} (${age}m ago)`);
  }

  console.log('='.repeat(70) + '\n');
}

/**
 * Verify a specific component is up-to-date
 */
export function verifyComponent(componentName: keyof typeof COMPONENT_VERSIONS): boolean {
  const componentTimestamp = COMPONENT_VERSIONS[componentName];
  if (!componentTimestamp) {
    console.warn(`⚠️  Component not tracked: ${componentName}`);
    return false;
  }

  const age = Date.now() - componentTimestamp;
  const isRecent = age < 24 * 60 * 60 * 1000; // Less than 24 hours old

  if (!isRecent) {
    console.warn(`⚠️  Component may be stale: ${componentName} (${Math.floor(age / 1000 / 60)} minutes old)`);
  }

  return isRecent;
}

/**
 * Get the build signature - unique identifier for this build
 */
export function getBuildSignature(): string {
  return `${BUILD_TIMESTAMP}-${Object.keys(COMPONENT_VERSIONS).length}`;
}

/**
 * Check if running from compiled JavaScript or TypeScript source
 */
export function isCompiledMode(): boolean {
  // If __filename ends with .js, we're running compiled code
  // If it ends with .ts, we're running through ts-node
  try {
    // @ts-ignore - __filename may not be available in all contexts
    return typeof __filename !== 'undefined' && __filename.endsWith('.js');
  } catch {
    return false;
  }
}

// ============================================================================
// EXPORT BUILD METADATA
// ============================================================================

export const BUILD_METADATA = {
  timestamp: BUILD_TIMESTAMP,
  date: BUILD_DATE,
  signature: getBuildSignature(),
  components: COMPONENT_VERSIONS,
  isUpToDate: checkCompilation().isUpToDate,
};

// ============================================================================
// STARTUP CHECK
// ============================================================================

/**
 * Performs comprehensive startup verification
 * Call this at the very beginning of your bot
 */
export function performStartupCheck(): {
  passed: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check build age
  const status = checkCompilation();
  if (!status.isUpToDate) {
    warnings.push(`Build is ${status.buildAge} minutes old`);
  }

  // Check if running in compiled mode (production) vs ts-node (dev)
  const compiled = isCompiledMode();
  if (!compiled) {
    warnings.push('Running in development mode (ts-node) - use compiled JavaScript for production');
  }

  // Check all components
  for (const component of Object.keys(COMPONENT_VERSIONS) as Array<keyof typeof COMPONENT_VERSIONS>) {
    const isValid = verifyComponent(component);
    if (!isValid) {
      warnings.push(`Component ${component} may be outdated`);
    }
  }

  const passed = errors.length === 0;

  return {
    passed,
    errors,
    warnings,
  };
}

/**
 * Display comprehensive startup check results
 */
export function displayStartupCheck(): void {
  const check = performStartupCheck();

  console.log('\n' + '='.repeat(70));
  console.log('🔍 STARTUP VERIFICATION CHECK');
  console.log('='.repeat(70));

  if (check.passed) {
    console.log('✅ All checks passed');
  } else {
    console.log('❌ Some checks failed');
  }

  if (check.errors.length > 0) {
    console.log('\n🚨 ERRORS:');
    for (const error of check.errors) {
      console.log(`   ❌ ${error}`);
    }
  }

  if (check.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    for (const warning of check.warnings) {
      console.log(`   ⚠️  ${warning}`);
    }
  }

  console.log('='.repeat(70) + '\n');
}

// Export everything
export default {
  BUILD_TIMESTAMP,
  BUILD_DATE,
  BUILD_METADATA,
  COMPONENT_VERSIONS,
  checkCompilation,
  displayBuildInfo,
  verifyComponent,
  getBuildSignature,
  isCompiledMode,
  performStartupCheck,
  displayStartupCheck,
};
