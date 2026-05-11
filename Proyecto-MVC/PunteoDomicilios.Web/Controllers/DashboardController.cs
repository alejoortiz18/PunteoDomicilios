using System.Text.Json;
using System.Threading.Channels;
using Microsoft.AspNetCore.Mvc;
using PunteoDomicilios.Web.DTOs;
using PunteoDomicilios.Web.Models;
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
    /// Consulta la API de soporte en streaming SSE, enviando un evento por cada Nrodcto
    /// procesado en paralelo. Permite que el cliente muestre el progreso en tiempo real.
    /// La concurrencia real está limitada por el semáforo de SoporteApiService (MaxConcurrentRequests).
    /// </summary>
    [HttpPost("api/consultar-stream")]
    public async Task ConsultarStream(
        [FromBody] List<string> nrodctos,
        CancellationToken ct)
    {
        if (nrodctos is null || nrodctos.Count == 0)
        {
            Response.StatusCode = 400;
            return;
        }

        Response.Headers["Content-Type"] = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        var lista = nrodctos.Distinct().ToList();
        int encontrados = 0, faltantes = 0, procesados = 0;

        // Canal para pasar eventos desde los workers paralelos al writer del response.
        var channel = Channel.CreateUnbounded<string>(
            new UnboundedChannelOptions { SingleReader = true, SingleWriter = false });

        // Producer: lanza consultas en paralelo. El semáforo en SoporteApiService
        // controla cuántas llamadas HTTP van simultáneamente (MaxConcurrentRequests).
        var producerTask = Task.Run(async () =>
        {
            try
            {
                await Parallel.ForEachAsync(lista, CancellationToken.None, async (nrodcto, _) =>
                {
                    var resp = await _soporteApiService.ConsultarAsync(nrodcto, CancellationToken.None);

                    int estadoInt;
                    if (resp is null)
                        estadoInt = (int)EstadoSoporte.Error;
                    else if (resp.Success && resp.Data is { Count: > 0 })
                    {
                        estadoInt = (int)EstadoSoporte.Encontrado;
                        Interlocked.Increment(ref encontrados);
                    }
                    else
                    {
                        estadoInt = (int)EstadoSoporte.Faltante;
                        Interlocked.Increment(ref faltantes);
                    }

                    var proc = Interlocked.Increment(ref procesados);
                    var enc  = Volatile.Read(ref encontrados);
                    var fal  = Volatile.Read(ref faltantes);

                    var evento = JsonSerializer.Serialize(new
                    {
                        tipo       = "resultado",
                        nrodcto,
                        estado     = estadoInt,
                        procesados = proc,
                        total      = lista.Count,
                        encontrados = enc,
                        faltantes   = fal
                    });

                    await channel.Writer.WriteAsync($"data: {evento}\n\n");
                });
            }
            finally
            {
                channel.Writer.Complete();
            }
        });

        // Consumer: escribe al response en un único hilo (seguro para el stream HTTP).
        await foreach (var mensaje in channel.Reader.ReadAllAsync(ct))
        {
            await Response.WriteAsync(mensaje, ct);
            await Response.Body.FlushAsync(ct);
        }

        await producerTask;

        var fin = JsonSerializer.Serialize(new { tipo = "fin", encontrados, faltantes });
        await Response.WriteAsync($"data: {fin}\n\n", ct);
        await Response.Body.FlushAsync(ct);
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
