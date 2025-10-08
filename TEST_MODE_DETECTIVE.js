const fs = require('fs');
const path = require('path');

console.log('🕵️ TEST MODE DETECTIVE - Starting Investigation...\n');

// Patterns to search for
const testModePatterns = [
    /TEST_MODE/gi,
    /test_mode/gi,
    /testMode/gi,
    /PAPER/gi,
    /paper/gi,
    /if\s*\(\s*false\s*\)/gi,
    /if\s*\(false\)/gi,
    /simulation/gi,
    /simulate/gi,
    /IS_TEST_MODE/gi,
    /z_testMode/gi,
    /\.testMode/gi,
    /hardcoded.*true/gi,
    /override.*test/gi,
    /force.*test/gi,
    /sledgehammer/gi
];

// Critical files to check first
const criticalFiles = [
    'src/index.ts',
    'src/secure-pool-system.ts',
    'src/utils/handlers/jupiterHandler.ts',
    'src/core/UNIFIED-CONTROL.ts',
    'src/config.ts',
    'src/z-new-controls/z-masterConfig.ts',
    'src/enhanced/masterConfig.ts',
    'src/botController.ts'
];

const results = {
    testModeSettings: [],
    testModeChecks: [],
    suspiciousBlocks: [],
    hardcodedValues: []
};

function scanFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            const lineNum = index + 1;
            const trimmedLine = line.trim();

            // Skip empty lines and pure comments
            if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) return;

            testModePatterns.forEach(pattern => {
                if (pattern.test(line)) {
                    const context = {
                        file: filePath,
                        line: lineNum,
                        code: line.trim(),
                        before: lines.slice(Math.max(0, index - 2), index).map(l => l.trim()),
                        after: lines.slice(index + 1, Math.min(lines.length, index + 3)).map(l => l.trim())
                    };

                    // Categorize the finding
                    if (line.includes('=') && (line.includes('true') || line.includes('false'))) {
                        results.testModeSettings.push(context);
                    } else if (line.includes('if') && line.includes('TEST_MODE')) {
                        results.testModeChecks.push(context);
                    } else if (line.includes('if (false)') || line.includes('if(false)')) {
                        results.suspiciousBlocks.push(context);
                    } else if (line.includes('true') && (line.includes('TEST') || line.includes('test'))) {
                        results.hardcodedValues.push(context);
                    } else {
                        results.testModeSettings.push(context); // Default bucket
                    }
                }
            });
        });
    } catch (error) {
        console.log(`❌ Error scanning ${filePath}: ${error.message}`);
    }
}

function scanDirectory(dir) {
    try {
        const files = fs.readdirSync(dir);

        files.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                scanDirectory(fullPath);
            } else if (file.endsWith('.ts') || file.endsWith('.js')) {
                scanFile(fullPath);
            }
        });
    } catch (error) {
        console.log(`❌ Error scanning directory ${dir}: ${error.message}`);
    }
}

