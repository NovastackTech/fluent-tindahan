# Graph Report - fluent-tindahan  (2026-10-15)

## Corpus Check
- 233 files · ~145,739 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 4, .css 2, .http 1)

## Summary
- 1754 nodes · 4995 edges · 106 communities (94 shown, 12 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 620 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `14d4cad3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- FluentTindahan.Domain.Entities
- App.tsx
- PlanTier
- useTranslation
- .Provision
- SyncOperationDto
- ActionResult
- languageStore.ts
- ProcessBatchSyncCommandHandler
- MigrationBuilder
- authStore.ts
- 🛒 Point of Sale (POS)
- http
- db.ts
- .Handle
- FluentTindahan.UnitTests.csproj
- Fact
- syncEngine.ts
- Task
- 2.1 Server-Side PostgreSQL Schema (`AppDbContext`)
- capture_real_screenshots.py
- .HandleException
- ICurrentUserService
- compilerOptions
- .Handlers_RejectEmptyTenant_ThrowsUnauthorizedAccessException
- ReceiptModal.tsx
- SaleItem
- package.json
- setup.ts
- compilerOptions
- IRequest
- ApplySubscriptionPaymentCommand
- IApplicationDbContext
- List
- User
- Tenant
- devDependencies
- Sale
- PaymentHistory
- Product
- dependencies
- 2.1 Server-Side PostgreSQL Schema (`AppDbContext`)
- GCashTxn
- UtangLedger
- AppDbContext
- SaleSyncPayload
- BatchSyncResultDto
- Customer
- themeStore.ts
- .GetDashboardSummary_CalculatesAccurateAggregations
- GCashTxnSyncPayload
- coverage-summary.js
- ProductSyncPayload
- UtangLedgerSyncPayload
- Implementation Plan: Onboarding & Store Profile Setup Dialog
- .ProcessBatchSync_AppendOnlyUtang_UpdatesCustomerBalance
- scripts
- PaymentWebhookOutcome
- BatchSyncCounters
- .oxlintrc.json
- mockPwaRegister.ts
- vite.config.ts
- CustomerSyncPayload
- main.tsx
- tsconfig.json
- rules.md
- Offline-First PWA Architecture Plan
- IRequestHandler
- AGENTS.md — Fluent Tindahan Agent Guidelines
- AGENTS.md — Fluent Tindahan Agent Guidelines
- DateTimeOffset
- Fluent Tindahan 🛒🇵🇭
- 🗄️ Database Schemas
- 🧭 Vault Navigation
- 📱 PWA & Service Worker Architecture
- 🏛️ Architecture Decision Record: {{title}}
- 3. Strict Rules & Architectural Invariants
- 🔄 Offline-First & Sync Engine
- 📒 Utang Ledger (Customer Credit)
- 🛠️ Getting Started & Local Setup
- 1. The Core Pillars of Sari-Sari Commerce
- 1. Tiers & Feature Breakdown
- 🐛 Bug Report: {{title}}
- SaleItemSyncPayload
- .AppDbContext_HasNoPendingModelChanges
- 📱 GCash Agent System
- 📦 Inventory & Tingi Management
- 🎨 Frontend Architecture & State
- 🧪 Testing & QA Workflow
- 🖨️ Thermal Printing & Hardware Integration
- 🇵🇭 Internationalization (i18n) & Localization
- 🔒 Security & Privacy (RA 10173 Compliance)
- 🚀 CI-CD & Deployment
- 🚀 Feature Spec: {{title}}
- 📊 Dashboard & Analytics
- ⚙️ Backend Web API (.NET 8)
- 📋 Product Catalog Reference
- IAuditableEntity
- React + TypeScript + Vite
- POS BIR Accreditation.md
- useIsDesktop.test.ts
- 📐 System Architecture

## God Nodes (most connected - your core abstractions)
1. `ProcessBatchSyncCommandHandler` - 61 edges
2. `AppDbContext` - 59 edges
3. `BillingTests` - 56 edges
4. `vitest` - 49 edges
5. `useAuthStore` - 49 edges
6. `SyncOperationDto` - 46 edges
7. `BatchSyncRequestDto` - 45 edges
8. `ProcessBatchSyncCommand` - 44 edges
9. `Customer` - 44 edges
10. `IApplicationDbContext` - 43 edges

## Surprising Connections (you probably didn't know these)
- `Coverage Scope:` --references--> `CreateSaleCommand`  [INFERRED]
  tindahan/04 - Developer Guides/Testing & QA Workflow.md → backend/src/FluentTindahan.Application/Sales/SaleCommandsQueries.cs
- `1. System Overview & Dual-Database Architecture` --references--> `AppDbContext`  [INFERRED]
  Subscription_and_Billing_Support_Runbook.md → backend/src/FluentTindahan.Infrastructure/Persistence/AppDbContext.cs
- `1. System Overview & Dual-Database Architecture` --references--> `AppDbContext`  [INFERRED]
  tindahan/04 - Developer Guides/Subscription Management & Billing Runbook.md → backend/src/FluentTindahan.Infrastructure/Persistence/AppDbContext.cs
- `Phase 2: Payment Gateway Integration (Infrastructure)` --references--> `IPaymentGatewayService`  [INFERRED]
  SaaS Subs Plan.md → backend/src/FluentTindahan.Application/Common/Interfaces/IPaymentGatewayService.cs
- `Phase 3: Checkout API & MediatR Pipeline (Application/Web API)` --references--> `IPaymentGatewayService`  [INFERRED]
  SaaS Subs Plan.md → backend/src/FluentTindahan.Application/Common/Interfaces/IPaymentGatewayService.cs

## Import Cycles
- None detected.

## Communities (106 total, 12 thin omitted)

### Community 0 - "FluentTindahan.Domain.Entities"
Cohesion: 0.05
Nodes (28): PhilippineMobileNumber, DatabaseSeeder, AuthorizationPolicies, FluentTindahan.WebApi.Middleware, FluentTindahan.Application.Products, FluentTindahan.Application.Dashboard, FluentTindahan.Application.Sync.Commands, FluentTindahan.WebApi.Authorization (+20 more)

### Community 1 - "App.tsx"
Cohesion: 0.08
Nodes (43): App(), DashboardPage, GCashPage, getInitialNavTab(), ImportPage, InventoryPage, POSPage, SettingsPage (+35 more)

### Community 2 - "PlanTier"
Cohesion: 0.06
Nodes (29): CheckoutSessionResponseDto, CreateCheckoutSessionCommand, CreateCheckoutSessionCommandHandler, GetTenantSubscriptionQuery, GetTenantSubscriptionQueryHandler, TenantSubscriptionDto, CheckoutSessionResult, IPaymentGatewayService (+21 more)

### Community 3 - "useTranslation"
Cohesion: 0.10
Nodes (46): BarcodeScannerModal(), BarcodeScannerModalProps, useStyles, Navigation(), NavigationProps, NavTab, useStyles, QuickRegisterProductDialog() (+38 more)

### Community 4 - ".Provision"
Cohesion: 0.11
Nodes (8): ProvisionTenantRequest, BusinessName, Phone, UserId, ProvisionTenantResponse, TenantController, ProvisionRaceDbContext, SyncControllerTests

### Community 5 - "SyncOperationDto"
Cohesion: 0.21
Nodes (10): BatchSyncRequestDto, DeviceId, Operations, SyncOperationDto, Action, Entity, Payload, SyncId (+2 more)

### Community 6 - "ActionResult"
Cohesion: 0.13
Nodes (11): GetPaymentHistoryQuery, GetPaymentHistoryQueryHandler, PaymentHistoryDto, DatabaseMigrator, CustomersController, DashboardController, HealthController, ProductsController (+3 more)

### Community 7 - "languageStore.ts"
Cohesion: 0.11
Nodes (27): DisclaimerModal(), useStyles, PrivacyConsentDialog(), useStyles, TermsModal(), renderModal(), useStyles, Language (+19 more)

### Community 8 - "ProcessBatchSyncCommandHandler"
Cohesion: 0.28
Nodes (3): ProcessBatchSyncCommand, ProcessBatchSyncCommandHandler, BillingTests

### Community 9 - "MigrationBuilder"
Cohesion: 0.17
Nodes (4): AddBillingSubscriptions, AddProductIsDeleted, AddCustomerIsDeleted, AddGCashRefNoNorm

### Community 10 - "authStore.ts"
Cohesion: 0.18
Nodes (17): OnboardingModal(), useStyles, DEMO_BUSINESS_NAME, DEMO_OWNER, DEMO_PHONE, DEFAULT_TENANT_ID, DEFAULT_USER_ID, seedDexieDatabaseIfNeeded() (+9 more)

### Community 11 - "🛒 Point of Sale (POS)"
Cohesion: 0.22
Nodes (9): SaleItemRecord, SaleRecord, 1. Barcode Scanning & Item Lookup, 2. Cart Calculation & Centavo Precision, 3. Cart Crash & Reload Persistence, 4. Payment Methods & Checkout Flow, 5. Sale Completion & Receipt Generation, 🛒 Point of Sale (POS) (+1 more)

### Community 12 - "http"
Cohesion: 0.07
Nodes (28): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, launchUrl, applicationUrl (+20 more)

### Community 13 - "db.ts"
Cohesion: 0.12
Nodes (35): mockApplyVideoConstraints, mockClear, mockStart, mockStop, SubscriptionModal(), useStyles, db, DeadLetterRecord (+27 more)

### Community 14 - ".Handle"
Cohesion: 0.18
Nodes (10): DuplicateGCashRefException, RefNo, GCashTxnDto, GetGCashTransactionsQuery, GetGCashTransactionsQueryHandler, RecordGCashTxnCommand, RecordGCashTxnCommandHandler, GCashController (+2 more)

### Community 15 - "FluentTindahan.UnitTests.csproj"
Cohesion: 0.07
Nodes (28): net8.0, Microsoft.NET.Sdk, net8.0, Microsoft.NET.Sdk, net8.0, Microsoft.EntityFrameworkCore.Design (8.0.10), Microsoft.NET.Sdk, net8.0 (+20 more)

### Community 16 - "Fact"
Cohesion: 0.13
Nodes (7): CurrentUserService, FirebaseUid, IsAuthenticated, Role, TenantId, UserId, InfrastructureTests

### Community 17 - "syncEngine.ts"
Cohesion: 0.11
Nodes (37): Header(), useStyles, OfflineSyncBanner(), useStyles, getSyncStorageKey(), STORAGE_KEY_LAST_SYNCED, SyncQueueRecord, SettingsPage() (+29 more)

### Community 18 - "Task"
Cohesion: 0.09
Nodes (4): TenantResolvedHandler, TenantResolvedRequirement, DnsFailureHandler, TenantResolvedAuthorizationTests

### Community 19 - "2.1 Server-Side PostgreSQL Schema (`AppDbContext`)"
Cohesion: 0.07
Nodes (27): 1. System Overview & Dual-Database Architecture, 2.1 Server-Side PostgreSQL Schema (`AppDbContext`), 2.2 Client-Side IndexedDB Schema (`FluentTindahanDb`), 2. Complete Database Schema Reference, 3. Subscription Tiers & Capabilities, 4. Production Billing Flow (PayMongo), 5. Support Runbook: Resolving Uncredited Payments, 6. Summary Reference Sheet (+19 more)

### Community 20 - "capture_real_screenshots.py"
Cohesion: 0.12
Nodes (5): capture_tab(), main(), create_fluent_tindahan_icon(), create_screenshots(), main()

### Community 21 - ".HandleException"
Cohesion: 0.14
Nodes (9): PaymentGatewayException, ConcurrencyConflictException, DomainException, EntityNotFoundException, ValidationException, Errors, ApiExceptionHandler, ApiExceptionHandlerTests (+1 more)

### Community 22 - "ICurrentUserService"
Cohesion: 0.18
Nodes (13): GetUtangLedgerQuery, GetUtangLedgerQueryHandler, RecordUtangCommand, RecordUtangCommandHandler, UtangLedgerDto, ICurrentUserService, FirebaseUid, IsAuthenticated (+5 more)

### Community 23 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 24 - ".Handlers_RejectEmptyTenant_ThrowsUnauthorizedAccessException"
Cohesion: 0.24
Nodes (8): CreateProductCommand, CreateProductCommandHandler, GetProductsQuery, GetProductsQueryHandler, ProductDto, ProductHandlerTests, 2. API Endpoints Reference, Tenant ID Reconciliation

### Community 25 - "ReceiptModal.tsx"
Cohesion: 0.23
Nodes (15): ReceiptData, ReceiptModal(), ReceiptModalProps, useStyles, BluetoothPrintResult, generateEscPosReceipt(), generateThermalReceiptHtml(), isBluetoothPrintSupported() (+7 more)

### Community 27 - "SaleItem"
Cohesion: 0.11
Nodes (19): 3. Strict Rules & Architectural Invariants, Rule 1: Local-First / Zero Network Block, Rule 2: Integer Centavo Currency Math, Rule 3: Protect Open Sales During PWA Updates, Rule 4: Append-Only Financial Ledgers, Rule 5: Client-Generated UUID Primary Keys, Rule 6: Multi-Tenant Data Isolation, Rule 7: Git Hygiene (+11 more)

### Community 28 - "package.json"
Cohesion: 0.12
Nodes (15): name, private, type, version, axios, html5-qrcode, jsdom, oxlint (+7 more)

### Community 29 - "setup.ts"
Cohesion: 0.12
Nodes (7): localStorageMock, MockAudioContext, MockBroadcastChannel, MockResizeObserver, sessionStorageMock, fake-indexeddb, @testing-library/jest-dom

### Community 30 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 31 - "IRequest"
Cohesion: 0.26
Nodes (6): CreateCustomerCommand, CreateCustomerCommandHandler, CustomerDto, GetCustomersQuery, GetCustomersQueryHandler, CustomerHandlerTests

### Community 32 - "ApplySubscriptionPaymentCommand"
Cohesion: 0.18
Nodes (6): ApplySubscriptionPaymentCommand, ApplySubscriptionPaymentCommandHandler, ProcessPaymentWebhookCommand, ProcessPaymentWebhookCommandHandler, WebhookProcessResultDto, Success

### Community 33 - "IApplicationDbContext"
Cohesion: 0.15
Nodes (11): IApplicationDbContext, ChangeTracker, Customers, GCashTransactions, PaymentHistories, Products, SaleItems, Sales (+3 more)

### Community 34 - "List"
Cohesion: 0.30
Nodes (9): CreateSaleCommand, CreateSaleCommandHandler, CreateSaleItemInput, GetSalesQuery, GetSalesQueryHandler, SaleDto, SaleItemDto, SalesController (+1 more)

### Community 35 - "User"
Cohesion: 0.12
Nodes (9): User, CreatedAt, FirebaseUid, Id, Phone, Role, Tenant, TenantId (+1 more)

### Community 36 - "Tenant"
Cohesion: 0.10
Nodes (20): Tenant, BusinessName, CreatedAt, Customers, ExternalCustomerId, GCashTransactions, Id, PaymentHistories (+12 more)

### Community 37 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, fake-indexeddb, jsdom, oxlint, @testing-library/jest-dom, @testing-library/react, @types/node, @types/papaparse (+7 more)

### Community 38 - "Sale"
Cohesion: 0.14
Nodes (14): Sale, CashReceived, ChangeGiven, Customer, CustomerId, Date, Id, Items (+6 more)

### Community 39 - "PaymentHistory"
Cohesion: 0.14
Nodes (14): IMustHaveTenant, TenantId, PaymentHistory, AmountCentavos, BillingCycle, CreatedAt, Currency, GatewayReferenceId (+6 more)

### Community 40 - "Product"
Cohesion: 0.13
Nodes (15): Product, Barcode, Category, Cost, Id, IsDeleted, Name, Price (+7 more)

### Community 41 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, axios, dexie, dexie-react-hooks, @fluentui/react-components, @fluentui/react-icons, html5-qrcode, papaparse (+5 more)

### Community 42 - "2.1 Server-Side PostgreSQL Schema (`AppDbContext`)"
Cohesion: 0.07
Nodes (27): 1. System Overview & Dual-Database Architecture, 2.1 Server-Side PostgreSQL Schema (`AppDbContext`), 2.2 Client-Side IndexedDB Schema (`FluentTindahanDb`), 2. Complete Database Schema Reference, 3. Subscription Tiers & Capabilities, 4. Production Billing Flow (PayMongo), 5. Support Runbook: Resolving Uncredited Payments, 6. Summary Reference Sheet (+19 more)

### Community 43 - "GCashTxn"
Cohesion: 0.12
Nodes (16): GCashTxn, Amount, CustomerPhone, Date, Fee, Id, Notes, RefNo (+8 more)

### Community 44 - "UtangLedger"
Cohesion: 0.17
Nodes (12): UtangLedger, Amount, Customer, CustomerId, Date, Id, Notes, RefSale (+4 more)

### Community 45 - "AppDbContext"
Cohesion: 0.13
Nodes (11): AppDbContext, Customers, GCashTransactions, PaymentHistories, Products, SaleItems, Sales, Tenants (+3 more)

### Community 46 - "SaleSyncPayload"
Cohesion: 0.18
Nodes (10): SaleSyncPayload, CashReceived, ChangeGiven, CustomerId, Date, Id, Items, PaymentMethod (+2 more)

### Community 47 - "BatchSyncResultDto"
Cohesion: 0.25
Nodes (8): BatchSyncResultDto, ConflictCount, ProcessedCount, Results, SyncItemResultDto, Error, Status, SyncId

### Community 48 - "Customer"
Cohesion: 0.13
Nodes (14): Customer, Id, IsDeleted, Name, Phone, Tenant, TenantId, TotalUtangBalance (+6 more)

### Community 49 - "themeStore.ts"
Cohesion: 0.33
Nodes (8): computeIsDark(), getInitialMode(), getSystemDarkMode(), initialDark, initialMode, initThemeMediaListener(), ThemeMode, ThemeState

### Community 50 - ".GetDashboardSummary_CalculatesAccurateAggregations"
Cohesion: 0.53
Nodes (4): DashboardSummaryDto, GetDashboardSummaryQuery, GetDashboardSummaryQueryHandler, DashboardHandlerTests

### Community 51 - "GCashTxnSyncPayload"
Cohesion: 0.22
Nodes (9): GCashTxnSyncPayload, Amount, CustomerPhone, Date, Fee, Id, Notes, RefNo (+1 more)

### Community 53 - "coverage-summary.js"
Cohesion: 0.22
Nodes (5): backendXml, fs, getLatestCoberturaXml(), walk(), path

### Community 54 - "ProductSyncPayload"
Cohesion: 0.25
Nodes (8): ProductSyncPayload, Barcode, Category, Cost, Id, Name, Price, StockQty

### Community 55 - "UtangLedgerSyncPayload"
Cohesion: 0.25
Nodes (8): UtangLedgerSyncPayload, Amount, CustomerId, Date, Id, Notes, RefSaleId, Type

### Community 56 - "Implementation Plan: Onboarding & Store Profile Setup Dialog"
Cohesion: 0.11
Nodes (18): 1. State Management & Persistence (`frontend/src/state/authStore.ts`), 2. Database & Seed Catalog Configuration (`frontend/src/db/seedData.ts`), 3. Internationalization Dictionaries (`frontend/src/i18n/translations.ts`), 4. Onboarding Dialog Component (`frontend/src/components/OnboardingModal.tsx`), 5. App Integration & Settings Page Integration, Architecture & User Journey Flow, Automated Tests, Goal Description (+10 more)

### Community 58 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, preview, test, test:coverage

### Community 59 - "PaymentWebhookOutcome"
Cohesion: 0.33
Nodes (6): PaymentWebhookOutcome, Duplicate, Ignored, InvalidSignature, Processed, Rejected

### Community 60 - "BatchSyncCounters"
Cohesion: 0.22
Nodes (6): BatchSyncCounters, CustomerCount, MonthlyGCashCount, ProductCount, RejectedCustomerIds, RejectedProductIds

### Community 61 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 62 - "mockPwaRegister.ts"
Cohesion: 0.33
Nodes (5): lastRegisterSWOptions, mockUpdateSW, registerSW, RegisterSWOptions, updateSW

### Community 63 - "vite.config.ts"
Cohesion: 0.33
Nodes (3): vite, vite-plugin-pwa, @vitejs/plugin-react

### Community 64 - "CustomerSyncPayload"
Cohesion: 0.40
Nodes (5): CustomerSyncPayload, Id, Name, Phone, TotalUtangBalance

### Community 70 - "Offline-First PWA Architecture Plan"
Cohesion: 0.14
Nodes (13): 10. Phased Roadmap (1-Month MVP), 11. Major Risks and Mitigations, 1. Tech Stack & Trade-offs, 2. System Architecture, 3. Database Schema (PostgreSQL via EF Core), 4. Authentication Integration (Firebase), 6. Data Migration / Import Design, 7. UI Design & Key Screens (Fluent UI) (+5 more)

### Community 72 - "AGENTS.md — Fluent Tindahan Agent Guidelines"
Cohesion: 0.18
Nodes (10): 1. Project Overview & Mission, 2. Technology Stack & Key Libraries, 4. Key Directory & File Navigation, 5. Standard Development & Verification Commands, 6. Philippine Retail Domain Terminology, AGENTS.md — Fluent Tindahan Agent Guidelines, Backend (`backend/`), Frontend (`frontend/`) (+2 more)

### Community 73 - "AGENTS.md — Fluent Tindahan Agent Guidelines"
Cohesion: 0.18
Nodes (10): 1. Project Overview & Mission, 2. Technology Stack & Key Libraries, 4. Key Directory & File Navigation, 5. Standard Development & Verification Commands, 6. Philippine Retail Domain Terminology, AGENTS.md — Fluent Tindahan Agent Guidelines, Backend (`backend/`), Frontend (`frontend/`) (+2 more)

### Community 75 - "Fluent Tindahan 🛒🇵🇭"
Cohesion: 0.20
Nodes (9): 1. Backend Web API (.NET 8 + PostgreSQL), 2. Frontend PWA (React + Vite + Fluent UI v9), 3. Testing PWA Offline & Service Worker (`vite build && vite preview`), 📦 Features & Data, Fluent Tindahan 🛒🇵🇭, Offline-First Sari-Sari & GCash Management System, Option 1: One-Click Startup, Option 2: Manual Startup (+1 more)

### Community 76 - "🗄️ Database Schemas"
Cohesion: 0.20
Nodes (10): 1. Client-Side Dexie Schema (`db.ts`), 2. Server-Side PostgreSQL Schema (EF Core), 3. ID Generation & Offline Safety, Customers & Utang (`customers` & `utangLedger`), 🗄️ Database Schemas, GCash Log (`gcashTxns`), POS Sales (`sales` & `saleItems`), Products (`products`) (+2 more)

### Community 77 - "🧭 Vault Navigation"
Cohesion: 0.20
Nodes (10): 📐 [[01 - Architecture|01 — Architecture & Core Systems]], 🏪 [[02 - Domains & Modules|02 — Business Domains & Store Operations]], ⚙️ [[03 - Technical Reference|03 — Technical Specifications]], 🛠️ [[04 - Developer Guides|04 — Developer Onboarding & Workflows]], 🇵🇭 [[05 - Sari-Sari Store Ecosystem|05 — Sari-Sari Store Context]], 📝 Document Templates, 🛒 Fluent Tindahan — Knowledge Base & Project Wiki, 🗺️ Map of Content (MOC) (+2 more)

### Community 78 - "📱 PWA & Service Worker Architecture"
Cohesion: 0.22
Nodes (9): 1. Web App Manifest & App Identity, 2. Service Worker Lifecycle & Safe Update Deferral, 3. Dynamic Chunk Loading & Preload Error Guard, 4. Install Prompt UX (`pwaStore.ts`), 5. Development Mode vs Production, Icon Assets & Screenshots, Multi-Tab Coordination (`pwaTabCoordinator.ts`), 📱 PWA & Service Worker Architecture (+1 more)

### Community 79 - "🏛️ Architecture Decision Record: {{title}}"
Cohesion: 0.22
Nodes (8): 1. Context & Problem Statement, 2. Considered Options, 3. Decision Outcome, 4. Consequences & Trade-offs, 5. Compliance & Verification, 🏛️ Architecture Decision Record: {{title}}, Negative Consequences / Mitigations:, Positive Consequences:

### Community 80 - "3. Strict Rules & Architectural Invariants"
Cohesion: 0.25
Nodes (8): 3. Strict Rules & Architectural Invariants, Rule 1: Local-First / Zero Network Block, Rule 2: Integer Centavo Currency Math, Rule 3: Protect Open Sales During PWA Updates, Rule 4: Append-Only Financial Ledgers, Rule 5: Client-Generated UUID Primary Keys, Rule 6: Multi-Tenant Data Isolation, Rule 7: Git Hygiene

### Community 81 - "🔄 Offline-First & Sync Engine"
Cohesion: 0.25
Nodes (8): 1. Client-Side Mutation Tracking, 2. Sync Engine Orchestration (`syncEngine.ts`), 4. Poison Pill Prevention & Dead-Letter Queue (DLQ), 5. Server-Side Batch Handling, Batch Processing Rules, 🔄 Offline-First & Sync Engine, Related Notes, `syncQueue` Record Format

### Community 82 - "📒 Utang Ledger (Customer Credit)"
Cohesion: 0.25
Nodes (8): 1. Ledger Data Mechanics, 2. Customer Credit Lifecycle, 3. Aging & Collection Alerts, A. Customer Onboarding, B. Charging to Utang at Checkout, C. Recording Payments ("Bayad"), Related Notes, 📒 Utang Ledger (Customer Credit)

### Community 83 - "🛠️ Getting Started & Local Setup"
Cohesion: 0.25
Nodes (8): 1. Prerequisites, 2. One-Click Startup (Windows), 3. Manual Component Startup, 4. Testing PWA Offline & Service Worker, A. Backend Web API (.NET 8), B. Frontend PWA (React + Vite), 🛠️ Getting Started & Local Setup, Related Notes

### Community 84 - "1. The Core Pillars of Sari-Sari Commerce"
Cohesion: 0.25
Nodes (8): 1. The Core Pillars of Sari-Sari Commerce, 2. Design Principles for Localized Software, A. The "Tingi" Culture (Micro-Packaging), B. The "Suki" System (Patronage & Social Capital), C. The "Utang" Safety Net, D. The Modern Digital Shift (GCash & E-Wallets), 🇵🇭 Philippine Retail Culture & Ecosystem, Related Notes

### Community 85 - "1. Tiers & Feature Breakdown"
Cohesion: 0.25
Nodes (7): 1. Tiers & Feature Breakdown, 2. Feature Comparison Matrix, 3. Conversion Triggers & Monetization Strategy, Libre Tier (Free Forever), Negosyo Plus, Pricing Model & Monetization Strategy, Tindahan Pro

### Community 86 - "🐛 Bug Report: {{title}}"
Cohesion: 0.25
Nodes (7): 1. Description, 2. Steps to Reproduce, 3. Expected vs Actual Behavior, 4. Environment & Context, 5. Logs & Error Traces, 6. Root Cause Analysis (RCA) & Proposed Fix, 🐛 Bug Report: {{title}}

### Community 87 - "SaleItemSyncPayload"
Cohesion: 0.29
Nodes (7): SaleItemSyncPayload, Id, ProductId, ProductName, Qty, Subtotal, UnitPrice

### Community 89 - "📱 GCash Agent System"
Cohesion: 0.29
Nodes (7): 1. Cash-In vs Cash-Out Mechanics, 2. Configurable Convenience Fees, 3. Reference Number Audit Log, 4. End-of-Day Float Reconciliation, Duplicate references reported during sync, 📱 GCash Agent System, Related Notes

### Community 90 - "📦 Inventory & Tingi Management"
Cohesion: 0.29
Nodes (7): 1. The "Tingi" Retail Mechanism, 2. Default Sari-Sari Catalog, 3. CSV Import & Bulk Synchronization (`ImportPage.tsx`), 4. Reorder Alerts & Low Stock Monitoring, 📦 Inventory & Tingi Management, Margin Multipliers in Tingi, Related Notes

### Community 91 - "🎨 Frontend Architecture & State"
Cohesion: 0.29
Nodes (7): 1. UI Design System: Fluent UI React v9, 2. State Management Architecture (Zustand), 3. Directory Layout, Brand Theme Customization, 🎨 Frontend Architecture & State, Related Notes, Store Responsibilities

### Community 92 - "🧪 Testing & QA Workflow"
Cohesion: 0.29
Nodes (7): 1. Frontend Test Suite (Vitest), 2. Backend Test Suite (xUnit), 3. PWA Multi-Tab Simulation Test, 4. Test Plan Documentation, Coverage Scope:, Related Notes, 🧪 Testing & QA Workflow

### Community 93 - "🖨️ Thermal Printing & Hardware Integration"
Cohesion: 0.33
Nodes (6): 1. Supported Connection Modes, 2. ESC/POS Command Protocol, 3. Receipt Layout Specifications, Related Notes, Sample 58mm POS Receipt, 🖨️ Thermal Printing & Hardware Integration

### Community 94 - "🇵🇭 Internationalization (i18n) & Localization"
Cohesion: 0.33
Nodes (5): 1. Colloquial Retail Vocabulary, 2. Currency & Number Formatting, 3. Implementation (`src/i18n/translations.ts`), 🇵🇭 Internationalization (i18n) & Localization, Related Notes

### Community 95 - "🔒 Security & Privacy (RA 10173 Compliance)"
Cohesion: 0.33
Nodes (6): 1. Data Privacy Consent Dialog (`PrivacyConsentDialog.tsx`), 2. Customer PII & Debt Stigmatization Protection, 3. Multi-Tenant Isolation (Server Security), Protective Features:, Related Notes, 🔒 Security & Privacy (RA 10173 Compliance)

### Community 96 - "🚀 CI-CD & Deployment"
Cohesion: 0.33
Nodes (6): 1. Continuous Integration (`ci.yml`), 2. Production Hosting Architecture, 🚀 CI-CD & Deployment, Hosting Strategy:, Pipeline Jobs:, Related Notes

### Community 97 - "🚀 Feature Spec: {{title}}"
Cohesion: 0.33
Nodes (5): 1. Problem Statement & User Value, 2. User Stories & Acceptance Criteria, 4. Technical Implementation, 5. Test Scenarios, 🚀 Feature Spec: {{title}}

### Community 98 - "📊 Dashboard & Analytics"
Cohesion: 0.40
Nodes (5): 1. Primary Store KPI Tiles, 2. Quick Action Launcher, 3. Fast-Moving Items & Category Breakdown, 📊 Dashboard & Analytics, Related Notes

### Community 99 - "⚙️ Backend Web API (.NET 8)"
Cohesion: 0.40
Nodes (5): 1. Project Structure, 3. The Batch Sync Command (`ProcessBatchCommand`), ⚙️ Backend Web API (.NET 8), Handler Execution Flow:, Related Notes

### Community 100 - "📋 Product Catalog Reference"
Cohesion: 0.40
Nodes (5): 1. Major FMCG Manufacturers Represented, 2. Product Categories & Average Retail Margins, 3. Barcode Standard (EAN-13), 📋 Product Catalog Reference, Related Notes

### Community 101 - "IAuditableEntity"
Cohesion: 0.50
Nodes (3): IAuditableEntity, CreatedAt, UpdatedAt

### Community 102 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 103 - "POS BIR Accreditation.md"
Cohesion: 0.50
Nodes (3): Phase 1: Ensure Your POS Meets BIR Technical Standards, Phase 2: The Accreditation Process, Phase 3: Client Deployment (Permit to Use)

### Community 105 - "📐 System Architecture"
Cohesion: 0.67
Nodes (3): Key Components, Related Notes, 📐 System Architecture

## Knowledge Gaps
- **240 isolated node(s):** `Processed`, `Duplicate`, `Ignored`, `InvalidSignature`, `Rejected` (+235 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 716 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CreateSaleCommand` connect `List` to `FluentTindahan.Domain.Entities`, `.Handlers_RejectEmptyTenant_ThrowsUnauthorizedAccessException`, `Guid`, `🧪 Testing & QA Workflow`, `IRequest`?**
  _High betweenness centrality (0.252) - this node is a cross-community bridge._
- **Are the 36 inferred relationships involving `ProcessBatchSyncCommandHandler` (e.g. with `.ProcessBatchSync_CustomerDeleteAndStaleUpdate_HandlesLWWCorrectly()` and `.ProcessBatchSync_CustomerInsertAcceptsMalformedLegacyPhoneWithoutPhone()`) actually correct?**
  _`ProcessBatchSyncCommandHandler` has 36 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Processed`, `Duplicate`, `Ignored` to the rest of the system?**
  _240 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FluentTindahan.Domain.Entities` be split into smaller, more focused modules?**
  _Cohesion score 0.050762527233115466 - nodes in this community are weakly interconnected._
- **Why does `🧪 Testing & QA Workflow` connect `🧪 Testing & QA Workflow` to `Home.md`?**
  _High betweenness centrality (0.251) - this node is a cross-community bridge._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07948568088836938 - nodes in this community are weakly interconnected._
- **Why does `1. Frontend Test Suite (Vitest)` connect `🧪 Testing & QA Workflow` to `useTranslation`?**
  _High betweenness centrality (0.248) - this node is a cross-community bridge._