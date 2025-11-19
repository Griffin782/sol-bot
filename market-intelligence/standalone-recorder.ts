// ============================================
// STANDALONE MARKET OBSERVER (24/7)
// Records ALL market activity independently
// ============================================

import { MarketRecorder } from './handlers/market-recorder';
import { getMarketIntelligenceConfig } from './config/mi-config';
import { Connection, PublicKey } from '@solana/web3.js';
import WebSocket from 'ws';
import { validateEnv } from '../src/utils/env-validator';

// Helper function to extract mint from WebSocket message
function extractMintFromLogs(logs: string[]): string | null {
  try {
    // Look for mint initialization patterns
    for (const log of logs) {
      // Pump.fun pattern: "Program log: Instruction: InitializeMint2"
      if (log.includes('InitializeMint2')) {
        // Extract mint from following logs or accounts
        const nextIndex = logs.indexOf(log) + 1;
        if (nextIndex < logs.length) {
          const match = logs[nextIndex].match(/[A-HJ-NP-Za-km-z1-9]{32,44}/);
          if (match) return match[0];
        }
      }

      // Raydium pattern: "Program log: initialize2: InitializeInstruction2"
      if (log.includes('InitializeInstruction2')) {
        const match = log.match(/[A-HJ-NP-Za-km-z1-9]{32,44}/);
        if (match) return match[0];
      }

      // Generic mint address extraction
      const mintMatch = log.match(/mint.*?([A-HJ-NP-Za-km-z1-9]{32,44})/i);
      if (mintMatch) return mintMatch[1];
    }

    return null;
  } catch (error) {
    return null;
  }
}

// Helper to detect which program created the token
function detectProgram(logs: string[]): string {
  const logsText = logs.join(' ');

  if (logsText.includes('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')) return 'Pump.fun';
  if (logsText.includes('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8')) return 'Raydium';
  if (logsText.includes('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')) return 'SPL Token';

  return 'Unknown';
}

