<#
.SYNOPSIS
    Starts the Fluent Tindahan local development environment (Backend + Frontend).
    Prefer .\run-local.cmd going forward (Novastack standard). This wrapper keeps
    existing docs and start-local.bat working.
#>
& "$PSScriptRoot\scripts\run-local.ps1" @args
