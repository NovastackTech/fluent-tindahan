<#
.SYNOPSIS
    Deploy Fluent Tindahan to Alibaba Cloud Simple Application Server (SAS).

.DESCRIPTION
    Novastack standard remote deploy: rsync over SSH, then docker compose up on the SAS host.
    Reads settings from deploy/alibaba-sas.env (see deploy/alibaba-sas.env.example).

.PARAMETER SkipSync
    Skip rsync; only rewrite .env and rebuild/restart on the remote.

.PARAMETER Bootstrap
    Install Docker on a fresh Ubuntu/Debian SAS instance if missing.

.EXAMPLE
    cp deploy/alibaba-sas.env.example deploy/alibaba-sas.env
    # edit deploy/alibaba-sas.env
    ./deploy-alibaba-sas.ps1
#>
[CmdletBinding()]
param(
    [switch]$SkipSync,
    [switch]$Bootstrap,
    [switch]$ForceVhost
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$envFile = Join-Path $root "deploy\alibaba-sas.env"

if (-not (Test-Path $envFile)) {
    Write-Host "[ERROR] Missing $envFile" -ForegroundColor Red
    Write-Host "        Copy deploy/alibaba-sas.env.example to deploy/alibaba-sas.env and edit it." -ForegroundColor Yellow
    exit 1
}

# Parse KEY=VALUE env file (ignore comments / blanks)
$cfg = @{}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
        $val = $val.Substring(1, $val.Length - 2)
    }
    $cfg[$key] = $val
}

function Require-Cfg([string]$Name) {
    if (-not $cfg.ContainsKey($Name) -or [string]::IsNullOrWhiteSpace($cfg[$Name])) {
        throw "Missing required setting '$Name' in deploy/alibaba-sas.env"
    }
    return $cfg[$Name]
}

$sasHost = Require-Cfg "SAS_HOST"
$sasUser = if ($cfg.ContainsKey("SAS_USER") -and $cfg["SAS_USER"]) { $cfg["SAS_USER"] } else { "root" }
$sasPort = if ($cfg.ContainsKey("SAS_PORT") -and $cfg["SAS_PORT"]) { $cfg["SAS_PORT"] } else { "22" }
$sasAppDir = if ($cfg.ContainsKey("SAS_APP_DIR") -and $cfg["SAS_APP_DIR"]) { $cfg["SAS_APP_DIR"] } else { "/opt/fluent-tindahan" }
$sasKey = if ($cfg.ContainsKey("SAS_SSH_KEY")) { $cfg["SAS_SSH_KEY"] } else { "" }
$publicHost = if ($cfg.ContainsKey("PUBLIC_HOST") -and $cfg["PUBLIC_HOST"]) { $cfg["PUBLIC_HOST"] } else { "tindahan-dev.novastack-inc.online" }
$publicOrigin = if ($cfg.ContainsKey("PUBLIC_ORIGIN") -and $cfg["PUBLIC_ORIGIN"]) { $cfg["PUBLIC_ORIGIN"] } else { "https://$publicHost" }
# Unique port on shared Novastack SAS (8086-8088, 8090 occupied)
$hostPort = if ($cfg.ContainsKey("HOST_HTTP_PORT") -and $cfg["HOST_HTTP_PORT"]) { $cfg["HOST_HTTP_PORT"] } else { "8089" }
$certbotEmail = if ($cfg.ContainsKey("SAS_CERTBOT_EMAIL")) { $cfg["SAS_CERTBOT_EMAIL"] } else { "" }

$null = Require-Cfg "POSTGRES_PASSWORD"
$null = Require-Cfg "PAYMONGO_SECRET_KEY"
$null = Require-Cfg "PAYMONGO_WEBHOOK_SECRET"
if (-not $cfg.ContainsKey("PAYMONGO_FRONTEND_ORIGIN") -or [string]::IsNullOrWhiteSpace($cfg["PAYMONGO_FRONTEND_ORIGIN"])) {
    $cfg["PAYMONGO_FRONTEND_ORIGIN"] = $publicOrigin
}

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    throw "ssh is required (install OpenSSH Client)."
}

$remote = "${sasUser}@${sasHost}"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Fluent Tindahan - deploy-alibaba-sas" -ForegroundColor Cyan
Write-Host "  Target: $remote (port $sasPort)" -ForegroundColor Cyan
Write-Host "  Public: $publicOrigin  (host port $hostPort)" -ForegroundColor Cyan
Write-Host "  App dir: $sasAppDir" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Build remote .env content
function CfgOr([string]$Name, [string]$Default) {
    if ($cfg.ContainsKey($Name) -and $cfg[$Name]) { return $cfg[$Name] }
    return $Default
}

