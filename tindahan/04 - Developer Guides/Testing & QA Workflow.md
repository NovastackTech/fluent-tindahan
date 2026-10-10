---
title: Testing & QA Workflow
tags: [guide, testing, vitest, xunit, pwa, qa]
updated: 2026-10-10
---

# 🧪 Testing & QA Workflow

Fluent Tindahan maintains high automated test coverage across both frontend (React / Dexie / PWA) and backend (.NET 8 Clean Architecture) layers.

---

## 1. Frontend Test Suite (Vitest)

Frontend tests use **Vitest** with `@testing-library/react` and `jsdom`.

```powershell
cd frontend
# Run all tests once
npm test -- --run

# Run in interactive watch mode
npm test

# Run with code coverage report
npm test -- --coverage
```

### Coverage Scope:
- **35 test files / 197+ unit & integration tests**.
- **Components**: `Header`, `Navigation`, `BarcodeScannerModal`, `PwaUpdateToast`, `PwaInstallBanner`, `OfflineSyncBanner`, `PrivacyConsentDialog`.
- **Pages**: `POSPage`, `InventoryPage`, `UtangPage`, `GCashPage`, `DashboardPage`, `SettingsPage`, `ImportPage`.
- **State Stores**: `cartStore` (centavo precision, persistence), `pwaStore`, `themeStore`, `languageStore`, `authStore`, `printerStore`.
- **PWA & Sync**: `registerServiceWorker` (safe deferral), `pwaTabCoordinator` (multi-tab BroadcastChannel), `syncEngine` (batching, retry backoff, DLQ).

---

## 2. Backend Test Suite (xUnit)

Backend tests reside in `backend/tests/FluentTindahan.UnitTests/`.

```powershell
cd backend
dotnet test --no-restore
```

### Coverage Scope:
- **36 unit tests**.
- **Domain Entities**: Utang ledger rules, decimal calculation consistency, GCash fee rules, tenant validation.
- **Application Commands**: `ProcessBatchCommand`, `CreateSaleCommand`, `AppendUtangEntryCommand`.
- **Validation**: `FluentValidation` rule verification.

---

## 3. PWA Multi-Tab Simulation Test

To manually test multi-tab update protection:
1. Open `http://localhost:4173` in two separate browser tabs.
2. In Tab A, add an item to the POS cart.
3. Simulate a service worker update in DevTools (or trigger a new build).
4. Verify that Tab A and Tab B receive the update notification, but **neither tab reloads automatically** while Tab A has items in the cart.
5. In Tab A, complete the sale or clear the cart.
6. Verify that the update debounce activates and smoothly refreshes the app.

---

## 4. Test Plan Documentation

For manual QA and release verification, refer to the formal test plan in the repository root:
- `Fluent_Tindahan_Functional_Test_Plan.pdf` (Covers test matrices for POS, Barcodes, Inventory, Utang, GCash, Sync, and Thermal Printing).

---

## Related Notes
- [[Getting Started & Local Setup]] — Setting up dependencies.
- [[Offline-First & Sync Engine]] — Sync test scenarios.
- [[PWA & Service Worker]] — Update lifecycle edge cases.
