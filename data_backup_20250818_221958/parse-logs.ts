import * as fs from 'fs';
import * as path from 'path';

// SIMPLE LOG PARSER - No extra packages needed!
const DATA_DIR = './';  // Current directory since you're in data folder
const OUTPUT_DIR = './parsed';

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('🔍 Starting log parsing...\n');

// 1. PARSE CSV FILES (simple split by comma)
function parseCSV(filename: string) {
  console.log(`📄 Parsing ${filename}...`);
  
  const filepath = path.join(DATA_DIR, filename);
  
  if (!fs.existsSync(filepath)) {
    console.log(`  ⚠️ File not found: ${filename}`);
    return;
  }
  
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    console.log(`  ⚠️ Empty file: ${filename}`);
    return;
  }
  
  // Get headers
  const headers = lines[0];
  
  // Group by date (simple approach)
  const byDate: { [key: string]: string[] } = {};
  
  lines.slice(1).forEach((line, index) => {
    // Try to find a date in the line (looks for YYYY-MM-DD pattern)
    const dateMatch = line.match(/\d{4}-\d{2}-\d{2}/);
    
    if (dateMatch) {
      const date = dateMatch[0];
      if (!byDate[date]) {
        byDate[date] = [headers]; // Add headers to each file
      }
      byDate[date].push(line);
    } else {
      // If no date found, put in "unknown" file
      if (!byDate['unknown']) {
        byDate['unknown'] = [headers];
      }
      byDate['unknown'].push(line);
    }
  });
  
  // Save each day separately
  Object.keys(byDate).forEach(date => {
    const baseFilename = filename.replace('.csv', '');
    const outputFile = path.join(OUTPUT_DIR, `${baseFilename}_${date}.csv`);
    fs.writeFileSync(outputFile, byDate[date].join('\n'));
    console.log(`  ✅ Saved: ${baseFilename}_${date}.csv (${byDate[date].length - 1} rows)`);
  });
}

