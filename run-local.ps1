<#
.SYNOPSIS
    Run Fluent Tindahan locally (Novastack standard entrypoint).

.DESCRIPTION
    Default mode starts Backend (.NET) + Frontend (Vite) natively — same workflow as start-local.ps1.
    Pass -Docker to bring up the full stack with Docker Compose (db + api + web).

.PARAMETER Docker
    Use docker compose instead of native processes.

.PARAMETER Build
    With -Docker, force image rebuild.

.EXAMPLE
    ./run-local.ps1
    ./run-local.ps1 -Docker
    ./run-local.ps1 -Docker -Build
#>
[CmdletBinding()]
param(
    [switch]$Docker,
    [switch]$Build
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Fluent Tindahan — run-local" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

function Test-Url([string]$Url) {
    try {
        $res = Invoke-WebRequest -Uri $Url -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        return $res.StatusCode -ge 200 -and $res.StatusCode -lt 500
    } catch {
        return $false
    }
}

if ($Docker) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host "[ERROR] Docker is not installed or not on PATH." -ForegroundColor Red
        Write-Host "        Install Docker Desktop, or run without -Docker." -ForegroundColor Yellow
        exit 1
    }

    if (-not (Test-Path (Join-Path $root ".env"))) {
        $example = Join-Path $root ".env.example"
        if (Test-Path $example) {
            Copy-Item $example (Join-Path $root ".env")
            Write-Host "[INFO] Created .env from .env.example — review secrets before production use." -ForegroundColor Yellow
        }
    }

    $composeArgs = @("compose", "up", "-d")
    if ($Build) { $composeArgs += "--build" }

    Push-Location $root
    try {
        Write-Host "[INFO] Starting Docker Compose stack (db + api + web)..." -ForegroundColor Yellow
        & docker @composeArgs
        if ($LASTEXITCODE -ne 0) { throw "docker compose failed with exit code $LASTEXITCODE" }
    } finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  Docker stack is up" -ForegroundColor Green
    Write-Host "  - PWA (nginx):     http://localhost:8080" -ForegroundColor White
    Write-Host "  - API (direct):    http://localhost:5000" -ForegroundColor White
    Write-Host "  - Health:          http://localhost:5000/api/health" -ForegroundColor White
    Write-Host "  - Postgres:        localhost:5432" -ForegroundColor White
    Write-Host "==========================================================" -ForegroundColor Green
    Start-Process "http://localhost:8080"
    exit 0
}

# --- Native mode (default) ---
$backendDir = Join-Path $root "backend\src\FluentTindahan.WebApi"
$frontendDir = Join-Path $root "frontend"

if (Test-Url "http://localhost:5000/api/health") {
    Write-Host "[OK] Backend already running at http://localhost:5000" -ForegroundColor Green
} else {
    Write-Host "[INFO] Starting Backend Web API on http://localhost:5000..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; `$env:ASPNETCORE_ENVIRONMENT='Development'; dotnet run --urls 'http://localhost:5000'" -WindowStyle Normal
}

if (Test-Url "http://127.0.0.1:5173") {
    Write-Host "[OK] Frontend already running at http://localhost:5173" -ForegroundColor Green
} else {
    if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
        Write-Host "[INFO] Installing frontend dependencies (npm ci)..." -ForegroundColor Yellow
        Push-Location $frontendDir
        try { npm ci } finally { Pop-Location }
    }
    Write-Host "[INFO] Starting Frontend Dev Server on http://localhost:5173..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev -- --host 127.0.0.1 --port 5173" -WindowStyle Normal
}

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Services are live!" -ForegroundColor Green
Write-Host "  - Frontend PWA:    http://localhost:5173" -ForegroundColor White
Write-Host "  - Backend API:     http://localhost:5000" -ForegroundColor White
Write-Host "  - Swagger UI:      http://localhost:5000/swagger" -ForegroundColor White
Write-Host "  - Health Check:    http://localhost:5000/api/health" -ForegroundColor White
Write-Host "  Tip: ./run-local.ps1 -Docker  for full compose stack" -ForegroundColor DarkGray
Write-Host "==========================================================" -ForegroundColor Green

Start-Process "http://localhost:5173"
