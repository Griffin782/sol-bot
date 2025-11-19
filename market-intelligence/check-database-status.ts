// ============================================
// MARKET INTELLIGENCE DATABASE STATUS CHECKER
// Quick utility to check database health and statistics
// ============================================

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';
import * as fs from 'fs';

async function checkDatabaseStatus() {
  console.log('📊 MARKET INTELLIGENCE DATABASE STATUS\n');

  const baselineDir = './data/market-baseline';
  const sessionDir = './data/bot-sessions';

  // Check baseline databases
  await checkDirectory(baselineDir, 'BASELINE RECORDER');

  // Check session databases
  await checkDirectory(sessionDir, 'BOT SESSIONS');
}

async function checkDirectory(dirPath: string, label: string) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📁 ${label}: ${dirPath}`);
  console.log(`${'═'.repeat(60)}\n`);

  // Check if directory exists
  if (!fs.existsSync(dirPath)) {
    console.log(`❌ Directory not found: ${dirPath}\n`);
    return;
  }

  // Find all database files
  const dbFiles = fs.readdirSync(dirPath).filter(f => f.endsWith('.db'));

  if (dbFiles.length === 0) {
    console.log('❌ No database files found in this directory\n');
    return;
  }

  console.log(`Found ${dbFiles.length} database file(s):\n`);

  // Check each database
  for (const dbFile of dbFiles) {
    await checkDatabase(path.join(dirPath, dbFile), dbFile);
  }
}

async function checkDatabase(dbPath: string, dbFile: string) {
  const stats = fs.statSync(dbPath);

  console.log(`${'─'.repeat(60)}`);
  console.log(`📁 FILE: ${dbFile}`);
  console.log(`📏 SIZE: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📅 MODIFIED: ${stats.mtime.toLocaleString()}`);

  try {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Check if tokens_scored table exists
    const scoredTableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tokens_scored'"
    );

    if (!scoredTableExists) {
      console.log('⚠️  Database exists but tokens_scored table not found');
      await db.close();
      return;
    }

    // Count tokens scored
    const scoredCount = await db.get('SELECT COUNT(*) as count FROM tokens_scored');
    console.log(`\n✅ Tokens Scored: ${scoredCount.count.toLocaleString()}`);

    // Count tokens tracked (may not exist in all databases)
    try {
      const trackedCount = await db.get('SELECT COUNT(*) as count FROM tokens_tracked');
      console.log(`📊 Tokens Tracked: ${trackedCount.count.toLocaleString()}`);

      // Check for duplicates in tokens_tracked
      const duplicates = await db.get(`
        SELECT COUNT(*) as count
        FROM (
          SELECT mint, COUNT(*) as dupe_count
          FROM tokens_tracked
          GROUP BY mint
          HAVING COUNT(*) > 1
        )
      `);

      if (duplicates.count > 0) {
        console.log(`⚠️  Duplicate Mints Found: ${duplicates.count}`);
      } else {
        console.log(`✅ No Duplicate Mints (clean database)`);
      }
    } catch (error) {
      console.log('⚠️  tokens_tracked table not found (may be normal for some DBs)');
    }

    // Count by would_buy decision
    const buyDecisions = await db.all(`
      SELECT would_buy, COUNT(*) as count
      FROM tokens_scored
      GROUP BY would_buy
    `);

    console.log('\n🎯 DECISIONS:');
    for (const decision of buyDecisions) {
      const label = decision.would_buy ? '✅ Would Buy' : '❌ Blocked';
      const percentage = scoredCount.count > 0
        ? ((decision.count / scoredCount.count) * 100).toFixed(1)
        : '0.0';
      console.log(`  ${label}: ${decision.count.toLocaleString()} (${percentage}%)`);
    }

    // Get date range
    const dateRange = await db.get(`
      SELECT
        MIN(timestamp) as first_token,
        MAX(timestamp) as last_token
      FROM tokens_scored
    `);

    if (dateRange.first_token) {
      console.log('\n⏰ TIME RANGE:');
      console.log(`  First Token: ${new Date(dateRange.first_token).toLocaleString()}`);
      console.log(`  Last Token: ${new Date(dateRange.last_token).toLocaleString()}`);

      // Calculate duration
      const duration = new Date(dateRange.last_token).getTime() - new Date(dateRange.first_token).getTime();
      const durationMinutes = Math.floor(duration / 60000);
      const durationHours = (durationMinutes / 60).toFixed(1);
      console.log(`  Duration: ${durationMinutes} minutes (${durationHours} hours)`);

      // Calculate rate
      const tokensPerMinute = scoredCount.count / Math.max(durationMinutes, 1);
      console.log(`  Rate: ${tokensPerMinute.toFixed(1)} tokens/minute`);
    }

    // Top blocked reasons
    const blockedReasons = await db.all(`
      SELECT blocked_reason, COUNT(*) as count
      FROM tokens_scored
      WHERE blocked_reason IS NOT NULL AND blocked_reason != ''
      GROUP BY blocked_reason
      ORDER BY count DESC
      LIMIT 5
    `);

    if (blockedReasons.length > 0) {
      console.log('\n⚠️  TOP BLOCKED REASONS:');
      for (const reason of blockedReasons) {
        console.log(`  • ${reason.blocked_reason}: ${reason.count.toLocaleString()}`);
      }
    }

    // Sample of recent tokens
    const recentTokens = await db.all(`
      SELECT mint, name, symbol, score, would_buy, timestamp
      FROM tokens_scored
      ORDER BY timestamp DESC
      LIMIT 5
    `);

    console.log('\n📝 RECENT TOKENS:');
    for (const token of recentTokens) {
      const time = new Date(token.timestamp).toLocaleTimeString();
      const status = token.would_buy ? '✅' : '❌';
      const name = token.name || 'Unknown';
      const symbol = token.symbol || '???';
      console.log(`  ${status} ${token.mint.slice(0, 8)}... ${name} (${symbol}) Score: ${token.score} (${time})`);
    }

    // Check for encoding errors
    const encodingErrors = await db.get(`
      SELECT COUNT(*) as count
      FROM tokens_scored
      WHERE name = 'ENCODING_ERROR' OR symbol = 'ENCODING_ERROR'
    `);

    if (encodingErrors.count > 0) {
      console.log(`\n⚠️  Encoding Errors Found: ${encodingErrors.count} (unicode/emoji issues)`);
    } else {
      console.log(`\n✅ No Encoding Errors (all strings clean)`);
    }

    await db.close();

  } catch (error) {
    console.log(`\n❌ Error reading database: ${error instanceof Error ? error.message : error}`);
  }

  console.log(`${'─'.repeat(60)}\n`);
}

// Main execution
checkDatabaseStatus()
  .then(() => {
    console.log('\n✅ Database status check complete!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error during status check:', error);
    process.exit(1);
  });
