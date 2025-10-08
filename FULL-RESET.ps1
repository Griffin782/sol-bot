# USE - .\FULL-RESET.ps1 to completely reset all data files, logs, and databases for a fresh start

Write-Host "COMPLETE DATA PURGE" -ForegroundColor Red
Write-Host "This will clear ALL data sources" -ForegroundColor Yellow

# Run your existing reset
.\bot-reset-files.ps1

# Clear SQLite
Remove-Item .\src\tracker\*.db -Force -ErrorAction SilentlyContinue

# Clear all JSON in data folder
Remove-Item .\data\*.json -Force -ErrorAction SilentlyContinue

# Clear logs
Remove-Item .\logs\*.log -Force -ErrorAction SilentlyContinue

# Recreate essential empty files
Set-Content ".\data\final-state.json" "{}"
Set-Content ".\data\trading_log.json" "[]"
Set-Content ".\data\token_registry.json" "{}"

Write-Host "COMPLETE RESET DONE" -ForegroundColor Green
Write-Host "Monitor should now show clean state" -ForegroundColor Cyan