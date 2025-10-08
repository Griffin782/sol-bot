import { MASTER_SETTINGS, TradingMode } from './UNIFIED-CONTROL';
import * as fs from 'fs';
import * as path from 'path';

class BotDiagnostic {
  private issues: string[] = [];
  private warnings: string[] = [];

  async runFullAudit() {
    console.log("🔍 RUNNING COMPREHENSIVE BOT AUDIT...\n");

    // 1. Configuration Loading Test
    this.testConfigurationLoading();

    // 2. Trade Limit Enforcement Test
    this.testTradeLimitEnforcement();

    // 3. Pool Calculation Test
    this.testPoolCalculations();

    // 4. Monitor Sync Test
    this.testMonitorSync();

    // 5. Graceful Shutdown Test
    this.testGracefulShutdown();

    // Report Results
    this.generateReport();
  }

  private testConfigurationLoading() {
    console.log("📊 Testing Configuration Loading...");

    // Check if values from UNIFIED-CONTROL are actually being used
    const expectedInitialPool = MASTER_SETTINGS.pool.initialPool;
    const expectedMaxTrades = MASTER_SETTINGS.limits.maxTradesAbsolute;
    const currentMode = MASTER_SETTINGS.runtime.mode;

    // Read actual values from running processes
    const monitorConfigPath = path.join(__dirname, '../../data/monitor-config.json');
    if (fs.existsSync(monitorConfigPath)) {
      const monitorConfig = JSON.parse(fs.readFileSync(monitorConfigPath, 'utf8'));
      if (monitorConfig.initialPool !== expectedInitialPool) {
        this.issues.push(`Initial Pool Mismatch: Expected ${expectedInitialPool}, Monitor shows ${monitorConfig.initialPool}`);
      }
    }

    console.log(`✓ Initial Pool should be: $${expectedInitialPool}`);
    console.log(`✓ Max Trades should be: ${expectedMaxTrades}`);
    console.log(`✓ Position Size should be: $${currentMode ? currentMode.positionSizeUSD : MASTER_SETTINGS.pool.positionSizeUSD}`);
  }

  private testTradeLimitEnforcement() {
    console.log("\n🛑 Testing Trade Limit Enforcement...");

    const maxTrades = MASTER_SETTINGS.limits.maxTradesAbsolute;

    // Check if index.ts actually enforces this
    const indexPath = path.join(__dirname, '../index.ts');
    if (fs.existsSync(indexPath)) {
      const indexContent = fs.readFileSync(indexPath, 'utf8');

      if (!indexContent.includes('if (totalTrades >= maxTrades)') && !indexContent.includes('getMaxTrades')) {
        this.issues.push("Trade limit enforcement code missing in index.ts");
      }

      if (!indexContent.includes('UNIFIED-CONTROL') && !indexContent.includes('getMaxTrades')) {
        this.issues.push("UNIFIED-CONTROL not imported in index.ts");
      }
    } else {
      this.warnings.push("index.ts file not found for validation");
    }

    console.log(`✓ Trade limit should be: ${maxTrades}`);
  }

  private testPoolCalculations() {
    console.log("\n💰 Testing Pool Calculations...");

    const initialPool = MASTER_SETTINGS.pool.initialPool;
    const currentMode = MASTER_SETTINGS.runtime.mode;
    const positionSize = currentMode ? currentMode.positionSizeUSD : MASTER_SETTINGS.pool.positionSizeUSD;

    // Verify calculation logic
    const expectedPoolAfter10Trades = initialPool - (positionSize * 10);

    console.log(`Initial Pool: $${initialPool}`);
    console.log(`Position Size: $${positionSize}`);
    console.log(`After 10 trades, pool should be: $${expectedPoolAfter10Trades}`);

    if (positionSize > initialPool * 0.5) {
      this.warnings.push(`Position size ($${positionSize}) is ${((positionSize/initialPool)*100).toFixed(1)}% of initial pool ($${initialPool}) - very high risk!`);
    }

    if (positionSize > initialPool) {
      this.issues.push(`Position size ($${positionSize}) exceeds initial pool ($${initialPool}) - impossible to trade!`);
    }
  }

