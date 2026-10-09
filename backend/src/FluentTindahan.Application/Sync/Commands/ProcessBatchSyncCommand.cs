using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Application.Sync.DTOs;
using FluentTindahan.Domain.Entities;
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
        var operations = command.Request.Operations ?? new List<SyncOperationDto>();
        var results = new List<SyncItemResultDto>();

        _logger.LogInformation("Processing batch sync for tenant {TenantId}, device {DeviceId}, operations count {Count}",
            tenantId, command.Request.DeviceId, operations.Count);

        foreach (var op in operations)
        {
            var syncId = string.IsNullOrWhiteSpace(op.SyncId) ? Guid.NewGuid().ToString() : op.SyncId;
            try
            {
                var status = await ProcessOperationAsync(op, tenantId, cancellationToken);
                results.Add(new SyncItemResultDto
                {
                    SyncId = syncId,
                    Status = status
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to process sync operation {SyncId} for entity {Entity}", syncId, op.Entity);
                results.Add(new SyncItemResultDto
                {
                    SyncId = syncId,
                    Status = "Failed",
                    Error = ex.Message
                });
            }
        }

        return new BatchSyncResultDto
        {
            ProcessedCount = results.Count(r => r.Status == "Success" || r.Status == "ConflictIgnored"),
            Results = results
        };
    }

    private async Task<string> ProcessOperationAsync(SyncOperationDto op, Guid tenantId, CancellationToken cancellationToken)
    {
        var entityType = op.Entity?.Trim().ToLowerInvariant();
        var action = op.Action?.Trim().ToLowerInvariant() ?? "insert";

        return entityType switch
        {
            "product" => await HandleProductAsync(op, tenantId, action, cancellationToken),
            "customer" => await HandleCustomerAsync(op, tenantId, action, cancellationToken),
            "utangledger" or "utang" => await HandleUtangLedgerAsync(op, tenantId, action, cancellationToken),
            "sale" => await HandleSaleAsync(op, tenantId, action, cancellationToken),
            "gcashtxn" or "gcash" => await HandleGCashTxnAsync(op, tenantId, action, cancellationToken),
            _ => throw new NotSupportedException($"Entity type '{op.Entity}' is not supported for synchronization.")
        };
    }

    private async Task<string> HandleProductAsync(SyncOperationDto op, Guid tenantId, string action, CancellationToken cancellationToken)
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
                _context.Products.Remove(existing);
                await _context.SaveChangesAsync(cancellationToken);
            }
            return "Success";
        }

        if (existing == null)
        {
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
                UpdatedAt = op.Timestamp
            };
            _context.Products.Add(product);
            await _context.SaveChangesAsync(cancellationToken);
            return "Success";
        }

        // Last-Write-Wins (LWW)
        if (existing.UpdatedAt > op.Timestamp)
        {
            _logger.LogInformation("LWW conflict ignored for Product {Id}: existing is newer ({Existing} > {Incoming})",
                existing.Id, existing.UpdatedAt, op.Timestamp);
            return "ConflictIgnored";
        }

        existing.Name = raw.Name ?? existing.Name;
        existing.Price = raw.Price;
        existing.Cost = raw.Cost;
        existing.Barcode = raw.Barcode ?? existing.Barcode;
        existing.Category = raw.Category ?? existing.Category;
        existing.StockQty = raw.StockQty;
        existing.UpdatedAt = op.Timestamp;

        await _context.SaveChangesAsync(cancellationToken);
        return "Success";
    }

    private async Task<string> HandleCustomerAsync(SyncOperationDto op, Guid tenantId, string action, CancellationToken cancellationToken)
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
                _context.Customers.Remove(existing);
                await _context.SaveChangesAsync(cancellationToken);
            }
            return "Success";
        }

        if (existing == null)
        {
            var customer = new Customer
            {
                Id = raw.Id,
                TenantId = tenantId,
                Name = raw.Name ?? "Unknown Customer",
                Phone = raw.Phone ?? string.Empty,
                TotalUtangBalance = raw.TotalUtangBalance,
                UpdatedAt = op.Timestamp
            };
            _context.Customers.Add(customer);
            await _context.SaveChangesAsync(cancellationToken);
            return "Success";
        }

        // LWW
        if (existing.UpdatedAt > op.Timestamp)
        {
            return "ConflictIgnored";
        }

        existing.Name = raw.Name ?? existing.Name;
        existing.Phone = raw.Phone ?? existing.Phone;
        // TotalUtangBalance is normally maintained by UtangLedger, but if sync provided latest computed balance:
        if (raw.TotalUtangBalance >= 0)
        {
            existing.TotalUtangBalance = raw.TotalUtangBalance;
        }
        existing.UpdatedAt = op.Timestamp;

        await _context.SaveChangesAsync(cancellationToken);
        return "Success";
    }

    private async Task<string> HandleUtangLedgerAsync(SyncOperationDto op, Guid tenantId, string action, CancellationToken cancellationToken)
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

        // Update customer total balance if customer exists
        var customer = await _context.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == raw.CustomerId && c.TenantId == tenantId, cancellationToken);

        if (customer != null)
        {
            if (entry.Type == "Credit")
            {
                customer.TotalUtangBalance += entry.Amount;
            }
            else // Payment
            {
                customer.TotalUtangBalance = Math.Max(0, customer.TotalUtangBalance - entry.Amount);
            }
            customer.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return "Success";
    }

    private async Task<string> HandleSaleAsync(SyncOperationDto op, Guid tenantId, string action, CancellationToken cancellationToken)
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

    private async Task<string> HandleGCashTxnAsync(SyncOperationDto op, Guid tenantId, string action, CancellationToken cancellationToken)
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

        var txn = new GCashTxn
        {
            Id = raw.Id,
            TenantId = tenantId,
            Type = string.Equals(raw.Type, "CashOut", StringComparison.OrdinalIgnoreCase) ? "CashOut" : "CashIn",
            Amount = raw.Amount,
            Fee = raw.Fee,
            RefNo = raw.RefNo ?? string.Empty,
            CustomerPhone = raw.CustomerPhone,
            Date = raw.Date != default ? raw.Date : op.Timestamp,
            Notes = raw.Notes
        };

        _context.GCashTransactions.Add(txn);
        await _context.SaveChangesAsync(cancellationToken);
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
