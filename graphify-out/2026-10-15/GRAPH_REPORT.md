# Graph Report - fluent-tindahan  (2026-10-15)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1385 nodes · 4533 edges · 69 communities (63 shown, 6 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 552 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4bbc98ac`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- FluentTindahan.Domain.Entities
- App.tsx
- PlanTier
- useAuthStore
- AppDbContext
- ProcessBatchSyncCommandHandler
- ActionResult
- languageStore.ts
- Fact
- DateTimeOffset
- db.ts
- subscriptionStore.ts
- http
- vitest
- .Handle
- FluentTindahan.UnitTests
- CurrentUserService
- syncEngine.ts
- Task
- authStore.ts
- capture_real_screenshots.py
- .HandleException
- ICurrentUserService
- compilerOptions
- IRequest
- ReceiptModal.tsx
- Guid
- SaleItem
- package.json
- setup.ts
- compilerOptions
- .Handlers_RejectEmptyTenant_ThrowsUnauthorizedAccessException
- WebhookProcessResultDto
- IApplicationDbContext
- .Handle
- User
- Tenant
- devDependencies
- Sale
- PaymentHistory
- Product
- dependencies
- List
- GCashTxn
- UtangLedger
- TenantResolvedHandler
- SaleSyncPayload
- BatchSyncResultDto
- Customer
- themeStore.ts
- .GetDashboardSummary_CalculatesAccurateAggregations
- GCashTxnSyncPayload
- ImportPage.tsx
- coverage-summary.js
- ProductSyncPayload
- UtangLedgerSyncPayload
- SaleItemSyncPayload
- Mock
- scripts
- PaymentWebhookOutcome
- BatchSyncCounters
- .oxlintrc.json
- mockPwaRegister.ts
- vite.config.ts
- CustomerSyncPayload
- main.tsx
- tsconfig.json

## God Nodes (most connected - your core abstractions)
1. `ProcessBatchSyncCommandHandler` - 61 edges
2. `BillingTests` - 56 edges
3. `AppDbContext` - 54 edges
4. `vitest` - 49 edges
5. `useAuthStore` - 49 edges
6. `SyncOperationDto` - 46 edges
7. `BatchSyncRequestDto` - 45 edges
8. `ProcessBatchSyncCommand` - 44 edges
9. `IApplicationDbContext` - 43 edges
10. `@fluentui/react-components` - 43 edges

## Surprising Connections (you probably didn't know these)
- `AuthState` --references--> `PlanTier`  [EXTRACTED]
  frontend/src/state/authStore.ts → frontend/src/db/db.ts
- `SubscriptionState` --references--> `PlanTier`  [EXTRACTED]
  frontend/src/state/subscriptionStore.ts → frontend/src/db/db.ts
- `GetGCashTransactionsQueryHandler` --references--> `IApplicationDbContext`  [EXTRACTED]
  backend/src/FluentTindahan.Application/GCash/GCashCommandsQueries.cs → backend/src/FluentTindahan.Application/Common/Interfaces/IApplicationDbContext.cs
- `RecordGCashTxnCommandHandler` --references--> `IApplicationDbContext`  [EXTRACTED]
  backend/src/FluentTindahan.Application/GCash/GCashCommandsQueries.cs → backend/src/FluentTindahan.Application/Common/Interfaces/IApplicationDbContext.cs
- `RecordGCashTxnCommandHandler` --references--> `ICurrentUserService`  [EXTRACTED]
  backend/src/FluentTindahan.Application/GCash/GCashCommandsQueries.cs → backend/src/FluentTindahan.Domain/Interfaces/ICurrentUserService.cs

## Import Cycles
- None detected.

## Communities (69 total, 6 thin omitted)

### Community 0 - "FluentTindahan.Domain.Entities"
Cohesion: 0.05
Nodes (26): PhilippineMobileNumber, DatabaseSeeder, FluentTindahan.WebApi.Middleware, FluentTindahan.Application.Products, FluentTindahan.Application.Sync.Commands, FluentTindahan.WebApi.Authorization, FluentTindahan.Application, FluentTindahan.Infrastructure.Services (+18 more)

