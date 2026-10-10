using Microsoft.EntityFrameworkCore;
using FluentTindahan.Domain.Entities;

namespace FluentTindahan.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Tenant> Tenants { get; }
    DbSet<User> Users { get; }
    DbSet<Product> Products { get; }
    DbSet<Customer> Customers { get; }
    DbSet<UtangLedger> UtangLedgers { get; }
    DbSet<Sale> Sales { get; }
    DbSet<SaleItem> SaleItems { get; }
    DbSet<GCashTxn> GCashTransactions { get; }
    DbSet<PaymentHistory> PaymentHistories { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
