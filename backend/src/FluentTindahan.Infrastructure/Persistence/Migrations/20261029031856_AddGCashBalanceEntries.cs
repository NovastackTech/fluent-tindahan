using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FluentTindahan.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGCashBalanceEntries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GCashBalanceEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CashDelta = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    WalletDelta = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    Date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    OpeningEntryId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GCashBalanceEntries", x => x.Id);
                    table.CheckConstraint("CK_GCashBalanceEntries_Amounts", "ABS(\"CashDelta\") <= 10000000 AND ABS(\"WalletDelta\") <= 10000000");
                    table.CheckConstraint("CK_GCashBalanceEntries_Kind", "\"Kind\" IN ('Opening', 'Adjustment')");
                    table.CheckConstraint("CK_GCashBalanceEntries_Shape", "(\"Kind\" = 'Opening' AND \"CashDelta\" >= 0 AND \"WalletDelta\" >= 0 AND \"OpeningEntryId\" IS NULL) OR (\"Kind\" = 'Adjustment' AND \"OpeningEntryId\" IS NOT NULL AND ((\"CashDelta\" <> 0 AND \"WalletDelta\" = 0) OR (\"CashDelta\" = 0 AND \"WalletDelta\" <> 0)) AND BTRIM(\"Reason\") <> '')");
                    table.ForeignKey(
                        name: "FK_GCashBalanceEntries_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GCashBalanceEntries_TenantId_Date",
                table: "GCashBalanceEntries",
                columns: new[] { "TenantId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_GCashBalanceEntries_TenantId_Opening",
                table: "GCashBalanceEntries",
                column: "TenantId",
                unique: true,
                filter: "\"Kind\" = 'Opening'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GCashBalanceEntries");
        }
    }
}
