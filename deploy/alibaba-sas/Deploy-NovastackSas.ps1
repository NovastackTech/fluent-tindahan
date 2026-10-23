#Requires -Version 5.1
<#
.SYNOPSIS
  One-step deploy of Fluent Tindahan to the Novastack Alibaba SAS.
  Follows GitHub Actions CD: builds Docker containers locally, pushes them to the server,
  uploads deployment configuration (docker-compose.yml + deploy/) and runs install.sh.

.EXAMPLE
  .\deploy-alibaba-sas.cmd

.EXAMPLE
  .\deploy-alibaba-sas-prod.cmd
  Deploy to production (tindahan.novastack-inc.online, /opt/fluent-tindahan-prod, port 8090).

.EXAMPLE
  .\deploy-alibaba-sas.cmd -NoBuild
  Skip local Docker image build and push (use existing images on server).

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
  Server secrets live in /opt/fluent-tindahan/.env or /opt/fluent-tindahan-prod/.env (generated on first install, never overwritten).
  To push PayMongo keys, create the gitignored deploy/alibaba-sas/secrets.env (see secrets.env.example);
  install.sh merges it into the server .env and deletes the uploaded copy.
#>
[CmdletBinding()]
param(
    [Alias('Prod')]
    [switch]$Production,
    [Alias('SkipBuild')]
    [switch]$NoBuild,
    [switch]$Pull,
    [switch]$PullImages,
    [switch]$NoProxy,
    [switch]$ModifyDockerCaddy,
    [switch]$NoBackup,
    [switch]$PackageOnly,
    [string]$SshKeyPath = '',
    [string]$ServerIp = '8.220.128.80',
    [string]$Domain = '',
    [string]$InstallDir = '',
    [int]$HttpPort = 0,
    [string]$ProjectName = '',
    [string]$SshUser = 'root',
    [string]$Registry = '',
    [string]$GoogleClientId = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Novastack Alibaba SAS - deployment target defaults based on environment
if (-not $Domain) {
    $Domain = if ($Production) { 'tindahan.novastack-inc.online' } else { 'tindahan-dev.novastack-inc.online' }
}
if (-not $InstallDir) {
    $InstallDir = if ($Production) { '/opt/fluent-tindahan-prod' } else { '/opt/fluent-tindahan' }
}
if ($HttpPort -le 0) {
    $HttpPort = if ($Production) { 8090 } else { 8089 }
}
if (-not $ProjectName) {
    $ProjectName = if ($Production) { 'fluent-tindahan-prod' } else { 'fluent-tindahan' }
}

$tag = if ($Production) { 'prod' } else { 'latest' }
if ($Registry) {
    $ApiImage = "${Registry}/fluent-tindahan-api:${tag}"
    $WebImage = "${Registry}/fluent-tindahan-web:${tag}"
} else {
    $ApiImage = "fluent-tindahan-api:${tag}"
    $WebImage = "fluent-tindahan-web:${tag}"
}

$ScriptDir = $PSScriptRoot
$AppDir    = (Resolve-Path (Join-Path $ScriptDir '..\..')).Path

if (-not $GoogleClientId) {
    $secretsPath = Join-Path $AppDir 'deploy\alibaba-sas\secrets.env'
    if (Test-Path $secretsPath) {
        $clientIdLine = Get-Content $secretsPath -ErrorAction SilentlyContinue | Where-Object { $_ -match '^GOOGLE_CLIENT_ID=(.+)$' } | Select-Object -First 1
        if ($clientIdLine -and ($clientIdLine -match '^GOOGLE_CLIENT_ID=(.+)$')) {
            $GoogleClientId = $Matches[1].Trim()
        }
    }
}

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

function Invoke-LocalDockerBuild {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker CLI is required to build images locally. Please install Docker Desktop (or ensure docker is in your PATH).'
    }

    Write-Step "Building Backend (API) Docker image locally: $ApiImage..."
    & docker build -t $ApiImage -f (Join-Path $AppDir 'backend\Dockerfile') $AppDir
    if ($LASTEXITCODE -ne 0) { throw "Docker build failed for API ($ApiImage)." }

    Write-Step "Building Frontend (Web) Docker image locally: $WebImage..."
    $webArgs = @('build', '-t', $WebImage, '-f', (Join-Path $AppDir 'frontend\Dockerfile'))
    if ($GoogleClientId) {
        $webArgs += @('--build-arg', "VITE_GOOGLE_CLIENT_ID=$GoogleClientId")
    }
    $webArgs += @($AppDir)
    & docker @webArgs
    if ($LASTEXITCODE -ne 0) { throw "Docker build failed for Web ($WebImage)." }
}

