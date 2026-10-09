using Microsoft.EntityFrameworkCore;
using FluentTindahan.Domain.Entities;
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
                PlanTier = "SariSariPro",
                CreatedAt = DateTimeOffset.UtcNow
            };
            context.Tenants.Add(tenant);
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
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000001"), TenantId = tenantId, Name = "Lucky Me! Instant Pancit Canton Kalamansi 80g", Price = 16.00m, Cost = 13.25m, Barcode = "4800016644026", Category = "Instant Noodles", StockQty = 36, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000002"), TenantId = tenantId, Name = "Lucky Me! Instant Pancit Canton Chili Mansi 80g", Price = 16.00m, Cost = 13.25m, Barcode = "4800016644040", Category = "Instant Noodles", StockQty = 36, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000003"), TenantId = tenantId, Name = "Lucky Me! Instant Pancit Canton Extra Hot 80g", Price = 16.00m, Cost = 13.25m, Barcode = "4800016644033", Category = "Instant Noodles", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000004"), TenantId = tenantId, Name = "Lucky Me! Instant Pancit Canton Original 80g", Price = 16.00m, Cost = 13.25m, Barcode = "4800016644019", Category = "Instant Noodles", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000005"), TenantId = tenantId, Name = "Lucky Me! Instant Pancit Canton Sweet & Spicy 80g", Price = 16.00m, Cost = 13.25m, Barcode = "4800016644057", Category = "Instant Noodles", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000006"), TenantId = tenantId, Name = "Lucky Me! Instant Mami Chicken 55g", Price = 13.00m, Cost = 10.50m, Barcode = "4800016601012", Category = "Instant Noodles", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000007"), TenantId = tenantId, Name = "Lucky Me! Instant Mami Beef 55g", Price = 13.00m, Cost = 10.50m, Barcode = "4800016601029", Category = "Instant Noodles", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000008"), TenantId = tenantId, Name = "Payless Instant Pancit Canton Extra Big Sweet & Spicy 130g", Price = 19.00m, Cost = 16.00m, Barcode = "4800016645122", Category = "Instant Noodles", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000009"), TenantId = tenantId, Name = "Payless Instant Pancit Canton Extra Big Kalamansi 130g", Price = 19.00m, Cost = 16.00m, Barcode = "4800016645115", Category = "Instant Noodles", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000010"), TenantId = tenantId, Name = "Nissin Cup Noodles Seafood 40g", Price = 26.00m, Cost = 21.50m, Barcode = "4800016681014", Category = "Instant Noodles", StockQty = 12, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000011"), TenantId = tenantId, Name = "Nissin Cup Noodles Beef 40g", Price = 26.00m, Cost = 21.50m, Barcode = "4800016681021", Category = "Instant Noodles", StockQty = 12, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000012"), TenantId = tenantId, Name = "Quickchow Instant Mami Beef 55g", Price = 11.00m, Cost = 9.00m, Barcode = "4807770270034", Category = "Instant Noodles", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000013"), TenantId = tenantId, Name = "Kopiko Blanca 3-in-1 Coffee 52g", Price = 15.00m, Cost = 12.20m, Barcode = "8996001414002", Category = "Coffee & Beverages", StockQty = 50, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000014"), TenantId = tenantId, Name = "Kopiko Black 3-in-1 Coffee 52g", Price = 15.00m, Cost = 12.20m, Barcode = "8996001414019", Category = "Coffee & Beverages", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000015"), TenantId = tenantId, Name = "Kopiko Brown 3-in-1 Coffee 53g", Price = 15.00m, Cost = 12.20m, Barcode = "8996001410264", Category = "Coffee & Beverages", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000016"), TenantId = tenantId, Name = "Kopiko Cappuccino with Choco Granules 25g", Price = 12.00m, Cost = 9.50m, Barcode = "8996001410141", Category = "Coffee & Beverages", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000017"), TenantId = tenantId, Name = "Nescafe Classic Pure Soluble Coffee 1.9g", Price = 4.50m, Cost = 3.25m, Barcode = "4800361287661", Category = "Coffee & Beverages", StockQty = 60, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000018"), TenantId = tenantId, Name = "Nescafe 3-in-1 Original Coffee 56g", Price = 15.00m, Cost = 12.50m, Barcode = "4800361384025", Category = "Coffee & Beverages", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000019"), TenantId = tenantId, Name = "Great Taste White 3-in-1 Coffee 50g", Price = 14.00m, Cost = 11.80m, Barcode = "4800016024101", Category = "Coffee & Beverages", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000020"), TenantId = tenantId, Name = "Great Taste Choco 3-in-1 Coffee 50g", Price = 14.00m, Cost = 11.80m, Barcode = "4800016024125", Category = "Coffee & Beverages", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000021"), TenantId = tenantId, Name = "Milo Activ-Go Chocolate Powder Drink 24g", Price = 12.00m, Cost = 9.25m, Barcode = "4800361341103", Category = "Coffee & Beverages", StockQty = 50, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000022"), TenantId = tenantId, Name = "Bear Brand Fortified Powdered Milk Drink 33g", Price = 14.00m, Cost = 11.50m, Barcode = "4800361376846", Category = "Milk & Dairy", StockQty = 60, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000023"), TenantId = tenantId, Name = "Birch Tree Full Cream Milk Powder 33g", Price = 12.00m, Cost = 9.50m, Barcode = "4800216411026", Category = "Milk & Dairy", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000024"), TenantId = tenantId, Name = "Alaska Fortified Powdered Milk Drink 30g", Price = 12.00m, Cost = 9.75m, Barcode = "4800110023400", Category = "Milk & Dairy", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000025"), TenantId = tenantId, Name = "Energen Cereal Drink Vanilla 80g", Price = 17.00m, Cost = 13.50m, Barcode = "8996001303108", Category = "Breakfast & Cereal", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000026"), TenantId = tenantId, Name = "Energen Cereal Drink Chocolate 80g", Price = 17.00m, Cost = 13.50m, Barcode = "8996001303207", Category = "Breakfast & Cereal", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000027"), TenantId = tenantId, Name = "Tang Powdered Juice Orange 20g", Price = 21.00m, Cost = 17.50m, Barcode = "4800024101108", Category = "Juices & Beverages", StockQty = 25, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000028"), TenantId = tenantId, Name = "Tang Powdered Juice Pineapple 20g", Price = 21.00m, Cost = 17.50m, Barcode = "4800024101207", Category = "Juices & Beverages", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000029"), TenantId = tenantId, Name = "Nestea Iced Tea Lemon Powder 25g", Price = 22.00m, Cost = 18.00m, Barcode = "4800361301017", Category = "Juices & Beverages", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000030"), TenantId = tenantId, Name = "C2 Cool & Clean Green Tea Apple 230ml", Price = 16.00m, Cost = 13.00m, Barcode = "4800016111016", Category = "Beverages", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000031"), TenantId = tenantId, Name = "C2 Cool & Clean Green Tea Lemon 230ml", Price = 16.00m, Cost = 13.00m, Barcode = "4800016111023", Category = "Beverages", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000032"), TenantId = tenantId, Name = "Coca-Cola Regular Mismo 290ml", Price = 20.00m, Cost = 16.00m, Barcode = "4801981100103", Category = "Beverages", StockQty = 36, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000033"), TenantId = tenantId, Name = "Sprite Mismo 290ml", Price = 20.00m, Cost = 16.00m, Barcode = "4801981100202", Category = "Beverages", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000034"), TenantId = tenantId, Name = "Royal Tru-Orange Mismo 290ml", Price = 20.00m, Cost = 16.00m, Barcode = "4801981100301", Category = "Beverages", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000035"), TenantId = tenantId, Name = "Mega Sardines in Tomato Sauce Green 155g", Price = 26.00m, Cost = 22.50m, Barcode = "4809011743015", Category = "Canned Goods", StockQty = 36, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000036"), TenantId = tenantId, Name = "Mega Sardines in Tomato Sauce Spicy Red 155g", Price = 26.00m, Cost = 22.50m, Barcode = "4809011743022", Category = "Canned Goods", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000037"), TenantId = tenantId, Name = "555 Sardines in Tomato Sauce 155g", Price = 25.00m, Cost = 21.00m, Barcode = "4800216111018", Category = "Canned Goods", StockQty = 36, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000038"), TenantId = tenantId, Name = "555 Sardines in Tomato Sauce Spicy 155g", Price = 25.00m, Cost = 21.00m, Barcode = "4800216111025", Category = "Canned Goods", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000039"), TenantId = tenantId, Name = "Ligo Sardines in Tomato Sauce 155g", Price = 27.00m, Cost = 23.00m, Barcode = "4800028111011", Category = "Canned Goods", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000040"), TenantId = tenantId, Name = "555 Fried Sardines Escabeche 155g", Price = 31.00m, Cost = 26.00m, Barcode = "4800216112107", Category = "Canned Goods", StockQty = 15, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000041"), TenantId = tenantId, Name = "Century Tuna Flakes in Oil 155g", Price = 40.00m, Cost = 34.00m, Barcode = "4800216212012", Category = "Canned Goods", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000042"), TenantId = tenantId, Name = "Century Tuna Flakes with Calamansi 155g", Price = 40.00m, Cost = 34.00m, Barcode = "4800216212036", Category = "Canned Goods", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000043"), TenantId = tenantId, Name = "Century Tuna Flakes Hot & Spicy 155g", Price = 40.00m, Cost = 34.00m, Barcode = "4800216212029", Category = "Canned Goods", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000044"), TenantId = tenantId, Name = "San Marino Corned Tuna 150g", Price = 41.00m, Cost = 35.00m, Barcode = "4800216223018", Category = "Canned Goods", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000045"), TenantId = tenantId, Name = "Argentina Corned Beef 150g", Price = 43.00m, Cost = 37.00m, Barcode = "4800216211015", Category = "Canned Goods", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000046"), TenantId = tenantId, Name = "Purefoods Corned Beef 150g", Price = 78.00m, Cost = 68.00m, Barcode = "4800088111014", Category = "Canned Goods", StockQty = 12, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000047"), TenantId = tenantId, Name = "CDO Karne Norte 150g", Price = 31.00m, Cost = 26.00m, Barcode = "4800168111019", Category = "Canned Goods", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000048"), TenantId = tenantId, Name = "Argentina Beef Loaf 150g", Price = 28.00m, Cost = 23.50m, Barcode = "4800216213019", Category = "Canned Goods", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000049"), TenantId = tenantId, Name = "Silver Swan Soy Sauce 100ml", Price = 7.00m, Cost = 5.50m, Barcode = "4800194110300", Category = "Condiments", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000050"), TenantId = tenantId, Name = "Silver Swan Cane Vinegar 100ml", Price = 6.50m, Cost = 5.00m, Barcode = "4800194120309", Category = "Condiments", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000051"), TenantId = tenantId, Name = "Datu Puti Soy Sauce 100ml", Price = 7.00m, Cost = 5.75m, Barcode = "4801981110034", Category = "Condiments", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000052"), TenantId = tenantId, Name = "Datu Puti White Vinegar 100ml", Price = 6.50m, Cost = 5.25m, Barcode = "4801981120033", Category = "Condiments", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000053"), TenantId = tenantId, Name = "Mang Tomas All-Around Sarsa 325g", Price = 40.00m, Cost = 34.00m, Barcode = "4801981130032", Category = "Condiments", StockQty = 15, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000054"), TenantId = tenantId, Name = "UFC Tomato Sauce 115g", Price = 16.50m, Cost = 13.50m, Barcode = "4801981140024", Category = "Condiments", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000055"), TenantId = tenantId, Name = "UFC Tamis-Anghang Banana Catsup 100g", Price = 12.50m, Cost = 10.00m, Barcode = "4801981140109", Category = "Condiments", StockQty = 25, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000056"), TenantId = tenantId, Name = "Maggi Magic Sarap All-in-One Seasoning 8g", Price = 6.00m, Cost = 4.25m, Barcode = "4800361361019", Category = "Seasonings", StockQty = 80, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000057"), TenantId = tenantId, Name = "Knorr Pork Broth Cube 10g", Price = 8.00m, Cost = 6.00m, Barcode = "4800888151014", Category = "Seasonings", StockQty = 60, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000058"), TenantId = tenantId, Name = "Knorr Chicken Broth Cube 10g", Price = 8.00m, Cost = 6.00m, Barcode = "4800888151021", Category = "Seasonings", StockQty = 60, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000059"), TenantId = tenantId, Name = "Knorr Sinigang sa Sampalok Mix Original 20g", Price = 18.00m, Cost = 14.50m, Barcode = "4800888152011", Category = "Seasonings", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000060"), TenantId = tenantId, Name = "Ajinomoto Monosodium Glutamate Umami Seasoning 45g", Price = 14.00m, Cost = 11.00m, Barcode = "4800055100101", Category = "Seasonings", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000061"), TenantId = tenantId, Name = "Crispy Fry Breading Mix Original 62g", Price = 18.00m, Cost = 14.50m, Barcode = "4800055120109", Category = "Seasonings", StockQty = 25, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000062"), TenantId = tenantId, Name = "Crispy Fry Breading Mix Spicy 62g", Price = 18.00m, Cost = 14.50m, Barcode = "4800055120208", Category = "Seasonings", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000063"), TenantId = tenantId, Name = "Rebisco Crackers Plain 32g", Price = 8.00m, Cost = 6.00m, Barcode = "4800111000011", Category = "Biscuits & Bakery", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000064"), TenantId = tenantId, Name = "SkyFlakes Crackers Plain 25g", Price = 8.50m, Cost = 6.50m, Barcode = "4800016010012", Category = "Biscuits & Bakery", StockQty = 50, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000065"), TenantId = tenantId, Name = "Fita Biscuits Plain 30g", Price = 8.50m, Cost = 6.50m, Barcode = "4800016011019", Category = "Biscuits & Bakery", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000066"), TenantId = tenantId, Name = "Hansel Mocha Sandwich Biscuit 31g", Price = 9.00m, Cost = 7.00m, Barcode = "4800111011017", Category = "Biscuits & Bakery", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000067"), TenantId = tenantId, Name = "Magic Creams Chocolate Sandwich 28g", Price = 9.00m, Cost = 7.00m, Barcode = "4800016012016", Category = "Biscuits & Bakery", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000068"), TenantId = tenantId, Name = "Fudgee Barr Chocolate Cake Bar 38g", Price = 11.00m, Cost = 8.50m, Barcode = "4800111022013", Category = "Biscuits & Bakery", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000069"), TenantId = tenantId, Name = "Fudgee Barr Salted Caramel Cake Bar 38g", Price = 11.00m, Cost = 8.50m, Barcode = "4800111022020", Category = "Biscuits & Bakery", StockQty = 25, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000070"), TenantId = tenantId, Name = "Lemon Square Cheese Cake 30g", Price = 12.00m, Cost = 9.00m, Barcode = "4806505011018", Category = "Biscuits & Bakery", StockQty = 25, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000071"), TenantId = tenantId, Name = "Choco Mucho Milk Chocolate Bar 33g", Price = 12.50m, Cost = 9.50m, Barcode = "4800111033019", Category = "Chocolates & Sweets", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000072"), TenantId = tenantId, Name = "Choco Mucho Dark Chocolate Bar 33g", Price = 12.50m, Cost = 9.50m, Barcode = "4800111033026", Category = "Chocolates & Sweets", StockQty = 25, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000073"), TenantId = tenantId, Name = "Presto Creams Peanut Butter Sandwich 30g", Price = 9.00m, Cost = 7.00m, Barcode = "4800016013013", Category = "Biscuits & Bakery", StockQty = 25, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000074"), TenantId = tenantId, Name = "Superstix Wafer Sticks Chocolate 55g", Price = 15.00m, Cost = 12.00m, Barcode = "4800111044015", Category = "Biscuits & Bakery", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000075"), TenantId = tenantId, Name = "Piattos Cheese Potato Crisps 85g", Price = 38.00m, Cost = 32.00m, Barcode = "4800016053330", Category = "Snacks & Chips", StockQty = 18, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000076"), TenantId = tenantId, Name = "Piattos Sour Cream & Onion 85g", Price = 38.00m, Cost = 32.00m, Barcode = "4800016053347", Category = "Snacks & Chips", StockQty = 18, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000077"), TenantId = tenantId, Name = "Nova Country Cheddar Multigrain Chips 78g", Price = 38.00m, Cost = 32.00m, Barcode = "4800016055105", Category = "Snacks & Chips", StockQty = 18, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000078"), TenantId = tenantId, Name = "Chippy Barbecue Corn Chips 110g", Price = 33.00m, Cost = 27.00m, Barcode = "4800016051107", Category = "Snacks & Chips", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000079"), TenantId = tenantId, Name = "Oishi Prawn Crackers Plain 60g", Price = 20.00m, Cost = 16.50m, Barcode = "4800194160015", Category = "Snacks & Chips", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000080"), TenantId = tenantId, Name = "Oishi Prawn Crackers Spicy 60g", Price = 20.00m, Cost = 16.50m, Barcode = "4800194160022", Category = "Snacks & Chips", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000081"), TenantId = tenantId, Name = "Oishi Pillows Chocolate Filled Cracker 38g", Price = 13.00m, Cost = 10.00m, Barcode = "4800194160107", Category = "Snacks & Chips", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000082"), TenantId = tenantId, Name = "Oishi Marty's Cracklin' Vegetarian Chicharon 90g", Price = 26.00m, Cost = 21.50m, Barcode = "4800194160206", Category = "Snacks & Chips", StockQty = 18, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000083"), TenantId = tenantId, Name = "Boy Bawang Cornick Garlic 100g", Price = 20.00m, Cost = 16.00m, Barcode = "4806502110011", Category = "Snacks & Chips", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000084"), TenantId = tenantId, Name = "Clover Chips Cheese 55g", Price = 16.00m, Cost = 13.00m, Barcode = "4800042110014", Category = "Snacks & Chips", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000085"), TenantId = tenantId, Name = "V-Cut Potato Chips Cheese 60g", Price = 33.00m, Cost = 27.00m, Barcode = "4800016054108", Category = "Snacks & Chips", StockQty = 18, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000086"), TenantId = tenantId, Name = "Roller Coaster Cheddar Cheese 85g", Price = 34.00m, Cost = 28.00m, Barcode = "4800016056102", Category = "Snacks & Chips", StockQty = 18, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000087"), TenantId = tenantId, Name = "Maxx Menthol Candy Cherry 1 pc", Price = 2.00m, Cost = 1.20m, Barcode = "4800016071013", Category = "Candies & Sweets", StockQty = 100, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000088"), TenantId = tenantId, Name = "Mentos Mint Chewy Dragees 37.5g", Price = 22.00m, Cost = 17.00m, Barcode = "8935001701016", Category = "Candies & Sweets", StockQty = 15, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000089"), TenantId = tenantId, Name = "Flat Tops Milk Chocolate 150g", Price = 58.00m, Cost = 48.00m, Barcode = "4800144110015", Category = "Chocolates & Sweets", StockQty = 12, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000090"), TenantId = tenantId, Name = "Curly Tops Milk Chocolate 150g", Price = 58.00m, Cost = 48.00m, Barcode = "4800144110022", Category = "Chocolates & Sweets", StockQty = 12, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000091"), TenantId = tenantId, Name = "Choc-Nut Peanut Milk Chocolate 16g", Price = 23.00m, Cost = 18.00m, Barcode = "4806501100016", Category = "Chocolates & Sweets", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000092"), TenantId = tenantId, Name = "Dynamite Choco Filled Mint Candy 1 pc", Price = 2.00m, Cost = 1.20m, Barcode = "4800016072010", Category = "Candies & Sweets", StockQty = 100, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000093"), TenantId = tenantId, Name = "Halls Mentho-Lyptus Extra Strong 1 pc", Price = 2.50m, Cost = 1.80m, Barcode = "4800024081011", Category = "Candies & Sweets", StockQty = 100, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000094"), TenantId = tenantId, Name = "Fox's Crystal Clear Fruits Candy 90g", Price = 40.00m, Cost = 32.00m, Barcode = "8992741911017", Category = "Candies & Sweets", StockQty = 10, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000095"), TenantId = tenantId, Name = "Sunsilk Shampoo Smooth & Manageable Pink 13ml", Price = 8.00m, Cost = 6.25m, Barcode = "4800888138763", Category = "Personal Care", StockQty = 60, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000096"), TenantId = tenantId, Name = "Sunsilk Shampoo Strong & Long Green 13ml", Price = 8.00m, Cost = 6.25m, Barcode = "4800888138770", Category = "Personal Care", StockQty = 50, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000097"), TenantId = tenantId, Name = "Cream Silk Conditioner Standout Straight Pink 11ml", Price = 8.50m, Cost = 6.50m, Barcode = "4800888139012", Category = "Personal Care", StockQty = 60, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000098"), TenantId = tenantId, Name = "Cream Silk Conditioner Hair Fall Defense Green 11ml", Price = 8.50m, Cost = 6.50m, Barcode = "4800888139029", Category = "Personal Care", StockQty = 50, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000099"), TenantId = tenantId, Name = "Head & Shoulders Cool Menthol Anti-Dandruff 12ml", Price = 9.00m, Cost = 7.00m, Barcode = "4902430588669", Category = "Personal Care", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000100"), TenantId = tenantId, Name = "Palmolive Naturals Shampoo Intensive Moisture Pink 15ml", Price = 8.00m, Cost = 6.25m, Barcode = "4800045110011", Category = "Personal Care", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000101"), TenantId = tenantId, Name = "Safeguard Pure White Bar Soap 60g", Price = 26.00m, Cost = 22.00m, Barcode = "4902430401821", Category = "Personal Care", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000102"), TenantId = tenantId, Name = "Safeguard Lemon Fresh Bar Soap 60g", Price = 26.00m, Cost = 22.00m, Barcode = "4902430401838", Category = "Personal Care", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000103"), TenantId = tenantId, Name = "Palmolive Naturals White Bar Soap with Milk 55g", Price = 22.00m, Cost = 18.00m, Barcode = "4800045120010", Category = "Personal Care", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000104"), TenantId = tenantId, Name = "Colgate Maximum Cavity Protection Great Regular Flavor 20g", Price = 11.00m, Cost = 8.50m, Barcode = "4800045130019", Category = "Personal Care", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000105"), TenantId = tenantId, Name = "Close Up Deep Action Red Hot Toothpaste 20g", Price = 11.00m, Cost = 8.50m, Barcode = "4800888131016", Category = "Personal Care", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000106"), TenantId = tenantId, Name = "Whisper Regular Flow Non-Wing Sanitary Pad 1 pc", Price = 9.00m, Cost = 7.00m, Barcode = "4902430211017", Category = "Personal Care", StockQty = 50, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000107"), TenantId = tenantId, Name = "Modess Cottony Soft Maxi Regular Non-Wing Pad 1 pc", Price = 8.50m, Cost = 6.50m, Barcode = "4800032110017", Category = "Personal Care", StockQty = 50, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000108"), TenantId = tenantId, Name = "Eskinol Spot-less White Facial Deep Cleanser 75ml", Price = 46.00m, Cost = 39.00m, Barcode = "4800888140018", Category = "Personal Care", StockQty = 12, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000109"), TenantId = tenantId, Name = "Surf Powder Blossom Fresh Detergent 60g", Price = 9.50m, Cost = 7.50m, Barcode = "4800888147055", Category = "Laundry Care", StockQty = 60, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000110"), TenantId = tenantId, Name = "Surf Powder Cherry Blossom Detergent 60g", Price = 9.50m, Cost = 7.50m, Barcode = "4800888147062", Category = "Laundry Care", StockQty = 50, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000111"), TenantId = tenantId, Name = "Ariel Sunrise Fresh Detergent Powder 66g", Price = 15.00m, Cost = 12.00m, Barcode = "4902430721011", Category = "Laundry Care", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000112"), TenantId = tenantId, Name = "Tide Perfect Clean Detergent Powder Garden Bloom 66g", Price = 14.50m, Cost = 11.50m, Barcode = "4902430711012", Category = "Laundry Care", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000113"), TenantId = tenantId, Name = "Breeze Power Clean Detergent Powder 66g", Price = 14.50m, Cost = 11.50m, Barcode = "4800888148014", Category = "Laundry Care", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000114"), TenantId = tenantId, Name = "Downy Fabric Conditioner Sunrise Fresh 25ml", Price = 9.00m, Cost = 7.25m, Barcode = "4902430737081", Category = "Laundry Care", StockQty = 60, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000115"), TenantId = tenantId, Name = "Downy Fabric Conditioner Passion 25ml", Price = 9.00m, Cost = 7.25m, Barcode = "4902430737098", Category = "Laundry Care", StockQty = 50, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000116"), TenantId = tenantId, Name = "Surf Fabric Conditioner Charcoal Fresh 25ml", Price = 8.00m, Cost = 6.50m, Barcode = "4800888149011", Category = "Laundry Care", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000117"), TenantId = tenantId, Name = "Joy Dishwashing Liquid Lemon Refill 185ml", Price = 42.00m, Cost = 36.00m, Barcode = "4902430741019", Category = "Household Care", StockQty = 15, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000118"), TenantId = tenantId, Name = "Joy Dishwashing Liquid Kalamansi 20ml", Price = 6.50m, Cost = 5.00m, Barcode = "4902430741026", Category = "Household Care", StockQty = 50, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000119"), TenantId = tenantId, Name = "Champion Detergent Bar Blue Regular 130g", Price = 17.00m, Cost = 14.00m, Barcode = "4800021110011", Category = "Laundry Care", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000120"), TenantId = tenantId, Name = "Zonrox Bleach Original 250ml", Price = 26.00m, Cost = 21.50m, Barcode = "4800194170014", Category = "Household Care", StockQty = 15, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000121"), TenantId = tenantId, Name = "San Miguel Pale Pilsen Beer 320ml", Price = 55.00m, Cost = 48.00m, Barcode = "4800088100018", Category = "Alcohol & Beverages", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000122"), TenantId = tenantId, Name = "Red Horse Beer Extra Strong 500ml", Price = 68.00m, Cost = 58.00m, Barcode = "4800088100117", Category = "Alcohol & Beverages", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000123"), TenantId = tenantId, Name = "San Mig Light Beer 330ml", Price = 58.00m, Cost = 50.00m, Barcode = "4800088100216", Category = "Alcohol & Beverages", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000124"), TenantId = tenantId, Name = "Ginebra San Miguel Bilog 350ml", Price = 65.00m, Cost = 55.00m, Barcode = "4800088200015", Category = "Alcohol & Beverages", StockQty = 24, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000125"), TenantId = tenantId, Name = "Ginebra San Miguel Primera Light 750ml", Price = 135.00m, Cost = 115.00m, Barcode = "4800088200114", Category = "Alcohol & Beverages", StockQty = 12, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000126"), TenantId = tenantId, Name = "Marlboro Red Flip-Top Pack 20s", Price = 175.00m, Cost = 155.00m, Barcode = "4800008110010", Category = "Tobacco", StockQty = 10, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000127"), TenantId = tenantId, Name = "Marlboro Gold Flip-Top Pack 20s", Price = 175.00m, Cost = 155.00m, Barcode = "4800008110027", Category = "Tobacco", StockQty = 10, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000128"), TenantId = tenantId, Name = "Winston Red Box Pack 20s", Price = 155.00m, Cost = 135.00m, Barcode = "4800008210017", Category = "Tobacco", StockQty = 10, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000129"), TenantId = tenantId, Name = "Fresh Chicken Egg Medium (Tingi) 1 pc", Price = 9.00m, Cost = 7.00m, Barcode = "2000000000015", Category = "Fresh Produce & Tingi", StockQty = 60, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000130"), TenantId = tenantId, Name = "White Refined Sugar Repacked (Tingi) 1/4 kg", Price = 23.00m, Cost = 18.00m, Barcode = "2000000000022", Category = "Staples & Tingi", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000131"), TenantId = tenantId, Name = "Brown Washed Sugar Repacked (Tingi) 1/4 kg", Price = 21.00m, Cost = 16.00m, Barcode = "2000000000039", Category = "Staples & Tingi", StockQty = 30, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000132"), TenantId = tenantId, Name = "Cooking Oil Palm Repacked Supot (Tingi) 250ml", Price = 25.00m, Cost = 19.00m, Barcode = "2000000000046", Category = "Staples & Tingi", StockQty = 25, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000133"), TenantId = tenantId, Name = "Garlic Bawang Repacked (Tingi) 100g", Price = 18.00m, Cost = 14.00m, Barcode = "2000000000053", Category = "Fresh Produce & Tingi", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000134"), TenantId = tenantId, Name = "Red Onion Sibuyas Repacked (Tingi) 100g", Price = 22.00m, Cost = 16.00m, Barcode = "2000000000060", Category = "Fresh Produce & Tingi", StockQty = 20, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000135"), TenantId = tenantId, Name = "Tubig na Yelo / Mineral Ice Bag (Tingi) 1 bag", Price = 3.00m, Cost = 1.50m, Barcode = "2000000000077", Category = "Staples & Tingi", StockQty = 40, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000136"), TenantId = tenantId, Name = "Dinorado / Sinandomeng Rice 1kg (Tingi) 1 kg", Price = 56.00m, Cost = 48.00m, Barcode = "2000000000084", Category = "Staples & Tingi", StockQty = 50, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000137"), TenantId = tenantId, Name = "Marlboro Red Single Stick (Tingi) 1 stick", Price = 10.00m, Cost = 8.50m, Barcode = "2000000000091", Category = "Tobacco", StockQty = 100, UpdatedAt = DateTimeOffset.UtcNow },
                new() { Id = Guid.Parse("a1000000-0000-0000-0000-000000000138"), TenantId = tenantId, Name = "Winston Red Single Stick (Tingi) 1 stick", Price = 9.00m, Cost = 7.50m, Barcode = "2000000000107", Category = "Tobacco", StockQty = 100, UpdatedAt = DateTimeOffset.UtcNow },
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
                    CustomerPhone = "09287779911",
                    Date = DateTimeOffset.UtcNow.AddHours(-1),
                    Notes = "Cash out payout"
                }
            );

            await context.SaveChangesAsync();
        }
    }
}
