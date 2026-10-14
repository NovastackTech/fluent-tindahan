# Graph Report - fluent-tindahan  (2026-10-15)

## Corpus Check
- 233 files · ~145,739 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 4, .css 2, .http 1)

## Summary
- 1387 nodes · 4534 edges · 70 communities (60 shown, 10 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 552 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e50d4a15`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- FluentTindahan.Domain.Entities
- App.tsx
- PlanTier
- POSPage.tsx
- .Provision
- ProcessBatchSyncCommandHandler
- GetTenantSubscriptionQuery
- useTranslation
- Fact
- DateTimeOffset
- authStore.ts
- db.ts
- http
- vitest
- .Handle
- FluentTindahan.UnitTests
- CurrentUserService
- syncEngine.ts
- Task
- cartStore.ts
- capture_real_screenshots.py
- ILogger
- UtangLedgerDto
- compilerOptions
- IRequest
- ReceiptModal.tsx
- SaleItem
- package.json
- setup.ts
- compilerOptions
- .Handle
- ApplySubscriptionPaymentCommand
- IApplicationDbContext
- .Handlers_RejectEmptyTenant_ThrowsUnauthorizedAccessException
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
- AppDbContext
- SaleSyncPayload
- BatchSyncResultDto
- Customer
- themeStore.ts
- ICurrentUserService
- GCashTxnSyncPayload
- ActionResult
- coverage-summary.js
- ProductSyncPayload
- UtangLedgerSyncPayload
- .StartOfCurrentMonthUtc
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
- rules.md

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

## Communities (70 total, 10 thin omitted)

### Community 0 - "FluentTindahan.Domain.Entities"
Cohesion: 0.05
Nodes (27): PhilippineMobileNumber, DatabaseSeeder, FluentTindahan.WebApi.Middleware, FluentTindahan.Application.Products, FluentTindahan.Application.Dashboard, FluentTindahan.Application.Sync.Commands, FluentTindahan.WebApi.Authorization, FluentTindahan.Application (+19 more)

### Community 1 - "App.tsx"
Cohesion: 0.12
Nodes (29): App(), DashboardPage, GCashPage, getInitialNavTab(), ImportPage, InventoryPage, POSPage, SettingsPage (+21 more)

### Community 2 - "PlanTier"
Cohesion: 0.06
Nodes (23): CheckoutSessionResponseDto, CreateCheckoutSessionCommand, CreateCheckoutSessionCommandHandler, CheckoutSessionResult, IPaymentGatewayService, PaymentGatewayException, DependencyInjection, TierLimits (+15 more)

### Community 3 - "POSPage.tsx"
Cohesion: 0.12
Nodes (32): BarcodeScannerModal(), BarcodeScannerModalProps, useStyles, Navigation(), NavigationProps, NavTab, useStyles, QuickRegisterProductDialog() (+24 more)

### Community 4 - ".Provision"
Cohesion: 0.12
Nodes (8): ProvisionTenantRequest, BusinessName, Phone, UserId, ProvisionTenantResponse, TenantController, ProvisionRaceDbContext, SyncControllerTests

### Community 5 - "ProcessBatchSyncCommandHandler"
Cohesion: 0.19
Nodes (12): ProcessBatchSyncCommand, ProcessBatchSyncCommandHandler, BatchSyncRequestDto, DeviceId, Operations, SyncOperationDto, Action, Entity (+4 more)

### Community 6 - "GetTenantSubscriptionQuery"
Cohesion: 0.21
Nodes (5): GetTenantSubscriptionQuery, GetTenantSubscriptionQueryHandler, TenantSubscriptionDto, HealthController, TenantProfileDto

### Community 7 - "useTranslation"
Cohesion: 0.13
Nodes (25): DisclaimerModal(), useStyles, PrivacyConsentDialog(), useStyles, TermsModal(), renderModal(), useStyles, Language (+17 more)

### Community 9 - "DateTimeOffset"
Cohesion: 0.12
Nodes (5): InitialCreate, AddBillingSubscriptions, AddProductIsDeleted, AddCustomerIsDeleted, AddGCashRefNoNorm

### Community 10 - "authStore.ts"
Cohesion: 0.12
Nodes (31): OnboardingModal(), useStyles, DEMO_BUSINESS_NAME, DEMO_OWNER, DEMO_PHONE, isGCashTxnUnresolved(), normalizeRef(), DashboardPage() (+23 more)

### Community 11 - "db.ts"
Cohesion: 0.11
Nodes (25): SubscriptionModal(), useStyles, CustomerRecord, DeadLetterRecord, FluentTindahanDatabase, GCashTxnRecord, GCashTxnResolutionRecord, PlanTier (+17 more)

### Community 12 - "http"
Cohesion: 0.07
Nodes (28): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, launchUrl, applicationUrl (+20 more)

### Community 13 - "vitest"
Cohesion: 0.22
Nodes (11): mockApplyVideoConstraints, mockClear, mockStart, mockStop, sariSariBrand, sariSariDarkTheme, sariSariLightTheme, useIsDesktop() (+3 more)

### Community 14 - ".Handle"
Cohesion: 0.19
Nodes (10): DuplicateGCashRefException, RefNo, GCashTxnDto, GetGCashTransactionsQuery, GetGCashTransactionsQueryHandler, RecordGCashTxnCommand, RecordGCashTxnCommandHandler, GCashController (+2 more)

### Community 15 - "FluentTindahan.UnitTests"
Cohesion: 0.12
Nodes (26): FluentTindahan.Application, FluentTindahan.Domain, net8.0, Microsoft.NET.Sdk, FluentTindahan.Infrastructure, Microsoft.EntityFrameworkCore.Design (8.0.10), FluentTindahan.WebApi, Microsoft.EntityFrameworkCore.Design (8.0.10) (+18 more)

### Community 16 - "CurrentUserService"
Cohesion: 0.07
Nodes (12): AppDbContextModelSnapshot, CurrentUserService, FirebaseUid, IsAuthenticated, Role, TenantId, UserId, AuthorizationPolicies (+4 more)

### Community 17 - "syncEngine.ts"
Cohesion: 0.12
Nodes (32): OfflineSyncBanner(), useStyles, getSyncStorageKey(), STORAGE_KEY_LAST_SYNCED, db, DEFAULT_TENANT_ID, DEFAULT_USER_ID, seedDexieDatabaseIfNeeded() (+24 more)

### Community 19 - "cartStore.ts"
Cohesion: 0.14
Nodes (19): activeRemoteCartTabs, CartStatusMessage, getTabId(), initPwaTabCoordinator(), PWA_CART_CHANNEL_NAME, PwaTabMessage, QueryCartStatusMessage, _resetPwaTabCoordinatorForTest() (+11 more)

### Community 20 - "capture_real_screenshots.py"
Cohesion: 0.12
Nodes (5): capture_tab(), main(), create_fluent_tindahan_icon(), create_screenshots(), main()

### Community 21 - "ILogger"
Cohesion: 0.13
Nodes (9): ConcurrencyConflictException, DomainException, EntityNotFoundException, ValidationException, Errors, DatabaseMigrator, ApiExceptionHandler, ApiExceptionHandlerTests (+1 more)

### Community 22 - "UtangLedgerDto"
Cohesion: 0.38
Nodes (6): GetUtangLedgerQuery, GetUtangLedgerQueryHandler, RecordUtangCommand, RecordUtangCommandHandler, UtangLedgerDto, UtangHandlerTests

### Community 23 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 24 - "IRequest"
Cohesion: 0.23
Nodes (8): ResetTenantSubscriptionCommand, ResetTenantSubscriptionCommandHandler, CreateProductCommand, CreateProductCommandHandler, GetProductsQuery, GetProductsQueryHandler, ProductDto, ProductHandlerTests

### Community 25 - "ReceiptModal.tsx"
Cohesion: 0.25
Nodes (14): ReceiptData, ReceiptModal(), ReceiptModalProps, useStyles, BluetoothPrintResult, generateEscPosReceipt(), generateThermalReceiptHtml(), isBluetoothPrintSupported() (+6 more)

### Community 27 - "SaleItem"
Cohesion: 0.18
Nodes (11): SaleItem, Id, Product, ProductId, Qty, Sale, SaleId, Subtotal (+3 more)

### Community 28 - "package.json"
Cohesion: 0.12
Nodes (16): name, private, type, version, axios, html5-qrcode, jsdom, oxlint (+8 more)

### Community 29 - "setup.ts"
Cohesion: 0.12
Nodes (7): localStorageMock, MockAudioContext, MockBroadcastChannel, MockResizeObserver, sessionStorageMock, fake-indexeddb, @testing-library/jest-dom

### Community 30 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 31 - ".Handle"
Cohesion: 0.26
Nodes (6): CreateCustomerCommand, CreateCustomerCommandHandler, CustomerDto, GetCustomersQuery, GetCustomersQueryHandler, CustomerHandlerTests

### Community 32 - "ApplySubscriptionPaymentCommand"
Cohesion: 0.18
Nodes (6): ApplySubscriptionPaymentCommand, ApplySubscriptionPaymentCommandHandler, ProcessPaymentWebhookCommand, ProcessPaymentWebhookCommandHandler, WebhookProcessResultDto, Success

### Community 33 - "IApplicationDbContext"
Cohesion: 0.15
Nodes (11): IApplicationDbContext, ChangeTracker, Customers, GCashTransactions, PaymentHistories, Products, SaleItems, Sales (+3 more)

### Community 34 - ".Handlers_RejectEmptyTenant_ThrowsUnauthorizedAccessException"
Cohesion: 0.47
Nodes (4): CreateSaleCommand, CreateSaleCommandHandler, CreateSaleItemInput, SaleHandlerTests

### Community 35 - "User"
Cohesion: 0.12
Nodes (9): User, CreatedAt, FirebaseUid, Id, Phone, Role, Tenant, TenantId (+1 more)

### Community 36 - "Tenant"
Cohesion: 0.14
Nodes (14): Tenant, BusinessName, CreatedAt, Customers, ExternalCustomerId, GCashTransactions, Id, PaymentHistories (+6 more)

### Community 37 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, fake-indexeddb, jsdom, oxlint, @testing-library/jest-dom, @testing-library/react, @types/node, @types/papaparse (+7 more)

### Community 38 - "Sale"
Cohesion: 0.14
Nodes (14): Sale, CashReceived, ChangeGiven, Customer, CustomerId, Date, Id, Items (+6 more)

### Community 39 - "PaymentHistory"
Cohesion: 0.11
Nodes (17): IAuditableEntity, CreatedAt, UpdatedAt, IMustHaveTenant, TenantId, PaymentHistory, AmountCentavos, BillingCycle (+9 more)

### Community 40 - "Product"
Cohesion: 0.17
Nodes (12): Product, Barcode, Category, Cost, Id, IsDeleted, Name, Price (+4 more)

### Community 41 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, axios, dexie, dexie-react-hooks, @fluentui/react-components, @fluentui/react-icons, html5-qrcode, papaparse (+5 more)

### Community 42 - "List"
Cohesion: 0.38
Nodes (7): GetPaymentHistoryQuery, GetPaymentHistoryQueryHandler, PaymentHistoryDto, GetSalesQuery, GetSalesQueryHandler, SaleDto, SaleItemDto

### Community 43 - "GCashTxn"
Cohesion: 0.17
Nodes (12): GCashTxn, Amount, CustomerPhone, Date, Fee, Id, Notes, RefNo (+4 more)

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
Cohesion: 0.20
Nodes (9): BatchSyncResultDto, ConflictCount, ProcessedCount, Results, SyncItemResultDto, Error, Status, SyncId (+1 more)

### Community 48 - "Customer"
Cohesion: 0.18
Nodes (10): Customer, Id, IsDeleted, Name, Phone, Tenant, TenantId, TotalUtangBalance (+2 more)

### Community 49 - "themeStore.ts"
Cohesion: 0.33
Nodes (8): computeIsDark(), getInitialMode(), getSystemDarkMode(), initialDark, initialMode, initThemeMediaListener(), ThemeMode, ThemeState

### Community 50 - "ICurrentUserService"
Cohesion: 0.21
Nodes (10): DashboardSummaryDto, GetDashboardSummaryQuery, GetDashboardSummaryQueryHandler, ICurrentUserService, FirebaseUid, IsAuthenticated, Role, TenantId (+2 more)

### Community 51 - "GCashTxnSyncPayload"
Cohesion: 0.22
Nodes (9): GCashTxnSyncPayload, Amount, CustomerPhone, Date, Fee, Id, Notes, RefNo (+1 more)

### Community 52 - "ActionResult"
Cohesion: 0.29
Nodes (5): CustomersController, DashboardController, ProductsController, SalesController, UtangController

### Community 53 - "coverage-summary.js"
Cohesion: 0.22
Nodes (5): backendXml, fs, getLatestCoberturaXml(), walk(), path

### Community 54 - "ProductSyncPayload"
Cohesion: 0.12
Nodes (15): ProductSyncPayload, Barcode, Category, Cost, Id, Name, Price, StockQty (+7 more)

### Community 55 - "UtangLedgerSyncPayload"
Cohesion: 0.25
Nodes (8): UtangLedgerSyncPayload, Amount, CustomerId, Date, Id, Notes, RefSaleId, Type

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

## Knowledge Gaps
- **231 isolated node(s):** `RefNo`, `Microsoft.EntityFrameworkCore.Design (8.0.10)`, `Microsoft.EntityFrameworkCore.Design (8.0.10)`, `coverlet.collector (6.0.0)`, `FluentAssertions (8.11.0)` (+226 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 481 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppDbContext` connect `AppDbContext` to `FluentTindahan.Domain.Entities`, `PlanTier`, `.Provision`, `ProcessBatchSyncCommandHandler`, `DateTimeOffset`, `.Handle`, `CurrentUserService`, `Task`, `ILogger`, `UtangLedgerDto`, `IRequest`, `SaleItem`, `.Handle`, `IApplicationDbContext`, `.Handlers_RejectEmptyTenant_ThrowsUnauthorizedAccessException`, `User`, `Tenant`, `Sale`, `PaymentHistory`, `Product`, `GCashTxn`, `UtangLedger`, `Customer`, `ICurrentUserService`, `Mock`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Are the 36 inferred relationships involving `ProcessBatchSyncCommandHandler` (e.g. with `.ProcessBatchSync_CustomerDeleteAndStaleUpdate_HandlesLWWCorrectly()` and `.ProcessBatchSync_CustomerInsertAcceptsMalformedLegacyPhoneWithoutPhone()`) actually correct?**
  _`ProcessBatchSyncCommandHandler` has 36 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RefNo`, `Microsoft.EntityFrameworkCore.Design (8.0.10)`, `Microsoft.EntityFrameworkCore.Design (8.0.10)` to the rest of the system?**
  _231 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FluentTindahan.Domain.Entities` be split into smaller, more focused modules?**
  _Cohesion score 0.05240713724610033 - nodes in this community are weakly interconnected._
- **Why does `ProcessBatchSyncCommandHandler` connect `ProcessBatchSyncCommandHandler` to `FluentTindahan.Domain.Entities`, `IApplicationDbContext`, `CustomerSyncPayload`, `.Handlers_RejectEmptyTenant_ThrowsUnauthorizedAccessException`, `.Provision`, `SaleSyncPayload`, `BatchSyncResultDto`, `ICurrentUserService`, `GCashTxnSyncPayload`, `ILogger`, `ProductSyncPayload`, `UtangLedgerSyncPayload`, `IRequest`, `Mock`, `Guid`, `BatchSyncCounters`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12156448202959831 - nodes in this community are weakly interconnected._
- **Why does `BillingTests` connect `Fact` to `FluentTindahan.Domain.Entities`, `ApplySubscriptionPaymentCommand`, `PlanTier`, `ProcessBatchSyncCommandHandler`, `GetTenantSubscriptionQuery`, `ICurrentUserService`, `Task`, `Mock`, `Guid`, `.Handle`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._