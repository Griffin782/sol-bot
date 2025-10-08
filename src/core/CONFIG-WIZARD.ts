import * as readline from 'readline';
import { SessionConfig } from './UNIFIED-CONTROL';
import { SmartConfigValidator } from './SMART-CONFIG-VALIDATOR';

interface WizardConfig {
  testMode: boolean;
  startingPool: number;
  riskTolerance: 'low' | 'medium' | 'high';
  targetProfit: number;
  sessionCount: number;
  taxReservePercent: number;
  positionSizePercent: number;
}

interface GeneratedConfig {
  sessions: SessionConfig[];
  maxTradesAbsolute: number;
  maxTradesPerSession: number;
  positionSizeUSD: number;
  maxPositions: number;
  initialPool: number;
}

class ConfigWizard {
  private rl: readline.Interface;
  private config: Partial<WizardConfig> = {};

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async runWizard(): Promise<GeneratedConfig | null> {
    console.log('\n🧙‍♂️ SOL-BOT CONFIGURATION WIZARD');
    console.log('='.repeat(50));
    console.log('Let\'s configure your trading bot step by step...\n');

    try {
      // Step 1: Test Mode (FIRST QUESTION)
      await this.askTestMode();

      // Step 2: Starting Pool
      await this.askStartingPool();

      // Step 3: Risk Tolerance
      await this.askRiskTolerance();

      // Step 4: Target Profit
      await this.askTargetProfit();

      // Step 5: Session Count
      await this.askSessionCount();

      // Step 6: Advanced Settings
      await this.askAdvancedSettings();

      // Step 6: Generate Configuration
      const generatedConfig = this.generateConfiguration();

      // Step 7: Show Preview
      this.showPreview(generatedConfig);

      // Step 8: Confirm
      const confirmed = await this.confirmConfiguration();

      if (confirmed) {
        console.log('\n✅ Configuration confirmed! Applying settings...\n');
        return generatedConfig;
      } else {
        console.log('\n❌ Configuration cancelled.\n');
        return null;
      }

    } catch (error) {
      console.error('\n💥 Error in configuration wizard:', error);
      return null;
    } finally {
      this.rl.close();
    }
  }

  private async askTestMode(): Promise<void> {
    while (this.config.testMode === undefined) {
      console.log('🧪 Will this be paper trading (test mode)?');
      console.log('   📝 Test Mode: Simulates trades without real money');
      console.log('   💰 Live Mode: Uses real money for actual trading');

      const answer = await this.question('Enable test mode? (Y/n): ');
      const input = answer.toLowerCase().trim();

      if (input === '' || input === 'y' || input === 'yes') {
        this.config.testMode = true;
        console.log('✅ Test mode enabled - No real money will be used\n');
      } else if (input === 'n' || input === 'no') {
        this.config.testMode = false;
        console.log('⚠️  Live mode enabled - Real money will be used!');
        const confirm = await this.question('Are you sure you want to use real money? (y/N): ');
        if (confirm.toLowerCase() !== 'y') {
          this.config.testMode = undefined; // Reset to ask again
          continue;
        }
        console.log('💰 Live mode confirmed\n');
      } else {
        console.log('❌ Please answer Y for test mode or N for live mode');
        continue;
      }
    }
  }

  private async askStartingPool(): Promise<void> {
    while (!this.config.startingPool) {
      const answer = await this.question('💰 What\'s your starting pool? (e.g., 600): $');
      const pool = parseFloat(answer);

      if (isNaN(pool) || pool <= 0) {
        console.log('❌ Please enter a valid positive number');
        continue;
      }

      if (pool < 10) {
        console.log('⚠️  Warning: Pool under $10 may not be viable for trading');
        const confirm = await this.question('Continue anyway? (y/N): ');
        if (confirm.toLowerCase() !== 'y') continue;
      }

      this.config.startingPool = pool;
      console.log(`✅ Starting pool set to $${pool.toLocaleString()}\n`);
    }
  }

