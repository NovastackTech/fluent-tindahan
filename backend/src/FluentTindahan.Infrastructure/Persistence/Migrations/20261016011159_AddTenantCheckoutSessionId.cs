using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FluentTindahan.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantCheckoutSessionId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CheckoutSessionId",
                table: "Tenants",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CheckoutSessionId",
                table: "Tenants");
        }
    }
}
