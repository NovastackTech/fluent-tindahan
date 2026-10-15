---
title: Backend Web API (.NET 8)
tags: [backend, dotnet, api, mediatr, clean-architecture, postgresql]
updated: 2026-10-10
---

# ⚙️ Backend Web API (.NET 8)

The backend is built with **.NET 8 (LTS)** following **Clean Architecture** and the **CQRS (Command Query Responsibility Segregation)** pattern with **MediatR**.

---

## 1. Project Structure

```text
backend/src/
├── FluentTindahan.Domain/           # Enterprise Business Rules (Entities, Value Objects)
│   ├── Entities/                    # Tenant, Product, Customer, Sale, UtangLedger, GCashTxn
│   └── Exceptions/                  # Domain exceptions
│
├── FluentTindahan.Application/      # Application Business Rules (Use Cases)
│   ├── Common/                      # Interfaces, Behaviors (Validation, Logging)
│   ├── Sync/                        # ProcessBatchCommand, BatchSyncHandler
│   ├── Products/                    # Product CRUD Commands & Queries
│   ├── Utang/                       # Utang queries and payment commands
│   └── Dashboard/                   # Metric aggregation queries
│
├── FluentTindahan.Infrastructure/   # External Concerns
│   ├── Persistence/                 # ApplicationDbContext, EF Core Configurations, Npgsql
│   ├── Services/                    # CurrentUserService (Tenant extraction)
│   └── Migrations/                  # EF Core database migrations
│
└── FluentTindahan.WebApi/           # API Controllers & HTTP Pipeline
    ├── Controllers/                 # REST endpoints
    ├── Program.cs                   # DI setup, middleware, Swagger
    └── appsettings.Development.json # PostgreSQL connection strings
```

---

## 2. API Endpoints Reference

Base URL (Local Development): `http://localhost:5000`  
Swagger Documentation: `http://localhost:5000/swagger`

| Method | Endpoint | Description | Request / Response |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health check | Returns `{ status: "Healthy" }` |
| `POST`| `/api/sync/batch` | Synchronizes pending client mutations | Accepts `SyncBatchDto`, returns synced IDs |
| `GET` | `/api/products` | Lists tenant product catalog | Returns array of `ProductDto` |
| `POST`| `/api/products` | Creates or updates a product | Accepts `CreateProductCommand` |
| `GET` | `/api/customers` | Lists customers with current utang balances | Returns array of `CustomerDto` |
| `GET` | `/api/utang/{customerId}`| Retrieves customer ledger history | Returns array of `UtangLedgerDto` |
| `POST`| `/api/utang/ledger` | Appends a credit or payment ledger entry | Accepts `AppendUtangEntryCommand` |
| `GET` | `/api/sales` | Retrieves POS sale transactions | Returns array of `SaleDto` |
| `POST`| `/api/sales` | Creates a new completed sale | Accepts `CreateSaleCommand` |
| `GET` | `/api/gcash` | Lists GCash transaction records | Returns array of `GCashTxnDto` |
| `POST`| `/api/gcash` | Records a Cash-In or Cash-Out | Accepts `CreateGCashTxnCommand` |
| `GET` | `/api/dashboard/metrics`| Aggregates KPI totals | Returns sales, profit, utang, fees |
| `PUT` | `/api/tenant/provision` | Ensures the resolved server tenant and owner exist | Returns authoritative `tenantId`, `userId`, and tier |

### Tenant ID Reconciliation

The verified JWT `tenant_id` claim is authoritative in production; `X-Tenant-Id` is only a Development/Demo fallback. In `Production`, `DemoMode` is strictly ignored to prevent unauthenticated header spoofing unless an explicit, documented opt-in (`AllowDemoModeInProduction=true` / `ALLOW_DEMO_MODE_IN_PRODUCTION=true`) is configured on a dedicated demo server. Before sync, subscription refresh, billing, or catalog pull, the client calls `PUT /api/tenant/provision`. If the returned tenant ID differs from the locally generated offline ID, the client atomically rekeys that tenant's Dexie records and queued payloads, migrates tenant-keyed GCash fee settings, and persists the returned ID. Subsequent reads and writes then use the server tenant. Do not replace an authenticated tenant ID with a client-generated ID.

---

## 3. The Batch Sync Command (`ProcessBatchCommand`)

The core synchronization pipeline endpoint:
```csharp
[HttpPost("batch")]
public async Task<IActionResult> ProcessBatch([FromBody] SyncBatchRequest request)
{
    var command = new ProcessBatchCommand(request.DeviceId, request.Operations);
    var result = await _mediator.Send(command);
    return Ok(result);
}
```

### Handler Execution Flow:
1. Validates that `Operations` is not empty.
2. Begins a PostgreSQL transaction with serializable isolation.
3. Groups operations by entity type.
4. Executes inserts/updates with timestamp checks (Last-Write-Wins).
5. Commits transaction and returns the acknowledged list of client UUIDs.

---

## Related Notes
- [[System Architecture]] — Clean Architecture overview.
- [[Offline-First & Sync Engine]] — Client-to-server sync contract.
- [[Database Schemas]] — PostgreSQL table designs.
