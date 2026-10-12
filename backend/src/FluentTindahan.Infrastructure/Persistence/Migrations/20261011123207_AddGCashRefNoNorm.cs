using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FluentTindahan.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGCashRefNoNorm : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RefNoNorm",
                table: "GCashTransactions",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            // Backfill: the earliest row per (tenant, normalized ref) keeps the value; legacy
            // duplicates are left empty (exempt from the partial unique index).
            migrationBuilder.Sql(@"
                UPDATE ""GCashTransactions"" g
                SET ""RefNoNorm"" = lower(btrim(g.""RefNo""))
                FROM (
                    SELECT ""Id"",
                           ROW_NUMBER() OVER (
                               PARTITION BY ""TenantId"", lower(btrim(""RefNo""))
                               ORDER BY ""Date"", ""Id"") AS rn
                    FROM ""GCashTransactions""
                    WHERE btrim(""RefNo"") <> ''
                ) d
                WHERE g.""Id"" = d.""Id"" AND d.rn = 1;");

            migrationBuilder.CreateIndex(
                name: "IX_GCashTransactions_TenantId_RefNoNorm",
                table: "GCashTransactions",
                columns: new[] { "TenantId", "RefNoNorm" },
                unique: true,
                filter: "\"RefNoNorm\" <> ''");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_GCashTransactions_TenantId_RefNoNorm",
                table: "GCashTransactions");

            migrationBuilder.DropColumn(
                name: "RefNoNorm",
                table: "GCashTransactions");
        }
    }
}
