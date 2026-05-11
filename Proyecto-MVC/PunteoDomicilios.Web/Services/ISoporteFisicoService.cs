using PunteoDomicilios.Web.DTOs;

namespace PunteoDomicilios.Web.Services;

public interface ISoporteFisicoService
{
    Task<(bool Exito, string Mensaje)> EnviarAsync(
        string idSoporte,
        string rutaArchivoTemp,
        string nombreArchivoOriginal,
        SoporteClinicoDto datos,
        CancellationToken ct = default);
}
