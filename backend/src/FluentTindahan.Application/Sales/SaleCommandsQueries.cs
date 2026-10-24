using MediatR;
using Microsoft.EntityFrameworkCore;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Interfaces;

namespace FluentTindahan.Application.Sales;

public record SaleItemDto(
    Guid Id,
    Guid ProductId,
    string? ProductName,
    int Qty,
    decimal UnitPrice,
    decimal Subtotal
);

public record SaleDto(
    Guid Id,
    Guid TenantId,
    decimal TotalAmount,
    string PaymentMethod,
    DateTimeOffset Date,
    Guid UserId,
    decimal? CashReceived,
    decimal? ChangeGiven,
    Guid? CustomerId,
    string? CustomerName,
    List<SaleItemDto> Items
);

public record GetSalesQuery(int? Limit = 500, DateTimeOffset? Before = null) : IRequest<List<SaleDto>>;

public class GetSalesQueryHandler : IRequestHandler<GetSalesQuery, List<SaleDto>>
{
    private readonly IApplicationDbContext _context;

    public GetSalesQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<SaleDto>> Handle(GetSalesQuery request, CancellationToken cancellationToken)
    {
        var limit = Math.Clamp(request.Limit ?? 500, 1, 1000);
        var query = _context.Sales.AsNoTracking().AsQueryable();

        if (request.Before.HasValue)
        {
            query = query.Where(s => s.Date < request.Before.Value);
        }

        return await query
            .Include(s => s.Items)
                .ThenInclude(i => i.Product)
            .Include(s => s.Customer)
            .OrderByDescending(s => s.Date)
            .Take(limit)
            .Select(s => new SaleDto(
                s.Id,
                s.TenantId,
                s.TotalAmount,
                s.PaymentMethod,
                s.Date,
                s.UserId,
                s.CashReceived,
                s.ChangeGiven,
                s.CustomerId,
                s.Customer != null ? s.Customer.Name : null,
                s.Items.Select(i => new SaleItemDto(
                    i.Id,
                    i.ProductId,
                    i.Product != null ? i.Product.Name : null,
                    i.Qty,
                    i.UnitPrice,
                    i.Subtotal
                )).ToList()
            ))
            .ToListAsync(cancellationToken);
    }
}

public record CreateSaleItemInput(Guid ProductId, int Qty, decimal UnitPrice, decimal? Subtotal = null);

public record CreateSaleCommand(
    decimal TotalAmount,
    string PaymentMethod,
    List<CreateSaleItemInput> Items,
    decimal? CashReceived = null,
    decimal? ChangeGiven = null,
    Guid? CustomerId = null
) : IRequest<SaleDto>;

public class CreateSaleCommandHandler : IRequestHandler<CreateSaleCommand, SaleDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public CreateSaleCommandHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<SaleDto> Handle(CreateSaleCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _currentUserService.TenantId;
        if (tenantId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Tenant is not authenticated or resolved.");
        }

        if (request.TotalAmount < 0)
        {
            throw new ArgumentException("Total amount cannot be negative.", nameof(request.TotalAmount));
        }

        if (string.IsNullOrWhiteSpace(request.PaymentMethod))
        {
            throw new ArgumentException("Payment method is required.", nameof(request.PaymentMethod));
        }

        if (request.Items == null)
        {
            throw new ArgumentException("Items list cannot be null.", nameof(request.Items));
        }

        foreach (var item in request.Items)
        {
            if (item == null)
            {
                throw new ArgumentException("Sale item cannot be null.", nameof(request.Items));
            }
            if (item.Qty <= 0)
            {
                throw new ArgumentException("Item quantity must be greater than zero.", nameof(request.Items));
            }
            if (item.UnitPrice < 0)
            {
                throw new ArgumentException("Item unit price cannot be negative.", nameof(request.Items));
            }
            if (item.Subtotal.HasValue && item.Subtotal.Value < 0)
            {
                throw new ArgumentException("Item subtotal cannot be negative.", nameof(request.Items));
            }
        }

        var saleId = Guid.NewGuid();

        var sale = new Sale
        {
            Id = saleId,
            TenantId = tenantId,
            TotalAmount = request.TotalAmount,
            PaymentMethod = request.PaymentMethod.Trim(),
            Date = DateTimeOffset.UtcNow,
            UserId = _currentUserService.UserId ?? Guid.NewGuid(),
            CashReceived = request.CashReceived,
            ChangeGiven = request.ChangeGiven,
            CustomerId = request.CustomerId
        };

        foreach (var item in request.Items)
        {
            var subtotal = item.Subtotal ?? (item.Qty * item.UnitPrice);
            sale.Items.Add(new SaleItem
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                SaleId = saleId,
                ProductId = item.ProductId,
                Qty = item.Qty,
                UnitPrice = item.UnitPrice,
                Subtotal = subtotal
            });
        }

        _context.Sales.Add(sale);

        // If PaymentMethod is Utang and customer specified, create UtangLedger entry
        if (string.Equals(request.PaymentMethod, "Utang", StringComparison.OrdinalIgnoreCase) && request.CustomerId.HasValue)
        {
            var utang = new UtangLedger
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CustomerId = request.CustomerId.Value,
                Amount = request.TotalAmount,
                Type = "Credit",
                Date = DateTimeOffset.UtcNow,
                RefSaleId = saleId,
                Notes = $"Sale {saleId}"
            };
            _context.UtangLedgers.Add(utang);

            var customer = await _context.Customers
                .FirstOrDefaultAsync(c => c.Id == request.CustomerId.Value && c.TenantId == tenantId, cancellationToken);
            if (customer != null)
            {
                customer.TotalUtangBalance += request.TotalAmount;
                customer.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new SaleDto(
            sale.Id,
            sale.TenantId,
            sale.TotalAmount,
            sale.PaymentMethod,
            sale.Date,
            sale.UserId,
            sale.CashReceived,
            sale.ChangeGiven,
            sale.CustomerId,
            null,
            sale.Items.Select(i => new SaleItemDto(i.Id, i.ProductId, null, i.Qty, i.UnitPrice, i.Subtotal)).ToList()
        );
    }
}
