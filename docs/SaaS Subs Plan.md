# Antigravity Implementation Plan: SaaS Subscription & Payment Gateway

**Context for AI Agent:**
Implement a pre-paid subscription pass system with Libre and Tindahan Pro (₱129 per 30 days) for a multi-tenant offline-first PWA. The backend is a .NET 8 Web API utilizing Clean Architecture, MediatR, and EF Core with PostgreSQL[cite: 1]. The frontend uses React (Vite), Fluent UI v9, Dexie.js, Zustand, and TanStack Query[cite: 1].

Execute the following phases sequentially.

## Phase 1: Core Domain & EF Core Updates
1. **Define Plan Enums:** Use `Libre = 0` and `TindahanPro = 1` for purchases. Preserve legacy stored enum values for database compatibility.
2. **Update Tenant Entity:** Modify the `Tenant` entity in the Domain layer to include:
   * `PlanTier Tier` (Default: `PlanTier.Libre`)
   * `DateTimeOffset? SubscriptionEndDate`
   * `string? ExternalCustomerId`
3. **Create PaymentHistory Entity:** Add a new append-only entity tracking `Id`, `TenantId`, `Amount`, `Currency`, `TierPurchased`, `GatewayReferenceId`, and `CreatedAt`.
4. **EF Core Migrations:** Update the `AppDbContext` in the Infrastructure layer, configure entity relationships using Fluent API, and generate a new PostgreSQL migration[cite: 1].

## Phase 2: Payment Gateway Integration (Infrastructure)
1. **Gateway Interface:** In the Application layer, define `IPaymentGatewayService` with a method `Task<string> CreateCheckoutSessionAsync(Guid tenantId, PlanTier tier, decimal amount)`.
2. **Gateway Implementation:** Implement this interface in the Infrastructure layer using the PayMongo (or Xendit) REST API. 
3. **Metadata Handling:** Ensure the `tenantId` and `tier` are securely attached to the gateway payload's `metadata` or `reference_id` fields for later webhook retrieval.

## Phase 3: Checkout API & MediatR Pipeline (Application/Web API)
1. **Checkout Command:** Create a MediatR command `CreateCheckoutSessionCommand(PlanTier TargetTier)`[cite: 1].
2. **Command Handler:** Implement the handler to validate the request, calculate the correct price, invoke `IPaymentGatewayService`, and return the checkout URL.
3. **API Controller:** Add `POST /api/billing/checkout` in the Web API Presentation layer to receive the client request, extract the `TenantId` via the Firebase authentication claims[cite: 1], and dispatch the command.

## Phase 4: Webhook Processor (The Source of Truth)
1. **Webhook Controller:** Create `POST /api/webhooks/billing/paymongo`. Implement header signature validation to secure the endpoint.
2. **Webhook Command:** Create `ProcessPaymentWebhookCommand(string JsonPayload)`[cite: 1].
3. **Handler Logic:** 
   * Parse the JSON and verify the `payment.paid` event type.
   * Extract `tenantId` and `tier` from the payload metadata.
   * Retrieve the `Tenant` from PostgreSQL[cite: 1].
   * Require the canonical payment ID, PHP currency, subscription metadata, and verified PayMongo `paid_at` timestamp.
   * Set expiry to `max(SubscriptionEndDate, paid_at) + 30 days` and deduplicate by payment ID.
   * Update `Tenant.Tier` and insert a new `PaymentHistory` record.
   * Call `await dbContext.SaveChangesAsync()`.

## Phase 5: Automated Background Downgrades
1. **Hosted Service:** Create `SubscriptionMonitorService` inheriting from `BackgroundService` in the Web API project.
2. **Execution Loop:** Implement a `while (!stoppingToken.IsCancellationRequested)` loop that runs every 1 hour (`Task.Delay`).
3. **Downgrade Logic:** Query `Tenants` where `Tier != PlanTier.Libre` AND `SubscriptionEndDate < DateTimeOffset.UtcNow`. Update their `Tier` to `PlanTier.Libre` and save changes to PostgreSQL.

## Phase 6: PWA Frontend State & Sync (React)
1. **Update Local Schema:** Add `tier` and `subscriptionEndDate` fields to the `Tenant` table definition in Dexie.js[cite: 1].
2. **State Management:** Update the Zustand session store (`useAuthStore`)[cite: 1] to hold the current tier state.
3. **Polling Mechanism:** Use TanStack Query[cite: 1] to poll a new `GET /api/tenant/profile` endpoint every 5 minutes while the app is active, updating Zustand and Dexie when the backend reports a tier upgrade.
4. **Backend Enforcement:** Update existing MediatR batch sync handlers[cite: 1] to validate the effective tenant tier. Libre blocks new or restored products at 30 while keeping existing products usable and editable.

## Phase 7: Fluent UI v9 Integration
1. **Paywall UI:** Build a pricing modal using Fluent UI v9 `Dialog`, `Card`, and typography tokens[cite: 1] displaying Libre and Tindahan Pro.
2. **Checkout Integration:** Wire the upgrade buttons to call `POST /api/billing/checkout` and redirect the `window.location.href` to the returned gateway URL.
3. **Feature Gating:** Wrap premium features such as CSV import[cite: 1] in a conditional check against the effective Zustand tier. Render a Fluent `MessageBar` or `Badge` to inform users of offline sync restrictions or expired states[cite: 1].

## Phase 8: CI/CD & Deployment Prep
1. **Environment Variables:** Map the new Payment Gateway API keys and Webhook Secret keys to the configuration settings.
2. **Pipeline Configuration:** Ensure the Azure DevOps pipeline[cite: 1] injects these secrets during the deployment to the .NET 8 App Service.
