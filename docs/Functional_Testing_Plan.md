# 🛒 Fluent Tindahan — Comprehensive Functional Testing Plan

> **Product**: Fluent Tindahan (Sari-Sari Store & GCash POS Platform)  
> **Document Version**: 2.1.0  
> **Date**: October 2026  
> **Target Platforms**: Progressive Web App (PWA), Chromium Mobile / Desktop, Android 10+ (Chrome 100+), Windows 10/11  
> **Classification**: Internal Quality Assurance & Release Engineering  

---

## 1. Executive Overview & Test Objectives

### 1.1 Purpose
This document establishes the comprehensive functional test strategy and test case specifications for **Fluent Tindahan**, an offline-first retail Point of Sale (POS) and credit ledger management system tailored for Philippine neighborhood micro-retailers (*sari-sari stores*) and commercial GCash cash-in/cash-out agents.

### 1.2 Core Architectural Invariants Tested
1. **Zero-Latency Local-First Operations**: Every counter action (sales, inventory adjustments, utang credit/payments, GCash entries) MUST write synchronously to local Dexie.js (IndexedDB) before any remote API dispatch. No UI block under poor cellular coverage or total disconnection.
2. **Integer Centavo Currency Precision**: All currency math (subtotals, discounts, sales totals, change given, customer debt ledgers) is calculated in integer centavos (`Math.round(price * 100)`) to eliminate floating-point drift.
3. **PWA Multi-Tab Transaction Integrity**: Background Service Worker updates and app refreshes MUST NEVER tear down active transactions or reload the till while an uncompleted cart or active receipt exists in any open browser tab.
4. **Append-Only Financial Ledgers**: Customer utang and GCash ledgers are append-only. Customer balances equal $\sum(\text{Credit}) - \sum(\text{Payment})$.
5. **Multi-Tenant Isolation**: Tenant IDs are enforced across client stores, local database partitions, and backend EF Core Global Query Filters.
6. **Compound Keyset Pagination**: Upstream tenant restore synchronization uses compound `(Date, Id)` keyset cursors to guarantee zero dropped transactions at page boundaries.

---

## 2. Test Environment & System Configuration

### 2.1 Hardware Profiles Under Test
- **Primary Target Device (Low-End Mobile)**: Android 10/11 Go Edition, 2GB–3GB RAM, 720×1520 viewport (360px–375px CSS width), 3G / HSPA / intermittent LTE.
- **Secondary Target Device (Tablet/Countertop)**: Android 12+, 4GB RAM, 1280×800 or 1920×1080 display.
- **Desktop/Laptop Merchant Device**: Windows 10/11, Microsoft Edge / Google Chrome, attached ESC/POS 58mm/80mm USB/Bluetooth thermal printer, USB handheld barcode scanner.

### 2.2 Software Stack
| Component | Technology | Version |
| :--- | :--- | :--- |
| **Frontend Framework** | React + Vite + TypeScript | React 19, Vite 8, TS 5.x |
| **Design System** | Microsoft Fluent UI React v9 | Griffel CSS Tokens |
| **Client Storage** | Dexie.js | 4.x (IndexedDB Wrapper) |
| **Client State** | Zustand | 4.x |
| **Offline / PWA** | vite-plugin-pwa, Workbox | Workbox 7.x |
| **Backend API** | .NET 8 Web API | C# 12, ASP.NET Core 8 |
| **ORM & Database** | Entity Framework Core + PostgreSQL | EF Core 8, Npgsql 8 |
| **Test Automation** | Vitest, Testing Library, xUnit | Vitest 4.x, xUnit 2.8+ |

---

## 3. Test Module Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FLUENT TINDAHAN PWA                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────┬───────────────┼───────────────┬────────────────┐
    ▼               ▼               ▼               ▼                ▼
[1. Shell & Auth] [2. POS Engine] [3. Inventory]  [4. Utang Ledger] [5. GCash Hub]
    │               │               │               │                │
    └───────────────┼───────────────┼───────────────┴────────────────┘
                    ▼               ▼
            [6. Offline Sync] [7. PWA Coordinator]
                    │               │
                    ▼               ▼
            [8. Billing/Tier] [9. Thermal Printer]
