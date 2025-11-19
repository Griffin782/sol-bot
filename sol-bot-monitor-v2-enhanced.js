// SOL-BOT V2 Advanced Monitor - ENHANCED VERSION
// Created: November 11, 2025
// Purpose: Provide enhanced monitoring with focus on metadata issues and token filtering

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const CONFIG = {
  logDir: process.argv[2] || '.', // Default to current directory or accept command line arg
  refreshRate: 5000, // Update every 5 seconds
  testDuration: 30 * 60 * 1000, // 30 minute test
};

// Data tracking
const stats = {
  startTime: null,
  lastUpdate: Date.now(),
  totalLines: 0,
  errors: {
    byType: {},
    total: 0,
    lastErrors: [],
    metadataSpecific: [], // NEW: Track metadata-specific errors
    patternMatches: {}    // NEW: Track error patterns
  },
  tokens: {
    detected: 0,
    bought: 0,
    uniqueBought: new Set(),
    rejected: 0, 
    blocked: 0,
    rejectionReasons: {}, // NEW: Track reasons for rejection
    blockReasons: {},     // NEW: Track reasons for blocking
    sold: 0,
    uniqueSold: new Set(),
    byToken: {}
  },
  buys: {
    total: 0,
    successful: 0,
    failed: 0,
    duplicates: 0
  },
  sells: {
    total: 0,
    successful: 0, 
    failed: 0
  },
  profit: {
    session: 0,
    total: 0,
    byToken: {}
  },
  criticalIssues: [],
  warnings: [],
  // NEW: Metadata specific tracking
  metadata: {
    queries: 0,
    successes: 0,
    failures: 0,
    stringSizeErrors: 0, // NEW: Count STRING_SIZE errors specifically
    lastFailedTokens: [] // NEW: Track which tokens caused metadata failures
  },
  // NEW: Token quality filter tracking
  qualityFilter: {
    active: false,       // Flag to track if quality filter is active
    checksRun: 0,        // How many quality checks were performed
    tokensPassed: 0,     // How many tokens passed quality checks
    tokensBlocked: 0,    // How many tokens were blocked by quality checks
    bypasses: 0          // Count of potential safety bypasses
  },
  // NEW: Safety system tracking
  safetySystem: {
    active: false,        // Is safety system active?
    checksRun: 0,         // Number of safety checks run
    lastCheckedToken: '', // Last token that went through safety check
    bypassDetected: false // Was a bypass of safety detected?
  }
};

// Token tracker
class TokenTracker {
  constructor() {
    this.tokens = new Map();
  }

  recordDetection(tokenMint) {
    if (!this.tokens.has(tokenMint)) {
      this.tokens.set(tokenMint, {
        detected: Date.now(),
        buys: [],
        sells: [],
        rejected: false,
        rejectionReason: '',
        blocked: false,
        blockReason: '',
        profit: 0,
        // NEW: Metadata tracking per token
        metadata: {
          queries: 0,
          successes: 0,
          failures: 0,
          errors: []
        },
        // NEW: Quality check tracking per token
        qualityCheck: {
          performed: false,
          passed: false,
          reason: ''
        }
      });
    }
    stats.tokens.detected++;
    return this.tokens.get(tokenMint);
  }

  recordBuy(tokenMint, amount, price) {
    if (!this.tokens.has(tokenMint)) {
      this.recordDetection(tokenMint);
    }

    const token = this.tokens.get(tokenMint);
    token.buys.push({
      time: Date.now(),
      amount: amount || 0,
      price: price || 0
    });

    if (token.buys.length === 1) {
      stats.tokens.uniqueBought.add(tokenMint);
    }
    
    if (token.buys.length > 1) {
      stats.buys.duplicates++;
    }
    
    stats.tokens.bought++;
    stats.buys.successful++;
  }

  recordSell(tokenMint, amount, price, profit) {
    if (!this.tokens.has(tokenMint)) {
      console.error(`Trying to record sell for unknown token: ${tokenMint}`);
      return;
    }

    const token = this.tokens.get(tokenMint);
    token.sells.push({
      time: Date.now(),
      amount: amount || 0,
      price: price || 0,
      profit: profit || 0
    });
    
    if (token.sells.length === 1) {
      stats.tokens.uniqueSold.add(tokenMint);
    }
    
    if (profit) {
      token.profit += profit;
      stats.profit.byToken[tokenMint] = (stats.profit.byToken[tokenMint] || 0) + profit;
    }
    
    stats.tokens.sold++;
    stats.sells.successful++;
  }

