param(
    [Parameter(Mandatory=$false)]
    [string]$LogFile = $null
)

# Set default log directory path
$LogDir = "C:\Users\Administrator\Desktop\IAM\sol-bot-main\monitor-logs"

# Show available log files if none specified
if (-not $LogFile) {
    Write-Host ""
    Write-Host "=== Available Log Files ===" -ForegroundColor Cyan
    $files = Get-ChildItem -Path $LogDir -Filter "bot-run-*.log" | 
             Sort-Object LastWriteTime -Descending
    
    if ($files.Count -eq 0) {
        Write-Host "No log files found in $LogDir" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Most recent log files:" -ForegroundColor Yellow
    for ($i = 0; $i -lt [Math]::Min(3, $files.Count); $i++) {
        $file = $files[$i]
        Write-Host "[$i] $($file.Name) - $($file.LastWriteTime) - Size: $([Math]::Round($file.Length/1KB, 2)) KB" -ForegroundColor Green
    }
    
    Write-Host ""
    $choice = Read-Host "Enter number of log file to analyze [0-$(([Math]::Min(3, $files.Count)-1))]"
    
    if ($choice -match '^\d+$' -and [int]$choice -ge 0 -and [int]$choice -lt [Math]::Min(3, $files.Count)) {
        $LogFile = $files[[int]$choice].FullName
    } else {
        Write-Host "Invalid selection. Using most recent file." -ForegroundColor Yellow
        $LogFile = $files[0].FullName
    }
}

# Verify file exists
if (-not (Test-Path $LogFile)) {
    Write-Host "Log file not found: $LogFile" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== SOL-BOT V2 ENHANCED MONITOR ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Analyzing log file: $LogFile" -ForegroundColor Yellow
Write-Host "Size: $([Math]::Round((Get-Item $LogFile).Length/1KB, 2)) KB" -ForegroundColor Yellow
Write-Host "Last modified: $((Get-Item $LogFile).LastWriteTime)" -ForegroundColor Yellow
Write-Host ""

# Run the node script with the specific file
$MonitorScript = ".\sol-bot-monitor-v2-enhanced.js"
if (Test-Path $MonitorScript) {
    Write-Host "Starting analysis... Press Ctrl+C to exit." -ForegroundColor Green
    Write-Host ""
    & node $MonitorScript $LogFile
} else {
    Write-Host "Monitor script not found: $MonitorScript" -ForegroundColor Red
    exit 1
}