using PunteoDomicilios.Web.DTOs;

namespace PunteoDomicilios.Web.Repositories;

public interface IFacturaPorFechaRepository
{
    Task<IReadOnlyList<string>> ObtenerNombresCarteraAsync(CancellationToken ct = default);

    Task<IReadOnlyList<string>> ObtenerTiposDctoAsync(
        DateOnly fecha,
        string nombreCartera,
        CancellationToken ct = default);

    Task<IEnumerable<FacturaPorFechaDto>> ObtenerFacturasPorFechaAsync(
        DateOnly fecha,
        string nombreCartera,
        IReadOnlyCollection<string>? tiposDcto = null,
        CancellationToken ct = default);
}
