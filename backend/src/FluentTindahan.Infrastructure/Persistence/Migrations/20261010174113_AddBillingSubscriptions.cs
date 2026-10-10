using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FluentTindahan.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBillingSubscriptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Tier",
                table: "Tenants",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ExternalCustomerId",
                table: "Tenants",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "SubscriptionEndDate",
                table: "Tenants",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                table: "Tenants",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            // Backfill legacy free-text PlanTier into the strongly-typed Tier enum column
            migrationBuilder.Sql(@"UPDATE ""Tenants"" SET ""Tier"" = CASE ""PlanTier"" WHEN 'SariSariPro' THEN 1 WHEN 'TindahanPro' THEN 1 WHEN 'NegosyoPlus' THEN 2 ELSE 0 END;");

            migrationBuilder.DropColumn(
                name: "PlanTier",
                table: "Tenants");

            migrationBuilder.CreateTable(
                name: "PaymentHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    AmountCentavos = table.Column<long>(type: "bigint", nullable: false),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    TierPurchased = table.Column<int>(type: "integer", nullable: false),
                    BillingCycle = table.Column<int>(type: "integer", nullable: false),
                    GatewayReferenceId = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PaymentMethod = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PaymentHistories_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PaymentHistories_GatewayReferenceId",
                table: "PaymentHistories",
                column: "GatewayReferenceId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PaymentHistories_TenantId",
                table: "PaymentHistories",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentHistories_TenantId_CreatedAt",
                table: "PaymentHistories",
                columns: new[] { "TenantId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PaymentHistories");

            migrationBuilder.AddColumn<string>(
                name: "PlanTier",
                table: "Tenants",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Libre");

            migrationBuilder.Sql(@"UPDATE ""Tenants"" SET ""PlanTier"" = CASE ""Tier"" WHEN 1 THEN 'TindahanPro' WHEN 2 THEN 'NegosyoPlus' ELSE 'Libre' END;");

            migrationBuilder.DropColumn(
                name: "ExternalCustomerId",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "SubscriptionEndDate",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "Tier",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "xmin",
                table: "Tenants");
        }
    }
}