$remoteEnv = @"
POSTGRES_DB=$(CfgOr 'POSTGRES_DB' 'fluent_tindahan')
POSTGRES_USER=$(CfgOr 'POSTGRES_USER' 'fluent')
POSTGRES_PASSWORD=$($cfg['POSTGRES_PASSWORD'])
ASPNETCORE_ENVIRONMENT=$(CfgOr 'ASPNETCORE_ENVIRONMENT' 'Production')
FIREBASE_PROJECT_ID=$(CfgOr 'FIREBASE_PROJECT_ID' 'fluent-tindahan-prod')
PAYMONGO_SECRET_KEY=$($cfg['PAYMONGO_SECRET_KEY'])
PAYMONGO_WEBHOOK_SECRET=$($cfg['PAYMONGO_WEBHOOK_SECRET'])
PAYMONGO_FRONTEND_ORIGIN=$($cfg['PAYMONGO_FRONTEND_ORIGIN'])
HOST_HTTP_PORT=$hostPort
"@

if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
    throw "tar is required (built into Windows 10+). Cannot create deploy archive."
}

$tar = Join-Path $env:TEMP "fluent-deploy-$([Guid]::NewGuid().ToString('N')).tgz"
$tempRemoteEnv = Join-Path $root ".env.remote.tmp"

try {
    Write-Host "[INFO] Staging remote configuration..." -ForegroundColor Yellow
    # Write remote .env with LF line endings
    $cleanEnv = $remoteEnv -replace "`r`n", "`n" -replace "`r", "`n"
    [System.IO.File]::WriteAllText($tempRemoteEnv, $cleanEnv, (New-Object System.Text.UTF8Encoding $false))

    Write-Host "[INFO] Packaging project files (tar.gz)..." -ForegroundColor Yellow
    Push-Location $root
    try {
        tar -czf $tar `
            --exclude=.git `
            --exclude=node_modules `
            --exclude=frontend/node_modules `
            --exclude=frontend/dist `
            --exclude=frontend/dev-dist `
            --exclude=frontend/coverage `
            --exclude="*/bin" `
            --exclude="*/obj" `
            --exclude="*TestResults*" `
            --exclude=.run `
            --exclude=tindahan `
            --exclude=.obsidian `
            --exclude="*.obsidian*" `
            --exclude=deploy/alibaba-sas.env `
            --exclude=docker-compose.override.yml `
            --exclude=.env `
            --exclude=backups `
            .
        if ($LASTEXITCODE -ne 0) { throw "tar packaging failed ($LASTEXITCODE)" }
    } finally {
        Pop-Location
    }

    $bootstrapArg = if ($Bootstrap) { "1" } else { "0" }
    $forceVhostArg = if ($ForceVhost) { "1" } else { "0" }

    $remoteCmd = "set -euo pipefail; mkdir -p '$sasAppDir'; cat > /tmp/fluent-deploy.tgz; tar -xzf /tmp/fluent-deploy.tgz -C '$sasAppDir'; rm -f /tmp/fluent-deploy.tgz; chmod +x '$sasAppDir/deploy/'*.sh 2>/dev/null || true; cd '$sasAppDir' && bash deploy/remote-deploy.sh '$sasAppDir' '$hostPort' '$publicHost' '$publicOrigin' '$certbotEmail' '$bootstrapArg' '$forceVhostArg'"

    Write-Host "[INFO] Connecting via single SSH session (enter root password once)..." -ForegroundColor Yellow
    Write-Host "  Target: $remote" -ForegroundColor Yellow

    $sshExe = (Get-Command ssh -ErrorAction Stop).Source
    $sshArgs = @("-p", $sasPort, "-o", "StrictHostKeyChecking=accept-new")
    if ($sasKey) { $sshArgs += @("-i", $sasKey) }
    $sshArgs += @($remote, $remoteCmd)

    $proc = Start-Process -FilePath $sshExe -ArgumentList $sshArgs -RedirectStandardInput $tar -Wait -PassThru -NoNewWindow
    if ($proc.ExitCode -ne 0) {
        throw "Remote deployment failed (exit code $($proc.ExitCode))."
    }
} finally {
    Remove-Item $tar -Force -ErrorAction SilentlyContinue
    Remove-Item $tempRemoteEnv -Force -ErrorAction SilentlyContinue
}
