# Aggressive Backup Cleanup Script
# Targets YOUR specific backup patterns
# Run from sol-bot-main directory

$archiveDir = ".\ARCHIVED-BACKUPS-$(Get-Date -Format 'yyyy-MM-dd-HHmm')"
New-Item -ItemType Directory -Force -Path $archiveDir | Out-Null

Write-Host "AGGRESSIVE BACKUP CLEANUP" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

$totalBefore = (Get-ChildItem -Recurse -File).Count
Write-Host "Files before: $totalBefore" -ForegroundColor Yellow
Write-Host ""

$moved = 0

# Pattern 1: Folders starting with "backup-"
Write-Host "Finding backup-* folders..." -ForegroundColor Green
$backupFolders = Get-ChildItem -Directory -Filter "backup-*"
foreach ($folder in $backupFolders) {
    Write-Host "  Moving: $($folder.Name)" -ForegroundColor Gray
    Move-Item $folder.FullName "$archiveDir\$($folder.Name)" -Force
    $moved++
}

# Pattern 2: Folders with "_backup_" in name
Write-Host "Finding *_backup_* folders..." -ForegroundColor Green
$backupFolders = Get-ChildItem -Directory | Where-Object { $_.Name -match '_backup_' }
foreach ($folder in $backupFolders) {
    Write-Host "  Moving: $($folder.Name)" -ForegroundColor Gray
    Move-Item $folder.FullName "$archiveDir\$($folder.Name)" -Force
    $moved++
}

# Pattern 3: Files with ".backup-" in name
Write-Host "Finding *.backup-* files..." -ForegroundColor Green
$backupFiles = Get-ChildItem -File | Where-Object { $_.Name -match '\.backup-' }
foreach ($file in $backupFiles) {
    Write-Host "  Moving: $($file.Name)" -ForegroundColor Gray
    Move-Item $file.FullName "$archiveDir\$($file.Name)" -Force
    $moved++
}

# Pattern 4: env-backup folders
Write-Host "Finding env-backup* folders..." -ForegroundColor Green
$envBackups = Get-ChildItem -Directory -Filter "env-backup*"
foreach ($folder in $envBackups) {
    Write-Host "  Moving: $($folder.Name)" -ForegroundColor Gray
    Move-Item $folder.FullName "$archiveDir\$($folder.Name)" -Force
    $moved++
}

# Pattern 5: Duplicate sol-bot-main folders (CAREFUL!)
Write-Host "Finding duplicate sol-bot-main folders..." -ForegroundColor Yellow
$dupes = Get-ChildItem -Directory -Filter "sol-bot-main*" | Where-Object { $_.Name -ne "sol-bot-main" }
if ($dupes.Count -gt 0) {
    Write-Host "  FOUND $($dupes.Count) duplicate folders:" -ForegroundColor Red
    foreach ($dupe in $dupes) {
        Write-Host "    - $($dupe.Name)" -ForegroundColor Gray
    }
    $answer = Read-Host "  Move these duplicates? (y/n)"
    if ($answer -eq 'y') {
        foreach ($dupe in $dupes) {
            Write-Host "  Moving: $($dupe.Name)" -ForegroundColor Gray
            Move-Item $dupe.FullName "$archiveDir\$($dupe.Name)" -Force
            $moved++
        }
    }
}

# Pattern 6: Other common backup names
Write-Host "Finding other backup patterns..." -ForegroundColor Green
$otherBackups = Get-ChildItem -Directory | Where-Object { 
    $_.Name -match 'old|archive|copy|temp|bak|test.*backup' -and
    $_.Name -ne 'ARCHIVED-BACKUPS*'
}
if ($otherBackups.Count -gt 0) {
    Write-Host "  Found $($otherBackups.Count) potential backups:" -ForegroundColor Yellow
    foreach ($backup in $otherBackups) {
        Write-Host "    - $($backup.Name)" -ForegroundColor Gray
    }
    $answer = Read-Host "  Move these? (y/n)"
    if ($answer -eq 'y') {
        foreach ($backup in $otherBackups) {
            Write-Host "  Moving: $($backup.Name)" -ForegroundColor Gray
            Move-Item $backup.FullName "$archiveDir\$($backup.Name)" -Force
            $moved++
        }
    }
}

# Count after
$totalAfter = (Get-ChildItem -Recurse -File).Count
$reduction = $totalBefore - $totalAfter
$percent = if ($totalBefore -gt 0) { [math]::Round(($reduction / $totalBefore) * 100, 1) } else { 0 }

Write-Host ""
Write-Host "CLEANUP COMPLETE" -ForegroundColor Green
Write-Host "================" -ForegroundColor Green
Write-Host "Files before: $totalBefore" -ForegroundColor White
Write-Host "Files after: $totalAfter" -ForegroundColor White
Write-Host "Removed: $reduction files ($percent percent)" -ForegroundColor Yellow
Write-Host "Items archived: $moved" -ForegroundColor Cyan
Write-Host "Archive location: $archiveDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "SAFE: All backups preserved in archive folder" -ForegroundColor Green
