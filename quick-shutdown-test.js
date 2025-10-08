// Quick shutdown test - starts bot and immediately tests shutdown
const { spawn } = require('child_process');

console.log('🧪 Quick Shutdown Test\n');

const botProcess = spawn('npm', ['run', 'dev'], {
  cwd: __dirname,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

let shutdownMessages = {
  initiated: false,
  cleanup: false,
  websocket: false,
  grpc: false,
  completed: false
};

botProcess.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);

  // Track shutdown sequence
  if (output.includes('🛑 SHUTDOWN INITIATED')) {
    shutdownMessages.initiated = true;
    console.log('\n✅ Shutdown initiated detected');
  }
  if (output.includes('🔧 PERFORMING CLEANUP')) {
    shutdownMessages.cleanup = true;
    console.log('✅ Cleanup detected');
  }
  if (output.includes('🔌 Closing WebSocket')) {
    shutdownMessages.websocket = true;
    console.log('✅ WebSocket cleanup detected');
  }
  if (output.includes('🔌 Closing gRPC')) {
    shutdownMessages.grpc = true;
    console.log('✅ gRPC cleanup detected');
  }
  if (output.includes('✅ Graceful shutdown complete!')) {
    shutdownMessages.completed = true;
    console.log('✅ Graceful shutdown completed');
  }
});

botProcess.stderr.on('data', (data) => {
  process.stderr.write(data);
});

// Send SIGINT after 5 seconds
setTimeout(() => {
  console.log('\n📡 Sending SIGINT (Ctrl+C) to test shutdown...');
  botProcess.kill('SIGINT');
}, 5000);

botProcess.on('close', (code, signal) => {
  console.log('\n' + '='.repeat(50));
  console.log('🧪 SHUTDOWN TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`Exit code: ${code}, Signal: ${signal}`);
  console.log(`Shutdown initiated: ${shutdownMessages.initiated ? '✅' : '❌'}`);
  console.log(`Cleanup performed: ${shutdownMessages.cleanup ? '✅' : '❌'}`);
  console.log(`WebSocket cleanup: ${shutdownMessages.websocket ? '✅' : '❌'}`);
  console.log(`gRPC cleanup: ${shutdownMessages.grpc ? '✅' : '❌'}`);
  console.log(`Graceful shutdown: ${shutdownMessages.completed ? '✅' : '❌'}`);

  const success = shutdownMessages.initiated && shutdownMessages.cleanup && shutdownMessages.completed;
  console.log('\n' + (success ? '🎉 SHUTDOWN TEST PASSED!' : '❌ SHUTDOWN TEST FAILED!'));

  process.exit(success ? 0 : 1);
});

// Timeout after 15 seconds
setTimeout(() => {
  console.log('\n⏰ Test timeout - killing process...');
  botProcess.kill('SIGKILL');
  process.exit(1);
}, 15000);