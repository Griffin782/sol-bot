# bot-reset-files.ps1  -USE: .\bot-reset-files.ps1 to reset data files for live trading
# Complete Fresh Start Script for SOL-BOT Live Trading

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  SOL-BOT DATA FILES RESET SCRIPT" -ForegroundColor Yellow
Write-Host "  Creating Fresh Files for Tax Tracking" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

# 1. Create data folder if it doesn't exist
$dataPath = ".\data"
if (!(Test-Path $dataPath)) {
    New-Item -ItemType Directory -Path $dataPath -Force
    Write-Host "Created data folder" -ForegroundColor Green
}

# 2. Create archive folder with timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$archiveDir = ".\data\archive\pre-live-$timestamp"
if (!(Test-Path $archiveDir)) {
    New-Item -ItemType Directory -Path $archiveDir -Force
}

# 3. Archive existing files if they exist
$filesToArchive = @(
    ".\data\pool_transactions.csv",
    ".\data\trading_log.json",
    ".\data\performance_log.csv",
    ".\data\pending_tokens.csv",
    ".\data\sell_transactions.csv",
    ".\data\token_registry.json",
    ".\data\tax_export_2025.csv",
    ".\wallets\rotation_history.json"
)

foreach ($file in $filesToArchive) {
    if (Test-Path $file) {
        $fileName = Split-Path $file -Leaf
        Move-Item $file "$archiveDir\$fileName" -Force -ErrorAction SilentlyContinue
        Write-Host "Archived: $fileName" -ForegroundColor Cyan
    }
}

# 4. Create fresh CSV files with headers

# pool_transactions.csv
$poolHeader = "timestamp,action,amount,balance,poolBalance,tradeCount,details"
$poolHeader | Out-File ".\data\pool_transactions.csv" -Encoding UTF8
Write-Host "Created pool_transactions.csv" -ForegroundColor Green

# performance_log.csv
$perfHeader = "timestamp,metric,value"
$perfHeader | Out-File ".\data\performance_log.csv" -Encoding UTF8
Write-Host "Created performance_log.csv" -ForegroundColor Green

# pending_tokens.csv
$pendingHeader = "tokenMint,signature,timestamp,status,liquidity,volume"
$pendingHeader | Out-File ".\data\pending_tokens.csv" -Encoding UTF8
Write-Host "Created pending_tokens.csv" -ForegroundColor Green

# sell_transactions.csv (for tax tracking)
$sellHeader = "timestamp,tokenMint,buyPrice,sellPrice,quantity,profit,profitPercent,holdTime"
$sellHeader | Out-File ".\data\sell_transactions.csv" -Encoding UTF8
Write-Host "Created sell_transactions.csv" -ForegroundColor Green

# tax_export_2025.csv (IRS-compliant format)
$taxHeader = "Date,Type,TokenSymbol,TokenMint,Quantity,CostBasis,SalePrice,GainLoss,HoldingPeriod,TransactionID"
$taxHeader | Out-File ".\data\tax_export_2025.csv" -Encoding UTF8
Write-Host "Created tax_export_2025.csv" -ForegroundColor Green

# 5. Create fresh JSON files

# trading_log.json
"[]" | Out-File ".\data\trading_log.json" -Encoding UTF8
Write-Host "Created trading_log.json" -ForegroundColor Green

# token_registry.json (keeps track of all tokens traded)
$tokenRegistry = @{
    tokens = @()
    lastUpdated = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
} | ConvertTo-Json
$tokenRegistry | Out-File ".\data\token_registry.json" -Encoding UTF8
Write-Host "Created token_registry.json" -ForegroundColor Green

# 6. Create wallets folder and rotation history
$walletsPath = ".\wallets"
if (!(Test-Path $walletsPath)) {
    New-Item -ItemType Directory -Path $walletsPath -Force
}

$rotationHistory = @{
    rotations = @()
    currentWalletIndex = 1
    totalLifetimeProfit = 0
    totalTaxReserve = 0
    lastRotation = $null
} | ConvertTo-Json
$rotationHistory | Out-File ".\wallets\rotation_history.json" -Encoding UTF8
Write-Host "Created rotation_history.json" -ForegroundColor Green

# 7. Verify files were created
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  FILE VERIFICATION" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

$requiredFiles = @(
    ".\data\pool_transactions.csv",
    ".\data\trading_log.json",
    ".\data\performance_log.csv",
    ".\data\pending_tokens.csv",
    ".\data\sell_transactions.csv",
    ".\data\tax_export_2025.csv",
    ".\wallets\rotation_history.json"
)

$allFilesCreated = $true
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "OK: $(Split-Path $file -Leaf)" -ForegroundColor Green
    } else {
        Write-Host "Missing: $(Split-Path $file -Leaf)" -ForegroundColor Red
        $allFilesCreated = $false
    }
}

if ($allFilesCreated) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "  ALL FILES CREATED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "  Ready for LIVE TRADING" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nNext step: npm run dev" -ForegroundColor Yellow
} else {
    Write-Host "`nSome files missing - check errors above" -ForegroundColor Red
}

# 8. Display current status
Write-Host "`nCurrent Status:" -ForegroundColor Cyan
Write-Host "  - Archive created: $archiveDir" -ForegroundColor White
Write-Host "  - Fresh files ready for live trading" -ForegroundColor White
Write-Host "  - Tax tracking files initialized" -ForegroundColor White
Write-Host "`nTip: Run this script before each trading session for clean data" -ForegroundColor Yellow