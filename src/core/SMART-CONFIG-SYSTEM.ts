import * as fs from 'fs';
import * as path from 'path';
import { ConfigWizard, GeneratedConfig } from './CONFIG-WIZARD';
import { SmartConfigValidator, ValidationResult } from './SMART-CONFIG-VALIDATOR';
import { PreFlightCheck, SystemConfig, FlightStatus } from './PRE-FLIGHT-CHECK';
import { ConfigHistory, SessionConfig, SessionResults } from './CONFIG-HISTORY';
import { AutoConfig, UserGoals, OptimalConfig } from './AUTO-CONFIG';

interface SmartConfigOptions {
  mode: 'wizard' | 'auto' | 'preset';
  autoGoals?: UserGoals;
  presetType?: 'conservative' | 'balanced' | 'aggressive';
  startingCapital?: number;
  skipValidation?: boolean;
  skipPreFlight?: boolean;
  dryRun?: boolean;
}

interface ConfigurationResult {
  success: boolean;
  config?: GeneratedConfig | OptimalConfig;
  sessionId?: string;
  issues: string[];
  warnings: string[];
  readyToLaunch: boolean;
  configPath?: string;
}

interface UnifiedControlUpdate {
  sessionConfigs: any[];
  globalLimits: {
    maxTradesAbsolute: number;
    maxTradesPerSession: number;
    maxPositions: number;
    positionSizeUSD: number;
    initialPool: number;
  };
  safetySettings: {
    stopLoss: number;
    maxDrawdown: number;
    testMode: boolean;
  };
}

class SmartConfigSystem {
  private history: ConfigHistory;
  private autoConfig: AutoConfig;
  private unifiedControlPath: string;

  constructor() {
    this.history = new ConfigHistory();
    this.autoConfig = new AutoConfig();
    this.unifiedControlPath = './src/core/UNIFIED-CONTROL.ts';
  }