// 2. PARSE JSON FILES
function parseJSON(filename: string) {
  console.log(`📄 Parsing ${filename}...`);
  
  const filepath = path.join(DATA_DIR, filename);
  
  if (!fs.existsSync(filepath)) {
    console.log(`  ⚠️ File not found: ${filename}`);
    return;
  }
  
  const content = fs.readFileSync(filepath, 'utf-8');
  
  let data: any[] = [];
  
  try {
    // Try parsing as regular JSON array
    data = JSON.parse(content);
    if (!Array.isArray(data)) {
      data = [data];
    }
  } catch {
    // Try parsing as newline-delimited JSON
    const lines = content.split('\n').filter(line => line.trim());
    data = [];
    
    lines.forEach((line, index) => {
      try {
        data.push(JSON.parse(line));
      } catch (e) {
        console.log(`  ⚠️ Skipping invalid JSON at line ${index + 1}`);
      }
    });
  }
  
  if (data.length === 0) {
    console.log(`  ⚠️ No valid data found in ${filename}`);
    return;
  }
  
  // Group by date
  const byDate: { [key: string]: any[] } = {};
  
  data.forEach((item: any) => {
    // Try to find date in various fields
    let dateStr = '';
    
    if (item.timestamp) {
      dateStr = item.timestamp.toString();
    } else if (item.date) {
      dateStr = item.date.toString();
    } else if (item.created_at) {
      dateStr = item.created_at.toString();
    } else if (item.entryTime) {
      dateStr = item.entryTime.toString();
    } else {
      // Try to find any date-like string in the object
      const jsonStr = JSON.stringify(item);
      const dateMatch = jsonStr.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        dateStr = dateMatch[0];
      }
    }
    
    // Extract date part
    const dateMatch = dateStr.match(/\d{4}-\d{2}-\d{2}/);
    const date = dateMatch ? dateMatch[0] : 'unknown';
    
    if (!byDate[date]) {
      byDate[date] = [];
    }
    byDate[date].push(item);
  });
  
  // Save each day separately
  Object.keys(byDate).forEach(date => {
    const baseFilename = filename.replace('.json', '');
    const outputFile = path.join(OUTPUT_DIR, `${baseFilename}_${date}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(byDate[date], null, 2));
    console.log(`  ✅ Saved: ${baseFilename}_${date}.json (${byDate[date].length} entries)`);
  });
}

// 3. ANALYZE FILE SIZES
function analyzeFiles() {
  console.log('\n📊 Analyzing original files...\n');
  
  const files = [
    'pending_tokens.csv',
    'pool_transactions.csv',
    'paper_trading_exits.csv',
    'trading_log.json',
    'whale_exits.json'
  ];
  
  files.forEach(file => {
    const filepath = path.join(DATA_DIR, file);
    if (fs.existsSync(filepath)) {
      const stats = fs.statSync(filepath);
      const sizeKB = Math.round(stats.size / 1024);
      console.log(`  ${file}: ${sizeKB} KB`);
      
      // If file is large, suggest splitting
      if (sizeKB > 1000) {
        console.log(`    ⚠️ Large file - will be split by date`);
      }
    } else {
      console.log(`  ${file}: NOT FOUND`);
    }
  });
}

// 4. CREATE SUMMARY
function createSummary() {
  console.log('\n📊 Creating summary...');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.log('  ⚠️ No parsed files found');
    return;
  }
  
  const files = fs.readdirSync(OUTPUT_DIR);
  const summary: any = {
    totalFiles: files.length,
    byType: {},
    byDate: {},
    fileSizes: {}
  };
  
  files.forEach(file => {
    const filepath = path.join(OUTPUT_DIR, file);
    const stats = fs.statSync(filepath);
    const sizeKB = Math.round(stats.size / 1024);
    
    summary.fileSizes[file] = `${sizeKB} KB`;
    
    // Extract type and date from filename
    const parts = file.split('_');
    if (parts.length >= 2) {
      const type = parts.slice(0, -1).join('_');
      const dateExt = parts[parts.length - 1];
      const date = dateExt.split('.')[0];
      
      // Count by type
      if (!summary.byType[type]) summary.byType[type] = 0;
      summary.byType[type]++;
      
      // Count by date
      if (!summary.byDate[date]) summary.byDate[date] = [];
      summary.byDate[date].push(file);
    }
  });
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'summary.json'),
    JSON.stringify(summary, null, 2)
  );
  
  console.log('\n✨ Parsing complete!');
  console.log(`  Total files created: ${summary.totalFiles}`);
  console.log('\n  Files per type:');
  Object.entries(summary.byType).forEach(([type, count]) => {
    console.log(`    ${type}: ${count} files`);
  });
  
  // Show date range
  const dates = Object.keys(summary.byDate).filter(d => d !== 'unknown').sort();
  if (dates.length > 0) {
    console.log(`\n  Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
  }
  
  // Show which files to upload
  console.log('\n📤 Recommended uploads (smallest files):');
  const sortedFiles = Object.entries(summary.fileSizes)
    .sort((a, b) => parseInt(a[1] as string) - parseInt(b[1] as string))
    .slice(0, 5);
  
  sortedFiles.forEach(([file, size]) => {
    console.log(`    ${file}: ${size}`);
  });
}

// MAIN FUNCTION
async function main() {
  try {
    // Analyze original files
    analyzeFiles();
    
    console.log('\n🔄 Starting parsing...\n');
    
    // Parse CSV files
    parseCSV('pending_tokens.csv');
    parseCSV('pool_transactions.csv');
    parseCSV('paper_trading_exits.csv');
    
    // Parse JSON files
    parseJSON('trading_log.json');
    parseJSON('whale_exits.json');
    
    // Create summary
    createSummary();
    
    console.log('\n🎉 Done! Check the ./parsed/ folder');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();