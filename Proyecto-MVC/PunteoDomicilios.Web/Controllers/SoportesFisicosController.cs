using Microsoft.AspNetCore.Mvc;
using PunteoDomicilios.Web.DTOs;
using PunteoDomicilios.Web.Services;

namespace PunteoDomicilios.Web.Controllers;

[Route("soportes-fisicos")]
public class SoportesFisicosController : Controller
{
    private readonly ISoporteDatosService _datos;
    private readonly ISoporteFisicoService _fisico;
    private readonly ILogger<SoportesFisicosController> _logger;

    private static readonly string[] _extensionesPermitidas = [".pdf"];

    public SoportesFisicosController(
        ISoporteDatosService datos,
        ISoporteFisicoService fisico,
        ILogger<SoportesFisicosController> logger)
    {
        _datos = datos;
        _fisico = fisico;
        _logger = logger;
    }

    // GET /soportes-fisicos
    [HttpGet("")]
    public IActionResult Index()
    {
        var usuario = HttpContext.Session.GetString(SessionKeys.Usuario);
        if (string.IsNullOrEmpty(usuario))
            return RedirectToAction("Index", "Login");

        ViewBag.Usuario = usuario;
        return View();
    }

    // POST /soportes-fisicos/procesar
    [HttpPost("procesar")]
    [RequestSizeLimit(100 * 1024 * 1024)] // 100 MB máximo total
    public async Task<IActionResult> Procesar(ProcesarManualDto modelo, CancellationToken ct)
    {
        var usuario = HttpContext.Session.GetString(SessionKeys.Usuario);
        if (string.IsNullOrEmpty(usuario))
            return RedirectToAction("Index", "Login");

        ViewBag.Usuario = usuario;

        var resultados = new List<(string Soporte, string NombreArchivo, bool Exito, string Mensaje)>();

        if (modelo.Items is not { Count: > 0 })
        {
            ViewBag.Resultados = resultados;
            ModelState.AddModelError(string.Empty, "No se enviaron ítems para procesar.");
            return View("Index");
        }

        foreach (var item in modelo.Items)
        {
            // ── Validación básica ────────────────────────────────────────────
            var idSoporte = item.Soporte?.Trim() ?? string.Empty;
            var nombreArchivo = item.Archivo?.FileName?.Trim() ?? string.Empty;

            if (string.IsNullOrEmpty(idSoporte))
            {
                resultados.Add((idSoporte, nombreArchivo, false, "ID de soporte vacío"));
                continue;
            }

            if (item.Archivo is null || item.Archivo.Length == 0)
            {
                resultados.Add((idSoporte, nombreArchivo, false, "Archivo no adjuntado"));
                continue;
            }

            var ext = Path.GetExtension(item.Archivo.FileName).ToLowerInvariant();
            if (!_extensionesPermitidas.Contains(ext))
            {
                resultados.Add((idSoporte, nombreArchivo, false, $"Formato no permitido: {ext}. Solo se acepta PDF."));
                continue;
            }

            // ── FASE 1: Guardar PDF en ruta temporal ─────────────────────────
            var rutaTemp = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString() + ext);
            try
            {
                await using var fs = new FileStream(rutaTemp, FileMode.Create, FileAccess.Write);
                await item.Archivo.CopyToAsync(fs, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ErrorGuardandoTemp | Soporte={Soporte}", idSoporte);
                resultados.Add((idSoporte, nombreArchivo, false, "Error guardando archivo temporal"));
                continue;
            }

            try
            {
                // ── FASE 2: Consultar datos clínicos (API #1) ────────────────
                var (datos, msnDatos) = await _datos.ObtenerDatosAsync(idSoporte, ct);

                if (datos is null)
                {
                    _logger.LogInformation("SoporteSinDatos | Soporte={Soporte} | Detalle={Detalle}", idSoporte, msnDatos);
                    resultados.Add((idSoporte, nombreArchivo, false, "No se encontraron soportes para el valor consultado."));
                    continue;
                }

                // ── FASE 3: Enviar soporte físico (API #2) ───────────────────
                var (exito, msnFisico) = await _fisico.EnviarAsync(
                    idSoporte, rutaTemp, item.Archivo.FileName, datos, ct);

                resultados.Add((idSoporte, nombreArchivo, exito, msnFisico));
            }
            finally
            {
                // ── Limpieza del archivo temporal (siempre) ──────────────────
                if (System.IO.File.Exists(rutaTemp))
                {
                    try { System.IO.File.Delete(rutaTemp); }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "ErrorBorrandoTemp | Ruta={Ruta}", rutaTemp);
                    }
                }
            }
        }

        ViewBag.Resultados = resultados;
        return View("Index");
    }
}