### Community 1 - "App.tsx"
Cohesion: 0.08
Nodes (45): App(), DashboardPage, GCashPage, getInitialNavTab(), ImportPage, InventoryPage, POSPage, SettingsPage (+37 more)

### Community 2 - "PlanTier"
Cohesion: 0.08
Nodes (20): CheckoutSessionResponseDto, CreateCheckoutSessionCommand, CreateCheckoutSessionCommandHandler, CheckoutSessionResult, IPaymentGatewayService, PaymentGatewayException, DependencyInjection, TierLimits (+12 more)

### Community 3 - "useAuthStore"
Cohesion: 0.12
Nodes (37): BarcodeScannerModal(), BarcodeScannerModalProps, useStyles, NavigationProps, NavTab, PrivacyConsentDialog(), useStyles, QuickRegisterProductDialog() (+29 more)

### Community 4 - "AppDbContext"
Cohesion: 0.07
Nodes (19): AppDbContext, Customers, GCashTransactions, PaymentHistories, Products, SaleItems, Sales, Tenants (+11 more)

### Community 5 - "ProcessBatchSyncCommandHandler"
Cohesion: 0.19
Nodes (12): ProcessBatchSyncCommand, ProcessBatchSyncCommandHandler, BatchSyncRequestDto, DeviceId, Operations, SyncOperationDto, Action, Entity (+4 more)

### Community 6 - "ActionResult"
Cohesion: 0.11
Nodes (13): GetTenantSubscriptionQuery, GetTenantSubscriptionQueryHandler, TenantSubscriptionDto, BillingController, CustomersController, DashboardController, HealthController, ProductsController (+5 more)

### Community 7 - "languageStore.ts"
Cohesion: 0.12
Nodes (24): DisclaimerModal(), useStyles, TermsModal(), renderModal(), useStyles, Language, Translations, CURRENT_TERMS_VERSION (+16 more)

### Community 8 - "Fact"
Cohesion: 0.19
Nodes (3): ApplySubscriptionPaymentCommand, ApplySubscriptionPaymentCommandHandler, BillingTests

### Community 9 - "DateTimeOffset"
Cohesion: 0.10
Nodes (6): InitialCreate, AddBillingSubscriptions, AddProductIsDeleted, AddCustomerIsDeleted, AddGCashRefNoNorm, AppDbContextModelSnapshot

### Community 10 - "db.ts"
Cohesion: 0.13
Nodes (22): DeadLetterRecord, FluentTindahanDatabase, GCashTxnRecord, GCashTxnResolutionRecord, isGCashTxnUnresolved(), normalizeRef(), SaleItemRecord, SaleRecord (+14 more)

### Community 11 - "subscriptionStore.ts"
Cohesion: 0.16
Nodes (21): Header(), useStyles, SubscriptionModal(), useStyles, PlanTier, apiClient, ensureTenantProvisioned(), getAuthenticatedUserId() (+13 more)

### Community 12 - "http"
Cohesion: 0.07
Nodes (28): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, launchUrl, applicationUrl (+20 more)

### Community 13 - "vitest"
Cohesion: 0.22
Nodes (12): mockApplyVideoConstraints, mockClear, mockStart, mockStop, db, sariSariBrand, sariSariDarkTheme, sariSariLightTheme (+4 more)

### Community 14 - ".Handle"
Cohesion: 0.19
Nodes (10): DuplicateGCashRefException, RefNo, GCashTxnDto, GetGCashTransactionsQuery, GetGCashTransactionsQueryHandler, RecordGCashTxnCommand, RecordGCashTxnCommandHandler, GCashController (+2 more)

### Community 15 - "FluentTindahan.UnitTests"
Cohesion: 0.12
Nodes (26): FluentTindahan.Application, FluentTindahan.Domain, net8.0, Microsoft.NET.Sdk, FluentTindahan.Infrastructure, Microsoft.EntityFrameworkCore.Design (8.0.10), FluentTindahan.WebApi, Microsoft.EntityFrameworkCore.Design (8.0.10) (+18 more)

