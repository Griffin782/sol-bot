# Backup File Cleanup Script
# Archives 4,030 backup files to clean up project
# Run from sol-bot-main directory

# Create archive directory
$archiveDir = ".\ARCHIVED-BACKUPS-$(Get-Date -Format 'yyyy-MM-dd')"
New-Item -ItemType Directory -Force -Path $archiveDir | Out-Null

Write-Host "BACKUP CLEANUP SCRIPT" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

# Count current files
$totalBefore = (Get-ChildItem -Recurse -File).Count
Write-Host "[BEFORE] Files: $totalBefore" -ForegroundColor Yellow

# Backup directories to archive
$backupFolders = @(
    "backup",
    "backups",
    "old",
    "archive",
    "archived",
    "z-backup"
)

$moved = 0

foreach ($folder in $backupFolders) {
    if (Test-Path $folder) {
        Write-Host "[ARCHIVE] Moving folder: $folder" -ForegroundColor Green
        Move-Item $folder "$archiveDir\$folder" -Force
        $moved++
    }
}

# Archive files with backup patterns
$backupPatterns = @(
    "*-backup.*",
    "*-old.*",
    "*.backup",
    "*.bak",
    "*-copy.*",
    "*_backup.*",
    "*_old.*"
)

foreach ($pattern in $backupPatterns) {
    $files = Get-ChildItem -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        $relativePath = $file.FullName.Replace($PWD.Path, "")
        $destPath = Join-Path $archiveDir "files-by-pattern\$relativePath"
        $destDir = Split-Path $destPath -Parent

        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
        Move-Item $file.FullName $destPath -Force
        $moved++
    }
}

# Archive z-new-controls (dead code)
if (Test-Path "z-new-controls") {
    Write-Host "[ARCHIVE] Moving z-new-controls (dead code)" -ForegroundColor Green
    Move-Item "z-new-controls" "$archiveDir\z-new-controls" -Force
}

# Count after
$totalAfter = (Get-ChildItem -Recurse -File).Count
$reduction = $totalBefore - $totalAfter
$percent = [math]::Round(($reduction / $totalBefore) * 100, 1)

Write-Host ""
Write-Host "CLEANUP COMPLETE" -ForegroundColor Green
Write-Host "===================" -ForegroundColor Green
Write-Host "[BEFORE] Files: $totalBefore" -ForegroundColor White
Write-Host "[AFTER]  Files: $totalAfter" -ForegroundColor White
Write-Host "[REMOVED] $reduction files ($percent%)" -ForegroundColor Yellow
Write-Host "[ARCHIVE] $archiveDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "[SAFE] Backups are preserved in archive folder" -ForegroundColor Yellow
Write-Host "[INFO] You can restore them if needed" -ForegroundColor White
