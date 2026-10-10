---
title: Getting Started & Local Setup
tags: [guide, setup, onboarding, developer, local]
updated: 2026-10-10
---

# 🛠️ Getting Started & Local Setup

This guide walks through configuring and running the complete Fluent Tindahan stack locally on Windows, macOS, or Linux.

---

## 1. Prerequisites

Ensure the following runtimes and tools are installed:
- **Node.js**: v18.18+ or v20+ (LTS)
- **.NET SDK**: .NET 8.0 SDK (LTS)
- **PostgreSQL**: Version 15 or 16 running on `localhost:5432` with database `fluent_tindahan`
- **Git**: Configured for repository cloning and commit management

---

## 2. One-Click Startup (Windows)

From the root directory, run:
```powershell
./start-local.ps1
```
or double-click `start-local.bat`.

The script:
1. Verifies if the backend is already alive on port 5000 (if not, launches it in a background PowerShell window).
2. Verifies if the frontend is already running on port 5173 (if not, launches Vite dev server).
3. Opens the default browser to `http://localhost:5173`.

---

## 3. Manual Component Startup

### A. Backend Web API (.NET 8)
```powershell
cd backend/src/FluentTindahan.WebApi
$env:ASPNETCORE_ENVIRONMENT="Development"
dotnet run --urls "http://localhost:5000"
```
- API Base URL: `http://localhost:5000`
- Swagger UI: `http://localhost:5000/swagger`
- Health Check: `http://localhost:5000/api/health`

### B. Frontend PWA (React + Vite)
```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```
- Local URL: `http://localhost:5173`

---

## 4. Testing PWA Offline & Service Worker

In development mode (`npm run dev`), the service worker is disabled by default to avoid aggressive caching during UI development.

To test offline mode, caching, and install prompts:
```powershell
cd frontend
npm run build
npm run preview
```
- Preview URL: `http://localhost:4173`
- Open Chrome / Edge DevTools (`F12`) -> **Application** -> **Service Workers**.
- Check the **Offline** checkbox to verify that the app continues to operate, add products to cart, and queue sync operations without a network connection.

---

## Related Notes
- [[Testing & QA Workflow]] — Running automated unit and integration tests.
- [[CI-CD & Deployment]] — Production build and cloud hosting guide.
- [[System Architecture]] — System topology reference.