function printResults() {
    console.log('='.repeat(60));
    console.log('🚨 TEST MODE OVERRIDES FOUND 🚨');
    console.log('='.repeat(60));

    // Print critical files first
    console.log('\n🎯 CRITICAL FILES ANALYSIS:');
    criticalFiles.forEach(criticalFile => {
        const foundInFile = [...results.testModeSettings, ...results.testModeChecks,
                           ...results.suspiciousBlocks, ...results.hardcodedValues]
            .filter(r => r.file.includes(criticalFile.replace('src/', '')));

        if (foundInFile.length > 0) {
            console.log(`\n📁 ${criticalFile}:`);
            foundInFile.forEach(result => {
                console.log(`   Line ${result.line}: ${result.code}`);
                if (result.code.includes('=') && (result.code.includes('true') || result.code.includes('false'))) {
                    console.log(`   🚨 POTENTIAL OVERRIDE: This line sets a test mode value!`);
                }
            });
        } else {
            console.log(`\n📁 ${criticalFile}: ✅ Clean`);
        }
    });

    // Print all findings by category
    if (results.testModeSettings.length > 0) {
        console.log('\n🔧 TEST MODE SETTINGS:');
        results.testModeSettings.forEach(result => {
            console.log(`File: ${result.file}`);
            console.log(`Line ${result.line}: ${result.code}`);
            console.log(`Context Before: ${result.before.join(' | ')}`);
            console.log(`Context After: ${result.after.join(' | ')}`);
            console.log(`Analysis: ${analyzeTestModeLine(result.code)}`);
            console.log('-'.repeat(40));
        });
    }

    if (results.testModeChecks.length > 0) {
        console.log('\n🔍 TEST MODE CHECKS:');
        results.testModeChecks.forEach(result => {
            console.log(`File: ${result.file}`);
            console.log(`Line ${result.line}: ${result.code}`);
            console.log(`Context: ${result.before.join(' | ')} | ${result.after.join(' | ')}`);
            console.log('-'.repeat(40));
        });
    }

    if (results.suspiciousBlocks.length > 0) {
        console.log('\n⚠️ SUSPICIOUS BLOCKS:');
        results.suspiciousBlocks.forEach(result => {
            console.log(`File: ${result.file}`);
            console.log(`Line ${result.line}: ${result.code}`);
            console.log(`🚨 POTENTIAL SLEDGEHAMMER: This might force test mode!`);
            console.log('-'.repeat(40));
        });
    }

    if (results.hardcodedValues.length > 0) {
        console.log('\n🔒 HARDCODED VALUES:');
        results.hardcodedValues.forEach(result => {
            console.log(`File: ${result.file}`);
            console.log(`Line ${result.line}: ${result.code}`);
            console.log('-'.repeat(40));
        });
    }

    // Summary and recommendations
    console.log('\n' + '='.repeat(60));
    console.log('📋 INVESTIGATION SUMMARY');
    console.log('='.repeat(60));

    const totalFindings = results.testModeSettings.length + results.testModeChecks.length +
                         results.suspiciousBlocks.length + results.hardcodedValues.length;

    console.log(`Total findings: ${totalFindings}`);
    console.log(`Test mode settings: ${results.testModeSettings.length}`);
    console.log(`Test mode checks: ${results.testModeChecks.length}`);
    console.log(`Suspicious blocks: ${results.suspiciousBlocks.length}`);
    console.log(`Hardcoded values: ${results.hardcodedValues.length}`);

    // Find the most likely culprit
    console.log('\n🎯 LIKELY CULPRITS:');
    const culprits = [...results.testModeSettings, ...results.suspiciousBlocks]
        .filter(r => r.code.includes('true') || r.code.includes('if (false)'))
        .sort((a, b) => {
            // Prioritize critical files
            const aIsCritical = criticalFiles.some(cf => a.file.includes(cf.replace('src/', '')));
            const bIsCritical = criticalFiles.some(cf => b.file.includes(cf.replace('src/', '')));
            if (aIsCritical && !bIsCritical) return -1;
            if (!aIsCritical && bIsCritical) return 1;
            return 0;
        });

    if (culprits.length > 0) {
        console.log('\n🚨 TOP SUSPECTS (CHANGE THESE LINES):');
        culprits.slice(0, 5).forEach((culprit, index) => {
            console.log(`${index + 1}. ${culprit.file}:${culprit.line}`);
            console.log(`   Code: ${culprit.code}`);
            console.log(`   Action: ${getRecommendedAction(culprit.code)}`);
            console.log('');
        });
    } else {
        console.log('🤔 No obvious culprits found. Check .env file and config imports.');
    }
}

function analyzeTestModeLine(line) {
    if (line.includes('= true') && line.toLowerCase().includes('test')) {
        return '🚨 FORCES TEST MODE ON!';
    }
    if (line.includes('= false') && line.toLowerCase().includes('test')) {
        return '✅ Should enable live mode';
    }
    if (line.includes('if (false)')) {
        return '⚠️ Dead code or sledgehammer override';
    }
    return '🔍 Needs investigation';
}

function getRecommendedAction(line) {
    if (line.includes('= true') && line.toLowerCase().includes('test')) {
        return 'Change true → false';
    }
    if (line.includes('if (false)')) {
        return 'Change false → true or remove condition';
    }
    return 'Review logic';
}

// Start the investigation
console.log('🔍 Scanning critical files first...');
criticalFiles.forEach(file => {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
        scanFile(fullPath);
    }
});

console.log('🔍 Scanning all source files...');
scanDirectory(path.join(process.cwd(), 'src'));

printResults();