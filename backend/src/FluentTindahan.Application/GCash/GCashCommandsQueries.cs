using MediatR;
using Microsoft.EntityFrameworkCore;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Common;
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

public class DuplicateGCashRefException : InvalidOperationException
{
    public string RefNo { get; }

    public DuplicateGCashRefException(string refNo)
        : base($"Duplicate GCash reference number '{refNo.Trim()}' for this tenant.")
    {
        RefNo = refNo;
    }
}

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

        string? customerPhone = null;
        if (!string.IsNullOrWhiteSpace(request.CustomerPhone))
        {
            if (!PhilippineMobileNumber.TryNormalize(request.CustomerPhone, out var normalizedPhone))
            {
                throw new ArgumentException("Enter a valid Philippine mobile number.", nameof(request.CustomerPhone));
            }
            customerPhone = normalizedPhone;
        }

        var refNorm = GCashTxn.NormalizeRef(request.RefNo);
        if (refNorm.Length > 0)
        {
            var duplicate = await _context.GCashTransactions.IgnoreQueryFilters()
                .AnyAsync(g => g.TenantId == tenantId && g.RefNoNorm == refNorm, cancellationToken);
            if (duplicate)
            {
                throw new DuplicateGCashRefException(request.RefNo);
            }
        }

        var txn = new GCashTxn
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Type = request.Type,
            Amount = request.Amount,
            Fee = request.Fee,
            RefNo = request.RefNo,
            RefNoNorm = refNorm,
            CustomerPhone = customerPhone,
            Date = DateTimeOffset.UtcNow,
            Notes = request.Notes
        };

        _context.GCashTransactions.Add(txn);
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueIndexViolation(ex))
        {
            _context.Entry(txn).State = EntityState.Detached;
            throw new DuplicateGCashRefException(request.RefNo);
        }

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

    public static bool IsUniqueIndexViolation(DbUpdateException ex)
    {
        var current = (Exception?)ex;
        while (current != null)
        {
            if (string.Equals(current.GetType().FullName, "Npgsql.PostgresException", StringComparison.Ordinal))
            {
                var sqlStateProp = current.GetType().GetProperty("SqlState");
                var constraintNameProp = current.GetType().GetProperty("ConstraintName");
                return sqlStateProp?.GetValue(current) as string == "23505"
                    && constraintNameProp?.GetValue(current) as string == GCashTxn.RefNoNormUniqueIndexName;
            }

            current = current.InnerException;
        }

        return false;
    }
}

