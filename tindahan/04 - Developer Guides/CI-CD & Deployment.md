---
title: CI-CD & Deployment
tags: [guide, cicd, github-actions, deployment, docker, alibaba, sas]
updated: 2026-10-12
---

# 🚀 CI-CD & Deployment

This document covers continuous integration pipelines, automated quality gates, and target production deployment architectures (including Alibaba Cloud Simple Application Server).

---

## 1. Continuous Integration (`ci.yml`)

Every push and pull request to `main` and `pwa` triggers the GitHub Actions CI pipeline:

```mermaid
graph LR
    Push["Push / Pull Request"] --> CI{"GitHub Actions CI"}
    
    CI --> JobFront["Job: Frontend\nNode 20"]
    CI --> JobBack["Job: Backend\n.NET 8 SDK"]
    
    JobFront --> Step1["npm ci"]
    Step1 --> Step2["npm run lint"]
    Step2 --> Step3["npm test (Vitest)"]
    Step3 --> Step4["npm run build"]
    
    JobBack --> StepB1["dotnet test --configuration Release"]
    
    Step4 --> Pass["✅ Build Passed"]
    StepB1 --> Pass
```

### Pipeline Jobs:
1. **Frontend Job**:
   - Ubuntu runner with Node.js 20.
   - Dependency verification (`npm ci`).
   - Linting check (`npm run lint`).
   - Unit test execution (`npm test`).
   - Production Vite PWA build (`npm run build`).
2. **Backend Job**:
   - Ubuntu runner with .NET 8.0.x SDK.
   - Runs unit tests in Release mode (`dotnet test`).

---

## 2. Alibaba Cloud Simple Application Server (SAS) — Novastack Standard

Primary production path for Novastack apps: one SAS instance running Docker Compose.

```mermaid
graph TB
    Client["Store devices / browsers"] --> Caddy["Shared Novastack Caddy :443\n(lyingin-pis-caddy-1, auto TLS)"]
    Caddy -->|"novastack-edge network"| Nginx["fluent-tindahan-web :80\nPWA static + /api proxy"]
    Nginx --> API[".NET 8 Web API :8080"]
    API --> PG[("PostgreSQL 16\nDocker volume")]
```

### Deploy target
| | |
| --- | --- |
| Public URL | `https://tindahan-dev.novastack-inc.online` |
| SAS host | `8.220.128.80`, install dir `/opt/fluent-tindahan` |
| Host port | `127.0.0.1:8089` (other apps: 8085–8088, 8090, 8095, 8096, 43123) |

```powershell
# first deploy only: PayMongo keys pushed into the server .env
copy deploy\alibaba-sas\secrets.env.example deploy\alibaba-sas\secrets.env

.\deploy-alibaba-sas.cmd                      # first time on this server: add -ModifyDockerCaddy
```

| Piece | Role |
| --- | --- |
| `deploy-alibaba-sas.cmd` | One-step launcher (root password once) |
| `deploy/alibaba-sas/Deploy-NovastackSas.ps1` | Packages the repo and streams it over a single SSH session |
| `deploy/alibaba-sas/install.sh` | Generates/updates the server `.env`, runs `deploy.sh`, adds the domain to Caddy |
| `deploy/alibaba-sas/deploy.sh` | Secret checks, `pg_dump` snapshot, build, `up -d`, health wait |
| `deploy/alibaba-sas/docker-compose.sas.yml` | SAS overlay: container names, memory limits, `novastack-edge` network |
| `deploy/nginx/default.conf` | App-container SPA fallback + `/api` reverse proxy |

Open TCP **80** and **443** in the SAS Firewall console. Health probe: `GET /api/health`. Full runbook (DNS, options, restore): `deploy/alibaba-sas/README.md`.

### Database Backups (pg_dump)
Every deploy writes `/opt/fluent-tindahan/backups/db_YYYYMMDD_HHMMSS.sql.gz` before rebuilding and aborts if the snapshot fails (`-NoBackup` skips it). Restore steps are in `deploy/alibaba-sas/README.md`.

### Local Docker parity
```powershell
.\run-local.cmd -Docker      # or ./run-local.sh --docker
# PWA http://localhost:8080  ·  API http://localhost:5000  ·  Postgres :5432
```

---

## 3. Alternate Hosting Architecture (CDN + managed DB)

```mermaid
graph TB
    subgraph CDN ["Static Edge / CDN (Cloudflare / Vercel / Azure Static Web Apps)"]
        Edge["PWA Assets (HTML, JS, CSS, Web App Manifest, Service Worker)"]
    end

    subgraph Compute ["Container App / App Service (Azure / AWS ECS)"]
        API[".NET 8 Web API Container (Linux)"]
    end

    subgraph Data ["Managed Database"]
        RDS[("PostgreSQL 16 Managed Instance\n(Azure Flexible Server / AWS RDS)")]
    end

    Client["Customer Devices"] --> Edge
    Client --> API
    API --> RDS
```

### Hosting Strategy:
- **PWA Frontend**: Hosted as static assets on a global CDN when you outgrow single-node SAS.
- **Backend Web API**: Packaged as a lightweight Linux container (`mcr.microsoft.com/dotnet/aspnet:8.0`).
- **PostgreSQL**: Managed PostgreSQL 16 with daily automated backups.

---

## Related Notes
- [[Getting Started & Local Setup]] — Local development environment.
- [[Testing & QA Workflow]] — Running the local test suites.
- [[System Architecture]] — System component overview.
