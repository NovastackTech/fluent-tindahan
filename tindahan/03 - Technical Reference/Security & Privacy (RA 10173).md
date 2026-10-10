---
title: Security & Privacy (RA 10173)
tags: [security, privacy, dpa, ra10173, multi-tenant, compliance]
updated: 2026-10-10
---

# 🔒 Security & Privacy (RA 10173 Compliance)

Fluent Tindahan adheres to the **Republic Act No. 10173**, known as the **Data Privacy Act of 2012 (DPA)** of the Philippines, as regulated by the **National Privacy Commission (NPC)**.

Even informal neighborhood retailers process Personally Identifiable Information (PII)—specifically customer names, mobile numbers, and credit histories.

---

## 1. Data Privacy Consent Dialog (`PrivacyConsentDialog.tsx`)

On first boot of the application, the store operator is presented with a privacy consent agreement:
- Informs the user what data is stored locally (Dexie) and synchronized to the cloud.
- Clarifies that customer contact numbers and debt histories are collected solely for store accounting, debt reminders, and transaction receipts.
- Prohibits third-party advertising or sharing of customer financial records.
- Stored as a consent flag in browser storage.

---

## 2. Customer PII & Debt Stigmatization Protection

In small Philippine communities, exposing an individual's debt (*"utang"*) publicly causes serious social embarrassment and conflicts with NPC guidelines on sensitive personal data.

### Protective Features:
1. **Discreet POS Screen**: Outstanding balances are not shouted or displayed across the primary customer-facing view unless deliberately opened in the Utang ledger drawer.
2. **Encrypted Transmission**: All data syncing to `/api/sync/batch` travels strictly over TLS 1.3 (HTTPS).
3. **Data Minimization**: Only essential customer fields (`name`, `phone`) are stored. No national IDs, birthdays, or biometric information are ever collected.

---

## 3. Multi-Tenant Isolation (Server Security)

To guarantee that Store A can never access Store B's product pricing, sales volume, or customer debt:
- **Global Query Filters**: Every EF Core query automatically appends a `WHERE tenant_id = @CurrentTenantId` filter:
```csharp
modelBuilder.Entity<Customer>()
    .HasQueryFilter(c => c.TenantId == _currentUserService.TenantId);
```
- **JWT Claims Validation**: Authentication tokens issued by Firebase Auth are decoded by the API pipeline; the user's `TenantId` is resolved internally and cannot be spoofed via client request parameters.

---

## Related Notes
- [[Utang Ledger]] — Customer credit data management.
- [[Backend Web API]] — Authentication and controller security.
- [[System Architecture]] — Multi-tenant database boundary.