function Invoke-PushImagesToServer {
    if ($Registry) {
        Write-Step "Pushing images to registry: $Registry..."
        & docker push $ApiImage
        if ($LASTEXITCODE -ne 0) { throw "Docker push failed for $ApiImage." }
        & docker push $WebImage
        if ($LASTEXITCODE -ne 0) { throw "Docker push failed for $WebImage." }
    } else {
        $imageArchive = Join-Path $env:TEMP "${ProjectName}-images.tar"
        Write-Step "Saving Docker images locally ($ApiImage, $WebImage)..."
        if (Test-Path $imageArchive) { Remove-Item $imageArchive -Force -ErrorAction SilentlyContinue }

        & docker save -o $imageArchive $ApiImage $WebImage
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $imageArchive)) {
            throw "docker save failed for $ApiImage and $WebImage."
        }

        try {
            Write-Step "Pushing images to server (${ServerIp}) via SSH (docker load with compression)..."
            $sshExe = (Get-Command ssh -ErrorAction Stop).Source
            $argumentList = (Get-SshArgs) + @('-C', 'docker load')
            $proc = Start-Process -FilePath $sshExe -ArgumentList $argumentList -RedirectStandardInput $imageArchive -Wait -PassThru -NoNewWindow
            if ($proc.ExitCode -ne 0) { throw "Failed to load Docker images on the server (exit $($proc.ExitCode))." }
            Write-Step "Docker images successfully pushed and loaded on the server."
        } finally {
            Remove-Item $imageArchive -Force -ErrorAction SilentlyContinue
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

    Write-Step 'Packaging deploy archive (docker-compose.yml and deploy/)...'
    if (Test-Path $OutputPath) { Remove-Item $OutputPath -Force -ErrorAction SilentlyContinue }

    try {
        # Only docker-compose.yml and deploy/ are needed (containers built locally)
        Copy-Item (Join-Path $AppDir 'docker-compose.yml') -Destination (Join-Path $stage 'docker-compose.yml')
        Copy-Item (Join-Path $AppDir 'deploy') -Destination (Join-Path $stage 'deploy') -Recurse

        # Ensure secrets.env in stage has API_IMAGE and WEB_IMAGE configured
        $stageSecrets = Join-Path $stage 'deploy\alibaba-sas\secrets.env'
        $imageLines = @("API_IMAGE=$ApiImage", "WEB_IMAGE=$WebImage")
        if (Test-Path $stageSecrets) {
            $existing = Get-Content $stageSecrets -ErrorAction SilentlyContinue
            $filtered = $existing | Where-Object { $_ -notmatch '^API_IMAGE=' -and $_ -notmatch '^WEB_IMAGE=' }
            Set-Content -Path $stageSecrets -Value ($imageLines + $filtered)
        } else {
            Set-Content -Path $stageSecrets -Value $imageLines
        }

        Convert-TextFilesToLf -Root $stage

        Push-Location $stage
        try {
            & tar -czf $OutputPath docker-compose.yml deploy
            if ($LASTEXITCODE -ne 0) { throw 'tar packaging failed.' }
        } finally {
            Pop-Location
        }
    } finally {
        Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Get-InstallArgs {
    $installArgs = "--dir $InstallDir --domain $Domain --port $HttpPort --name $ProjectName --pull-images"
    if ($Pull) { $installArgs += ' --skip-setup' }
    if ($NoProxy) { $installArgs += ' --no-proxy' }
    if ($ModifyDockerCaddy) { $installArgs += ' --modify-docker-caddy' }
    if ($NoBackup) { $installArgs += ' --no-backup' }
    return $installArgs
}

function Invoke-UploadAndInstall {
    $archive = Join-Path $env:TEMP "${ProjectName}-deploy.tar.gz"
    New-ProjectArchive -OutputPath $archive

    # Keep the server .env (secrets) and backups/ (pg_dump snapshots); replace everything else.
    $remote = "set -euo pipefail; mkdir -p $InstallDir; " +
              "find $InstallDir -mindepth 1 -maxdepth 1 ! -name .env ! -name backups -exec rm -rf {} +; " +
              "cat > /tmp/${ProjectName}-deploy.tar.gz; tar -xzf /tmp/${ProjectName}-deploy.tar.gz -C $InstallDir; rm -f /tmp/${ProjectName}-deploy.tar.gz; " +
              "chmod +x ${InstallDir}/deploy/alibaba-sas/*.sh; " +
              "cd $InstallDir && /bin/bash deploy/alibaba-sas/install.sh $(Get-InstallArgs)"

    Write-Step 'Uploading deployment archive and running install.sh via SSH...'
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
    $archive = Join-Path $env:TEMP "${ProjectName}-deploy.tar.gz"
    New-ProjectArchive -OutputPath $archive
    & tar -tzf $archive
    Write-Host "Archive: $archive ($([math]::Round((Get-Item $archive).Length / 1KB)) KB)" -ForegroundColor Green
    return
}

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    throw 'OpenSSH Client required. Install via Settings > Apps > Optional features > OpenSSH Client.'
}

$targetEnvName = if ($Production) { 'Production' } else { 'Development' }
Write-Host ''
Write-Host "Fluent Tindahan - Novastack Alibaba SAS deploy ($targetEnvName)" -ForegroundColor Green
Write-Host "  Server:   $ServerIp"
Write-Host "  Domain:   https://$Domain"
Write-Host "  Folder:   $InstallDir"
Write-Host "  Port:     127.0.0.1:$HttpPort (loopback only; public traffic comes through Caddy)"
Write-Host "  API Img:  $ApiImage"
Write-Host "  Web Img:  $WebImage"
Write-Host ''

if ($Pull) {
    Invoke-PullOnly
} else {
    if (-not $NoBuild) {
        Invoke-LocalDockerBuild
        Invoke-PushImagesToServer
    }
    Invoke-UploadAndInstall
}

Test-DeploymentHealth

Write-Host ''
Write-Host 'Deployment complete.' -ForegroundColor Green
Write-Host "  Site:    https://$Domain"
Write-Host "  Health:  https://$Domain/api/health"
Write-Host "  Local:   http://127.0.0.1:${HttpPort} (on the server)"
Write-Host ''
$subdomain = $Domain.Split('.')[0]
Write-Host "DNS:   $subdomain  A  -> $ServerIp (Cloudflare: DNS only until the certificate is issued)"
