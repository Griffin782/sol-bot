# Save this as "VSCodeProcessMonitor.ps1"
# .\VSCodeProcessMonitor.ps1  This will show all VS Code processes but won't kill anything
# .\VSCodeProcessMonitor.ps1 -AutoKill This will kill any VS Code process using more than 500% CPU and reduce total processes to 5.
# .\VSCodeProcessMonitor.ps1 -AutoKill -SafeProcessName "my_bot_name" This will avoid killing any process with "my_bot_name" in its command line.
# .\VSCodeProcessMonitor.ps1 -AutoKill -CPUThreshold 20 -Run this instead - keeps normal processes, kills only high CPU ones
# 

param (
    [switch]$AutoKill = $false,  # Set to true to automatically kill high CPU processes
    [int]$CPUThreshold = 500,    # CPU usage threshold to consider a process problematic
    [int]$MaxProcesses = 5,      # Maximum allowed VS Code processes
    [string]$LogPath = "$env:USERPROFILE\vscode_process_monitor.log",
    [string]$SafeProcessName = "" # Name fragment to protect (e.g., "market_recorder")
)

function Write-Log {
    param (
        [string]$Message
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Add-Content -Path $LogPath -Value $logMessage
    Write-Host $logMessage
}

function Get-ProcessInfo {
    # Get all Code processes sorted by CPU usage (descending)
    return Get-Process | Where-Object {$_.Name -eq "Code"} | Sort-Object CPU -Descending
}

function Show-ProcessTable {
    param (
        $Processes
    )
    Write-Host "`nCurrent VS Code processes:" -ForegroundColor Cyan
    $Processes | Format-Table Id, Name, CPU, @{
        Label = "StartTime"; 
        Expression = {
            if ($_.StartTime) { $_.StartTime.ToString("yyyy-MM-dd HH:mm:ss") } else { "Unknown" }
        }
    }, @{
        Label = "RunTime"; 
        Expression = {
            if ($_.StartTime) { 
                $span = (Get-Date) - $_.StartTime
                "{0:00}:{1:00}:{2:00}" -f $span.Hours, $span.Minutes, $span.Seconds
            } else { "Unknown" }
        }
    }, @{
        Label = "Memory(MB)"; 
        Expression = { [math]::Round($_.WorkingSet / 1MB, 2) }
    }
}

function Kill-HighCPUProcesses {
    param (
        $Processes,
        [int]$CPUThreshold,
        [string]$SafeProcessName
    )
    
    $killedCount = 0
    
    foreach ($process in $Processes) {
        # Skip if this is a protected process
        if ($SafeProcessName -and (Get-Process -Id $process.Id -IncludeUserName).CommandLine -like "*$SafeProcessName*") {
            Write-Log "Skipping protected process $($process.Id) (CPU: $($process.CPU)%)"
            continue
        }
        
        if ($process.CPU -gt $CPUThreshold) {
            try {
                Write-Log "Killing high CPU process $($process.Id) (CPU: $($process.CPU)%)"
                Stop-Process -Id $process.Id -Force
                $killedCount++
            } catch {
                Write-Log "Error killing process $($process.Id): $_"
            }
        }
    }
    
    return $killedCount
}

function Kill-ExcessProcesses {
    param (
        $Processes,
        [int]$MaxProcesses,
        [string]$SafeProcessName
    )
    
    if ($Processes.Count -le $MaxProcesses) {
        return 0
    }
    
    $killedCount = 0
    $processesToKill = $Processes | Select-Object -Skip $MaxProcesses
    
    foreach ($process in $processesToKill) {
        # Skip if this is a protected process
        if ($SafeProcessName -and (Get-Process -Id $process.Id -IncludeUserName).CommandLine -like "*$SafeProcessName*") {
            Write-Log "Skipping protected process $($process.Id) (CPU: $($process.CPU)%)"
            continue
        }
        
        try {
            Write-Log "Killing excess process $($process.Id) (CPU: $($process.CPU)%)"
            Stop-Process -Id $process.Id -Force
            $killedCount++
        } catch {
            Write-Log "Error killing process $($process.Id): $_"
        }
    }
    
    return $killedCount
}

# Main execution
Write-Log "===== VS Code Process Monitor Started ====="
Write-Log "CPU Threshold: $CPUThreshold%, Max Processes: $MaxProcesses, AutoKill: $AutoKill"

$processes = Get-ProcessInfo
Show-ProcessTable $processes

Write-Log "Found $($processes.Count) VS Code processes"

# Calculate total CPU usage
$totalCPU = ($processes | Measure-Object -Property CPU -Sum).Sum
Write-Log "Total VS Code CPU usage: $totalCPU%"

if ($AutoKill) {
    $killedHighCPU = Kill-HighCPUProcesses -Processes $processes -CPUThreshold $CPUThreshold -SafeProcessName $SafeProcessName
    Write-Log "Killed $killedHighCPU high CPU processes"
    
    # Refresh process list after killing high CPU ones
    $processes = Get-ProcessInfo
    
    $killedExcess = Kill-ExcessProcesses -Processes $processes -MaxProcesses $MaxProcesses -SafeProcessName $SafeProcessName
    Write-Log "Killed $killedExcess excess processes"
    
    if ($killedHighCPU -gt 0 -or $killedExcess -gt 0) {
        Write-Log "Waiting 2 seconds for processes to terminate..."
        Start-Sleep -Seconds 2
        $remainingProcesses = Get-ProcessInfo
        Show-ProcessTable $remainingProcesses
        Write-Log "Remaining VS Code processes: $($remainingProcesses.Count)"
    }
} else {
    Write-Log "AutoKill is disabled. To kill processes, run with -AutoKill parameter"
    
    # Identify processes that would be killed
    $highCPUProcesses = $processes | Where-Object { $_.CPU -gt $CPUThreshold }
    if ($highCPUProcesses) {
        Write-Host "`nHigh CPU processes that would be killed:" -ForegroundColor Yellow
        $highCPUProcesses | Format-Table Id, Name, CPU
    }
    
    if ($processes.Count -gt $MaxProcesses) {
        Write-Host "`nExcess processes that would be killed:" -ForegroundColor Yellow
        $processes | Select-Object -Skip $MaxProcesses | Format-Table Id, Name, CPU
    }
}

Write-Log "===== VS Code Process Monitor Completed ====="