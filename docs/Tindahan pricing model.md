# Pricing Model & Monetization Strategy

**Target Market:** Small Philippine businesses (sari-sari stores, GCash agents, small retailers)[cite: 1].
**Design & Platform Constraints:** Designed for low-end Android devices using an offline-first PWA architecture (React + Dexie.js)[cite: 1]. 
**Billing Strategy:** Prepaid 30-day Tindahan Pro access through a fresh QR Ph or hosted-checkout payment for each renewal.

---

## 1. Tiers & Feature Breakdown

### Libre Tier (Free Forever)
*Designed for single-owner micro sari-sari stores replacing physical paper notebooks.*

* **Price:** ₱0
* **User & Device Limit:** 1 User (Owner only), 1 active mobile device[cite: 1].
* **Core POS:** Up to 30 product catalog items[cite: 1], camera barcode scanning, cash and manual GCash tender[cite: 1]. Existing items remain usable after a Pro subscription expires; new items are blocked while the catalog is at or above 30.
* **Utang Tracker:** Up to 30 active customer debt ledgers[cite: 1].
* **GCash Agent Ledger:** Up to 30 GCash transactions per month[cite: 1].
* **Receipts & Sync:** Digital receipt generation via Web Share API to Messenger/Viber (standard watermark)[cite: 1], offline IndexedDB storage with background cloud sync[cite: 1].
* **Data Retention:** 30 days of historical sales and debt records in cloud backup.

### Tindahan Pro
*Designed for high-volume neighborhood stores and active GCash community agents needing automated fee calculation and inventory expansion[cite: 1].*

* **Price:** ₱129 per 30 days
* **User & Device Limit:** 1 User, up to 2 synchronized devices[cite: 1].
* **Core POS & Inventory:** Unlimited product catalog[cite: 1], low-stock alerts, fast bulk CSV product catalog import using `react-papaparse`[cite: 1].
* **Utang Tracker:** Unlimited debtor accounts and append-only ledger history[cite: 1].
* **GCash Agent Engine:** Unlimited GCash transaction logging, automated fee calculator, and running daily agent liquidity balances[cite: 1].
* **Analytics & Reports:** Daily/weekly net profit calculation, fast sales breakdown, and CSV data export.
* **Receipts & Backup:** Customized digital receipt branding[cite: 1]; continuous cloud sync with permanent historical data retention[cite: 1].

## 2. Feature Comparison Matrix

| Feature | Libre (Free) | Tindahan Pro |
| :--- | :--- | :--- |
| **Price** | **₱0** | **₱129 / 30 days** |
| **Catalog Capacity (`Product`)**[cite: 1] | 30 items | Unlimited |
| **Debtor Accounts (`Customer`)**[cite: 1] | 30 debtors | Unlimited |
| **GCash Logs (`GCashTxn`)**[cite: 1] | 30 txns/month | Unlimited |
| **Staff Accounts (`User.Role`)**[cite: 1] | 1 (Owner only) | 1 (Owner only) |
| **Active Devices** | 1 device | 2 devices |
| **Offline-First Dexie / PWA Sync**[cite: 1] | Yes[cite: 1] | Yes[cite: 1] |
| **CSV Catalog Import**[cite: 1] | No | Yes[cite: 1] |
| **Digital Receipts (Web Share)**[cite: 1] | App-watermarked[cite: 1] | Store-branded |
| **Gross & Net Profit Analytics** | Basic total sales | Full profit/margin |
| **Cloud Backup Retention** | 30 days | Permanent |

---

## 3. Conversion Triggers & Monetization Strategy

1. **Volume Caps over Feature Locks:** Keeping offline POS, Utang, and GCash features active on Libre preserves trust and daily usage. The product upgrade trigger occurs at 30 catalog items.
2. **Prepaid renewal:** Each successful payment extends Pro by 30 days from the later of the verified PayMongo payment time or the current expiry.
