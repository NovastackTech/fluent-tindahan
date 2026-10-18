# AGENTS.md — Fluent Tindahan Agent Guidelines

Welcome, AI Agent! This document is your operational manual and architectural guide for contributing to **Fluent Tindahan**. Adhere strictly to the rules, patterns, and conventions detailed below.

---

## 1. Project Overview & Mission

**Fluent Tindahan** 🛒🇵🇭 is an offline-first Progressive Web App (PWA) and retail management platform tailored for Philippine neighborhood stores (sari-sari stores) and GCash cash-in/cash-out agents operating on low-end Android devices under intermittent or absent cellular data.

- **Primary Goal**: Flawless zero-latency local operations (POS, inventory, credit ledger, GCash logs) that queue mutations offline in IndexedDB and synchronize upstream in batches to a .NET 8 Clean Architecture backend when connectivity is available.
- **Project Knowledge Base**: A full Obsidian vault with detailed domain and architectural notes is maintained in [`tindahan/Home.md`](file:///d:/Projects/fluent-tindahan/tindahan/Home.md).

---

## 2. Technology Stack & Key Libraries

### Frontend (`frontend/`)
- **Runtime & Framework**: React 18, Vite 5, TypeScript 5
- **Design System**: Microsoft Fluent UI React v9 (`@fluentui/react-components`, `@fluentui/react-icons`)
- **Styling**: Griffel (`makeStyles`, `shorthands`) using Fluent design tokens (`tokens.*`)
- **Local Database**: Dexie.js 4 (IndexedDB wrapper)
- **Client State**: Zustand (stores in `src/state/`)
- **Offline / PWA**: `vite-plugin-pwa`, Workbox, custom multi-tab `BroadcastChannel` coordinator
- **Testing**: Vitest, `@testing-library/react`, `jsdom`

### Backend (`backend/`)
- **Runtime**: .NET 8 (C# 12)
- **Architecture**: Clean Architecture (Domain, Application, Infrastructure, WebApi)
- **Pattern**: CQRS with MediatR, FluentValidation
- **ORM & Database**: Entity Framework Core 8, PostgreSQL 16 (`Npgsql.EntityFrameworkCore.PostgreSQL`)
- **Testing**: xUnit, FluentAssertions, Moq

---

## 3. Strict Rules & Architectural Invariants

### Rule 1: Local-First / Zero Network Block
Never require an immediate HTTP roundtrip to complete a user action in the till (POS sale, inventory edit, utang credit/payment, GCash entry). 
- Always commit to **Dexie (IndexedDB)** first.
- Append a corresponding mutation payload to the `syncQueue` table in the same local transaction.
- The background `syncEngine.ts` handles pushing batches to `POST /api/sync/batch`.

### Rule 2: Integer Centavo Currency Math
JavaScript floating-point arithmetic (`0.1 + 0.2`) causes rounding drift. 
- In all cart and total calculations, compute in **integer centavos**:
  ```typescript
  const unitCentavos = Math.round(price * 100);
  const subtotalCentavos = unitCentavos * quantity;
  const total = Math.round(items.reduce(...)) / 100;
  ```
- Store amounts in standard two-decimal numeric representation in persistent records.

### Rule 3: Protect Open Sales During PWA Updates
Service worker updates must **never** tear down an open transaction or reload a till tab while an active sale or cart exists:
- `registerServiceWorker.ts` and `pwaTabCoordinator.ts` inspect `cartStore` and tab locks across `BroadcastChannel`.
- If any tab has an active cart (`items.length > 0`) or active sale (`isSaleInProgress`), service worker reloads are deferred.
- Only apply reloads after transactions finish and receipts are dismissed, with a debounce.
- Guard `vite:preloadError` against infinite reload loops offline.

### Rule 4: Append-Only Financial Ledgers
- Financial entities (`Sale`, `SaleItem`, `UtangLedger`, `GCashTxn`) are **append-only**.
- Never update or delete ledger rows in place. Reversals or payments are logged as new entries (`type: 'Payment'`).
- Customer running debt balance is the aggregate: `totalUtangBalance = Sum(Credit) - Sum(Payment)`.

### Rule 5: Client-Generated UUID Primary Keys
- All entities use RFC4122 v4 UUIDs generated on the client via `crypto.randomUUID()`.
- Never rely on server database auto-incrementing serial IDs. Client-generated IDs ensure collision-free offline inserts.

### Rule 6: Multi-Tenant Data Isolation
- Every entity has a `TenantId`.
- On the backend, multi-tenancy is enforced through EF Core Global Query Filters:
  ```csharp
  modelBuilder.Entity<Product>().HasQueryFilter(p => p.TenantId == _currentUserService.TenantId);
  ```

### Rule 7: Git Hygiene
- Never commit `.NET` build artifacts (`bin/`, `obj/`, `TestResults/`), frontend coverage (`coverage/`), or Obsidian cache (`.obsidian/`).
- The root `.gitignore` enforces this. Ensure your working tree stays clean.

---

## 4. Key Directory & File Navigation

```text
fluent-tindahan/
├── AGENTS.md                                    # This guide for AI coding assistants
├── start-local.ps1                              # One-click dev environment startup
├── tindahan/                                    # Obsidian Project Wiki (see Home.md)
│   ├── Home.md                                  # Knowledge base Map of Content
│   ├── 01 - Architecture/                       # System & sync specifications
│   ├── 02 - Domains & Modules/                  # POS, Utang, GCash, Inventory
│   ├── 03 - Technical Reference/                # API contracts, Fluent UI, i18n
│   ├── 04 - Developer Guides/                   # Local setup, testing, CI/CD
│   └── 05 - Sari-Sari Store Ecosystem/          # FMCG catalog and culture
│
├── frontend/                                    # React PWA client
│   ├── src/
│   │   ├── components/                          # Header, Navigation, BarcodeScannerModal, PwaUpdateToast
│   │   ├── db/db.ts                             # Dexie schema & tables (Product, Customer, Sale, SyncQueue)
│   │   ├── i18n/translations.ts                 # English & Tagalog/Filipino dictionaries
│   │   ├── pages/                               # POSPage, InventoryPage, UtangPage, GCashPage, DashboardPage
│   │   ├── pwa/                                 # registerServiceWorker.ts, pwaTabCoordinator.ts
│   │   ├── state/                               # cartStore.ts, pwaStore.ts, themeStore.ts, authStore.ts
│   │   ├── sync/syncEngine.ts                   # Offline queue batch processor
│   │   └── theme/                               # Fluent UI v9 brand themes
│
└── backend/                                     # .NET 8 Web API
    ├── src/
    │   ├── FluentTindahan.Domain/               # Core entities & domain rules
    │   ├── FluentTindahan.Application/          # MediatR CQRS commands & queries
    │   ├── FluentTindahan.Infrastructure/       # EF Core DbContext, Npgsql, migrations
    │   └── FluentTindahan.WebApi/               # Controllers, Swagger, program pipeline
    └── tests/
        └── FluentTindahan.UnitTests/            # xUnit tests for domain and application
```

---

## 5. Standard Development & Verification Commands

### Run Development Servers
```powershell
# Automated launcher (PowerShell)
./start-local.ps1

# Manual Backend (Port 5000)
cd backend/src/FluentTindahan.WebApi
$env:ASPNETCORE_ENVIRONMENT="Development"
dotnet run --urls "http://localhost:5000"

# Manual Frontend (Port 5173)
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

### Run Tests & Validation (Always Run Before Declaring Success)
```powershell
# Frontend Lint & Unit Tests (Vitest)
cd frontend
npm run lint
npm test -- --run

# Backend Unit Tests (.NET xUnit)
cd backend
dotnet test --no-restore

# Frontend Production Build (Validates TypeScript & Bundling)
cd frontend
npm run build

# PWA Offline & Service Worker Verification
cd frontend
npm run preview
```

---

## 6. Philippine Retail Domain Terminology

When implementing features, dialogs, or translations, use authentic terminology:
- **Tindahan**: Neighborhood retail store (sari-sari store).
- **Suki**: Loyal, regular customer; trusted relationship.
- **Tingi**: Unit or fractional micro-retailing (e.g., per stick of cigarette, per sachet of shampoo).
- **Utang**: Informal consumer credit extended on trust.
- **Bayad**: Repayment or settlement of debt / payment for goods.
- **Palista**: Requesting to record a purchase on credit.
- **Sukli**: Change returned to customer after cash payment.
- **Cash-In**: Customer hands cash to store; store transfers GCash digital balance to customer.
- **Cash-Out**: Customer transfers GCash balance to store; store hands cash to customer.


<!-- Ponytail Minimalist Directives -->
# Principles: Minimal Intervention & Zero Bloat
- Make new code the last resort.
- Priority order:
  1. Reuse existing project functions, classes, and utilities (inspect codebase/graph first).
  2. Use runtime/language native APIs and standard libraries.
  3. Smallest possible diff that satisfies the requirement.
- Do not add speculative abstractions, premature interfaces, helper wrappers, or scaffolding for future use.
- Keep diffs tight, reviewable, and localized. Suppress conversational filler and post-change design justifications unless requested.