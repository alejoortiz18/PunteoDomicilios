using Microsoft.AspNetCore.Mvc;
using PunteoDomicilios.Web.DTOs;
using PunteoDomicilios.Web.Services;

namespace PunteoDomicilios.Web.Controllers;

[Route("")]
public class DashboardController : Controller
{
    private readonly IMensajeroService _mensajeroService;
    private readonly ISoporteApiService _soporteApiService;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(
        IMensajeroService mensajeroService,
        ISoporteApiService soporteApiService,
        ILogger<DashboardController> logger)
    {
        _mensajeroService = mensajeroService;
        _soporteApiService = soporteApiService;
        _logger = logger;
    }

    [HttpGet("")]
    public IActionResult Index()
    {
        var usuario = HttpContext.Session.GetString(SessionKeys.Usuario);
        if (string.IsNullOrEmpty(usuario))
            return RedirectToAction("Index", "Login");

        ViewBag.Usuario = usuario;
        return View();
    }

    /// <summary>
    /// Resumen mensual del usuario: meses con total registros y planillas.
    /// </summary>
    [HttpGet("api/resumen-mensual")]
    public async Task<IActionResult> ObtenerResumenMensual()
    {
        var usuario = HttpContext.Session.GetString(SessionKeys.Usuario);
        if (string.IsNullOrEmpty(usuario))
            return Unauthorized(new { error = "Sesión no iniciada." });

        var data = await _mensajeroService.ObtenerResumenMensualAsync(usuario);
        return Json(data);
    }

    /// <summary>
    /// Registros filtrados por usuario (de sesión) y fecha.
    /// </summary>
    [HttpGet("api/registros")]
    public async Task<IActionResult> ObtenerRegistros(DateOnly fecha)
    {
        var usuario = HttpContext.Session.GetString(SessionKeys.Usuario);
        if (string.IsNullOrEmpty(usuario))
            return Unauthorized(new { error = "Sesión no iniciada." });

        var registros = (await _mensajeroService.ObtenerRegistrosAsync(usuario, fecha)).ToList();
        var nrodctos = registros.Select(r => r.Nrodcto).Distinct().ToList();
        var resumen = new MensajeroResumenDto(usuario, fecha, nrodctos.Count, 0, 0, 0);

        return Json(new { total = registros.Count, registros, resumen, nrodctos });
    }

    /// <summary>
    /// Consulta la API de soporte en batch para la lista de Nrodctos.
    /// </summary>
    [HttpPost("api/consultar-batch")]
    public async Task<IActionResult> ConsultarBatch(
        [FromBody] List<string> nrodctos,
        CancellationToken ct)
    {
        if (nrodctos is null || nrodctos.Count == 0)
            return BadRequest(new { error = "Se requiere al menos un Nrodcto." });

        _logger.LogInformation("Batch para {Count} Nrodctos", nrodctos.Count);
        var resultados = await _soporteApiService.ConsultarBatchAsync(nrodctos, ct);
        return Json(resultados);
    }

    /// <summary>
    /// Timeline histórico de los últimos N días del usuario en sesión.
    /// </summary>
    [HttpGet("api/timeline")]
    public async Task<IActionResult> ObtenerTimeline(int dias = 7)
    {
        var usuario = HttpContext.Session.GetString(SessionKeys.Usuario);
        if (string.IsNullOrEmpty(usuario))
            return Unauthorized(new { error = "Sesión no iniciada." });

        var datos = await _mensajeroService.ObtenerTimelineAsync(usuario, dias);
        return Json(datos);
    }
}
