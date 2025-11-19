# SOL-BOT V2 Enhanced Monitor Launcher
# Simple PowerShell script to run the monitor with proper log directory setup

param(
    [string]$LogDirectory = ".\monitor-logs"
)

# Script configuration
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) {
    $ScriptDir = Get-Location
}

$MonitorScript = Join-Path $ScriptDir "sol-bot-monitor-v2-enhanced.js"

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  SOL-BOT V2 ENHANCED MONITOR" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is available
Write-Host "Checking Node.js..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK - Node.js found: $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "ERROR - Node.js not found in PATH" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR - Node.js is not installed" -ForegroundColor Red
    exit 1
}

# Check if monitor script exists
Write-Host "Checking monitor script..." -ForegroundColor Cyan
if (-not (Test-Path $MonitorScript)) {
    Write-Host "ERROR - Monitor script not found" -ForegroundColor Red
    Write-Host "Expected: $MonitorScript" -ForegroundColor Yellow
    exit 1
}
Write-Host "OK - Monitor script found" -ForegroundColor Green

# Create log directory if needed
Write-Host "Setting up log directory..." -ForegroundColor Cyan
$absoluteLogPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($LogDirectory)

if (-not (Test-Path $absoluteLogPath)) {
    try {
        New-Item -Path $absoluteLogPath -ItemType Directory -Force | Out-Null
        Write-Host "OK - Created log directory" -ForegroundColor Green
    } catch {
        Write-Host "ERROR - Failed to create log directory" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "OK - Log directory exists" -ForegroundColor Green
}

Write-Host "Log path: $absoluteLogPath" -ForegroundColor White
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# Run the monitor
try {
    Push-Location $ScriptDir
    $env:MONITOR_LOG_DIR = $absoluteLogPath
    node $MonitorScript
    Pop-Location
} catch {
    Write-Host ""
    Write-Host "ERROR - Monitor execution failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
