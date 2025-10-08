const fs = require('fs');
const path = require('path');

console.log('🔍 SEARCHING FOR HARDCODED VALUES...\n');

const indexPath = path.join(__dirname, 'src', 'index.ts');
const content = fs.readFileSync(indexPath, 'utf8');
const lines = content.split('\n');

// Patterns to find hardcoded values
const suspicious = [];

lines.forEach((line, i) => {
  // Skip comments and imports
  if (line.trim().startsWith('//') || line.trim().startsWith('import')) return;
  
  // Look for number assignments
  if (line.match(/=\s*\d+\.?\d*(?!.*CFG)/)) {
    suspicious.push(`Line ${i+1}: ${line.trim()}`);
  }
  
  // Look for number comparisons
  if (line.match(/[<>]=?\s*\d+\.?\d*(?!.*CFG)/)) {
    suspicious.push(`Line ${i+1}: ${line.trim()}`);
  }
});

if (suspicious.length > 0) {
  console.log('⚠️  FOUND POTENTIAL HARDCODED VALUES:\n');
  suspicious.forEach(s => console.log(s));
  console.log('\n✏️  These should probably use CFG.* values instead!');
} else {
  console.log('✅ No obvious hardcoded values found!');
}