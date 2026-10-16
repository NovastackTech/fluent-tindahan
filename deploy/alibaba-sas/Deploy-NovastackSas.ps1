#Requires -Version 5.1
<#
.SYNOPSIS
  One-step deploy of Fluent Tindahan (tindahan-dev.novastack-inc.online) to the Novastack Alibaba SAS.
  Packages the project, streams it over a single SSH session (root password once) and runs install.sh,
  which builds the Docker stack, snapshots the database and adds the domain to the shared Caddy.

.EXAMPLE
  .\deploy-alibaba-sas.cmd

.EXAMPLE
  .\deploy-alibaba-sas.cmd -ModifyDockerCaddy
  First setup only: allow appending the site to the Lying-in Caddyfile when that Caddy has no shared sites folder.

.EXAMPLE
  .\deploy-alibaba-sas.cmd -Pull
  Re-run install.sh on the code already on the server (no upload).

.EXAMPLE
  .\deploy-alibaba-sas.cmd -PackageOnly
  Build the upload archive and list its contents without connecting to the server.

.NOTES
  Server secrets live in /opt/fluent-tindahan/.env (generated on first install, never overwritten).
  To push PayMongo keys, create the gitignored deploy/alibaba-sas/secrets.env (see secrets.env.example);
  install.sh merges it into the server .env and deletes the uploaded copy.
