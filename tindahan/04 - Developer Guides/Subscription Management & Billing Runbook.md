# Subscription Management & Billing Support Runbook

---

## 1. System Overview & Dual-Database Architecture

Fluent Tindahan operates on an **offline-first dual-database architecture**:
1. **Server-Side PostgreSQL 16 (Source of Truth)**: Managed via .NET 8 EF Core (`AppDbContext`), enforcing multi-tenancy isolation (`TenantId`), decimal precision, and append-only financial ledgers.
2. **Client-Side IndexedDB (Local Till Cache)**: Managed via Dexie.js 4 (`db.ts`), allowing zero-latency POS, inventory, and utang operations offline with an outbox sync queue (`syncQueue`).

---

## 2. Complete Database Schema Reference

### 2.1 Server-Side PostgreSQL Schema (`AppDbContext`)

#### Table: `Tenants`
Represents the individual store/business account (tenant boundary).
- `Id` (`uuid`, PK, Default: `gen_random_uuid()`): Tenant UUID identifier.
- `BusinessName` (`varchar(200)`, NOT NULL): Store name (e.g., *Aling Nena's Tindahan*).
- `Tier` (`integer`, NOT NULL, Default: `0`): Plan tier (`0` = `Libre`, `1` = `TindahanPro`, `2` = `NegosyoPlus`).
- `SubscriptionEndDate` (`timestamptz`, NULL): Timestamp when the paid subscription expires.
- `ExternalCustomerId` (`varchar(128)`, NULL): Optional external customer gateway ID.
- `CreatedAt` (`timestamptz`, NOT NULL, Default: `now()`): Tenant registration timestamp.
- `xmin` (`xid`, Concurrency Token): PostgreSQL concurrency token.

#### Table: `Users`
Users (Store Owners and Staff/Tindera) belonging to a tenant.
- `Id` (`uuid`, PK, Default: `gen_random_uuid()`): User UUID identifier.
- `TenantId` (`uuid`, FK $\rightarrow$ `Tenants.Id`, CASCADE): Multi-tenant isolation ID.
- `Phone` (`varchar(30)`, NOT NULL): User phone number.
- `Role` (`varchar(50)`, NOT NULL, Default: `'Owner'`): `'Owner'` or `'Staff'`.
- `FirebaseUid` (`varchar(128)`, NOT NULL, Default: `''`): Authentication UID.
- `CreatedAt` (`timestamptz`, NOT NULL, Default: `now()`): Creation timestamp.
- *Indexes*: `IX_Users_TenantId`, `IX_Users_FirebaseUid`.

#### Table: `Products`
Inventory catalog items for each store.
- `Id` (`uuid`, PK, Default: `gen_random_uuid()`): Product UUID identifier.
- `TenantId` (`uuid`, FK $\rightarrow$ `Tenants.Id`, CASCADE): Multi-tenant isolation ID.
- `Name` (`varchar(200)`, NOT NULL): Product name.
- `Price` (`numeric(12,2)`, NOT NULL): Retail selling price in PHP.
- `Cost` (`numeric(12,2)`, NOT NULL): Cost/wholesale capital price in PHP.
- `Barcode` (`varchar(100)`, NULL): Optional barcode / UPC / EAN.
- `Category` (`varchar(100)`, NULL): Product category.
- `StockQty` (`integer`, NOT NULL, Default: `0`): Current in-stock quantity.
- `IsDeleted` (`boolean`, NOT NULL, Default: `false`): Soft delete flag.
- `UpdatedAt` (`timestamptz`, NOT NULL, Default: `now()`): Last modified timestamp.
- *Indexes*: `IX_Products_TenantId`, `IX_Products_TenantId_Barcode`, `IX_Products_TenantId_Name`.

#### Table: `Customers`
Customer and debtor directory.
- `Id` (`uuid`, PK, Default: `gen_random_uuid()`): Customer UUID identifier.
- `TenantId` (`uuid`, FK $\rightarrow$ `Tenants.Id`, CASCADE): Multi-tenant isolation ID.
- `Name` (`varchar(200)`, NOT NULL): Customer name.
- `Phone` (`varchar(30)`, NOT NULL, Default: `''`): Customer phone number.
- `TotalUtangBalance` (`numeric(12,2)`, NOT NULL, Default: `0.00`): Running debt balance in PHP.
- `IsDeleted` (`boolean`, NOT NULL, Default: `false`): Soft delete flag.
- `UpdatedAt` (`timestamptz`, NOT NULL, Default: `now()`): Last modified timestamp.
- *Indexes*: `IX_Customers_TenantId`, `IX_Customers_TenantId_Phone`, `IX_Customers_TenantId_Name`.

#### Table: `Sales`
POS transactions (**append-only**).
- `Id` (`uuid`, PK, Default: `gen_random_uuid()`): Sale UUID identifier.
- `TenantId` (`uuid`, FK $\rightarrow$ `Tenants.Id`, CASCADE): Multi-tenant isolation ID.
- `UserId` (`uuid`, FK $\rightarrow$ `Users.Id`, CASCADE): Cashier/seller user ID.
- `CustomerId` (`uuid`, FK $\rightarrow$ `Customers.Id`, SET NULL, NULL): Linked customer for utang/credit.
- `TotalAmount` (`numeric(12,2)`, NOT NULL): Total sale amount.
- `PaymentMethod` (`varchar(50)`, NOT NULL): `'Cash'`, `'GCash'`, `'Split'`, `'Utang'`.
- `CashReceived` (`numeric(12,2)`, NULL): Cash tendered.
- `ChangeGiven` (`numeric(12,2)`, NULL): Sukli returned.
- `Date` (`timestamptz`, NOT NULL, Default: `now()`): Transaction timestamp.
- *Indexes*: `IX_Sales_TenantId`, `IX_Sales_TenantId_Date`, `IX_Sales_CustomerId`, `IX_Sales_UserId`.

#### Table: `SaleItems`
Line items belonging to a sale (**append-only**).
- `Id` (`uuid`, PK, Default: `gen_random_uuid()`): Sale item UUID.
- `TenantId` (`uuid`, FK $\rightarrow$ `Tenants.Id`, CASCADE): Multi-tenant isolation ID.
- `SaleId` (`uuid`, FK $\rightarrow$ `Sales.Id`, CASCADE): Parent sale ID.
- `ProductId` (`uuid`, FK $\rightarrow$ `Products.Id`, RESTRICT): Product ID.
- `Qty` (`integer`, NOT NULL): Units purchased.
- `UnitPrice` (`numeric(12,2)`, NOT NULL): Snapshot unit price.
- `Subtotal` (`numeric(12,2)`, NOT NULL): `Qty * UnitPrice`.
- *Indexes*: `IX_SaleItems_TenantId`, `IX_SaleItems_SaleId`, `IX_SaleItems_ProductId`, `IX_SaleItems_TenantId_SaleId`.

#### Table: `UtangLedgers`
Double-entry debtor journal (**append-only**).
- `Id` (`uuid`, PK, Default: `gen_random_uuid()`): Ledger row UUID.
- `TenantId` (`uuid`, FK $\rightarrow$ `Tenants.Id`, CASCADE): Multi-tenant isolation ID.
- `CustomerId` (`uuid`, FK $\rightarrow$ `Customers.Id`, CASCADE): Debtor customer ID.
- `Amount` (`numeric(12,2)`, NOT NULL): Positive amount.
- `Type` (`varchar(30)`, NOT NULL): `'Credit'` (utang) or `'Payment'` (bayad).
- `Date` (`timestamptz`, NOT NULL, Default: `now()`): Transaction date.
- `RefSaleId` (`uuid`, FK $\rightarrow$ `Sales.Id`, SET NULL, NULL): Reference sale ID.
- `Notes` (`varchar(500)`, NULL): Remarks.
- *Indexes*: `IX_UtangLedgers_TenantId`, `IX_UtangLedgers_TenantId_CustomerId`, `IX_UtangLedgers_TenantId_Date`.

#### Table: `GCashTransactions`
Neighborhood GCash cash-in / cash-out ledger.
- `Id` (`uuid`, PK, Default: `gen_random_uuid()`): GCash transaction UUID.
- `TenantId` (`uuid`, FK $\rightarrow$ `Tenants.Id`, CASCADE): Multi-tenant isolation ID.
- `Type` (`varchar(30)`, NOT NULL): `'CashIn'` or `'CashOut'`.
- `Amount` (`numeric(12,2)`, NOT NULL): Principal amount.
- `Fee` (`numeric(12,2)`, NOT NULL, Default: `0.00`): Service fee charged.
- `RefNo` (`varchar(100)`, NOT NULL): Original reference number.
- `RefNoNorm` (`varchar(100)`, NOT NULL, Default: `''`): Trimmed, lowercased reference number.
- `CustomerPhone` (`varchar(30)`, NULL): Customer mobile number.
- `Notes` (`varchar(500)`, NULL): Remarks.
- `Date` (`timestamptz`, NOT NULL, Default: `now()`): Transaction timestamp.
- *Indexes*: `IX_GCashTransactions_TenantId`, `IX_GCashTransactions_TenantId_Date`, `IX_GCashTransactions_TenantId_RefNo`, `IX_GCashTransactions_TenantId_RefNoNorm` (Partial unique: `WHERE "RefNoNorm" <> ''`).

#### Table: `PaymentHistories`
SaaS subscription payment records (**append-only**).
- `Id` (`uuid`, PK, Default: `gen_random_uuid()`): Payment history record UUID.
- `TenantId` (`uuid`, FK $\rightarrow$ `Tenants.Id`, CASCADE): Multi-tenant isolation ID.
- `AmountCentavos` (`bigint`, NOT NULL): Integer centavos (e.g., `12900` = ₱129.00).
- `Currency` (`varchar(10)`, NOT NULL, Default: `'PHP'`): Currency code.
- `TierPurchased` (`integer`, NOT NULL): Purchases use `1` = `TindahanPro`; legacy enum values remain readable.
- `BillingCycle` (`integer`, NOT NULL): Purchases use `1` = `Monthly`; legacy enum values remain readable.
- `GatewayReferenceId` (`varchar(150)`, NOT NULL): PayMongo payment ID.
- `Status` (`varchar(50)`, NOT NULL, Default: `'Paid'`): Status.
- `PaymentMethod` (`varchar(50)`, NOT NULL, Default: `'paymongo'`): Payment gateway source.
- `CreatedAt` (`timestamptz`, NOT NULL, Default: `now()`): Verified PayMongo `paid_at` timestamp.
- *Indexes*: `IX_PaymentHistories_TenantId`, `IX_PaymentHistories_TenantId_CreatedAt`, `IX_PaymentHistories_GatewayReferenceId` (**UNIQUE**).

---

### 2.2 Client-Side IndexedDB Schema (`FluentTindahanDb`)

| Store Table | Primary Key | Indexed Fields | Purpose |
| :--- | :--- | :--- | :--- |
| `products` | `id` | `tenantId, name, barcode, category, updatedAt` | Offline catalog cache |
| `customers` | `id` | `tenantId, name, phone, totalUtangBalance, updatedAt` | Offline debtor/customer directory |
| `sales` | `id` | `tenantId, date, paymentMethod, customerId` | Offline POS sales history |
| `saleItems` | `id` | `tenantId, saleId, productId` | POS sale line items |
| `utangLedger` | `id` | `tenantId, customerId, type, date, refSaleId` | Ledger records |
| `gcashTxns` | `id` | `tenantId, type, date, refNo, refNoNorm, [tenantId+refNoNorm]` | GCash transactions with composite index |
| `gcashTxnResolutions` | `gcashTxnId` | `tenantId, resolution, resolvedAt` | Resolution audit trail for conflicts |
| `syncQueue` | `id` | `entity, status, retryCount, timestamp` | Outbox queue pending backend sync |
| `deadLetterQueue` | `id` | `entity, failedAt` | Poisoned mutations exceeding retry limit |
| `tenants` | `id` | `tier, subscriptionEndDate, updatedAt` | Locally cached subscription plan & end date |

---

## 3. Subscription Tiers & Capabilities

| Tier | Code | Price | Limits & Features |
| :--- | :---: | :---: | :--- |
| **Libre** | `0` | ₱0.00 | Up to 30 products, 30 debtors, 30 GCash txns/month, 1 device, watermarked receipts. Existing products remain usable after expiry. |
| **Tindahan Pro** | `1` | ₱129.00 / 30 days | **Unlimited** products, debtors, and GCash logs; up to 2 devices; CSV catalog import; unwatermarked receipts; profit analytics. |

Each renewal uses a fresh payment. A verified payment sets the new expiry to `max(PayMongo paid_at, current expiry) + 30 days`.

---

## 4. Production Billing Flow (PayMongo)

```
[Store Owner] 
      │ 1. Clicks "Upgrade" or "Extend"
      ▼
[Frontend PWA] ──(POST /api/billing/checkout)──► [Backend Web API]
                                                         │ 2. Creates Checkout Session
                                                         ▼
[PayMongo Checkout URL] ◄────────────────────────────────┘
      │
      │ 3. User pays via GCash, Maya, GrabPay, Card, or 7-Eleven
      ▼
[PayMongo Webhook] ──(POST /api/webhooks/billing/paymongo)──► [WebhooksController]
                                                                     │
                                    ┌────────────────────────────────┴──────────────────┐
                                    ▼                                                   ▼
                         [Validate Signature]                                [Verify Duplicate]
                         (paymongo-signature)                                (GatewayReferenceId)
                                    │                                                   │
                                    └───────────────────────┬───────────────────────────┘
                                                            ▼
                                           [Atomic Database Update]
                                           1. UPDATE Tenants SET Tier, SubscriptionEndDate
                                           2. INSERT INTO PaymentHistories
```

---

## 5. Support Runbook: Resolving Uncredited Payments

### Scenario
A store owner reports that they completed their subscription payment (via GCash, Maya, etc.), but their app still displays **Libre** and restricts their features.

---

### Step 1: Gather Incident Details
Request the following from the store owner:
1. **Store Name** or **Registered Phone Number**.
2. **Proof of Payment**: Screenshot of GCash/Maya reference number, PayMongo receipt, or transaction ID.

---

### Step 2: Query PostgreSQL to Check Account Status

Run this diagnostic query in PostgreSQL:

```sql
SELECT 
    t.id AS "TenantId",
    t."BusinessName",
    t."Tier" AS "CurrentTier",
    t."SubscriptionEndDate",
    u."Phone" AS "OwnerPhone"
FROM "Tenants" t
LEFT JOIN "Users" u ON u."TenantId" = t.id AND u."Role" = 'Owner'
WHERE t."BusinessName" ILIKE '%<Store Name>%'
   OR u."Phone" = '<Customer Phone>';
```

Also check if any payment was recorded for this tenant:

```sql
SELECT 
    id,
    "TenantId",
    "AmountCentavos" / 100.0 AS "AmountPHP",
    "TierPurchased",
    "BillingCycle",
    "GatewayReferenceId",
    "Status",
    "CreatedAt"
FROM "PaymentHistories"
WHERE "TenantId" = '<TENANT_UUID>'
ORDER BY "CreatedAt" DESC;
```

---

### Step 3: Diagnostic Decision Matrix

#### Case A: `Tenants.Tier` is ALREADY updated (`1`) in the DB
* **Diagnosis**: The payment and webhook succeeded! The client's PWA is simply running on stale cached state in IndexedDB because the device was offline or hasn't refetched the tenant profile.
* **Resolution**:
  1. Have the store owner confirm their device has an active internet connection.
  2. In the app, open the **Subscription Modal** and tap **Refresh** (or reload the browser page).
  3. The PWA will call `/api/billing/subscription`, update IndexedDB (`db.tenants`), and immediately unlock Pro features.

#### Case B: `Tenants.Tier` is STILL `0` (Libre) in the DB
* **Diagnosis**: The webhook either failed delivery, encountered a signature issue, or was rejected.
* **Resolution**:
  1. Open the **PayMongo Dashboard**:
     - Check **Payments** for the customer's reference number to confirm money was successfully captured.
     - Check **Developers > Webhooks** to inspect delivery logs and HTTP status codes.
  2. If the payment is valid, **manually credit the tenant immediately**:

```sql
-- 1. Upgrade the tenant's tier and extend expiration
UPDATE "Tenants"
SET "Tier" = 1,
    "SubscriptionEndDate" = GREATEST(COALESCE("SubscriptionEndDate", '<PAYMONGO_PAID_AT>'), '<PAYMONGO_PAID_AT>') + INTERVAL '30 days'
WHERE id = '<TENANT_UUID>';

-- 2. Insert audit trail record in PaymentHistories
INSERT INTO "PaymentHistories" (
    "Id",
    "TenantId",
    "AmountCentavos",
    "Currency",
    "TierPurchased",
    "BillingCycle",
    "GatewayReferenceId",
    "Status",
    "PaymentMethod",
    "CreatedAt"
) VALUES (
    gen_random_uuid(),
    '<TENANT_UUID>',
    12900,               -- Amount in centavos (e.g. 12900 for ₱129.00)
    'PHP',
    1,                   -- TindahanPro
    1,                   -- Monthly (30 days)
    '<PAYMONGO_REF_NO>', -- Transaction ref from gateway/receipt
    'Paid',
    'paymongo',
    '<PAYMONGO_PAID_AT>'
);
```

3. Instruct the store owner to tap **Refresh** in their subscription modal or reload the app. Pro features will activate immediately.

---

## 6. Summary Reference Sheet

| Item | Value / Location |
| :--- | :--- |
| **Payment Webhook Endpoint** | `POST /api/webhooks/billing/paymongo` |
| **Subscription Check Endpoint** | `GET /api/billing/subscription` |
| **Tenant Profile Endpoint** | `GET /api/tenant/profile` |
| **Payment History Table** | `"PaymentHistories"` in PostgreSQL |
| **Local Client Store** | `db.tenants` in Dexie.js (IndexedDB) & `useSubscriptionStore` |
| **PayMongo Configuration** | `backend/src/FluentTindahan.WebApi/appsettings.json` (`PayMongo:SecretKey`, `PayMongo:WebhookSecret`) |

---

## 7. How to Reset Local Environment & Subscription to Libre

### Option A: From App UI (Settings Page)
1. Open **Settings** in the app.
2. Under **Cloud & Data Management**, click **"Wipe Local Data & Sign Out"**.
3. Confirm the prompt. The app will:
   - Call `POST /api/billing/reset` to reset the PostgreSQL tenant to **Libre** and clear test payments.
   - Wipe IndexedDB (`FluentTindahanDb`).
   - Clear `localStorage` and `sessionStorage`.
   - Reload fresh with initial Libre tier and catalog.

### Option B: From Command Line (PowerShell)
Run the automated reset script:
```powershell
powershell -File scripts/reset-environment.ps1
```
Then refresh your browser page.

