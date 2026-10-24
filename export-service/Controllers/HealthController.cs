using Microsoft.AspNetCore.Mvc;

namespace ExportService.Controllers
{
    [ApiController]
    [Route("health")]
    public class HealthController : ControllerBase
    {
        /// <summary>
        /// Проверка состояния сервиса
        /// </summary>
        /// <returns>Статус сервиса</returns>
        [HttpGet]
        public IActionResult Get()
        {
            return Ok(new { status = "ok" });
        }
    }
}
