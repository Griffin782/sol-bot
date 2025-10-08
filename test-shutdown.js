// Simple test to verify graceful shutdown functionality
// This script simulates the bot running and tests Ctrl+C shutdown

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing Graceful Shutdown Functionality\n');

const botProcess = spawn('npm', ['run', 'dev'], {
  cwd: path.resolve(__dirname),
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

let shutdownStarted = false;
let shutdownCompleted = false;
let connections = {
  websocket: false,
  grpc: false,
  cleanup: false
};

// Monitor bot output
botProcess.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);

  // Track shutdown messages
  if (output.includes('🛑 SHUTDOWN INITIATED')) {
    shutdownStarted = true;
    console.log('\n✅ TEST: Shutdown initiation detected');
  }

  if (output.includes('🔌 Closing WebSocket connection')) {
    connections.websocket = true;
    console.log('✅ TEST: WebSocket cleanup detected');
  }

  if (output.includes('🔌 Closing gRPC')) {
    connections.grpc = true;
    console.log('✅ TEST: gRPC cleanup detected');
  }

  if (output.includes('🔧 PERFORMING CLEANUP')) {
    connections.cleanup = true;
    console.log('✅ TEST: Cleanup process detected');
  }

  if (output.includes('✅ Graceful shutdown complete!')) {
    shutdownCompleted = true;
    console.log('✅ TEST: Graceful shutdown completed');
  }

  // Stop the test after bot starts properly
  if (output.includes('Starting Sniper') || output.includes('connection and subscription established') ||
      output.includes('NEW TOKEN DETECTED') || output.includes('TRADE #')) {
    console.log('\n🔥 Bot started successfully - sending shutdown signal in 3 seconds...');
    setTimeout(() => {
      console.log('\n📡 Sending SIGINT (Ctrl+C) to bot...');
      botProcess.kill('SIGINT');
    }, 3000);
  }
});

botProcess.stderr.on('data', (data) => {
  process.stderr.write(data);
});

botProcess.on('close', (code, signal) => {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 SHUTDOWN TEST RESULTS');
  console.log('='.repeat(60));

  console.log(`Process exit code: ${code}`);
  console.log(`Process exit signal: ${signal}`);
  console.log(`Shutdown initiated: ${shutdownStarted ? '✅' : '❌'}`);
  console.log(`Cleanup performed: ${connections.cleanup ? '✅' : '❌'}`);
  console.log(`WebSocket cleanup: ${connections.websocket ? '✅' : '❌'}`);
  console.log(`gRPC cleanup: ${connections.grpc ? '✅' : '❌'}`);
  console.log(`Graceful shutdown: ${shutdownCompleted ? '✅' : '❌'}`);

  const allTestsPassed = shutdownStarted && connections.cleanup && shutdownCompleted;

  console.log('\n' + '='.repeat(60));
  if (allTestsPassed) {
    console.log('🎉 ALL SHUTDOWN TESTS PASSED!');
    console.log('✅ Graceful shutdown is working correctly');
  } else {
    console.log('❌ SOME TESTS FAILED!');
    console.log('⚠️ Graceful shutdown needs debugging');
  }
  console.log('='.repeat(60));

  process.exit(allTestsPassed ? 0 : 1);
});

// Handle our own shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted - killing bot process...');
  botProcess.kill('SIGKILL');
  process.exit(1);
});

// Timeout the test after 30 seconds
setTimeout(() => {
  console.log('\n⏰ Test timeout reached - killing bot process...');
  botProcess.kill('SIGKILL');
  console.log('❌ TEST FAILED: Bot did not start within 30 seconds');
  process.exit(1);
}, 30000);