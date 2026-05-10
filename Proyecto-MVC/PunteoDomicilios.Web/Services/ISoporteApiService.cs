using PunteoDomicilios.Web.DTOs;
using PunteoDomicilios.Web.Models;

namespace PunteoDomicilios.Web.Services;

public interface ISoporteApiService
{
    Task<SoporteApiResponse?> ConsultarAsync(string nrodcto, CancellationToken ct = default);
    Task<IEnumerable<NrodctoEstadoDto>> ConsultarBatchAsync(
        IEnumerable<string> nrodctos,
        CancellationToken ct = default);
}
