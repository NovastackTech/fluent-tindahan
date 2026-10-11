using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using FluentTindahan.Application.Common;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Application.GCash;
using FluentTindahan.Application.Sync.DTOs;
using FluentTindahan.Domain.Billing;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Domain.Interfaces;

namespace FluentTindahan.Application.Sync.Commands;

public record ProcessBatchSyncCommand(BatchSyncRequestDto Request) : IRequest<BatchSyncResultDto>;

public class ProcessBatchSyncCommandHandler : IRequestHandler<ProcessBatchSyncCommand, BatchSyncResultDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly ILogger<ProcessBatchSyncCommandHandler> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public ProcessBatchSyncCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        ILogger<ProcessBatchSyncCommandHandler> logger)
    {
        _context = context;
        _currentUserService = currentUserService;
        _logger = logger;
    }

    public async Task<BatchSyncResultDto> Handle(ProcessBatchSyncCommand command, CancellationToken cancellationToken)
    {
        var tenantId = _currentUserService.TenantId;
        if (tenantId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Tenant is not authenticated or resolved.");
        }

        var operations = command.Request.Operations ?? new List<SyncOperationDto>();

        _logger.LogInformation("Processing batch sync for tenant {TenantId}, device {DeviceId}, operations count {Count}",
            tenantId, command.Request.DeviceId, operations.Count);

        var tenant = await _context.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var isExpired = tenant != null && tenant.Tier != PlanTier.Libre && tenant.SubscriptionEndDate.HasValue && tenant.SubscriptionEndDate.Value < now;
        var effectiveTier = isExpired ? PlanTier.Libre : (tenant?.Tier ?? PlanTier.Libre);
        var counters = new BatchSyncCounters();

        // Identify entity IDs that have a subsequent Insert/Update in the same batch
        var reinsertedIds = new HashSet<(string Entity, Guid Id)>();
        var seenDeletes = new HashSet<(string Entity, Guid Id)>();
        foreach (var op in operations)
        {
            var entity = op.Entity?.Trim().ToLowerInvariant() ?? "";
            var action = op.Action?.Trim().ToLowerInvariant() ?? "insert";
            if (TryExtractId(op.Payload, out var id) && id != Guid.Empty)
            {
                if (action == "delete")
                {
                    seenDeletes.Add((entity, id));
                }
                else if (seenDeletes.Contains((entity, id)))
                {
                    reinsertedIds.Add((entity, id));
                }
            }
        }

        // Stable dependency ordering: Customers, Products, Sales, UtangLedgers, GCash, Deletes last (unless reinserted)
        var orderedOperations = operations
            .Select((op, index) => (Op: op, OriginalIndex: index))
            .OrderBy(x => GetEntityPrecedence(x.Op, reinsertedIds))
            .ThenBy(x => x.OriginalIndex)
            .ToList();

        var resultsByIndex = new SyncItemResultDto[operations.Count];

        foreach (var item in orderedOperations)
        {
            var op = item.Op;
            var syncId = op.SyncId ?? "";
            try
            {
                var status = await ProcessOperationAsync(op, tenantId, effectiveTier, counters, cancellationToken);
                string? error = null;
                if (status == "DuplicateRef" || status == "Conflict")
                {
                    error = TryExtractRefNo(op.Payload, out var refStr) && !string.IsNullOrWhiteSpace(refStr)
                        ? $"Duplicate GCash reference number '{refStr.Trim()}' for this tenant."
                        : "Duplicate GCash reference number for this tenant.";
                }

                resultsByIndex[item.OriginalIndex] = new SyncItemResultDto
                {
                    SyncId = syncId,
                    Status = status,
                    Error = error
                };
            }
            catch (Exception ex)
            {
                // Clear any pending changes on the DbContext so failed entities don't poison subsequent batch operations
                foreach (var entry in _context.ChangeTracker.Entries().Where(e => e.State == EntityState.Added || e.State == EntityState.Modified || e.State == EntityState.Deleted).ToList())
                {
                    entry.State = EntityState.Detached;
                }

                if (ex is DuplicateGCashRefException dupEx)
                {
                    _logger.LogWarning(ex, "Duplicate GCash ref for sync operation {SyncId}", syncId);
                    resultsByIndex[item.OriginalIndex] = new SyncItemResultDto
                    {
                        SyncId = syncId,
                        Status = "DuplicateRef",
                        Error = dupEx.Message
                    };
                    continue;
                }

                var entityType = op.Entity?.Trim().ToLowerInvariant();
                if (entityType is "gcashtxn" or "gcash"
                    && ex is DbUpdateException dbEx
                    && RecordGCashTxnCommandHandler.IsUniqueIndexViolation(dbEx))
                {
                    _logger.LogWarning(ex, "Unique constraint violation on sync operation {SyncId}", syncId);
                    resultsByIndex[item.OriginalIndex] = new SyncItemResultDto
                    {
                        SyncId = syncId,
                        Status = "DuplicateRef",
                        Error = "Duplicate GCash reference number for this tenant."
                    };
                    continue;
                }

                if (entityType == "product" && TryExtractId(op.Payload, out var prodId))
                {
                    counters.RejectedProductIds.Add(prodId);
                }
                else if (entityType == "customer" && TryExtractId(op.Payload, out var custId))
                {
                    counters.RejectedCustomerIds.Add(custId);
                }

                _logger.LogWarning(ex, "Failed to process sync operation {SyncId} for entity {Entity}", syncId, op.Entity);
                resultsByIndex[item.OriginalIndex] = new SyncItemResultDto
                {
                    SyncId = syncId,
                    Status = "Failed",
                    Error = ex.Message
                };
            }
        }

        var results = resultsByIndex.ToList();

        return new BatchSyncResultDto
        {
            ProcessedCount = results.Count(r => r.Status == "Success" || r.Status == "ConflictIgnored"),
            ConflictCount = results.Count(r => r.Status == "DuplicateRef" || r.Status == "Conflict"),
            Results = results
        };
    }

    private class BatchSyncCounters
    {
        public int? ProductCount { get; set; }
        public int? CustomerCount { get; set; }
        public int? MonthlyGCashCount { get; set; }
        public HashSet<Guid> RejectedProductIds { get; } = new();
        public HashSet<Guid> RejectedCustomerIds { get; } = new();
    }

    private static int GetEntityPrecedence(SyncOperationDto op, HashSet<(string Entity, Guid Id)> reinsertedIds)
    {
        var entity = op.Entity?.Trim().ToLowerInvariant() ?? "";
        var action = op.Action?.Trim().ToLowerInvariant() ?? "insert";
        var basePrecedence = entity switch
        {
            "customer" => 1,
            "product" => 2,
            "sale" => 3,
            "utangledger" or "utang" => 4,
            "gcashtxn" or "gcash" => 5,
            _ => 6
        };

        if (action == "delete")
        {
            if (TryExtractId(op.Payload, out var id) && reinsertedIds.Contains((entity, id)))
            {
                return basePrecedence;
            }
            return 10;
        }

        return basePrecedence;
    }

    private static bool TryExtractId(JsonElement payload, out Guid id)
    {
        id = Guid.Empty;
        if (payload.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in payload.EnumerateObject())
            {
                if (string.Equals(prop.Name, "id", StringComparison.OrdinalIgnoreCase))
                {
                    if (prop.Value.ValueKind == JsonValueKind.String && Guid.TryParse(prop.Value.GetString(), out id))
                    {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private static bool TryExtractRefNo(JsonElement payload, out string? refNo)
    {
        refNo = null;
        if (payload.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in payload.EnumerateObject())
            {
                if (string.Equals(prop.Name, "refNo", StringComparison.OrdinalIgnoreCase))
                {
                    refNo = prop.Value.GetString();
                    return true;
                }
            }
        }
        return false;
    }

    private async Task<string> ProcessOperationAsync(SyncOperationDto op, Guid tenantId, PlanTier effectiveTier, BatchSyncCounters counters, CancellationToken cancellationToken)
    {
        var entityType = op.Entity?.Trim().ToLowerInvariant();
        var action = op.Action?.Trim().ToLowerInvariant() ?? "insert";

        return entityType switch
        {
            "product" => await HandleProductAsync(op, tenantId, effectiveTier, action, counters, cancellationToken),
            "customer" => await HandleCustomerAsync(op, tenantId, effectiveTier, action, counters, cancellationToken),
            "utangledger" or "utang" => await HandleUtangLedgerAsync(op, tenantId, action, counters, cancellationToken),
            "sale" => await HandleSaleAsync(op, tenantId, action, counters, cancellationToken),
            "gcashtxn" or "gcash" => await HandleGCashTxnAsync(op, tenantId, effectiveTier, action, counters, cancellationToken),
            _ => throw new NotSupportedException($"Entity type '{op.Entity}' is not supported for synchronization.")
        };
    }

    private async Task<string> HandleProductAsync(SyncOperationDto op, Guid tenantId, PlanTier effectiveTier, string action, BatchSyncCounters counters, CancellationToken cancellationToken)
    {
        var raw = JsonSerializer.Deserialize<ProductSyncPayload>(op.Payload.GetRawText(), JsonOptions)
            ?? throw new ArgumentException("Product payload is invalid.");

        if (raw.Id == Guid.Empty) raw.Id = Guid.NewGuid();

        var existing = await _context.Products.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == raw.Id && p.TenantId == tenantId, cancellationToken);

        if (action == "delete")
        {
            if (existing != null)
            {
                if (existing.UpdatedAt > op.Timestamp)
                {
                    _logger.LogInformation("LWW conflict ignored for Product delete {Id}: existing is newer ({Existing} > {Incoming})",
                        existing.Id, existing.UpdatedAt, op.Timestamp);
                    return "ConflictIgnored";
                }

                var wasDeleted = existing.IsDeleted;
                existing.IsDeleted = true;
                existing.UpdatedAt = op.Timestamp;
                await _context.SaveChangesAsync(cancellationToken);
                if (!wasDeleted && counters.ProductCount.HasValue && counters.ProductCount > 0)
                {
                    counters.ProductCount--;
                }
            }
            return "Success";
        }

        if (existing == null)
        {
            if (effectiveTier == PlanTier.Libre)
            {
                // Count once per batch to avoid N+1 queries during large sync batches, incrementing locally
                counters.ProductCount ??= await _context.Products.IgnoreQueryFilters()
                    .CountAsync(p => p.TenantId == tenantId && !p.IsDeleted, cancellationToken);

                if (counters.ProductCount >= TierLimits.LibreMaxProducts)
                {
                    throw new InvalidOperationException($"Libre plan limit exceeded: Maximum {TierLimits.LibreMaxProducts} products allowed. Upgrade to Tindahan Pro for unlimited catalog capacity.");
                }
            }

            var product = new Product
            {
                Id = raw.Id,
                TenantId = tenantId,
                Name = raw.Name ?? "Unnamed Product",
                Price = raw.Price,
                Cost = raw.Cost,
                Barcode = raw.Barcode,
                Category = raw.Category,
                StockQty = raw.StockQty,
                UpdatedAt = op.Timestamp,
                IsDeleted = false
            };
            _context.Products.Add(product);
            await _context.SaveChangesAsync(cancellationToken);
            if (counters.ProductCount.HasValue)
            {
                counters.ProductCount++;
            }
            return "Success";
        }

        // Last-Write-Wins (LWW)
        if (existing.UpdatedAt > op.Timestamp)
        {
            _logger.LogInformation("LWW conflict ignored for Product {Id}: existing is newer ({Existing} > {Incoming})",
                existing.Id, existing.UpdatedAt, op.Timestamp);
            return "ConflictIgnored";
        }

        var wasPreviouslyDeleted = existing.IsDeleted;
        if (wasPreviouslyDeleted)
        {
            if (effectiveTier == PlanTier.Libre)
            {
                counters.ProductCount ??= await _context.Products.IgnoreQueryFilters()
                    .CountAsync(p => p.TenantId == tenantId && !p.IsDeleted, cancellationToken);

                if (counters.ProductCount >= TierLimits.LibreMaxProducts)
                {
                    throw new InvalidOperationException($"Libre plan limit exceeded: Maximum {TierLimits.LibreMaxProducts} products allowed. Upgrade to Tindahan Pro for unlimited catalog capacity.");
                }
            }
        }

        // If existing product was previously an archived/deleted placeholder, restore it
        existing.IsDeleted = false;
        existing.Name = raw.Name ?? existing.Name;
        existing.Price = raw.Price;
        existing.Cost = raw.Cost;
        existing.Barcode = raw.Barcode ?? existing.Barcode;
        existing.Category = raw.Category ?? existing.Category;
        existing.StockQty = raw.StockQty;
        existing.UpdatedAt = op.Timestamp;

        await _context.SaveChangesAsync(cancellationToken);
        if (wasPreviouslyDeleted && counters.ProductCount.HasValue)
        {
            counters.ProductCount++;
        }
        return "Success";
    }

    private async Task<string> HandleCustomerAsync(SyncOperationDto op, Guid tenantId, PlanTier effectiveTier, string action, BatchSyncCounters counters, CancellationToken cancellationToken)
    {
        var raw = JsonSerializer.Deserialize<CustomerSyncPayload>(op.Payload.GetRawText(), JsonOptions)
            ?? throw new ArgumentException("Customer payload is invalid.");

        if (raw.Id == Guid.Empty) raw.Id = Guid.NewGuid();

        var existing = await _context.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == raw.Id && c.TenantId == tenantId, cancellationToken);

        if (action == "delete")
        {
            if (existing != null)
            {
                if (existing.UpdatedAt > op.Timestamp)
                {
                    _logger.LogInformation("LWW conflict ignored for Customer delete {Id}: existing is newer ({Existing} > {Incoming})",
                        existing.Id, existing.UpdatedAt, op.Timestamp);
                    return "ConflictIgnored";
                }

                if (existing.TotalUtangBalance != 0m)
                {
                    throw new InvalidOperationException($"Cannot delete customer '{existing.Name}' ({existing.Id}) with an outstanding utang balance of {existing.TotalUtangBalance:F2}. Outstanding balance must be settled first.");
                }

                var wasDeleted = existing.IsDeleted;
                existing.IsDeleted = true;
                existing.UpdatedAt = op.Timestamp;
                await _context.SaveChangesAsync(cancellationToken);
                if (!wasDeleted && counters.CustomerCount.HasValue && counters.CustomerCount > 0)
                {
                    counters.CustomerCount--;
                }
            }
            return "Success";
        }

        if (existing == null)
        {
            if (effectiveTier == PlanTier.Libre)
            {
                // Count once per batch to avoid N+1 queries, incrementing locally
                counters.CustomerCount ??= await _context.Customers.IgnoreQueryFilters()
                    .CountAsync(c => c.TenantId == tenantId && !c.IsDeleted, cancellationToken);

                if (counters.CustomerCount >= TierLimits.LibreMaxCustomers)
                {
                    throw new InvalidOperationException($"Libre plan limit exceeded: Maximum {TierLimits.LibreMaxCustomers} debtors allowed. Upgrade to Tindahan Pro for unlimited customer accounts.");
                }
            }
            var customer = new Customer
            {
                Id = raw.Id,
                TenantId = tenantId,
                Name = raw.Name ?? "Unknown Customer",
                Phone = raw.Phone ?? string.Empty,
                TotalUtangBalance = raw.TotalUtangBalance,
                UpdatedAt = op.Timestamp,
                IsDeleted = false
            };
            _context.Customers.Add(customer);
            await _context.SaveChangesAsync(cancellationToken);
            if (counters.CustomerCount.HasValue)
            {
                counters.CustomerCount++;
            }
            return "Success";
        }

        // LWW
        if (existing.UpdatedAt > op.Timestamp)
        {
            _logger.LogInformation("LWW conflict ignored for Customer {Id}: existing is newer ({Existing} > {Incoming})",
                existing.Id, existing.UpdatedAt, op.Timestamp);
            return "ConflictIgnored";
        }

        var wasPreviouslyDeleted = existing.IsDeleted;
        if (wasPreviouslyDeleted)
        {
            if (effectiveTier == PlanTier.Libre)
            {
                counters.CustomerCount ??= await _context.Customers.IgnoreQueryFilters()
                    .CountAsync(c => c.TenantId == tenantId && !c.IsDeleted, cancellationToken);

                if (counters.CustomerCount >= TierLimits.LibreMaxCustomers)
                {
                    throw new InvalidOperationException($"Libre plan limit exceeded: Maximum {TierLimits.LibreMaxCustomers} debtors allowed. Upgrade to Tindahan Pro for unlimited customer accounts.");
                }
            }
        }

        // If existing customer was previously archived/deleted, restore it
        existing.IsDeleted = false;
        existing.Name = raw.Name ?? existing.Name;
        existing.Phone = raw.Phone ?? existing.Phone;
        // TotalUtangBalance is normally maintained by UtangLedger, but if sync provided latest computed balance:
        if (raw.TotalUtangBalance >= 0)
        {
            existing.TotalUtangBalance = raw.TotalUtangBalance;
        }
        existing.UpdatedAt = op.Timestamp;

        await _context.SaveChangesAsync(cancellationToken);
        if (wasPreviouslyDeleted && counters.CustomerCount.HasValue)
        {
            counters.CustomerCount++;
        }
        return "Success";
    }

    private async Task<string> HandleUtangLedgerAsync(SyncOperationDto op, Guid tenantId, string action, BatchSyncCounters counters, CancellationToken cancellationToken)
    {
        var raw = JsonSerializer.Deserialize<UtangLedgerSyncPayload>(op.Payload.GetRawText(), JsonOptions)
            ?? throw new ArgumentException("UtangLedger payload is invalid.");

        if (raw.Id == Guid.Empty) raw.Id = Guid.NewGuid();

        // Append-only idempotency: if ledger entry already exists, mark Success
        var existing = await _context.UtangLedgers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == raw.Id && u.TenantId == tenantId, cancellationToken);

        if (existing != null)
        {
            return "Success";
        }

        if (counters.RejectedCustomerIds.Contains(raw.CustomerId))
        {
            throw new InvalidOperationException($"Customer '{raw.CustomerId}' was rejected in this sync batch. Utang ledger entry cannot be recorded.");
        }

        // Verify foreign key integrity: reject cleanly if customer does not exist
        var customer = await _context.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == raw.CustomerId && c.TenantId == tenantId, cancellationToken);

        if (customer == null)
        {
            throw new KeyNotFoundException($"Customer '{raw.CustomerId}' not found for tenant '{tenantId}'. Utang ledger entry cannot be recorded.");
        }

        var entry = new UtangLedger
        {
            Id = raw.Id,
            TenantId = tenantId,
            CustomerId = raw.CustomerId,
            Amount = Math.Abs(raw.Amount),
            Type = string.Equals(raw.Type, "Payment", StringComparison.OrdinalIgnoreCase) ? "Payment" : "Credit",
            Date = raw.Date != default ? raw.Date : op.Timestamp,
            RefSaleId = raw.RefSaleId,
            Notes = raw.Notes
        };

        _context.UtangLedgers.Add(entry);

        if (entry.Type == "Credit")
        {
            customer.TotalUtangBalance += entry.Amount;
        }
        else // Payment
        {
            customer.TotalUtangBalance = Math.Max(0, customer.TotalUtangBalance - entry.Amount);
        }
        customer.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return "Success";
    }

    private async Task<string> HandleSaleAsync(SyncOperationDto op, Guid tenantId, string action, BatchSyncCounters counters, CancellationToken cancellationToken)
    {
        var raw = JsonSerializer.Deserialize<SaleSyncPayload>(op.Payload.GetRawText(), JsonOptions)
            ?? throw new ArgumentException("Sale payload is invalid.");

        if (raw.Id == Guid.Empty) raw.Id = Guid.NewGuid();

        var existing = await _context.Sales.IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.Id == raw.Id && s.TenantId == tenantId, cancellationToken);

        if (existing != null)
        {
            return "Success"; // idempotent
        }

        // Verify optional CustomerId
        if (raw.CustomerId.HasValue && raw.CustomerId.Value != Guid.Empty)
        {
            if (counters.RejectedCustomerIds.Contains(raw.CustomerId.Value))
            {
                throw new InvalidOperationException($"Customer '{raw.CustomerId.Value}' was rejected in this sync batch. Sale cannot be recorded.");
            }

            var customerExists = await _context.Customers.IgnoreQueryFilters()
                .AnyAsync(c => c.Id == raw.CustomerId.Value && c.TenantId == tenantId, cancellationToken);

            if (!customerExists)
            {
                _logger.LogInformation("Customer '{CustomerId}' not found for tenant '{TenantId}' (possibly deleted); saving sale with null customer reference to prevent total drift.",
                    raw.CustomerId.Value, tenantId);
                raw.CustomerId = null;
            }
        }

        // Verify line item Products
        if (raw.Items != null && raw.Items.Count > 0)
        {
            var productIds = raw.Items.Select(i => i.ProductId).Where(id => id != Guid.Empty).Distinct().ToList();
            if (productIds.Count > 0)
            {
                // Only fail if a product was rejected in this batch (e.g. by Libre plan limit)
                var rejectedId = productIds.FirstOrDefault(id => counters.RejectedProductIds.Contains(id));
                if (rejectedId != Guid.Empty)
                {
                    throw new InvalidOperationException($"Product '{rejectedId}' was rejected in this sync batch. Sale cannot be recorded.");
                }

                var existingProductIds = await _context.Products.IgnoreQueryFilters()
                    .Where(p => p.TenantId == tenantId && productIds.Contains(p.Id))
                    .Select(p => p.Id)
                    .ToListAsync(cancellationToken);

                var missingProductIds = productIds.Except(existingProductIds).ToList();
                if (missingProductIds.Count > 0)
                {
                    // The product row is gone (deleted from another device or by earlier op).
                    // Preserve the sale and its line-item snapshot (name, price) by creating an archived/deleted placeholder product
                    // so the database FK_SaleItems_Products_ProductId constraint is satisfied, sales totals don't drift,
                    // and the placeholder does not count against Libre plan product limits.
                    foreach (var missingId in missingProductIds)
                    {
                        var matchingItem = raw.Items.FirstOrDefault(i => i.ProductId == missingId);
                        var placeholder = new Product
                        {
                            Id = missingId,
                            TenantId = tenantId,
                            Name = !string.IsNullOrWhiteSpace(matchingItem?.ProductName)
                                ? matchingItem.ProductName
                                : "[Deleted Product]",
                            Price = matchingItem?.UnitPrice ?? 0m,
                            Cost = 0m,
                            StockQty = 0,
                            UpdatedAt = op.Timestamp,
                            IsDeleted = true
                        };
                        _context.Products.Add(placeholder);
                    }
                    // Placeholders are committed atomically with the sale below in the same SaveChanges call.
                }
            }
        }

        var sale = new Sale
        {
            Id = raw.Id,
            TenantId = tenantId,
            TotalAmount = raw.TotalAmount,
            PaymentMethod = raw.PaymentMethod ?? "Cash",
            Date = raw.Date != default ? raw.Date : op.Timestamp,
            UserId = raw.UserId != Guid.Empty ? raw.UserId : _currentUserService.UserId ?? Guid.NewGuid(),
            CashReceived = raw.CashReceived,
            ChangeGiven = raw.ChangeGiven,
            CustomerId = raw.CustomerId
        };

        if (raw.Items != null && raw.Items.Count > 0)
        {
            foreach (var item in raw.Items)
            {
                sale.Items.Add(new SaleItem
                {
                    Id = item.Id != Guid.Empty ? item.Id : Guid.NewGuid(),
                    TenantId = tenantId,
                    SaleId = sale.Id,
                    ProductId = item.ProductId,
                    Qty = item.Qty > 0 ? item.Qty : 1,
                    UnitPrice = item.UnitPrice,
                    Subtotal = item.Subtotal > 0 ? item.Subtotal : (item.Qty * item.UnitPrice)
                });
            }
        }

        _context.Sales.Add(sale);
        await _context.SaveChangesAsync(cancellationToken);
        return "Success";
    }

    private async Task<string> HandleGCashTxnAsync(SyncOperationDto op, Guid tenantId, PlanTier effectiveTier, string action, BatchSyncCounters counters, CancellationToken cancellationToken)
    {
        var raw = JsonSerializer.Deserialize<GCashTxnSyncPayload>(op.Payload.GetRawText(), JsonOptions)
            ?? throw new ArgumentException("GCashTxn payload is invalid.");

        if (raw.Id == Guid.Empty) raw.Id = Guid.NewGuid();

        var existing = await _context.GCashTransactions.IgnoreQueryFilters()
            .FirstOrDefaultAsync(g => g.Id == raw.Id && g.TenantId == tenantId, cancellationToken);

        if (existing != null)
        {
            return "Success"; // idempotent
        }

        var refNorm = GCashTxn.NormalizeRef(raw.RefNo);
        if (refNorm.Length > 0)
        {
            var duplicateRef = await _context.GCashTransactions.IgnoreQueryFilters()
                .AnyAsync(g => g.TenantId == tenantId && g.RefNoNorm == refNorm, cancellationToken);
            if (duplicateRef)
            {
                _logger.LogWarning("Duplicate GCash reference number '{RefNo}' detected during batch sync for tenant {TenantId}. Returning DuplicateRef conflict status.", raw.RefNo?.Trim(), tenantId);
                return "DuplicateRef";
            }
        }

        var txnDate = raw.Date != default ? raw.Date : op.Timestamp;
        var startOfMonth = ManilaTime.StartOfCurrentMonthUtc();

        // Libre cap only applies to brand-new inserts within current month (never to back-dated inserts or replays)
        if (effectiveTier == PlanTier.Libre && txnDate >= startOfMonth)
        {
            counters.MonthlyGCashCount ??= await _context.GCashTransactions.IgnoreQueryFilters()
                .CountAsync(g => g.TenantId == tenantId && g.Date >= startOfMonth, cancellationToken);

            if (counters.MonthlyGCashCount >= TierLimits.LibreMaxGCashTransactionsPerMonth)
            {
                throw new InvalidOperationException($"Libre plan limit exceeded: Maximum {TierLimits.LibreMaxGCashTransactionsPerMonth} GCash transactions per month allowed. Upgrade to Tindahan Pro for unlimited logs.");
            }
        }

        var txn = new GCashTxn
        {
            Id = raw.Id,
            TenantId = tenantId,
            Type = string.Equals(raw.Type, "CashOut", StringComparison.OrdinalIgnoreCase) ? "CashOut" : "CashIn",
            Amount = raw.Amount,
            Fee = raw.Fee,
            RefNo = raw.RefNo ?? string.Empty,
            RefNoNorm = refNorm,
            CustomerPhone = raw.CustomerPhone,
            Date = txnDate,
            Notes = raw.Notes
        };

        _context.GCashTransactions.Add(txn);
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (RecordGCashTxnCommandHandler.IsUniqueIndexViolation(ex))
        {
            _context.Entry(txn).State = EntityState.Detached;
            _logger.LogWarning(ex, "DbUpdateException on unique index for GCash ref '{RefNo}' during batch sync for tenant {TenantId}. Returning DuplicateRef conflict status.", raw.RefNo?.Trim(), tenantId);
            return "DuplicateRef";
        }

        if (counters.MonthlyGCashCount.HasValue && txnDate >= startOfMonth)
        {
            counters.MonthlyGCashCount++;
        }
        return "Success";
    }

    // Payload helper classes for deserialization
    public class ProductSyncPayload
    {
        public Guid Id { get; set; }
        public string? Name { get; set; }
        public decimal Price { get; set; }
        public decimal Cost { get; set; }
        public string? Barcode { get; set; }
        public string? Category { get; set; }
        public int StockQty { get; set; }
    }

    public class CustomerSyncPayload
    {
        public Guid Id { get; set; }
        public string? Name { get; set; }
        public string? Phone { get; set; }
        public decimal TotalUtangBalance { get; set; }
    }

    public class UtangLedgerSyncPayload
    {
        public Guid Id { get; set; }
        public Guid CustomerId { get; set; }
        public decimal Amount { get; set; }
        public string? Type { get; set; }
        public DateTimeOffset Date { get; set; }
        public Guid? RefSaleId { get; set; }
        public string? Notes { get; set; }
    }

    public class SaleSyncPayload
    {
        public Guid Id { get; set; }
        public decimal TotalAmount { get; set; }
        public string? PaymentMethod { get; set; }
        public DateTimeOffset Date { get; set; }
        public Guid UserId { get; set; }
        public decimal? CashReceived { get; set; }
        public decimal? ChangeGiven { get; set; }
        public Guid? CustomerId { get; set; }
        public List<SaleItemSyncPayload>? Items { get; set; }
    }

    public class SaleItemSyncPayload
    {
        public Guid Id { get; set; }
        public Guid ProductId { get; set; }
        public string? ProductName { get; set; }
        public int Qty { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal Subtotal { get; set; }
    }

    public class GCashTxnSyncPayload
    {
        public Guid Id { get; set; }
        public string? Type { get; set; }
        public decimal Amount { get; set; }
        public decimal Fee { get; set; }
        public string? RefNo { get; set; }
        public string? CustomerPhone { get; set; }
        public DateTimeOffset Date { get; set; }
        public string? Notes { get; set; }
    }
}