  /**
   * Main entry point - complete bot setup process
   */
  async setupBot(options: SmartConfigOptions = { mode: 'wizard' }): Promise<ConfigurationResult> {
    console.log('\n🎯 SMART CONFIG SYSTEM - INITIALIZING BOT SETUP');
    console.log('='.repeat(60));

    const result: ConfigurationResult = {
      success: false,
      issues: [],
      warnings: [],
      readyToLaunch: false
    };

    try {
      // Step 1: Get Configuration
      console.log('\n📋 STEP 1: Configuration Generation');
      const config = await this.getConfiguration(options);
      if (!config) {
        result.issues.push('Configuration generation cancelled or failed');
        return result;
      }

      result.config = config;
      console.log('✅ Configuration generated successfully');

      // Step 2: Validation (unless skipped)
      if (!options.skipValidation) {
        console.log('\n🔍 STEP 2: Configuration Validation');
        const validation = await this.validateConfiguration(config);
        if (!validation.passed) {
          result.issues.push(...validation.criticalErrors);
          result.warnings.push(...validation.warnings);
          console.log('❌ Configuration validation failed');
          return result;
        }
        console.log('✅ Configuration validation passed');
      }

      // Step 3: Pre-flight Checks (unless skipped)
      if (!options.skipPreFlight) {
        console.log('\n🛫 STEP 3: Pre-flight Checks');
        const systemConfig = this.convertToSystemConfig(config);
        const preFlightStatus = await this.runPreFlightChecks(systemConfig);
        if (!preFlightStatus.readyForLaunch) {
          result.issues.push(...preFlightStatus.recommendations);
          console.log('❌ Pre-flight checks failed');
          return result;
        }
        console.log('✅ Pre-flight checks passed');
      }

      // Step 4: Save to History
      console.log('\n💾 STEP 4: Saving Configuration History');
      const sessionId = await this.saveToHistory(config);
      result.sessionId = sessionId;
      console.log(`✅ Configuration saved with ID: ${sessionId}`);

      // Step 5: Apply to System (unless dry run)
      if (!options.dryRun) {
        console.log('\n⚙️  STEP 5: Applying Configuration');
        const configPath = await this.applyToUnifiedControl(config);
        result.configPath = configPath;
        console.log('✅ Configuration applied to UNIFIED-CONTROL.ts');

        // Step 6: Final Verification
        console.log('\n🔬 STEP 6: Final System Verification');
        await this.verifySystemReady();
        console.log('✅ System verification complete');
      } else {
        console.log('\n🧪 DRY RUN: Configuration ready but not applied');
      }

      result.success = true;
      result.readyToLaunch = !options.dryRun;

      this.printSuccessSummary(result);
      return result;

    } catch (error) {
      console.error('\n💥 SETUP FAILED:', error);
      result.issues.push(`Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Get configuration based on specified mode
   */
  private async getConfiguration(options: SmartConfigOptions): Promise<GeneratedConfig | OptimalConfig | null> {
    switch (options.mode) {
      case 'wizard':
        console.log('🧙‍♂️ Starting interactive configuration wizard...');
        return await ConfigWizard.run();

      case 'auto':
        if (!options.autoGoals) {
          throw new Error('Auto mode requires autoGoals to be specified');
        }
        console.log('🤖 Generating automatic configuration...');
        const autoResult = this.autoConfig.generateOptimalConfig(options.autoGoals);

        // Handle realistic adjustments
        if ('original' in autoResult) {
          console.log('⚠️ Original goals adjusted for realism:');
          console.log(autoResult.reasoning.join('\n'));
          console.log('\nUsing balanced alternative...');
          const adjustedResult = this.autoConfig.generateOptimalConfig(autoResult.adjusted);
          return adjustedResult as OptimalConfig;
        }

        return autoResult as OptimalConfig;

      case 'preset':
        if (!options.presetType || !options.startingCapital) {
          throw new Error('Preset mode requires presetType and startingCapital');
        }
        console.log(`📋 Loading ${options.presetType} preset configuration...`);
        return this.autoConfig.getPresetConfig(options.presetType, options.startingCapital);

      default:
        throw new Error(`Unknown configuration mode: ${options.mode}`);
    }
  }

  /**
   * Helper function to safely get maxTrades value
   */
  private getMaxTrades(config: GeneratedConfig | OptimalConfig): number {
    const configAny = config as any;
    return configAny.maxTradesAbsolute || configAny.maxTrades || 100;
  }

  /**
   * Helper function to safely get maxTradesPerSession value
   */
  private getMaxTradesPerSession(config: GeneratedConfig | OptimalConfig): number {
    const configAny = config as any;
    return configAny.maxTradesPerSession || configAny.maxTrades || 50;
  }

  /**
   * Validate the generated configuration
   */
  private async validateConfiguration(config: GeneratedConfig | OptimalConfig): Promise<{
    passed: boolean;
    criticalErrors: string[];
    warnings: string[];
  }> {
    const sessions = 'sessions' in config ? config.sessions : [];
    const maxTradesAbsolute = this.getMaxTrades(config);
    const maxTradesPerSession = this.getMaxTradesPerSession(config);
    const positionSizeUSD = config.positionSizeUSD;
    const maxPositions = config.maxPositions;
    const initialPool = config.initialPool;

    const validation = SmartConfigValidator.validateConfiguration(
      sessions,
      maxTradesAbsolute,
      maxTradesPerSession,
      positionSizeUSD,
      maxPositions,
      initialPool
    );

    const criticalErrors = validation.results
      .filter(r => !r.isValid && r.severity === 'error')
      .map(r => r.message);

    const warnings = validation.results
      .filter(r => r.severity === 'warning')
      .map(r => r.message);

    if (!validation.overall) {
      console.log(validation.summary);
    }

    return {
      passed: validation.overall,
      criticalErrors,
      warnings
    };
  }

  /**
   * Convert config to system config format for pre-flight checks
   */
  private convertToSystemConfig(config: GeneratedConfig | OptimalConfig): SystemConfig {
    // Load current environment settings
    const envPath = './.env';
    let rpcUrl = 'https://api.mainnet-beta.solana.com';
    let privateKey = '';
    let walletAddress = '';

    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const rpcMatch = envContent.match(/RPC_HTTPS_URI=(.+)/);
      const keyMatch = envContent.match(/PRIVATE_KEY=(.+)/);
      const walletMatch = envContent.match(/WALLET_ADDRESS=(.+)/);

      if (rpcMatch) rpcUrl = rpcMatch[1];
      if (keyMatch) privateKey = keyMatch[1];
      if (walletMatch) walletAddress = walletMatch[1];
    }

    // Properly detect test mode from config
    const configAny = config as any;
    const testMode = configAny.testMode || configAny.z_testMode || configAny.isTestMode || false;

    return {
      initialPool: config.initialPool,
      positionSizeUSD: config.positionSizeUSD,
      maxTradesAbsolute: this.getMaxTrades(config),
      maxTradesPerSession: this.getMaxTradesPerSession(config),
      maxPositions: config.maxPositions,
      rpcUrl,
      privateKey,
      walletAddress,
      testMode
    };
  }

  /**
   * Run pre-flight checks
   */
  private async runPreFlightChecks(systemConfig: SystemConfig): Promise<FlightStatus> {
    const checker = new PreFlightCheck(systemConfig);
    return await checker.runAllChecks();
  }

  /**
   * Save configuration to history
   */
  private async saveToHistory(config: GeneratedConfig | OptimalConfig): Promise<string> {
    // Convert to session config format
    const sessionConfig: SessionConfig = {
      sessionNumber: 1,
      initialPool: config.initialPool,
      targetPool: 'sessions' in config && config.sessions.length > 0
        ? config.sessions[config.sessions.length - 1].targetPool
        : config.initialPool * 2,
      positionSizeUSD: config.positionSizeUSD,
      maxTrades: this.getMaxTrades(config),
      maxPositions: config.maxPositions,
      riskLevel: 'sessions' in config && config.sessions.length > 0
        ? config.sessions[0].riskLevel
        : 'moderate',
      timestamp: new Date().toISOString(),
      testMode: false
    };

    return await this.history.savePreSessionConfig(sessionConfig);
  }

  /**
   * Apply configuration to UNIFIED-CONTROL.ts
   */
  private async applyToUnifiedControl(config: GeneratedConfig | OptimalConfig): Promise<string> {
    const unifiedControlUpdate: UnifiedControlUpdate = {
      sessionConfigs: 'sessions' in config ? config.sessions : [],
      globalLimits: {
        maxTradesAbsolute: this.getMaxTrades(config),
        maxTradesPerSession: this.getMaxTradesPerSession(config),
        maxPositions: config.maxPositions,
        positionSizeUSD: config.positionSizeUSD,
        initialPool: config.initialPool
      },
      safetySettings: {
        stopLoss: 'safetyLimits' in config ? config.safetyLimits.stopLoss : -15,
        maxDrawdown: 'safetyLimits' in config ? config.safetyLimits.maxDrawdown : 25,
        testMode: false
      }
    };

    // Create backup
    const backupPath = this.createConfigBackup();

    // Update UNIFIED-CONTROL.ts
    await this.updateUnifiedControlFile(unifiedControlUpdate);

    // Verify the update
    const verification = this.verifyConfigUpdate();
    if (!verification.success) {
      // Restore backup if update failed
      this.restoreConfigBackup(backupPath);
      throw new Error(`Config update failed: ${verification.error}`);
    }

    return this.unifiedControlPath;
  }

  /**
   * Create backup of current UNIFIED-CONTROL.ts
   */
  private createConfigBackup(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `./backups/unified-control-backup-${timestamp}.ts`;

    // Ensure backup directory exists
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Copy current file to backup
    if (fs.existsSync(this.unifiedControlPath)) {
      fs.copyFileSync(this.unifiedControlPath, backupPath);
    }

    return backupPath;
  }

  /**
   * Update UNIFIED-CONTROL.ts with new configuration
   */
  private async updateUnifiedControlFile(update: UnifiedControlUpdate): Promise<void> {
    if (!fs.existsSync(this.unifiedControlPath)) {
      throw new Error('UNIFIED-CONTROL.ts not found');
    }

    let content = fs.readFileSync(this.unifiedControlPath, 'utf8');

    // Update session configurations
    if (update.sessionConfigs.length > 0) {
      const sessionConfigString = JSON.stringify(update.sessionConfigs, null, 2);
      const sessionRegex = /const\s+DEFAULT_SESSION_PROGRESSION:\s*SessionConfig\[\]\s*=\s*\[[\s\S]*?\];/;

      if (sessionRegex.test(content)) {
        content = content.replace(
          sessionRegex,
          `const DEFAULT_SESSION_PROGRESSION: SessionConfig[] = ${sessionConfigString};`
        );
      }
    }

    // Update global limits
    const limitsRegex = /const\s+GLOBAL_LIMITS\s*=\s*{[\s\S]*?};/;
    const globalLimitsString = `const GLOBAL_LIMITS = {
  maxTradesAbsolute: ${update.globalLimits.maxTradesAbsolute},
  maxTradesPerSession: ${update.globalLimits.maxTradesPerSession},
  maxPositions: ${update.globalLimits.maxPositions},
  positionSizeUSD: ${update.globalLimits.positionSizeUSD},
  initialPool: ${update.globalLimits.initialPool}
};`;

    if (limitsRegex.test(content)) {
      content = content.replace(limitsRegex, globalLimitsString);
    }

    // Add timestamp comment
    const timestamp = new Date().toISOString();
    content = `// Configuration updated by SMART-CONFIG-SYSTEM on ${timestamp}\n${content}`;

    fs.writeFileSync(this.unifiedControlPath, content);
  }

  /**
   * Verify configuration update was successful
   */
  private verifyConfigUpdate(): { success: boolean; error?: string } {
    try {
      // Try to require the updated file to check for syntax errors
      delete require.cache[require.resolve(path.resolve(this.unifiedControlPath))];
      require(path.resolve(this.unifiedControlPath));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown syntax error'
      };
    }
  }

  /**
   * Restore backup configuration
   */
  private restoreConfigBackup(backupPath: string): void {
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, this.unifiedControlPath);
      console.log(`⚠️ Configuration restored from backup: ${backupPath}`);
    }
  }

  /**
   * Final system verification
   */
  private async verifySystemReady(): Promise<void> {
    // Check if all required files exist and are accessible
    const requiredFiles = [
      './src/index.ts',
      './src/config.ts',
      this.unifiedControlPath
    ];

    const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
    if (missingFiles.length > 0) {
      throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
    }

    // Verify data directories exist
    const requiredDirs = ['./data', './logs'];
    requiredDirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    console.log('📁 All required files and directories verified');
  }

  /**
   * Print success summary
   */
  private printSuccessSummary(result: ConfigurationResult): void {
    console.log('\n' + '🎉'.repeat(20));
    console.log('🚀 BOT SETUP COMPLETED SUCCESSFULLY!');
    console.log('🎉'.repeat(20));

    if (result.config) {
      console.log('\n📊 CONFIGURATION SUMMARY:');
      if ('sessions' in result.config) {
        console.log(`   Sessions: ${result.config.sessions.length}`);
        console.log(`   Initial Pool: $${result.config.initialPool.toLocaleString()}`);
        console.log(`   Position Size: $${result.config.positionSizeUSD}`);
        console.log(`   Max Trades: ${this.getMaxTrades(result.config)}`);
      }
    }

    if (result.sessionId) {
      console.log(`\n💾 Session ID: ${result.sessionId}`);
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      result.warnings.forEach(warning => console.log(`   • ${warning}`));
    }

    if (result.readyToLaunch) {
      console.log('\n🚀 SYSTEM READY FOR LAUNCH!');
      console.log('   Run: npm run dev');
    } else {
      console.log('\n🧪 DRY RUN COMPLETE - Ready to apply when you\'re ready');
    }

    console.log('\n' + '='.repeat(60));
  }

  /**
   * Save session results after trading
   */
  async saveSessionResults(sessionId: string, results: SessionResults, notes?: string): Promise<void> {
    await this.history.savePostSessionResults(sessionId, results, notes);
    console.log(`✅ Session results saved for ${sessionId}`);
  }

  /**
   * Quick setup methods for common scenarios
   */
  async quickSetupConservative(startingCapital: number): Promise<ConfigurationResult> {
    return this.setupBot({
      mode: 'preset',
      presetType: 'conservative',
      startingCapital
    });
  }

  async quickSetupBalanced(startingCapital: number): Promise<ConfigurationResult> {
    return this.setupBot({
      mode: 'preset',
      presetType: 'balanced',
      startingCapital
    });
  }

  async quickSetupAggressive(startingCapital: number): Promise<ConfigurationResult> {
    return this.setupBot({
      mode: 'preset',
      presetType: 'aggressive',
      startingCapital
    });
  }

  /**
   * Development and testing utilities
   */
  async dryRunSetup(options: SmartConfigOptions): Promise<ConfigurationResult> {
    return this.setupBot({
      ...options,
      dryRun: true,
      skipPreFlight: true
    });
  }

  async generateConfigReport(): Promise<string> {
    return this.history.generateSummaryReport();
  }
}

// Export singleton instance
const smartConfigSystem = new SmartConfigSystem();

export {
  SmartConfigSystem,
  smartConfigSystem,
  SmartConfigOptions,
  ConfigurationResult,
  UnifiedControlUpdate
};

// Add this execution block at the end of the file
if (require.main === module) {
  // This runs when the file is executed directly
  (async () => {
    try {
      const system = new SmartConfigSystem();
      const result = await system.setupBot({ mode: 'wizard' });

      if (result.success) {
        process.exit(0);
      } else {
        console.error('Setup failed:', result.issues);
        process.exit(1);
      }
    } catch (error) {
      console.error('Fatal error during setup:', error);
      process.exit(1);
    }
  })();
}