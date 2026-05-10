using PunteoDomicilios.Web.DTOs;
using PunteoDomicilios.Web.Models;

namespace PunteoDomicilios.Web.Services;

public interface IMensajeroService
{
    Task<IEnumerable<string>> ObtenerUsuariosAsync();
    Task<IEnumerable<MvMensajer>> ObtenerRegistrosAsync(string usuario, DateOnly fecha);
    Task<IEnumerable<TimelineItemDto>> ObtenerTimelineAsync(string usuario, int dias = 7);
    Task<IEnumerable<ResumenMensualDto>> ObtenerResumenMensualAsync(string usuario);
    Task<IEnumerable<DiaMesDto>> ObtenerDiasDelMesAsync(string usuario, string mes);
}
