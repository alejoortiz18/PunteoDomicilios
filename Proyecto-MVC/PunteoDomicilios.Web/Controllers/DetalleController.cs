using Microsoft.AspNetCore.Mvc;
using PunteoDomicilios.Web.Services;

namespace PunteoDomicilios.Web.Controllers;

[Route("detalle")]
public class DetalleController : Controller
{
    private readonly IMensajeroService _mensajeroService;
    private readonly ISoporteApiService _soporteApiService;
    private readonly IDescargaService _descargaService;
    private readonly ILogger<DetalleController> _logger;

    public DetalleController(
        IMensajeroService mensajeroService,
        ISoporteApiService soporteApiService,
        IDescargaService descargaService,
        ILogger<DetalleController> logger)
    {
        _mensajeroService = mensajeroService;
        _soporteApiService = soporteApiService;
        _descargaService = descargaService;
        _logger = logger;
    }

    /// <summary>
    /// Vista de detalle del mes. URL: /detalle?mes=2026-05
    /// </summary>
    [HttpGet("")]
    public IActionResult Index([FromQuery] string mes)
    {
        var usuario = HttpContext.Session.GetString(SessionKeys.Usuario);
        if (string.IsNullOrEmpty(usuario))
            return RedirectToAction("Index", "Login");

        if (string.IsNullOrWhiteSpace(mes) || mes.Length != 7)
            return RedirectToAction("Index", "Dashboard");

        ViewBag.Usuario = usuario;
        ViewBag.Mes = mes;
        ViewBag.MesLabel = FormatMesLabel(mes);
        return View();
    }

    /// <summary>
    /// Días del mes con totales. GET /api/detalle/dias?mes=2026-05
    /// </summary>
    [HttpGet("/api/detalle/dias")]
    public async Task<IActionResult> ObtenerDias([FromQuery] string mes)
    {
        var usuario = HttpContext.Session.GetString(SessionKeys.Usuario);
        if (string.IsNullOrEmpty(usuario))
            return Unauthorized(new { error = "Sesión no iniciada." });

        if (string.IsNullOrWhiteSpace(mes))
            return BadRequest(new { error = "El parámetro mes es requerido (yyyy-MM)." });

        var dias = await _mensajeroService.ObtenerDiasDelMesAsync(usuario, mes);
        return Json(dias);
    }

    /// <summary>
    /// Registros de un día específico. GET /api/detalle/registros?fecha=2026-05-08
    /// </summary>
    [HttpGet("/api/detalle/registros")]
    public async Task<IActionResult> ObtenerRegistrosDia([FromQuery] DateOnly fecha)
    {
        var usuario = HttpContext.Session.GetString(SessionKeys.Usuario);
        if (string.IsNullOrEmpty(usuario))
            return Unauthorized(new { error = "Sesión no iniciada." });

        var registros = (await _mensajeroService.ObtenerRegistrosAsync(usuario, fecha)).ToList();
        var nrodctos = registros.Select(r => r.Nrodcto).Distinct().ToList();
        return Json(new { registros, nrodctos });
    }

    /// <summary>
    /// Consulta soporte para un Nrodcto individual. GET /api/detalle/soporte?nrodcto=K8227073
    /// </summary>
    [HttpGet("/api/detalle/soporte")]
    public async Task<IActionResult> ConsultarSoporte([FromQuery] string nrodcto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(nrodcto))
            return BadRequest(new { error = "Nrodcto requerido." });

        var resp = await _soporteApiService.ConsultarAsync(nrodcto, ct);
        if (resp is null)
            return Json(new { success = false, message = "Sin respuesta de API" });

        return Json(resp);
    }

    /// <summary>
    /// Proxy de descarga del PDF. GET /api/detalle/descargar?path=soportes/2026/05/...
    /// </summary>
    [HttpGet("/api/detalle/descargar")]
    public async Task<IActionResult> Descargar([FromQuery] string path, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(path) || path.Contains("..") || path.Contains('\\'))
            return BadRequest("Ruta no válida.");

        var stream = await _descargaService.ObtenerArchivoAsync(path, ct);
        if (stream is null)
            return NotFound("No se pudo obtener el archivo.");

        var fileName = Path.GetFileName(path);
        return File(stream, "application/pdf", fileName);
    }

    private static string FormatMesLabel(string mesISO)
    {
        var parts = mesISO.Split('-');
        if (parts.Length != 2) return mesISO;
        var nombres = new[] { "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                                  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre" };
        if (!int.TryParse(parts[1], out int m) || m < 1 || m > 12) return mesISO;
        return $"{nombres[m]} {parts[0]}";
    }
}