```

---

## 4. Detailed Functional Test Specifications

### Module 1: Shell, Authentication, Onboarding & Security

| Test ID | Test Scenario | Preconditions | Steps | Expected Outcome | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-AUTH-01** | First-time store owner registration | Clean browser profile, backend online | 1. Open app.<br>2. Fill store name, owner name, PH mobile number (`09XXXXXXXXX`), email, password.<br>3. Submit. | Account created, initial tenant provisioned with 30-day trial or Libre tier, JWT token + refresh token stored in `localStorage`, redirected to POS/Dashboard. | Critical |
| **TC-AUTH-02** | Philippine mobile number normalization | Registration form open | 1. Enter `+63 917 123 4567`, `0917-123-4567`, and `9171234567`.<br>2. Submit. | All formats normalized to standard E.164 (`+639171234567`) or local `09171234567` representation without validation error. | High |
| **TC-AUTH-03** | 4-Digit Quick PIN setup and lock screen | Logged in user | 1. Go to Settings > Security.<br>2. Set 4-digit PIN.<br>3. Lock till or idle.<br>4. Enter PIN. | Till unlocks instantly offline using PBKDF2/argon local hash verifier without remote roundtrip. | High |
| **TC-AUTH-04** | PIN brute-force lockout protection | Store locked with PIN | 1. Enter invalid PIN 5 consecutive times. | System engages 60-second lockout timer with countdown message; further attempts blocked until timer expires. | High |
| **TC-AUTH-05** | RA 10173 Data Privacy consent modal | First app launch | 1. Load app.<br>2. Verify modal content.<br>3. Click "Agree". | Modal displays statutory notice under PH RA 10173; dismissing sets consent flag; dialog never reappears on subsequent launches. | Medium |
| **TC-AUTH-06** | Tenant data isolation on logout / switch | Tenant A has local sales & utang | 1. Logout Tenant A.<br>2. Login as Tenant B. | Local Dexie tables for products, sales, customers, and utang are cleanly purged; Tenant A data never leaks into Tenant B session. | Critical |
| **TC-AUTH-07** | Demo mode switch and sandbox isolation | Logged out or Settings | 1. Click "Explore Demo Store". | Demo dataset seeds into IndexedDB (`isDemo=true`); sync engine network pushes are suppressed; demo banner displayed. | Medium |

---

### Module 2: Point of Sale (POS) & Checkout Engine

| Test ID | Test Scenario | Preconditions | Steps | Expected Outcome | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-POS-01** | Product catalog search & category chips | 100+ seeded products | 1. Type "Pancit Canton" in search.<br>2. Select "Noodles" category chip.<br>3. Clear search. | Instant sub-10ms filter matching barcode, title, or brand; category chip active state reflects selected filter; "All" restores catalog. | High |
| **TC-POS-02** | Barcode scanner integration (Camera & USB HID) | Camera permissions granted | 1. Click "Open Scanner" or scan physical EAN-13 barcode via USB HID.<br>2. Scan item. | Audio synthesizer plays success beep; item automatically added to cart; if item already in cart, quantity increments by 1. | Critical |
| **TC-POS-03** | Cart quantity adjustments & centavo math | Item in cart (₱14.50) | 1. Increment qty to 3.<br>2. Verify subtotal.<br>3. Decrement to 0. | Subtotal calculates to exactly ₱43.50 with zero centavo rounding drift; decrementing to 0 prompts removal or removes line item cleanly. | Critical |
| **TC-POS-04** | Cash payment with Philippine Peso shortcuts | Cart total = ₱148.00 | 1. Tap Checkout.<br>2. Click quick bill button `₱200`.<br>3. Verify change display.<br>4. Click "Complete Sale". | Cash received = ₱200.00, change computed as ₱52.00; sale commits to Dexie `sales` and `saleItems`; receipt modal displayed; cart resets. | Critical |
| **TC-POS-05** | Exact Cash shortcut payment | Cart total = ₱73.25 | 1. Tap Checkout.<br>2. Tap "Exact Amount".<br>3. Submit. | Cash received = ₱73.25, change = ₱0.00; transaction commits immediately. | High |
| **TC-POS-06** | Utang (Credit) POS checkout validation | Cart with 2 items | 1. Select payment method "Utang".<br>2. Attempt to complete sale without selecting customer.<br>3. Select customer "Juan Dela Cruz".<br>4. Complete sale. | Step 2 fails with prompt "Select a customer for Utang purchases"; Step 4 succeeds, records sale, and creates matching UtangLedger debit row. | Critical |
| **TC-POS-07** | Negative subtotal / invalid item rejection | POS till open | 1. Attempt submitting a sale payload with negative unit price or negative total amount. | Validation rejects with `ArgumentException`; transaction aborts without corrupting local or remote database. | Critical |
| **TC-POS-08** | Stock deduction on sale completion | Product has stock = 10 | 1. Sell 3 units of product.<br>2. Check Inventory. | Product stock quantity decrements to 7 immediately in IndexedDB; low-stock indicator appears if stock drops $\le 5$. | High |
| **TC-POS-09** | Out-of-stock sale warning | Product stock = 0 | 1. Add zero-stock product to cart.<br>2. Complete sale. | Warning toast informs merchant of negative/zero stock; sale allowed if store settings permit sari-sari backorder/trust sales. | Medium |
| **TC-POS-10** | Thermal receipt rendering & printing | Completed sale | 1. On receipt modal, click "Print Receipt". | Generates formatted 58mm/80mm ESC/POS layout with store header, itemized lines, VAT/TIN info (if configured), and footer watermark. | High |

---

### Module 3: Inventory & Catalog Management

| Test ID | Test Scenario | Preconditions | Steps | Expected Outcome | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-INV-01** | Add new product with barcode | Inventory page open | 1. Click "Add Product".<br>2. Input Name, Category, Cost (₱8.00), Price (₱10.00), Initial Stock (24), Barcode.<br>3. Save. | Profit margin automatically shows 20% (₱2.00); product appears in inventory and POS catalog immediately. | Critical |
| **TC-INV-02** | Restock shortcuts (+6, +12, +24) | Existing product stock = 5 | 1. Tap `+12` (Dozen) restock button.<br>2. Tap `+24` (Case) button. | Stock increments to 17, then 41; mutation saved to Dexie and queued in `syncQueue`. | High |
| **TC-INV-03** | Bulk CSV inventory import | CSV file with 50 items | 1. Navigate to Import tab.<br>2. Upload `inventory.csv`.<br>3. Preview rows.<br>4. Click "Import". | CSV parser parses rows, highlights missing prices/names in red; valid items committed to Dexie in single transaction. | High |
| **TC-INV-04** | Low-stock filtering & badge indicators | Products with stocks 2, 5, 15 | 1. Filter by "Low Stock ($\le 5$)". | Displays only products with stock $\le 5$; inventory warning badge matches count. | Medium |
| **TC-INV-05** | Libre tier catalog capacity limit enforcement | Store on Libre tier (limit = 50) | 1. Seed or create 50 active products.<br>2. Attempt to create 51st product. | Creation blocked with message: *"Libre plan limit exceeded: Maximum 50 products allowed. Upgrade to Tindahan Pro for unlimited catalog capacity."* | High |
| **TC-INV-06** | Product soft delete | Product with past sales | 1. Delete product. | Product marked `isDeleted = true`; hidden from POS catalog but retained in historical sales reports. | High |

---

### Module 4: Utang (Credit Ledger) & Suki Management

| Test ID | Test Scenario | Preconditions | Steps | Expected Outcome | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-UTG-01** | Create new customer (Suki) profile | Utang page open | 1. Click "Add Customer".<br>2. Enter Name "Maria Santos", mobile number `09181234567`, address/notes.<br>3. Save. | Customer created with ₱0.00 balance; phone normalized; debtor searchable in POS and Utang directory. | Critical |
| **TC-UTG-02** | Credit purchase (Palista) recording | Customer exists | 1. In Utang ledger, click "Add Utang" (or via POS credit checkout).<br>2. Amount = ₱150.00, Note = "2 Cans Sardines, 1 loaf bread".<br>3. Save. | Ledger appends `Credit` entry; customer `totalUtangBalance` increases by exactly ₱150.00; timestamp recorded in UTC/PHT. | Critical |
| **TC-UTG-03** | Partial debt repayment (Bayad) | Customer balance = ₱500.00 | 1. Click "Record Payment".<br>2. Amount = ₱200.00, Payment Method = "Cash".<br>3. Save. | Ledger appends `Payment` entry (₱200.00); customer balance updates to ₱300.00; ledger history remains intact (append-only). | Critical |
| **TC-UTG-04** | Full settlement & zero balance | Customer balance = ₱300.00 | 1. Record payment of ₱300.00. | Balance updates to ₱0.00; customer moves from "Active Debtors" list to settled list; ledger audit trail preserved. | High |
| **TC-UTG-05** | Append-only ledger audit integrity | Ledger with 10 entries | 1. Inspect IndexedDB `utangLedger` table.<br>2. Verify running balance calculation. | Running balance strictly matches $\sum(\text{Credit}) - \sum(\text{Payment})$; no rows are edited or deleted in place. | Critical |
| **TC-UTG-06** | Libre tier debtor limit enforcement | Store on Libre tier (limit = 20) | 1. Create 20 customer accounts.<br>2. Attempt to create 21st debtor. | Blocked with message: *"Libre plan limit exceeded: Maximum 20 debtors allowed. Upgrade to Tindahan Pro for unlimited customer accounts."* | High |

---

### Module 5: GCash Remittance & Fee Hub

| Test ID | Test Scenario | Preconditions | Steps | Expected Outcome | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-GCS-01** | Cash-In transaction & automated fee tiering | GCash Hub open | 1. Select "Cash-In".<br>2. Enter Amount = ₱1,000.00, Customer Phone = `09171234567`.<br>3. Verify fee. | Auto-calculates standard sari-sari fee (₱15.00); Total Cash Received = ₱1,015.00; GCash digital balance debited ₱1,000.00. | Critical |
| **TC-GCS-02** | Micro Cash-In fee tier ($\le$ ₱500) | GCash Hub open | 1. Select "Cash-In".<br>2. Enter Amount = ₱300.00. | Fee auto-computes to minimum sari-sari tier ₱10.00; Total Collected = ₱310.00. | High |
| **TC-GCS-03** | Cash-Out transaction & fee deduction | GCash Hub open | 1. Select "Cash-Out".<br>2. Enter Amount = ₱2,000.00, Ref No = `100234567890`.<br>3. Submit. | Fee computes to ₱30.00 (₱15 $\times$ 2); Cash handed to customer = ₱1,970.00 (or ₱2,000 cash given with separate ₱30 fee paid). | Critical |
| **TC-GCS-04** | Duplicate Reference Number rejection | Ref `998877665544` exists | 1. Record new Cash-In with Ref `998877665544`. | Submission rejected with conflict error: *"Reference number already recorded"*; duplicate entry blocked. | High |
| **TC-GCS-05** | Custom fee rule override | Fee settings open | 1. Adjust fee rate to ₱20 per ₱1,000.<br>2. Record ₱1,000 Cash-In. | Fee calculates to ₱20.00; customized rule persists in `useGCashFeeStore`. | Medium |
| **TC-GCS-06** | Libre tier monthly GCash transaction quota | Store on Libre tier (limit = 30) | 1. Record 30 GCash transactions in current month.<br>2. Attempt 31st transaction. | Rejected with message: *"Libre plan limit exceeded: 30 GCash transactions per month limit reached. Upgrade to Tindahan Pro for unlimited GCash transactions."* | High |

---

### Module 6: Offline-First Synchronization & Restore Engine

| Test ID | Test Scenario | Preconditions | Steps | Expected Outcome | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-SYNC-01** | Offline sale queueing | Disconnect network (Offline mode) | 1. Ring up 3 sales in POS.<br>2. Check sync status badge. | Sales commit to Dexie instantly; UI badge displays "3 pending sync"; till remains 100% operational with zero UI lag. | Critical |
| **TC-SYNC-02** | Automatic background sync on reconnect | 3 pending sales in queue | 1. Reconnect internet.<br>2. Observe network tab. | `syncEngine` detects online event; dispatches `POST /api/sync/batch`; clears `syncQueue`; badge updates to "Synced". | Critical |
| **TC-SYNC-03** | Exponential backoff on server 500 error | Backend returning 500 | 1. Queue local mutations.<br>2. Trigger sync. | Engine retries with exponential backoff (1s, 2s, 4s, 8s... max 60s); does NOT purge local items; no data loss. | High |
| **TC-SYNC-04** | Dead-Letter Queue (DLQ) & local archive | Mutation has corrupt payload | 1. Server returns permanent 422 error for specific mutation. | Unprocessable mutation moved to Dead-Letter Queue table and archived in `localStorage`; does not block remaining queue. | High |
| **TC-SYNC-05** | Re-authentication requirement handling (401) | JWT token expired & invalid | 1. Server returns 401 Unauthorized during batch sync. | Engine halts retries; preserves all pending mutations in `syncQueue`; prompts merchant to re-authenticate without deleting data. | Critical |
| **TC-SYNC-06** | Tenant data restore with compound `(Date, Id)` keyset cursor | Fresh device login, store has 2,500 historical sales | 1. Login to store account.<br>2. Trigger initial data restore. | Engine queries `/api/sales?limit=1000` with `before` and `beforeId`; fetches chunks 1, 2, and 3 without dropping records sharing timestamps at page boundaries; all 2,500 sales restored to Dexie. | Critical |
| **TC-SYNC-07** | Local product edits preservation during catalog pull | Product edited locally with sync pending | 1. Edit product price locally offline.<br>2. Background pull triggers. | `pullCatalogFromServer` checks `pendingIds`; server catalog does NOT overwrite pending local edits. | High |
| **TC-SYNC-08** | Multi-device concurrent mutation reconciliation | Device A and B edit same customer balance offline | 1. Device A records ₱100 payment.<br>2. Device B records ₱50 credit.<br>3. Both sync. | Both append-only ledger entries commit upstream; customer balance correctly aggregates to net reduction of ₱50. | Critical |

---

### Module 7: PWA Service Worker & Multi-Tab Coordinator

| Test ID | Test Scenario | Preconditions | Steps | Expected Outcome | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-PWA-01** | Service worker registration & offline asset caching | Clean install | 1. Load app.<br>2. Inspect DevTools Application tab. | Service worker registered (`sw.js`); precaches all HTML, JS, CSS, and webmanifest assets for offline load. | High |
| **TC-PWA-02** | Update deferral during active cart | Items in cart in Tab 1 | 1. Trigger service worker update (`onNeedReload`). | App suppresses page reload; sets update pending flag; keeps active cart and till UI intact. | Critical |
| **TC-PWA-03** | Multi-tab cart lock synchronization | Tab 1 and Tab 2 open | 1. Add item to cart in Tab 2.<br>2. Trigger SW update in Tab 1. | Tab 2 broadcasts active cart over `BroadcastChannel`; Tab 1 receives lock and defers reload. | Critical |
| **TC-PWA-04** | Deferred update execution on cart completion | Reload deferred | 1. Complete sale or clear cart.<br>2. Dismiss receipt. | Debounce timer (500ms) elapses; app smoothly applies service worker update and reloads. | High |
| **TC-PWA-05** | Navigation preload error resilience | Offline mode, page refreshed | 1. Refresh page while offline. | Guard prevents infinite reload loops on `vite:preloadError`; serves cached offline shell cleanly. | High |

---

### Module 8: Subscription Management & Tier Enforcements

| Test ID | Test Scenario | Preconditions | Steps | Expected Outcome | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-SUB-01** | PayMongo QR Ph intent creation | Store on Libre tier | 1. Navigate to Settings > Subscription.<br>2. Select Tindahan Pro (₱199/mo).<br>3. Click "Pay via QR Ph". | Server creates PayMongo QR payment intent; displays live QR code modal with 15-minute polling window. | High |
| **TC-SUB-02** | Real-time payment confirmation & upgrade | QR code displayed | 1. Simulate webhook / payment success in PayMongo.<br>2. Wait for poll. | Polling detects paid status; store tier upgrades to `TindahanPro`; quota limits unlocked immediately without app restart. | Critical |
| **TC-SUB-03** | Expired subscription automatic downgrade | Pro subscription past `SubscriptionEndDate` | 1. Advance server date past expiration.<br>2. Login or sync. | API and client detect expired date; tier smoothly falls back to `Libre`; existing catalog/debts preserved in read-only/soft state. | Critical |
| **TC-SUB-04** | Pro feature access gate | Store on Libre tier | 1. Check feature flags for advanced analytics and unlimited export. | Pro features display upgrade prompt; core retail checkout functions remain 100% accessible. | Medium |

---

### Module 9: Hardware, ESC/POS Thermal Printing & Responsive Layout

| Test ID | Test Scenario | Preconditions | Steps | Expected Outcome | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-HW-01** | 58mm ESC/POS thermal printer simulation | Settings > Printer open | 1. Select 58mm paper width.<br>2. Click "Test Printer". | Test print formats 32-character column width; prints test receipt cleanly. | High |
| **TC-HW-02** | 80mm ESC/POS wide thermal layout | Settings > Printer open | 1. Select 80mm paper width.<br>2. Complete sale and print receipt. | Layout expands to 48-character column width with dual-column item/price breakdown. | Medium |
| **TC-HW-03** | Mobile 375px responsive bottom navigation dock | Viewport = 375px $\times$ 667px | 1. Navigate across Dashboard, POS, Inventory, Utang, GCash tabs. | Navigation bar stays docked at bottom; icons and touch targets $\ge 48\text{px}$; no horizontal scrolling or clipped text. | High |
| **TC-HW-04** | Language switching reactivity (Filipino $\leftrightarrow$ English) | Any screen | 1. Toggle language in header from English to Tagalog (`PH TL`). | All labels, action buttons, dialogs, and receipt watermarks update instantly without page refresh. | High |

---

## 5. Non-Functional & Resilience Chaos Testing

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CHAOS TEST SUITE                                │
├────────────────────────────┬───────────────────────────────────────────┤
│ Condition                  │ Expected Behavior                         │
├────────────────────────────┼───────────────────────────────────────────┤
│ 1. Sudden Airplane Mode    │ Instant switch to local queue. Zero loss. │
│ 2. 50% Packet Drop Rate    │ Exponential backoff retry without crash.  │
│ 3. Sudden Battery Death    │ Uncommitted cart in localStorage/Dexie.   │
│ 4. Storage Quota Exceeded  │ Warning banner displayed, non-destructive │
│ 5. Multi-Tab Tab Race      │ BroadcastChannel locks active transaction.│
└────────────────────────────┴───────────────────────────────────────────┘
```

