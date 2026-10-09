# Offline-First PWA Architecture Plan

**Target users:** Small Philippine businesses (sari-sari stores, GCash agents, small retailers)
**Constraints:** Low-end Android devices, intermittent and expensive mobile data, 1-month MVP timeline
**Design system:** Fluent UI (Fluent 2) for all UI design and components

---

## 1. Tech Stack & Trade-offs

* **Frontend:** **React (Vite) configured as a PWA**
  * Large ecosystem and flexible UI composition. Runs entirely in the browser; a Service Worker caches HTML/JS/CSS so the app loads offline.
* **UI Design System:** **Fluent UI React v9** (`@fluentui/react-components`)
  * The single source of truth for UI design: components, theming, spacing, typography, and iconography (`@fluentui/react-icons`).
  * Wrap the app in `FluentProvider` with a custom brand theme built from Fluent design tokens, so styling stays consistent and changeable from one place.
  * Styling uses Griffel (`makeStyles`), Fluent's atomic CSS-in-JS engine. Prefer Fluent tokens over hard-coded colors and sizes.
  * Trade-off: Fluent adds bundle weight, which matters on low-end devices. Mitigate with named imports (tree-shaking), route-level code splitting, and a performance budget (see Section 11).
* **Local Database & State:** **Dexie.js** (IndexedDB) + **Zustand** (local state) + **TanStack Query** (sync triggers)
  * Dexie simplifies complex IndexedDB queries. TanStack Query manages background sync. Zustand holds session state (UserId, TenantId).
* **Backend:** **.NET 8 Web API (Clean Architecture)**
  * **MediatR** for CQRS. Core business rules (Utang rules, GCash limits) stay decoupled from the framework, database, and UI, keeping the system maintainable as tenant volume grows.
* **Database:** **PostgreSQL** (`Npgsql.EntityFrameworkCore.PostgreSQL`)
  * Cost-effective, highly concurrent, with strong `JSONB` support.
* **Authentication:** **Firebase Auth**
  * Handles SMS OTP and offline session caching natively.
* **CI/CD & Hosting:** **Azure DevOps**, deploying the React app to a CDN (e.g., Vercel, Cloudflare) and the .NET Web API to Azure App Service or AWS ECS.

---

## 2. System Architecture

```text
[ Mobile Device / Browser ]
  |-- React PWA
  |     - Fluent UI v9 (FluentProvider, brand theme, components)
  |     - Zustand (state), TanStack Query (sync triggers)
  |-- Dexie.js (IndexedDB local database + offline SyncQueue table)
  |
(Intermittent data / background batch sync via HTTP)
  |
[ .NET 8 Web API - Clean Architecture ]
  |
  |-- Presentation Layer (Web API)
  |      - Controllers: receive batch sync payloads, validate Firebase JWT
  |
  |-- Application Layer (Use Cases)
  |      - MediatR (ProcessBatchCommand)
  |      - DTOs, FluentValidation, sync conflict resolution logic
  |
  |-- Core / Domain Layer (no dependencies)
  |      - Entities (Tenant, Customer, UtangLedger)
  |      - Domain exceptions, interfaces (ITenantRepository)
  |
  |-- Infrastructure Layer
  |      - EF Core DbContext (Npgsql provider)
  |      - ICurrentUserService (maps FirebaseUid -> PostgreSQL TenantId)
  |
[ Database ]
  |-- PostgreSQL (multi-tenant schema, tenant isolation via EF Core Global Query Filters)
```

---

## 3. Database Schema (PostgreSQL via EF Core)

All primary keys are UUIDs (`gen_random_uuid()` on the server) so the client can generate IDs offline without collisions.

| Entity | Core Columns | Role |
| :--- | :--- | :--- |
| **Tenant** | `Id`, `BusinessName`, `PlanTier`, `CreatedAt` | Isolates business data. |
| **User** | `Id`, `TenantId`, `Phone`, `Role` (Owner/Staff), `FirebaseUid` | Maps auth identity to tenant. |
| **Product** | `Id`, `TenantId`, `Name`, `Price`, `Cost`, `Barcode`, `UpdatedAt` | Catalog. |
| **Customer** | `Id`, `TenantId`, `Name`, `Phone`, `TotalUtangBalance` | Debtors. Balance is computed from the ledger. |
| **UtangLedger** | `Id`, `TenantId`, `CustomerId`, `Amount`, `Type`, `Date`, `RefSaleId` | Append-only debt tracking. |
| **Sale** | `Id`, `TenantId`, `TotalAmount`, `PaymentMethod`, `Date`, `UserId` | POS transaction header. |
| **SaleItem** | `Id`, `TenantId`, `SaleId`, `ProductId`, `Qty`, `UnitPrice` | Line items. |
| **GCashTxn** | `Id`, `TenantId`, `Type`, `Amount`, `Fee`, `RefNo`, `Date` | Logs GCash agent activity. |
| **SyncQueue** | `Id`, `Entity`, `Operation`, `Payload`, `Status`, `RetryCount` | **Client-side only** (Dexie.js). |

---

## 4. Authentication Integration (Firebase)

* **Frontend:** The `firebase/auth` SDK caches the session in IndexedDB, enabling offline access. An Axios interceptor adds `Authorization: Bearer <Firebase_ID_Token>` to every API request.
* **Backend validation:** The .NET API validates the JWT issuer (`https://securetoken.google.com/...`).
* **Identity mapping:** The Infrastructure layer extracts `FirebaseUid` from the JWT claims, looks up the `Users` table, resolves `TenantId`, and injects it into the scoped DI container. EF Core Global Query Filters then apply `WHERE TenantId = @TenantId` to all queries.

---

## 5. Offline Sync & Batching Strategy