async function runStandaloneRecorder() {
  console.log('━'.repeat(80));
  console.log('🌐 STANDALONE MARKET OBSERVER');
  console.log('━'.repeat(80));
  console.log('📊 This recorder runs INDEPENDENTLY of your trading bot');
  console.log('🎯 Records ALL market activity for baseline data');
  console.log('💾 Storage: data/market-baseline/');
  console.log('⏰ Runtime: 24/7 until stopped');
  console.log('━'.repeat(80));
  console.log('');

  let recorder: MarketRecorder | null = null;
  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 10;

  // Stats tracking
  let tokensDetected = 0;
  let messagesReceived = 0;
  let lastStatsTime = Date.now();
  let startTime = Date.now(); // FIX #6: Track session start time

  async function initialize() {
    try {
      console.log('🔧 Initializing standalone recorder...\n');

      // Validate environment
      const env = validateEnv();

      // Create custom config for baseline recording
      // FIX #1: Configure to record EVERYTHING (no filtering)
      const baselineConfig = {
        ...getMarketIntelligenceConfig(),
        recording: {
          enabled: true,
          detection_source: 'websocket' as const,
          record_all_tokens: true,          // Record ALL tokens
          record_1s_charts: false,           // DISABLED: No price tracking (no Jupiter API)
          record_post_exit: false,           // DISABLED: No post-exit tracking (baseline only)
          post_exit_duration: 0,             // Disabled
          database_path: './data/market-baseline',
          daily_rotation: true,
          compress_old_data: false,
          compression_threshold_days: 30,
          max_concurrent_tokens: 200,
          batch_insert_size: 200,
          flush_interval: 5,
        },
        scoring: {
          enabled: true,
          min_score_to_track: 0,             // CRITICAL: Record everything (0 = all tokens)
          block_keywords: [],                 // Empty = don't block any
          require_no_mint_authority: false,   // Don't require for baseline
          require_no_freeze_authority: false, // Don't require for baseline
          min_liquidity: 0,                   // Accept all liquidity levels
          min_holder_count: 0,                // Accept all holder counts
          max_holder_concentration: 1.0,      // 100% = accept even single holder
        }
      };

      // Initialize recorder with baseline config
      const connection = new Connection(env.RPC_HTTPS_URI, 'confirmed');
      recorder = new MarketRecorder(connection, baselineConfig);
      await recorder.initialize();

      // FIX #4: Enhanced logging for verification
      console.log('✅ Recorder initialized successfully');
      console.log(`📁 Database: ${baselineConfig.recording.database_path}/`);
      console.log(`🎯 Min Score: ${baselineConfig.scoring.min_score_to_track} (records all tokens)`);
      console.log(`📊 Max Concurrent: ${baselineConfig.recording.max_concurrent_tokens} tokens`);
      console.log('');
      console.log('🔧 BASELINE CONFIG VERIFICATION:');
      console.log(`   record_all_tokens: ${baselineConfig.recording.record_all_tokens}`);
      console.log(`   record_1s_charts: ${baselineConfig.recording.record_1s_charts}`);
      console.log(`   min_score_to_track: ${baselineConfig.scoring.min_score_to_track}`);
      console.log(`   block_keywords: ${baselineConfig.scoring.block_keywords.length === 0 ? 'NONE (accepts all)' : baselineConfig.scoring.block_keywords.join(', ')}`);
      console.log(`   min_liquidity: ${baselineConfig.scoring.min_liquidity}`);
      console.log(`   min_holder_count: ${baselineConfig.scoring.min_holder_count}`);
      console.log('   ⚠️  This configuration should track EVERY token detected!');

      // Connect to WebSocket
      await connectWebSocket(env.RPC_WSS_URI);

    } catch (error) {
      console.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  async function connectWebSocket(wssUri: string) {
    try {
      console.log('🔌 Connecting to WebSocket...');
      console.log(`   ${wssUri.substring(0, 40)}...`);

      ws = new WebSocket(wssUri);

      ws.on('open', () => {
        console.log('✅ WebSocket connected');
        reconnectAttempts = 0;

        // Subscribe to Pump.fun token creation
        console.log('📡 Subscribing to Pump.fun program...');
        ws?.send(JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'logsSubscribe',
          params: [
            {
              mentions: ['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'] // Pump.fun
            },
            {
              commitment: 'confirmed'
            }
          ]
        }));

        console.log('✅ Subscribed successfully');
        console.log('📊 Monitoring all market activity...\n');
        console.log('━'.repeat(80));
        console.log('Press Ctrl+C to stop gracefully');
        console.log('━'.repeat(80));
        console.log('');
      });

      ws.on('message', async (data: WebSocket.Data) => {
        try {
          messagesReceived++;
          const message = JSON.parse(data.toString());

          // Skip subscription confirmations
          if (message.result) return;

          // Extract logs from WebSocket message
          const logs = message.params?.result?.value?.logs;
          if (!logs || !Array.isArray(logs)) return;

          // Extract token mint from logs
          const tokenMint = extractMintFromLogs(logs);
          if (!tokenMint) return;

          // Validate mint address
          try {
            new PublicKey(tokenMint);
          } catch {
            return; // Invalid mint address
          }

          tokensDetected++;

          // Detect which program created this token
          const detectionProgram = detectProgram(logs);

          // Record to baseline database
          if (recorder?.isRecording()) {
            await recorder.onTokenDetected(
              {
                mint: tokenMint,
                timestamp: Date.now(),
                detection_method: 'websocket',
                detection_program: detectionProgram,
              },
              {
                mint: tokenMint,
                score: 100, // FIX #5: High score so it gets tracked (was 50)
                would_buy: true, // Track everything for baseline
                has_mint_authority: false, // Unknown at detection
                has_freeze_authority: false,
              }
            ).catch(err => {
              // Non-critical - just log
              console.log(`⚠️  Recording error for ${tokenMint.slice(0, 8)}:`, err.message);
            });

            // Log detection
            console.log(`[${new Date().toLocaleTimeString()}] 🔍 Detected: ${tokenMint.slice(0, 8)}... (${detectionProgram})`);
          }

        } catch (error) {
          // Non-critical message parsing errors - ignore
        }
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
      });

      ws.on('close', () => {
        console.log('\n⚠️  WebSocket disconnected');

        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          const delay = Math.min(5000 * reconnectAttempts, 30000); // Max 30s
          console.log(`🔄 Reconnecting in ${delay/1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
          setTimeout(() => connectWebSocket(wssUri), delay);
        } else {
          console.error('❌ Max reconnection attempts reached. Exiting...');
          shutdown();
        }
      });

    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      throw error;
    }
  }

  // Stats logging interval
  const statsInterval = setInterval(async () => {
    if (!recorder) return;

    const stats = await recorder.getStats();
    const now = Date.now();
    const elapsed = (now - lastStatsTime) / 1000;
    const messagesPerSec = (messagesReceived / elapsed).toFixed(1);
    const tokensPerMin = ((tokensDetected / elapsed) * 60).toFixed(1);

    console.log('\n━'.repeat(80));
    console.log(`📊 STATS [${new Date().toLocaleTimeString()}]`);
    console.log('━'.repeat(80));

    // FIX #6: Enhanced stats with runtime
    const runtimeMinutes = Math.floor((now - startTime) / 60000);
    console.log(`⏱️  Runtime: ${runtimeMinutes} minutes`);
    console.log(`📨 Messages: ${messagesReceived.toLocaleString()} (${messagesPerSec}/s)`);
    console.log(`🔍 Tokens Detected: ${tokensDetected.toLocaleString()} (${tokensPerMin}/min)`);
    console.log(`💾 Database Tokens: ${stats.tokens_detected.toLocaleString()}`);
    console.log(`📊 Tokens Tracked: ${stats.tokens_tracked.toLocaleString()}`);

    // FIX #6: Calculate and warn about tracking ratio
    const trackingRatio = stats.tokens_detected > 0
      ? ((stats.tokens_tracked / stats.tokens_detected) * 100).toFixed(1)
      : '0.0';
    console.log(`📈 Tracking Ratio: ${trackingRatio}% (should be ~100%)`);

    if (parseFloat(trackingRatio) < 50) {
      console.log('⚠️  WARNING: Low tracking ratio! Check scoring config.');
    }

    if (stats.tokens_detected === 0 && runtimeMinutes > 5) {
      console.log('⚠️  WARNING: No tokens detected in 5+ minutes!');
    }

    console.log(`⚡ Active Positions: ${stats.active_positions}`);
    console.log(`📝 Database Writes: ${stats.database_writes.toLocaleString()}`);
    console.log(`📋 Write Queue: ${stats.write_queue_size}`);
    console.log('━'.repeat(80));
    console.log('');

    // Reset counters
    messagesReceived = 0;
    tokensDetected = 0;
    lastStatsTime = now;
  }, 60000); // Every minute

  // Graceful shutdown
  async function shutdown() {
    console.log('\n━'.repeat(80));
    console.log('🛑 SHUTTING DOWN STANDALONE RECORDER');
    console.log('━'.repeat(80));

    clearInterval(statsInterval);

    if (ws) {
      console.log('📡 Closing WebSocket connection...');
      ws.close();
    }

    if (recorder) {
      console.log('💾 Saving final data...');
      await recorder.shutdown();
      console.log('✅ Recorder shutdown complete');

      const finalStats = await recorder.getStats();
      console.log('\n📊 FINAL STATISTICS:');
      console.log(`   Tokens Detected: ${finalStats.tokens_detected.toLocaleString()}`);
      console.log(`   Tokens Tracked: ${finalStats.tokens_tracked.toLocaleString()}`);
      console.log(`   Database Writes: ${finalStats.database_writes.toLocaleString()}`);
    }

    console.log('\n✅ Standalone recorder stopped successfully');
    console.log('━'.repeat(80));
    process.exit(0);
  }

  // Register shutdown handlers
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Uncaught error handler
  process.on('uncaughtException', async (error) => {
    console.error('\n💥 UNCAUGHT EXCEPTION:', error);
    await shutdown();
  });

  // Start the recorder
  await initialize();
}

// Run the standalone recorder
if (require.main === module) {
  runStandaloneRecorder().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export { runStandaloneRecorder };
