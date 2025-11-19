import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';
import * as fs from 'fs';

interface DailySummary {
  date: string;
  tokens_detected: number;
  tokens_tracked: number;
  tokens_blocked: number;
  block_rate: number;
  
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  
  total_pnl_percent: number;
  avg_gain_percent: number;
  avg_loss_percent: number;
  biggest_win: number;
  biggest_loss: number;
  
  avg_hold_time: number;
  quick_exits: number;
  tiered_exits: number;
  stop_losses: number;
  
  post_exit_rallies: number;
  rally_rate: number;
  avg_missed_opportunity: number;
}

interface HourlyBreakdown {
  hour: number;
  tokens_seen: number;
  tokens_tracked: number;
  win_rate: number;
  avg_pnl: number;
  trades: number;
}

interface TopToken {
  mint: string;
  symbol: string;
  gain: number;
  hold_time: number;
  exit_type: string;
}

async function analyzeDailyPerformance(date?: string): Promise<void> {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const dbPath = path.join(__dirname, '../../data/market-intelligence', `mi-${targetDate}.db`);
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 MARKET INTELLIGENCE DAILY ANALYSIS`);
  console.log(`📅 Date: ${targetDate}`);
  console.log('='.repeat(60) + '\n');
  
  // Check if database exists
  if (!fs.existsSync(dbPath)) {
    console.log(`❌ No data found for ${targetDate}`);
    console.log(`💡 Database expected at: ${dbPath}`);
    console.log(`💡 Make sure Market Intelligence Recorder was running on this date.`);
    return;
  }
  
  // Open database
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  
  try {
    // Get overall summary
    const summary = await getDailySummary(db, targetDate);
    printSummary(summary);
    
    // Get hourly breakdown
    const hourly = await getHourlyBreakdown(db, targetDate);
    printHourlyBreakdown(hourly);
    
    // Get top performers
    const topWins = await getTopTokens(db, 'wins', 10);
    const topLosses = await getTopTokens(db, 'losses', 10);
    printTopTokens(topWins, topLosses);
    
    // Get post-exit rally analysis
    await analyzePostExitRallies(db);
    
    // Get recommendations
    printRecommendations(summary, hourly);
    
  } finally {
    await db.close();
  }
}

async function getDailySummary(db: any, date: string): Promise<DailySummary> {
  // Count tokens detected and scored
  const tokensRow = await db.get(`
    SELECT 
      COUNT(*) as detected,
      SUM(CASE WHEN would_buy = 1 THEN 1 ELSE 0 END) as tracked,
      SUM(CASE WHEN would_buy = 0 THEN 1 ELSE 0 END) as blocked
    FROM tokens_scored
    WHERE date_only = ?
  `, [date]);
  
  // Get trading performance
  const tradesRow = await db.get(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN theoretical_pnl_percent > 0 THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN theoretical_pnl_percent <= 0 THEN 1 ELSE 0 END) as losses,
      AVG(theoretical_pnl_percent) as avg_pnl,
      AVG(CASE WHEN theoretical_pnl_percent > 0 THEN theoretical_pnl_percent END) as avg_gain,
      AVG(CASE WHEN theoretical_pnl_percent <= 0 THEN theoretical_pnl_percent END) as avg_loss,
      MAX(theoretical_pnl_percent) as biggest_win,
      MIN(theoretical_pnl_percent) as biggest_loss,
      AVG(hold_duration_seconds) as avg_hold,
      SUM(CASE WHEN exit_signal_type = 'quick_profit' THEN 1 ELSE 0 END) as quick,
      SUM(CASE WHEN exit_signal_type LIKE 'tier%' THEN 1 ELSE 0 END) as tiered,
      SUM(CASE WHEN exit_signal_type = 'stop_loss' THEN 1 ELSE 0 END) as stops
    FROM tokens_tracked
    WHERE date_only = ? AND tracking_status = 'exited'
  `, [date]);
  
  // Get post-exit rally stats
  const ralliesRow = await db.get(`
    SELECT 
      SUM(CASE WHEN post_exit_rally = 1 THEN 1 ELSE 0 END) as rallies,
      AVG(missed_opportunity_percent) as avg_missed
    FROM tokens_tracked
    WHERE date_only = ? AND tracking_status = 'exited'
  `, [date]);
  
  return {
    date,
    tokens_detected: tokensRow.detected || 0,
    tokens_tracked: tokensRow.tracked || 0,
    tokens_blocked: tokensRow.blocked || 0,
    block_rate: tokensRow.detected > 0 ? (tokensRow.blocked / tokensRow.detected) * 100 : 0,
    
    total_trades: tradesRow.total || 0,
    winning_trades: tradesRow.wins || 0,
    losing_trades: tradesRow.losses || 0,
    win_rate: tradesRow.total > 0 ? (tradesRow.wins / tradesRow.total) * 100 : 0,
    
    total_pnl_percent: tradesRow.avg_pnl || 0,
    avg_gain_percent: tradesRow.avg_gain || 0,
    avg_loss_percent: tradesRow.avg_loss || 0,
    biggest_win: tradesRow.biggest_win || 0,
    biggest_loss: tradesRow.biggest_loss || 0,
    
    avg_hold_time: tradesRow.avg_hold || 0,
    quick_exits: tradesRow.quick || 0,
    tiered_exits: tradesRow.tiered || 0,
    stop_losses: tradesRow.stops || 0,
    
    post_exit_rallies: ralliesRow.rallies || 0,
    rally_rate: tradesRow.total > 0 ? (ralliesRow.rallies / tradesRow.total) * 100 : 0,
    avg_missed_opportunity: ralliesRow.avg_missed || 0
  };
}

