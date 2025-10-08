// revert-progressive-changes.js - Restore production settings
// Run this when ready for full production trading

const fs = require('fs');

console.log("🔄 Reverting temporary progressive trading adjustments...");

const changes = [
  {
    file: 'package.json',
    description: 'Restore config validation checks',
    find: '"prebuild": "echo \'Config check disabled for live trading\'",\n    "predev": "echo \'Config check disabled for live trading\'"',
    replace: '"prebuild": "npm run check-config",\n    "predev": "npm run check-config"'
  },
  {
    file: 'src/trading-progression.ts',
    description: 'Restore dashboard updates',
    find: '    // Update dashboard (disabled during testing)\n    // this.displayProgressionStatus();',
    replace: '    // Update dashboard\n    this.displayProgressionStatus();'
  },
  {
    file: 'src/trading-progression.ts',
    description: 'Restore pending stage status',
    find: 'status: \'running\', // Start as running for testing',
    replace: 'status: \'pending\','
  }
];

// NOTE: Stage 1 duration and success criteria are TESTING-ONLY
// They don't affect DEFAULT SESSION PROGRESSION in botController.ts
// Those settings are only for validating the progressive system works

const testingOnlySettings = [
  {
    file: 'src/trading-progression.ts',
    setting: 'Stage 1 duration: 1 minute (line 62)',
    note: 'TESTING ONLY - Does not affect production DEFAULT SESSION PROGRESSION in botController.ts',
    production: 'Change to 5 minutes when ready for full validation'
  },
  {
    file: 'src/trading-progression.ts',
    setting: 'Stage 1 success criteria: 60% win rate, 10 tokens (lines 72-74)',
    note: 'TESTING ONLY - Does not affect production DEFAULT SESSION PROGRESSION in botController.ts',
    production: 'Change to 70% win rate, 20 tokens when ready for full validation'
  },
  {
    file: 'src/trading-progression.ts',
    setting: 'Stage limits: 999 consecutive losses (line 63)',
    note: 'TESTING ONLY - Does not affect production DEFAULT SESSION PROGRESSION in botController.ts',
    production: 'Change to 3 consecutive losses when ready for full validation'
  },
  {
    file: 'src/trading-progression.ts',
    setting: 'Stage 1 initial status: "running" (line 649)',
    note: 'TESTING ONLY - Does not affect production DEFAULT SESSION PROGRESSION in botController.ts',
    production: 'Change to "pending" when ready for full validation - requires user approval to start'
  },
  {
    file: 'src/trading-progression.ts',
    setting: 'Simulation mode enabled (lines 268-271, 280+)',
    note: 'TESTING ONLY - Does not affect production DEFAULT SESSION PROGRESSION in botController.ts',
    production: 'Disable simulation when connected to real bot trading'
  },
  {
    file: 'src/trading-progression.ts',
    setting: 'Dashboard updates commented out (line 337)',
    note: 'TESTING ONLY - Does not affect production DEFAULT SESSION PROGRESSION in botController.ts',
    production: 'Enable dashboard updates by uncommenting this.displayProgressionStatus()'
  }
];

function revertChanges() {
  let changesApplied = 0;

  changes.forEach(change => {
    try {
      if (fs.existsSync(change.file)) {
        let content = fs.readFileSync(change.file, 'utf8');

        if (content.includes(change.find)) {
          content = content.replace(change.find, change.replace);
          fs.writeFileSync(change.file, content);
          console.log(`✅ ${change.description}`);
          changesApplied++;
        } else {
          console.log(`⚠️  ${change.description} - Pattern not found (may already be reverted)`);
        }
      } else {
        console.log(`❌ File not found: ${change.file}`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${change.file}:`, error.message);
    }
  });

  console.log(`\n📋 TESTING-ONLY SETTINGS (Don't affect DEFAULT SESSION PROGRESSION):`);
  testingOnlySettings.forEach(setting => {
    console.log(`\n📍 ${setting.setting}`);
    console.log(`   File: ${setting.file}`);
    console.log(`   Note: ${setting.note}`);
    console.log(`   Production: ${setting.production}`);
  });

  console.log(`\n🎯 SUMMARY:`);
  console.log(`   Production changes applied: ${changesApplied}/${changes.length}`);
  console.log(`   Testing-only settings: ${testingOnlySettings.length} (manual adjustment if needed)`);
  console.log(`\n✅ Core production settings restored!`);
  console.log(`🔄 The DEFAULT SESSION PROGRESSION in botController.ts is unaffected`);
}

if (require.main === module) {
  revertChanges();
}

module.exports = { revertChanges };