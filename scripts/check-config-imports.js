#!/usr/bin/env node
// check-config-imports.js - Scans codebase for deprecated config usage
// Run with: node scripts/check-config-imports.js

const fs = require('fs');
const path = require('path');

const DEPRECATED_PATTERNS = [
  'enhanced/masterConfig',
  'src/enhanced/masterConfig',
  './enhanced/masterConfig',
  '../enhanced/masterConfig',
  'masterConfig.runtime',
  'masterConfig.pool',
  'masterConfig.entry',
  'config.runtime',
  'config.pool'
];

const VALID_PATTERN = 'z-new-controls/z-masterConfig';

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const issues = [];

    DEPRECATED_PATTERNS.forEach(pattern => {
      if (content.includes(pattern)) {
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes(pattern)) {
            issues.push({
              file: filePath,
              line: index + 1,
              pattern: pattern,
              content: line.trim()
            });
          }
        });
      }
    });

    return issues;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return [];
  }
}

function scanDirectory(dir, issues = []) {
  const items = fs.readdirSync(dir);

  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !['node_modules', '.git', 'dist', 'build'].includes(item)) {
      scanDirectory(fullPath, issues);
    } else if (stat.isFile() && ['.ts', '.js', '.tsx', '.jsx'].includes(path.extname(item))) {
      const fileIssues = scanFile(fullPath);
      issues.push(...fileIssues);
    }
  });

  return issues;
}

function main() {
  console.log('🔍 Scanning for deprecated config imports...\n');

  const projectRoot = path.join(__dirname, '..');
  const issues = scanDirectory(projectRoot);

  if (issues.length === 0) {
    console.log('✅ No deprecated config imports found!');
    console.log(`✅ All files should use: ${VALID_PATTERN}`);
    return;
  }

  console.log(`🚨 Found ${issues.length} deprecated config usage(s):\n`);

  const groupedByFile = issues.reduce((acc, issue) => {
    if (!acc[issue.file]) acc[issue.file] = [];
    acc[issue.file].push(issue);
    return acc;
  }, {});

  Object.entries(groupedByFile).forEach(([file, fileIssues]) => {
    console.log(`📄 ${file.replace(projectRoot, '.')}`);
    fileIssues.forEach(issue => {
      console.log(`   Line ${issue.line}: ${issue.pattern}`);
      console.log(`   Code: ${issue.content}`);
    });
    console.log();
  });

  console.log('🔧 REQUIRED ACTIONS:');
  console.log(`   1. Replace deprecated imports with: ${VALID_PATTERN}`);
  console.log('   2. Update config property names to use z_ prefix (e.g., z_config.z_pool)');
  console.log('   3. Add ConfigValidator.validateConfigUsage() calls');
  console.log('\n❌ Build should FAIL until these are fixed!\n');

  process.exit(1); // Fail the build
}

if (require.main === module) {
  main();
}

module.exports = { scanDirectory, scanFile };