  recordRejection(tokenMint, reason) {
    if (!this.tokens.has(tokenMint)) {
      this.recordDetection(tokenMint);
    }
    
    const token = this.tokens.get(tokenMint);
    token.rejected = true;
    token.rejectionReason = reason || 'Unknown reason';
    
    // Track rejection reasons
    const cleanReason = (reason || 'Unknown reason').trim();
    stats.tokens.rejectionReasons[cleanReason] = (stats.tokens.rejectionReasons[cleanReason] || 0) + 1;
    
    stats.tokens.rejected++;
  }

  recordBlocked(tokenMint, reason) {
    if (!this.tokens.has(tokenMint)) {
      this.recordDetection(tokenMint);
    }
    
    const token = this.tokens.get(tokenMint);
    token.blocked = true;
    token.blockReason = reason || 'Unknown reason';
    
    // Track block reasons
    const cleanReason = (reason || 'Unknown reason').trim();
    stats.tokens.blockReasons[cleanReason] = (stats.tokens.blockReasons[cleanReason] || 0) + 1;
    
    stats.tokens.blocked++;
    
    // Mark quality filter as active if we see blocks
    stats.qualityFilter.active = true;
    stats.qualityFilter.tokensBlocked++;
  }

  // NEW: Record metadata query
  recordMetadataQuery(tokenMint) {
    if (!this.tokens.has(tokenMint)) {
      this.recordDetection(tokenMint);
    }
    
    const token = this.tokens.get(tokenMint);
    token.metadata.queries++;
    stats.metadata.queries++;
  }
  
  // NEW: Record metadata success
  recordMetadataSuccess(tokenMint) {
    if (!this.tokens.has(tokenMint)) {
      this.recordDetection(tokenMint);
    }
    
    const token = this.tokens.get(tokenMint);
    token.metadata.successes++;
    stats.metadata.successes++;
  }
  
  // NEW: Record metadata failure
  recordMetadataFailure(tokenMint, error) {
    if (!this.tokens.has(tokenMint)) {
      this.recordDetection(tokenMint);
    }
    
    const token = this.tokens.get(tokenMint);
    token.metadata.failures++;
    token.metadata.errors.push(error || 'Unknown error');
    stats.metadata.failures++;
    
    // Track STRING_SIZE errors specifically
    if (error && error.includes('String is the wrong size')) {
      stats.metadata.stringSizeErrors++;
    }
    
    // Keep track of the last few tokens that caused metadata failures
    if (stats.metadata.lastFailedTokens.length >= 5) {
      stats.metadata.lastFailedTokens.shift();
    }
    stats.metadata.lastFailedTokens.push({
      mint: tokenMint,
      error: error || 'Unknown error'
    });
  }

  // NEW: Record quality check
  recordQualityCheck(tokenMint, passed, reason) {
    if (!this.tokens.has(tokenMint)) {
      this.recordDetection(tokenMint);
    }
    
    const token = this.tokens.get(tokenMint);
    token.qualityCheck.performed = true;
    token.qualityCheck.passed = passed;
    token.qualityCheck.reason = reason || '';
    
    stats.qualityFilter.checksRun++;
    if (passed) {
      stats.qualityFilter.tokensPassed++;
    } else {
      stats.qualityFilter.tokensBlocked++;
    }
    
    // Flag quality filter as active
    stats.qualityFilter.active = true;
  }

  // NEW: Record safety check
  recordSafetyCheck(tokenMint, passed, reason) {
    if (!this.tokens.has(tokenMint)) {
      this.recordDetection(tokenMint);
    }
    
    stats.safetySystem.checksRun++;
    stats.safetySystem.lastCheckedToken = tokenMint;
    stats.safetySystem.active = true;
  }

  getDuplicatePurchaseCount() {
    let duplicates = 0;
    this.tokens.forEach(token => {
      if (token.buys.length > 1) {
        duplicates += (token.buys.length - 1);
      }
    });
    return duplicates;
  }

