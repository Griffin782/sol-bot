/**
 * SILENT Load Test - File Output Only
 *
 * Writes results to JSON file only (no console spam)
 * Check results in: load-test-results.json
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { PositionMonitor, MonitoredPosition } from "../src/monitoring/positionMonitor";
import { capacityMonitor } from "./monitor-grpc-capacity";
import * as fs from "fs";

const GRPC_ENDPOINT = process.env.GRPC_HTTP_URI || "https://basic.grpc.solanavibestation.com";
const GRPC_TOKEN = process.env.GRPC_AUTH_TOKEN || "";
const SOL_PRICE = 167;

const PHASES = [
  { name: "Phase 1", positions: 200, duration: 180000 }, // 3 min
  { name: "Phase 2", positions: 500, duration: 240000 }, // 4 min
  { name: "Phase 3", positions: 1000, duration: 300000 }, // 5 min
];

const SAMPLE_TOKENS = [
  "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
  "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
];

interface TestMetrics {
  phase: string;
  targetPositions: number;
  actualPositions: number;
  avgCpuPercent: number;
  avgProcessingMs: number;
  avgMemoryMB: number;
  errors: number;
  success: boolean;
  timestamp: string;
}

const LOG_FILE = "./load-test-results.json";
let logData: any = {
  startTime: new Date().toISOString(),
  serverSpecs: "12 vCPU, 24GB RAM",
  phases: [],
  recommendation: ""
};

function log(message: string) {
  // Silent - only write to file
  logData.lastMessage = message;
  fs.writeFileSync(LOG_FILE, JSON.stringify(logData, null, 2));
}

class SilentLoadTester {
  private positionMonitor: PositionMonitor | null = null;

  async initialize(): Promise<void> {
    log("Initializing position monitor...");

    this.positionMonitor = new PositionMonitor(GRPC_ENDPOINT, GRPC_TOKEN, SOL_PRICE);

    this.positionMonitor.onPriceUpdate(async (mint, priceUSD) => {
      const startTime = Date.now();
      await this.simulateExitCheck(mint, priceUSD);
      capacityMonitor.recordUpdate(Date.now() - startTime);
    });

    await this.positionMonitor.start();
    log("Position monitor initialized");
  }

  private async simulateExitCheck(mint: string, priceUSD: number): Promise<void> {
    const change = (priceUSD - 0.001) / 0.001;
    if (change > 2.0 || change < -0.5) {
      // Trigger simulation
    }
  }

  private generateTestPositions(count: number): MonitoredPosition[] {
    const positions: MonitoredPosition[] = [];
    for (let i = 0; i < count; i++) {
      const mint = SAMPLE_TOKENS[i % SAMPLE_TOKENS.length];
      positions.push({
        mint: `${mint}_test_${i}`,
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

  async runPhase(phaseConfig: typeof PHASES[0]): Promise<TestMetrics> {
    log(`Starting ${phaseConfig.name}: ${phaseConfig.positions} positions`);

    const metrics: TestMetrics = {
      phase: phaseConfig.name,
      targetPositions: phaseConfig.positions,
      actualPositions: 0,
      avgCpuPercent: 0,
      avgProcessingMs: 0,
      avgMemoryMB: 0,
      errors: 0,
      success: false,
      timestamp: new Date().toISOString()
    };

    try {
      const positions = this.generateTestPositions(phaseConfig.positions);

      // Add positions silently
      for (const position of positions) {
        try {
          await this.positionMonitor!.addPosition(position);
          metrics.actualPositions++;
        } catch {
          metrics.errors++;
        }
      }

      log(`Added ${metrics.actualPositions} positions, monitoring...`);

      // Monitor for duration (no console output)
      const startMonitor = Date.now();
      while (Date.now() - startMonitor < phaseConfig.duration) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Update file periodically
        const currentMetrics = capacityMonitor.getMetrics(this.positionMonitor!);
        logData.currentStats = {
          positions: currentMetrics.activePositions,
          updatesPerSec: currentMetrics.updatesPerSecond,
          processingMs: currentMetrics.avgProcessingTimeMs,
          cpuPercent: currentMetrics.cpuUsagePercent,
          memoryMB: currentMetrics.memoryUsageMB
        };
        fs.writeFileSync(LOG_FILE, JSON.stringify(logData, null, 2));
      }

      // Final metrics
      const finalMetrics = capacityMonitor.getMetrics(this.positionMonitor!);
      metrics.avgCpuPercent = finalMetrics.cpuUsagePercent;
      metrics.avgProcessingMs = finalMetrics.avgProcessingTimeMs;
      metrics.avgMemoryMB = finalMetrics.memoryUsageMB;
      metrics.success = metrics.avgProcessingMs < 50;

      logData.phases.push(metrics);
      fs.writeFileSync(LOG_FILE, JSON.stringify(logData, null, 2));

      return metrics;
    } catch (error) {
      log(`Phase failed: ${error}`);
      metrics.success = false;
      return metrics;
    }
  }

  async runAllPhases(): Promise<void> {
    for (const phase of PHASES) {
      const metrics = await this.runPhase(phase);

      if (!metrics.success) {
        logData.recommendation = `Max capacity: ~${metrics.targetPositions} positions`;
        break;
      }
    }

    const lastSuccess = logData.phases.filter((p: any) => p.success).pop();
    if (lastSuccess) {
      logData.recommendation = `Safe capacity: ${lastSuccess.actualPositions} positions (${lastSuccess.avgCpuPercent.toFixed(1)}% CPU)`;
    }

    logData.endTime = new Date().toISOString();
    fs.writeFileSync(LOG_FILE, JSON.stringify(logData, null, 2));
    log("Test complete - check load-test-results.json");
  }

  async cleanup(): Promise<void> {
    if (this.positionMonitor) {
      await this.positionMonitor.stop();
    }
  }
}

async function main() {
  const tester = new SilentLoadTester();
  try {
    await tester.initialize();
    await tester.runAllPhases();
  } finally {
    await tester.cleanup();
    console.log("✅ Test complete - check load-test-results.json");
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}
