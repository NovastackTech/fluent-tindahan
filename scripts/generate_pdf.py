import subprocess
import os

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Fluent Tindahan — Subscription Management, DB Schema & Billing Support Runbook</title>
<style>
  @page {
    size: A4;
    margin: 18mm 16mm 18mm 16mm;
    @bottom-right {
      content: counter(page);
    }
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1a1a1a;
    line-height: 1.5;
    font-size: 13px;
    margin: 0;
    padding: 0;
  }
  h1 {
    font-size: 22px;
    color: #0e7041;
    border-bottom: 2px solid #0e7041;
    padding-bottom: 8px;
    margin-top: 0;
    margin-bottom: 12px;
  }
  h2 {
    font-size: 16px;
    color: #1b5e20;
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 4px;
    margin-top: 20px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }
  h3 {
    font-size: 14px;
    color: #2e7d32;
    margin-top: 14px;
    margin-bottom: 6px;
    page-break-after: avoid;
  }
  h4 {
    font-size: 13px;
    color: #333;
    margin-top: 10px;
    margin-bottom: 4px;
    page-break-after: avoid;
  }
  p, li {
    font-size: 12.5px;
    color: #2c3e50;
  }
  ul {
    margin-top: 4px;
    margin-bottom: 8px;
    padding-left: 20px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 14px 0;
    font-size: 11.5px;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #dcdcdc;
    padding: 5px 8px;
    text-align: left;
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
    font-size: 11.5px;
    background-color: #f3f4f6;
    padding: 1px 4px;
    border-radius: 3px;
    color: #b91c1c;
  }
  pre {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 3px solid #0e7041;
    padding: 8px 12px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 11px;
    line-height: 1.4;
    page-break-inside: avoid;
  }
  pre code {
    background: none;
    color: #1e293b;
    padding: 0;
  }
  .badge {
    display: inline-block;
    padding: 2px 6px;
    font-size: 10px;
    font-weight: bold;
    border-radius: 3px;
    background-color: #e8f5e9;
    color: #2e7d32;
  }
  .case-box {
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 10px 12px;
    margin: 8px 0 12px 0;
    background-color: #f8fafc;
    page-break-inside: avoid;
  }
  .case-title {
    font-weight: bold;
    color: #0f172a;
    margin-bottom: 4px;
  }
</style>
</head>
<body>

<h1>Fluent Tindahan 🛒🇵🇭 — Database Schema & Billing Support Runbook</h1>
<p><em>Reference manual for database schemas, multi-tenant subscription tiers, PayMongo webhooks, and customer billing support resolution.</em></p>

<h2>1. System Overview & Dual-Database Architecture</h2>
<p>Fluent Tindahan operates on an <strong>offline-first dual-database architecture</strong>:</p>
<ul>
  <li><strong>Server-Side PostgreSQL 16 (Source of Truth)</strong>: Managed via .NET 8 EF Core (<code>AppDbContext</code>). Enforces tenant isolation (<code>TenantId</code>), financial precision (<code>numeric(12,2)</code> and integer centavos), and append-only audit ledgers.</li>
  <li><strong>Client-Side IndexedDB (Local Till Cache)</strong>: Managed via Dexie.js 4 (<code>db.ts</code>). Enables zero-latency POS, inventory, and utang operations offline with an outbox mutation queue (<code>syncQueue</code>).</li>
</ul>

<h2>2. Complete Database Schema Reference</h2>

<h3>2.1 Server-Side PostgreSQL Schema (EF Core 8)</h3>

