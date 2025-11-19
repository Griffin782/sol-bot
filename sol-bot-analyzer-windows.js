/**
 * SOL-BOT Code Analyzer (Windows Compatible)
 * 
 * This script analyzes the codebase to identify common issues:
 * - Metadata monitor references
 * - TypeScript/JavaScript discrepancies
 * - Circuit breaker implementation
 */

const fs = require('fs');
const path = require('path');

// Configuration
const ROOT_DIR = process.cwd(); // Run from project root
const SRC_DIR = path.join(ROOT_DIR, 'src');
const OUTPUT_FILE = path.join(ROOT_DIR, 'diagnostic-report.md');

// Patterns to search for
const PATTERNS = {
  METADATA_MONITOR: 'metadata_monitor',
  STREAM_ACCOUNTS: 'streamAccounts',
  POSITION_MONITOR: 'PositionMonitor',
  STRING_SIZE_ERROR: 'String is the wrong size',
  MPL_TOKEN_METADATA: 'MPL_TOKEN_METADATA_PROGRAM_ID',
  RECONNECT: 'reconnect',
  CIRCUIT_BREAKER: 'Circuit breaker',
  RATE_LIMIT: '429',
};

// Main function
async function main() {
  console.log('🔍 Running SOL-BOT Code Analysis (Windows Compatible)...');
  
  let report = `# SOL-BOT Diagnostic Report
Generated: ${new Date().toISOString()}

## 🔍 TypeScript/JavaScript Sync Status

`;

  // Check for TypeScript/JavaScript sync issues
  report += await checkTsJsSync();
  
  // Search for problematic patterns
  report += await searchForPatterns();
  
  // Check for compilation status
  report += await checkCompilationStatus();
  
  // Check for config overrides
  report += await checkConfigOverrides();
  
  // Save report
  fs.writeFileSync(OUTPUT_FILE, report);
  console.log(`✅ Report saved to ${OUTPUT_FILE}`);
  
  // Print summary
  console.log('\n📊 Analysis Summary:');
  console.log('Check the report for detailed findings.');
}

// Check if TypeScript files have been compiled to JavaScript
async function checkTsJsSync() {
  let result = '';
  
  try {
    // Find all TypeScript files
    const tsFiles = findFiles(SRC_DIR, '.ts');
    let syncIssues = 0;
    let syncedFiles = 0;
    
    result += `### TypeScript/JavaScript Compilation Check\n\n`;
    result += `| TypeScript File | JavaScript File | Status | Last Modified Diff |\n`;
    result += `|----------------|-----------------|--------|--------------------|\n`;
    
    for (const tsFile of tsFiles) {
      // Skip declaration files
      if (tsFile.endsWith('.d.ts')) continue;
      
      // Find corresponding JavaScript file
      const jsFile = tsFile.replace('.ts', '.js');
      
      if (fs.existsSync(jsFile)) {
        const tsStat = fs.statSync(tsFile);
        const jsStat = fs.statSync(jsFile);
        
        // Check if TypeScript file is newer than JavaScript file
        const tsTime = tsStat.mtimeMs;
        const jsTime = jsStat.mtimeMs;
        const timeDiffMinutes = Math.round((tsTime - jsTime) / 60000);
        
        if (tsTime > jsTime) {
          result += `| ${path.relative(ROOT_DIR, tsFile)} | ${path.relative(ROOT_DIR, jsFile)} | ❌ Out of sync | TS is ${timeDiffMinutes} minutes newer |\n`;
          syncIssues++;
        } else {
          result += `| ${path.relative(ROOT_DIR, tsFile)} | ${path.relative(ROOT_DIR, jsFile)} | ✅ In sync | JS is current |\n`;
          syncedFiles++;
        }
      } else {
        result += `| ${path.relative(ROOT_DIR, tsFile)} | ${path.relative(ROOT_DIR, jsFile)} | ❌ JS missing | JS file not found |\n`;
        syncIssues++;
      }
    }
    
    result += `\n**Summary:** ${syncedFiles} files in sync, ${syncIssues} files with issues.\n\n`;
    
    if (syncIssues > 0) {
      result += `⚠️ **Compilation needed!** Run \`npm run build\` or \`npx tsc\` to compile TypeScript to JavaScript.\n\n`;
    } else {
      result += `✅ All TypeScript files are properly compiled to JavaScript.\n\n`;
    }
  } catch (error) {
    result += `Error checking TS/JS sync: ${error.message}\n\n`;
  }
  
  return result;
}