### Community 16 - "CurrentUserService"
Cohesion: 0.11
Nodes (7): CurrentUserService, FirebaseUid, IsAuthenticated, Role, TenantId, UserId, InfrastructureTests

### Community 17 - "syncEngine.ts"
Cohesion: 0.20
Nodes (19): OfflineSyncBanner(), useStyles, getSyncStorageKey(), STORAGE_KEY_LAST_SYNCED, SettingsPage(), useStyles, clearDeadLetterQueue(), getAuthSessionKey() (+11 more)

### Community 18 - "Task"
Cohesion: 0.10
Nodes (4): ManilaTime, SubscriptionMonitorService, MockPayRequest, DnsFailureHandler

### Community 19 - "authStore.ts"
Cohesion: 0.19
Nodes (17): OnboardingModal(), useStyles, DEMO_BUSINESS_NAME, DEMO_OWNER, DEMO_PHONE, DEFAULT_TENANT_ID, DEFAULT_USER_ID, seedDexieDatabaseIfNeeded() (+9 more)

### Community 20 - "capture_real_screenshots.py"
Cohesion: 0.12
Nodes (5): capture_tab(), main(), create_fluent_tindahan_icon(), create_screenshots(), main()

### Community 21 - ".HandleException"
Cohesion: 0.15
Nodes (8): ConcurrencyConflictException, DomainException, EntityNotFoundException, ValidationException, Errors, ApiExceptionHandler, ApiExceptionHandlerTests, FluentTindahan.Domain.Exceptions

### Community 22 - "ICurrentUserService"
Cohesion: 0.20
Nodes (12): GetUtangLedgerQuery, GetUtangLedgerQueryHandler, RecordUtangCommand, RecordUtangCommandHandler, UtangLedgerDto, ICurrentUserService, FirebaseUid, IsAuthenticated (+4 more)

### Community 23 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 24 - "IRequest"
Cohesion: 0.24
Nodes (8): ResetTenantSubscriptionCommand, ResetTenantSubscriptionCommandHandler, CreateProductCommand, CreateProductCommandHandler, GetProductsQuery, GetProductsQueryHandler, ProductDto, ProductHandlerTests

### Community 25 - "ReceiptModal.tsx"
Cohesion: 0.25
Nodes (14): ReceiptData, ReceiptModal(), ReceiptModalProps, useStyles, BluetoothPrintResult, generateEscPosReceipt(), generateThermalReceiptHtml(), isBluetoothPrintSupported() (+6 more)

### Community 27 - "SaleItem"
Cohesion: 0.11
Nodes (12): SaleItem, Id, Product, ProductId, Qty, Sale, SaleId, Subtotal (+4 more)

### Community 28 - "package.json"
Cohesion: 0.12
Nodes (16): name, private, type, version, axios, html5-qrcode, jsdom, oxlint (+8 more)

### Community 29 - "setup.ts"
Cohesion: 0.12
Nodes (7): localStorageMock, MockAudioContext, MockBroadcastChannel, MockResizeObserver, sessionStorageMock, fake-indexeddb, @testing-library/jest-dom

### Community 30 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 31 - ".Handlers_RejectEmptyTenant_ThrowsUnauthorizedAccessException"
Cohesion: 0.31
Nodes (3): CreateCustomerCommand, CreateCustomerCommandHandler, CustomerHandlerTests

### Community 32 - "WebhookProcessResultDto"
Cohesion: 0.25
Nodes (4): ProcessPaymentWebhookCommand, ProcessPaymentWebhookCommandHandler, WebhookProcessResultDto, Success

### Community 33 - "IApplicationDbContext"
Cohesion: 0.13
Nodes (11): IApplicationDbContext, ChangeTracker, Customers, GCashTransactions, PaymentHistories, Products, SaleItems, Sales (+3 more)

### Community 34 - ".Handle"
Cohesion: 0.33
Nodes (8): CreateSaleCommand, CreateSaleCommandHandler, CreateSaleItemInput, GetSalesQuery, GetSalesQueryHandler, SaleDto, SaleItemDto, SaleHandlerTests