1. **Abrupt Network Termination During POS Sale**:
   - *Procedure*: Cut Wi-Fi/cellular connection at the exact moment merchant taps "Complete Sale".
   - *Pass Criteria*: Sale commits to local IndexedDB in $<15\text{ms}$; mutation pushed to `syncQueue`; cash drawer trigger/receipt displays without error; sync resumes once connectivity is restored.
2. **High Latency Simulation (3,000ms ping)**:
   - *Procedure*: Throttle network via DevTools to "Slow 3G" (2,000ms latency, 400kbps throughput).
   - *Pass Criteria*: POS and catalog browsing remain instantaneous ($<16\text{ms}$ frame time); background sync runs asynchronously without spinning full-screen blockers.
3. **Local Storage Eviction Resilience**:
   - *Procedure*: Request persistent storage quota via `navigator.storage.persist()`.
   - *Pass Criteria*: Storage marked "persistent"; browser does not evict IndexedDB records under OS disk pressure.

---

## 6. Test Execution & Automation Playbook

### 6.1 Automated Unit & Integration Testing

#### Frontend Test Suite (Vitest)
```powershell
# Navigate to frontend
cd frontend

# Execute full unit & integration test suite (748 tests / 66 suites)
npm test -- --run

# Run code coverage report
npm test -- --coverage

# Run linter
npm run lint

# Validate TypeScript & build output
npm run build
```

