using PunteoDomicilios.Web.DTOs;
using PunteoDomicilios.Web.Models;

namespace PunteoDomicilios.Web.Services;

public interface ISoporteApiService
{
    Task<SoporteApiResponse?> ConsultarAsync(string nrodcto, CancellationToken ct = default);
    Task<IEnumerable<NrodctoEstadoDto>> ConsultarBatchAsync(
        IEnumerable<string> nrodctos,
        CancellationToken ct = default);
    /// <summary>
    /// Fase 1 del batch: retorna únicamente los nrodctos que ya están en caché
    /// (DocumentosIndexados L2 + L1 en memoria). No llama al API externo.
    /// </summary>
    Task<IEnumerable<NrodctoEstadoDto>> ConsultarDesdeCacheAsync(
        IEnumerable<string> nrodctos,
        CancellationToken ct = default);
    /// <summary>
    /// Streaming batch: emite un NrodctoEstadoDto por cada nrodcto en cuanto se resuelve
    /// (caché L1/L2 primero, luego API externo). Permite progreso real en el cliente.
    /// </summary>
    IAsyncEnumerable<NrodctoEstadoDto> ConsultarBatchStreamAsync(
        IEnumerable<string> nrodctos,
        CancellationToken ct = default);
}
