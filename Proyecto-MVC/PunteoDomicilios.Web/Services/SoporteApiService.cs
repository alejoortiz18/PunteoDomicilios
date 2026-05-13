using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Threading.Channels;
using Microsoft.Extensions.Caching.Memory;
using PunteoDomicilios.Web.DTOs;
using PunteoDomicilios.Web.Models;
using PunteoDomicilios.Web.Repositories;

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
    private readonly IDocumentoCacheRepository _cacheRepo;
    private readonly ILogger<SoporteApiService> _logger;
    private readonly int _cacheMinutes;
    private readonly int _maxConcurrentRequests;
    private readonly bool _cacheLocalHabilitado;

    public SoporteApiService(
        HttpClient http,
        IMemoryCache cache,
        IDocumentoCacheRepository cacheRepo,
        IConfiguration configuration,
        ILogger<SoporteApiService> logger)
    {
        _http = http;
        _cache = cache;
        _cacheRepo = cacheRepo;
        _logger = logger;
        _cacheMinutes = configuration.GetValue("ApiInterna:CacheMinutes", 30);
        _maxConcurrentRequests = configuration.GetValue("ApiInterna:MaxConcurrentRequests", 1);
        _cacheLocalHabilitado = configuration.GetValue("CacheLocal:Habilitado", true);

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
        var nrodctoTrimmed = nrodcto.Trim();
        var cacheKey = $"soporte:{nrodctoTrimmed}";

        // L1: caché en memoria (rápido, volátil)
        if (_cache.TryGetValue(cacheKey, out SoporteApiResponse? cached))
        {
            _logger.LogDebug("Caché L1 HIT: {Nrodcto}", nrodctoTrimmed);
            return cached;
        }

        // L2: caché persistente en SQL LocalDB (incluye encontrados y faltantes confirmados)
        if (_cacheLocalHabilitado)
        {
            try
            {
                var itemLocal = await _cacheRepo.ObtenerAsync(nrodctoTrimmed, ct);
                if (itemLocal is not null)
                {
                    SoporteApiResponse responseLocal;
                    if (itemLocal.Storage_Path == SqlDocumentoCacheRepository.FALTANTE_SENTINEL)
                    {
                        // Documento confirmado sin soporte en consulta anterior
                        responseLocal = new SoporteApiResponse(false, "Sin soporte", null);
                    }
                    else
                    {
                        responseLocal = new SoporteApiResponse(true, null, [itemLocal]);
                    }
                    _cache.Set(cacheKey, responseLocal, TimeSpan.FromMinutes(_cacheMinutes));
                    return responseLocal;
                }
            }
            catch (Exception ex)
            {
                // L2 no disponible: degradar silenciosamente al API
                _logger.LogWarning(ex, "Caché L2 no disponible para {Nrodcto}, consultando API", nrodctoTrimmed);
            }
        }

        // Controlar concurrencia global hacia la API externa (evita rate limiting 429).
        await _apiSemaphore!.WaitAsync(CancellationToken.None);
        try
        {
            // Double-check: otra llamada concurrente puede haber cacheado el resultado en L1.
            if (_cache.TryGetValue(cacheKey, out cached))
                return cached;

            var inicio = DateTime.UtcNow;

            // Usar GetAsync en lugar de GetFromJsonAsync para poder inspeccionar el StatusCode
            // antes de intentar deserializar, así controlamos 404 sin depender de HttpRequestException.StatusCode.
            var httpResp = await _http.GetAsync(
                $"/api/v1/consultasoporte/{Uri.EscapeDataString(nrodctoTrimmed)}", ct);

            var elapsed = (DateTime.UtcNow - inicio).TotalMilliseconds;

            // 404 = el documento existe en MvMensajer pero no tiene soporte registrado en el API.
            // Se trata como Faltante (no como error de infraestructura).
            if (httpResp.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                _logger.LogDebug("API soporte {Nrodcto}: 404 sin soporte registrado en {Ms}ms",
                    nrodctoTrimmed, elapsed);
                var notFound = new SoporteApiResponse(false, "Sin soporte", null);
                _cache.Set(cacheKey, notFound, TimeSpan.FromMinutes(_cacheMinutes));

                // Persistir el faltante en L2 para evitar re-consultas en reinicios del servidor
                if (_cacheLocalHabilitado)
                {
                    try
                    {
                        await _cacheRepo.MarcarFaltanteAsync(nrodctoTrimmed, CancellationToken.None);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "No se pudo marcar faltante en L2 para {Nrodcto}", nrodctoTrimmed);
                    }
                }
                return notFound;
            }

            // Para cualquier otro error HTTP (5xx, 401, etc.) lanzar excepción
            httpResp.EnsureSuccessStatusCode();

            var response = await httpResp.Content.ReadFromJsonAsync<SoporteApiResponse>(ct);

            _logger.LogDebug("API soporte {Nrodcto}: success={Success} en {Ms}ms",
                nrodctoTrimmed, response?.Success, elapsed);

            if (response is not null)
            {
                // Siempre guardar en L1
                _cache.Set(cacheKey, response, TimeSpan.FromMinutes(_cacheMinutes));

                // Persistir en L2 si el documento fue encontrado exitosamente
                if (_cacheLocalHabilitado && response.Success && response.Data is { Count: > 0 })
                {
                    try
                    {
                        await _cacheRepo.GuardarAsync(nrodctoTrimmed, response.Data[0], CancellationToken.None);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "No se pudo persistir en caché L2 para {Nrodcto}", nrodctoTrimmed);
                    }
                }
            }

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
        var lista = nrodctos.Select(n => n.Trim()).Distinct().ToList();
        var resultados = new ConcurrentBag<NrodctoEstadoDto>();

        // Pre-calentar L1 con una sola consulta SQL batch (1 query en vez de N)
        // Los documentos encontrados en SQL quedan en memoria y no llaman al API externo.
        if (_cacheLocalHabilitado && lista.Count > 0)
        {
            try
            {
                var sqlHits = await _cacheRepo.ObtenerBatchAsync(lista, CancellationToken.None);
                int encontrados = 0, faltantes = 0;
                foreach (var (nrodcto, item) in sqlHits)
                {
                    var key = $"soporte:{nrodcto}";
                    if (!_cache.TryGetValue(key, out _))
                    {
                        if (item.Storage_Path == SqlDocumentoCacheRepository.FALTANTE_SENTINEL)
                        {
                            // Documento confirmado sin soporte en consultas anteriores
                            _cache.Set(key, new SoporteApiResponse(false, "Sin soporte", null),
                                TimeSpan.FromMinutes(_cacheMinutes));
                            faltantes++;
                        }
                        else
                        {
                            _cache.Set(key, new SoporteApiResponse(true, null, [item]),
                                TimeSpan.FromMinutes(_cacheMinutes));
                            encontrados++;
                        }
                    }
                }
                _logger.LogDebug("Batch pre-calentamiento L2: {Encontrados} encontrados + {Faltantes} faltantes / {Total} total",
                    encontrados, faltantes, lista.Count);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Pre-calentamiento batch L2 falló, se consultará API");
            }
        }

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

    public async Task<IEnumerable<NrodctoEstadoDto>> ConsultarDesdeCacheAsync(
        IEnumerable<string> nrodctos, CancellationToken ct = default)
    {
        var lista = nrodctos.Select(n => n.Trim()).Distinct().ToList();
        var resultados = new List<NrodctoEstadoDto>();

        if (!_cacheLocalHabilitado || lista.Count == 0)
            return resultados;

        try
        {
            var sqlHits = await _cacheRepo.ObtenerBatchAsync(lista, ct);
            foreach (var (nrodcto, item) in sqlHits)
            {
                var key = $"soporte:{nrodcto}";
                NrodctoEstadoDto estado;
                if (item.Storage_Path == SqlDocumentoCacheRepository.FALTANTE_SENTINEL)
                {
                    estado = new(nrodcto, EstadoSoporte.Faltante, null, null, null, "Sin soporte");
                    _cache.Set(key, new SoporteApiResponse(false, "Sin soporte", null),
                        TimeSpan.FromMinutes(_cacheMinutes));
                }
                else
                {
                    estado = new(nrodcto, EstadoSoporte.Encontrado,
                        item.FechaRegistro, item.Storage_Disk, item.Storage_Path, null);
                    _cache.Set(key, new SoporteApiResponse(true, null, [item]),
                        TimeSpan.FromMinutes(_cacheMinutes));
                }
                resultados.Add(estado);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ConsultarDesdeCacheAsync: acceso a caché L2 falló");
        }

        return resultados;
    }

    public async IAsyncEnumerable<NrodctoEstadoDto> ConsultarBatchStreamAsync(
        IEnumerable<string> nrodctos,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var lista = nrodctos.Select(n => n.Trim()).Distinct().ToList();
        if (lista.Count == 0) yield break;

        var channel = Channel.CreateUnbounded<NrodctoEstadoDto>(
            new UnboundedChannelOptions { SingleWriter = false, SingleReader = true });

        // Pre-calentar L2: un solo query SQL para cargar caché L1 antes del paralelo
        if (_cacheLocalHabilitado)
        {
            try
            {
                var sqlHits = await _cacheRepo.ObtenerBatchAsync(lista, CancellationToken.None);
                int enc = 0, falt = 0;
                foreach (var (nrodcto, item) in sqlHits)
                {
                    var key = $"soporte:{nrodcto}";
                    if (_cache.TryGetValue(key, out _)) continue;
                    if (item.Storage_Path == SqlDocumentoCacheRepository.FALTANTE_SENTINEL)
                    {
                        _cache.Set(key, new SoporteApiResponse(false, "Sin soporte", null),
                            TimeSpan.FromMinutes(_cacheMinutes));
                        falt++;
                    }
                    else
                    {
                        _cache.Set(key, new SoporteApiResponse(true, null, [item]),
                            TimeSpan.FromMinutes(_cacheMinutes));
                        enc++;
                    }
                }
                _logger.LogDebug("Stream pre-calentamiento L2: {Enc} encontrados + {Falt} faltantes / {Total} total",
                    enc, falt, lista.Count);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Stream: pre-calentamiento L2 falló, se consultará API directo");
            }
        }

        // Procesar en paralelo; cada resultado se escribe al channel en cuanto resuelve
        _ = Task.Run(async () =>
        {
            try
            {
                await Parallel.ForEachAsync(lista, CancellationToken.None, async (nrodcto, _) =>
                {
                    NrodctoEstadoDto estado;
                    try
                    {
                        var resp = await ConsultarAsync(nrodcto, CancellationToken.None);
                        estado = BuildEstadoDto(nrodcto, resp);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Error en stream para {Nrodcto}", nrodcto);
                        estado = new(nrodcto, EstadoSoporte.Error, null, null, null, "Error interno");
                    }
                    await channel.Writer.WriteAsync(estado, CancellationToken.None);
                });
            }
            finally
            {
                channel.Writer.Complete();
            }
        }, CancellationToken.None);

        await foreach (var item in channel.Reader.ReadAllAsync(ct))
            yield return item;
    }

    // Helper: convierte SoporteApiResponse? en NrodctoEstadoDto
    private static NrodctoEstadoDto BuildEstadoDto(string nrodcto, SoporteApiResponse? resp)
    {
        if (resp is null)
            return new(nrodcto, EstadoSoporte.Error, null, null, null, "Sin respuesta de API");

        if (resp.Success && resp.Data is { Count: > 0 })
        {
            var d = resp.Data[0];
            return new(nrodcto, EstadoSoporte.Encontrado,
                d.FechaRegistro, d.Storage_Disk, d.Storage_Path, null);
        }

        return new(nrodcto, EstadoSoporte.Faltante, null, null, null, resp.Message);
    }
}
