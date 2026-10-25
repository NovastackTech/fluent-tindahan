import subprocess
import os
from pathlib import Path
from tempfile import TemporaryDirectory

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Fluent Tindahan — Functional Testing Plan & Quality Assurance Specification</title>
<style>
  @page {
    size: A4;
    margin: 14mm 14mm 14mm 14mm;
    @bottom-right {
      content: counter(page);
    }
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1a1a1a;
    line-height: 1.45;
    font-size: 11px;
    margin: 0;
    padding: 0;
  }
  .header-card {
    background: linear-gradient(135deg, #0e7041 0%, #1b5e20 100%);
    color: #ffffff;
    padding: 16px 20px;
    border-radius: 6px;
    margin-bottom: 16px;
  }
  .header-card h1 {
    font-size: 20px;
    margin: 0 0 4px 0;
    color: #ffffff;
    border: none;
    padding: 0;
  }
  .header-card p {
    margin: 0;
    color: #e8f5e9;
    font-size: 11.5px;
  }
  .meta-grid {
    display: flex;
    justify-content: space-between;
    background: #f4fbf7;
    border: 1px solid #c8e6c9;
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 16px;
  }
  .meta-item {
    font-size: 10.5px;
  }
  .meta-item strong {
    color: #1b5e20;
    display: block;
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  h2 {
    font-size: 14px;
    color: #0e7041;
    border-bottom: 1.5px solid #0e7041;
    padding-bottom: 3px;
    margin-top: 16px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }
  h3 {
    font-size: 12px;
    color: #1b5e20;
    margin-top: 12px;
    margin-bottom: 4px;
    page-break-after: avoid;
  }
  p, li {
    font-size: 10.5px;
    color: #2c3e50;
    margin-top: 2px;
    margin-bottom: 6px;
  }
  ul, ol {
    margin-top: 2px;
    margin-bottom: 6px;
    padding-left: 18px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 6px 0 12px 0;
    font-size: 9.5px;
    page-break-inside: auto;
  }
  tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
  th, td {
    border: 1px solid #dcdcdc;
    padding: 4px 6px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background-color: #f0f7f3;
    color: #1b5e20;
    font-weight: 600;
  }
  tr:nth-child(even) {
    background-color: #fafbfc;
  }
  code {
    font-family: Consolas, "Courier New", monospace;
    font-size: 9.5px;
    background-color: #f3f4f6;
    padding: 1px 3px;
    border-radius: 3px;
    color: #b91c1c;
  }
  pre {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 3px solid #0e7041;
    padding: 6px 10px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 9.5px;
    margin: 4px 0 8px 0;
  }
  .badge {
    display: inline-block;
    padding: 1px 5px;
    font-size: 8.5px;
    font-weight: bold;
    border-radius: 3px;
    text-transform: uppercase;
  }
  .badge-critical { background-color: #fee2e2; color: #991b1b; border: 1px solid #f87171; }
  .badge-high { background-color: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  .badge-medium { background-color: #e0f2fe; color: #075985; border: 1px solid #7dd3fc; }
  .badge-pass { background-color: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .callout {
    background: #f0fdf4;
    border-left: 3px solid #16a34a;
    padding: 6px 10px;
    margin: 8px 0;
    border-radius: 0 4px 4px 0;
    font-size: 10px;
  }
  .callout-title {
    font-weight: bold;
    color: #166534;
    margin-bottom: 2px;
  }
</style>
</head>
<body>

<div class="header-card">
  <h1>🛒 Fluent Tindahan — Functional Testing Plan</h1>
  <p>Comprehensive Quality Assurance Specification, End-to-End Verification & Offline Invariant Matrices</p>
</div>

<div class="meta-grid">
  <div class="meta-item">
    <strong>Application</strong>
    Fluent Tindahan POS
  </div>
  <div class="meta-item">
    <strong>Architecture</strong>
    Offline-First PWA + .NET 8 WebApi
  </div>
  <div class="meta-item">
    <strong>Target Stack</strong>
    React 19 + Dexie.js + EF Core
  </div>
  <div class="meta-item">
    <strong>Target Audience</strong>
    Philippine Sari-Sari Stores & GCash
  </div>
  <div class="meta-item">
    <strong>Document Status</strong>
    Release Gate Specification
  </div>
</div>

<h2>1. Executive Summary & Core Architectural Invariants</h2>
<p>
This test plan provides comprehensive verification criteria for <strong>Fluent Tindahan</strong>, an offline-first Progressive Web App (PWA) and retail management platform built for Philippine neighborhood micro-retailers (<em>sari-sari stores</em>) and commercial GCash cash-in/cash-out agents operating on low-end Android mobile devices with intermittent connectivity.
</p>

<div class="callout">
  <div class="callout-title">Core Invariants Tested Across All Modules:</div>
  <ul>
    <li><strong>Zero-Latency Local Writes:</strong> All counter actions commit to Dexie.js (IndexedDB) first; UI never blocks waiting for HTTP roundtrips.</li>
    <li><strong>Integer Centavo Arithmetic:</strong> Financial calculations operate in integer centavos (<code>Math.round(price * 100)</code>) to prevent rounding drift.</li>
    <li><strong>Multi-Tab Transaction Safety:</strong> Background service worker updates are deferred if any open tab contains an active cart or receipt.</li>
    <li><strong>Append-Only Debt & Remittance Ledgers:</strong> Customer utang and GCash tables are append-only; debtor balances aggregate as <code>Sum(Credit) - Sum(Payment)</code>.</li>
    <li><strong>Compound Keyset Synchronization:</strong> Upstream restore loops use <code>(Date, Id)</code> compound cursors to prevent missing boundary records.</li>
  </ul>
</div>

<h2>2. Test Module Matrix & Functional Specifications</h2>

<h3>Module 1: Shell, Onboarding, Authentication & Multi-Tenancy</h3>
<table>
  <thead>
    <tr>
      <th style="width:12%">Test ID</th>
      <th style="width:20%">Feature</th>
      <th style="width:28%">Steps & Inputs</th>
      <th style="width:30%">Expected Result</th>
      <th style="width:10%">Severity</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>TC-AUTH-01</code></td>
      <td>Store Owner Registration</td>
      <td>Register store name, owner, PH mobile number, email, and password.</td>
      <td>JWT + refresh token stored; tenant provisioned with trial/Libre tier; redirected to POS.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-AUTH-02</code></td>
      <td>PH Mobile Number Normalization</td>
      <td>Input <code>+63 917 123 4567</code>, <code>0917-123-4567</code>, and <code>9171234567</code>.</td>
      <td>All formats normalize to standard E.164 (<code>+639171234567</code>) or local <code>09171234567</code>.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
    <tr>
      <td><code>TC-AUTH-03</code></td>
      <td>4-Digit PIN Lock & Unlock</td>
      <td>Set 4-digit PIN in Settings; lock app or trigger idle; enter PIN.</td>
      <td>Till unlocks instantly offline using local PBKDF2 verifier without remote roundtrip.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
    <tr>
      <td><code>TC-AUTH-04</code></td>
      <td>PIN Brute-Force Lockout</td>
      <td>Submit 5 consecutive incorrect PIN attempts.</td>
      <td>15-minute lockout engaged; UI displays remaining time and blocks PIN input until expiry.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
    <tr>
      <td><code>TC-AUTH-05</code></td>
      <td>RA 10173 Privacy Consent</td>
      <td>First app launch; review statutory privacy notice; click Agree.</td>
      <td>Consent recorded in localStorage; modal dismisses cleanly and does not re-prompt.</td>
      <td><span class="badge badge-medium">Medium</span></td>
    </tr>
    <tr>
      <td><code>TC-AUTH-06</code></td>
      <td>Tenant Data Isolation</td>
      <td>Logout Tenant A; login with Tenant B credentials.</td>
      <td>IndexedDB products, customers, utang, and sales tables purged; Tenant A data never leaks.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
  </tbody>
</table>

<h3>Module 2: Point of Sale (POS) & Checkout Engine</h3>
<table>
  <thead>
    <tr>
      <th style="width:12%">Test ID</th>
      <th style="width:20%">Feature</th>
      <th style="width:28%">Steps & Inputs</th>
      <th style="width:30%">Expected Result</th>
      <th style="width:10%">Severity</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>TC-POS-01</code></td>
      <td>Search & Category Filtering</td>
      <td>Type "Pancit Canton" in search bar; click category chip.</td>
      <td>Instant sub-10ms catalog filter; displays matching items with exact prices and stock.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
    <tr>
      <td><code>TC-POS-02</code></td>
      <td>Barcode Scanner (Camera/USB)</td>
      <td>Scan barcode via camera modal or hardware USB scanner.</td>
      <td>Audio beep synthesizer confirms scan; item added to cart; quantity increments if present.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-POS-03</code></td>
      <td>Centavo Math & Floating Cart</td>
      <td>Add 3 items at ₱14.50; increment and decrement quantities.</td>
      <td>Subtotal computes exactly to ₱43.50 with zero centavo rounding drift; floating cart bar updates.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-POS-04</code></td>
      <td>Cash Checkout & Peso Buttons</td>
      <td>Cart = ₱148.00; tap checkout; tap quick <code>₱200</code> bill button.</td>
      <td>Change calculated as ₱52.00; sale commits to Dexie; receipt modal displays; cart resets.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-POS-05</code></td>
      <td>Exact Amount Checkout</td>
      <td>Cart = ₱73.25; tap "Exact Amount" button; complete sale.</td>
      <td>Cash received = ₱73.25, change = ₱0.00; sale commits immediately with 0 change.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
    <tr>
      <td><code>TC-POS-06</code></td>
      <td>Utang (Credit) Checkout</td>
      <td>Select payment method "Utang"; select debtor customer.</td>
      <td>Enforces debtor selection; sale records and appends matching UtangLedger credit entry.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-POS-07</code></td>
      <td>Negative Subtotal Validation</td>
      <td>Attempt submitting sale with negative unit price or negative total.</td>
      <td>Backend and client reject with ArgumentException; prevents corrupted ledger records.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-POS-08</code></td>
      <td>Stock Deduction On Sale</td>
      <td>Product initial stock = 10; complete sale with qty = 3.</td>
      <td>Stock immediately decrements to 7 in IndexedDB; low-stock indicator shown if stock &le; 5.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
  </tbody>
</table>

<h3>Module 3: Inventory & Catalog Management</h3>
<table>
  <thead>
    <tr>
      <th style="width:12%">Test ID</th>
      <th style="width:20%">Feature</th>
      <th style="width:28%">Steps & Inputs</th>
      <th style="width:30%">Expected Result</th>
      <th style="width:10%">Severity</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>TC-INV-01</code></td>
      <td>Create Product with Profit Margin</td>
      <td>Add product with Cost ₱8.00, Price ₱10.00, Initial Stock 24.</td>
      <td>Profit margin calculates 20% (₱2.00); product appears in inventory and POS instantly.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-INV-02</code></td>
      <td>Restock Shortcuts (+6, +12, +24)</td>
      <td>Tap <code>+12</code> (Dozen) and <code>+24</code> (Case) restock buttons.</td>
      <td>Stock increments by 12 and 24; mutation queued in local syncQueue table.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
    <tr>
      <td><code>TC-INV-03</code></td>
      <td>Bulk CSV Catalog Import</td>
      <td>Upload 50-item inventory CSV with valid and invalid rows.</td>
      <td>Parser highlights errors; imports valid rows in single Dexie transaction.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
    <tr>
      <td><code>TC-INV-04</code></td>
      <td>Libre Tier Catalog Quota (50 Items)</td>
      <td>Attempt creating 51st product on Libre plan.</td>
      <td>Blocked with upgrade dialog explaining 50-product capacity limit on Libre tier.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
  </tbody>
</table>

<h3>Module 4: Utang (Credit Ledger) & Suki Management</h3>
<table>
  <thead>
    <tr>
      <th style="width:12%">Test ID</th>
      <th style="width:20%">Feature</th>
      <th style="width:28%">Steps & Inputs</th>
      <th style="width:30%">Expected Result</th>
      <th style="width:10%">Severity</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>TC-UTG-01</code></td>
      <td>Customer Profile Creation</td>
      <td>Add customer with Name and Philippine mobile number.</td>
      <td>Debtor profile created with ₱0.00 initial balance; searchable in POS and Utang directory.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-UTG-02</code></td>
      <td>Credit Entry (Palista) Recording</td>
      <td>Record credit purchase of ₱150.00 with item notes.</td>
      <td>Appends Credit ledger row; customer balance increments by ₱150.00; stores UTC timestamp.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-UTG-03</code></td>
      <td>Debt Payment (Bayad) Recording</td>
      <td>Customer balance = ₱500.00; record payment of ₱200.00.</td>
      <td>Appends Payment ledger row; running balance updates to ₱300.00; history preserved.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-UTG-04</code></td>
      <td>Append-Only Integrity Audit</td>
      <td>Audit ledger entries across multiple credits and repayments.</td>
      <td>Customer debt strictly equals <code>Sum(Credit) - Sum(Payment)</code>; rows never updated in place.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-UTG-05</code></td>
      <td>Libre Tier Debtor Quota (20 Suki)</td>
      <td>Attempt creating 21st customer on Libre plan.</td>
      <td>Blocked with message: 20 debtor account limit reached; prompts upgrade to Tindahan Pro.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
  </tbody>
</table>

<h3>Module 5: GCash Remittance & Fee Hub</h3>
<table>
  <thead>
    <tr>
      <th style="width:12%">Test ID</th>
      <th style="width:20%">Feature</th>
      <th style="width:28%">Steps & Inputs</th>
      <th style="width:30%">Expected Result</th>
      <th style="width:10%">Severity</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>TC-GCS-01</code></td>
      <td>Cash-In Standard Fee Calculation</td>
      <td>Cash-In ₱1,000.00 with customer phone.</td>
      <td>Auto-computes standard ₱15 fee; total collected = ₱1,015.00; digital balance debited ₱1,000.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-GCS-02</code></td>
      <td>Micro Cash-In Fee Tier (&le; ₱500)</td>
      <td>Cash-In ₱300.00.</td>
      <td>Auto-computes base ₱10.00 tier fee; total collected = ₱310.00.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
    <tr>
      <td><code>TC-GCS-03</code></td>
      <td>Cash-Out Transaction & Fee Deduction</td>
      <td>Cash-Out ₱2,000.00 with reference number.</td>
      <td>Fee computes to ₱30.00; Cash given = ₱1,970.00; updates daily volume and earnings summary.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-GCS-04</code></td>
      <td>Duplicate Reference Number Guard</td>
      <td>Record transaction with reference number already in table.</td>
      <td>System flags 409 conflict: duplicate reference number rejected; prevents duplicate accounting.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
    <tr>
      <td><code>TC-GCS-05</code></td>
      <td>Libre Tier Monthly GCash Quota</td>
      <td>Record 31st GCash transaction in current calendar month.</td>
      <td>Blocked: 30 transactions/month limit reached on Libre tier; prompts upgrade to Pro.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
  </tbody>
</table>

<h3>Module 6: Offline-First Synchronization & Keyset Restore</h3>
<table>
  <thead>
    <tr>
      <th style="width:12%">Test ID</th>
      <th style="width:20%">Feature</th>
      <th style="width:28%">Steps & Inputs</th>
      <th style="width:30%">Expected Result</th>
      <th style="width:10%">Severity</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>TC-SYNC-01</code></td>
      <td>Offline POS Sale Queueing</td>
      <td>Disconnect internet; execute 3 POS sales.</td>
      <td>Sales commit to Dexie immediately; sync status shows "3 pending"; zero lag during till use.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-SYNC-02</code></td>
      <td>Auto Batch Push on Reconnect</td>
      <td>Reconnect network with pending mutations.</td>
      <td>Engine detects online event; posts batch to <code>/api/sync/batch</code>; clears queue; updates badge.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-SYNC-03</code></td>
      <td>Exponential Retry Backoff</td>
      <td>Simulate server 500 error during batch sync.</td>
      <td>Engine retries with exponential delay (1s, 2s, 4s... max 60s); preserves local queue safely.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
    <tr>
      <td><code>TC-SYNC-04</code></td>
      <td>Dead-Letter Queue (DLQ) Isolation</td>
      <td>Server returns permanent 422 for a corrupt mutation.</td>
      <td>Mutation isolated to DLQ table and archived in localStorage; unblocks subsequent mutations.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
    <tr>
      <td><code>TC-SYNC-05</code></td>
      <td>Compound (Date, Id) Keyset Restore</td>
      <td>Login to fresh device with 2,500 sales, some sharing timestamps.</td>
      <td>Pulls chunks with <code>limit=1000</code>, <code>before</code> and <code>beforeId</code>; zero dropped records at page edges.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-SYNC-06</code></td>
      <td>Local Product Edits Protection</td>
      <td>Edit product offline; background catalog pull occurs.</td>
      <td><code>pullCatalogFromServer</code> checks pending queue IDs; does not overwrite local un-synced edits.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
  </tbody>
</table>

<h3>Module 7: PWA Service Worker & Multi-Tab Coordinator</h3>
<table>
  <thead>
    <tr>
      <th style="width:12%">Test ID</th>
      <th style="width:20%">Feature</th>
      <th style="width:28%">Steps & Inputs</th>
      <th style="width:30%">Expected Result</th>
      <th style="width:10%">Severity</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>TC-PWA-01</code></td>
      <td>Offline Shell Pre-caching</td>
      <td>Install PWA; switch to airplane mode; reload page.</td>
      <td>Application loads fully from service worker cache; offline banner informs merchant.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
    <tr>
      <td><code>TC-PWA-02</code></td>
      <td>Active Cart Update Deferral</td>
      <td>Items in cart; trigger service worker update.</td>
      <td>Page reload deferred; prevents tearing down open checkout session or losing cart state.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-PWA-03</code></td>
      <td>Multi-Tab BroadcastChannel Lock</td>
      <td>Tab 1 has items in cart; Tab 2 receives SW update.</td>
      <td>Tab 1 broadcasts cart lock across BroadcastChannel; Tab 2 defers reload until Tab 1 clears cart.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-PWA-04</code></td>
      <td>Deferred Reload Activation</td>
      <td>Complete sale or clear cart after deferred update.</td>
      <td>500ms debounce timer elapses; page reloads cleanly and activates updated service worker.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
  </tbody>
</table>

<h3>Module 8: Subscription Management & PayMongo QR Ph</h3>
<table>
  <thead>
    <tr>
      <th style="width:12%">Test ID</th>
      <th style="width:20%">Feature</th>
      <th style="width:28%">Steps & Inputs</th>
      <th style="width:30%">Expected Result</th>
      <th style="width:10%">Severity</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>TC-SUB-01</code></td>
      <td>QR Ph Intent Generation</td>
      <td>Select Tindahan Pro plan (₱199/month); click Pay via QR Ph.</td>
      <td>Generates live PayMongo QR Ph payment code; displays 15-minute countdown polling modal.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
    <tr>
      <td><code>TC-SUB-02</code></td>
      <td>Real-Time Payment Confirmation</td>
      <td>Simulate payment success webhook / intent payment.</td>
      <td>Polling confirms payment; updates store tier to Tindahan Pro; quota limits lift immediately.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
    <tr>
      <td><code>TC-SUB-03</code></td>
      <td>Expired Subscription Downgrade</td>
      <td>Advance system clock past Pro subscription end date.</td>
      <td>Server and client downgrade tier to Libre; existing products/debts preserved in read-only state.</td>
      <td><span class="badge badge-critical">Critical</span></td>
    </tr>
  </tbody>
</table>

<h3>Module 9: Hardware, ESC/POS Printing & Accessibility</h3>
<table>
  <thead>
    <tr>
      <th style="width:12%">Test ID</th>
      <th style="width:20%">Feature</th>
      <th style="width:28%">Steps & Inputs</th>
      <th style="width:30%">Expected Result</th>
      <th style="width:10%">Severity</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>TC-HW-01</code></td>
      <td>ESC/POS 58mm Thermal Print</td>
      <td>Select 58mm printer format; trigger test print.</td>
      <td>Formats 32-character receipts with clean column alignment; prints via system driver.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
    <tr>
      <td><code>TC-HW-02</code></td>
      <td>ESC/POS 80mm Wide Print</td>
      <td>Select 80mm printer format; print customer receipt.</td>
      <td>Formats 48-character receipts with dual-column item breakdown and store footer.</td>
      <td><span class="badge badge-medium">Medium</span></td>
    </tr>
    <tr>
      <td><code>TC-HW-03</code></td>
      <td>Mobile 375px Responsive Viewport</td>
      <td>Test on 375px mobile viewport across all tabs.</td>
      <td>Bottom navigation dock fixed; touch targets &ge; 48px; no horizontal clipping.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
    <tr>
      <td><code>TC-HW-04</code></td>
      <td>Bilingual i18n Switching</td>
      <td>Toggle language switcher between English and Tagalog.</td>
      <td>All labels, modal headers, watermarks, and toast messages update instantly without refresh.</td>
      <td><span class="badge badge-high">High</span></td>
    </tr>
  </tbody>
</table>

<h2>3. Test Automation & Execution Playbook</h2>

<h3>Frontend Automated Suites (Vitest)</h3>
<pre><code>cd frontend
# Run complete Vitest suite
npm test -- --run

# Run code coverage report
npm test -- --coverage

# Run linter and typecheck
npm run lint
npm run build</code></pre>

<h3>Backend Automated Suites (xUnit)</h3>
<pre><code>cd backend
# Execute all xUnit tests
dotnet test --no-restore</code></pre>

<h2>4. QA Sign-Off & Release Gate Criteria</h2>
<p>Production release readiness requires satisfying all mandatory quality gates prior to deployment:</p>
<table>
  <thead>
    <tr>
      <th style="width:35%">Release Gate Criterion</th>
      <th style="width:35%">Required Acceptance Threshold</th>
      <th style="width:30%">Gate Level</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Backend xUnit Unit & Domain Suites</td>
      <td>100% Pass Rate (0 failures / 0 regressions)</td>
      <td><span class="badge badge-pass">Mandatory Gate</span></td>
    </tr>
    <tr>
      <td>Frontend Vitest Suites & State Stores</td>
      <td>100% Pass Rate across all component & store specs</td>
      <td><span class="badge badge-pass">Mandatory Gate</span></td>
    </tr>
    <tr>
      <td>TypeScript Compilation & Linter</td>
      <td>0 Errors (<code>tsc -b</code> & <code>oxlint</code>)</td>
      <td><span class="badge badge-pass">Mandatory Gate</span></td>
    </tr>
    <tr>
      <td>Production Vite Bundle Build</td>
      <td>Clean asset build with complete PWA precache manifest</td>
      <td><span class="badge badge-pass">Mandatory Gate</span></td>
    </tr>
    <tr>
      <td>Compound Keyset Restore</td>
      <td>Zero dropped transactions across pagination boundaries</td>
      <td><span class="badge badge-pass">Mandatory Gate</span></td>
    </tr>
    <tr>
      <td>Multi-Tab Service Worker Protection</td>
      <td>Active cart or in-progress sale blocks SW reload</td>
      <td><span class="badge badge-pass">Mandatory Gate</span></td>
    </tr>
  </tbody>
</table>

<div style="margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #555;">
  <div><strong>Specification Scope:</strong> Functional QA & Reliability Engineering</div>
  <div><strong>Gate Policy:</strong> 100% pass rate required for production release</div>
  <div><strong>Document Version:</strong> 2.1.0</div>
</div>

</body>
</html>
"""

repo_root = Path(__file__).resolve().parent.parent
temp_html_path = str(repo_root / "temp_test_plan.html")
output_pdf_path = str(repo_root / "docs" / "Fluent_Tindahan_Functional_Test_Plan.pdf")

with open(temp_html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
cmd = [
    edge_path,
    "--headless",
    "--disable-gpu",
    "--run-all-compositor-stages-before-draw",
    f"--print-to-pdf={output_pdf_path}",
    Path(temp_html_path).as_uri()
]

print("Rendering PDF with Microsoft Edge...")
Path(output_pdf_path).unlink(missing_ok=True)
with TemporaryDirectory(prefix="fluent-tindahan-pdf-") as edge_profile:
    result = subprocess.run([cmd[0], f"--user-data-dir={edge_profile}", *cmd[1:]], capture_output=True, text=True)
if not Path(output_pdf_path).exists():
    print("Edge did not produce a PDF; retrying with Google Chrome...")
    with TemporaryDirectory(prefix="fluent-tindahan-pdf-") as chrome_profile:
        result = subprocess.run([r"C:\Program Files\Google\Chrome\Application\chrome.exe", f"--user-data-dir={chrome_profile}", *cmd[1:]], capture_output=True, text=True)
print("Return code:", result.returncode)
if os.path.exists(output_pdf_path):
    print("PDF generated successfully! Size:", os.path.getsize(output_pdf_path), "bytes")
else:
    print("PDF generation failed.")
    print("Stderr:", result.stderr)

if os.path.exists(temp_html_path):
    os.remove(temp_html_path)
