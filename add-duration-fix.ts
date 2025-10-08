// add-duration-fix.ts
// Add working duration control to index.ts
// Run with: npx ts-node add-duration-fix.ts

import * as fs from 'fs';

const filePath = 'src/index.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Remove any existing duration control
content = content.replace(/\/\/ =+\s*\n\/\/ DURATION CONTROL[\s\S]*?\/\/ =+/g, '');

// Add working duration control at the very start of main execution
const durationControl = `
// ============================================
// WORKING DURATION CONTROL - 3 MINUTES
// ============================================
console.log('🔧 ADDING 3-MINUTE AUTO-STOP TIMER');
const BOT_START_TIME = Date.now();
const MAX_RUNTIME_MS = 180 * 1000; // 3 minutes

// Force exit after 3 minutes - no exceptions
setTimeout(() => {
  console.log('\\n⏰ 3-MINUTE LIMIT REACHED - FORCE STOPPING BOT');
  console.log('📊 Session complete - duration control working');
  process.exit(0);
}, MAX_RUNTIME_MS);

// Show countdown
const countdownInterval = setInterval(() => {
  const elapsed = Date.now() - BOT_START_TIME;
  const remaining = Math.max(0, MAX_RUNTIME_MS - elapsed);
  const remainingSeconds = Math.floor(remaining / 1000);
  
  if (remainingSeconds <= 0) {
    clearInterval(countdownInterval);
    return;
  }
  
  if (remainingSeconds % 30 === 0) {
    console.log(\`⏰ Auto-stop in: \${remainingSeconds} seconds\`);
  }
}, 1000);

console.log('✅ 3-minute auto-stop timer ACTIVE');
// ============================================
`;

// Insert at the very beginning of the file after imports
const insertPoint = content.indexOf('console.log') || 500;
content = content.slice(0, insertPoint) + durationControl + content.slice(insertPoint);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Added working duration control to index.ts');
console.log('🚀 Restart bot: npm run dev (will stop after 3 minutes)');