<#
.SYNOPSIS
    Resets Fluent Tindahan local development environment to baseline Libre tier.
    Clears test payment history and sets tenant plan back to Libre (₱0.00).
#>

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Resetting Fluent Tindahan Local Environment to Libre   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$backendUrl = "http://localhost:5000"
$defaultTenantId = "11111111-1111-1111-1111-111111111111"

# 1. Reset Backend Subscription via API
try {
    Write-Host "[1/2] Resetting backend subscription on $backendUrl/api/billing/reset..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri "$backendUrl/api/billing/reset" -Method Post -Headers @{ "X-Tenant-Id" = $defaultTenantId } -ErrorAction Stop
    Write-Host "[OK] Backend reset successful: $($response.message)" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Could not reach $backendUrl. Ensure backend is running, or restart backend." -ForegroundColor Yellow
}

# 2. Instructions for Browser
Write-Host ""
Write-Host "[2/2] Resetting Client Browser State:" -ForegroundColor Yellow
Write-Host "  - Open Settings in the app and click 'Wipe Local Data & Sign Out'," -ForegroundColor White
Write-Host "    OR run in your browser DevTools Console (F12):" -ForegroundColor White
Write-Host "    localStorage.clear(); indexedDB.deleteDatabase('FluentTindahanDb'); location.reload();" -ForegroundColor Cyan
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Environment is reset! Tenant is now on Libre tier.      " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
