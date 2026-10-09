using System.Text.Json;

namespace FluentTindahan.Application.Sync.DTOs;

public class BatchSyncRequestDto
{
    public Guid DeviceId { get; set; }
    public List<SyncOperationDto> Operations { get; set; } = new();
}

public class SyncOperationDto
{
    public string SyncId { get; set; } = string.Empty;
    public string Entity { get; set; } = string.Empty; // "Product", "Customer", "Sale", "UtangLedger", "GCashTxn"
    public string Action { get; set; } = "Insert";     // "Insert", "Update", "Delete"
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
    public JsonElement Payload { get; set; }
}

public class BatchSyncResultDto
{
    public int ProcessedCount { get; set; }
    public List<SyncItemResultDto> Results { get; set; } = new();
}

public class SyncItemResultDto
{
    public string SyncId { get; set; } = string.Empty;
    public string Status { get; set; } = "Success"; // "Success", "Failed", "ConflictIgnored"
    public string? Error { get; set; }
}
