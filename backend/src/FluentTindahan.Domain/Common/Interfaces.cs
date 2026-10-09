namespace FluentTindahan.Domain.Common;

public interface IMustHaveTenant
{
    Guid TenantId { get; set; }
}

public interface IAuditableEntity
{
    DateTimeOffset CreatedAt { get; set; }
    DateTimeOffset? UpdatedAt { get; set; }
}
