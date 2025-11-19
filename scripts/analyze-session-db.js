// Quick script to analyze session database
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.argv[2] || './data/bot-sessions/mi-2025-11-03.db';

console.log('=== SESSION DATABASE ANALYSIS ===');
console.log('Database:', dbPath);
console.log('');

try {
  const db = new Database(dbPath, { readonly: true });

  // Get table names
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('📊 Tables Found:', tables.map(t => t.name).join(', '));
  console.log('');

  // Check each table for data
  tables.forEach(table => {
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
      console.log(`   ${table.name}: ${count.count} records`);
    } catch (e) {
      console.log(`   ${table.name}: Error reading`);
    }
  });
  console.log('');

  // Get token detection stats
  try {
    const detections = db.prepare('SELECT COUNT(*) as count FROM token_detections').get();
    console.log('🔍 Total Detections:', detections.count);
  } catch(e) {
    console.log('🔍 Total Detections: N/A (no token_detections table)');
  }

  // Get tracked tokens stats
  try {
    const tracked = db.prepare('SELECT COUNT(DISTINCT mint) as count FROM tracked_positions').get();
    console.log('📈 Tracked Positions:', tracked.count);
  } catch(e) {
    console.log('📈 Tracked Positions: N/A (no tracked_positions table)');
  }

  // Get scoring stats (try different table names)
  try {
    // Try tokens_scored first
    const scores = db.prepare(`
      SELECT COUNT(*) as total FROM tokens_scored
    `).get();

    console.log('⭐ Scored Tokens:', scores.total);

    // Get sample records to see structure
    const sample = db.prepare('SELECT * FROM tokens_scored LIMIT 3').all();
    if (sample.length > 0) {
      console.log('   Sample fields:', Object.keys(sample[0]).join(', '));
    }

  } catch(e) {
    console.log('⭐ Scoring Stats: Error -', e.message);
  }

  // Try to get actual tracking stats
  try {
    const tracked = db.prepare('SELECT COUNT(*) as total FROM tokens_tracked').get();
    console.log('📊 Tokens Tracked:', tracked.total);

    if (tracked.total === 0) {
      console.log('⚠️  WARNING: 0 tokens tracked! All tokens were rejected.');
    }
  } catch(e) {
    console.log('📊 Tokens Tracked: Error');
  }

  // Analyze rejection reasons
  try {
    const rejections = db.prepare(`
      SELECT
        blocked_reason,
        COUNT(*) as count
      FROM tokens_scored
      WHERE would_buy = 0 OR would_buy IS NULL
      GROUP BY blocked_reason
      ORDER BY count DESC
      LIMIT 10
    `).all();

    console.log('');
    console.log('🔍 WHY TOKENS WERE REJECTED:');
    rejections.forEach(r => {
      console.log(`   ${r.count.toString().padStart(4)} tokens: ${r.blocked_reason || 'Unknown reason'}`);
    });

    // Calculate tracking ratio
    const totalScored = db.prepare('SELECT COUNT(*) as count FROM tokens_scored').get().count;
    const wouldBuy = db.prepare('SELECT COUNT(*) as count FROM tokens_scored WHERE would_buy = 1').get().count;

    console.log('');
    console.log('📊 TRACKING RATIO ANALYSIS:');
    console.log(`   Total Scored: ${totalScored}`);
    console.log(`   Would Buy: ${wouldBuy}`);
    console.log(`   Rejected: ${totalScored - wouldBuy}`);
    console.log(`   Tracking Ratio: ${((wouldBuy / totalScored) * 100).toFixed(1)}%`);

    if (wouldBuy / totalScored < 0.8) {
      console.log('   ⚠️  Low ratio - filters are too strict!');
    }

  } catch(e) {
    console.log('🔍 Rejection Analysis: Error -', e.message);
  }

  db.close();
  console.log('');
  console.log('✅ Analysis complete');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
