// Simple shutdown trigger test
const { spawn } = require('child_process');

console.log('🧪 Simple Shutdown Test - Will trigger shutdown after startup\n');

const botProcess = spawn('npm', ['run', 'dev'], {
  cwd: __dirname,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

let shutdownDetected = false;

botProcess.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);

  // Trigger shutdown when we see the bot is fully started
  if (output.includes('Starting Sniper via Websocket') && !shutdownDetected) {
    console.log('\n🎯 Bot detected as started - triggering shutdown test...');
    shutdownDetected = true;

    // Try multiple methods to trigger shutdown
    setTimeout(() => {
      console.log('📡 Method 1: SIGINT signal...');
      botProcess.kill('SIGINT');

      setTimeout(() => {
        console.log('📡 Method 2: SIGTERM signal...');
        botProcess.kill('SIGTERM');

        setTimeout(() => {
          console.log('📡 Method 3: Force kill...');
          botProcess.kill('SIGKILL');
        }, 3000);
      }, 3000);
    }, 1000);
  }

  // Look for shutdown messages
  if (output.includes('🛑 SHUTDOWN INITIATED')) {
    console.log('\n✅ SUCCESS: Shutdown initiated message detected!');
  }
  if (output.includes('🔧 PERFORMING CLEANUP')) {
    console.log('✅ SUCCESS: Cleanup message detected!');
  }
  if (output.includes('✅ Graceful shutdown complete')) {
    console.log('✅ SUCCESS: Graceful shutdown completed!');
  }
});

botProcess.stderr.on('data', (data) => {
  process.stderr.write(data);
});

botProcess.on('close', (code, signal) => {
  console.log(`\n📊 Process closed with code: ${code}, signal: ${signal}`);
  process.exit(0);
});

// Overall timeout
setTimeout(() => {
  console.log('\n⏰ Overall test timeout - killing process');
  botProcess.kill('SIGKILL');
  process.exit(1);
}, 20000);