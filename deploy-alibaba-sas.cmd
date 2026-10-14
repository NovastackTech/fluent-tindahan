@echo off
REM One-step deploy to Novastack Alibaba SAS
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-alibaba-sas.ps1" %*
