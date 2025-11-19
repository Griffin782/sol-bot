import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  commandLine: string;
  path: string;
}

export class ProcessCleanup {
  private allowedPatterns = [
    'mi-baseline',           // Standalone MI recorder
    'npm run dev',           // Main bot (npm mode)
    'node dist/index.js',    // Main bot (compiled mode)
    'ts-node src/index.ts',  // Main bot (dev mode)
  ];

  private logFile = 'data/process-cleanup.log';

  constructor() {
    // Ensure log directory exists
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(this.logFile, logMessage);
    console.log(message);
  }

  async getNodeProcesses(): Promise<ProcessInfo[]> {
    try {
      // Get processes with command line using WMI
      const { stdout } = await execAsync(
        'Get-WmiObject Win32_Process -Filter "name = \'node.exe\'" | Select-Object ProcessId, Name, CommandLine, ExecutablePath, WorkingSetSize | ConvertTo-Json',
        { shell: 'powershell.exe' }
      );

      if (!stdout || stdout.trim() === '') {
        return [];
      }

      const raw = JSON.parse(stdout);
      const processes = Array.isArray(raw) ? raw : [raw];

      return processes.map((p: any) => ({
        pid: p.ProcessId,
        name: p.Name,
        cpu: 0, // WMI doesn't give us CPU easily
        memory: p.WorkingSetSize || 0,
        commandLine: p.CommandLine || '',
        path: p.ExecutablePath || ''
      }));
    } catch (error: any) {
      this.log(`⚠️  Error getting processes: ${error.message}`);
      return [];
    }
  }

  private isProcessAllowed(proc: ProcessInfo): boolean {
    // Check if command line matches any allowed pattern
    const cmdLower = proc.commandLine.toLowerCase();
    const pathLower = proc.path.toLowerCase();

    for (const pattern of this.allowedPatterns) {
      if (cmdLower.includes(pattern.toLowerCase())) {
        return true;
      }

      // Also check if it's in the project directory
      if (pathLower.includes('sol-bot-main')) {
        // Additional check: is it one of our scripts?
        if (cmdLower.includes('index') || cmdLower.includes('baseline')) {
          return true;
        }
      }
    }

    return false;
  }

  async identifyUnknownProcesses(): Promise<ProcessInfo[]> {
    const allProcesses = await this.getNodeProcesses();
    const unknown: ProcessInfo[] = [];

    this.log(`\n🔍 Analyzing ${allProcesses.length} node processes...`);

    for (const proc of allProcesses) {
      const isAllowed = this.isProcessAllowed(proc);

      if (isAllowed) {
        this.log(`  ✅ PID ${proc.pid}: ALLOWED - ${proc.commandLine.substring(0, 80)}`);
      } else {
        this.log(`  ❌ PID ${proc.pid}: UNKNOWN - ${proc.commandLine.substring(0, 80)}`);
        unknown.push(proc);
      }
    }

    return unknown;
  }

  async killProcess(pid: number): Promise<boolean> {
    try {
      await execAsync(`Stop-Process -Id ${pid} -Force`, { shell: 'powershell.exe' });
      this.log(`  ✅ Killed process ${pid}`);
      return true;
    } catch (error: any) {
      this.log(`  ❌ Failed to kill process ${pid}: ${error.message}`);
      return false;
    }
  }

  async cleanup(dryRun: boolean = false): Promise<{
    total: number;
    allowed: number;
    unknown: number;
    killed: number;
  }> {
    this.log('\n' + '='.repeat(60));
    this.log('🔧 PROCESS CLEANUP STARTING');
    this.log('='.repeat(60));

    const allProcesses = await this.getNodeProcesses();
    const unknown = await this.identifyUnknownProcesses();

    this.log(`\n📊 Summary:`);
    this.log(`  Total node processes: ${allProcesses.length}`);
    this.log(`  Allowed processes: ${allProcesses.length - unknown.length}`);
    this.log(`  Unknown processes: ${unknown.length}`);

    let killed = 0;

    if (unknown.length > 0) {
      if (dryRun) {
        this.log(`\n⚠️  DRY RUN MODE: Would kill ${unknown.length} processes`);
      } else {
        this.log(`\n🔧 Killing ${unknown.length} unknown processes...`);

        for (const proc of unknown) {
          const success = await this.killProcess(proc.pid);
          if (success) killed++;
        }

        this.log(`\n✅ Killed ${killed} of ${unknown.length} processes`);
      }
    } else {
      this.log(`\n✅ No unknown processes found - system clean!`);
    }

    return {
      total: allProcesses.length,
      allowed: allProcesses.length - unknown.length,
      unknown: unknown.length,
      killed: killed
    };
  }

  async verifyClean(): Promise<boolean> {
    this.log('\n🔍 Verifying system is clean...');
    const unknown = await this.identifyUnknownProcesses();

    if (unknown.length === 0) {
      this.log('✅ System verified clean!');
      return true;
    } else {
      this.log(`❌ Still ${unknown.length} unknown processes remain`);
      return false;
    }
  }

  async printStatus(): Promise<void> {
    const allProcesses = await this.getNodeProcesses();
    const unknown = await this.identifyUnknownProcesses();

    console.log('\n' + '='.repeat(60));
    console.log('📊 PROCESS STATUS');
    console.log('='.repeat(60));
    console.log(`Total node processes: ${allProcesses.length}`);
    console.log(`Allowed: ${allProcesses.length - unknown.length}`);
    console.log(`Unknown: ${unknown.length}`);
    console.log('='.repeat(60));

    if (allProcesses.length === 0) {
      console.log('\n⚠️  No node processes running');
      return;
    }

    console.log('\n📋 Process List:');
    for (const proc of allProcesses) {
      const status = this.isProcessAllowed(proc) ? '✅' : '❌';
      console.log(`${status} PID ${proc.pid}: ${proc.commandLine.substring(0, 100)}`);
    }
  }
}

// CLI usage
if (require.main === module) {
  const cleanup = new ProcessCleanup();

  const args = process.argv.slice(2);
  const command = args[0];

  (async () => {
    if (command === 'status') {
      await cleanup.printStatus();
    } else if (command === 'dry-run') {
      await cleanup.cleanup(true);
    } else {
      const result = await cleanup.cleanup(false);

      console.log('\n' + '='.repeat(60));
      console.log('📊 CLEANUP COMPLETE');
      console.log('='.repeat(60));
      console.log(`Total found: ${result.total}`);
      console.log(`Allowed: ${result.allowed}`);
      console.log(`Unknown: ${result.unknown}`);
      console.log(`Killed: ${result.killed}`);
      console.log('='.repeat(60));

      if (result.killed > 0) {
        console.log('\n⚠️  Killed processes. Waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        const isClean = await cleanup.verifyClean();
        if (isClean) {
          console.log('\n✅ System clean. Safe to start bot.');
          process.exit(0);
        } else {
          console.log('\n❌ Some processes remain. Manual intervention needed.');
          process.exit(1);
        }
      } else {
        console.log('\n✅ System already clean. Safe to start bot.');
        process.exit(0);
      }
    }
  })();
}
