// ============================================
// BOT PERFORMANCE VS MARKET BASELINE COMPARISON
// Analyzes the gap between market reality and bot decisions
// ============================================

import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import * as path from 'path';
import * as fs from 'fs';

interface ComparisonStats {
  // Coverage
  market_total_tokens: number;
  bot_detected_tokens: number;
  coverage_percent: number;

  // Bot Performance
  bot_would_buy: number;
  bot_blocked: number;
  bot_trades_executed: number;

  // Market Performance
  market_pumps_2x: number;
  market_pumps_5x: number;
  market_pumps_10x: number;

  // Missed Opportunities
  missed_2x_plus: number;
  missed_5x_plus: number;
  missed_10x_plus: number;

  // Correct Blocks
  correct_blocks: number;
  saved_from_losses: number;
}

async function openDatabase(dbPath: string): Promise<Database> {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database not found: ${dbPath}`);
  }

  return await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
}

async function compareToMarket(sessionDbPath: string, baselineDate?: string) {
  console.log('━'.repeat(80));
  console.log('📊 BOT PERFORMANCE VS MARKET BASELINE COMPARISON');
  console.log('━'.repeat(80));
  console.log('');

  try {
    // Determine baseline date (default to today)
    const targetDate = baselineDate || new Date().toISOString().split('T')[0];
    const baselineDbPath = `./data/market-baseline/baseline-${targetDate}.db`;

    console.log('📁 Opening databases...');
    console.log(`   Bot Session: ${sessionDbPath}`);
    console.log(`   Market Baseline: ${baselineDbPath}`);
    console.log('');

    // Open both databases
    const sessionDb = await openDatabase(sessionDbPath);
    const baselineDb = await openDatabase(baselineDbPath);

    // ============================================
    // 1. MARKET COVERAGE ANALYSIS
    // ============================================
    console.log('━'.repeat(80));
    console.log('🌐 MARKET COVERAGE ANALYSIS');
    console.log('━'.repeat(80));

    const marketTokens = await baselineDb.get(
      'SELECT COUNT(*) as total FROM tokens_scored WHERE date_only = ?',
      [targetDate]
    );

    const botTokens = await sessionDb.get(
      'SELECT COUNT(*) as total FROM tokens_scored'
    );

    const coverage = (botTokens.total / marketTokens.total) * 100;

    console.log(`Total tokens in market:     ${marketTokens.total.toLocaleString()}`);
    console.log(`Tokens bot detected:        ${botTokens.total.toLocaleString()}`);
    console.log(`Coverage:                   ${coverage.toFixed(1)}%`);
    console.log('');

    // ============================================
    // 2. BOT DECISION BREAKDOWN
    // ============================================
    console.log('━'.repeat(80));
    console.log('🤖 BOT DECISION BREAKDOWN');
    console.log('━'.repeat(80));

    const botWouldBuy = await sessionDb.get(
      'SELECT COUNT(*) as total FROM tokens_scored WHERE would_buy = 1'
    );

    const botBlocked = await sessionDb.get(
      'SELECT COUNT(*) as total FROM tokens_scored WHERE would_buy = 0'
    );

    const botTracked = await sessionDb.get(
      'SELECT COUNT(*) as total FROM tokens_tracked'
    );

    console.log(`Would-buy decisions:        ${botWouldBuy.total.toLocaleString()}`);
    console.log(`Blocked/rejected:           ${botBlocked.total.toLocaleString()}`);
    console.log(`Actually tracked:           ${botTracked.total.toLocaleString()}`);
    console.log('');

    // ============================================
    // 3. MISSED OPPORTUNITIES
    // ============================================
    console.log('━'.repeat(80));
    console.log('❌ MISSED OPPORTUNITIES');
    console.log('━'.repeat(80));
    console.log('(Tokens that pumped but bot never detected)\n');

    // Get tokens that pumped in baseline but bot never saw
    const missedOpportunities = await baselineDb.all(`
      SELECT
        t.mint,
        t.theoretical_pnl_percent,
        t.exit_signal_type,
        t.hold_duration_seconds,
        s.score
      FROM tokens_tracked t
      LEFT JOIN tokens_scored s ON t.mint = s.mint
      WHERE t.theoretical_pnl_percent > 100
        AND t.mint NOT IN (
          SELECT mint FROM tokens_scored WHERE 1=1
        )
      ORDER BY t.theoretical_pnl_percent DESC
      LIMIT 20
    `);

    if (missedOpportunities.length > 0) {
      console.log('TOP 20 MISSED PUMPS:\n');
      missedOpportunities.forEach((token, i) => {
        const duration = Math.floor(token.hold_duration_seconds / 60);
        console.log(`${String(i + 1).padStart(2)}. ${token.mint.slice(0, 8)}... → +${token.theoretical_pnl_percent.toFixed(0).padStart(4)}% (${duration}m) [${token.exit_signal_type}]`);
      });

      // Summary stats
      const missed2x = missedOpportunities.filter(t => t.theoretical_pnl_percent >= 100).length;
      const missed5x = missedOpportunities.filter(t => t.theoretical_pnl_percent >= 400).length;
      const missed10x = missedOpportunities.filter(t => t.theoretical_pnl_percent >= 900).length;

      console.log('');
      console.log(`Missed 2x+ opportunities:   ${missed2x}`);
      console.log(`Missed 5x+ opportunities:   ${missed5x}`);
      console.log(`Missed 10x+ opportunities:  ${missed10x}`);
    } else {
      console.log('✅ No major opportunities missed (bot detected all significant pumps)');
    }
    console.log('');

    // ============================================
    // 4. CORRECT BLOCKS (Saved from losses)
    // ============================================
    console.log('━'.repeat(80));
    console.log('✅ CORRECT BLOCKS (Saved from Losses)');
    console.log('━'.repeat(80));
    console.log('(Tokens bot blocked that later dumped)\n');

    // Find tokens bot blocked that exist in baseline and lost value
    const correctBlocks = await baselineDb.all(`
      SELECT
        b.mint,
        b.theoretical_pnl_percent,
        b.exit_signal_type,
        s.blocked_reason
      FROM tokens_tracked b
      INNER JOIN (
        SELECT mint, blocked_reason
        FROM tokens_scored
        WHERE would_buy = 0
      ) s ON b.mint = s.mint
      WHERE b.theoretical_pnl_percent < -20
      ORDER BY b.theoretical_pnl_percent ASC
      LIMIT 20
    `);

    if (correctBlocks.length > 0) {
      console.log('TOP 20 CORRECT BLOCKS:\n');
      correctBlocks.forEach((token, i) => {
        const reason = token.blocked_reason || 'Unknown';
        console.log(`${String(i + 1).padStart(2)}. ${token.mint.slice(0, 8)}... → ${token.theoretical_pnl_percent.toFixed(0).padStart(4)}% [Blocked: ${reason}]`);
      });

      const totalSaved = correctBlocks.reduce((sum, t) => sum + Math.abs(t.theoretical_pnl_percent), 0);
      console.log('');
      console.log(`Total blocks that saved losses: ${correctBlocks.length}`);
      console.log(`Average loss avoided:           ${(totalSaved / correctBlocks.length).toFixed(1)}%`);
    } else {
      console.log('⚠️  No data available (baseline may not have tracked blocked tokens)');
    }
    console.log('');

    // ============================================
    // 5. FALSE POSITIVES (Bot bought but it dumped)
    // ============================================
    console.log('━'.repeat(80));
    console.log('⚠️  FALSE POSITIVES (Bot Would-Buy But Dumped)');
    console.log('━'.repeat(80));
    console.log('(Tokens bot wanted to buy but lost value)\n');

    const falsePositives = await baselineDb.all(`
      SELECT
        b.mint,
        b.theoretical_pnl_percent,
        b.exit_signal_type,
        s.score
      FROM tokens_tracked b
      INNER JOIN (
        SELECT mint, score
        FROM tokens_scored
        WHERE would_buy = 1
      ) s ON b.mint = s.mint
      WHERE b.theoretical_pnl_percent < -10
      ORDER BY b.theoretical_pnl_percent ASC
      LIMIT 20
    `);

    if (falsePositives.length > 0) {
      console.log('TOP 20 FALSE POSITIVES:\n');
      falsePositives.forEach((token, i) => {
        console.log(`${String(i + 1).padStart(2)}. ${token.mint.slice(0, 8)}... → ${token.theoretical_pnl_percent.toFixed(0).padStart(4)}% (Score: ${token.score})`);
      });

      const avgLoss = falsePositives.reduce((sum, t) => sum + t.theoretical_pnl_percent, 0) / falsePositives.length;
      console.log('');
      console.log(`False positives:          ${falsePositives.length}`);
      console.log(`Average loss:             ${avgLoss.toFixed(1)}%`);
    } else {
      console.log('✅ No false positives (all would-buy tokens performed well)');
    }
    console.log('');

    // ============================================
    // 6. TRUE POSITIVES (Bot bought and it pumped)
    // ============================================
    console.log('━'.repeat(80));
    console.log('🎯 TRUE POSITIVES (Bot Would-Buy AND Pumped)');
    console.log('━'.repeat(80));
    console.log('(Tokens bot wanted to buy that actually gained value)\n');

    const truePositives = await baselineDb.all(`
      SELECT
        b.mint,
        b.theoretical_pnl_percent,
        b.exit_signal_type,
        s.score
      FROM tokens_tracked b
      INNER JOIN (
        SELECT mint, score
        FROM tokens_scored
        WHERE would_buy = 1
      ) s ON b.mint = s.mint
      WHERE b.theoretical_pnl_percent > 10
      ORDER BY b.theoretical_pnl_percent DESC
      LIMIT 20
    `);

    if (truePositives.length > 0) {
      console.log('TOP 20 TRUE POSITIVES:\n');
      truePositives.forEach((token, i) => {
        console.log(`${String(i + 1).padStart(2)}. ${token.mint.slice(0, 8)}... → +${token.theoretical_pnl_percent.toFixed(0).padStart(4)}% (Score: ${token.score}) [${token.exit_signal_type}]`);
      });

      const avgGain = truePositives.reduce((sum, t) => sum + t.theoretical_pnl_percent, 0) / truePositives.length;
      const wins2x = truePositives.filter(t => t.theoretical_pnl_percent >= 100).length;
      const wins5x = truePositives.filter(t => t.theoretical_pnl_percent >= 400).length;

      console.log('');
      console.log(`True positives:           ${truePositives.length}`);
      console.log(`Average gain:             +${avgGain.toFixed(1)}%`);
      console.log(`2x+ wins:                 ${wins2x}`);
      console.log(`5x+ wins:                 ${wins5x}`);
    } else {
      console.log('⚠️  No true positives found (no would-buy tokens gained value)');
    }
    console.log('');

    // ============================================
    // 7. OVERALL ACCURACY METRICS
    // ============================================
    console.log('━'.repeat(80));
    console.log('📈 OVERALL ACCURACY METRICS');
    console.log('━'.repeat(80));

    const totalDecisions = botWouldBuy.total + botBlocked.total;
    const accurateBlocks = correctBlocks.length;
    const accurateBuys = truePositives.length;
    const totalAccurate = accurateBlocks + accurateBuys;
    const accuracy = (totalAccurate / totalDecisions) * 100;

    console.log(`Total bot decisions:      ${totalDecisions.toLocaleString()}`);
    console.log(`Accurate decisions:       ${totalAccurate.toLocaleString()}`);
    console.log(`Accuracy rate:            ${accuracy.toFixed(1)}%`);
    console.log('');
    console.log(`Precision (% buy signals that won):   ${((truePositives.length / botWouldBuy.total) * 100).toFixed(1)}%`);
    console.log(`Recall (% market wins captured):      ${((truePositives.length / (truePositives.length + missedOpportunities.length)) * 100).toFixed(1)}%`);
    console.log('');

    // Close databases
    await sessionDb.close();
    await baselineDb.close();

    console.log('━'.repeat(80));
    console.log('✅ COMPARISON COMPLETE');
    console.log('━'.repeat(80));

  } catch (error) {
    console.error('❌ Comparison failed:', error);
    console.error('');
    console.error('Make sure both databases exist:');
    console.error(`  1. Session DB: ${sessionDbPath}`);
    console.error(`  2. Baseline DB: ./data/market-baseline/baseline-${baselineDate || 'YYYY-MM-DD'}.db`);
    process.exit(1);
  }
}

// ============================================
// CLI USAGE
// ============================================

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('');
    console.log('📊 Bot-to-Market Comparison Tool');
    console.log('');
    console.log('Usage:');
    console.log('  npx ts-node market-intelligence/reports/compare-bot-to-market.ts <session-db> [baseline-date]');
    console.log('');
    console.log('Arguments:');
    console.log('  <session-db>      Path to bot session database');
    console.log('  [baseline-date]   Baseline date (YYYY-MM-DD, default: today)');
    console.log('');
    console.log('Examples:');
    console.log('  # Compare latest session to today\'s baseline');
    console.log('  npx ts-node market-intelligence/reports/compare-bot-to-market.ts \\');
    console.log('    ./data/bot-sessions/live-session-1761598498518.db');
    console.log('');
    console.log('  # Compare to specific baseline date');
    console.log('  npx ts-node market-intelligence/reports/compare-bot-to-market.ts \\');
    console.log('    ./data/bot-sessions/test-session-1761598498518.db 2025-10-27');
    console.log('');
    process.exit(0);
  }

  const sessionPath = args[0];
  const baselineDate = args[1];

  compareToMarket(sessionPath, baselineDate).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { compareToMarket };
