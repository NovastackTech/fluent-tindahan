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
        var product = new Product
        {
            Id = Guid.NewGuid(),
            TenantId = _currentUserService.TenantId,
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
