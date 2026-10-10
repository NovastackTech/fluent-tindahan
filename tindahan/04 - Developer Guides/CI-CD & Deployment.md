---
title: CI-CD & Deployment
tags: [guide, cicd, github-actions, deployment, docker, azure]
updated: 2026-10-10
---

# 🚀 CI-CD & Deployment

This document covers continuous integration pipelines, automated quality gates, and target production deployment architectures.

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

## 2. Production Hosting Architecture

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
- **PWA Frontend**: Hosted as static assets on a global CDN (e.g., Cloudflare Pages or Vercel). High availability and instant delivery across the Philippines via edge PoPs (Manila / Cebu).
- **Backend Web API**: Packaged as a lightweight Linux container (`mcr.microsoft.com/dotnet/aspnet:8.0`) deployed to Azure Container Apps or AWS App Runner.
- **PostgreSQL**: Managed PostgreSQL 16 with daily automated backups.

---

## Related Notes
- [[Getting Started & Local Setup]] — Local development environment.
- [[Testing & QA Workflow]] — Running the local test suites.
- [[System Architecture]] — System component overview.