  private async askRiskTolerance(): Promise<void> {
    while (!this.config.riskTolerance) {
      console.log('🎯 Risk Tolerance Options:');
      console.log('   1. Low    - Conservative (1-2% per trade, slower growth)');
      console.log('   2. Medium - Balanced (3-5% per trade, moderate growth)');
      console.log('   3. High   - Aggressive (5-10% per trade, faster growth)');

      const answer = await this.question('Select your risk tolerance (1/2/3): ');

      switch (answer) {
        case '1':
          this.config.riskTolerance = 'low';
          this.config.positionSizePercent = 2;
          break;
        case '2':
          this.config.riskTolerance = 'medium';
          this.config.positionSizePercent = 4;
          break;
        case '3':
          this.config.riskTolerance = 'high';
          this.config.positionSizePercent = 7;
          break;
        default:
          console.log('❌ Please select 1, 2, or 3');
          continue;
      }

      console.log(`✅ Risk tolerance: ${this.config.riskTolerance} (${this.config.positionSizePercent}% per trade)\n`);
    }
  }

  private async askTargetProfit(): Promise<void> {
    while (!this.config.targetProfit) {
      const currentPool = this.config.startingPool!;
      const minTarget = currentPool * 1.5; // At least 50% growth
      const maxTarget = currentPool * 100; // Reasonable upper limit

      console.log(`💎 Target Profit (total pool value you want to reach):`);
      console.log(`   Current pool: $${currentPool.toLocaleString()}`);
      console.log(`   Suggested range: $${minTarget.toLocaleString()} - $${maxTarget.toLocaleString()}`);

      const answer = await this.question(`Enter your target pool value: $`);
      const target = parseFloat(answer);

      if (isNaN(target) || target <= currentPool) {
        console.log(`❌ Target must be greater than starting pool ($${currentPool})`);
        continue;
      }

      if (target > maxTarget) {
        console.log(`⚠️  Warning: ${(target / currentPool).toFixed(1)}x growth is very ambitious`);
        const confirm = await this.question('Continue with this target? (y/N): ');
        if (confirm.toLowerCase() !== 'y') continue;
      }

      this.config.targetProfit = target;
      const multiplier = target / currentPool;
      console.log(`✅ Target set to $${target.toLocaleString()} (${multiplier.toFixed(1)}x growth)\n`);
    }
  }

  private async askSessionCount(): Promise<void> {
    while (!this.config.sessionCount) {
      const growth = this.config.targetProfit! / this.config.startingPool!;
      let recommended: number;

      if (growth <= 3) recommended = 1;
      else if (growth <= 10) recommended = 2;
      else if (growth <= 50) recommended = 3;
      else recommended = 4;

      console.log(`📊 How many sessions to reach your target?`);
      console.log(`   For ${growth.toFixed(1)}x growth, we recommend: ${recommended} sessions`);
      console.log(`   1 session = Fastest but highest risk`);
      console.log(`   2-3 sessions = Balanced approach`);
      console.log(`   4+ sessions = Gradual, lower risk`);

      const answer = await this.question(`Enter number of sessions (1-4): `);
      const count = parseInt(answer);

      if (isNaN(count) || count < 1 || count > 4) {
        console.log('❌ Please enter a number between 1 and 4');
        continue;
      }

      // Validate mathematical feasibility
      const avgGrowthPerSession = Math.pow(growth, 1/count);
      if (avgGrowthPerSession > 20 && count === 1) {
        console.log(`⚠️  Warning: ${avgGrowthPerSession.toFixed(1)}x growth in 1 session is extremely difficult`);
        const confirm = await this.question('Continue anyway? (y/N): ');
        if (confirm.toLowerCase() !== 'y') continue;
      }

      this.config.sessionCount = count;
      console.log(`✅ Planning ${count} session(s) with ~${avgGrowthPerSession.toFixed(1)}x growth each\n`);
    }
  }

  private async askAdvancedSettings(): Promise<void> {
    console.log('⚙️  Advanced Settings:');

    // Tax Reserve
    const taxAnswer = await this.question('Tax reserve percentage (default 40%): ');
    this.config.taxReservePercent = taxAnswer ? parseFloat(taxAnswer) : 40;

    if (this.config.taxReservePercent! < 20 || this.config.taxReservePercent! > 60) {
      console.log('⚠️  Unusual tax reserve percentage - typical range is 20-60%');
    }

    console.log(`✅ Tax reserve: ${this.config.taxReservePercent}%\n`);
  }

