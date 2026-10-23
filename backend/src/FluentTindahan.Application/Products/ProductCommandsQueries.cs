using MediatR;
using Microsoft.EntityFrameworkCore;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Interfaces;

namespace FluentTindahan.Application.Products;

public record ProductDto(
    Guid Id,
    Guid TenantId,
    string Name,
    decimal Price,
    decimal Cost,
    string? Barcode,
    string? Category,
    int StockQty,
    DateTimeOffset UpdatedAt
);

public record GetProductsQuery : IRequest<List<ProductDto>>;

public class GetProductsQueryHandler : IRequestHandler<GetProductsQuery, List<ProductDto>>
{
    private readonly IApplicationDbContext _context;

    public GetProductsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<ProductDto>> Handle(GetProductsQuery request, CancellationToken cancellationToken)
    {
        return await _context.Products
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .Select(p => new ProductDto(
                p.Id,
                p.TenantId,
                p.Name,
                p.Price,
                p.Cost,
                p.Barcode,
                p.Category,
                p.StockQty,
                p.UpdatedAt))
            .ToListAsync(cancellationToken);
    }
}

public record CreateProductCommand(
    string Name,
    decimal Price,
    decimal Cost,
    string? Barcode = null,
    string? Category = null,
    int StockQty = 0
) : IRequest<ProductDto>;

public class CreateProductCommandHandler : IRequestHandler<CreateProductCommand, ProductDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public CreateProductCommandHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<ProductDto> Handle(CreateProductCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _currentUserService.TenantId;
        if (tenantId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Tenant is not authenticated or resolved.");
        }

        const decimal MaxAllowedPrice = 999_999.99m;
        const int MaxAllowedNameLength = 200;
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > MaxAllowedNameLength)
        {
            throw new ArgumentException($"Product name must be between 1 and {MaxAllowedNameLength} characters.", nameof(request.Name));
        }
        if (request.Price <= 0 || request.Price > MaxAllowedPrice)
        {
            throw new ArgumentException($"Retail price must be between ₱0.01 and ₱{MaxAllowedPrice:N2}.", nameof(request.Price));
        }
        if (request.Cost < 0 || request.Cost > MaxAllowedPrice)
        {
            throw new ArgumentException($"Cost price must be between ₱0.00 and ₱{MaxAllowedPrice:N2}.", nameof(request.Cost));
        }
        const int MaxAllowedStock = 999_999;
        if (request.StockQty < -MaxAllowedStock || request.StockQty > MaxAllowedStock)
        {
            throw new ArgumentException($"Stock quantity must be between -{MaxAllowedStock:N0} and {MaxAllowedStock:N0}.", nameof(request.StockQty));
        }

        var product = new Product
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = request.Name,
            Price = request.Price,
            Cost = request.Cost,
            Barcode = request.Barcode,
            Category = request.Category,
            StockQty = request.StockQty,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.Products.Add(product);
        await _context.SaveChangesAsync(cancellationToken);

        return new ProductDto(
            product.Id,
            product.TenantId,
            product.Name,
            product.Price,
            product.Cost,
            product.Barcode,
            product.Category,
            product.StockQty,
            product.UpdatedAt);
    }
}