function printSummary(summary: DailySummary): void {
  console.log('📈 DAILY SUMMARY\n');
  
  console.log('Detection Stats:');
  console.log(`  Tokens Detected: ${summary.tokens_detected}`);
  console.log(`  Tokens Tracked: ${summary.tokens_tracked} (${(summary.tokens_tracked/summary.tokens_detected*100).toFixed(1)}%)`);
  console.log(`  Tokens Blocked: ${summary.tokens_blocked} (${summary.block_rate.toFixed(1)}%)`);
  
  console.log('\nTrading Performance:');
  console.log(`  Total Trades: ${summary.total_trades}`);
  console.log(`  Winning Trades: ${summary.winning_trades} (${summary.win_rate.toFixed(1)}%)`);
  console.log(`  Losing Trades: ${summary.losing_trades} (${(100-summary.win_rate).toFixed(1)}%)`);
  
  console.log('\nP&L Metrics:');
  console.log(`  Average P&L: ${summary.total_pnl_percent > 0 ? '+' : ''}${summary.total_pnl_percent.toFixed(2)}%`);
  console.log(`  Average Gain: +${summary.avg_gain_percent.toFixed(2)}%`);
  console.log(`  Average Loss: ${summary.avg_loss_percent.toFixed(2)}%`);
  console.log(`  Biggest Win: +${summary.biggest_win.toFixed(2)}%`);
  console.log(`  Biggest Loss: ${summary.biggest_loss.toFixed(2)}%`);
  
  console.log('\nTiming Metrics:');
  console.log(`  Avg Hold Time: ${(summary.avg_hold_time / 60).toFixed(1)} minutes`);
  console.log(`  Quick Exits: ${summary.quick_exits} (<5 min)`);
  console.log(`  Tiered Exits: ${summary.tiered_exits} (2x, 4x, 6x)`);
  console.log(`  Stop Losses: ${summary.stop_losses}`);
  
  console.log('\nPost-Exit Analysis:');
  console.log(`  Post-Exit Rallies: ${summary.post_exit_rallies} (${summary.rally_rate.toFixed(1)}%)`);
  if (summary.avg_missed_opportunity > 0) {
    console.log(`  Avg Missed Opportunity: +${summary.avg_missed_opportunity.toFixed(2)}%`);
  }
  
  console.log('\n' + '-'.repeat(60) + '\n');
}

