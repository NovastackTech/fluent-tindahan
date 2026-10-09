using FluentAssertions;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Exceptions;
using Xunit;

namespace FluentTindahan.UnitTests;

public class DomainTests
{
    [Fact]
    public void Product_PropertiesAndDefaults_ShouldWorkCorrectly()
    {
        var id = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        var product = new Product
        {
            Id = id,
            TenantId = tenantId,
            Name = "Lucky Me Pancit Canton",
            Price = 16.50m,
            Cost = 13.00m,
            Barcode = "4800016644810",
            Category = "Noodles",
            StockQty = 25,
            UpdatedAt = now
        };

        product.Id.Should().Be(id);
        product.TenantId.Should().Be(tenantId);
        product.Name.Should().Be("Lucky Me Pancit Canton");
        product.Price.Should().Be(16.50m);
        product.Cost.Should().Be(13.00m);
        product.Barcode.Should().Be("4800016644810");
        product.Category.Should().Be("Noodles");
        product.StockQty.Should().Be(25);
        product.UpdatedAt.Should().Be(now);
    }

    [Fact]
    public void Customer_PropertiesAndDefaults_ShouldWorkCorrectly()
    {
        var id = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        var customer = new Customer
        {
            Id = id,
            TenantId = tenantId,
            Name = "Kuya Cardo",
            Phone = "09181234567",
            TotalUtangBalance = 250.75m,
            UpdatedAt = now
        };

        customer.Id.Should().Be(id);
        customer.TenantId.Should().Be(tenantId);
        customer.Name.Should().Be("Kuya Cardo");
        customer.Phone.Should().Be("09181234567");
        customer.TotalUtangBalance.Should().Be(250.75m);
        customer.UpdatedAt.Should().Be(now);
        customer.UtangLedgers.Should().NotBeNull();
    }

    [Fact]
    public void UtangLedger_CreditAndPayment_ShouldInitializeProperly()
    {
        var id = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var custId = Guid.NewGuid();
        var saleId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        var credit = new UtangLedger
        {
            Id = id,
            TenantId = tenantId,
            CustomerId = custId,
            Amount = 150m,
            Type = "Credit",
            Date = now,
            RefSaleId = saleId,
            Notes = "Store purchase on credit"
        };

        credit.Id.Should().Be(id);
        credit.TenantId.Should().Be(tenantId);
        credit.CustomerId.Should().Be(custId);
        credit.Amount.Should().Be(150m);
        credit.Type.Should().Be("Credit");
        credit.Date.Should().Be(now);
        credit.RefSaleId.Should().Be(saleId);
        credit.Notes.Should().Be("Store purchase on credit");

        var payment = new UtangLedger
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CustomerId = custId,
            Amount = 50m,
            Type = "Payment",
            Date = now,
            Notes = "Partial payment"
        };
        payment.Type.Should().Be("Payment");
    }

    [Fact]
    public void GCashTxn_Properties_ShouldInitializeProperly()
    {
        var id = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        var txn = new GCashTxn
        {
            Id = id,
            TenantId = tenantId,
            Type = "CashIn",
            Amount = 500m,
            Fee = 10m,
            RefNo = "1002938475",
            CustomerPhone = "09170001111",
            Date = now,
            Notes = "GCash remittance cash-in"
        };

        txn.Id.Should().Be(id);
        txn.TenantId.Should().Be(tenantId);
        txn.Type.Should().Be("CashIn");
        txn.Amount.Should().Be(500m);
        txn.Fee.Should().Be(10m);
        txn.RefNo.Should().Be("1002938475");
        txn.CustomerPhone.Should().Be("09170001111");
        txn.Date.Should().Be(now);
        txn.Notes.Should().Be("GCash remittance cash-in");

        var cashOut = new GCashTxn
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Type = "CashOut",
            Amount = 1000m,
            Fee = 20m,
            RefNo = "9988776655",
            Date = now
        };
        cashOut.Type.Should().Be("CashOut");
    }

    [Fact]
    public void SaleAndSaleItem_Properties_ShouldInitializeProperly()
    {
        var saleId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var custId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        var sale = new Sale
        {
            Id = saleId,
            TenantId = tenantId,
            TotalAmount = 85.50m,
            PaymentMethod = "Cash",
            Date = now,
            UserId = userId,
            CustomerId = custId,
            CashReceived = 100m,
            ChangeGiven = 14.50m
        };

        var item = new SaleItem
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SaleId = saleId,
            ProductId = Guid.NewGuid(),
            Qty = 3,
            UnitPrice = 28.50m,
            Subtotal = 85.50m
        };

        sale.Items.Add(item);

        sale.TotalAmount.Should().Be(85.50m);
        sale.PaymentMethod.Should().Be("Cash");
        sale.CashReceived.Should().Be(100m);
        sale.ChangeGiven.Should().Be(14.50m);
        sale.Items.Should().HaveCount(1);
        item.Subtotal.Should().Be(85.50m);
        item.Qty.Should().Be(3);
    }

    [Fact]
    public void TenantAndUser_Properties_ShouldInitializeProperly()
    {
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        var tenant = new Tenant
        {
            Id = tenantId,
            BusinessName = "Aling Nena's Tindahan",
            PlanTier = "Free",
            CreatedAt = now
        };

        var user = new User
        {
            Id = userId,
            TenantId = tenantId,
            Phone = "09171234567",
            FirebaseUid = "firebase_user_123",
            Role = "Owner",
            CreatedAt = now
        };

        tenant.Id.Should().Be(tenantId);
        tenant.BusinessName.Should().Be("Aling Nena's Tindahan");
        tenant.PlanTier.Should().Be("Free");
        tenant.CreatedAt.Should().Be(now);

        user.Id.Should().Be(userId);
        user.TenantId.Should().Be(tenantId);
        user.Phone.Should().Be("09171234567");
        user.FirebaseUid.Should().Be("firebase_user_123");
        user.Role.Should().Be("Owner");
    }

    [Fact]
    public void DomainExceptions_ShouldConstructProperly()
    {
        var domainEx = new DomainException("General domain error");
        domainEx.Message.Should().Be("General domain error");

        var notFoundEx = new EntityNotFoundException("Product", "prod-123");
        notFoundEx.Message.Should().Contain("Product");
        notFoundEx.Message.Should().Contain("prod-123");

        var conflictEx = new ConcurrencyConflictException("Conflict detected on entity");
        conflictEx.Message.Should().Be("Conflict detected on entity");

        var validationEx = new ValidationException(new Dictionary<string, string[]>
        {
            { "Price", new[] { "Price must be greater than zero." } }
        });
        validationEx.Message.Should().Be("One or more validation failures have occurred.");
        validationEx.Errors.Should().ContainKey("Price");
        validationEx.Errors["Price"].Should().Contain("Price must be greater than zero.");
    }
}
