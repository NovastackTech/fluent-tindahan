using MediatR;
using Microsoft.EntityFrameworkCore;
using FluentTindahan.Application.Common.Interfaces;
using FluentTindahan.Domain.Billing;
using FluentTindahan.Domain.Common;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Domain.Interfaces;

namespace FluentTindahan.Application.Customers;

public record CustomerDto(
    Guid Id,
    Guid TenantId,
    string Name,
    string Phone,
    decimal TotalUtangBalance,
    DateTimeOffset UpdatedAt
);

public record GetCustomersQuery : IRequest<List<CustomerDto>>;

public class GetCustomersQueryHandler : IRequestHandler<GetCustomersQuery, List<CustomerDto>>
{
    private readonly IApplicationDbContext _context;

    public GetCustomersQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<CustomerDto>> Handle(GetCustomersQuery request, CancellationToken cancellationToken)
    {
        return await _context.Customers
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new CustomerDto(
                c.Id,
                c.TenantId,
                c.Name,
                c.Phone,
                c.UtangLedgers.Any()
                    ? (c.UtangLedgers.Where(u => u.Type == "Credit").Sum(u => (decimal?)u.Amount) ?? 0m) -
                      (c.UtangLedgers.Where(u => u.Type == "Payment").Sum(u => (decimal?)u.Amount) ?? 0m)
                    : c.TotalUtangBalance,
                c.UpdatedAt))
            .ToListAsync(cancellationToken);
    }
}

public record CreateCustomerCommand(string Name, string Phone) : IRequest<CustomerDto>;

public class CreateCustomerCommandHandler : IRequestHandler<CreateCustomerCommand, CustomerDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public CreateCustomerCommandHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<CustomerDto> Handle(CreateCustomerCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _currentUserService.TenantId;
        if (tenantId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Tenant is not authenticated or resolved.");
        }

        const int MaxAllowedNameLength = 100;
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > MaxAllowedNameLength)
        {
            throw new ArgumentException($"Customer name must be between 1 and {MaxAllowedNameLength} characters.", nameof(request.Name));
        }

        if (!PhilippineMobileNumber.TryNormalize(request.Phone, out var phone))
        {
            throw new ArgumentException("Enter a valid Philippine mobile number.", nameof(request.Phone));
        }

        var tenant = await _context.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var isExpired = tenant != null && tenant.Tier != PlanTier.Libre && tenant.SubscriptionEndDate.HasValue && tenant.SubscriptionEndDate.Value < now;
        var effectiveTier = isExpired ? PlanTier.Libre : (tenant?.Tier ?? PlanTier.Libre);

        if (effectiveTier == PlanTier.Libre)
        {
            var customerCount = await _context.Customers.IgnoreQueryFilters()
                .CountAsync(c => c.TenantId == tenantId && !c.IsDeleted, cancellationToken);
            if (customerCount >= TierLimits.LibreMaxCustomers)
            {
                throw new InvalidOperationException($"Libre plan limit exceeded: Maximum {TierLimits.LibreMaxCustomers} debtors allowed. Upgrade to Tindahan Pro for unlimited customer accounts.");
            }
        }

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = request.Name,
            Phone = phone,
            TotalUtangBalance = 0m,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.Customers.Add(customer);
        await _context.SaveChangesAsync(cancellationToken);

        return new CustomerDto(
            customer.Id,
            customer.TenantId,
            customer.Name,
            customer.Phone,
            customer.TotalUtangBalance,
            customer.UpdatedAt);
    }
}