async function getHourlyBreakdown(db: any, date: string): Promise<HourlyBreakdown[]> {
  const rows = await db.all(`
    SELECT 
      CAST(strftime('%H', timestamp) AS INTEGER) as hour,
      COUNT(*) as tokens_seen,
      SUM(CASE WHEN would_buy = 1 THEN 1 ELSE 0 END) as tokens_tracked
    FROM tokens_scored
    WHERE date_only = ?
    GROUP BY hour
    ORDER BY hour
  `, [date]);
  
  const hourlyData: HourlyBreakdown[] = [];
  
  for (const row of rows) {
    const trades = await db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN theoretical_pnl_percent > 0 THEN 1 ELSE 0 END) as wins,
        AVG(theoretical_pnl_percent) as avg_pnl
      FROM tokens_tracked
      WHERE date_only = ? 
        AND CAST(strftime('%H', detected_at) AS INTEGER) = ?
        AND tracking_status = 'exited'
    `, [date, row.hour]);
    
    hourlyData.push({
      hour: row.hour,
      tokens_seen: row.tokens_seen,
      tokens_tracked: row.tokens_tracked,
      win_rate: trades.total > 0 ? (trades.wins / trades.total) * 100 : 0,
      avg_pnl: trades.avg_pnl || 0,
      trades: trades.total || 0
    });
  }
  
  return hourlyData;
}

function printHourlyBreakdown(hourly: HourlyBreakdown[]): void {
  console.log('⏰ HOURLY BREAKDOWN\n');
  
  console.log('Hour  | Seen | Tracked | Trades | Win Rate | Avg P&L | Rating');
  console.log('------|------|---------|--------|----------|---------|--------');
  
  for (const hour of hourly) {
    const timeStr = `${hour.hour.toString().padStart(2, '0')}:00`;
    const seenStr = hour.tokens_seen.toString().padStart(4);
    const trackedStr = hour.tokens_tracked.toString().padStart(7);
    const tradesStr = hour.trades.toString().padStart(6);
    const winRateStr = hour.trades > 0 ? `${hour.win_rate.toFixed(1)}%`.padStart(8) : '   -    ';
    const pnlStr = hour.trades > 0 ? `${hour.avg_pnl > 0 ? '+' : ''}${hour.avg_pnl.toFixed(1)}%`.padStart(7) : '   -   ';
    
    // Rating based on win rate
    let rating = '⚪';
    if (hour.trades >= 5) {
      if (hour.win_rate >= 75) rating = '🟢 BEST';
      else if (hour.win_rate >= 60) rating = '🟡 GOOD';
      else if (hour.win_rate >= 45) rating = '🟠 OK';
      else rating = '🔴 POOR';
    }
    
    console.log(`${timeStr} | ${seenStr} | ${trackedStr} | ${tradesStr} | ${winRateStr} | ${pnlStr} | ${rating}`);
  }
  
  console.log('\n' + '-'.repeat(60) + '\n');
}

async function getTopTokens(db: any, type: 'wins' | 'losses', limit: number): Promise<TopToken[]> {
  const order = type === 'wins' ? 'DESC' : 'ASC';
  
  const rows = await db.all(`
    SELECT 
      t.mint,
      s.symbol,
      t.theoretical_pnl_percent as gain,
      t.hold_duration_seconds as hold_time,
      t.exit_signal_type
    FROM tokens_tracked t
    LEFT JOIN tokens_scored s ON t.mint = s.mint
    WHERE t.tracking_status = 'exited'
      AND t.theoretical_pnl_percent IS NOT NULL
    ORDER BY t.theoretical_pnl_percent ${order}
    LIMIT ?
  `, [limit]);
  
  return rows.map((r: any) => ({
    mint: r.mint,
    symbol: r.symbol || 'Unknown',
    gain: r.gain,
    hold_time: r.hold_time,
    exit_type: r.exit_signal_type
  }));
}

function printTopTokens(topWins: TopToken[], topLosses: TopToken[]): void {
  console.log('🏆 TOP 10 WINNING TRADES\n');
  
  console.log('Symbol        | Gain      | Hold Time | Exit Type');
  console.log('--------------|-----------|-----------|----------------');
  
  for (const token of topWins) {
    const symbolStr = token.symbol.padEnd(12).slice(0, 12);
    const gainStr = `+${token.gain.toFixed(1)}%`.padEnd(9);
    const timeStr = `${(token.hold_time / 60).toFixed(1)}m`.padEnd(9);
    const exitStr = token.exit_type;
    
    console.log(`${symbolStr} | ${gainStr} | ${timeStr} | ${exitStr}`);
  }
  
  console.log('\n💸 TOP 10 LOSING TRADES\n');
  
  console.log('Symbol        | Loss      | Hold Time | Exit Type');
  console.log('--------------|-----------|-----------|----------------');
  
  for (const token of topLosses) {
    const symbolStr = token.symbol.padEnd(12).slice(0, 12);
    const lossStr = `${token.gain.toFixed(1)}%`.padEnd(9);
    const timeStr = `${(token.hold_time / 60).toFixed(1)}m`.padEnd(9);
    const exitStr = token.exit_type;
    
    console.log(`${symbolStr} | ${lossStr} | ${timeStr} | ${exitStr}`);
  }
  
  console.log('\n' + '-'.repeat(60) + '\n');
}

async function analyzePostExitRallies(db: any): Promise<void> {
  const rallies = await db.all(`
    SELECT 
      mint,
      exit_price,
      post_exit_high_price,
      missed_opportunity_percent,
      hold_duration_seconds,
      exit_signal_type
    FROM tokens_tracked
    WHERE post_exit_rally = 1
    ORDER BY missed_opportunity_percent DESC
    LIMIT 10
  `);
  
  if (rallies.length === 0) {
    console.log('🚀 POST-EXIT RALLIES: None detected\n');
    return;
  }
  
  console.log('🚀 TOP 10 POST-EXIT RALLIES (Opportunities We Missed)\n');
  
  console.log('Mint           | Exit Type     | Hold Time | Missed %');
  console.log('---------------|---------------|-----------|----------');
  
  for (const rally of rallies) {
    const mintStr = rally.mint.slice(0, 13) + '...';
    const exitStr = rally.exit_signal_type.padEnd(13);
    const timeStr = `${(rally.hold_duration_seconds / 60).toFixed(1)}m`.padEnd(9);
    const missedStr = `+${rally.missed_opportunity_percent.toFixed(1)}%`;
    
    console.log(`${mintStr} | ${exitStr} | ${timeStr} | ${missedStr}`);
  }
  
  console.log('\n' + '-'.repeat(60) + '\n');
}

function printRecommendations(summary: DailySummary, hourly: HourlyBreakdown[]): void {
  console.log('💡 RECOMMENDATIONS\n');
  
  // Win rate analysis
  if (summary.win_rate >= 70) {
    console.log('✅ Win rate is excellent (>70%). Current strategy is working well.');
  } else if (summary.win_rate >= 50) {
    console.log('⚠️  Win rate is acceptable (50-70%). Consider tightening entry criteria.');
  } else {
    console.log('🚨 Win rate is low (<50%). Review scoring logic and exit timing.');
  }
  
  // Post-exit rally analysis
  if (summary.rally_rate >= 30) {
    console.log(`⚠️  ${summary.rally_rate.toFixed(0)}% of exits followed by rallies. Consider:`);
    console.log('   - Holding positions 60-90 seconds longer');
    console.log('   - Adjusting trailing stop parameters');
    console.log('   - Using more aggressive tier thresholds');
  }
  
  // Find best hours
  const goodHours = hourly
    .filter(h => h.trades >= 5 && h.win_rate >= 70)
    .sort((a, b) => b.win_rate - a.win_rate)
    .slice(0, 3);
  
  if (goodHours.length > 0) {
    console.log('\n📈 BEST TRADING HOURS:');
    goodHours.forEach(h => {
      console.log(`   ${h.hour.toString().padStart(2, '0')}:00 - ${h.win_rate.toFixed(1)}% win rate, ${h.avg_pnl > 0 ? '+' : ''}${h.avg_pnl.toFixed(1)}% avg P&L`);
    });
    console.log('   → Increase position size during these hours');
  }
  
  // Find worst hours
  const badHours = hourly
    .filter(h => h.trades >= 5 && h.win_rate < 45)
    .sort((a, b) => a.win_rate - b.win_rate)
    .slice(0, 3);
  
  if (badHours.length > 0) {
    console.log('\n📉 WORST TRADING HOURS:');
    badHours.forEach(h => {
      console.log(`   ${h.hour.toString().padStart(2, '0')}:00 - ${h.win_rate.toFixed(1)}% win rate, ${h.avg_pnl > 0 ? '+' : ''}${h.avg_pnl.toFixed(1)}% avg P&L`);
    });
    console.log('   → Reduce position size or skip trading during these hours');
  }
  
  // Block rate analysis
  if (summary.block_rate < 50) {
    console.log('\n⚠️  Low block rate (<50%). Consider tightening safety filters.');
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

// Run analysis
const dateArg = process.argv[2];
analyzeDailyPerformance(dateArg).catch(console.error);