### Community 35 - "User"
Cohesion: 0.13
Nodes (13): IAuditableEntity, CreatedAt, UpdatedAt, IMustHaveTenant, TenantId, User, CreatedAt, FirebaseUid (+5 more)

### Community 36 - "Tenant"
Cohesion: 0.13
Nodes (14): Tenant, BusinessName, CreatedAt, Customers, ExternalCustomerId, GCashTransactions, Id, PaymentHistories (+6 more)

### Community 37 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, fake-indexeddb, jsdom, oxlint, @testing-library/jest-dom, @testing-library/react, @types/node, @types/papaparse (+7 more)

### Community 38 - "Sale"
Cohesion: 0.14
Nodes (14): Sale, CashReceived, ChangeGiven, Customer, CustomerId, Date, Id, Items (+6 more)

### Community 39 - "PaymentHistory"
Cohesion: 0.15
Nodes (12): PaymentHistory, AmountCentavos, BillingCycle, CreatedAt, Currency, GatewayReferenceId, Id, PaymentMethod (+4 more)

### Community 40 - "Product"
Cohesion: 0.15
Nodes (12): Product, Barcode, Category, Cost, Id, IsDeleted, Name, Price (+4 more)

### Community 41 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, axios, dexie, dexie-react-hooks, @fluentui/react-components, @fluentui/react-icons, html5-qrcode, papaparse (+5 more)

### Community 42 - "List"
Cohesion: 0.41
Nodes (6): GetPaymentHistoryQuery, GetPaymentHistoryQueryHandler, PaymentHistoryDto, CustomerDto, GetCustomersQuery, GetCustomersQueryHandler

### Community 43 - "GCashTxn"
Cohesion: 0.17
Nodes (12): GCashTxn, Amount, CustomerPhone, Date, Fee, Id, Notes, RefNo (+4 more)

### Community 44 - "UtangLedger"
Cohesion: 0.17
Nodes (12): UtangLedger, Amount, Customer, CustomerId, Date, Id, Notes, RefSale (+4 more)

### Community 45 - "TenantResolvedHandler"
Cohesion: 0.27
Nodes (4): AuthorizationPolicies, TenantResolvedHandler, TenantResolvedRequirement, TenantResolvedAuthorizationTests

### Community 46 - "SaleSyncPayload"
Cohesion: 0.18
Nodes (10): SaleSyncPayload, CashReceived, ChangeGiven, CustomerId, Date, Id, Items, PaymentMethod (+2 more)

### Community 47 - "BatchSyncResultDto"
Cohesion: 0.20
Nodes (8): BatchSyncResultDto, ConflictCount, ProcessedCount, Results, SyncItemResultDto, Error, Status, SyncId

### Community 48 - "Customer"
Cohesion: 0.18
Nodes (10): Customer, Id, IsDeleted, Name, Phone, Tenant, TenantId, TotalUtangBalance (+2 more)

### Community 49 - "themeStore.ts"
Cohesion: 0.33
Nodes (9): computeIsDark(), getInitialMode(), getSystemDarkMode(), initialDark, initialMode, initThemeMediaListener(), ThemeMode, ThemeState (+1 more)

### Community 50 - ".GetDashboardSummary_CalculatesAccurateAggregations"
Cohesion: 0.47
Nodes (5): DashboardSummaryDto, GetDashboardSummaryQuery, GetDashboardSummaryQueryHandler, DashboardHandlerTests, FluentTindahan.Application.Dashboard

### Community 51 - "GCashTxnSyncPayload"
Cohesion: 0.22
Nodes (9): GCashTxnSyncPayload, Amount, CustomerPhone, Date, Fee, Id, Notes, RefNo (+1 more)

### Community 52 - "ImportPage.tsx"
Cohesion: 0.47
Nodes (6): ImportPage(), useStyles, CsvProductRow, importProductsToDexieAndSync(), ParsedProductPreview, parseProductsCsv()

