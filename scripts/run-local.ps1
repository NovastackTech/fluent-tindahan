#Requires -Version 5.1
<#
.SYNOPSIS
    One-step local run for Fluent Tindahan (Novastack standard entrypoint).

.DESCRIPTION
    Default mode starts the Backend (.NET, http://localhost:5000) and Frontend (Vite, http://localhost:5173)
    natively in separate windows against PostgreSQL on localhost:5432.
    Pass -Docker to bring up the full stack with Docker Compose (db + api + web).

.PARAMETER Docker
    Use docker compose instead of native processes.

.PARAMETER Build
    With -Docker, force image rebuild.

.EXAMPLE
    .\run-local.cmd
.EXAMPLE
    .\run-local.cmd -Docker
.EXAMPLE
    .\run-local.cmd -Docker -Build
#>
[CmdletBinding()]
param(
    [switch]$Docker,
    [switch]$Build
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Write-Step([string]$Message) {
    Write-Host "[run-local] $Message" -ForegroundColor Cyan
}

function Test-Url([string]$Url) {
    try {
        $res = Invoke-WebRequest -Uri $Url -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        return $res.StatusCode -ge 200 -and $res.StatusCode -lt 500
    } catch {
        return $false
    }
}

function Test-TcpPortOpen([string]$HostName, [int]$Port, [int]$TimeoutMs = 800) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect($HostName, $Port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
        if (-not $ok) { $client.Close(); return $false }
        $client.EndConnect($iar)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

Write-Host '==========================================================' -ForegroundColor Cyan
Write-Host '  Fluent Tindahan - run-local' -ForegroundColor Cyan
Write-Host '==========================================================' -ForegroundColor Cyan

if ($Docker) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker is not installed or not on PATH. Install Docker Desktop, or run without -Docker.'
    }

    $envFile = Join-Path $root '.env'
    if (-not (Test-Path $envFile)) {
        $example = Join-Path $root '.env.example'
        if (Test-Path $example) {
            Copy-Item $example $envFile
            Write-Step 'Created .env from .env.example - review secrets before production use.'
        }
    }

    $composeArgs = @('compose', 'up', '-d')
    if ($Build) { $composeArgs += '--build' }

    Push-Location $root
    try {
        Write-Step 'Starting Docker Compose stack (db + api + web)...'
        & docker @composeArgs
        if ($LASTEXITCODE -ne 0) { throw "docker compose failed with exit code $LASTEXITCODE" }
    } finally {
        Pop-Location
    }

    Write-Host ''
    Write-Host '==========================================================' -ForegroundColor Green
    Write-Host '  Docker stack is up' -ForegroundColor Green
    Write-Host '  - PWA (nginx):     http://localhost:8080' -ForegroundColor White
    Write-Host '  - API (direct):    http://localhost:5000' -ForegroundColor White
    Write-Host '  - Health:          http://localhost:5000/api/health' -ForegroundColor White
    Write-Host '  - Postgres:        localhost:5432' -ForegroundColor White
    Write-Host '==========================================================' -ForegroundColor Green
    Start-Process 'http://localhost:8080'
    return
}

# --- Native mode (default) ---
$backendDir = Join-Path $root 'backend\src\FluentTindahan.WebApi'
$frontendDir = Join-Path $root 'frontend'

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw '.NET 8 SDK is required. Install from https://dotnet.microsoft.com/download'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'Node.js/npm is required. Install from https://nodejs.org'
}

if (-not (Test-TcpPortOpen 'localhost' 5432)) {
    Write-Warning 'PostgreSQL is not listening on localhost:5432. Start it (database fluent_tindahan), or use .\run-local.cmd -Docker.'
}

if (Test-Url 'http://localhost:5000/api/health') {
    Write-Host '[OK] Backend already running at http://localhost:5000' -ForegroundColor Green
} else {
    Write-Step 'Starting Backend Web API on http://localhost:5000...'
    Start-Process powershell.exe -ArgumentList '-NoExit', '-NoProfile', '-Command', "cd '$backendDir'; `$env:ASPNETCORE_ENVIRONMENT='Development'; dotnet run --urls 'http://localhost:5000'" -WindowStyle Normal
}

if (Test-Url 'http://127.0.0.1:5173') {
    Write-Host '[OK] Frontend already running at http://localhost:5173' -ForegroundColor Green
} else {
    if (-not (Test-Path (Join-Path $frontendDir 'node_modules'))) {
        Write-Step 'Installing frontend dependencies (npm ci)...'
        Push-Location $frontendDir
        try {
            & npm ci --ignore-scripts
            if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
        } finally {
            Pop-Location
        }
    }
    Write-Step 'Starting Frontend Dev Server on http://localhost:5173...'
    Start-Process powershell.exe -ArgumentList '-NoExit', '-NoProfile', '-Command', "cd '$frontendDir'; npm run dev -- --host 127.0.0.1 --port 5173" -WindowStyle Normal
}

Start-Sleep -Seconds 3

Write-Host ''
Write-Host '==========================================================' -ForegroundColor Green
Write-Host '  Services are live!' -ForegroundColor Green
Write-Host '  - Frontend PWA:    http://localhost:5173' -ForegroundColor White
Write-Host '  - Backend API:     http://localhost:5000' -ForegroundColor White
Write-Host '  - Swagger UI:      http://localhost:5000/swagger' -ForegroundColor White
Write-Host '  - Health Check:    http://localhost:5000/api/health' -ForegroundColor White
Write-Host '  Tip: .\run-local.cmd -Docker  for the full compose stack' -ForegroundColor DarkGray
Write-Host '==========================================================' -ForegroundColor Green

Start-Process 'http://localhost:5173'