#### Backend Test Suite (.NET xUnit)
```powershell
# Navigate to backend
cd backend

# Execute all unit and domain rule tests (404 tests)
dotnet test --no-restore
```

### 6.2 Manual Multi-Tab PWA Update Verification Protocol
1. Open two browser tabs to `http://localhost:5173/` (Tab A and Tab B).
2. In Tab A, add 2 products to the cart.
3. Trigger a Service Worker update by modifying a dummy file or calling `navigator.serviceWorker.getRegistration().then(r => r.update())`.
4. Verify that an update is detected, but **neither Tab A nor Tab B reloads** while Tab A has items in the cart.
5. In Tab A, complete the checkout or clear the cart.
6. Verify that within 500ms debounce, the app executes `window.location.reload()` smoothly, activating the new service worker version.

---

## 7. QA Sign-Off & Release Gate Criteria

A build is certified for staging or production deployment only when:
- [x] **Zero Critical or High severity defects open**.
- [x] **100% pass rate across all 404 backend xUnit tests**.
- [x] **100% pass rate across all 748 frontend Vitest test specifications**.
- [x] **Clean compilation (`tsc -b`) and zero linter warnings/errors (`oxlint`)**.
- [x] **Offline checkout and background batch sync verified on real Android Chromium mobile browser**.
- [x] **Compound `(Date, Id)` keyset pagination verified with $\ge 1,000$ transactions**.
- [x] **Service Worker update protection verified across concurrent browser tabs**.

---
*Fluent Tindahan QA Team — Quality Assurance & Reliability Engineering*
