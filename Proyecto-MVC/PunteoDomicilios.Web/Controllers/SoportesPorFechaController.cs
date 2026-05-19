using System.IO.Compression;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using PunteoDomicilios.Web.Repositories;
using PunteoDomicilios.Web.Services;

namespace PunteoDomicilios.Web.Controllers;

[Route("soportes-por-fecha")]
public class SoportesPorFechaController : Controller
{
    private readonly IFacturaPorFechaRepository _repo;
    private readonly ISoporteApiService _soporteApiService;
    private readonly IDescargaService _descargaService;
    private readonly ILogger<SoportesPorFechaController> _logger;

    public SoportesPorFechaController(
        IFacturaPorFechaRepository repo,
        ISoporteApiService soporteApiService,
        IDescargaService descargaService,
        ILogger<SoportesPorFechaController> logger)
    {
        _repo = repo;
        _soporteApiService = soporteApiService;
        _descargaService = descargaService;
        _logger = logger;
    }

    // GET /soportes-por-fecha
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
    /// Nombres de cartera (TIPOCAR) para el filtro del formulario.
    /// GET /api/soportes-por-fecha/tipos-cartera
    /// </summary>
    [HttpGet("/api/soportes-por-fecha/tipos-cartera")]
    public async Task<IActionResult> ObtenerTiposCartera(CancellationToken ct)
    {
        var usuario = HttpContext.Session.GetString(SessionKeys.Usuario);
        if (string.IsNullOrEmpty(usuario))
            return Unauthorized(new { error = "Sesión no iniciada." });

        var nombres = await _repo.ObtenerNombresCarteraAsync(ct);
        return Json(nombres);
    }

    /// <summary>
    /// Retorna las facturas del ERP para una fecha y cartera.
    /// GET /api/soportes-por-fecha/facturas?fecha=2026-05-06&amp;nombreCartera=...
    /// </summary>
    [HttpGet("/api/soportes-por-fecha/facturas")]
    public async Task<IActionResult> ObtenerFacturas(
        [FromQuery] DateOnly fecha,
        [FromQuery] string nombreCartera,
        CancellationToken ct)
    {
        var usuario = HttpContext.Session.GetString(SessionKeys.Usuario);
        if (string.IsNullOrEmpty(usuario))
            return Unauthorized(new { error = "Sesión no iniciada." });

        if (string.IsNullOrWhiteSpace(nombreCartera))
            return BadRequest(new { error = "Selecciona un tipo de cartera." });

        _logger.LogInformation(
            "ConsultaFacturasPorFecha | Usuario={Usuario} | Fecha={Fecha} | Cartera={Cartera}",
            usuario, fecha, nombreCartera.Trim());

        try
        {
            var facturas = await _repo.ObtenerFacturasPorFechaAsync(fecha, nombreCartera, ct);
            return Json(facturas);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Streaming NDJSON: emite un resultado por cada clave (TIPODCTO+TIPODC) conforme se resuelve.
    /// POST /api/soportes-por-fecha/soporte-batch-stream  body: ["FMF315307", ...]
    /// </summary>
    [HttpPost("/api/soportes-por-fecha/soporte-batch-stream")]
    public async Task StreamSoporteBatch([FromBody] List<string> clavesDocumento, CancellationToken ct)
    {
        var usuario = HttpContext.Session.GetString(SessionKeys.Usuario);
        if (string.IsNullOrEmpty(usuario))
        {
            Response.StatusCode = 401;
            return;
        }

        if (clavesDocumento is null || clavesDocumento.Count == 0)
        {
            Response.StatusCode = 400;
            return;
        }

        Response.ContentType = "application/x-ndjson; charset=utf-8";

        var bufferingFeature = Response.HttpContext.Features
            .Get<Microsoft.AspNetCore.Http.Features.IHttpResponseBodyFeature>();
        bufferingFeature?.DisableBuffering();

        var jsonOpts = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

        try
        {
            await foreach (var resultado in _soporteApiService.ConsultarBatchStreamAsync(clavesDocumento, ct))
            {
                if (ct.IsCancellationRequested) break;
                var line = JsonSerializer.Serialize(resultado, jsonOpts) + "\n";
                await Response.WriteAsync(line, Encoding.UTF8, CancellationToken.None);
                await Response.Body.FlushAsync(CancellationToken.None);
                if (ct.IsCancellationRequested) break;
            }
        }
        catch (OperationCanceledException)
        {
            // El cliente canceló — comportamiento esperado.
        }
    }

    /// <summary>
    /// Proxy de descarga individual.
    /// GET /api/soportes-por-fecha/descargar?path=soportes/2026/05/FMF315307.pdf
    /// </summary>
    [HttpGet("/api/soportes-por-fecha/descargar")]
    public async Task<IActionResult> Descargar([FromQuery] string path, CancellationToken ct)
    {
        var usuario = HttpContext.Session.GetString(SessionKeys.Usuario);
        if (string.IsNullOrEmpty(usuario))
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(path) || path.Contains("..") || path.Contains('\\'))
            return BadRequest("Ruta no válida.");

        var stream = await _descargaService.ObtenerArchivoAsync(path, ct);
        if (stream is null)
            return NotFound("No se pudo obtener el archivo.");

        var fileName = Path.GetFileName(path);
        return File(stream, "application/pdf", fileName);
    }

    /// <summary>
    /// Descarga múltiples PDFs empaquetados en ZIP.
    /// POST /api/soportes-por-fecha/descargar-zip  body: ["soportes/...", ...]
    /// </summary>
    [HttpPost("/api/soportes-por-fecha/descargar-zip")]
    public async Task<IActionResult> DescargarZip([FromBody] List<string> paths, CancellationToken ct)
    {
        var usuario = HttpContext.Session.GetString(SessionKeys.Usuario);
        if (string.IsNullOrEmpty(usuario))
            return Unauthorized(new { error = "Sesión no iniciada." });

        if (paths is null || paths.Count == 0)
            return BadRequest(new { error = "Lista de rutas vacía." });

        if (paths.Any(p => string.IsNullOrWhiteSpace(p) || p.Contains("..") || p.Contains('\\')))
            return BadRequest(new { error = "Rutas no válidas." });

        using var mem = new MemoryStream();
        using (var zip = new ZipArchive(mem, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var path in paths.Distinct())
            {
                if (ct.IsCancellationRequested) break;

                var pdfStream = await _descargaService.ObtenerArchivoAsync(path, ct);
                if (pdfStream is null)
                {
                    _logger.LogWarning("ZIP SPF: no se pudo obtener {Path}", path);
                    continue;
                }

                var entry = zip.CreateEntry(Path.GetFileName(path), CompressionLevel.Fastest);
                await using var entryStream = entry.Open();
                await pdfStream.CopyToAsync(entryStream, ct);
            }
        }

        mem.Position = 0;
        var zipName = $"soportes_fecha_{DateTime.Now:yyyyMMdd_HHmm}.zip";
        return File(mem.ToArray(), "application/zip", zipName);
    }
}
