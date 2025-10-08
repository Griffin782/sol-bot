# generate-summary.ps1 - Complete Session Summary Report
param(
    [string]$OutputFile = "session_summary_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
)

Write-Host "📊 Generating Final Summary Report..." -ForegroundColor Cyan

$report = @"
============================================================
🏆 SOL-BOT FINAL SESSION SUMMARY REPORT
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
============================================================

"@

# Analyze pool transactions
if (Test-Path "data\pool_transactions.csv") {
    $poolData = Import-Csv "data\pool_transactions.csv" -ErrorAction SilentlyContinue
    
    if ($poolData -and $poolData.Count -gt 0) {
        # Calculate statistics
        $trades = @($poolData | Where-Object {$_.type -match 'TRADE|BUY'})
        $totalTrades = $trades.Count
        
        # Get pool values
        $startPool = if($poolData[0].poolBefore) {[decimal]$poolData[0].poolBefore} else {600}
        $finalPool = [decimal]$poolData[-1].poolAfter
        $poolValues = $poolData | ForEach-Object { [decimal]$_.poolAfter }
        $peakPool = ($poolValues | Measure-Object -Maximum).Maximum
        $lowPool = ($poolValues | Measure-Object -Minimum).Minimum
        
        # Calculate P&L
        $totalPnL = $finalPool - $startPool
        $roi = if($startPool -gt 0) {($totalPnL / $startPool * 100)} else {0}
        $growth = if($startPool -gt 0) {($finalPool / $startPool)} else {0}
        
        # Win/Loss analysis
        $winTrades = @($trades | Where-Object {[decimal]$_.amount -gt 0})
        $lossTrades = @($trades | Where-Object {[decimal]$_.amount -lt 0})
        $winRate = if($totalTrades -gt 0) {($winTrades.Count / $totalTrades * 100)} else {0}
        
        # Calculate averages
        $avgWin = if($winTrades.Count -gt 0) {
            ($winTrades | ForEach-Object {[Math]::Abs([decimal]$_.amount)} | Measure-Object -Average).Average
        } else {0}
        
        $avgLoss = if($lossTrades.Count -gt 0) {
            ($lossTrades | ForEach-Object {[Math]::Abs([decimal]$_.amount)} | Measure-Object -Average).Average
        } else {0}
        
        # Time analysis
        $firstTime = [DateTime]::Parse($poolData[0].timestamp)
        $lastTime = [DateTime]::Parse($poolData[-1].timestamp)
        $runtime = $lastTime - $firstTime
        
        $report += @"
💰 POOL PERFORMANCE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Initial Pool:        `$$($startPool.ToString('F2'))
Final Pool:          `$$($finalPool.ToString('F2'))
Peak Pool:           `$$($peakPool.ToString('F2'))
Lowest Pool:         `$$($lowPool.ToString('F2'))
Total P&L:           `$$($totalPnL.ToString('F2')) ($($roi.ToString('F1'))% ROI)
Growth Multiplier:   $($growth.ToString('F2'))x
Runtime:             $($runtime.Hours)h $($runtime.Minutes)m $($runtime.Seconds)s

📊 TRADING STATISTICS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Trades:        $totalTrades
Winning Trades:      $($winTrades.Count)
Losing Trades:       $($lossTrades.Count)
Win Rate:            $($winRate.ToString('F1'))%
Average Win:         `$$($avgWin.ToString('F2'))
Average Loss:        `$$($avgLoss.ToString('F2'))
Avg Trade Value:     `$$((($avgWin * $winTrades.Count) - ($avgLoss * $lossTrades.Count)) / $totalTrades)

"@
    }
}

# Analyze tokens
if (Test-Path "data\pending_tokens.csv") {
    $tokenData = Get-Content "data\pending_tokens.csv" | Select-Object -Skip 1
    $totalTokens = $tokenData.Count
    
    # Check for duplicates
    $tokenMints = $tokenData | ForEach-Object {
        if($_ -match ',([^,]+),') { $matches[1] }
    }
    $uniqueTokens = @($tokenMints | Select-Object -Unique).Count
    $duplicates = $totalTokens - $uniqueTokens
    
    $report += @"
🎯 TOKEN ANALYSIS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tokens Detected:     $totalTokens
Unique Tokens:       $uniqueTokens
Duplicate Attempts:  $duplicates $(if($duplicates -eq 0){'✅ NONE'}else{'❌ ERROR'})

"@
}

