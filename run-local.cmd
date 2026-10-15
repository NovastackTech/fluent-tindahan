@echo off
REM One-step local run via native .NET + Vite (pass -Docker for containers)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-local.ps1" %*
