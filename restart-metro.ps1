# Kill any process using port 8081
Write-Host "🔍 Finding processes on port 8081..." -ForegroundColor Cyan

$connections = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
if ($connections) {
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
        Write-Host "🔪 Killing process $pid" -ForegroundColor Yellow
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
    Write-Host "✅ Port 8081 is now free" -ForegroundColor Green
} else {
    Write-Host "✅ Port 8081 is already free" -ForegroundColor Green
}

# Wait a moment
Start-Sleep -Seconds 1

# Start Metro bundler
Write-Host "🚀 Starting Metro bundler with --reset-cache..." -ForegroundColor Cyan
npx react-native start --reset-cache
