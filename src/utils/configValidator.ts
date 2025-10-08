// configValidator.ts - Prevents usage of deprecated config files
// Ensures all imports use UNIFIED-CONTROL.ts

import { MASTER_SETTINGS } from '../core/UNIFIED-CONTROL';

export class ConfigValidator {
  private static readonly VALID_CONFIG_PATH = 'core/UNIFIED-CONTROL';
  private static readonly DEPRECATED_PATHS = [
    'enhanced/masterConfig',
    'src/enhanced/masterConfig',
    './enhanced/masterConfig',
    '../enhanced/masterConfig',
    'z-new-controls/z-masterConfig',
    '../../z-new-controls/z-masterConfig'
  ];

  /**
   * Validates that the correct configuration is being used
   * Call this at the start of any file that needs config
   */
  static validateConfigUsage(importedFrom: string): void {
    console.log(`🔍 Config Validator: Checking config import from '${importedFrom}'`);

    // Check if trying to use deprecated config
    const isDeprecated = this.DEPRECATED_PATHS.some(path =>
      importedFrom.includes(path)
    );

    if (isDeprecated) {
      console.error("🚨 CRITICAL ERROR: Using DEPRECATED configuration!");
      console.error(`🚨 Attempted import from: ${importedFrom}`);
      console.error(`🚨 MUST use: ${this.VALID_CONFIG_PATH}`);
      throw new Error(`DEPRECATED CONFIG USAGE: Use ${this.VALID_CONFIG_PATH} instead of ${importedFrom}`);
    }

    // Verify MASTER_SETTINGS is properly loaded
    if (!MASTER_SETTINGS || typeof MASTER_SETTINGS !== 'object') {
      throw new Error("MASTER_SETTINGS not properly loaded from core/UNIFIED-CONTROL");
    }

    // Verify it has z_ prefixed properties (signature of unified config)
    if (!MASTER_SETTINGS.version || !MASTER_SETTINGS.pool) {
      throw new Error("Invalid config structure - missing required properties");
    }

    console.log("✅ Config Validator: Using correct UNIFIED-CONTROL configuration");
  }

  /**
   * Gets the validated MASTER_SETTINGS object
   * Use this instead of direct imports in new files
   */
  static getValidatedConfig() {
    this.validateConfigUsage('core/UNIFIED-CONTROL');
    return MASTER_SETTINGS;
  }

  /**
   * Scans a file's content for deprecated config imports
   */
  static scanFileForDeprecatedImports(fileContent: string, fileName: string): string[] {
    const issues: string[] = [];

    this.DEPRECATED_PATHS.forEach(deprecatedPath => {
      if (fileContent.includes(deprecatedPath)) {
        issues.push(`${fileName}: Found deprecated import '${deprecatedPath}'`);
      }
    });

    // Check for old config property names
    const oldConfigPatterns = [
      'masterConfig.runtime',
      'masterConfig.pool',
      'masterConfig.entry',
      'config.runtime',
      'config.pool'
    ];

    oldConfigPatterns.forEach(pattern => {
      if (fileContent.includes(pattern)) {
        const property = pattern.split('.')[1];
        issues.push(`${fileName}: Found old config pattern '${pattern}' - use MASTER_SETTINGS.${property} instead`);
      }
    });

    return issues;
  }

  /**
   * Display current configuration status
   */
  static displayConfigStatus(): void {
    console.log("\n" + "=".repeat(50));
    console.log("📋 CONFIGURATION STATUS");
    console.log("=".repeat(50));
    console.log(`✅ Active Config: core/UNIFIED-CONTROL.ts`);
    console.log(`🔒 Config Version: ${MASTER_SETTINGS.z_configVersion}`);
    console.log(`🤖 Bot Version: ${MASTER_SETTINGS.version}`);
    console.log(`🧪 Test Mode: ${MASTER_SETTINGS.runtime?.mode?.simulation || false}`);
    console.log(`💰 Initial Pool: $${MASTER_SETTINGS.pool.initialPool}`);
    console.log(`🎯 Target Pool: $${MASTER_SETTINGS.pool.targetPoolUSD}`);
    console.log(`⏱️ Duration: ${MASTER_SETTINGS.limits?.duration === 0 ? 'Unlimited' : (MASTER_SETTINGS.limits?.duration || 0) + ' seconds'}`);
    console.log("=".repeat(50));
    console.log("⚠️  DEPRECATED: ALL other config files");
    console.log("✅ USE ONLY: core/UNIFIED-CONTROL.ts");
    console.log("=".repeat(50));
  }
}

// Example usage in your files:
// import { ConfigValidator } from './utils/configValidator';
// const config = ConfigValidator.getValidatedConfig();
// ConfigValidator.displayConfigStatus();