#>
[CmdletBinding()]
param(
    [switch]$Pull,
    [switch]$NoProxy,
    [switch]$ModifyDockerCaddy,
    [switch]$NoBackup,
    [switch]$PackageOnly,
    [string]$SshKeyPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Novastack Alibaba SAS - saved deployment target
$ServerIp    = '8.220.128.80'
$Domain      = 'tindahan-dev.novastack-inc.online'
$InstallDir  = '/opt/fluent-tindahan'
$HttpPort    = 8089
$ProjectName = 'fluent-tindahan'
$SshUser     = 'root'

$ScriptDir = $PSScriptRoot
$AppDir    = (Resolve-Path (Join-Path $ScriptDir '..\..')).Path

function Write-Step([string]$Message) {
    Write-Host "[novastack-sas] $Message" -ForegroundColor Cyan
}

function Get-SshArgs {
    $sshArgs = @(
        '-o', 'StrictHostKeyChecking=accept-new',
        '-o', 'ServerAliveInterval=15',
        '-o', 'ServerAliveCountMax=60',
        '-o', 'TCPKeepAlive=yes',
        '-o', 'ConnectTimeout=30'
    )
    if ($SshKeyPath -and (Test-Path $SshKeyPath)) { $sshArgs += @('-i', $SshKeyPath) }
    return $sshArgs + @("${SshUser}@${ServerIp}")
}

function Invoke-Ssh([string]$RemoteCommand) {
    # Send remote output to the console; otherwise it joins the return value.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & ssh @(Get-SshArgs) $RemoteCommand | Out-Host
        return [int]$LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Convert-TextFilesToLf([string]$Root) {
    $patterns = @('*.sh', '*.conf', '*.yml', '*.yaml', '*.env', '*.example', '.env*')
    $utf8 = New-Object System.Text.UTF8Encoding $false
    foreach ($file in Get-ChildItem -Path $Root -Recurse -Force -File -Include $patterns -ErrorAction SilentlyContinue) {
        $text = [System.IO.File]::ReadAllText($file.FullName)
        $normalized = $text -replace "`r`n", "`n" -replace "`r", "`n"
        if ($normalized -ne $text) {
            [System.IO.File]::WriteAllText($file.FullName, $normalized, $utf8)
        }
    }
}

function New-ProjectArchive([string]$OutputPath) {
    if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
        throw 'tar is required (built into Windows 10+). Cannot create deploy archive.'
    }
    foreach ($required in @('docker-compose.yml', 'deploy\alibaba-sas\install.sh', 'deploy\alibaba-sas\deploy.sh')) {
        if (-not (Test-Path (Join-Path $AppDir $required))) { throw "Missing $required" }
    }

    $stage = Join-Path $env:TEMP "fluent-tindahan-pack-$([Guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path $stage | Out-Null

    Write-Step 'Packaging project (tar.gz)...'
    if (Test-Path $OutputPath) { Remove-Item $OutputPath -Force }

    try {
        # Never ship local secrets or build output: the server keeps its own generated .env.
        # deploy/alibaba-sas/secrets.env is shipped on purpose and deleted by install.sh after merging.
        & robocopy $AppDir $stage /MIR /NFL /NDL /NJH /NJS /NP `
            /XD node_modules .git .github .agents .vs .idea .run bin obj TestResults coverage dist dev-dist `
                graphify-out .obsidian backups playwright-report test-results (Join-Path $AppDir 'tindahan') `
            /XF *.user .env .env.local docker-compose.override.yml alibaba-sas.env | Out-Null
        if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)." }

        Convert-TextFilesToLf -Root $stage

        Push-Location $stage
        try {
            & tar -czf $OutputPath .
            if ($LASTEXITCODE -ne 0) { throw 'tar packaging failed.' }
        } finally {
            Pop-Location
        }
    } finally {
        Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Get-InstallArgs {
    $installArgs = "--dir $InstallDir --domain $Domain --port $HttpPort --name $ProjectName"
    if ($Pull) { $installArgs += ' --skip-setup' }
    if ($NoProxy) { $installArgs += ' --no-proxy' }
    if ($ModifyDockerCaddy) { $installArgs += ' --modify-docker-caddy' }
    if ($NoBackup) { $installArgs += ' --no-backup' }
    return $installArgs
}

function Invoke-UploadAndInstall {
    $archive = Join-Path $env:TEMP 'fluent-tindahan-deploy.tar.gz'
    New-ProjectArchive -OutputPath $archive

    # Keep the server .env (secrets) and backups/ (pg_dump snapshots); replace everything else.
    $remote = "set -euo pipefail; mkdir -p $InstallDir; " +
              "find $InstallDir -mindepth 1 -maxdepth 1 ! -name .env ! -name backups -exec rm -rf {} +; " +
              "cat > /tmp/fluent-tindahan-deploy.tar.gz; tar -xzf /tmp/fluent-tindahan-deploy.tar.gz -C $InstallDir; rm -f /tmp/fluent-tindahan-deploy.tar.gz; " +
              "chmod +x ${InstallDir}/deploy/alibaba-sas/*.sh; " +
              "cd $InstallDir && /bin/bash deploy/alibaba-sas/install.sh $(Get-InstallArgs)"

    Write-Step 'Uploading and installing via a single SSH session (enter the root password once)...'
    Write-Step "Target: ${ServerIp}:${InstallDir}"

    $sshExe = (Get-Command ssh -ErrorAction Stop).Source
    $argumentList = (Get-SshArgs) + @($remote)
    $proc = Start-Process -FilePath $sshExe -ArgumentList $argumentList -RedirectStandardInput $archive -Wait -PassThru -NoNewWindow
    Remove-Item $archive -Force -ErrorAction SilentlyContinue
    if ($proc.ExitCode -ne 0) { throw "SSH upload/install failed (exit $($proc.ExitCode))." }
}

function Invoke-PullOnly {
    Write-Step 'Re-running install.sh on the server (enter the root password once)...'
    $exitCode = Invoke-Ssh "cd $InstallDir && /bin/bash deploy/alibaba-sas/install.sh $(Get-InstallArgs)"
    if ($exitCode -ne 0) { throw "Remote install failed (exit $exitCode)." }
}

function Test-DeploymentHealth {
    Write-Step "Checking https://${Domain}/api/health ..."
    foreach ($attempt in 1..3) {
        Start-Sleep -Seconds 6
        try {
            $health = Invoke-RestMethod -Uri "https://${Domain}/api/health" -TimeoutSec 20
            Write-Host "Health: $($health.status) (https://${Domain}/api/health)" -ForegroundColor Green
            return
        } catch {
            Write-Step "HTTPS attempt $attempt failed: $($_.Exception.Message)"
        }
    }
    Write-Warning "Not reachable over HTTPS yet. install.sh already verified http://127.0.0.1:${HttpPort}/api/health on the server; check that DNS for $Domain points to $ServerIp (Cloudflare: DNS only) and give Caddy a minute to issue the certificate."
}

if ($PackageOnly) {
    $archive = Join-Path $env:TEMP 'fluent-tindahan-deploy.tar.gz'
    New-ProjectArchive -OutputPath $archive
    & tar -tzf $archive
    Write-Host "Archive: $archive ($([math]::Round((Get-Item $archive).Length / 1KB)) KB)" -ForegroundColor Green
    return
}

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    throw 'OpenSSH Client required. Install via Settings > Apps > Optional features > OpenSSH Client.'
}

Write-Host ''
Write-Host 'Fluent Tindahan - Novastack Alibaba SAS deploy' -ForegroundColor Green
Write-Host "  Server:  $ServerIp"
Write-Host "  Domain:  https://$Domain"
Write-Host "  Folder:  $InstallDir"
Write-Host "  Port:    127.0.0.1:$HttpPort (loopback only; public traffic comes through Caddy)"
Write-Host ''

if ($Pull) {
    Invoke-PullOnly
} else {
    Invoke-UploadAndInstall
}

Test-DeploymentHealth

Write-Host ''
Write-Host 'Deployment complete.' -ForegroundColor Green
Write-Host "  Site:    https://$Domain"
Write-Host "  Health:  https://$Domain/api/health"
Write-Host "  Local:   http://127.0.0.1:${HttpPort} (on the server)"
Write-Host ''
Write-Host "DNS:   tindahan-dev  A  -> $ServerIp (Cloudflare: DNS only until the certificate is issued)"
