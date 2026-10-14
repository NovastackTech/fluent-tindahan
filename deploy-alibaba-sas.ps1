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
# Unique port on shared Novastack SAS (8086–8088, 8090 occupied)
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
if (-not $SkipSync -and -not (Get-Command rsync -ErrorAction SilentlyContinue)) {
    Write-Host "[WARN] rsync not found — falling back to scp of a tarball (slower)." -ForegroundColor Yellow
}

$sshArgs = @("-p", $sasPort, "-o", "StrictHostKeyChecking=accept-new")
if ($sasKey) { $sshArgs += @("-i", $sasKey) }
$remote = "${sasUser}@${sasHost}"

function Invoke-Remote([string]$RemoteCommand) {
    & ssh @sshArgs $remote $RemoteCommand
    if ($LASTEXITCODE -ne 0) { throw "Remote command failed ($LASTEXITCODE): $RemoteCommand" }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Fluent Tindahan — deploy-alibaba-sas" -ForegroundColor Cyan
Write-Host "  Target: $remote (port $sasPort)" -ForegroundColor Cyan
Write-Host "  Public: $publicOrigin  (host port $hostPort)" -ForegroundColor Cyan
Write-Host "  App dir: $sasAppDir" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

Write-Host "[INFO] Ensuring remote app directory exists..." -ForegroundColor Yellow
Invoke-Remote "mkdir -p '$sasAppDir'"

if ($Bootstrap) {
    Write-Host "[INFO] Bootstrapping Docker on SAS if missing..." -ForegroundColor Yellow
    $bootstrap = Join-Path $root "deploy\remote-bootstrap.sh"
    Get-Content $bootstrap -Raw | & ssh @sshArgs $remote "bash -s"
    if ($LASTEXITCODE -ne 0) { throw "Bootstrap failed" }
}

Write-Host "[INFO] Checking Docker on SAS..." -ForegroundColor Yellow
& ssh @sshArgs $remote "command -v docker >/dev/null 2>&1"
if ($LASTEXITCODE -ne 0) {
    throw "Docker not found on $sasHost. Re-run with -Bootstrap, or use the Docker SAS application image."
}

if (-not $SkipSync) {
    Write-Host "[INFO] Syncing project files to SAS..." -ForegroundColor Yellow
    if (Get-Command rsync -ErrorAction SilentlyContinue) {
        $rsh = "ssh -p $sasPort"
        if ($sasKey) { $rsh = "ssh -p $sasPort -i `"$sasKey`"" }
        $excludes = @(
            "--exclude", ".git/",
            "--exclude", "node_modules/",
            "--exclude", "frontend/node_modules/",
            "--exclude", "frontend/dist/",
            "--exclude", "frontend/dev-dist/",
            "--exclude", "frontend/coverage/",
            "--exclude", "backend/**/bin/",
            "--exclude", "backend/**/obj/",
            "--exclude", "backend/**/TestResults/",
            "--exclude", ".run/",
            "--exclude", "tindahan/",
            "--exclude", ".obsidian/",
            "--exclude", "deploy/alibaba-sas.env",
            "--exclude", "docker-compose.override.yml",
            "--exclude", ".env",
            "--exclude", "backups/"
        )
        & rsync -az --delete @excludes -e $rsh "$root/" "${remote}:${sasAppDir}/"
        if ($LASTEXITCODE -ne 0) { throw "rsync failed" }
    } else {
        $tar = Join-Path $env:TEMP "fluent-tindahan-deploy.tgz"
        if (Test-Path $tar) { Remove-Item $tar -Force }
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
        } finally {
            Pop-Location
        }
        $scpArgs = @("-P", $sasPort)
        if ($sasKey) { $scpArgs += @("-i", $sasKey) }
        $scpArgs += @($tar, "${remote}:/tmp/fluent-tindahan-deploy.tgz")
        & scp @scpArgs
        if ($LASTEXITCODE -ne 0) { throw "scp failed" }
        Invoke-Remote "mkdir -p '$sasAppDir' && tar -xzf /tmp/fluent-tindahan-deploy.tgz -C '$sasAppDir' && rm -f /tmp/fluent-tindahan-deploy.tgz"
        Remove-Item $tar -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "[INFO] Skipping sync (-SkipSync)" -ForegroundColor Yellow
}

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

Write-Host "[INFO] Writing remote .env (umask 077, 0600)..." -ForegroundColor Yellow
($remoteEnv -replace "\r", "") | & ssh @sshArgs $remote "umask 077 && cat > '$sasAppDir/.env' && chmod 600 '$sasAppDir/.env'"
if ($LASTEXITCODE -ne 0) { throw "Failed to write remote .env" }

Write-Host "[INFO] Checking for running database to snapshot..." -ForegroundColor Yellow
$pgUser = CfgOr 'POSTGRES_USER' 'fluent'
$pgDb = CfgOr 'POSTGRES_DB' 'fluent_tindahan'
$backupCmd = "cd '$sasAppDir' && if docker compose -f docker-compose.yml ps --status running -q db 2>/dev/null | grep -q .; then mkdir -p backups && ts=`$(date +%Y%m%d_%H%M%S) && echo `"[INFO] Snapshotting database to backups/db_`${ts}.sql.gz...`" && docker compose -f docker-compose.yml exec -T db pg_dump -U `"$pgUser`" `"$pgDb`" | gzip > `"backups/db_`${ts}.sql.gz`" && echo `"[OK] Database snapshot complete.`" || echo `"[WARN] Database snapshot failed or skipped.`"; else echo `"[INFO] Database not running yet — skipping pre-deploy backup.`"; fi"
Invoke-Remote $backupCmd

Write-Host "[INFO] Building and starting stack on SAS..." -ForegroundColor Yellow
Invoke-Remote "cd '$sasAppDir' && docker compose -f docker-compose.yml --env-file .env up -d --build --remove-orphans"

Write-Host "[INFO] Waiting for health on host port $hostPort..." -ForegroundColor Yellow
$healthy = $false
for ($i = 1; $i -le 36; $i++) {
    & ssh @sshArgs $remote "curl -fsS --max-time 3 http://127.0.0.1:$hostPort/api/health >/dev/null 2>&1"
    if ($LASTEXITCODE -eq 0) {
        $healthy = $true
        Write-Host "[OK] Health check passed on :$hostPort." -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 5
}
if (-not $healthy) {
    throw "Health check timed out. Inspect logs: ssh $remote `"cd $sasAppDir && docker compose -f docker-compose.yml logs --tail=200`""
}

Write-Host "[INFO] Installing edge nginx vhost for $publicHost → 127.0.0.1:$hostPort..." -ForegroundColor Yellow
$vhostArgs = if ($ForceVhost) { "--force-vhost" } else { "" }
$vhostCmd = "PUBLIC_HOST='$publicHost' HOST_HTTP_PORT='$hostPort' SAS_APP_DIR='$sasAppDir' SAS_CERTBOT_EMAIL='$certbotEmail' bash '$sasAppDir/deploy/install-host-vhost.sh' $vhostArgs"
Invoke-Remote $vhostCmd

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Deploy complete" -ForegroundColor Green
Write-Host "  - Public:  $publicOrigin" -ForegroundColor White
Write-Host "  - Health:  $publicOrigin/api/health" -ForegroundColor White
Write-Host "  Reminder: SAS Firewall must allow TCP 80/443 (edge nginx)." -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
