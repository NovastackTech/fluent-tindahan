---
title: "Feature: {{title}}"
tags: [spec, feature, domain]
status: draft # draft | review | approved | implemented
date: {{date}}
---

# 🚀 Feature Spec: {{title}}

## 1. Problem Statement & User Value
- **Target User**: Store Owner / Cashier / Suki Customer
- **Problem**: What pain point exists in the store or workflow?
- **Impact**: How does this save time, prevent loss, or improve the store's profit?

---

## 2. User Stories & Acceptance Criteria
- [ ] **Story 1**: As a [role], I want to [action] so that [benefit].
  - *Given* [context], *When* [event], *Then* [expected outcome].
- [ ] **Story 2**: As a [role], I want to [action] so that [benefit].

---

## 3. UI / UX Design & Components
- **Fluent UI v9 Components Needed**: 
- **Screen Location**: (e.g. `POSPage`, `SettingsPage`)
- **Key Interactions**:
- **Offline Considerations**: How does this behave if the device has zero internet?

---

## 4. Technical Implementation
- **Dexie Client Changes**: Table or index modifications in `db.ts`
- **State Store Changes**: Zustand store updates (`cartStore`, `pwaStore`, etc.)
- **SyncQueue Action**: Payload structure for offline batch sync
- **Backend API Changes**: MediatR command/query and PostgreSQL migrations

---

## 5. Test Scenarios
- [ ] Unit Test (Vitest / xUnit)
- [ ] Offline PWA Simulation
- [ ] Multi-tab BroadcastChannel verification
