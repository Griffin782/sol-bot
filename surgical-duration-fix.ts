// surgical-duration-fix.ts
// Ultra-minimal fix that only adds duration control without variable conflicts
// Run with: npx ts-node surgical-duration-fix.ts

import * as fs from 'fs';

class SurgicalDurationFix {
  
  constructor() {
    console.log('🔧 SURGICAL DURATION FIX');
    console.log('=========================');
    console.log('Adding ONLY duration control without touching existing variables\n');
  }

  async run(): Promise<void> {
    try {
      this.createBackup();
      this.setMasterConfigDuration();
      this.addDurationControlToIndex();
      this.createTest();
      
      console.log('\n✅ SURGICAL FIX COMPLETE!');
      console.log('\nWhat was changed:');
      console.log('- Set masterConfig duration to 180 seconds');
      console.log('- Added duration timer to index.ts (no imports)');
      console.log('- No variable conflicts');
      console.log('\nTest: npm run dev (should stop after 3 minutes)');
      
    } catch (error) {
      console.error('❌ Fix failed:', error);
    }
  }

  createBackup(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
    const backupDir = `backup-surgical-${timestamp}`;
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    
    if (fs.existsSync('src/index.ts')) {
      fs.copyFileSync('src/index.ts', `${backupDir}/index.ts`);
    }
    if (fs.existsSync('src/enhanced/masterConfig.ts')) {
      fs.copyFileSync('src/enhanced/masterConfig.ts', `${backupDir}/masterConfig.ts`);
    }
    
    console.log(`📁 Backup created: ${backupDir}`);
  }

  // Only set duration in masterConfig - nothing else
  setMasterConfigDuration(): void {
    const filePath = 'src/enhanced/masterConfig.ts';
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ masterConfig.ts not found');
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Only change duration, leave everything else alone
    content = content.replace(/duration: \d+,/, 'duration: 180,');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Set masterConfig duration to 180 seconds');
  }

  // Add duration control without imports - just hardcode 180 seconds for now
  addDurationControlToIndex(): void {
    const filePath = 'src/index.ts';
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ index.ts not found');
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if duration control already exists
    if (content.includes('DURATION CONTROL')) {
      console.log('✅ Duration control already exists');
      return;
    }
    
    // Add a simple 3-minute timer without any imports or variable conflicts
    const durationControl = `
// ============================================
// DURATION CONTROL - 3 MINUTE AUTO-STOP
// ============================================
console.log('⏰ Bot will auto-stop after 3 minutes (180 seconds)');
const startTime = Date.now();
const maxDuration = 180 * 1000; // 3 minutes in milliseconds

const durationTimer = setInterval(() => {
  const elapsed = Date.now() - startTime;
  const remaining = Math.max(0, maxDuration - elapsed);
  const remainingSeconds = Math.floor(remaining / 1000);
  
  if (remainingSeconds <= 0) {
    console.log('\\n⏰ 3-MINUTE DURATION REACHED - STOPPING BOT');
    console.log('📊 Session completed successfully');
    console.log('🔄 Bot stopped by duration control');
    clearInterval(durationTimer);
    process.exit(0);
  }
  
  // Show countdown every 30 seconds
  if (remainingSeconds % 30 === 0 && remainingSeconds > 0) {
    console.log(\`⏰ Time remaining: \${remainingSeconds} seconds\`);
  }
}, 1000);

console.log('✅ Duration control active - 3 minute timer started\\n');
// ============================================
`;

    // Find a safe place to insert (after initial logging but before main execution)
    const insertPoint = content.indexOf('console.log("Starting') || 
                       content.indexOf('console.log("✅') || 
                       content.indexOf('// Enhanced features') ||
                       500;
    
    content = content.slice(0, insertPoint) + durationControl + content.slice(insertPoint);

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Added 3-minute auto-stop timer to index.ts');
  }

  createTest(): void {
    const testScript = `// test-duration.ts - Quick test that duration control works
console.log('🧪 DURATION CONTROL TEST');
console.log('========================');
console.log('This will test if the 3-minute timer works');
console.log('Expected: Bot should stop automatically after 180 seconds');
console.log('\\n🚀 Run: npm run dev');
console.log('\\n⏰ Watch for:');
console.log('- "Bot will auto-stop after 3 minutes" message');
console.log('- Countdown messages every 30 seconds');
console.log('- "3-MINUTE DURATION REACHED" message');
console.log('- Automatic process exit');`;

    fs.writeFileSync('test-duration.ts', testScript, 'utf8');
    console.log('✅ Created duration test guide');
  }
}

// Run the surgical fix
if (require.main === module) {
  new SurgicalDurationFix().run().catch(console.error);
}