  getMultiPurchaseTokens() {
    const multiPurchase = [];
    this.tokens.forEach((data, mint) => {
      if (data.buys.length > 1) {
        multiPurchase.push({
          mint: mint.substring(0, 8) + '...',
          buyCount: data.buys.length,
          sellCount: data.sells.length
        });
      }
    });
    return multiPurchase.sort((a, b) => b.buyCount - a.buyCount).slice(0, 5);
  }

  getProfitableTokens() {
    const profitable = [];
    this.tokens.forEach((data, mint) => {
      if (data.profit > 0) {
        profitable.push({
          mint: mint.substring(0, 8) + '...',
          profit: data.profit.toFixed(2)
        });
      }
    });
    return profitable.sort((a, b) => b.profit - a.profit).slice(0, 5);
  }
  
  // NEW: Get tokens with metadata failures
  getTokensWithMetadataFailures() {
    const problematic = [];
    this.tokens.forEach((data, mint) => {
      if (data.metadata.failures > 0) {
        problematic.push({
          mint: mint.substring(0, 8) + '...',
          queries: data.metadata.queries,
          failures: data.metadata.failures,
          error: data.metadata.errors[0] || 'Unknown'
        });
      }
    });
    return problematic.sort((a, b) => b.failures - a.failures).slice(0, 5);
  }
  
  // NEW: Get tokens rejected by quality filter
  getRejectedQualityTokens() {
    const rejected = [];
    this.tokens.forEach((data, mint) => {
      if (data.qualityCheck.performed && !data.qualityCheck.passed) {
        rejected.push({
          mint: mint.substring(0, 8) + '...',
          reason: data.qualityCheck.reason
        });
      }
    });
    return rejected.sort((a, b) => a.mint.localeCompare(b.mint)).slice(0, 5);
  }
}

const tokenTracker = new TokenTracker();

// Log parsing patterns
const PATTERNS = {
  botStart: /ConfigurationEnforcer initialized/,
  tokenDetected: /\[TOKEN DETECTED\]\s+([a-zA-Z0-9]+)/i,
  tokenBought: /\[BUY SUCCESS\]\s+([a-zA-Z0-9]+)/i,
  tokenRejected: /\[TOKEN REJECTED\]\s+([a-zA-Z0-9]+)\s+Reason: (.+)$/i,
  tokenBlocked: /\[QUALITY FILTER\] Blocked token\s+([a-zA-Z0-9]+)\s+Reason: (.+)$/i,
  tokenSold: /\[SELL SUCCESS\]\s+([a-zA-Z0-9]+)/i,
  
  // Error patterns
  rateLimit: /429|rate limit|too many requests/i,
  reconnect: /reconnect|connection closed/i,
  grpcError: /grpc|connection refused/i,
  
  // NEW: Enhanced metadata error patterns
  metadataQuery: /\[METADATA\]\s+Querying metadata for ([a-zA-Z0-9]+)/i,
  metadataSuccess: /\[METADATA SUCCESS\]\s+([a-zA-Z0-9]+)/i,
  metadataError: /\[METADATA ERROR\]\s+([a-zA-Z0-9]+)\s+(.+)$/i,
  metadataStringSize: /String is the wrong size/i,
  
  // NEW: Safety and quality filter patterns
  safetyCheck: /\[SAFETY CHECK\]\s+([a-zA-Z0-9]+)/i,
  qualityCheck: /\[QUALITY CHECK\]\s+([a-zA-Z0-9]+)\s+(.+)$/i,
  qualityPass: /\[QUALITY PASS\]\s+([a-zA-Z0-9]+)/i,
  safetyBypass: /if\s*\(\s*false\s*\)|safety\s+bypass|bypass\s+detected/i,
  
  // Performance patterns
  poolStatus: /POOL STATUS \(Session (\d+)\):\s+Initial: \$([0-9,.]+)\s+Current: \$([0-9,.]+)/i,
  positionSize: /Position Size: \$([0-9,.]+)/i,
};

