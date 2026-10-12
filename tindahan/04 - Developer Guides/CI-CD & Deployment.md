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
    Client["Store devices / browsers"] --> Nginx["nginx :80\nPWA static + /api proxy"]
    Nginx --> API[".NET 8 Web API :8080"]
    API --> PG[("PostgreSQL 16\nDocker volume")]
```

### Deploy target
| | |
| --- | --- |
| Public URL | `https://tindahan-dev.novastack-inc.online` |
| Unique host port | **8089** (shared SAS also uses 8086, 8087, 8088, 8090) |
| SAS host | `8.220.128.80` |

```bash
cp deploy/alibaba-sas.env.example deploy/alibaba-sas.env
# set POSTGRES_PASSWORD + PayMongo secrets

./deploy-alibaba-sas.sh --bootstrap   # first time
./deploy-alibaba-sas.sh               # ship updates
```

PowerShell: `./deploy-alibaba-sas.ps1` (`-Bootstrap` on first run).

| Piece | Role |
| --- | --- |
| `docker-compose.yml` | `db` + `api` + `web` stack used on SAS (`HOST_HTTP_PORT=8089`) |
| `deploy/nginx/default.conf` | App-container SPA fallback + `/api` reverse proxy |
| `deploy/nginx/host-vhost.conf.template` | Edge nginx: hostname → `127.0.0.1:8089` |
| `deploy/install-host-vhost.sh` | Installs vhost + optional certbot TLS |
| `deploy/alibaba-sas.env` | SSH target + production secrets (gitignored) |
| `deploy/remote-bootstrap.sh` | Idempotent Docker install on Ubuntu/Debian SAS |

Open TCP **8089**, **80**, and **443** in the SAS Firewall console. Health probe: `GET /api/health`.
### Local Docker parity
```bash
./run-local.sh --docker
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
