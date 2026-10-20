using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FluentTindahan.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserAccountDeletionLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AccountStatus",
                table: "Users",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "ACTIVE");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DeletionScheduledAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_AccountStatus_DeletionScheduledAt",
                table: "Users",
                columns: new[] { "AccountStatus", "DeletionScheduledAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_AccountStatus_DeletionScheduledAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "AccountStatus",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "DeletionScheduledAt",
                table: "Users");
        }
    }
}
