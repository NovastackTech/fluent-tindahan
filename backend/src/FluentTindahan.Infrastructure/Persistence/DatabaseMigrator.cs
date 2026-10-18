using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FluentTindahan.Infrastructure.Persistence;

/// <summary>
/// Applies EF Core migrations. Databases created by the old <c>EnsureCreated()</c> bootstrap have no
/// <c>__EFMigrationsHistory</c> table; for those we record the pre-billing <c>InitialCreate</c> baseline as
/// already applied so that only the incremental migrations (with data backfills) run against them.
/// </summary>
public static class DatabaseMigrator
{
    public const string BaselineMigrationId = "20261010134157_InitialCreate";
    private const string EfProductVersion = "8.0.10";

    public static async Task MigrateAsync(AppDbContext db, ILogger logger, CancellationToken cancellationToken = default)
    {
        await db.Database.ExecuteSqlRawAsync($$"""
            DO $$
            BEGIN
                IF to_regclass('public."Tenants"') IS NOT NULL
                   AND to_regclass('public."__EFMigrationsHistory"') IS NULL THEN
                    CREATE TABLE "__EFMigrationsHistory" (
                        "MigrationId" character varying(150) NOT NULL,
                        "ProductVersion" character varying(32) NOT NULL,
                        CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
                    );
                    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                    VALUES ('{{BaselineMigrationId}}', '{{EfProductVersion}}');
                    RAISE NOTICE 'Baselined legacy EnsureCreated database.';
                END IF;
            END $$;
            """, cancellationToken);

        var pending = (await db.Database.GetPendingMigrationsAsync(cancellationToken)).ToList();
        if (pending.Count > 0)
        {
            logger.LogInformation("Applying {Count} pending migration(s): {Migrations}", pending.Count, string.Join(", ", pending));
        }

        await db.Database.MigrateAsync(cancellationToken);

        if (db.Database.IsRelational())
        {
            await db.Database.ExecuteSqlRawAsync("""
                UPDATE "Customers" c
                SET "TotalUtangBalance" = COALESCE(
                    (SELECT SUM(CASE WHEN u."Type" = 'Credit' THEN u."Amount" ELSE -u."Amount" END)
                     FROM "UtangLedgers" u
                     WHERE u."CustomerId" = c."Id"),
                    0
                )
                WHERE EXISTS (SELECT 1 FROM "UtangLedgers" u WHERE u."CustomerId" = c."Id");
                """, cancellationToken);
        }
    }
}