// Search for specific patterns in the codebase - Windows compatible
async function searchForPatterns() {
  let result = `## 🔍 Critical Pattern Search\n\n`;
  
  try {
    // Search for metadata_monitor references
    result += `### Metadata Monitor References\n\n`;
    
    const metadataMonitorMatches = searchInFiles(SRC_DIR, ['.ts', '.js'], PATTERNS.METADATA_MONITOR);
    
    if (metadataMonitorMatches.length === 0) {
      result += `✅ No metadata_monitor references found!\n\n`;
    } else {
      result += `⚠️ **metadata_monitor references found:**\n\n\`\`\`\n${formatSearchResults(metadataMonitorMatches)}\`\`\`\n\n`;
    }
    
    // Search for streamAccounts calls
    result += `### Stream Accounts Subscription Calls\n\n`;
    
    const streamAccountsMatches = searchInFiles(SRC_DIR, ['.ts', '.js'], PATTERNS.STREAM_ACCOUNTS);
    
    if (streamAccountsMatches.length === 0) {
      result += `No streamAccounts calls found.\n\n`;
    } else {
      result += `Found streamAccounts calls:\n\n\`\`\`\n${formatSearchResults(streamAccountsMatches)}\`\`\`\n\n`;
    }
    
    // Search for circuit breaker implementation
    result += `### Circuit Breaker Implementation\n\n`;
    
    const circuitBreakerMatches = searchInFiles(SRC_DIR, ['.ts', '.js'], PATTERNS.CIRCUIT_BREAKER);
    
    if (circuitBreakerMatches.length === 0) {
      result += `⚠️ **No circuit breaker found!** This may lead to infinite reconnection loops.\n\n`;
    } else {
      result += `✅ Circuit breaker implementation found!\n\n\`\`\`\n${formatSearchResults(circuitBreakerMatches)}\`\`\`\n\n`;
    }
    
    // Check for reconnect attempts property
    result += `### Reconnect Attempts Property\n\n`;
    
    const reconnectAttemptsMatches = searchInFiles(SRC_DIR, ['.ts', '.js'], 'reconnectAttempts');
    
    if (reconnectAttemptsMatches.length === 0) {
      result += `⚠️ **No reconnectAttempts property found!** This is needed for the circuit breaker.\n\n`;
    } else {
      result += `✅ reconnectAttempts property found!\n\n\`\`\`\n${formatSearchResults(reconnectAttemptsMatches)}\`\`\`\n\n`;
    }
    
    // Search for "String is the wrong size" error handling
    result += `### Error Handling for "String is the wrong size"\n\n`;
    
    const stringSizeMatches = searchInFiles(SRC_DIR, ['.ts', '.js'], PATTERNS.STRING_SIZE_ERROR);
    
    if (stringSizeMatches.length === 0) {
      result += `No specific handling for "String is the wrong size" error found.\n\n`;
    } else {
      result += `Found handling for "String is the wrong size" error:\n\n\`\`\`\n${formatSearchResults(stringSizeMatches)}\`\`\`\n\n`;
    }
  } catch (error) {
    result += `Error searching for patterns: ${error.message}\n\n`;
  }
  
  return result;
}

