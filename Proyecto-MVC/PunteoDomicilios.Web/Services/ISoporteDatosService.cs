using PunteoDomicilios.Web.DTOs;

namespace PunteoDomicilios.Web.Services;

public interface ISoporteDatosService
{
    Task<(SoporteClinicoDto? Datos, string Mensaje)> ObtenerDatosAsync(string idSoporte, CancellationToken ct = default);
}
