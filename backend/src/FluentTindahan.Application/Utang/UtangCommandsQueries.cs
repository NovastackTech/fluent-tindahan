using MediatR;
using Microsoft.EntityFrameworkCore;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Interfaces;

namespace FluentTindahan.Application.Utang;

public record UtangLedgerDto(
    Guid Id,
    Guid TenantId,
    Guid CustomerId,
    string? CustomerName,
    decimal Amount,
    string Type,
    DateTimeOffset Date,
    Guid? RefSaleId,
    string? Notes
);

public record GetUtangLedgerQuery(Guid? CustomerId = null, int? Limit = 500, DateTimeOffset? Before = null, Guid? BeforeId = null) : IRequest<List<UtangLedgerDto>>;

public class GetUtangLedgerQueryHandler : IRequestHandler<GetUtangLedgerQuery, List<UtangLedgerDto>>
{
    private readonly IApplicationDbContext _context;

    public GetUtangLedgerQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<UtangLedgerDto>> Handle(GetUtangLedgerQuery request, CancellationToken cancellationToken)
    {
        var limit = Math.Clamp(request.Limit ?? 500, 1, 1000);
        var query = _context.UtangLedgers.AsNoTracking().AsQueryable();

        if (request.CustomerId.HasValue)
        {
            query = query.Where(u => u.CustomerId == request.CustomerId.Value);
        }

        if (request.Before.HasValue)
        {
            var b = request.Before.Value;
            var bid = request.BeforeId ?? Guid.Empty;
            query = request.BeforeId.HasValue
                ? query.Where(u => u.Date < b || (u.Date == b && u.Id.CompareTo(bid) < 0))
                : query.Where(u => u.Date < b);
        }

        return await query
            .OrderByDescending(u => u.Date)
            .ThenByDescending(u => u.Id)
            .Take(limit)
            .Select(u => new UtangLedgerDto(
                u.Id,
                u.TenantId,
                u.CustomerId,
                u.Customer != null ? u.Customer.Name : null,
                u.Amount,
                u.Type,
                u.Date,
                u.RefSaleId,
                u.Notes))
            .ToListAsync(cancellationToken);
    }
}

public record RecordUtangCommand(
    Guid CustomerId,
    decimal Amount,
    string Type, // "Credit" or "Payment"
    Guid? RefSaleId = null,
    string? Notes = null
) : IRequest<UtangLedgerDto>;

public class RecordUtangCommandHandler : IRequestHandler<RecordUtangCommand, UtangLedgerDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public RecordUtangCommandHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<UtangLedgerDto> Handle(RecordUtangCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _currentUserService.TenantId;
        if (tenantId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Tenant is not authenticated or resolved.");
        }

        var entry = new UtangLedger
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CustomerId = request.CustomerId,
            Amount = Math.Abs(request.Amount),
            Type = string.Equals(request.Type, "Payment", StringComparison.OrdinalIgnoreCase) ? "Payment" : "Credit",
            Date = DateTimeOffset.UtcNow,
            RefSaleId = request.RefSaleId,
            Notes = request.Notes
        };

        _context.UtangLedgers.Add(entry);

        var customer = await _context.Customers
            .FirstOrDefaultAsync(c => c.Id == request.CustomerId && c.TenantId == tenantId, cancellationToken);

        if (customer != null)
        {
            if (entry.Type == "Credit")
            {
                customer.TotalUtangBalance += entry.Amount;
            }
            else
            {
                customer.TotalUtangBalance = Math.Max(0, customer.TotalUtangBalance - entry.Amount);
            }
            customer.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new UtangLedgerDto(
            entry.Id,
            entry.TenantId,
            entry.CustomerId,
            customer?.Name,
            entry.Amount,
            entry.Type,
            entry.Date,
            entry.RefSaleId,
            entry.Notes);
    }
}