### Community 53 - "coverage-summary.js"
Cohesion: 0.22
Nodes (5): backendXml, fs, getLatestCoberturaXml(), walk(), path

### Community 54 - "ProductSyncPayload"
Cohesion: 0.25
Nodes (8): ProductSyncPayload, Barcode, Category, Cost, Id, Name, Price, StockQty

### Community 55 - "UtangLedgerSyncPayload"
Cohesion: 0.25
Nodes (8): UtangLedgerSyncPayload, Amount, CustomerId, Date, Id, Notes, RefSaleId, Type

### Community 56 - "SaleItemSyncPayload"
Cohesion: 0.29
Nodes (7): SaleItemSyncPayload, Id, ProductId, ProductName, Qty, Subtotal, UnitPrice

### Community 58 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, preview, test, test:coverage

### Community 59 - "PaymentWebhookOutcome"
Cohesion: 0.33
Nodes (6): PaymentWebhookOutcome, Duplicate, Ignored, InvalidSignature, Processed, Rejected

### Community 60 - "BatchSyncCounters"
Cohesion: 0.33
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

## Knowledge Gaps
- **231 isolated node(s):** `RefNo`, `Microsoft.EntityFrameworkCore.Design (8.0.10)`, `Microsoft.EntityFrameworkCore.Design (8.0.10)`, `coverlet.collector (6.0.0)`, `FluentAssertions (8.11.0)` (+226 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 479 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppDbContext` connect `AppDbContext` to `FluentTindahan.Domain.Entities`, `PlanTier`, `ProcessBatchSyncCommandHandler`, `Fact`, `DateTimeOffset`, `.Handle`, `CurrentUserService`, `Task`, `ICurrentUserService`, `IRequest`, `Guid`, `SaleItem`, `.Handlers_RejectEmptyTenant_ThrowsUnauthorizedAccessException`, `IApplicationDbContext`, `.Handle`, `User`, `Tenant`, `Sale`, `PaymentHistory`, `Product`, `GCashTxn`, `UtangLedger`, `Customer`, `.GetDashboardSummary_CalculatesAccurateAggregations`, `Mock`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Are the 36 inferred relationships involving `ProcessBatchSyncCommandHandler` (e.g. with `.ProcessBatchSync_CustomerDeleteAndStaleUpdate_HandlesLWWCorrectly()` and `.ProcessBatchSync_CustomerInsertAcceptsMalformedLegacyPhoneWithoutPhone()`) actually correct?**
  _`ProcessBatchSyncCommandHandler` has 36 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RefNo`, `Microsoft.EntityFrameworkCore.Design (8.0.10)`, `Microsoft.EntityFrameworkCore.Design (8.0.10)` to the rest of the system?**
  _231 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FluentTindahan.Domain.Entities` be split into smaller, more focused modules?**
  _Cohesion score 0.05426356589147287 - nodes in this community are weakly interconnected._
- **Why does `ProcessBatchSyncCommandHandler` connect `ProcessBatchSyncCommandHandler` to `FluentTindahan.Domain.Entities`, `AppDbContext`, `ActionResult`, `Fact`, `ICurrentUserService`, `IRequest`, `Guid`, `.Handlers_RejectEmptyTenant_ThrowsUnauthorizedAccessException`, `WebhookProcessResultDto`, `IApplicationDbContext`, `SaleSyncPayload`, `BatchSyncResultDto`, `GCashTxnSyncPayload`, `ProductSyncPayload`, `UtangLedgerSyncPayload`, `SaleItemSyncPayload`, `Mock`, `BatchSyncCounters`, `CustomerSyncPayload`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07932310946589106 - nodes in this community are weakly interconnected._
- **Why does `BillingTests` connect `Fact` to `FluentTindahan.Domain.Entities`, `WebhookProcessResultDto`, `PlanTier`, `ProcessBatchSyncCommandHandler`, `ActionResult`, `Task`, `ICurrentUserService`, `Mock`, `Guid`, `.Handlers_RejectEmptyTenant_ThrowsUnauthorizedAccessException`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._