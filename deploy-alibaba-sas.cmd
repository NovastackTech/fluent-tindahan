@echo off
REM One-step deploy to Novastack Alibaba SAS (tindahan-dev.novastack-inc.online) - enter root password once
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\alibaba-sas\Deploy-NovastackSas.ps1" %*
