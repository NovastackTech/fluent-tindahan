# Pricing Model & Monetization Strategy

**Target Market:** Small Philippine businesses (sari-sari stores, GCash agents, small retailers)[cite: 1].
**Design & Platform Constraints:** Designed for low-end Android devices using an offline-first PWA architecture (React + Dexie.js)[cite: 1]. 
**Billing Strategy:** Sachet-friendly pricing via e-wallets (weekly/monthly) to align with micro-retail cash flow.

---

## 1. Tiers & Feature Breakdown

### Libre Tier (Free Forever)
*Designed for single-owner micro sari-sari stores replacing physical paper notebooks.*

* **Price:** ₱0
* **User & Device Limit:** 1 User (Owner only), 1 active mobile device[cite: 1].
* **Core POS:** Up to 50 product catalog items[cite: 1], camera barcode scanning, cash and manual GCash tender[cite: 1].
* **Utang Tracker:** Up to 30 active customer debt ledgers[cite: 1].
* **GCash Agent Ledger:** Up to 30 GCash transactions per month[cite: 1].
* **Receipts & Sync:** Digital receipt generation via Web Share API to Messenger/Viber (standard watermark)[cite: 1], offline IndexedDB storage with background cloud sync[cite: 1].
* **Data Retention:** 30 days of historical sales and debt records in cloud backup.

### Tindahan Pro
*Designed for high-volume neighborhood stores and active GCash community agents needing automated fee calculation and inventory expansion[cite: 1].*

* **Price:** ₱129 / month (or ₱35 / week)
* **User & Device Limit:** 1 User, up to 2 synchronized devices[cite: 1].
* **Core POS & Inventory:** Unlimited product catalog[cite: 1], low-stock alerts, fast bulk CSV product catalog import using `react-papaparse`[cite: 1].
* **Utang Tracker:** Unlimited debtor accounts and append-only ledger history[cite: 1].
* **GCash Agent Engine:** Unlimited GCash transaction logging, automated fee calculator, and running daily agent liquidity balances[cite: 1].
* **Analytics & Reports:** Daily/weekly net profit calculation, fast sales breakdown, and CSV data export.
* **Receipts & Backup:** Customized digital receipt branding[cite: 1]; continuous cloud sync with permanent historical data retention[cite: 1].

### Negosyo Plus
*Designed for larger neighborhood minimarts, wholesale sari-sari stores, or multi-shift operations employing trusted helpers.*

* **Price:** ₱349 / month (or ₱89 / week)
* **User & Device Limit:** Up to 5 users (`Owner` and `Staff` roles) across up to 4 devices per tenant[cite: 1].
* **Role-Based Access Control (RBAC):** `Staff` can record sales, log utang, and process GCash transactions, but cannot view total store profit, delete records, or export ledger data[cite: 1].
* **Audit Trail:** Activity logs tracking who recorded which transaction, modified product prices, or marked debts as paid[cite: 1].
* **Customer Debt Management:** Ready-to-send debt reminder templates pre-formatted for Viber/Messenger.
* **Support & Recovery:** Priority support via Viber/Messenger and full remote database restore assistance[cite: 1].

---

## 2. Feature Comparison Matrix

| Feature | Libre (Free) | Tindahan Pro | Negosyo Plus |
| :--- | :--- | :--- | :--- |
| **Price (Monthly / Sachet)** | **₱0** | **₱129 / mo** (₱35/wk) | **₱349 / mo** (₱89/wk) |
| **Catalog Capacity (`Product`)**[cite: 1] | 50 items | Unlimited | Unlimited |
| **Debtor Accounts (`Customer`)**[cite: 1] | 30 debtors | Unlimited | Unlimited |
| **GCash Logs (`GCashTxn`)**[cite: 1] | 30 txns/month | Unlimited | Unlimited |
| **Staff Accounts (`User.Role`)**[cite: 1] | 1 (Owner only) | 1 (Owner only) | Up to 5 (Owner + Staff) |
| **Active Devices** | 1 device | 2 devices | 4 devices |
| **Offline-First Dexie / PWA Sync**[cite: 1] | Yes[cite: 1] | Yes[cite: 1] | Yes[cite: 1] |
| **CSV Catalog Import**[cite: 1] | No | Yes[cite: 1] | Yes |
| **Digital Receipts (Web Share)**[cite: 1] | App-watermarked[cite: 1] | Store-branded | Store-branded |
| **Gross & Net Profit Analytics** | Basic total sales | Full profit/margin | Full profit + shift metrics |
| **Audit Logs (Edits / Voids)** | No | No | Yes |
| **Cloud Backup Retention** | 30 days | Permanent | Permanent |

---

## 3. Conversion Triggers & Monetization Strategy

1. **Volume Caps over Feature Locks:** Keeping offline POS, Utang, and GCash features active on the Free tier ensures trust and daily usage[cite: 1]. The natural upgrade trigger occurs when a store exceeds 50 items or 30 debtors[cite: 1].
2. **Staff Permission Gate:** Gating the `Staff` role behind the highest tier directly capitalizes on a high-value trust problem for multi-shift operations[cite: 1].
3. **Sachet Payment Integration:** Offer recurring or prepay options via GCash, Maya, or 7-Eleven CLIQQ OTC using 7-day, 30-day, or 90-day license passes.