<h4>1. Tenants Table</h4>
<p>The root security and multi-tenant boundary for each sari-sari store.</p>
<table>
  <tr><th>Column</th><th>Type</th><th>Null</th><th>Default / Constraints</th><th>Description</th></tr>
  <tr><td><code>Id</code></td><td>uuid</td><td>No</td><td>gen_random_uuid() [PK]</td><td>Tenant UUID identifier</td></tr>
  <tr><td><code>BusinessName</code></td><td>varchar(200)</td><td>No</td><td>—</td><td>Store name (e.g. Aling Nena's Store)</td></tr>
  <tr><td><code>Tier</code></td><td>integer</td><td>No</td><td>0</td><td>0 = Libre, 1 = TindahanPro, 2 = NegosyoPlus</td></tr>
  <tr><td><code>SubscriptionEndDate</code></td><td>timestamptz</td><td>Yes</td><td>NULL</td><td>Expiration timestamp of active plan</td></tr>
  <tr><td><code>ExternalCustomerId</code></td><td>varchar(128)</td><td>Yes</td><td>NULL</td><td>Optional external customer gateway reference</td></tr>
  <tr><td><code>CreatedAt</code></td><td>timestamptz</td><td>No</td><td>now()</td><td>Tenant creation timestamp</td></tr>
  <tr><td><code>xmin</code></td><td>xid</td><td>No</td><td>System</td><td>PostgreSQL row concurrency token</td></tr>
</table>

<h4>2. Users Table</h4>
<p>Store owners and staff/tindera accounts scoped to a tenant.</p>
<table>
  <tr><th>Column</th><th>Type</th><th>Null</th><th>Default / Constraints</th><th>Description</th></tr>
  <tr><td><code>Id</code></td><td>uuid</td><td>No</td><td>gen_random_uuid() [PK]</td><td>User UUID identifier</td></tr>
  <tr><td><code>TenantId</code></td><td>uuid</td><td>No</td><td>FK → Tenants.Id (CASCADE)</td><td>Multi-tenant isolation ID</td></tr>
  <tr><td><code>Phone</code></td><td>varchar(30)</td><td>No</td><td>—</td><td>User mobile phone login identifier</td></tr>
  <tr><td><code>Role</code></td><td>varchar(50)</td><td>No</td><td>'Owner'</td><td>'Owner' or 'Staff'</td></tr>
  <tr><td><code>FirebaseUid</code></td><td>varchar(128)</td><td>No</td><td>''</td><td>Firebase authentication UID</td></tr>
  <tr><td><code>CreatedAt</code></td><td>timestamptz</td><td>No</td><td>now()</td><td>Creation timestamp</td></tr>
</table>

<h4>3. Products Table</h4>
<p>Inventory catalog items scoped by tenant.</p>
<table>
  <tr><th>Column</th><th>Type</th><th>Null</th><th>Default / Constraints</th><th>Description</th></tr>
  <tr><td><code>Id</code></td><td>uuid</td><td>No</td><td>gen_random_uuid() [PK]</td><td>Product UUID</td></tr>
  <tr><td><code>TenantId</code></td><td>uuid</td><td>No</td><td>FK → Tenants.Id (CASCADE)</td><td>Multi-tenant isolation ID</td></tr>
  <tr><td><code>Name</code></td><td>varchar(200)</td><td>No</td><td>—</td><td>Product name</td></tr>
  <tr><td><code>Price</code></td><td>numeric(12,2)</td><td>No</td><td>—</td><td>Retail selling price in PHP</td></tr>
  <tr><td><code>Cost</code></td><td>numeric(12,2)</td><td>No</td><td>—</td><td>Cost / capital price in PHP</td></tr>
  <tr><td><code>Barcode</code></td><td>varchar(100)</td><td>Yes</td><td>NULL</td><td>Barcode / EAN (indexed per tenant)</td></tr>
  <tr><td><code>Category</code></td><td>varchar(100)</td><td>Yes</td><td>NULL</td><td>Product category</td></tr>
  <tr><td><code>StockQty</code></td><td>integer</td><td>No</td><td>0</td><td>Current on-hand stock</td></tr>
  <tr><td><code>IsDeleted</code></td><td>boolean</td><td>No</td><td>false</td><td>Soft delete flag</td></tr>
  <tr><td><code>UpdatedAt</code></td><td>timestamptz</td><td>No</td><td>now()</td><td>Last modified timestamp</td></tr>
</table>

<h4>4. Customers Table</h4>
<p>Suki directory and running utang balances.</p>
<table>
  <tr><th>Column</th><th>Type</th><th>Null</th><th>Default / Constraints</th><th>Description</th></tr>
  <tr><td><code>Id</code></td><td>uuid</td><td>No</td><td>gen_random_uuid() [PK]</td><td>Customer UUID</td></tr>
  <tr><td><code>TenantId</code></td><td>uuid</td><td>No</td><td>FK → Tenants.Id (CASCADE)</td><td>Multi-tenant isolation ID</td></tr>
  <tr><td><code>Name</code></td><td>varchar(200)</td><td>No</td><td>—</td><td>Customer name</td></tr>
  <tr><td><code>Phone</code></td><td>varchar(30)</td><td>No</td><td>''</td><td>Customer phone number</td></tr>
  <tr><td><code>TotalUtangBalance</code></td><td>numeric(12,2)</td><td>No</td><td>0.00</td><td>Running unpaid balance in PHP</td></tr>
  <tr><td><code>IsDeleted</code></td><td>boolean</td><td>No</td><td>false</td><td>Soft delete flag</td></tr>
  <tr><td><code>UpdatedAt</code></td><td>timestamptz</td><td>No</td><td>now()</td><td>Last modified timestamp</td></tr>
</table>

<h4>5. Sales & SaleItems Tables (Append-Only)</h4>
<table>
  <tr><th>Table</th><th>Key Columns</th><th>Constraints & Relations</th><th>Description</th></tr>
  <tr>
    <td><code>Sales</code></td>
    <td>Id, TenantId, UserId, CustomerId, TotalAmount, PaymentMethod, CashReceived, ChangeGiven, Date</td>
    <td>FK → Tenants.Id (CASCADE), FK → Users.Id (CASCADE), FK → Customers.Id (SET NULL)</td>
    <td>POS transactions: 'Cash', 'GCash', 'Split', 'Utang'</td>
  </tr>
  <tr>
    <td><code>SaleItems</code></td>
    <td>Id, TenantId, SaleId, ProductId, Qty, UnitPrice, Subtotal</td>
    <td>FK → Sales.Id (CASCADE), FK → Products.Id (RESTRICT)</td>
    <td>Immutable transaction line items with captured price snapshot</td>
  </tr>
</table>

<h4>6. UtangLedgers Table (Append-Only)</h4>
<p>Double-entry credit ledger. Running debt = <code>Sum(Credit) - Sum(Payment)</code>.</p>
<table>
  <tr><th>Column</th><th>Type</th><th>Null</th><th>Constraints</th><th>Description</th></tr>
  <tr><td><code>Id</code></td><td>uuid</td><td>No</td><td>gen_random_uuid() [PK]</td><td>Ledger entry UUID</td></tr>
  <tr><td><code>TenantId</code></td><td>uuid</td><td>No</td><td>FK → Tenants.Id (CASCADE)</td><td>Multi-tenant isolation ID</td></tr>
  <tr><td><code>CustomerId</code></td><td>uuid</td><td>No</td><td>FK → Customers.Id (CASCADE)</td><td>Debtor customer ID</td></tr>
  <tr><td><code>Amount</code></td><td>numeric(12,2)</td><td>No</td><td>—</td><td>Positive amount</td></tr>
  <tr><td><code>Type</code></td><td>varchar(30)</td><td>No</td><td>—</td><td>'Credit' (utang) or 'Payment' (bayad)</td></tr>
  <tr><td><code>RefSaleId</code></td><td>uuid</td><td>Yes</td><td>FK → Sales.Id (SET NULL)</td><td>Associated POS sale ID if applicable</td></tr>
  <tr><td><code>Notes</code></td><td>varchar(500)</td><td>Yes</td><td>NULL</td><td>Remarks</td></tr>
  <tr><td><code>Date</code></td><td>timestamptz</td><td>No</td><td>now()</td><td>Transaction timestamp</td></tr>
</table>

<h4>7. GCashTransactions Table</h4>
<p>Neighborhood digital cash ledger with unique normalized reference numbers per tenant.</p>
<table>
  <tr><th>Column</th><th>Type</th><th>Null</th><th>Constraints</th><th>Description</th></tr>
  <tr><td><code>Id</code></td><td>uuid</td><td>No</td><td>gen_random_uuid() [PK]</td><td>Transaction UUID</td></tr>
  <tr><td><code>TenantId</code></td><td>uuid</td><td>No</td><td>FK → Tenants.Id (CASCADE)</td><td>Multi-tenant isolation ID</td></tr>
  <tr><td><code>Type</code></td><td>varchar(30)</td><td>No</td><td>—</td><td>'CashIn' or 'CashOut'</td></tr>
  <tr><td><code>Amount</code></td><td>numeric(12,2)</td><td>No</td><td>—</td><td>Principal amount</td></tr>
  <tr><td><code>Fee</code></td><td>numeric(12,2)</td><td>No</td><td>0.00</td><td>Store commission / service fee</td></tr>
  <tr><td><code>RefNo</code></td><td>varchar(100)</td><td>No</td><td>—</td><td>GCash reference number from SMS/App</td></tr>
  <tr><td><code>RefNoNorm</code></td><td>varchar(100)</td><td>No</td><td>Unique partial index per tenant</td><td>Trimmed lower-cased ref (prevents duplicates)</td></tr>
  <tr><td><code>CustomerPhone</code></td><td>varchar(30)</td><td>Yes</td><td>NULL</td><td>Recipient/Sender mobile number</td></tr>
  <tr><td><code>Notes</code></td><td>varchar(500)</td><td>Yes</td><td>NULL</td><td>Remarks</td></tr>
  <tr><td><code>Date</code></td><td>timestamptz</td><td>No</td><td>now()</td><td>Transaction timestamp</td></tr>
</table>

<h4>8. PaymentHistories Table (Append-Only)</h4>
<p>SaaS subscription payment audit trail with unique PayMongo reference constraints.</p>
<table>
  <tr><th>Column</th><th>Type</th><th>Null</th><th>Constraints</th><th>Description</th></tr>
  <tr><td><code>Id</code></td><td>uuid</td><td>No</td><td>gen_random_uuid() [PK]</td><td>Payment history row UUID</td></tr>
  <tr><td><code>TenantId</code></td><td>uuid</td><td>No</td><td>FK → Tenants.Id (CASCADE)</td><td>Multi-tenant isolation ID</td></tr>
  <tr><td><code>AmountCentavos</code></td><td>bigint</td><td>No</td><td>—</td><td>Amount in integer centavos (12900 = ₱129.00)</td></tr>
  <tr><td><code>Currency</code></td><td>varchar(10)</td><td>No</td><td>'PHP'</td><td>Currency identifier</td></tr>
  <tr><td><code>TierPurchased</code></td><td>integer</td><td>No</td><td>—</td><td>1 = TindahanPro, 2 = NegosyoPlus</td></tr>
  <tr><td><code>BillingCycle</code></td><td>integer</td><td>No</td><td>—</td><td>0 = Weekly, 1 = Monthly</td></tr>
  <tr><td><code>GatewayReferenceId</code></td><td>varchar(150)</td><td>No</td><td>UNIQUE</td><td>PayMongo payment ID (prevents double-credit)</td></tr>
  <tr><td><code>Status</code></td><td>varchar(50)</td><td>No</td><td>'Paid'</td><td>Status</td></tr>
  <tr><td><code>PaymentMethod</code></td><td>varchar(50)</td><td>No</td><td>'paymongo'</td><td>Gateway provider</td></tr>
  <tr><td><code>CreatedAt</code></td><td>timestamptz</td><td>No</td><td>now()</td><td>Webhook processing timestamp</td></tr>
</table>

<h3>2.2 Client-Side IndexedDB Schema (Dexie.js)</h3>
<table>
  <tr><th>Table</th><th>Primary Key</th><th>Indexed Keys</th><th>Description</th></tr>
  <tr><td><code>products</code></td><td>id</td><td>tenantId, name, barcode, category, updatedAt</td><td>Offline product catalog</td></tr>
  <tr><td><code>customers</code></td><td>id</td><td>tenantId, name, phone, totalUtangBalance, updatedAt</td><td>Offline customer list</td></tr>
  <tr><td><code>sales</code></td><td>id</td><td>tenantId, date, paymentMethod, customerId</td><td>Offline sales transactions</td></tr>
  <tr><td><code>saleItems</code></td><td>id</td><td>tenantId, saleId, productId</td><td>Sale items per sale</td></tr>
  <tr><td><code>utangLedger</code></td><td>id</td><td>tenantId, customerId, type, date, refSaleId</td><td>Local debt ledger</td></tr>
  <tr><td><code>gcashTxns</code></td><td>id</td><td>tenantId, type, date, refNo, refNoNorm, [tenantId+refNoNorm]</td><td>Local GCash entries</td></tr>
  <tr><td><code>syncQueue</code></td><td>id</td><td>entity, status, retryCount, timestamp</td><td>Pending mutations outbox</td></tr>
  <tr><td><code>deadLetterQueue</code></td><td>id</td><td>entity, failedAt</td><td>Poison mutations after retries</td></tr>
  <tr><td><code>tenants</code></td><td>id</td><td>tier, subscriptionEndDate, updatedAt</td><td>Cached store subscription state</td></tr>
</table>

<h2>3. Subscription Tiers & Pricing</h2>
<table>
  <tr><th>Tier</th><th>Monthly</th><th>Weekly</th><th>Key Entitlements & Features</th></tr>
  <tr>
    <td><strong>Libre</strong> (0)</td>
    <td>₱0.00</td>
    <td>—</td>
    <td>Up to 50 products, 30 debtors, 30 GCash txns/month, 1 device, watermarked receipts.</td>
  </tr>
  <tr>
    <td><strong>Tindahan Pro</strong> (1)</td>
    <td>₱129.00</td>
    <td>₱39.00</td>
    <td><strong>Unlimited</strong> products, debtors, and GCash logs; up to 2 devices; CSV bulk catalog import; unwatermarked receipts; profit & margin analytics.</td>
  </tr>
  <tr>
    <td><strong>Negosyo Plus</strong> (2)</td>
    <td>₱349.00</td>
    <td>₱89.00</td>
    <td>All Pro features + up to 5 staff accounts; Staff RBAC (hides profit margins from helpers); up to 4 synced devices; shift & audit trail logs.</td>
  </tr>
</table>

<h2>4. Support Runbook: Customer Paid but App Not Upgraded</h2>

<h3>Step 1: Obtain Customer Details</h3>
<p>Ask the customer for:</p>
<ol>
  <li>Store Business Name or registered mobile phone number.</li>
  <li>GCash / Maya / Card transaction reference number or screenshot.</li>
</ol>

<h3>Step 2: Check Tenant and Payment History in PostgreSQL</h3>
<pre><code>-- 1. Check current plan status
SELECT t.id AS "TenantId", t."BusinessName", t."Tier", t."SubscriptionEndDate", u."Phone"
FROM "Tenants" t
LEFT JOIN "Users" u ON u."TenantId" = t.id AND u."Role" = 'Owner'
WHERE t."BusinessName" ILIKE '%&lt;Store Name&gt;%' OR u."Phone" = '&lt;Phone&gt;';

-- 2. Check payment history records
SELECT id, "AmountCentavos"/100.0 AS "AmountPHP", "TierPurchased", "GatewayReferenceId", "CreatedAt"
FROM "PaymentHistories"
WHERE "TenantId" = '&lt;TENANT_UUID&gt;'
ORDER BY "CreatedAt" DESC;</code></pre>

<h3>Step 3: Diagnostic Decision Matrix</h3>

<div class="case-box">
  <div class="case-title">Case A: Database already shows Tier 1 (Pro) or Tier 2 (NegosyoPlus)</div>
  <p><strong>Root Cause:</strong> The payment and webhook completed normally. The customer's device was offline or running on stale IndexedDB cache.</p>
  <p><strong>Fix:</strong> Have the customer ensure mobile data / Wi-Fi is on, open the app's <strong>Subscription Modal</strong>, and tap <strong>Refresh</strong> (or reload the browser page). The app calls <code>GET /api/billing/subscription</code> and immediately unlocks their paid features.</p>
</div>

<div class="case-box">
  <div class="case-title">Case B: Database still shows Tier 0 (Libre)</div>
  <p><strong>Root Cause:</strong> Webhook did not deliver or was rejected (e.g. gateway timeout or webhook secret mismatch).</p>
  <p><strong>Action:</strong> Check the PayMongo dashboard to verify funds were received. Once confirmed, execute the manual upgrade query:</p>
<pre><code>-- Manually upgrade tenant tier and set 30-day expiration
UPDATE "Tenants"
SET "Tier" = 1, -- 1 = TindahanPro, 2 = NegosyoPlus
    "SubscriptionEndDate" = NOW() + INTERVAL '30 days'
WHERE id = '&lt;TENANT_UUID&gt;';

-- Log payment history record for audit
INSERT INTO "PaymentHistories" (
    "Id", "TenantId", "AmountCentavos", "Currency",
    "TierPurchased", "BillingCycle", "GatewayReferenceId",
    "Status", "PaymentMethod", "CreatedAt"
) VALUES (
    gen_random_uuid(),
    '&lt;TENANT_UUID&gt;',
    12900,               -- ₱129.00 in centavos
    'PHP',
    1,                   -- 1 = TindahanPro
    1,                   -- 1 = Monthly
    '&lt;PAYMONGO_REF_NO&gt;',
    'Paid',
    'paymongo',
    NOW()
);</code></pre>
  <p>Then instruct the customer to tap <strong>Refresh</strong> in their subscription dialog or reload the app.</p>
</div>

</body>
</html>
"""

temp_html_path = os.path.abspath("temp_runbook.html")
output_pdf_path = os.path.abspath("Subscription_and_Billing_Support_Runbook.pdf")

with open(temp_html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
cmd = [
    edge_path,
    "--headless",
    "--disable-gpu",
    "--run-all-compositor-stages-before-draw",
    f"--print-to-pdf={output_pdf_path}",
    temp_html_path
]

print("Rendering PDF with Microsoft Edge...")
result = subprocess.run(cmd, capture_output=True, text=True)
print("Return code:", result.returncode)
if os.path.exists(output_pdf_path):
    print("PDF generated successfully! Size:", os.path.getsize(output_pdf_path), "bytes")
else:
    print("PDF generation failed.")
    print("Stderr:", result.stderr)

if os.path.exists(temp_html_path):
    os.remove(temp_html_path)