// NEW: Pattern matching to detect specific issues
const ERROR_PATTERNS = [
  { pattern: /String is the wrong size/i, name: "STRING_SIZE_ERROR" },
  { pattern: /metadata/i, name: "METADATA_ERROR" },
  { pattern: /if\s*\(\s*false\s*\)|safety\s+bypass|bypass\s+detected/i, name: "SAFETY_BYPASS" },
  { pattern: /quality filter disabled|qualityFilterEnabled: false/i, name: "QUALITY_FILTER_DISABLED" },
  { pattern: /connection\s+reset/i, name: "CONNECTION_RESET" },
  { pattern: /RECONNECT_LOOP: \d+/i, name: "RECONNECT_LOOP_DETECTED" }
];

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",
  
  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    crimson: "\x1b[38m"
  },
  bg: {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m",
    crimson: "\x1b[48m"
  }
};

// Helper functions
function formatDuration(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
}

function getLatestLogFile() {
  try {
    const files = fs.readdirSync(CONFIG.logDir)
      .filter(file => file.endsWith('.log'))
      .map(file => ({
        name: file,
        path: path.join(CONFIG.logDir, file),
        mtime: fs.statSync(path.join(CONFIG.logDir, file)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    return files.length > 0 ? files[0].path : null;
  } catch (err) {
    console.error('Error finding log file:', err.message);
    return null;
  }
}

// Process log file
async function processLogFile(filePath, lastPosition = 0) {
  if (!fs.existsSync(filePath)) {
    console.error(`File does not exist: ${filePath}`);
    return lastPosition;
  }

  const fileSize = fs.statSync(filePath).size;
  
  // If no new content, return current position
  if (fileSize <= lastPosition) {
    return lastPosition;
  }
  
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, {
      start: lastPosition,
      end: fileSize
    });
    
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity
    });
    
    rl.on('line', (line) => {
      stats.totalLines++;
      
      // Check for bot start
      if (PATTERNS.botStart.test(line) && !stats.startTime) {
        stats.startTime = new Date(line.substring(1, 24));
      }
      
      // Check for pattern matches - NEW
      for (const pattern of ERROR_PATTERNS) {
        if (pattern.pattern.test(line)) {
          stats.errors.patternMatches[pattern.name] = (stats.errors.patternMatches[pattern.name] || 0) + 1;
          
          // Check for safety bypass
          if (pattern.name === "SAFETY_BYPASS") {
            stats.safetySystem.bypassDetected = true;
            stats.criticalIssues.push({
              time: new Date().toISOString(),
              message: `⚠️ CRITICAL: Safety bypass detected in log - Bot may be skipping safety checks!`
            });
          }
          
          // Check for quality filter disabled
          if (pattern.name === "QUALITY_FILTER_DISABLED") {
            stats.criticalIssues.push({
              time: new Date().toISOString(),
              message: `⚠️ CRITICAL: Quality filter appears to be disabled!`
            });
          }
        }
      }
      
      // Check for token events
      let match;
      
      if (match = line.match(PATTERNS.tokenDetected)) {
        tokenTracker.recordDetection(match[1]);
      }
      else if (match = line.match(PATTERNS.tokenBought)) {
        tokenTracker.recordBuy(match[1]);
      }
      else if (match = line.match(PATTERNS.tokenRejected)) {
        tokenTracker.recordRejection(match[1], match[2]);
      }
      else if (match = line.match(PATTERNS.tokenBlocked)) {
        tokenTracker.recordBlocked(match[1], match[2]);
      }
      else if (match = line.match(PATTERNS.tokenSold)) {
        tokenTracker.recordSell(match[1]);
      }
      
      // NEW: Check for metadata events
      else if (match = line.match(PATTERNS.metadataQuery)) {
        tokenTracker.recordMetadataQuery(match[1]);
      }
      else if (match = line.match(PATTERNS.metadataSuccess)) {
        tokenTracker.recordMetadataSuccess(match[1]);
      }
      else if (match = line.match(PATTERNS.metadataError)) {
        tokenTracker.recordMetadataFailure(match[1], match[2]);
        
        // Check for string size errors
        if (PATTERNS.metadataStringSize.test(line)) {
          recordError('METADATA_STRING_SIZE', line);
        } else {
          recordError('METADATA_ERROR', line);
        }
      }
      
      // NEW: Check for safety and quality filter events
      else if (match = line.match(PATTERNS.safetyCheck)) {
        tokenTracker.recordSafetyCheck(match[1], true);
      }
      else if (match = line.match(PATTERNS.qualityCheck)) {
        // Default to failed check unless we see a pass
        tokenTracker.recordQualityCheck(match[1], false, match[2]);
      }
      else if (match = line.match(PATTERNS.qualityPass)) {
        tokenTracker.recordQualityCheck(match[1], true);
      }
      
      // Check for errors
      if (PATTERNS.rateLimit.test(line)) {
        recordError('RATE_LIMIT', line);
      }
      else if (PATTERNS.reconnect.test(line)) {
        recordError('RECONNECT', line);
      }
      else if (PATTERNS.grpcError.test(line)) {
        recordError('GRPC_ERROR', line);
      }
      
      // NEW: Check for metadata-specific errors
      if (line.includes('metadata') && (line.includes('error') || line.includes('fail'))) {
        stats.errors.metadataSpecific.push({
          time: new Date().toISOString(),
          message: line.slice(line.indexOf(']') + 1).trim()
        });
        
        // Keep only last 10 metadata errors
        if (stats.errors.metadataSpecific.length > 10) {
          stats.errors.metadataSpecific.shift();
        }
      }
      
      // Check for performance info
      if (match = line.match(PATTERNS.poolStatus)) {
        const session = parseInt(match[1]);
        const initialPool = parseFloat(match[2].replace(/,/g, ''));
        const currentPool = parseFloat(match[3].replace(/,/g, ''));
        
        stats.profit.session = currentPool - initialPool;
      }
      
      // Check for other issues
      if (line.includes('circuit breaker') || line.includes('emergency')) {
        stats.criticalIssues.push({
          time: new Date().toISOString(),
          message: line.slice(line.indexOf(']') + 1).trim()
        });
      }
    });
    
    rl.on('close', () => {
      resolve(fileSize);
    });
    
    rl.on('error', (err) => {
      reject(err);
    });
  });
}