Batching reduces HTTP overhead on slow 3G networks.

### A. Payload Structure
The React app groups pending Dexie `SyncQueue` entries and POSTs them to `/api/sync/batch`:

```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "operations": [
    {
      "syncId": "uuid-1",
      "entity": "Sale",
      "action": "Insert",
      "timestamp": "2026-10-09T06:00:00Z",
      "payload": { "id": "...", "totalAmount": 150.00 }
    }
  ]
}
```

### B. Backend Processing & Conflict Resolution
1. **Append-only ledgers:** `UtangLedger` and `GCashTxn` avoid conflicts by design. The client generates the UUID and the server simply appends.
2. **Last-Write-Wins (LWW):** For mutable records (e.g., product prices), the server compares the incoming timestamp with the stored `UpdatedAt`.
3. **Isolation (no poison pills):** The MediatR handler loops through operations and wraps each in its own EF Core `try/catch`. One failed validation does not roll back the batch.

### C. Client Queue Cleanup
The API returns a partial-success map:

```json
{
  "processedCount": 1,
  "results": [ { "syncId": "uuid-1", "status": "Success" } ]
}
```

TanStack Query reads the result, deletes `Success` records from Dexie, and increments `RetryCount` on failures. When `RetryCount > 3`, the record moves to a local "Dead Letter" table to unblock the queue, and the user is alerted (Fluent `MessageBar` or `Toast`).

---

## 6. Data Migration / Import Design

1. **Client-side parsing:** `react-papaparse` reads CSVs locally, saving bandwidth.
2. **Mapping & validation:** A Fluent UI grid previews the data and highlights type errors.
3. **Local-first insert:** Data goes straight into Dexie (instant UI availability), then trickles to the backend through the batch sync queue to avoid server timeouts.

---

## 7. UI Design & Key Screens (Fluent UI)

### Design principles
* **Fluent 2 as the standard:** All screens are built from Fluent UI v9 components and design tokens. Avoid custom one-off components unless Fluent has no equivalent.
* **Mobile-first, touch-friendly:** Large tap targets, single-column layouts, bottom-anchored primary actions, readable type for outdoor and low-light use.
* **Offline-aware by default:** A persistent connectivity/sync indicator on every screen (Fluent `Badge`/`MessageBar`), plus clear states for "Saved offline", "Syncing", and "Sync failed".
* **Light and dark themes** via Fluent theme tokens; dark mode also helps battery life on OLED devices.
* **Accessible and localizable:** Fluent's built-in accessibility, with room for English and Filipino strings.

### Screens
1. **Dashboard:** "New Sale", "GCash", "Utang" as prominent action cards, plus the offline/syncing indicator.
2. **POS screen:** Touch-friendly product grid (virtualized for large catalogs). Checkout supports split payments (Cash + GCash).
3. **Utang screen:** Searchable list of debtors (`SearchBox`, `List`) with red/green balance `Badge`s. Tapping opens a historical timeline of credits and payments.
4. **GCash screen:** Quick Cash-In/Cash-Out entry with fee calculation and a running daily log.
5. **Receipt modal:** Fluent `Dialog` showing a digital receipt watermarked **"NOT AN OFFICIAL RECEIPT. FOR ACKNOWLEDGMENT ONLY."** Shared through the native Web Share API (Messenger/Viber).

---

## 8. Security, Backup, and Compliance

* **Multi-tenancy security:** EF Core Global Query Filters enforce tenant isolation in every query at the application layer.
* **Data Privacy Act (RA 10173):** Plain-language consent dialog on first load covering storage of customer phone numbers.
* **Local security:** Wipe Dexie completely on explicit logout or token revocation.
* **Backups:** PostgreSQL Point-in-Time Recovery (PITR) with 7-day retention.

---

## 9. Testing Strategy

* **Unit testing (Clean Architecture):** Test MediatR handlers, validation, and conflict resolution with xUnit and Moq (no database required).
* **Network throttling:** QA uses Chrome DevTools "Slow 3G" and "Offline" modes to verify Dexie queuing.
* **Storage eviction resilience:** Simulate browser storage limits to confirm the app recovers via a full re-sync from the cloud.
* **UI and performance testing:** Test on real low-end Android devices. Verify Fluent theming, touch targets, and accessibility, and check bundle size and load time against the performance budget.

---

## 10. Phased Roadmap (1-Month MVP)

| Week | Focus | Deliverables |
| :--- | :--- | :--- |
| **Week 1** | Architecture | Clean Architecture scaffolding, Postgres setup, React/Dexie PWA shell, **Fluent UI setup (FluentProvider, brand theme, app layout)**, Firebase Auth integration. |
| **Week 2** | Core UI & State | Fluent-based UI for POS/Utang/GCash, Dexie state management, cart logic. |
| **Week 3** | Sync Engine | .NET MediatR batch handlers, React sync queue logic, partial-success handling. |
| **Week 4** | Polish & Launch | CSV import, Web Share API receipts, offline and device QA, deployment. |

---

## 11. Major Risks and Mitigations

* **Risk:** Browser storage eviction (Android quietly clearing IndexedDB).
  * *Mitigation:* Call `navigator.storage.persist()` on app init. Keep sync aggressive so local data is a mirror, not the master copy.
* **Risk:** Sync engine complexity delaying the MVP.
  * *Mitigation:* Stick to the append-only ledger pattern for MVP. Defer complex 3-way merges for mutable entities to Phase 2.
* **Risk:** Fluent UI bundle size and rendering cost on low-end Android devices.
  * *Mitigation:* Use named imports only, lazy-load routes, virtualize long lists, set a performance budget (e.g., initial JS size and time-to-interactive on a mid/low-tier device), and precache the app shell with the Service Worker.
