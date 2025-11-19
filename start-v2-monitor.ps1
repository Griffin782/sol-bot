#Requires -Version 5.1
<#
.SYNOPSIS
    Starts the SOL-BOT V2 Enhanced Monitor

.DESCRIPTION
    Launches the sol-bot-monitor-v2-enhanced.js script with proper log directory setup
    and displays a startup banner showing enabled features.

.PARAMETER LogDirectory
    Optional path to the log directory. Defaults to ".\monitor-logs"

.EXAMPLE
    .\start-v2-monitor.ps1
    Uses default log directory (.\monitor-logs)

.EXAMPLE
    .\start-v2-monitor.ps1 "C:\Users\Administrator\Desktop\IAM\sol-bot-main\monitor-logs"
    Uses specified log directory

.NOTES
    Version: 2.0
    Date: November 11, 2025
    Author: SOL-BOT Team
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$LogDirectory = ".\monitor-logs"
)

# ============================================================================
# CONFIGURATION
# ============================================================================

# Set error action preference to stop on errors
$ErrorActionPreference = "Stop"

# Get script directory (where this .ps1 file is located)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ScriptDir) {
    $ScriptDir = Get-Location
}

# Path to the monitor script (relative to script directory)
$MonitorScript = Join-Path $ScriptDir "src\monitoring\sol-bot-monitor-v2-enhanced.js"

# ============================================================================
# FUNCTIONS
# ============================================================================

function Write-Banner {
    <#
    .SYNOPSIS
        Displays a colorful startup banner
    #>

    $width = 70
    $line = "=" * $width

    Write-Host ""
    Write-Host $line -ForegroundColor Cyan
    Write-Host "  SOL-BOT V2 ENHANCED MONITOR" -ForegroundColor Yellow
    Write-Host $line -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Features:" -ForegroundColor White
    Write-Host "    `[✓`] Metadata Error Detection" -ForegroundColor Green
    Write-Host "    `[✓`] Token Quality Filter Analysis" -ForegroundColor Green
    Write-Host "    `[✓`] Safety System Verification" -ForegroundColor Green
    Write-Host ""
    Write-Host $line -ForegroundColor Cyan
    Write-Host ""
}

function Test-Prerequisites {
    <#
    .SYNOPSIS
        Checks if Node.js is installed and the monitor script exists
    #>

    Write-Host "`[CHECK`] Verifying prerequisites..." -ForegroundColor Cyan

    # Check if Node.js is installed
    try {
        $nodeVersion = node --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`[OK`] Node.js found: $nodeVersion" -ForegroundColor Green
        } else {
            throw "Node.js not found"
        }
    } catch {
        Write-Host "`[ERROR`] Node.js is not installed or not in PATH" -ForegroundColor Red
        Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
        exit 1
    }

    # Check if monitor script exists
    if (-not (Test-Path $MonitorScript)) {
        Write-Host "`[ERROR`] Monitor script not found at: $MonitorScript" -ForegroundColor Red
        Write-Host "Expected location: $MonitorScript" -ForegroundColor Yellow
        exit 1
    }

    Write-Host "`[OK`] Monitor script found" -ForegroundColor Green
    Write-Host ""
}

function Initialize-LogDirectory {
    <#
    .SYNOPSIS
        Creates the log directory if it doesn't exist
    #>
    param(
        [string]$Path
    )

    Write-Host "`[SETUP`] Configuring log directory..." -ForegroundColor Cyan

    # Resolve to absolute path
    $absolutePath = Resolve-Path $Path -ErrorAction SilentlyContinue
    if (-not $absolutePath) {
        # Path doesn't exist yet, try to create it
        $absolutePath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
    }

    # Create directory if it doesn't exist
    if (-not (Test-Path $absolutePath)) {
        try {
            New-Item -Path $absolutePath -ItemType Directory -Force | Out-Null
            Write-Host "`[OK`] Created log directory: $absolutePath" -ForegroundColor Green
        } catch {
            Write-Host "`[ERROR`] Failed to create log directory: $absolutePath" -ForegroundColor Red
            $errorMsg = $_.Exception.Message
    Write-Host "Error: $errorMsg" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "`[OK`] Log directory exists: $absolutePath" -ForegroundColor Green
    }

    # Set environment variable for the monitor script to use
    $env:MONITOR_LOG_DIR = $absolutePath
    Write-Host "`[INFO`] Log directory set to: $absolutePath" -ForegroundColor White
    Write-Host ""

    return $absolutePath
}

function Start-Monitor {
    <#
    .SYNOPSIS
        Launches the monitor script using Node.js
    #>
    param(
        [string]$ScriptPath,
        [string]$LogDir
    )

    Write-Host "`[START`] Launching SOL-BOT V2 Enhanced Monitor..." -ForegroundColor Cyan
    Write-Host "`[INFO`] Monitor script: $ScriptPath" -ForegroundColor White
    Write-Host "`[INFO`] Log directory: $LogDir" -ForegroundColor White
    Write-Host ""
    Write-Host $("=" * 70) -ForegroundColor Cyan
    Write-Host ""

    # Change to script directory for proper module resolution
    Push-Location $ScriptDir

    try {
        # Run the monitor script with Node.js
        # Pass log directory as environment variable
        node $ScriptPath

        # Capture exit code
        $exitCode = $LASTEXITCODE

        Write-Host ""
        Write-Host $("=" * 70) -ForegroundColor Cyan

        if ($exitCode -eq 0) {
            Write-Host "`[OK`] Monitor exited successfully" -ForegroundColor Green
        } else {
            Write-Host "`[ERROR`] Monitor exited with code: $exitCode" -ForegroundColor Red
        }

    } catch {
        Write-Host ""
        Write-Host $("=" * 70) -ForegroundColor Cyan
        Write-Host "`[ERROR`] Failed to run monitor script" -ForegroundColor Red
        $errorMsg = $_.Exception.Message
    Write-Host "Error: $errorMsg" -ForegroundColor Red
        exit 1
    } finally {
        # Return to original directory
        Pop-Location
    }
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

try {
    # Display banner
    Write-Banner

    # Check prerequisites (Node.js, script exists)
    Test-Prerequisites

    # Initialize log directory
    $resolvedLogDir = Initialize-LogDirectory -Path $LogDirectory

    # Start the monitor
    Start-Monitor -ScriptPath $MonitorScript -LogDir $resolvedLogDir

} catch {
    Write-Host ""
    Write-Host "`[FATAL ERROR`] An unexpected error occurred" -ForegroundColor Red
    $errorMsg = $_.Exception.Message
    Write-Host "Error: $errorMsg" -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Exit with success
exit 0