# Check withdrawals
if (Test-Path "wallets\withdrawals.jsonl") {
    $withdrawals = Get-Content "wallets\withdrawals.jsonl" | ForEach-Object {
        $_ | ConvertFrom-Json
    }
    $totalWithdrawals = $withdrawals.Count
    $totalSecured = ($withdrawals | ForEach-Object {$_.toHardware} | Measure-Object -Sum).Sum
    $totalTaxes = ($withdrawals | ForEach-Object {$_.toTaxes} | Measure-Object -Sum).Sum
    
    $report += @"
🏦 WITHDRAWAL SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Withdrawals:   $totalWithdrawals
Amount Secured:      `$$totalSecured
Tax Reserved:        `$$totalTaxes

"@
}

# Performance metrics
$report += @"
🎯 PERFORMANCE METRICS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"@

# Check for errors or warnings
$errors = @()
$warnings = @()

# Check win rate
if ($winRate -lt 50) {
    $warnings += "⚠️ Win rate below 50% ($($winRate.ToString('F1'))%)"
} elseif ($winRate -gt 100) {
    $errors += "❌ Win rate calculation error (>100%)"
}

# Check for duplicates
if ($duplicates -gt 0) {
    $errors += "❌ Duplicate tokens detected: $duplicates"
}

# Check pool consistency
if ($finalPool -lt 0) {
    $errors += "❌ Negative pool balance"
}

# Check for data issues
$poolLines = (Get-Content "data\pool_transactions.csv").Count
if ($poolLines -le 1) {
    $errors += "❌ No trading data found"
}

# Display errors and warnings
if ($errors.Count -gt 0) {
    $report += "`n❌ ERRORS FOUND:`n"
    $errors | ForEach-Object { $report += "   $_`n" }
}

if ($warnings.Count -gt 0) {
    $report += "`n⚠️ WARNINGS:`n"
    $warnings | ForEach-Object { $report += "   $_`n" }
}

if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    $report += "✅ All metrics within normal parameters`n"
}

# Final verdict
$report += @"

============================================================
📋 FINAL VERDICT:
============================================================
"@

if ($errors.Count -eq 0) {
    if ($roi -gt 100 -and $winRate -gt 60 -and $duplicates -eq 0) {
        $report += @"
✅ EXCELLENT PERFORMANCE - Ready for extended testing
   - Strong ROI: $($roi.ToString('F1'))%
   - Good win rate: $($winRate.ToString('F1'))%
   - No duplicate issues
   - Clean data integrity
"@
    } elseif ($roi -gt 0 -and $duplicates -eq 0) {
        $report += @"
✅ ACCEPTABLE PERFORMANCE - Minor improvements needed
   - Positive ROI: $($roi.ToString('F1'))%
   - Win rate: $($winRate.ToString('F1'))%
   - No critical issues
"@
    } else {
        $report += @"
⚠️ NEEDS OPTIMIZATION - Review settings
   - ROI: $($roi.ToString('F1'))%
   - Win rate: $($winRate.ToString('F1'))%
   - Consider adjusting parameters
"@
    }
} else {
    $report += @"
❌ CRITICAL ISSUES DETECTED - NOT READY
   - $($errors.Count) errors found
   - Must fix before live trading
   - Review error details above
"@
}

$report += @"

============================================================
Report saved to: $OutputFile
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
============================================================
"@

# Save report
$report | Out-File -FilePath $OutputFile -Encoding UTF8

# Display report
Write-Host $report

# Also save as JSON for programmatic access
$jsonReport = @{
    timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    pool = @{
        initial = $startPool
        final = $finalPool
        peak = $peakPool
        low = $lowPool
        pnl = $totalPnL
        roi = $roi
        growth = $growth
    }
    trading = @{
        totalTrades = $totalTrades
        wins = $winTrades.Count
        losses = $lossTrades.Count
        winRate = $winRate
        avgWin = $avgWin
        avgLoss = $avgLoss
    }
    tokens = @{
        detected = $totalTokens
        unique = $uniqueTokens
        duplicates = $duplicates
    }
    runtime = @{
        hours = $runtime.Hours
        minutes = $runtime.Minutes
        seconds = $runtime.Seconds
    }
    errors = $errors
    warnings = $warnings
    verdict = if($errors.Count -eq 0){"READY"}else{"NOT READY"}
}

$jsonReport | ConvertTo-Json -Depth 10 | Out-File -FilePath "session_summary_$(Get-Date -Format 'yyyyMMdd_HHmmss').json" -Encoding UTF8

Write-Host "`n✅ Summary report generated successfully!" -ForegroundColor Green
Write-Host "📁 Files created:" -ForegroundColor Cyan
Write-Host "   - $OutputFile (text report)" -ForegroundColor Yellow
Write-Host "   - session_summary_$(Get-Date -Format 'yyyyMMdd_HHmmss').json (JSON data)" -ForegroundColor Yellow