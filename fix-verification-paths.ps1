# Create a quick fix script to update the paths
$content = Get-Content -Path .\update-build.js -Raw

# Update the paths to include /src/ in the verification checks
$content = $content -replace 'dist/index.js', 'dist/src/index.js'
$content = $content -replace 'dist/core/UNIFIED-CONTROL.js', 'dist/src/core/UNIFIED-CONTROL.js'
$content = $content -replace 'dist/core/TOKEN-QUALITY-FILTER.js', 'dist/src/core/TOKEN-QUALITY-FILTER.js'
$content = $content -replace 'dist/core/build-tracker.js', 'dist/src/core/build-tracker.js'

# Save the updated file
$content | Set-Content -Path .\update-build.js

Write-Host "✅ Verification paths updated to match actual compilation output"