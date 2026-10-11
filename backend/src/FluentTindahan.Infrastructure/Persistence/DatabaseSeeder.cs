using Microsoft.EntityFrameworkCore;
using FluentTindahan.Domain.Entities;
using FluentTindahan.Domain.Enums;
using FluentTindahan.Infrastructure.Services;

namespace FluentTindahan.Infrastructure.Persistence;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        var tenantId = CurrentUserService.DefaultTenantId;
        var userId = CurrentUserService.DefaultUserId;

        // Ensure Tenant exists
        var tenant = await context.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == tenantId);
        if (tenant == null)
        {
            tenant = new Tenant
            {
                Id = tenantId,
                BusinessName = "Aling Nena's Tindahan & GCash",
                Tier = PlanTier.TindahanPro,
                SubscriptionEndDate = DateTimeOffset.UtcNow.AddYears(1),
                CreatedAt = DateTimeOffset.UtcNow
            };
            context.Tenants.Add(tenant);
            await context.SaveChangesAsync();
        }
        else if (tenant.Tier != PlanTier.Libre && !tenant.SubscriptionEndDate.HasValue)
        {
            tenant.SubscriptionEndDate = DateTimeOffset.UtcNow.AddYears(1);
            await context.SaveChangesAsync();
        }

        // Ensure User exists
        var user = await context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            user = new User
            {
                Id = userId,
                TenantId = tenantId,
                Phone = "09171234567",
                Role = "Owner",
                FirebaseUid = "demo-firebase-uid",
                CreatedAt = DateTimeOffset.UtcNow
            };
            context.Users.Add(user);
            await context.SaveChangesAsync();
        }

        // Ensure full catalog is seeded
        var existingProductIds = await context.Products.IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantId)
            .Select(p => p.Id)
            .ToListAsync();
        var existingProductIdsSet = existingProductIds.ToHashSet();

        var products = new List<Product>
        {
            // Instant Noodles (4)
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000001"), TenantId = tenantId, Name = "Lucky Me! Instant Pancit Canton Kalamansi 80g", Price = 16.00m, Cost = 13.25m, Barcode = "4800016644026", Category = "Instant Noodles", StockQty = 36, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000002"), TenantId = tenantId, Name = "Lucky Me! Instant Pancit Canton Chili Mansi 80g", Price = 16.00m, Cost = 13.25m, Barcode = "4800016644040", Category = "Instant Noodles", StockQty = 36, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000004"), TenantId = tenantId, Name = "Lucky Me! Instant Pancit Canton Original 80g", Price = 16.00m, Cost = 13.25m, Barcode = "4800016644019", Category = "Instant Noodles", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000006"), TenantId = tenantId, Name = "Lucky Me! Instant Mami Chicken 55g", Price = 13.00m, Cost = 10.50m, Barcode = "4800016601012", Category = "Instant Noodles", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },

            // Coffee, Milk & Breakfast (6)
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000013"), TenantId = tenantId, Name = "Kopiko Blanca 3-in-1 Coffee 52g", Price = 15.00m, Cost = 12.20m, Barcode = "8996001414002", Category = "Coffee & Beverages", StockQty = 50, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000015"), TenantId = tenantId, Name = "Kopiko Brown 3-in-1 Coffee 53g", Price = 15.00m, Cost = 12.20m, Barcode = "8996001410264", Category = "Coffee & Beverages", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000017"), TenantId = tenantId, Name = "Nescafe Classic Pure Soluble Coffee 1.9g", Price = 4.50m, Cost = 3.25m, Barcode = "4800361287661", Category = "Coffee & Beverages", StockQty = 60, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000018"), TenantId = tenantId, Name = "Nescafe 3-in-1 Original Coffee 56g", Price = 15.00m, Cost = 12.50m, Barcode = "4800361384025", Category = "Coffee & Beverages", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000021"), TenantId = tenantId, Name = "Milo Activ-Go Chocolate Powder Drink 24g", Price = 12.00m, Cost = 9.25m, Barcode = "4800361341103", Category = "Coffee & Beverages", StockQty = 50, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000022"), TenantId = tenantId, Name = "Bear Brand Fortified Powdered Milk Drink 33g", Price = 14.00m, Cost = 11.50m, Barcode = "4800361376846", Category = "Milk & Dairy", StockQty = 60, UpdatedAt = DateTimeOffset.UtcNow },

            // Cold Beverages & Juices (3)
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000027"), TenantId = tenantId, Name = "Tang Powdered Juice Orange 20g", Price = 21.00m, Cost = 17.50m, Barcode = "4800024101108", Category = "Juices & Beverages", StockQty = 25, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000032"), TenantId = tenantId, Name = "Coca-Cola Regular Mismo 290ml", Price = 20.00m, Cost = 16.00m, Barcode = "4801981100103", Category = "Beverages", StockQty = 36, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000034"), TenantId = tenantId, Name = "Royal Tru-Orange Mismo 290ml", Price = 20.00m, Cost = 16.00m, Barcode = "4801981100301", Category = "Beverages", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },

            // Canned Goods (5)
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000035"), TenantId = tenantId, Name = "Mega Sardines in Tomato Sauce Green 155g", Price = 26.00m, Cost = 22.50m, Barcode = "4809011743015", Category = "Canned Goods", StockQty = 36, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000037"), TenantId = tenantId, Name = "555 Sardines in Tomato Sauce 155g", Price = 25.00m, Cost = 21.00m, Barcode = "4800216111018", Category = "Canned Goods", StockQty = 36, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000041"), TenantId = tenantId, Name = "Century Tuna Flakes in Oil 155g", Price = 40.00m, Cost = 34.00m, Barcode = "4800216212012", Category = "Canned Goods", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000045"), TenantId = tenantId, Name = "Argentina Corned Beef 150g", Price = 43.00m, Cost = 37.00m, Barcode = "4800216211015", Category = "Canned Goods", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000047"), TenantId = tenantId, Name = "CDO Karne Norte 150g", Price = 31.00m, Cost = 26.00m, Barcode = "4800168111019", Category = "Canned Goods", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },

            // Condiments & Seasonings (6)
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000049"), TenantId = tenantId, Name = "Silver Swan Soy Sauce 100ml", Price = 7.00m, Cost = 5.50m, Barcode = "4800194110300", Category = "Condiments", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000050"), TenantId = tenantId, Name = "Silver Swan Cane Vinegar 100ml", Price = 6.50m, Cost = 5.00m, Barcode = "4800194120309", Category = "Condiments", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000051"), TenantId = tenantId, Name = "Datu Puti Soy Sauce 100ml", Price = 7.00m, Cost = 5.75m, Barcode = "4801981110034", Category = "Condiments", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000056"), TenantId = tenantId, Name = "Maggi Magic Sarap All-in-One Seasoning 8g", Price = 6.00m, Cost = 4.25m, Barcode = "4800361361019", Category = "Seasonings", StockQty = 80, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000057"), TenantId = tenantId, Name = "Knorr Pork Broth Cube 10g", Price = 8.00m, Cost = 6.00m, Barcode = "4800888151014", Category = "Seasonings", StockQty = 60, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000059"), TenantId = tenantId, Name = "Knorr Sinigang sa Sampalok Mix Original 20g", Price = 18.00m, Cost = 14.50m, Barcode = "4800888152011", Category = "Seasonings", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },

            // Biscuits & Snacks (5)
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000064"), TenantId = tenantId, Name = "SkyFlakes Crackers Plain 25g", Price = 8.50m, Cost = 6.50m, Barcode = "4800016010012", Category = "Biscuits & Bakery", StockQty = 50, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000065"), TenantId = tenantId, Name = "Fita Biscuits Plain 30g", Price = 8.50m, Cost = 6.50m, Barcode = "4800016011019", Category = "Biscuits & Bakery", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000068"), TenantId = tenantId, Name = "Fudgee Barr Chocolate Cake Bar 38g", Price = 11.00m, Cost = 8.50m, Barcode = "4800111022013", Category = "Biscuits & Bakery", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000075"), TenantId = tenantId, Name = "Piattos Cheese Potato Crisps 85g", Price = 38.00m, Cost = 32.00m, Barcode = "4800016053330", Category = "Snacks & Chips", StockQty = 18, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000078"), TenantId = tenantId, Name = "Chippy Barbecue Corn Chips 110g", Price = 33.00m, Cost = 27.00m, Barcode = "4800016051107", Category = "Snacks & Chips", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },

            // Candies (2)
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000087"), TenantId = tenantId, Name = "Maxx Menthol Candy Cherry 1 pc", Price = 2.00m, Cost = 1.20m, Barcode = "4800016071013", Category = "Candies & Sweets", StockQty = 100, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000092"), TenantId = tenantId, Name = "Dynamite Choco Filled Mint Candy 1 pc", Price = 2.00m, Cost = 1.20m, Barcode = "4800016072010", Category = "Candies & Sweets", StockQty = 100, UpdatedAt = DateTimeOffset.UtcNow },

            // Personal Care (5)
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000095"), TenantId = tenantId, Name = "Sunsilk Shampoo Smooth & Manageable Pink 13ml", Price = 8.00m, Cost = 6.25m, Barcode = "4800888138763", Category = "Personal Care", StockQty = 60, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000097"), TenantId = tenantId, Name = "Cream Silk Conditioner Standout Straight Pink 11ml", Price = 8.50m, Cost = 6.50m, Barcode = "4800888139012", Category = "Personal Care", StockQty = 60, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000099"), TenantId = tenantId, Name = "Head & Shoulders Cool Menthol Anti-Dandruff 12ml", Price = 9.00m, Cost = 7.00m, Barcode = "4902430588669", Category = "Personal Care", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000101"), TenantId = tenantId, Name = "Safeguard Pure White Bar Soap 60g", Price = 26.00m, Cost = 22.00m, Barcode = "4902430401821", Category = "Personal Care", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000104"), TenantId = tenantId, Name = "Colgate Maximum Cavity Protection Great Regular Flavor 20g", Price = 11.00m, Cost = 8.50m, Barcode = "4800045130019", Category = "Personal Care", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },

            // Laundry & Household Care (5)
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000109"), TenantId = tenantId, Name = "Surf Powder Blossom Fresh Detergent 60g", Price = 9.50m, Cost = 7.50m, Barcode = "4800888147055", Category = "Laundry Care", StockQty = 60, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000111"), TenantId = tenantId, Name = "Ariel Sunrise Fresh Detergent Powder 66g", Price = 15.00m, Cost = 12.00m, Barcode = "4902430721011", Category = "Laundry Care", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000114"), TenantId = tenantId, Name = "Downy Fabric Conditioner Sunrise Fresh 25ml", Price = 9.00m, Cost = 7.25m, Barcode = "4902430737081", Category = "Laundry Care", StockQty = 60, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000118"), TenantId = tenantId, Name = "Joy Dishwashing Liquid Kalamansi 20ml", Price = 6.50m, Cost = 5.00m, Barcode = "4902430741026", Category = "Household Care", StockQty = 50, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000120"), TenantId = tenantId, Name = "Zonrox Bleach Original 250ml", Price = 26.00m, Cost = 21.50m, Barcode = "4800194170014", Category = "Household Care", StockQty = 15, UpdatedAt = DateTimeOffset.UtcNow },

            // Alcohol & Tobacco (4)
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000121"), TenantId = tenantId, Name = "San Miguel Pale Pilsen Beer 320ml", Price = 55.00m, Cost = 48.00m, Barcode = "4800088100018", Category = "Alcohol & Beverages", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000122"), TenantId = tenantId, Name = "Red Horse Beer Extra Strong 500ml", Price = 68.00m, Cost = 58.00m, Barcode = "4800088100117", Category = "Alcohol & Beverages", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000124"), TenantId = tenantId, Name = "Ginebra San Miguel Bilog 350ml", Price = 65.00m, Cost = 55.00m, Barcode = "4800088200015", Category = "Alcohol & Beverages", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000137"), TenantId = tenantId, Name = "Marlboro Red Single Stick (Tingi) 1 stick", Price = 10.00m, Cost = 8.50m, Barcode = "2000000000091", Category = "Tobacco", StockQty = 100, UpdatedAt = DateTimeOffset.UtcNow },

            // Staples & Tingi Produce (5)
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000129"), TenantId = tenantId, Name = "Fresh Chicken Egg Medium (Tingi) 1 pc", Price = 9.00m, Cost = 7.00m, Barcode = "2000000000015", Category = "Fresh Produce & Tingi", StockQty = 60, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000130"), TenantId = tenantId, Name = "White Refined Sugar Repacked (Tingi) 1/4 kg", Price = 23.00m, Cost = 18.00m, Barcode = "2000000000022", Category = "Staples & Tingi", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000132"), TenantId = tenantId, Name = "Cooking Oil Palm Repacked Supot (Tingi) 250ml", Price = 25.00m, Cost = 19.00m, Barcode = "2000000000046", Category = "Staples & Tingi", StockQty = 25, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000135"), TenantId = tenantId, Name = "Tubig na Yelo / Mineral Ice Bag (Tingi) 1 bag", Price = 3.00m, Cost = 1.50m, Barcode = "2000000000077", Category = "Staples & Tingi", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
            new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000136"), TenantId = tenantId, Name = "Dinorado / Sinandomeng Rice 1kg (Tingi) 1 kg", Price = 56.00m, Cost = 48.00m, Barcode = "2000000000084", Category = "Staples & Tingi", StockQty = 50, UpdatedAt = DateTimeOffset.UtcNow },
        };

            var productsToAdd = products.Where(p => !existingProductIdsSet.Contains(p.Id)).ToList();
            if (productsToAdd.Count > 0)
            {
                context.Products.AddRange(productsToAdd);
                await context.SaveChangesAsync();
            }

        // Check if Customers exist
        var customer1Id = Guid.Parse("33333333-3333-3333-3333-333333333331");
        var customer2Id = Guid.Parse("33333333-3333-3333-3333-333333333332");
        var customer3Id = Guid.Parse("33333333-3333-3333-3333-333333333333");

        if (!await context.Customers.IgnoreQueryFilters().AnyAsync(c => c.TenantId == tenantId))
        {
            var customer1 = new Customer
            {
                Id = customer1Id,
                TenantId = tenantId,
                Name = "Mang Juan Cruz",
                Phone = "09181112233",
                TotalUtangBalance = 240.00m,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            var customer2 = new Customer
            {
                Id = customer2Id,
                TenantId = tenantId,
                Name = "Aling Rosa Santos",
                Phone = "09204445566",
                TotalUtangBalance = 150.00m,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            var customer3 = new Customer
            {
                Id = customer3Id,
                TenantId = tenantId,
                Name = "Kagawad Benjie",
                Phone = "09178889900",
                TotalUtangBalance = 0.00m,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            context.Customers.AddRange(customer1, customer2, customer3);

            // Add sample UtangLedger entries
            context.UtangLedgers.AddRange(
                new UtangLedger
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CustomerId = customer1Id,
                    Amount = 240.00m,
                    Type = "Credit",
                    Date = DateTimeOffset.UtcNow.AddDays(-2),
                    Notes = "2x Pancit Canton, 1x Coke 1.5L, 2x Kopiko"
                },
                new UtangLedger
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    CustomerId = customer2Id,
                    Amount = 150.00m,
                    Type = "Credit",
                    Date = DateTimeOffset.UtcNow.AddDays(-1),
                    Notes = "Marlboro pack & Skyflakes"
                }
            );

            // Sample GCash
            context.GCashTransactions.AddRange(
                new GCashTxn
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Type = "CashIn",
                    Amount = 1000.00m,
                    Fee = 15.00m,
                    RefNo = "901238471201",
                    RefNoNorm = GCashTxn.NormalizeRef("901238471201"),
                    CustomerPhone = "09175551234",
                    Date = DateTimeOffset.UtcNow.AddHours(-3),
                    Notes = "Express send cash in"
                },
                new GCashTxn
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Type = "CashOut",
                    Amount = 500.00m,
                    Fee = 10.00m,
                    RefNo = "901238992341",
                    RefNoNorm = GCashTxn.NormalizeRef("901238992341"),
                    CustomerPhone = "09287779911",
                    Date = DateTimeOffset.UtcNow.AddHours(-1),
                    Notes = "Cash out payout"
                }
            );

            await context.SaveChangesAsync();
        }
    }
}