function recordError(type, line) {
  stats.errors.byType[type] = (stats.errors.byType[type] || 0) + 1;
  stats.errors.total++;
  stats.errors.lastErrors.push({
    type,
    message: line.slice(line.indexOf(']') + 1).trim(),
    time: new Date().toISOString()
  });
  
  // Keep only last 5 errors
  if (stats.errors.lastErrors.length > 5) {
    stats.errors.lastErrors.shift();
  }
}

// Analysis functions
function analyzeResults() {
  const currentTime = Date.now();
  const runtime = stats.startTime ? (currentTime - stats.startTime) : (currentTime - stats.lastUpdate);
  
  // Calculate rates
  const detectionRate = stats.tokens.detected / (runtime / 1000 / 60 / 60);
  const buyRate = stats.buys.successful / (runtime / 1000 / 60 / 60);
  
  // NEW: Check for metadata issues
  if (stats.metadata.queries > 0 && stats.metadata.successes === 0) {
    stats.warnings.push("⚠️ Metadata system may be broken - No successful metadata queries");
  }
  
  if (stats.metadata.stringSizeErrors > 0) {
    stats.warnings.push(`⚠️ STRING_SIZE errors detected (${stats.metadata.stringSizeErrors}) - Potential metadata monitor issue`);
  }
  
  // NEW: Check for quality filter issues
  if (!stats.qualityFilter.active && stats.tokens.detected > 20) {
    stats.warnings.push("⚠️ Quality filter appears to be inactive - No quality checks detected");
  }
  
  // NEW: Check for safety system issues
  if (!stats.safetySystem.active && stats.tokens.detected > 20) {
    stats.warnings.push("⚠️ Safety system appears to be inactive - No safety checks detected");
  }
  
  if (stats.safetySystem.bypassDetected) {
    stats.warnings.push("⚠️ CRITICAL: Safety bypass detected - Bot may be buying unsafe tokens");
  }
  
  // Identify issues
  if (stats.tokens.rejected === 0 && stats.tokens.detected > 20) {
    stats.warnings.push("⚠️ No tokens rejected - quality filter may be disabled");
  }
  
  if (stats.tokens.blocked === 0 && stats.tokens.detected > 20) {
    stats.warnings.push("⚠️ No tokens blocked - safety checks may be bypassed");
  }
  
  if (stats.buys.successful > stats.tokens.uniqueBought.size * 3) {
    stats.warnings.push(`⚠️ High duplicate purchase rate: ${(stats.buys.successful / stats.tokens.uniqueBought.size).toFixed(1)}x per token`);
  }
  
  if (stats.errors.byType['RATE_LIMIT'] > 50) {
    stats.warnings.push(`⚠️ High rate limit errors: ${stats.errors.byType['RATE_LIMIT']} - API usage too aggressive`);
  }
  
  if (stats.tokens.uniqueSold.size === 0 && stats.tokens.uniqueBought.size > 10) {
    stats.warnings.push("⚠️ No tokens sold yet despite multiple purchases");
  }
  
  // Deduplicate warnings
  stats.warnings = [...new Set(stats.warnings)];

  return {
    runtime,
    detectionRate,
    buyRate
  };
}

