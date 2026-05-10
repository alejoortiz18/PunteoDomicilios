using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using PunteoDomicilios.Web.DTOs;
using PunteoDomicilios.Web.Models;

namespace PunteoDomicilios.Web.Services;

public class SoporteApiService : ISoporteApiService
{
    // Semáforo estático compartido entre todas las instancias (servicio Transient).
    // Limita el total de llamadas concurrentes a la API externa, incluyendo
    // tanto el batch del Dashboard como las consultas individuales del Detalle.
    private static SemaphoreSlim? _apiSemaphore;
    private static readonly object _semLock = new();

    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;
    private readonly ILogger<SoporteApiService> _logger;
    private readonly int _cacheMinutes;
    private readonly int _maxConcurrentRequests;

    public SoporteApiService(
        HttpClient http,
        IMemoryCache cache,
        IConfiguration configuration,
        ILogger<SoporteApiService> logger)
    {
        _http = http;
        _cache = cache;
        _logger = logger;
        _cacheMinutes = configuration.GetValue("ApiInterna:CacheMinutes", 30);
        _maxConcurrentRequests = configuration.GetValue("ApiInterna:MaxConcurrentRequests", 1);

        // Inicializar el semáforo estático una sola vez con el valor de config.
        if (_apiSemaphore is null)
        {
            lock (_semLock)
            {
                _apiSemaphore ??= new SemaphoreSlim(_maxConcurrentRequests, _maxConcurrentRequests);
            }
        }
    }

    public async Task<SoporteApiResponse?> ConsultarAsync(string nrodcto, CancellationToken ct = default)
    {
        var cacheKey = $"soporte:{nrodcto}";

        if (_cache.TryGetValue(cacheKey, out SoporteApiResponse? cached))
        {
            _logger.LogDebug("Cache hit para {Nrodcto}", nrodcto);
            return cached;
        }

        var nrodctoTrimmed = nrodcto.Trim();

        // Controlar concurrencia global hacia la API externa (evita rate limiting 429).
        await _apiSemaphore!.WaitAsync(CancellationToken.None);
        try
        {
            // Double-check: otra llamada concurrente puede haber cacheado el resultado.
            if (_cache.TryGetValue(cacheKey, out cached))
                return cached;

            var inicio = DateTime.UtcNow;
            var response = await _http.GetFromJsonAsync<SoporteApiResponse>(
                $"/api/v1/consultasoporte/{Uri.EscapeDataString(nrodctoTrimmed)}", ct);

            var elapsed = (DateTime.UtcNow - inicio).TotalMilliseconds;
            _logger.LogDebug("API soporte {Nrodcto}: success={Success} en {Ms}ms",
                nrodctoTrimmed, response?.Success, elapsed);

            if (response is not null)
                _cache.Set(cacheKey, response, TimeSpan.FromMinutes(_cacheMinutes));

            return response;
        }
        catch (TaskCanceledException)
        {
            _logger.LogWarning("Timeout consultando soporte para {Nrodcto}", nrodctoTrimmed);
            return null;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Error HTTP consultando soporte para {Nrodcto}", nrodctoTrimmed);
            return null;
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Respuesta no JSON de la API para {Nrodcto}", nrodctoTrimmed);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error inesperado consultando soporte para {Nrodcto}", nrodctoTrimmed);
            return null;
        }
        finally
        {
            _apiSemaphore!.Release();
        }
    }

    public async Task<IEnumerable<NrodctoEstadoDto>> ConsultarBatchAsync(
        IEnumerable<string> nrodctos,
        CancellationToken ct = default)
    {
        var lista = nrodctos.Distinct().ToList();
        var resultados = new ConcurrentBag<NrodctoEstadoDto>();

        // El semáforo global en ConsultarAsync ya controla la concurrencia.
        // Usamos CancellationToken.None para que ninguna cancelación externa
        // (timeout del cliente, navegador cerrando, etc.) aborte el batch completo.
        // El batch siempre termina y devuelve resultados parciales con EstadoSoporte.Error.
        await Parallel.ForEachAsync(lista, CancellationToken.None, async (nrodcto, _) =>
        {
            try
            {
                var resp = await ConsultarAsync(nrodcto, CancellationToken.None);
                NrodctoEstadoDto estado;

                if (resp is null)
                {
                    estado = new(nrodcto, EstadoSoporte.Error, null, null, null, "Sin respuesta de API");
                }
                else if (resp.Success && resp.Data is { Count: > 0 })
                {
                    var item = resp.Data[0];
                    estado = new(nrodcto, EstadoSoporte.Encontrado,
                        item.FechaRegistro, item.Storage_Disk, item.Storage_Path, null);
                }
                else
                {
                    estado = new(nrodcto, EstadoSoporte.Faltante, null, null, null, resp.Message);
                }

                resultados.Add(estado);
            }
            catch (OperationCanceledException)
            {
                // Batch cancelado por el cliente — registrar y continuar con los ya consultados
                _logger.LogWarning("Batch cancelado para {Nrodcto}", nrodcto);
                resultados.Add(new(nrodcto, EstadoSoporte.Error, null, null, null, "Consulta cancelada"));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error inesperado en batch para {Nrodcto}", nrodcto);
                resultados.Add(new(nrodcto, EstadoSoporte.Error, null, null, null, "Error en consulta"));
            }
        });

        return resultados;
    }
}