// Check compilation status of TypeScript files
async function checkCompilationStatus() {
  let result = `## 🔧 Compilation Status\n\n`;
  
  try {
    // Check tsconfig.json
    if (fs.existsSync(path.join(ROOT_DIR, 'tsconfig.json'))) {
      const tsconfig = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'tsconfig.json'), 'utf8'));
      
      result += `### TypeScript Configuration\n\n`;
      result += `- **Target:** ${tsconfig.compilerOptions?.target || 'Not specified'}\n`;
      result += `- **Module:** ${tsconfig.compilerOptions?.module || 'Not specified'}\n`;
      result += `- **OutDir:** ${tsconfig.compilerOptions?.outDir || 'Not specified'}\n`;
      result += `- **Watch Mode:** ${tsconfig.compilerOptions?.watch ? 'Enabled' : 'Disabled'}\n\n`;
      
      if (!tsconfig.compilerOptions?.watch) {
        result += `⚠️ **Watch mode is disabled.** TypeScript files won't automatically compile when changed.\n\n`;
      }
    } else {
      result += `⚠️ **No tsconfig.json found!** TypeScript compilation may not be configured correctly.\n\n`;
    }
    
    // Check npm scripts
    if (fs.existsSync(path.join(ROOT_DIR, 'package.json'))) {
      const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
      
      result += `### NPM Scripts\n\n`;
      
      if (packageJson.scripts?.build) {
        result += `- ✅ **Build Script:** \`${packageJson.scripts.build}\`\n`;
      } else {
        result += `- ⚠️ **No Build Script Found!** Add a build script to package.json.\n`;
      }
      
      if (packageJson.scripts?.dev) {
        result += `- **Dev Script:** \`${packageJson.scripts.dev}\`\n`;
      }
      
      if (packageJson.scripts?.watch) {
        result += `- ✅ **Watch Script:** \`${packageJson.scripts.watch}\`\n`;
      } else {
        result += `- ⚠️ **No Watch Script Found!** Consider adding a watch script for automatic compilation.\n`;
      }
      
      result += `\n`;
    }
    
    // Recommend commands
    result += `### Compilation Commands\n\n`;
    result += `To ensure TypeScript files are compiled to JavaScript, run one of these commands:\n\n`;
    result += `\`\`\`bash\n`;
    result += `# Compile TypeScript files\n`;
    result += `npm run build\n\n`;
    result += `# Or if build script is not defined\n`;
    result += `npx tsc\n\n`;
    result += `# For automatic compilation during development\n`;
    result += `npm run watch\n\n`;
    result += `# Or if watch script is not defined\n`;
    result += `npx tsc --watch\n`;
    result += `\`\`\`\n\n`;
    
  } catch (error) {
    result += `Error checking compilation status: ${error.message}\n\n`;
  }
  
  return result;
}

// Check for config overrides
async function checkConfigOverrides() {
  let result = `## ⚙️ Configuration Analysis\n\n`;
  
  try {
    // Find all config files
    const configFiles = [
      ...findFiles(SRC_DIR, 'config.ts'),
      ...findFiles(SRC_DIR, 'config.js'),
      ...findFiles(SRC_DIR, 'masterConfig.ts'),
      ...findFiles(SRC_DIR, 'masterConfig.js'),
    ];
    
    result += `### Config Files Found (${configFiles.length})\n\n`;
    
    if (configFiles.length > 0) {
      result += `| File | Last Modified | Size |\n`;
      result += `|------|--------------|------|\n`;
      
      for (const file of configFiles) {
        const stats = fs.statSync(file);
        result += `| ${path.relative(ROOT_DIR, file)} | ${stats.mtime.toISOString()} | ${formatBytes(stats.size)} |\n`;
      }
      
      result += `\n`;
      
      if (configFiles.length > 1) {
        result += `⚠️ **Multiple config files found!** This may lead to confusion and overrides.\n\n`;
      }
    } else {
      result += `No config files found.\n\n`;
    }
    
    // Search for hardcoded values
    result += `### Hardcoded Values\n\n`;
    
    const patterns = [
      'BUY_AMOUNT',
      'positionSize',
      'z_positionSize',
      'initialPool',
      'targetPool',
    ];
    
    for (const pattern of patterns) {
      const matches = searchInFiles(SRC_DIR, ['.ts', '.js'], pattern);
      
      if (matches.length > 0) {
        result += `**${pattern}** found in:\n\n\`\`\`\n${formatSearchResults(matches)}\`\`\`\n\n`;
      }
    }
  } catch (error) {
    result += `Error checking config overrides: ${error.message}\n\n`;
  }
  
  return result;
}

// Helper function to find files with a specific extension
function findFiles(dir, extension) {
  let results = [];
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      results = results.concat(findFiles(filePath, extension));
    } else if (file.endsWith(extension) || file === extension) {
      results.push(filePath);
    }
  }
  
  return results;
}

// Helper function to search in files - Windows compatible replacement for grep
function searchInFiles(dir, extensions, pattern) {
  const matches = [];
  
  function searchInDir(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        searchInDir(filePath);
      } else {
        // Check if file has one of the specified extensions
        const hasExtension = extensions.some(ext => file.endsWith(ext));
        
        if (hasExtension) {
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(pattern)) {
                matches.push({
                  file: filePath,
                  line: i + 1,
                  content: lines[i].trim()
                });
              }
            }
          } catch (error) {
            console.error(`Error reading file ${filePath}: ${error.message}`);
          }
        }
      }
    }
  }
  
  searchInDir(dir);
  return matches;
}

// Helper function to format search results
function formatSearchResults(matches) {
  return matches.map(match => {
    const relativeFile = path.relative(ROOT_DIR, match.file);
    return `${relativeFile}:${match.line}: ${match.content}`;
  }).join('\n');
}

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Run the script
main().catch(error => {
  console.error('Error running analysis:', error);
  process.exit(1);
});