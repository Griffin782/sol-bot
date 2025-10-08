// simple-duration-only-fix.ts
// Just change the hardcoded timeout to use 1 hour
import * as fs from 'fs';

console.log('Applying minimal duration fix...');

// 1. Set masterConfig to 1 hour
const configPath = 'src/enhanced/masterConfig.ts';
if (fs.existsSync(configPath)) {
  let content = fs.readFileSync(configPath, 'utf8');
  content = content.replace(/duration: \d+,/, 'duration: 120,');
  fs.writeFileSync(configPath, content, 'utf8');
  console.log('✅ Set masterConfig duration to 120 seconds');
}

// 2. Replace any hardcoded 180-second timers in index.ts  
const indexPath = 'src/index.ts';
if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf8');
  // Only replace the specific timeout value, don't add new code
  content = content.replace(/180 \* 1000/g, '120 * 1000');
  fs.writeFileSync(indexPath, content, 'utf8');
  console.log('✅ Changed hardcoded timer to 2 minutes');
}

console.log('Simple fix complete - bot should run for 2 minutes now.');