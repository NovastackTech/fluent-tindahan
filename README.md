# Fluent Tindahan 🛒🇵🇭
### Offline-First Sari-Sari & GCash Management System

An offline-first Progressive Web App (PWA) built with **Fluent UI v9**, **Dexie.js (IndexedDB)**, and **.NET 8 Clean Architecture** with **PostgreSQL**. Tailored for Philippine sari-sari stores, neighborhood retailers, and GCash cash-in/cash-out agents with intermittent mobile data.

---

## 🚀 Quick Start (Local Setup)

### Option 1: One-Click Startup
Run either of the following scripts from the repository root:
```powershell
./start-local.ps1
```
or double-click `start-local.bat`.

### Option 2: Manual Startup

#### 1. Backend Web API (.NET 8 + PostgreSQL)
Make sure PostgreSQL 16 is running (Database: `fluent_tindahan`).
```powershell
cd backend/src/FluentTindahan.WebApi
$env:ASPNETCORE_ENVIRONMENT="Development"
dotnet run --urls "http://localhost:5000"
```
- API Base: `http://localhost:5000`
- Swagger Documentation: `http://localhost:5000/swagger`
- Health Check: `http://localhost:5000/api/health`

#### 2. Frontend PWA (React + Vite + Fluent UI v9)
```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```
- Web Application: `http://localhost:5173`

#### 3. Testing PWA Offline & Service Worker (`vite build && vite preview`)
By default, the Vite dev server disables the service worker (`devOptions.enabled = false`) to avoid caching issues on `localhost:5173` during active API and sync development.

To test full service worker caching, offline persistence, and install prompts:
```powershell
cd frontend
npm run build
npm run preview
```
- Preview URL: `http://localhost:4173`
- Open Chrome/Edge DevTools (`F12`) -> **Application** -> **Service Workers** to inspect cache storage and simulate offline mode.

*(Optional)* If you wish to test the service worker during dev mode:
```powershell
# PowerShell
$env:PWA_DEV="true"; npm run dev
# Linux / macOS
PWA_DEV=true npm run dev
```

---

## 📦 Features & Data

- **Offline-First POS**: Fast barcode search, categories, cart management, change calculator, thermal receipt generation.
- **Philippine Catalog Included**: Pre-populated with **138 authentic sari-sari store products** (Lucky Me! Pancit Canton, Canned Goods, Beverages, Tingi items, Rice, Sugar, Cigarettes) from `sari_sari_store_inventory_catalog.csv`.
- **Utang Ledger**: Track customer credit balances, log repayments, append-only ledger entries.
- **GCash Cash-In / Cash-Out**: Log fee tracking, transaction reference numbers, daily totals.
- **Background Sync Engine**: Queues offline mutations in IndexedDB `syncQueue` and batches them to the .NET 8 Web API via `POST /api/sync/batch` with Last-Write-Wins and Dead-Letter Queue handling.
- **Data Privacy Consent Dialog**: Compliant with RA 10173 (Philippine Data Privacy Act).