// Display functions
function clearScreen() {
  process.stdout.write('\x1Bc');
}

function displayHeader(runtime) {
  const timeStr = formatDuration(runtime);
  console.log(`${colors.bg.blue}${colors.fg.white}${colors.bright} SOL-BOT MONITOR V2 - Runtime: ${timeStr} ${colors.reset}`);
  console.log(`${colors.fg.cyan}Log Directory: ${CONFIG.logDir} | Last Update: ${new Date().toLocaleTimeString()}${colors.reset}\n`);
}

function displayErrorSummary() {
  console.log(`${colors.fg.yellow}${colors.bright}=== ERROR SUMMARY ===${colors.reset}`);
  console.log(`Total Errors: ${stats.errors.total}`);
  
  Object.entries(stats.errors.byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`- ${type}: ${count}`);
    });
  
  // NEW: Pattern matches
  if (Object.keys(stats.errors.patternMatches).length > 0) {
    console.log(`\n${colors.fg.yellow}Error Patterns Detected:${colors.reset}`);
    Object.entries(stats.errors.patternMatches)
      .sort((a, b) => b[1] - a[1])
      .forEach(([pattern, count]) => {
        const color = pattern.includes('SAFETY_BYPASS') || pattern.includes('QUALITY_FILTER_DISABLED') ? 
          colors.fg.red + colors.bright : colors.fg.yellow;
        console.log(`- ${color}${pattern}: ${count}${colors.reset}`);
      });
  }
  
  if (stats.errors.lastErrors.length > 0) {
    console.log(`\n${colors.fg.red}Recent Errors:${colors.reset}`);
    stats.errors.lastErrors.forEach(err => {
      console.log(`- ${err.type}: ${err.message.substring(0, 60)}...`);
    });
  }
  
  console.log();
}

function displayTokenStats(runtime) {
  const detectionRate = (stats.tokens.detected / (runtime / 1000 / 60 / 60)).toFixed(1);
  
  console.log(`${colors.fg.green}${colors.bright}=== TOKEN STATS ===${colors.reset}`);
  console.log(`Tokens Detected: ${stats.tokens.detected} (${detectionRate}/hour)`);
  console.log(`Tokens Bought: ${stats.tokens.bought} (Unique: ${stats.tokens.uniqueBought.size})`);
  console.log(`Tokens Rejected: ${stats.tokens.rejected}`);
  console.log(`Tokens Blocked: ${stats.tokens.blocked}`);
  console.log(`Tokens Sold: ${stats.tokens.sold} (Unique: ${stats.tokens.uniqueSold.size})`);
  console.log(`Duplicate Purchase Ratio: ${(stats.buys.successful / Math.max(1, stats.tokens.uniqueBought.size)).toFixed(2)}x per token`);
  
  // Multi-purchase tokens
  const multiPurchase = tokenTracker.getMultiPurchaseTokens();
  if (multiPurchase.length > 0) {
    console.log(`\n${colors.fg.yellow}Top Multi-Purchase Tokens:${colors.reset}`);
    multiPurchase.forEach(token => {
      console.log(`- ${token.mint}: ${token.buyCount} buys, ${token.sellCount} sells`);
    });
  }
  
  // Profitable tokens
  const profitable = tokenTracker.getProfitableTokens();
  if (profitable.length > 0) {
    console.log(`\n${colors.fg.green}Top Profitable Tokens:${colors.reset}`);
    profitable.forEach(token => {
      console.log(`- ${token.mint}: $${token.profit}`);
    });
  }
  
  console.log();
}

