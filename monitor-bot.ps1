# Save this as monitor-bot.ps1
@'
while ($true) {
    Clear-Host
    Write-Host "🤖 SOL-BOT LIVE MONITOR - $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Cyan
    Write-Host ("=" * 50) -ForegroundColor Gray
    
    # Pool status
    if (Test-Path "data\pool_transactions.csv") {
        $poolData = Import-Csv "data\pool_transactions.csv" -ErrorAction SilentlyContinue
        if ($poolData -and $poolData.Count -gt 0) {
            $lastEntry = $poolData[-1]
            $trades = @($poolData | Where-Object {$_.type -eq 'TRADE' -or $_.type -eq 'BUY'}).Count
            $startPool = 600
            $currentPool = [decimal]$lastEntry.poolAfter
            $pnl = $currentPool - $startPool
            $roi = if($startPool -gt 0) {($pnl / $startPool * 100)} else {0}
            
            Write-Host "`n💰 POOL:" -ForegroundColor Green
            Write-Host ("   Current: ${0:C2}" -f $currentPool) -ForegroundColor Yellow
            Write-Host ("   P&L: ${0:C2} ({1:F1}% ROI)" -f $pnl, $roi) -ForegroundColor $(if($pnl -ge 0){"Green"}else{"Red"})
            Write-Host "   Trades: $trades" -ForegroundColor Yellow
            
            # Check for withdrawal proximity
            if ($currentPool -gt 6500) {
                Write-Host "   ⚠️ APPROACHING WITHDRAWAL TRIGGER!" -ForegroundColor Magenta
            }
        }
    }
    
    # Token stats
    if (Test-Path "data\pending_tokens.csv") {
        $tokens = (Get-Content "data\pending_tokens.csv" | Measure-Object -Line).Lines - 1
        Write-Host "`n📊 TOKENS: $tokens detected" -ForegroundColor Green
    }
    
    # Duplicate check
    $dupes = 0
    if (Test-Path "data\pending_tokens.csv") {
        $content = Get-Content "data\pending_tokens.csv" | Select-Object -Skip 1
        if ($content) {
            $tokenList = $content | ForEach-Object {
                if($_ -match ',([^,]+),') { $matches[1] }
            }
            if ($tokenList) {
                $unique = @($tokenList | Select-Object -Unique).Count
                $dupes = $tokenList.Count - $unique
            }
        }
    }
    Write-Host "🔍 DUPLICATES: $dupes $(if($dupes -eq 0){'✅'}else{'❌'})" -ForegroundColor $(if($dupes -eq 0){"Green"}else{"Red"})
    
    # Withdrawals
    if (Test-Path "wallets\withdrawals.jsonl") {
        $withdrawals = (Get-Content "wallets\withdrawals.jsonl" | Measure-Object -Line).Lines
        Write-Host "🏦 WITHDRAWALS: $withdrawals" -ForegroundColor Cyan
    }
    
    Write-Host "`n" + ("=" * 50) -ForegroundColor Gray
    Start-Sleep -Seconds 15
}
'@ | Out-File -FilePath "monitor-bot.ps1" -Encoding UTF8

Write-Host "✅ Monitor script saved as monitor-bot.ps1" -ForegroundColor Green