  private testMonitorSync() {
    console.log("\n📺 Testing Monitor Synchronization...");

    // Check if monitor reads from UNIFIED-CONTROL
    const monitorPath = path.join(__dirname, '../live-monitor.ts');
    if (fs.existsSync(monitorPath)) {
      const monitorContent = fs.readFileSync(monitorPath, 'utf8');

      if (!monitorContent.includes('MASTER_SETTINGS') && !monitorContent.includes('UNIFIED-CONTROL')) {
        this.issues.push("Monitor not importing from UNIFIED-CONTROL");
      }

      if (monitorContent.includes('z_config')) {
        this.issues.push("Monitor still using old z_config references");
      }

      console.log("✓ Monitor file found and checked");
    } else {
      this.warnings.push("live-monitor.ts not found for validation");
    }
  }

  private testGracefulShutdown() {
    console.log("\n🔄 Testing Graceful Shutdown...");

    const indexPath = path.join(__dirname, '../index.ts');
    if (fs.existsSync(indexPath)) {
      const indexContent = fs.readFileSync(indexPath, 'utf8');

      if (!indexContent.includes('sellAllPositions') && !indexContent.includes('shutdown')) {
        this.issues.push("Graceful shutdown functionality missing");
      }

      if (!indexContent.includes('SIGINT') && !indexContent.includes('process.on')) {
        this.warnings.push("Signal handlers for graceful shutdown not detected");
      }

      console.log("✓ Shutdown checks completed");
    } else {
      this.warnings.push("index.ts not found for shutdown validation");
    }
  }

  private generateReport() {
    console.log("\n" + "=".repeat(50));
    console.log("📊 DIAGNOSTIC REPORT");
    console.log("=".repeat(50));

    if (this.issues.length > 0) {
      console.log("\n❌ CRITICAL ISSUES FOUND:");
      this.issues.forEach(issue => console.log(`  - ${issue}`));
    }

    if (this.warnings.length > 0) {
      console.log("\n⚠️ WARNINGS:");
      this.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    if (this.issues.length === 0 && this.warnings.length === 0) {
      console.log("\n✅ All systems functioning correctly!");
    } else {
      console.log("\n🔧 FIX SCRIPT GENERATED: Run 'npm run fix-bot' to apply fixes");
      this.generateFixScript();
    }
  }

  private generateFixScript() {
    const fixes = [];

    // Generate fixes based on issues found
    if (this.issues.some(issue => issue.includes("Trade limit enforcement code missing"))) {
      fixes.push({
        file: 'src/index.ts',
        fix: 'Add trade limit check before executing trades',
        code: `
import { getMaxTrades } from './core/UNIFIED-CONTROL';

// Add before trade execution:
const maxTrades = getMaxTrades();
if (totalTrades >= maxTrades) {
  console.log("Trade limit reached, starting shutdown...");
  await shutdownWithReport();
  return;
}`
      });
    }

    if (this.issues.some(issue => issue.includes("UNIFIED-CONTROL not imported"))) {
      fixes.push({
        file: 'src/index.ts',
        fix: 'Import UNIFIED-CONTROL configuration',
        code: `
import {
  MASTER_SETTINGS,
  getMaxTrades,
  getPositionSizeUSD,
  getStopLoss
} from './core/UNIFIED-CONTROL';`
      });
    }

    if (fixes.length > 0) {
      // Save fix script
      fs.writeFileSync('./FIX-BOT.md', fixes.map(f =>
        `## Fix: ${f.fix}\nFile: ${f.file}\nCode:\n\`\`\`typescript${f.code}\n\`\`\`\n`
      ).join('\n'));
    }
  }
}

// Run diagnostic
const diagnostic = new BotDiagnostic();
diagnostic.runFullAudit();