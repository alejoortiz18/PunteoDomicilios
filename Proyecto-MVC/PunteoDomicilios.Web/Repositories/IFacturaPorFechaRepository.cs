using PunteoDomicilios.Web.DTOs;

namespace PunteoDomicilios.Web.Repositories;

public interface IFacturaPorFechaRepository
{
    Task<IReadOnlyList<string>> ObtenerNombresCarteraAsync(CancellationToken ct = default);

    Task<IEnumerable<FacturaPorFechaDto>> ObtenerFacturasPorFechaAsync(
        DateOnly fecha,
        string nombreCartera,
        CancellationToken ct = default);
}