  private generateConfiguration(): GeneratedConfig {
    const config = this.config as WizardConfig;
    const sessions: SessionConfig[] = [];

    // Calculate session progression
    const totalGrowth = config.targetProfit / config.startingPool;
    const growthPerSession = Math.pow(totalGrowth, 1 / config.sessionCount);

    let currentPool = config.startingPool;

    for (let i = 0; i < config.sessionCount; i++) {
      const sessionNumber = i + 1;
      const targetPool = i === config.sessionCount - 1
        ? config.targetProfit
        : currentPool * growthPerSession;

      const profitRequired = targetPool - currentPool;
      const positionSizeUSD = (currentPool * config.positionSizePercent) / 100;

      // Calculate trade counts based on risk tolerance
      let maxTrades: number;
      switch (config.riskTolerance) {
        case 'low': maxTrades = Math.min(50, Math.floor(currentPool / positionSizeUSD)); break;
        case 'medium': maxTrades = Math.min(75, Math.floor(currentPool / positionSizeUSD)); break;
        case 'high': maxTrades = Math.min(100, Math.floor(currentPool / positionSizeUSD)); break;
      }

      // Calculate next session pool (after taxes and reinvestment)
      const afterTaxProfit = profitRequired * (1 - config.taxReservePercent / 100);
      const reinvestmentPercent = sessionNumber === 1 ? 70 : 50; // More aggressive reinvestment in session 1
      const nextSessionPool = sessionNumber === config.sessionCount
        ? 0
        : afterTaxProfit * (reinvestmentPercent / 100);

      const session: SessionConfig = {
        sessionNumber,
        initialPool: Math.round(currentPool * 100) / 100,
        targetPool: Math.round(targetPool * 100) / 100,
        profitRequired: Math.round(profitRequired * 100) / 100,
        growthMultiplier: Math.round((targetPool / currentPool) * 100) / 100,
        maxTrades,
        positionSizeUSD: Math.round(positionSizeUSD * 100) / 100,
        confidenceAdjustment: sessionNumber === 1 ? 0 : (sessionNumber - 1) * 2,
        taxReservePercent: config.taxReservePercent,
        reinvestmentPercent,
        nextSessionPool: Math.round(nextSessionPool * 100) / 100,
        riskLevel: config.riskTolerance === 'low' ? 'conservative' :
                  config.riskTolerance === 'medium' ? 'moderate' : 'aggressive',
        description: `Session ${sessionNumber} - ${this.getSessionDescription(sessionNumber, config.sessionCount)}`
      };

      sessions.push(session);

      // Update for next iteration (if not last session)
      if (i < config.sessionCount - 1) {
        currentPool = nextSessionPool > 0 ? nextSessionPool : currentPool * 0.3; // Fallback
      }
    }

    // Calculate global limits
    const maxPositionSize = Math.max(...sessions.map(s => s.positionSizeUSD));
    const maxTradesPerSession = Math.max(...sessions.map(s => s.maxTrades));
    const maxTradesAbsolute = Math.min(200, maxTradesPerSession * 2); // Conservative absolute limit
    const maxPositions = Math.min(20, Math.floor(config.startingPool / maxPositionSize));

    return {
      sessions,
      maxTradesAbsolute,
      maxTradesPerSession,
      positionSizeUSD: sessions[0].positionSizeUSD, // Use first session's position size
      maxPositions,
      initialPool: config.startingPool
    };
  }

  private getSessionDescription(sessionNumber: number, totalSessions: number): string {
    if (totalSessions === 1) return 'Complete target in single session';

    switch (sessionNumber) {
      case 1: return 'Foundation building phase';
      case 2: return 'Growth acceleration phase';
      case 3: return 'Target approach phase';
      case 4: return 'Final target achievement';
      default: return `Phase ${sessionNumber}`;
    }
  }

