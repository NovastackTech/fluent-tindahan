using Microsoft.EntityFrameworkCore;
using Npgsql;
using FluentTindahan.Domain.Entities;

namespace FluentTindahan.WebApi.Controllers.Helpers;

/// <summary>
/// Inspects database exceptions for PostgreSQL and generic unique constraint / unique index violations.
/// </summary>
public static class DbConstraintHelper
{
    /// <summary>
    /// Checks if a DbUpdateException represents a unique index violation on NormalizedEmail.
    /// </summary>
    public static bool IsUniqueEmailViolation(DbUpdateException exception)
    {
        for (Exception? current = exception; current != null; current = current.InnerException)
        {
            if (current is PostgresException postgresException
                && postgresException.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                if (string.IsNullOrEmpty(postgresException.ConstraintName) ||
                    postgresException.ConstraintName.Equals(User.NormalizedEmailUniqueIndexName, StringComparison.OrdinalIgnoreCase) ||
                    postgresException.ConstraintName.Contains("NormalizedEmail", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            var message = current.Message;
            if (message.Contains(User.NormalizedEmailUniqueIndexName, StringComparison.OrdinalIgnoreCase) ||
                (message.Contains("23505", StringComparison.OrdinalIgnoreCase) && message.Contains("NormalizedEmail", StringComparison.OrdinalIgnoreCase)) ||
                (message.Contains("duplicate key", StringComparison.OrdinalIgnoreCase) && message.Contains("NormalizedEmail", StringComparison.OrdinalIgnoreCase)))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// Checks if a DbUpdateException represents any general unique constraint violation.
    /// </summary>
    public static bool IsUniqueConstraintViolation(DbUpdateException exception)
    {
        for (Exception? current = exception; current != null; current = current.InnerException)
        {
            if (current is PostgresException postgresException
                && postgresException.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                return true;
            }

            var message = current.Message;
            if (message.Contains("23505", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("duplicate key", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("unique constraint", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }
}