// NEW: Display metadata stats
function displayMetadataStats() {
  console.log(`${colors.fg.magenta}${colors.bright}=== METADATA SYSTEM STATUS ===${colors.reset}`);
  
  // Show quick status with color indicator
  const metadataStatus = stats.metadata.successes > 0 ? 
    `${colors.fg.green}WORKING${colors.reset}` : 
    `${colors.fg.red}PROBLEMATIC${colors.reset}`;
  
  console.log(`Status: ${metadataStatus}`);
  console.log(`Queries: ${stats.metadata.queries}`);
  console.log(`Successes: ${stats.metadata.successes}`);
  console.log(`Failures: ${stats.metadata.failures}`);
  console.log(`STRING_SIZE Errors: ${stats.metadata.stringSizeErrors}`);
  
  // Show tokens with metadata issues
  const problematicTokens = tokenTracker.getTokensWithMetadataFailures();
  if (problematicTokens.length > 0) {
    console.log(`\n${colors.fg.yellow}Tokens with Metadata Issues:${colors.reset}`);
    problematicTokens.forEach(token => {
      console.log(`- ${token.mint}: ${token.failures}/${token.queries} failed`);
      if (token.error.includes('String is the wrong size')) {
        console.log(`  ${colors.fg.red}Error: STRING_SIZE error${colors.reset}`);
      } else {
        console.log(`  Error: ${token.error.substring(0, 40)}...`);
      }
    });
  }
  
  console.log();
}

// NEW: Display quality filter stats
function displayQualityFilterStats() {
  console.log(`${colors.fg.cyan}${colors.bright}=== TOKEN QUALITY FILTER STATUS ===${colors.reset}`);
  
  // Show quick status with color indicator
  const filterStatus = stats.qualityFilter.active ? 
    `${colors.fg.green}ACTIVE${colors.reset}` : 
    `${colors.fg.red}INACTIVE/BYPASSED${colors.reset}`;
  
  console.log(`Status: ${filterStatus}`);
  console.log(`Checks Run: ${stats.qualityFilter.checksRun}`);
  console.log(`Tokens Passed: ${stats.qualityFilter.tokensPassed}`);
  console.log(`Tokens Blocked: ${stats.qualityFilter.tokensBlocked}`);
  
  // Show block/rejection reasons
  if (Object.keys(stats.tokens.blockReasons).length > 0) {
    console.log(`\n${colors.fg.yellow}Block Reasons:${colors.reset}`);
    Object.entries(stats.tokens.blockReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([reason, count]) => {
        console.log(`- ${reason}: ${count} tokens`);
      });
  }
  
  if (Object.keys(stats.tokens.rejectionReasons).length > 0) {
    console.log(`\n${colors.fg.yellow}Rejection Reasons:${colors.reset}`);
    Object.entries(stats.tokens.rejectionReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([reason, count]) => {
        console.log(`- ${reason}: ${count} tokens`);
      });
  }
  
  console.log();
}

function displayWarnings() {
  if (stats.warnings.length > 0) {
    console.log(`${colors.fg.red}${colors.bright}=== WARNINGS ===${colors.reset}`);
    stats.warnings.forEach(warning => {
      console.log(warning);
    });
    console.log();
  }
  
  if (stats.criticalIssues.length > 0) {
    console.log(`${colors.bg.red}${colors.fg.white}${colors.bright} CRITICAL ISSUES ${colors.reset}`);
    stats.criticalIssues.forEach(issue => {
      console.log(`- ${issue.message}`);
    });
    console.log();
  }
}

function displayMilestones(runtime) {
  console.log(`${colors.fg.magenta}${colors.bright}=== MILESTONES ===${colors.reset}`);
  console.log(`6-minute mark: ${runtime >= 6*60*1000 ? '✅ PASSED' : '⏳ Waiting'}`);
  console.log(`15-minute mark: ${runtime >= 15*60*1000 ? '✅ PASSED' : '⏳ Waiting'}`);
  console.log(`20-minute mark: ${runtime >= 20*60*1000 ? '✅ PASSED' : '⏳ Waiting'}`);
  console.log(`30-minute mark: ${runtime >= 30*60*1000 ? '✅ PASSED' : '⏳ Waiting'}`);
  console.log();
}

