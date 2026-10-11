using MediatR;
using Microsoft.EntityFrameworkCore;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Interfaces;

namespace FluentTindahan.Application.Dashboard;

public record DashboardSummaryDto(
    decimal TodaySales,
    int TodaySalesCount,
    decimal TotalUtangOutstanding,
    int DebtorsCount,
    decimal TodayGCashVolume,
    decimal TodayGCashFees,
    int TotalProductsCount,
    int LowStockProductsCount
);

public record GetDashboardSummaryQuery : IRequest<DashboardSummaryDto>;

public class GetDashboardSummaryQueryHandler : IRequestHandler<GetDashboardSummaryQuery, DashboardSummaryDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService? _currentUserService;

    public GetDashboardSummaryQueryHandler(IApplicationDbContext context, ICurrentUserService? currentUserService = null)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<DashboardSummaryDto> Handle(GetDashboardSummaryQuery request, CancellationToken cancellationToken)
    {
        var todayUtc = new DateTimeOffset(DateTime.UtcNow.Date, TimeSpan.Zero);

        var todaySalesList = await _context.Sales
            .AsNoTracking()
            .Where(s => s.Date >= todayUtc)
            .ToListAsync(cancellationToken);

        var todaySalesTotal = todaySalesList.Sum(s => s.TotalAmount);
        var todaySalesCount = todaySalesList.Count;

        var tenantId = _currentUserService?.TenantId;
        IQueryable<Customer> debtorsQuery = _context.Customers.AsNoTracking();
        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            // IgnoreQueryFilters ensures soft-deleted customers with non-zero utang balances
            // are still included in storewide outstanding debt reports.
            debtorsQuery = _context.Customers
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(c => c.TenantId == tenantId.Value);
        }

        var debtors = await debtorsQuery
            .Where(c => c.TotalUtangBalance > 0)
            .ToListAsync(cancellationToken);

        var totalUtang = debtors.Sum(c => c.TotalUtangBalance);
        var debtorsCount = debtors.Count;

        var todayGCash = await _context.GCashTransactions
            .AsNoTracking()
            .Where(g => g.Date >= todayUtc)
            .ToListAsync(cancellationToken);

        var todayGCashVolume = todayGCash.Sum(g => g.Amount);
        var todayGCashFees = todayGCash.Sum(g => g.Fee);

        var totalProducts = await _context.Products.AsNoTracking().CountAsync(cancellationToken);
        var lowStock = await _context.Products.AsNoTracking().CountAsync(p => p.StockQty <= 5, cancellationToken);

        return new DashboardSummaryDto(
            todaySalesTotal,
            todaySalesCount,
            totalUtang,
            debtorsCount,
            todayGCashVolume,
            todayGCashFees,
            totalProducts,
            lowStock
        );
    }
}
