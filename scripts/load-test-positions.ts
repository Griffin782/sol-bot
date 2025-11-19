/**
 * Position Monitoring Load Test
 *
 * Tests gRPC position monitoring capacity by adding simulated positions
 * Phases: 200 → 500 → 1,000 → 1,500+ positions
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { PositionMonitor, MonitoredPosition } from "../src/monitoring/positionMonitor";
import { capacityMonitor } from "./monitor-grpc-capacity";

// Configuration
const GRPC_ENDPOINT = process.env.GRPC_HTTP_URI || "https://basic.grpc.solanavibestation.com";
const GRPC_TOKEN = process.env.GRPC_AUTH_TOKEN || "";
const SOL_PRICE = 167;

// Test phases - OPTIMIZED FOR 12 vCPU SERVER
const PHASES = [
  { name: "Phase 1", positions: 200, expectedCpu: "10-15%", duration: 180000 }, // 3 min
  { name: "Phase 2", positions: 500, expectedCpu: "25-35%", duration: 240000 }, // 4 min
  { name: "Phase 3", positions: 1000, expectedCpu: "50-60%", duration: 300000 }, // 5 min
  { name: "Phase 4", positions: 1500, expectedCpu: "70-80%", duration: 300000 }, // 5 min
];

// Sample pump.fun tokens for testing (real tokens from mainnet)
const SAMPLE_TOKENS = [
  "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", // POPCAT
  "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY", // MUMU
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
  "8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn", // SILLY
  "5z3EqYQo9HiCEs3R84RCDMu2n7anpDMxRhdK8PSWmrRC", // PONKE
];

interface TestMetrics {
  phase: string;
  targetPositions: number;
  actualPositions: number;
  startTime: number;
  endTime?: number;
  avgCpuPercent: number;
  peakCpuPercent: number;
  avgUpdatesPerSec: number;
  avgProcessingMs: number;
  peakProcessingMs: number;
  avgMemoryMB: number;
  peakMemoryMB: number;
  errors: number;
  success: boolean;
}

class LoadTester {
  private positionMonitor: PositionMonitor | null = null;
  private testResults: TestMetrics[] = [];
  private currentPhase = 0;
  private isRunning = false;

  async initialize(): Promise<void> {
    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║   gRPC LOAD TEST - 12 vCPU SERVER               ║");
    console.log("╚══════════════════════════════════════════════════╝\n");

    console.log("📋 Configuration:");
    console.log(`   Server: 12 vCPU, 24GB RAM`);
    console.log(`   Endpoint: ${GRPC_ENDPOINT}`);
    console.log(`   Expected Capacity: 1,000-1,200 positions`);
    console.log("");

    // Initialize position monitor
    this.positionMonitor = new PositionMonitor(
      GRPC_ENDPOINT,
      GRPC_TOKEN,
      SOL_PRICE
    );

    // Set up price update callback with performance tracking
    this.positionMonitor.onPriceUpdate(async (mint, priceUSD) => {
      const startTime = Date.now();

      // Simulate exit strategy check
      await this.simulateExitCheck(mint, priceUSD);

      // Track performance
      capacityMonitor.recordUpdate(Date.now() - startTime);
    });

    // Start monitoring
    await this.positionMonitor.start();
    console.log("✅ Position monitor initialized\n");
  }

  /**
   * Simulate exit strategy check (lightweight)
   */
  private async simulateExitCheck(mint: string, priceUSD: number): Promise<void> {
    // Simple calculation to simulate exit logic
    const change = (priceUSD - 0.001) / 0.001; // Assume entry at 0.001

    if (change > 2.0) {
      // Would trigger 2x exit
    } else if (change < -0.5) {
      // Would trigger stop loss
    }
  }

  /**
   * Generate test positions
   */
  private generateTestPositions(count: number): MonitoredPosition[] {
    const positions: MonitoredPosition[] = [];

    for (let i = 0; i < count; i++) {
      // Use sample tokens in rotation
      const tokenIndex = i % SAMPLE_TOKENS.length;
      const mint = SAMPLE_TOKENS[tokenIndex];

      // Add unique suffix to mint for testing (not real addresses)
      const uniqueMint = `${mint}_test_${i}`;

      positions.push({
        mint: uniqueMint,
        poolAddress: `pool_${i}`,
        entryPriceSOL: 0.001 + (Math.random() * 0.01),
        entryPriceUSD: (0.001 + (Math.random() * 0.01)) * SOL_PRICE,
        tokenAmount: 1000000 + Math.floor(Math.random() * 9000000),
        entryTime: new Date(),
        dex: "pumpfun"
      });
    }

    return positions;
  }

  /**
   * Run a single test phase
   */
  async runPhase(phaseConfig: typeof PHASES[0]): Promise<TestMetrics> {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🚀 ${phaseConfig.name}: Testing ${phaseConfig.positions} positions`);
    console.log(`   Expected CPU: ${phaseConfig.expectedCpu}`);
    console.log(`   Duration: ${phaseConfig.duration / 1000} seconds`);
    console.log(`${"=".repeat(60)}\n`);

    const metrics: TestMetrics = {
      phase: phaseConfig.name,
      targetPositions: phaseConfig.positions,
      actualPositions: 0,
      startTime: Date.now(),
      avgCpuPercent: 0,
      peakCpuPercent: 0,
      avgUpdatesPerSec: 0,
      avgProcessingMs: 0,
      peakProcessingMs: 0,
      avgMemoryMB: 0,
      peakMemoryMB: 0,
      errors: 0,
      success: false
    };

    try {
      // Generate positions
      console.log(`📝 Generating ${phaseConfig.positions} test positions...`);
      const positions = this.generateTestPositions(phaseConfig.positions);

      // Add positions to monitor (SILENT MODE - reduce output)
      console.log(`📤 Adding ${phaseConfig.positions} positions...`);
      const batchSize = 100; // Larger batches for faster loading
      for (let i = 0; i < positions.length; i += batchSize) {
        const batch = positions.slice(i, i + batchSize);

        for (const position of batch) {
          try {
            await this.positionMonitor!.addPosition(position);
            metrics.actualPositions++;
          } catch (error) {
            metrics.errors++;
            // Only log errors, not every position
          }
        }

        // Only show progress every 200 positions
        if (metrics.actualPositions % 200 === 0 || metrics.actualPositions === phaseConfig.positions) {
          console.log(`   ✓ ${metrics.actualPositions}/${phaseConfig.positions} added`);
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log(`✅ Added ${metrics.actualPositions} positions\n`);

      // Monitor for specified duration
      console.log(`⏱️  Monitoring for ${phaseConfig.duration / 1000} seconds...\n`);

      const monitorInterval = setInterval(() => {
        const currentMetrics = capacityMonitor.getMetrics(this.positionMonitor!);

        // MINIMAL OUTPUT - Prevent CLI buffer overflow
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ${currentMetrics.activePositions} pos | ${currentMetrics.updatesPerSecond.toFixed(0)} upd/s | ${currentMetrics.avgProcessingTimeMs.toFixed(1)}ms | ${currentMetrics.cpuUsagePercent.toFixed(0)}% CPU`);

        // Track peak values
        metrics.peakCpuPercent = Math.max(metrics.peakCpuPercent, currentMetrics.cpuUsagePercent);
        metrics.peakProcessingMs = Math.max(metrics.peakProcessingMs, currentMetrics.peakProcessingTimeMs);
        metrics.peakMemoryMB = Math.max(metrics.peakMemoryMB, currentMetrics.memoryUsageMB);
      }, 15000); // Every 15 seconds (reduced frequency)

      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, phaseConfig.duration));

      // Stop monitoring interval
      clearInterval(monitorInterval);

      // Get final metrics
      const finalMetrics = capacityMonitor.getMetrics(this.positionMonitor!);
      metrics.avgCpuPercent = finalMetrics.cpuUsagePercent;
      metrics.avgUpdatesPerSec = finalMetrics.updatesPerSecond;
      metrics.avgProcessingMs = finalMetrics.avgProcessingTimeMs;
      metrics.avgMemoryMB = finalMetrics.memoryUsageMB;
      metrics.endTime = Date.now();
      metrics.success = metrics.avgProcessingMs < 50 && metrics.errors < (phaseConfig.positions * 0.01);

      // Display phase results
      this.displayPhaseResults(metrics);

      return metrics;

    } catch (error) {
      console.error(`❌ Phase failed:`, error);
      metrics.success = false;
      metrics.endTime = Date.now();
      return metrics;
    }
  }

  /**
   * Display phase results
   */
  private displayPhaseResults(metrics: TestMetrics): void {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 ${metrics.phase} RESULTS`);
    console.log(`${"=".repeat(60)}`);
    console.log(`✅ Positions: ${metrics.actualPositions}/${metrics.targetPositions}`);
    console.log(`⚡ Updates/sec: ${metrics.avgUpdatesPerSec.toFixed(1)}`);
    console.log(`🔥 Processing: ${metrics.avgProcessingMs.toFixed(1)}ms avg, ${metrics.peakProcessingMs.toFixed(1)}ms peak`);
    console.log(`💾 Memory: ${metrics.avgMemoryMB.toFixed(1)} MB avg, ${metrics.peakMemoryMB.toFixed(1)} MB peak`);
    console.log(`💻 CPU: ${metrics.avgCpuPercent.toFixed(1)}% avg, ${metrics.peakCpuPercent.toFixed(1)}% peak`);
    console.log(`❌ Errors: ${metrics.errors}`);
    console.log(`\n${metrics.success ? "✅ PASS" : "❌ FAIL"} - ${metrics.success ? "System stable" : "System overloaded"}`);
    console.log(`${"=".repeat(60)}\n`);
  }

  /**
   * Run all phases
   */
  async runAllPhases(): Promise<void> {
    this.isRunning = true;

    for (const phase of PHASES) {
      const metrics = await this.runPhase(phase);
      this.testResults.push(metrics);

      // Stop if phase failed
      if (!metrics.success) {
        console.log(`\n⚠️  ${phase.name} failed - stopping load test`);
        console.log(`   Max capacity appears to be around ${metrics.targetPositions} positions`);
        break;
      }

      // Ask user if they want to continue
      console.log(`\n✅ ${phase.name} completed successfully`);
      console.log(`   Continue to next phase? (5 second pause...)\n`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    this.isRunning = false;
    this.generateFinalReport();
  }

  /**
   * Generate final report
   */
  private generateFinalReport(): void {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📋 LOAD TEST FINAL REPORT`);
    console.log(`${"=".repeat(60)}\n`);

    console.log(`Server: 12 vCPU, 24 GB RAM`);
    console.log(`gRPC Tier: Basic (100 r/s)`);
    console.log(`Test Duration: ${((Date.now() - this.testResults[0].startTime) / 60000).toFixed(1)} minutes\n`);

    console.log(`PHASE RESULTS:`);
    console.log(`${"─".repeat(60)}`);

    for (const result of this.testResults) {
      const status = result.success ? "✅ PASS" : "❌ FAIL";
      console.log(`${status} ${result.phase}: ${result.actualPositions} positions`);
      console.log(`   Processing: ${result.avgProcessingMs.toFixed(1)}ms avg`);
      console.log(`   Memory: ${result.avgMemoryMB.toFixed(1)} MB`);
      console.log(`   Errors: ${result.errors}`);
    }

    console.log(`\n${"=".repeat(60)}`);

    // Determine recommended capacity
    const lastSuccessful = this.testResults.filter(r => r.success).pop();
    if (lastSuccessful) {
      console.log(`\n💡 RECOMMENDED CAPACITY: ${lastSuccessful.actualPositions} positions`);
      console.log(`   This is your safe operating limit with current hardware.`);
      console.log(`   CPU usage was ${lastSuccessful.avgCpuPercent.toFixed(1)}% with headroom remaining.`);
    }

    console.log(`\n${"=".repeat(60)}\n`);

    // Save report
    const report = JSON.stringify(this.testResults, null, 2);
    require('fs').writeFileSync(
      `./load-test-report-${Date.now()}.json`,
      report
    );
    console.log(`📄 Full report saved to: load-test-report-${Date.now()}.json\n`);
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    console.log(`\n🧹 Cleaning up...`);
    if (this.positionMonitor) {
      await this.positionMonitor.stop();
    }
    console.log(`✅ Cleanup complete\n`);
  }
}

// Run load test
async function main() {
  const tester = new LoadTester();

  try {
    await tester.initialize();
    await tester.runAllPhases();
  } catch (error) {
    console.error(`\n💥 Load test failed:`, error);
  } finally {
    await tester.cleanup();
    process.exit(0);
  }
}

// Handle interrupts
process.on('SIGINT', async () => {
  console.log(`\n⚠️  Interrupted - cleaning up...`);
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main();
}

export { LoadTester };