function displayConclusion(runtime) {
  console.log(`${colors.fg.cyan}${colors.bright}=== MONITOR CONCLUSION ===${colors.reset}`);
  
  if (runtime < 6*60*1000) {
    console.log("⏳ Test still in early stage");
  } else if (stats.safetySystem.bypassDetected) {
    console.log(`${colors.bg.red}${colors.fg.white}⚠️ CRITICAL SAFETY ISSUE: Safety bypass detected${colors.reset}`);
  } else if (stats.metadata.stringSizeErrors > 5) {
    console.log(`${colors.fg.red}⚠️ METADATA STRING_SIZE ISSUES: ${stats.metadata.stringSizeErrors} errors detected${colors.reset}`);
  } else if (stats.errors.total > 200) {
    console.log(`${colors.fg.red}⚠️ HIGH ERROR COUNT: ${stats.errors.total} errors detected${colors.reset}`);
  } else if (stats.warnings.length > 0) {
    console.log(`${colors.fg.yellow}⚠️ ISSUES FOUND: ${stats.warnings.length} warnings to address${colors.reset}`);
  } else if (runtime >= 20*60*1000) {
    console.log(`${colors.fg.green}✅ TEST SUCCESSFUL! Bot ran for ${formatDuration(runtime)} without critical issues${colors.reset}`);
  } else {
    console.log(`${colors.fg.yellow}⏳ TEST IN PROGRESS: No critical issues yet${colors.reset}`);
  }
}

// Main monitoring loop
async function monitor() {
  let lastPosition = 0;
  let logFile = null;
  
  const updateLoop = async () => {
    try {
      // Get the latest log file if we don't have one yet or every 5 iterations
      if (!logFile) {
        logFile = getLatestLogFile();
        if (!logFile) {
          console.log("No log file found. Waiting for log file...");
          return;
        } else {
          console.log(`Found log file: ${logFile}`);
        }
      }
      
      // Process log file from last position
      lastPosition = await processLogFile(logFile, lastPosition);
      
      // Analyze results
      const analysis = analyzeResults();
      
      // Update display
      clearScreen();
      displayHeader(analysis.runtime);
      displayErrorSummary();
      displayTokenStats(analysis.runtime);
      
      // NEW: Display enhanced sections
      displayMetadataStats();
      displayQualityFilterStats();
      
      displayWarnings();
      displayMilestones(analysis.runtime);
      displayConclusion(analysis.runtime);
      
      // Auto-exit if test is complete
      if (analysis.runtime >= CONFIG.testDuration) {
        console.log(`\n${colors.bg.green}${colors.fg.black} TEST COMPLETE - MONITOR EXITING ${colors.reset}`);
        
        // Generate report file
        const reportPath = path.join(CONFIG.logDir, `monitor-report-${new Date().toISOString().replace(/:/g, '-')}.txt`);
        
        // Get summary text (capture console output)
        const originalLog = console.log;
        let reportText = '';
        console.log = (...args) => {
          reportText += args.join(' ') + '\n';
        };
        
        // Generate report content
        displayHeader(analysis.runtime);
        displayErrorSummary();
        displayTokenStats(analysis.runtime);
        displayMetadataStats();
        displayQualityFilterStats();
        displayWarnings();
        displayMilestones(analysis.runtime);
        displayConclusion(analysis.runtime);
        
        // Restore console.log
        console.log = originalLog;
        
        // Write report file
        fs.writeFileSync(reportPath, reportText);
        console.log(`Report saved to: ${reportPath}`);
        process.exit(0);
      }
    } catch (err) {
      console.error('Monitoring error:', err);
    } finally {
      stats.lastUpdate = Date.now();
      setTimeout(updateLoop, CONFIG.refreshRate);
    }
  };
  
  updateLoop();
}

// Start monitoring
console.log("SOL-BOT Monitor V2 starting...");
console.log(`Looking for logs in: ${CONFIG.logDir}`);
console.log("Press Ctrl+C to exit");
monitor();