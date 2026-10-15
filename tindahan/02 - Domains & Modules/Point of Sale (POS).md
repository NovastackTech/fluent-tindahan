---
title: Point of Sale (POS)
tags: [domain, pos, retail, cart, checkout, payments]
updated: 2026-10-10
---

# 🛒 Point of Sale (POS)

The Point of Sale module is the central interface of Fluent Tindahan. Designed specifically for fast, high-volume transactions in neighborhood stores, it supports touch-first operation on Android tablets, mobile phones, and desktop PCs.

```mermaid
graph TD
    Scan["📷 Barcode Scanner / Search"] --> AddCart["🛒 Add to Cart\n(Integer Centavo Precision)"]
    AddCart --> Cart["Cart Drawer\n(Persisted to sessionStorage)"]
    Cart --> Checkout["💳 Checkout Modal"]
    
    Checkout --> PayCash["💵 Cash (Change Calculator)"]
    Checkout --> PayGCash["📱 GCash (Ref # Tracking)"]
    Checkout --> PayUtang["📒 Utang (Suki Credit Line)"]
    Checkout --> PaySplit["🔀 Split Payment"]
    
    PayCash --> Complete["✅ Complete Sale & Decrement Stock"]
    PayGCash --> Complete
    PayUtang --> Complete
    PaySplit --> Complete
    
    Complete --> Print["🖨️ Thermal Receipt Print / SMS"]
```

---

## 1. Barcode Scanning & Item Lookup

The POS supports three methods of item entry:
1. **Hardware USB / Bluetooth Barcode Scanners**: Listens to raw `keydown` events. Rapid keystrokes ending with an `Enter` key automatically identify and append the scanned barcode to the cart without requiring input field focus.
2. **Camera Scanner (`BarcodeScannerModal.tsx`)**: Utilizes the device camera via the HTML5 Barcode Detection API or ZXing library to scan EAN-13 barcodes on packaged goods.
3. **Touch Grid & Search**: Fast text filtering with category tabs (Instant Noodles, Beverages, Canned Goods, Tingi, etc.).

---

## 2. Cart Calculation & Centavo Precision

JavaScript floating-point arithmetic can produce drift (e.g., `0.1 + 0.2 = 0.30000000000000004`). In a retail till, even a single centavo discrepancy damages trust.

The POS store (`cartStore.ts`) enforces integer centavo calculations:
```typescript
// Calculation in integer centavos
const unitPriceCentavos = Math.round(product.price * 100);
const subtotalCentavos = unitPriceCentavos * item.quantity;
const totalCentavos = items.reduce((acc, item) => 
  acc + Math.round(item.price * 100) * item.quantity, 0);

const totalAmount = totalCentavos / 100;
```

---

## 3. Cart Crash & Reload Persistence

To protect active transactions against accidental browser refreshes, battery exhaustion, or background tab discards:
- The cart store syncs state to browser storage (`sessionStorage` / Dexie).
- If the browser restarts mid-transaction, the open cart is restored immediately upon opening the app.
- When an active cart exists, the [[PWA & Service Worker]] explicitly defers any pending application updates to prevent tearing down the sale.

---

## 4. Payment Methods & Checkout Flow

| Payment Method | Operational Behavior |
| :--- | :--- |
| **Cash** | Cashier inputs amount received; real-time change calculation displayed in large bold text (e.g., `₱1,000 received - ₱245 total = ₱755 change`). |
| **GCash** | Records the customer's GCash mobile number and reference number. Optionally logs an automated service fee if applicable. |
| **Utang (Credit)** | Prompts for a registered customer. Appends a `Credit` entry to the [[Utang Ledger]] and updates the customer's running debt balance. |
| **Split Payment** | Allows partial cash and partial GCash/Utang for larger orders. |

---

## 5. Sale Completion & Receipt Generation

Upon confirming checkout:
1. A new `SaleRecord` and corresponding `SaleItemRecord` entries are generated with client UUIDs.
2. The product's `stockQty` is decremented in Dexie's `products` table.
3. Mutations are queued in `syncQueue` for upstream synchronization.
4. A 58mm/80mm thermal receipt dialog is rendered (see [[Thermal Printing & Hardware]]).

---

## 6. Offline-First Stock Validation Policy & Override

In physical sari-sari stores operating offline or with multi-device operations:
- Local recorded stock may be out of date (e.g., new supplier delivery not yet encoded, or another family member rung up sales on a separate till that has not yet synced upstream).
- A hard checkout block when system stock is 0 or low would prevent store owners from ringing up a customer who is physically holding the goods at the counter.

Fluent Tindahan provides a configurable **POS Stock Policy** (`usePosSettingsStore.ts`):
1. **Warn Only (`'warn'`, Default)**:
   - When recorded stock is 0 or less than the cart quantity, an informative warning badge/toast is displayed to notify the cashier.
   - Checkout is **never blocked**. The transaction proceeds seamlessly.
   - In local Dexie updates, inventory stock is decremented cleanly using `Math.max(0, currentStock - soldQty)` to prevent negative values in the local database.
   - Backend sync records the exact quantities sold on the append-only `SaleItems` ledger so financial totals and sales reporting are 100% accurate.

2. **Strict Block with Owner Override (`'block'`)**:
   - For stores desiring strict inventory enforcement, items at or above recorded stock cannot be added directly, and the checkout button is disabled if cart quantities exceed stock.
   - However, store owners can click **"Pahintulutan ang Pagbenta (Override)" / "Override & Sell Anyway"** in the cart drawer or checkout dialog.
   - An explicit confirmation modal (`ConfirmStockOverrideDialog.tsx`) details all products with insufficient recorded stock. Upon confirmation, the sale is unblocked and rings up without friction.

---

## Related Notes
- [[Inventory & Tingi]] — Product catalog management and stock levels.
- [[Utang Ledger]] — Managing customer credit lines.
- [[GCash Agent System]] — Remittance and wallet reconciliation.
- [[Thermal Printing & Hardware]] — ESC/POS printing drivers.
- [[PWA & Service Worker]] — Multi-tab update safety during active sales.
