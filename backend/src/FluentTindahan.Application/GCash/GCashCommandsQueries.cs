using MediatR;
using Microsoft.EntityFrameworkCore;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Interfaces;

namespace FluentTindahan.Application.GCash;

public record GCashTxnDto(
    Guid Id,
    Guid TenantId,
    string Type,
    decimal Amount,
    decimal Fee,
    string RefNo,
    string? CustomerPhone,
    DateTimeOffset Date,
    string? Notes
);

public record GetGCashTransactionsQuery : IRequest<List<GCashTxnDto>>;

public class GetGCashTransactionsQueryHandler : IRequestHandler<GetGCashTransactionsQuery, List<GCashTxnDto>>
{
    private readonly IApplicationDbContext _context;

    public GetGCashTransactionsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<GCashTxnDto>> Handle(GetGCashTransactionsQuery request, CancellationToken cancellationToken)
    {
        return await _context.GCashTransactions
            .AsNoTracking()
            .OrderByDescending(g => g.Date)
            .Select(g => new GCashTxnDto(
                g.Id,
                g.TenantId,
                g.Type,
                g.Amount,
                g.Fee,
                g.RefNo,
                g.CustomerPhone,
                g.Date,
                g.Notes))
            .ToListAsync(cancellationToken);
    }
}

public record RecordGCashTxnCommand(
    string Type,
    decimal Amount,
    decimal Fee,
    string RefNo,
    string? CustomerPhone = null,
    string? Notes = null
) : IRequest<GCashTxnDto>;

public class RecordGCashTxnCommandHandler : IRequestHandler<RecordGCashTxnCommand, GCashTxnDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public RecordGCashTxnCommandHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<GCashTxnDto> Handle(RecordGCashTxnCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _currentUserService.TenantId;
        if (tenantId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Tenant is not authenticated or resolved.");
        }

        var txn = new GCashTxn
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Type = request.Type,
            Amount = request.Amount,
            Fee = request.Fee,
            RefNo = request.RefNo,
            CustomerPhone = request.CustomerPhone,
            Date = DateTimeOffset.UtcNow,
            Notes = request.Notes
        };

        _context.GCashTransactions.Add(txn);
        await _context.SaveChangesAsync(cancellationToken);

        return new GCashTxnDto(
            txn.Id,
            txn.TenantId,
            txn.Type,
            txn.Amount,
            txn.Fee,
            txn.RefNo,
            txn.CustomerPhone,
            txn.Date,
            txn.Notes);
    }
}