  private showPreview(config: GeneratedConfig): void {
    console.log('\n📋 CONFIGURATION PREVIEW');
    console.log('='.repeat(50));

    // Validate first
    const validation = SmartConfigValidator.validateConfiguration(
      config.sessions,
      config.maxTradesAbsolute,
      config.maxTradesPerSession,
      config.positionSizeUSD,
      config.maxPositions,
      config.initialPool
    );

    if (!validation.overall) {
      console.log('⚠️  VALIDATION WARNINGS:');
      validation.results
        .filter(r => !r.isValid)
        .forEach(r => console.log(`   ${r.message}`));
      console.log('');
    }

    // Show session breakdown
    config.sessions.forEach((session, index) => {
      console.log(`\n📊 SESSION ${session.sessionNumber}:`);
      console.log(`   💰 Start Pool: $${session.initialPool.toLocaleString()}`);
      console.log(`   🎯 Target Pool: $${session.targetPool.toLocaleString()}`);
      console.log(`   📈 Growth Required: ${session.growthMultiplier}x`);
      console.log(`   💵 Position Size: $${session.positionSizeUSD} (${((session.positionSizeUSD / session.initialPool) * 100).toFixed(1)}% of pool)`);
      console.log(`   🔢 Max Trades: ${session.maxTrades}`);
      console.log(`   ⚡ Risk Level: ${session.riskLevel}`);
      console.log(`   💡 Strategy: ${session.description}`);

      if (session.nextSessionPool > 0) {
        console.log(`   ➡️  Next Session Pool: $${session.nextSessionPool.toLocaleString()} (after taxes & reinvestment)`);
      }
    });

    console.log(`\n🎛️  GLOBAL SETTINGS:`);
    console.log(`   🔒 Max Trades (Absolute): ${config.maxTradesAbsolute}`);
    console.log(`   🔒 Max Trades (Per Session): ${config.maxTradesPerSession}`);
    console.log(`   📦 Max Concurrent Positions: ${config.maxPositions}`);
    console.log(`   💰 Starting Capital: $${config.initialPool.toLocaleString()}`);

    const totalTargetGrowth = config.sessions[config.sessions.length - 1].targetPool / config.initialPool;
    console.log(`\n🏆 TOTAL PROJECTION:`);
    console.log(`   📊 Overall Growth: ${totalTargetGrowth.toFixed(1)}x ($${config.initialPool.toLocaleString()} → $${config.sessions[config.sessions.length - 1].targetPool.toLocaleString()})`);
    console.log(`   ⏱️  Timeline: ${config.sessions.length} session(s)`);
    console.log(`   🎯 Success Probability: ${this.estimateSuccessProbability(config)}%`);
  }

  private estimateSuccessProbability(config: GeneratedConfig): number {
    // Simple heuristic based on growth requirements and risk level
    const avgGrowthRequired = Math.pow(
      config.sessions[config.sessions.length - 1].targetPool / config.initialPool,
      1 / config.sessions.length
    );

    let baseProbability = 70; // Start optimistic

    // Adjust for growth ambition
    if (avgGrowthRequired > 10) baseProbability -= 30;
    else if (avgGrowthRequired > 5) baseProbability -= 15;
    else if (avgGrowthRequired > 2) baseProbability -= 5;

    // Adjust for session count (more sessions = more chances for problems)
    baseProbability -= (config.sessions.length - 1) * 5;

    // Adjust for position sizing risk
    const avgPositionPercent = (config.positionSizeUSD / config.initialPool) * 100;
    if (avgPositionPercent > 8) baseProbability -= 20;
    else if (avgPositionPercent > 5) baseProbability -= 10;

    return Math.max(10, Math.min(90, baseProbability));
  }

  private async confirmConfiguration(): Promise<boolean> {
    console.log('\n' + '='.repeat(50));
    const answer = await this.question('🤔 Do you want to apply this configuration? (Y/N): ');
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }

  private question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  // Static method to run wizard without instantiation
  static async run(): Promise<GeneratedConfig | null> {
    const wizard = new ConfigWizard();
    return await wizard.runWizard();
  }
}

export { ConfigWizard, WizardConfig, GeneratedConfig };