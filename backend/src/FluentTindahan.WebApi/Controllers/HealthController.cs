using Microsoft.AspNetCore.Mvc;

namespace FluentTindahan.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new
        {
            status = "Healthy",
            app = "Fluent Tindahan Backend Web API",
            timestamp = DateTimeOffset.UtcNow,
            version = "1.0.0"
        });
    }
}
