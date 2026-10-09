<#
.SYNOPSIS
    Starts the Fluent Tindahan local development environment (Backend + Frontend).
#>

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Starting Fluent Tindahan Local Development Environment  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$backendDir = Join-Path $PSScriptRoot "backend\src\FluentTindahan.WebApi"
$frontendDir = Join-Path $PSScriptRoot "frontend"

# Check if Backend is already running on port 5000
$backendRunning = $false
try {
    $res = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
    if ($res.StatusCode -eq 200) { $backendRunning = $true }
} catch {}

if ($backendRunning) {
    Write-Host "[OK] Backend Web API is already running at http://localhost:5000" -ForegroundColor Green
} else {
    Write-Host "[INFO] Starting Backend Web API on http://localhost:5000 in background..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; `$env:ASPNETCORE_ENVIRONMENT='Development'; dotnet run --urls 'http://localhost:5000'" -WindowStyle Normal
}

# Check if Frontend is already running on port 5173
$frontendRunning = $false
try {
    $res = Invoke-WebRequest -Uri "http://127.0.0.1:5173" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
    if ($res.StatusCode -eq 200) { $frontendRunning = $true }
} catch {}

if ($frontendRunning) {
    Write-Host "[OK] Frontend Vite Dev Server is already running at http://localhost:5173" -ForegroundColor Green
} else {
    Write-Host "[INFO] Starting Frontend Dev Server on http://localhost:5173..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev -- --host 127.0.0.1 --port 5173" -WindowStyle Normal
}

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Services are live!                                      " -ForegroundColor Green
Write-Host "  - Frontend PWA:    http://localhost:5173                " -ForegroundColor White
Write-Host "  - Backend API:     http://localhost:5000                " -ForegroundColor White
Write-Host "  - Swagger UI:      http://localhost:5000/swagger        " -ForegroundColor White
Write-Host "  - Health Check:    http://localhost:5000/api/health     " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green

# Open browser to the frontend
Start-Process "http://localhost:5173"
