namespace PunteoDomicilios.Web.Services;

public interface IDescargaService
{
    Task<Stream?> ObtenerArchivoAsync(string storagePath, CancellationToken ct = default);
}
